// Vòng đời trận: round, kinh tế, mua đồ, bom C4, lựu đạn, nhặt súng. Không phụ thuộc Three.js -> chạy được trên Node (selftest).
import { RULES, WEAPONS, EQUIP, BOT_NAMES } from './constants.js';
import { buildMap, inRect, placeName } from './map.js';
import { Nav } from './nav.js';
import { Physics, initPhysics } from './physics.js';
import { Agent, moveAgent } from './agent.js';
import { updateWeapon, switchSlot } from './combat.js';
import { Bot } from './bot.js';

export const DT = 1 / 60;

export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Game {
  static async create(opts) { await initPhysics(); return new Game(opts); }

  constructor({ humanTeam = null, humanName = 'Bạn', skill = 'normal', seed = (Math.random() * 1e9) | 0, teamSize = RULES.teamSize } = {}) {
    this.rnd = mulberry32(seed);
    this.skill = skill;
    this.map = buildMap();
    this.nav = new Nav(this.map);
    this.phys = new Physics(this.map);
    this.now = 0;
    this.events = [];
    this.agents = [];
    this.human = null;
    const names = shuffle([...BOT_NAMES], this.rnd);
    for (const team of ['T', 'CT']) {
      for (let i = 0; i < teamSize; i++) {
        const isHuman = humanTeam === team && i === 0;
        const a = new Agent(this.agents.length, isHuman ? humanName : names.pop(), team, !isHuman);
        a.collider = this.phys.createAgent({ x: 10, y: 0, z: 10 });
        if (isHuman) this.human = a;
        else a.brain = new Bot(this, a);
        this.agents.push(a);
      }
    }
    this.score = { T: 0, CT: 0 };
    this.lossStreak = { T: 0, CT: 0 };
    this.round = 0;
    this.history = [];
    this.dropped = [];
    this.nades = [];
    this.bomb = { state: 'none', pos: null, carrier: null, site: null, explodeAt: 0, defuser: null };
    this.intel = { T: [], CT: [] }; // vị trí địch đồng đội vừa thấy / nghe
    this.startRound();
  }

  emit(e) { e.t = this.now; this.events.push(e); }
  drain() { const e = this.events; this.events = []; return e; }

  team(t) { return this.agents.filter((a) => a.team === t); }
  alive(t) { return this.agents.filter((a) => a.alive && a.team === t); }
  siteAt(p) { for (const k of ['A', 'B']) if (inRect(this.map.zones[k], p.x, p.z)) return k; return null; }
  timeLeft() {
    if (this.phase === 'planted') return Math.max(0, this.bomb.explodeAt - this.now);
    return Math.max(0, this.phaseEnd - this.now);
  }
  canBuy(a) {
    if (!a.alive || this.phase === 'end' || this.phase === 'over' || this.now - this.roundStart > RULES.buyTime) return false;
    return inRect(this.map.zones[a.team === 'T' ? 'buyT' : 'buyCT'], a.pos.x, a.pos.z);
  }

  startRound() {
    this.round++;
    this.phase = 'freeze';
    this.roundStart = this.now;
    this.phaseEnd = this.now + RULES.freezeTime;
    for (const d of this.dropped) d.removed = true;
    this.dropped = [];
    for (const n of this.nades) this.phys.removeBody(n.body);
    this.nades = [];
    this.intel = { T: [], CT: [] };
    for (const team of ['T', 'CT']) {
      const spawns = shuffle([...this.map.spawns[team]], this.rnd);
      this.team(team).forEach((a, i) => {
        a.resetForRound(a.alive && this.round > 1);
        const s = spawns[i % spawns.length];
        this.phys.teleport(a, { x: s.x, y: 0.02, z: s.z });
        a.yaw = team === 'T' ? 0 : Math.PI;
        a.pitch = 0;
        a.onGround = true;
      });
    }
    const ts = this.team('T');
    const carrier = ts[(this.rnd() * ts.length) | 0];
    carrier.inv[5] = true;
    this.bomb = { state: 'carried', pos: null, carrier, site: null, explodeAt: 0, defuser: null };
    this.tPlan = this.rnd() < 0.5 ? 'A' : 'B';
    for (const a of this.agents) a.brain?.onRoundStart();
    this.emit({ type: 'roundStart', round: this.round });
  }

  endRound(winner, reason) {
    if (this.phase === 'end' || this.phase === 'over') return;
    const loser = winner === 'T' ? 'CT' : 'T';
    this.score[winner]++;
    const reward = reason === 'bomb' || reason === 'defuse' ? RULES.winBomb : reason === 'time' ? RULES.winTime : RULES.winElim;
    const lossBonus = Math.min(RULES.lossMax, RULES.lossBase + RULES.lossStep * this.lossStreak[loser]);
    this.lossStreak[loser]++;
    this.lossStreak[winner] = 0;
    for (const a of this.team(winner)) this.addMoney(a, reward);
    for (const a of this.team(loser)) this.addMoney(a, lossBonus + (loser === 'T' && this.bomb.state !== 'carried' && this.bomb.state !== 'dropped' ? RULES.plantedLossBonus : 0));
    for (const a of this.agents) { a.plantStart = a.defuseStart = -1; }
    this.history.push({ round: this.round, winner, reason });
    const over = this.score[winner] >= RULES.winRounds;
    this.phase = over ? 'over' : 'end';
    this.phaseEnd = this.now + RULES.endDelay;
    this.emit({ type: 'roundEnd', winner, reason, over });
  }

  addMoney(a, n) { a.money = Math.max(0, Math.min(RULES.maxMoney, a.money + n)); }

  // ---------- Mua đồ ----------
  priceOf(a, id) {
    if (id === 'vesthelm' && a.armor >= 100 && !a.helmet) return 350;
    return (WEAPONS[id] ?? EQUIP[id]).price;
  }
  buyError(a, id) {
    if (!this.canBuy(a)) return 'Không ở trong vùng mua / hết giờ mua';
    const def = WEAPONS[id] ?? EQUIP[id];
    if (!def) return 'Không có món này';
    if (def.team && def.team !== a.team) return 'Phe bạn không mua được món này';
    if (a.money < this.priceOf(a, id)) return 'Không đủ tiền';
    if (id === 'he' && a.inv[4] > 0) return 'Đã có lựu đạn';
    if (id === 'vest' && a.armor >= 100) return 'Đã có giáp';
    if (id === 'vesthelm' && a.armor >= 100 && a.helmet) return 'Đã có giáp + mũ';
    if (id === 'defuser' && a.defuser) return 'Đã có bộ gỡ bom';
    if (WEAPONS[id] && a.inv[def.slot]?.id === id) return 'Đã có súng này';
    if (id === 'ammo1' && (!a.inv[1] || a.inv[1].reserve >= WEAPONS[a.inv[1].id].reserve)) return 'Đạn đã đầy';
    if (id === 'ammo2' && (!a.inv[2] || a.inv[2].reserve >= WEAPONS[a.inv[2].id].reserve)) return 'Đạn đã đầy';
    return null;
  }
  buy(a, id) {
    const err = this.buyError(a, id);
    if (err) { if (!a.bot) this.emit({ type: 'buyFail', a, msg: err }); return false; }
    a.money -= this.priceOf(a, id);
    const w = WEAPONS[id];
    if (w) {
      if (w.slot <= 2 && a.inv[w.slot]) this.dropGun(a, w.slot);
      a.give(id);
      if (w.slot <= 2) { a.slot = 0; switchSlot(this, a, w.slot); }
    } else if (id === 'vest') a.armor = 100;
    else if (id === 'vesthelm') { a.armor = 100; a.helmet = true; }
    else if (id === 'defuser') a.defuser = true;
    else if (id === 'ammo1') a.inv[1].reserve = WEAPONS[a.inv[1].id].reserve;
    else if (id === 'ammo2') a.inv[2].reserve = WEAPONS[a.inv[2].id].reserve;
    this.emit({ type: 'buy', a, item: id });
    return true;
  }

  // ---------- Sát thương ----------
  damage(v, attacker, dmg, group, weapon, armorRatio, dir) {
    if (!v.alive || this.phase === 'over') return;
    let hp = dmg;
    const armored = v.armor > 0 && group !== 'legs' && (group !== 'head' || v.helmet);
    if (armored) {
      hp = dmg * armorRatio * 0.5;
      let loss = (dmg - hp) * 0.5;
      if (loss > v.armor) { hp = dmg - v.armor * 2; loss = v.armor; }
      v.armor = Math.max(0, Math.round(v.armor - loss));
    }
    hp = Math.max(1, Math.round(hp));
    v.hp -= hp;
    v.lastHurt = this.now;
    v.lastAttacker = attacker;
    v.plantStart = v.defuseStart = -1;
    this.emit({ type: 'hurt', a: v, by: attacker, dmg: hp, group, dir });
    if (attacker && attacker !== v) this.noteEnemy(v.team, attacker.pos, 1);
    if (v.hp <= 0) { v.hp = 0; this.kill(v, attacker, weapon, group === 'head'); }
  }

  kill(v, killer, weapon, headshot) {
    if (!v.alive) return;
    v.alive = false;
    v.deaths++;
    if (killer && killer !== v && killer.team !== v.team) { killer.kills++; this.addMoney(killer, RULES.killReward); }
    if (v.inv[1]) this.dropGun(v, 1);
    else if (v.inv[2]) this.dropGun(v, 2);
    if (v.inv[5]) this.dropBomb(v);
    if (this.bomb.defuser === v) this.bomb.defuser = null;
    this.emit({ type: 'kill', a: killer, victim: v, weapon, headshot, place: placeName(v.pos.x, v.pos.z) });
    this.checkElimination();
  }

  checkElimination() {
    if (this.phase !== 'live' && this.phase !== 'planted') return;
    const t = this.alive('T').length, ct = this.alive('CT').length;
    if (ct === 0) this.endRound('T', 'elim');
    else if (t === 0 && this.phase !== 'planted') this.endRound('CT', 'elim');
  }

  noteEnemy(team, pos, weight) {
    const list = this.intel[team];
    list.push({ x: pos.x, z: pos.z, t: this.now, w: weight });
    if (list.length > 12) list.shift();
  }

  // ---------- Vũ khí rơi ----------
  dropPoint(a, throwDist) {
    const d = { x: -Math.sin(a.yaw), y: 0, z: -Math.cos(a.yaw) };
    const o = { x: a.pos.x, y: a.pos.y + 1, z: a.pos.z };
    const hit = this.phys.ray(o, d, throwDist + 0.4);
    const dist = hit ? Math.max(0, hit.dist - 0.4) : throwDist;
    const p = { x: o.x + d.x * dist, y: o.y, z: o.z + d.z * dist };
    const down = this.phys.ray(p, { x: 0, y: -1, z: 0 }, 5);
    p.y = down ? p.y - down.dist : 0;
    return p;
  }
  dropGun(a, slot, throwDist = 0.3) {
    const gun = a.inv[slot];
    if (!gun) return;
    a.inv[slot] = null;
    this.dropped.push({ kind: 'gun', gun, pos: this.dropPoint(a, throwDist), owner: a, t: this.now, yaw: this.rnd() * 6.28 });
    if (a.slot === slot) { a.slot = 0; switchSlot(this, a, a.bestSlot()); }
  }
  dropBomb(a, throwDist = 0.3) {
    a.inv[5] = false;
    const pos = this.dropPoint(a, throwDist);
    this.bomb = { ...this.bomb, state: 'dropped', pos, carrier: null };
    this.dropped.push({ kind: 'c4', pos, owner: a, t: this.now, yaw: 0 });
    if (a.slot === 5) { a.slot = 0; switchSlot(this, a, a.bestSlot()); }
    this.emit({ type: 'bombDrop', a });
  }
  dropCurrent(a) {
    if (!a.alive) return;
    if (a.slot === 5 && a.inv[5]) this.dropBomb(a, 1.5);
    else if (a.slot <= 2 && a.inv[a.slot]) this.dropGun(a, a.slot, 1.5);
  }

  pickups() {
    for (const a of this.agents) {
      if (!a.alive) continue;
      for (const d of this.dropped) {
        if (d.removed || (d.owner === a && this.now - d.t < 1.2)) continue;
        if (Math.hypot(d.pos.x - a.pos.x, d.pos.z - a.pos.z) > 1.0 || Math.abs(d.pos.y - a.pos.y) > 1.4) continue;
        if (d.kind === 'c4') {
          if (a.team !== 'T') continue;
          a.inv[5] = true;
          this.bomb = { ...this.bomb, state: 'carried', carrier: a, pos: null };
          d.removed = true;
          this.emit({ type: 'bombPick', a });
        } else {
          const slot = WEAPONS[d.gun.id].slot;
          if (a.inv[slot]) continue;
          a.inv[slot] = d.gun;
          d.removed = true;
          this.emit({ type: 'pickup', a, weapon: d.gun.id });
          if (slot < a.slot || a.slot >= 3) { a.slot = 0; switchSlot(this, a, slot); }
        }
      }
    }
    this.dropped = this.dropped.filter((d) => !d.removed);
  }

  // ---------- Bom ----------
  plant(a, site) {
    a.inv[5] = false;
    a.plantStart = -1;
    this.bomb = { state: 'planted', pos: { ...a.pos }, carrier: null, site, explodeAt: this.now + RULES.c4Timer, defuser: null, plantedAt: this.now };
    this.phase = 'planted';
    this.addMoney(a, RULES.plantReward);
    switchSlot(this, a, a.bestSlot());
    this.emit({ type: 'plant', a, site });
  }

  updateDefuse() {
    const b = this.bomb;
    if (b.state !== 'planted') return;
    for (const a of this.alive('CT')) {
      const near = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) < 1.5 && Math.abs(a.pos.y - b.pos.y) < 1.5;
      if (a.input.use && near && (!b.defuser || b.defuser === a)) {
        if (a.defuseStart < 0) { a.defuseStart = this.now; b.defuser = a; this.emit({ type: 'defuseStart', a, kit: a.defuser }); }
        if (this.now - a.defuseStart >= (a.defuser ? RULES.defuseKitTime : RULES.defuseTime)) {
          b.state = 'defused';
          this.addMoney(a, RULES.defuseReward);
          this.emit({ type: 'defused', a });
          this.endRound('CT', 'defuse');
          return;
        }
      } else if (b.defuser === a) { a.defuseStart = -1; b.defuser = null; this.emit({ type: 'defuseAbort', a }); }
    }
  }

  explodeBomb() {
    const b = this.bomb;
    b.state = 'exploded';
    this.emit({ type: 'bombExplode', pos: b.pos });
    for (const a of this.agents) {
      if (!a.alive) continue;
      const d = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y, a.pos.z - b.pos.z);
      if (d < RULES.bombRadius) this.damage(a, null, RULES.bombDamage * (1 - d / RULES.bombRadius) ** 2, 'chest', 'c4', 1);
    }
    this.endRound('T', 'bomb');
  }

  // ---------- Lựu đạn ----------
  throwNade(a, pos, vel) {
    const body = this.phys.createNade(pos, vel);
    this.nades.push({ body, owner: a, explodeAt: this.now + WEAPONS.he.fuse, lastV: vel });
    this.emit({ type: 'throw', a });
  }
  updateNades() {
    for (const n of this.nades) {
      const v = n.body.linvel();
      const dv = Math.hypot(v.x - n.lastV.x, v.y - n.lastV.y, v.z - n.lastV.z);
      if (dv > 2.5) this.emit({ type: 'nadeBounce', pos: n.body.translation() });
      n.lastV = { x: v.x, y: v.y, z: v.z };
      if (this.now < n.explodeAt) continue;
      const p = n.body.translation();
      const pos = { x: p.x, y: p.y + 0.15, z: p.z };
      this.emit({ type: 'nadeExplode', pos });
      const w = WEAPONS.he;
      for (const a of this.agents) {
        if (!a.alive || (a.team === n.owner.team && a !== n.owner)) continue;
        const c = { x: a.pos.x, y: a.pos.y + a.eyeH * 0.7, z: a.pos.z };
        const d = Math.hypot(c.x - pos.x, c.y - pos.y, c.z - pos.z);
        if (d < w.radius && this.phys.los(pos, c)) this.damage(a, n.owner, w.dmg * (1 - d / w.radius), 'chest', 'he', w.armorRatio);
      }
      this.phys.removeBody(n.body);
      n.done = true;
    }
    this.nades = this.nades.filter((n) => !n.done);
  }

  // ---------- Vòng lặp ----------
  step(dt = DT) {
    this.now += dt;
    for (const a of this.agents) if (a.alive && a.brain) a.brain.update(dt);
    for (const a of this.agents) {
      if (a.alive) { moveAgent(this, a, dt); updateWeapon(this, a, dt); }
      Object.assign(a.prev, a.input);
      a.input.slot = 0;
    }
    if (this.phase === 'live' || this.phase === 'planted') { this.updateDefuse(); this.pickups(); }
    this.updateNades();
    this.phys.step();

    if (this.phase === 'freeze' && this.now >= this.phaseEnd) {
      this.phase = 'live';
      this.phaseEnd = this.now + RULES.roundTime;
      this.emit({ type: 'go' });
    } else if (this.phase === 'live' && this.now >= this.phaseEnd) this.endRound('CT', 'time');
    else if (this.phase === 'planted' && this.now >= this.bomb.explodeAt) this.explodeBomb();
    else if (this.phase === 'end' && this.now >= this.phaseEnd) this.startRound();
  }
}

export function shuffle(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
