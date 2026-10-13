// Mô phỏng 1 bản đồ: người chơi, quái, đạn, đồ rơi, NPC. Thuần JS — chạy được cả trong browser lẫn Node (selftest).
// Renderer chỉ đọc state + tiêu thụ world.ev (sự kiện: sát thương, hiệu ứng, lên cấp, thông báo...).
import { Grid } from './grid.js';
import { clamp, dist, dirOf } from './util.js';
import { MAPS, TOWN_NPCS } from './data/world.js';
import { MONSTERS, monStats } from './data/monsters.js';
import { PHAI, lvVal } from './data/phai.js';
import { elemMul, ELEM_STATUS } from './data/elements.js';
import { derive, gainXp, phaiOf, skillLv, skillUnlocked, xpNeed, autoAlloc, autoLearn, INV_SIZE } from './char.js';
import { rollDrop, goldDrop, CONSUMABLE, makeStack, STACK_MAX } from './items.js';
import * as Q from './quests.js';

const ACT_TIME = 0.62;        // thời gian 1 lần ra đòn (giây) ở tốc độ xuất chiêu 100%
const HIT_AT = 0.5;
const AGGRO = 4.5;
const LEASH = 20;
const RESPAWN = 12;
const PICK_R = 0.9;

export class World {
  constructor({ mapId, map, ch, rng, pos }) {
    this.id = mapId;
    this.def = MAPS[mapId];
    this.map = map;
    this.grid = new Grid(map);
    // cổng ra map: chặn đi bộ xuyên qua, muốn ra phải bấm vào cổng (goal 'exit')
    this.exits = this.def.town ? [] : map.exits.map((e, i) => ({ id: i, x: e[0] + e[2] / 2, y: e[1] + e[3] / 2, to: this.def.back }));
    if (!this.def.town) for (const e of map.exits) for (let j = e[1]; j < e[1] + e[3]; j++) for (let i = e[0]; i < e[0] + e[2]; i++) if (i < map.w && j < map.h) this.grid.walk[j * map.w + i] = 0;
    this.ch = ch;
    this.rng = rng;
    this.t = 0;
    this.ev = [];
    this.uid = 1;
    this.mons = [];
    this.drops = [];
    this.projs = [];
    this.areas = [];
    this.npcs = [];
    const spawn = this.grid.nearestWalkable(map.hero[0] + 0.5, map.hero[1] + 0.5, 6);
    this.grid.flood(spawn[0], spawn[1]);
    const start = pos && this.grid.reachable(pos[0], pos[1]) ? pos : spawn;
    this.p = {
      id: 0, kind: 'player', x: start[0], y: start[1], dir: 7, anim: 'stance', animT: 0,
      hp: 1, mp: 1, goal: null, path: null, repath: 0, act: null, buffs: {}, status: {}, cds: {},
      sit: false, dead: false, deadT: 0, lastHurt: -99, potCd: { hp: 0, mp: 0 },
    };
    this.recalc();
    this.p.hp = ch.hp != null ? Math.min(ch.hp, this.st.maxHp) : this.st.maxHp;
    this.p.mp = ch.mp != null ? Math.min(ch.mp, this.st.maxMp) : this.st.maxMp;
    if (this.p.hp <= 0) this.p.hp = this.st.maxHp;
    if (this.def.town) this.spawnNpcs(); else this.spawnMons();
  }

  emit(e) { this.ev.push(e); }
  msg(text, kind = 'info') { this.emit({ t: 'msg', text, kind }); }

  // ---------- chỉ số ----------
  recalc() {
    const buffs = Object.values(this.p.buffs);
    this.st = derive(this.ch, buffs);
    if (this.p.hp > this.st.maxHp) this.p.hp = this.st.maxHp;
    if (this.p.mp > this.st.maxMp) this.p.mp = this.st.maxMp;
  }

  // ---------- spawn ----------
  spawnMons() {
    const d = this.def;
    // chỉ dùng vùng quái đi bộ tới được từ điểm vào map
    const zones = this.map.zones.filter((z) => this.randIn(z));
    const [hx, hy] = this.map.hero;
    zones.sort((a, b) => Math.hypot(a[0] + a[2] / 2 - hx, a[1] + a[3] / 2 - hy) - Math.hypot(b[0] + b[2] / 2 - hx, b[1] + b[3] / 2 - hy));
    const nz = zones.length;
    zones.forEach((z, zi) => {
      const lv = Math.round(d.lv[0] + (d.lv[1] - d.lv[0]) * (nz > 1 ? zi / (nz - 1) : 0));
      const main = d.mons[zi % d.mons.length];
      const n = this.rng.int(d.density - 1, d.density + 1);
      for (let k = 0; k < n; k++) {
        const type = this.rng() < 0.55 ? main : this.rng.pick(d.mons);
        const pt = this.randIn(z);
        if (pt) this.addMon(type, clamp(lv + this.rng.int(-1, 1), 1, 60), pt[0], pt[1], zi);
      }
    });
    this.zones = zones;
    if (d.boss) {
      const z = zones[nz - 1];
      const pt = this.randIn(z) || [z[0] + 0.5, z[1] + 0.5];
      this.boss = { def: d.boss, x: pt[0], y: pt[1], respawnAt: 0, mon: null };
      this.spawnBoss();
    }
  }
  spawnBoss() {
    const b = this.boss;
    b.mon = this.addMon(b.def.type, b.def.lv, b.x, b.y, -1);
    this.emit({ t: 'msg', text: `${MONSTERS[b.def.type].name} đã xuất hiện ở ${this.def.name}!`, kind: 'boss' });
  }
  randIn(z) {
    for (let k = 0; k < 20; k++) {
      const x = z[0] + this.rng() * Math.max(1, z[2]), y = z[1] + this.rng() * Math.max(1, z[3]);
      if (this.grid.okBody(x, y, 0.3) && this.grid.reachable(x, y)) return [x, y];
    }
    return this.grid.nearestWalkable(z[0] + z[2] / 2, z[1] + z[3] / 2, 3);
  }
  addMon(type, lv, x, y, zone) {
    const st = monStats(type, lv);
    const m = {
      id: this.uid++, kind: 'mon', type, def: MONSTERS[type], lv, st, x, y, home: { x, y }, zone,
      hp: st.maxHp, dir: this.rng.int(0, 7), anim: 'stance', animT: this.rng() * 1000,
      state: 'idle', wanderT: this.rng() * 5, path: null, repath: 0, atk: null, cd: 0, status: {}, dead: false, deadT: 0, hurtT: -9,
    };
    this.mons.push(m);
    return m;
  }
  spawnNpcs() {
    const list = [];
    for (const n of TOWN_NPCS[this.id]) {
      if (n.role === 'envoys') for (const [pid, P] of Object.entries(PHAI)) list.push({ role: 'envoy', phai: pid, ...P.envoy });
      else list.push(n);
    }
    // xếp NPC thành vòng cung quanh điểm vào thành, chỉ đặt trên ô trống
    const [hx, hy] = this.map.hero;
    const used = [];
    let ang = 0, r = 4;
    for (const n of list) {
      let spot = null;
      for (let k = 0; k < 200 && !spot; k++) {
        const x = hx + 0.5 + Math.cos(ang) * r, y = hy + 0.5 + Math.sin(ang) * r;
        ang += 0.45;
        if (k % 14 === 13) r += 1.2;
        if (this.grid.okBody(x, y, 0.45) && this.grid.reachable(x, y) && used.every((u) => Math.hypot(u[0] - x, u[1] - y) > 2.2)) spot = [x, y];
      }
      if (!spot) continue;
      used.push(spot);
      this.npcs.push({ id: this.uid++, kind: 'npc', ...n, x: spot[0], y: spot[1], dir: dirOf(hx - spot[0], hy - spot[1]) });
    }
  }


  // ---------- lệnh người chơi ----------
  stand() { this.p.sit = false; }
  cmdMove(x, y) { if (this.p.dead) return; this.stand(); this.p.goal = { type: 'move', x, y }; this.p.path = null; this.p.repath = 0; }
  cmdAttack(mon, skillId) { if (this.p.dead || !mon || mon.dead) return; this.stand(); this.p.goal = { type: 'attack', id: mon.id, skill: skillId }; this.p.path = null; this.p.repath = 0; }
  cmdSkillAt(skillId, x, y) { if (this.p.dead) return; this.stand(); this.p.goal = { type: 'cast', skill: skillId, x, y }; this.p.path = null; }
  cmdPick(drop) { if (this.p.dead) return; this.stand(); this.p.goal = { type: 'pick', id: drop.id }; this.p.path = null; this.p.repath = 0; }
  cmdExit(ex) { if (this.p.dead) return; this.stand(); this.p.goal = { type: 'exit', id: ex.id }; this.p.path = null; this.p.repath = 0; }
  cmdNpc(npc) { if (this.p.dead) return; this.stand(); this.p.goal = { type: 'npc', id: npc.id }; this.p.path = null; this.p.repath = 0; }
  cmdStop() { this.p.goal = null; this.p.path = null; }
  toggleSit() {
    if (this.p.dead || this.p.act) return;
    this.p.sit = !this.p.sit;
    if (this.p.sit) { this.p.goal = null; this.p.path = null; }
  }
  monById(id) { return this.mons.find((m) => m.id === id); }

  skill(id) { return phaiOf(this.ch).skills.find((s) => s.id === id) || phaiOf(this.ch).skills[0]; }
  mpCost(s) { return Math.round(lvVal(s.mp || [0, 0], skillLv(this.ch, s.id))); }
  canUse(s) {
    if (!skillUnlocked(this.ch, s) || (s.id !== 'basic' && !this.ch.skills[s.id])) return 'Chưa học';
    if ((this.p.cds[s.id] || 0) > this.t) return 'Đang hồi';
    if (this.p.mp < this.mpCost(s)) return 'Thiếu nội lực';
    return null;
  }
  /** Buff / hồi máu: tung ngay lên bản thân */
  castSelf(skillId) {
    const s = this.skill(skillId);
    if (this.p.dead || this.p.act || (s.type !== 'buff' && s.type !== 'heal')) return false;
    const why = this.canUse(s);
    if (why) return false;
    this.stand();
    this.startAct(s, null, this.p.x, this.p.y);
    return true;
  }

  // ---------- vật phẩm ----------
  invCount(id) { return this.ch.inv.filter((i) => i.stack && i.id === id).reduce((a, i) => a + i.qty, 0); }
  invFull() { return this.ch.inv.length >= INV_SIZE; }
  addItem(it) {
    if (it.stack) {
      let q = it.qty;
      for (const s of this.ch.inv) if (s.stack && s.id === it.id && s.qty < STACK_MAX) { const k = Math.min(q, STACK_MAX - s.qty); s.qty += k; q -= k; if (!q) return true; }
      while (q > 0) { if (this.invFull()) return false; const k = Math.min(q, STACK_MAX); this.ch.inv.push(makeStack(it.id, k)); q -= k; }
      return true;
    }
    if (this.invFull()) return false;
    this.ch.inv.push(it);
    return true;
  }
  useItem(uid) {
    const i = this.ch.inv.findIndex((x) => x.uid === uid);
    if (i < 0 || this.p.dead) return false;
    const it = this.ch.inv[i];
    if (!it.stack) return false;
    const C = CONSUMABLE[it.id];
    if (C.hp || C.mp) {
      const k = C.hp ? 'hp' : 'mp';
      if (this.p.potCd[k] > this.t) return false;
      this.p.potCd[k] = this.t + 0.6;
      if (C.hp) this.p.hp = Math.min(this.st.maxHp, this.p.hp + C.hp);
      if (C.mp) this.p.mp = Math.min(this.st.maxMp, this.p.mp + C.mp);
      this.emit({ t: 'fx', key: C.hp ? 'heal' : 'runes_blue', x: this.p.x, y: this.p.y, on: 0, small: true });
    } else if (it.id === 'tdp') {
      if (this.def.town) { this.msg('Đang ở trong thành'); return false; }
      this.ch.ret = { map: this.id, x: this.p.x, y: this.p.y };
      this.emit({ t: 'portal', to: this.ch.town, via: 'tdp' });
    }
    if (--it.qty <= 0) this.ch.inv.splice(i, 1);
    return true;
  }
  /** Uống thuốc tốt nhất còn trong túi (k: 'hp' | 'mp'). Trả false nếu hết. */
  drink(k) {
    const ids = [k + '3', k + '2', k + '1'];
    const lack = (k === 'hp' ? this.st.maxHp - this.p.hp : this.st.maxMp - this.p.mp);
    // ưu tiên bình nhỏ nhất đủ hồi phần thiếu, tránh phí bình lớn
    const have = ids.filter((id) => this.invCount(id) > 0);
    if (!have.length) return false;
    const fit = have.slice().reverse().find((id) => CONSUMABLE[id][k] >= lack * 0.8) || have[0];
    const it = this.ch.inv.find((x) => x.stack && x.id === fit);
    return this.useItem(it.uid);
  }

  // ---------- vòng lặp ----------
  update(dt) {
    this.t += dt;
    const p = this.p;
    if (p.dead) {
      p.deadT += dt;
      p.anim = 'die'; p.animT += dt * 1000;
      if (p.deadT > 3 && !p.respawnSent) { p.respawnSent = true; this.emit({ t: 'respawn', to: this.ch.town }); }
    } else {
      this.updateStatus(p, dt);
      this.updateBuffs();
      this.updatePlayer(dt);
      this.regen(dt);
    }
    for (const m of this.mons) this.updateMon(m, dt);
    this.updateProjs(dt);
    this.updateAreas(dt);
    if (this.boss && !this.boss.mon && this.t >= this.boss.respawnAt) this.spawnBoss();
    // dọn đồ rơi lâu (5 phút)
    if (this.drops.length > 120) this.drops.splice(0, this.drops.length - 120);
    this.drops = this.drops.filter((d) => this.t - d.t < 300);
  }

  regen(dt) {
    const p = this.p, st = this.st;
    const idle = this.t - p.lastHurt > 5;
    let hpR = idle ? 0.004 : 0.001, mpR = idle ? 0.006 : 0.003;
    if (p.sit) { hpR = 0.03; mpR = 0.04; }
    if (this.def.town) { hpR = Math.max(hpR, 0.05); mpR = Math.max(mpR, 0.05); }
    hpR += (st.regen || 0) / 100;
    p.hp = Math.min(st.maxHp, p.hp + st.maxHp * hpR * dt);
    p.mp = Math.min(st.maxMp, p.mp + st.maxMp * mpR * dt);
  }

  updateBuffs() {
    let ch = false;
    for (const [id, b] of Object.entries(this.p.buffs)) if (b.until <= this.t) { delete this.p.buffs[id]; ch = true; }
    if (ch) this.recalc();
  }

  updateStatus(u, dt) {
    const s = u.status;
    if (s.poison && s.poison.until > this.t) {
      const d = s.poison.dps * dt;
      if (u.kind === 'player') { u.hp -= d; if (u.hp <= 0) this.playerDie(); } else { u.hp -= d; if (u.hp <= 0 && !u.dead) this.killMon(u); }
    }
    if (s.burn && s.burn.until > this.t) {
      const d = s.burn.dps * dt;
      if (u.kind === 'player') { u.hp -= d; if (u.hp <= 0) this.playerDie(); } else { u.hp -= d; if (u.hp <= 0 && !u.dead) this.killMon(u); }
    }
  }
  slowMul(u) { return u.status.slow && u.status.slow.until > this.t ? 1 - u.status.slow.pct : 1; }
  stunned(u) { return u.status.stun && u.status.stun.until > this.t; }

  updatePlayer(dt) {
    const p = this.p;
    p.animT += dt * 1000;
    if (this.stunned(p)) { p.anim = 'hit'; return; }
    if (p.act) { this.updateAct(dt); return; }
    const g = p.goal;
    if (!g) { this.setAnim(p, p.sit ? 'sit' : 'stance'); return; }
    if (g.type === 'move') {
      if (this.moveTo(p, g.x, g.y, dt, this.st.spd * this.slowMul(p), 0.15) !== false) { p.goal = null; if (!p.path?.length) this.setAnim(p, 'stance'); }
    } else if (g.type === 'attack' || g.type === 'cast') {
      const s = this.skill(g.skill);
      let tx, ty, mon = null;
      if (g.type === 'attack') {
        mon = this.monById(g.id);
        if (!mon || mon.dead) { p.goal = null; this.setAnim(p, 'stance'); return; }
        tx = mon.x; ty = mon.y;
      } else { tx = g.x; ty = g.y; }
      const need = s.type !== 'atk' ? 0 : s.shape === 'nova' ? (mon ? s.radius * 0.7 : 0) : (s.range || 1.5);
      const d = Math.hypot(tx - p.x, ty - p.y);
      const sight = s.shape === 'proj' || s.shape === 'area' ? this.grid.lineFree(p.x, p.y, tx, ty, true) : true;
      if (d <= need + (mon ? 0.35 : 0) && sight) {
        let use = s;
        if (this.canUse(s)) use = this.skill('basic');   // thiếu nội lực / đang hồi -> đánh thường
        if (use.type === 'atk' && Math.hypot(tx - p.x, ty - p.y) > (use.shape === 'nova' ? use.radius : use.range || 1.5) + 0.35) {
          const r = this.moveTo(p, tx, ty, dt, this.st.spd * this.slowMul(p), 0.5);
          if (r === null || (r && Math.hypot(tx - p.x, ty - p.y) > (use.shape === 'nova' ? use.radius : use.range || 1.5) + 0.35)) this.unreachable(g);
          return;
        }
        this.startAct(use, mon, tx, ty);
        if (g.type === 'cast') p.goal = null;
      } else {
        const r = this.moveTo(p, tx, ty, dt, this.st.spd * this.slowMul(p), 0.4);
        if (r === null || (r && Math.hypot(tx - p.x, ty - p.y) > need + 0.6)) this.unreachable(g);
      }
    } else if (g.type === 'pick') {
      const d = this.drops.find((x) => x.id === g.id);
      if (!d) { p.goal = null; return; }
      const r = Math.hypot(d.x - p.x, d.y - p.y) <= PICK_R || this.moveTo(p, d.x, d.y, dt, this.st.spd, 0.3);
      if (r === null) { d.bad = this.t; this.unreachable(g); } else if (r) this.pick(d);
    } else if (g.type === 'npc') {
      const n = this.npcs.find((x) => x.id === g.id);
      if (!n) { p.goal = null; return; }
      if (Math.hypot(n.x - p.x, n.y - p.y) <= 1.6) {
        p.goal = null; this.setAnim(p, 'stance');
        p.dir = dirOf(n.x - p.x, n.y - p.y);
        this.emit({ t: 'npc', npc: n });
      } else if (this.moveTo(p, n.x, n.y, dt, this.st.spd, 1.2) === null) this.unreachable(g);
    }
    else if (g.type === 'exit') {
      const ex = this.exits[g.id];
      const r = Math.hypot(ex.x - p.x, ex.y - p.y) <= 1.8 || this.moveTo(p, ex.x, ex.y, dt, this.st.spd, 1.6);
      if (r === null) this.unreachable(g);
      else if (r && !p.exitSent) { p.exitSent = true; p.goal = null; this.emit({ t: 'portal', to: ex.to, via: 'exit' }); }
    }
  }

  unreachable(g) {
    this.p.goal = null;
    this.setAnim(this.p, 'stance');
    if (g.type === 'attack') { const m = this.monById(g.id); if (m) m.badUntil = this.t + 20; }
    this.emit({ t: 'unreachable', goal: g });
  }

  setAnim(u, a) { if (u.anim !== a) { u.anim = a; u.animT = 0; } }

  /** Đi tới (x,y) theo A*; trả true khi tới nơi (trong bán kính stop), null khi không có đường */
  moveTo(u, x, y, dt, spd, stop) {
    const d = Math.hypot(x - u.x, y - u.y);
    if (d <= stop) return true;
    u.repath -= dt;
    if (!u.path || u.repath <= 0 || (u.pathGoal && Math.hypot(u.pathGoal[0] - x, u.pathGoal[1] - y) > 1)) {
      u.path = this.grid.path(u.x, u.y, x, y, u.kind === 'player' ? 40000 : 1500, !(u.rawUntil > this.t));
      u.pathGoal = [x, y];
      u.repath = u.kind === 'player' ? 0.5 : 0.9;
      if (!u.path) { u.repath = 1.5; this.setAnim(u, 'stance'); return null; }   // không có đường
    }
    let step = spd * dt;
    while (step > 0 && u.path.length) {
      const [wx, wy] = u.path[0];
      const dx = wx - u.x, dy = wy - u.y, dd = Math.hypot(dx, dy);
      if (dd < 0.05) { u.path.shift(); continue; }
      const k = Math.min(step, dd);
      const nx = u.x + dx / dd * k, ny = u.y + dy / dd * k;
      if (this.grid.ok(nx, ny)) { u.x = nx; u.y = ny; }
      else if (this.grid.ok(nx, u.y)) u.x = nx;          // trượt dọc tường
      else if (this.grid.ok(u.x, ny)) u.y = ny;
      else { u.path = null; u.repath = 0; u.rawUntil = this.t + 3; break; }   // kẹt góc: đi theo từng ô A* một lúc
      u.dir = dirOf(dx, dy);
      step -= k;
      if (k >= dd) u.path.shift();
    }
    this.setAnim(u, 'run');
    if (u.path && !u.path.length) { u.path = null; return true; }   // hết đường: đã tới điểm gần nhất có thể
    return Math.hypot(x - u.x, y - u.y) <= stop;
  }

  // ---------- ra đòn ----------
  startAct(s, mon, tx, ty) {
    const p = this.p;
    const dur = ACT_TIME / this.st.aspd / this.slowMul(p);
    p.act = { s, mon, tx, ty, t: 0, dur, fired: false };
    if (Math.hypot(tx - p.x, ty - p.y) > 0.01) p.dir = dirOf(tx - p.x, ty - p.y);
    this.setAnim(p, s.anim || 'swing');
    p.animSpeed = 400 / (dur * 1000);
  }
  updateAct(dt) {
    const p = this.p, a = p.act;
    a.t += dt;
    p.animT += dt * 1000 * (p.animSpeed - 1);
    if (a.mon && !a.mon.dead) { a.tx = a.mon.x; a.ty = a.mon.y; }
    if (!a.fired && a.t >= a.dur * HIT_AT) {
      a.fired = true;
      const s = a.s, cost = this.mpCost(s);
      if (p.mp < cost) { p.act = null; return; }
      p.mp -= cost;
      if (s.cd) p.cds[s.id] = this.t + s.cd;
      this.resolve(s, a.mon, a.tx, a.ty);
    }
    if (a.t >= a.dur) {
      p.act = null;
      p.animSpeed = 1;
      this.setAnim(p, 'stance');
      if (p.goal?.type === 'attack') { const m = this.monById(p.goal.id); if (!m || m.dead) p.goal = null; }
    }
  }

  resolve(s, mon, tx, ty) {
    const p = this.p, lvl = skillLv(this.ch, s.id) || 1;
    if (s.type === 'buff') {
      const stats = {};
      for (const [k, v] of Object.entries(s.buff)) stats[k] = Math.round(lvVal(v, lvl) * 10) / 10;
      p.buffs[s.id] = { stats, until: this.t + s.dur, name: s.name, icon: s.icon };
      this.recalc();
      this.emit({ t: 'fx', key: s.fx, x: p.x, y: p.y, on: 0 });
      return;
    }
    if (s.type === 'heal') {
      const v = this.st.maxHp * lvVal(s.heal, lvl);
      p.hp = Math.min(this.st.maxHp, p.hp + v);
      this.emit({ t: 'fx', key: s.fx, x: p.x, y: p.y, on: 0 });
      this.emit({ t: 'dmg', x: p.x, y: p.y, v: Math.round(v), kind: 'heal' });
      return;
    }
    const mult = lvVal(s.mult, lvl);
    const hitOne = (m, extra = {}) => this.playerHit(m, mult, s, extra);
    if (s.shape === 'melee') {
      if (mon && !mon.dead) { hitOne(mon); if (s.fx) this.emit({ t: 'fx', key: s.fx, x: mon.x, y: mon.y, on: mon.id }); }
    } else if (s.shape === 'cleave') {
      const cx = mon ? mon.x : tx, cy = mon ? mon.y : ty;
      for (const m of this.monsNear(cx, cy, s.radius)) hitOne(m, { area: m !== mon });
      this.emit({ t: 'fx', key: s.fx, x: cx, y: cy, on: 0 });
    } else if (s.shape === 'nova') {
      for (const m of this.monsNear(p.x, p.y, s.radius)) hitOne(m, { area: true });
      if (s.healSelf) p.hp = Math.min(this.st.maxHp, p.hp + this.st.maxHp * s.healSelf);
      this.emit({ t: 'fx', key: s.fx, x: p.x, y: p.y, on: 0, big: s.radius });
    } else if (s.shape === 'area') {
      this.areas.push({ x: tx, y: ty, r: s.radius, at: this.t + 0.2, s, mult });
      this.emit({ t: 'fx', key: s.fx, x: tx, y: ty, on: 0, big: s.radius });
    } else if (s.shape === 'proj') {
      const n = s.count || 1, base = Math.atan2(ty - p.y, tx - p.x), spr = s.spread || 0;
      for (let k = 0; k < n; k++) {
        const a = base + (n > 1 ? (k / (n - 1) - 0.5) * spr * 2 : 0);
        this.projs.push({ id: this.uid++, owner: 'p', x: p.x, y: p.y, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
          life: (s.range + 1.5) / s.speed, fx: s.fx, s, mult, pierce: !!s.pierce, hit: new Set() });
      }
    }
  }
  monsNear(x, y, r) { return this.mons.filter((m) => !m.dead && Math.hypot(m.x - x, m.y - y) <= r); }

  updateAreas() {
    this.areas = this.areas.filter((a) => {
      if (this.t < a.at) return true;
      for (const m of this.monsNear(a.x, a.y, a.r)) this.playerHit(m, a.mult, a.s, { area: true });
      return false;
    });
  }

  updateProjs(dt) {
    const keep = [];
    for (const pr of this.projs) {
      pr.life -= dt;
      let alive = pr.life > 0;
      const steps = 3;
      for (let k = 0; k < steps && alive; k++) {
        pr.x += pr.vx * dt / steps; pr.y += pr.vy * dt / steps;
        if (!this.grid.okFly(pr.x, pr.y)) { alive = false; break; }
        if (pr.owner === 'p') {
          for (const m of this.mons) {
            if (m.dead || pr.hit.has(m.id) || Math.hypot(m.x - pr.x, m.y - pr.y) > 0.6) continue;
            pr.hit.add(m.id);
            this.playerHit(m, pr.mult, pr.s, {});
            this.emit({ t: 'fx', key: 'spark_' + ({ throw_knife: 'green', icicle: 'blue', fireball: 'red', lightning: 'orange' }[pr.fx] || 'orange'), x: m.x, y: m.y, on: m.id, small: true });
            if (!pr.pierce) { alive = false; break; }
          }
        } else if (!this.p.dead && Math.hypot(this.p.x - pr.x, this.p.y - pr.y) < 0.5) {
          this.monHit(pr.mon, true);
          alive = false;
        }
      }
      if (alive) keep.push(pr);
    }
    this.projs = keep;
  }

  // ---------- sát thương ----------
  hitChance(acc, dodge) { return clamp(0.7 + (acc - dodge) / (acc + dodge + 1) * 0.6, 0.35, 0.97); }

  playerHit(m, mult, s, { area } = {}) {
    if (m.dead) return;
    const st = this.st, ch = this.ch, r = this.rng;
    if (!area && r() > this.hitChance(st.acc, m.st.dodge)) { this.emit({ t: 'dmg', x: m.x, y: m.y, v: 0, kind: 'miss', on: m.id }); this.aggro(m); return; }
    let d = (st.atk[0] + r() * (st.atk[1] - st.atk[0])) * mult;
    d *= elemMul(ch.elem, m.def.elem);
    d *= 1 - m.st.res / 100;
    d *= 100 / (100 + m.st.def);
    let crit = r() * 100 < st.crit;
    const es = ELEM_STATUS[ch.elem];
    if (ch.elem === 'kim' && r() < es.chance) crit = true;
    if (crit) d *= 1.6;
    d = Math.max(1, Math.round(d));
    m.hp -= d;
    m.hurtT = this.t;
    if (st.leech) this.p.hp = Math.min(st.maxHp, this.p.hp + d * st.leech / 100);
    this.emit({ t: 'dmg', x: m.x, y: m.y, v: d, kind: crit ? 'crit' : 'hit', on: m.id });
    // hiệu ứng theo hệ + hiệu ứng riêng của skill
    if (ch.elem !== 'kim' && r() < es.chance) this.applyStatus(m, ch.elem, d);
    if (s.slow) m.status.slow = { until: this.t + 2, pct: s.slow };
    if (s.stun && r() < 0.6) m.status.stun = { until: this.t + s.stun };
    if (m.hp <= 0) this.killMon(m);
    else this.aggro(m);
  }
  applyStatus(u, elem, d) {
    const es = ELEM_STATUS[elem];
    if (es.kind === 'poison') u.status.poison = { until: this.t + es.dur, dps: d * es.pct / es.dur };
    else if (es.kind === 'burn') u.status.burn = { until: this.t + es.dur, dps: d * es.pct / es.dur };
    else if (es.kind === 'slow') u.status.slow = { until: this.t + es.dur, pct: es.pct };
    else if (es.kind === 'stun' && !u.def?.boss) u.status.stun = { until: this.t + es.dur };
  }
  aggro(m) { if (!m.dead && m.state !== 'return') { m.state = 'chase'; } }

  monHit(m, ranged) {
    const p = this.p;
    if (p.dead || !m) return;
    const st = this.st, r = this.rng;
    if (r() > this.hitChance(m.st.acc, st.dodge)) { this.emit({ t: 'dmg', x: p.x, y: p.y, v: 0, kind: 'miss', on: 0 }); return; }
    let d = m.st.dmg * (0.85 + r() * 0.3);
    d *= elemMul(m.def.elem, this.ch.elem);
    d *= 1 - st.res[m.def.elem] / 100;
    d *= 120 / (120 + st.def);
    d = Math.max(1, Math.round(d));
    p.hp -= d;
    p.lastHurt = this.t;
    if (p.sit) p.sit = false;
    this.emit({ t: 'dmg', x: p.x, y: p.y, v: d, kind: 'hurt', on: 0 });
    if (r() < ELEM_STATUS[m.def.elem].chance * 0.6 && m.def.elem !== 'kim') this.applyStatus(p, m.def.elem, d);
    if (p.hp <= 0) this.playerDie();
  }

  playerDie() {
    const p = this.p;
    if (p.dead) return;
    p.dead = true; p.hp = 0; p.act = null; p.goal = null; p.path = null; p.deadT = 0;
    this.setAnim(p, 'die');
    // mất 1% exp của cấp hiện tại, không âm (MVP đơn giản, không mất tiền)
    const loss = Math.round(xpNeed(this.ch.lv) * 0.01);
    this.ch.xp = Math.max(0, this.ch.xp - loss);
    this.ch.deaths = (this.ch.deaths || 0) + 1;
    this.msg(`Bạn đã trọng thương, mất ${loss} kinh nghiệm. Đang về ${MAPS[this.ch.town].name}…`, 'bad');
    this.emit({ t: 'dead' });
  }

  killMon(m) {
    m.dead = true; m.deadT = this.t; m.hp = 0; m.atk = null;
    this.setAnim(m, 'die');
    const ch = this.ch;
    // exp giảm khi quái thấp hơn mình nhiều (lệch 15 cấp gần như không còn)
    const gap = ch.lv - m.lv;
    const f = gap > 3 ? clamp(1 - (gap - 3) / 12, 0.05, 1) : gap < -3 ? 1.15 : 1;
    const xp = Math.max(1, Math.round(m.st.exp * f));
    const ups = gainXp(ch, xp);
    this.emit({ t: 'dmg', x: m.x, y: m.y, v: xp, kind: 'xp', on: m.id });
    for (const lv of ups) this.onLevel(lv);
    ch.kills[m.type] = (ch.kills[m.type] || 0) + 1;
    for (const id of Q.onKill(ch, m.type, this.id)) {
      const q = Q.QUESTS[id], s = ch.quests[id];
      if (s.n === q.n) this.msg(`Nhiệm vụ "${q.name}" đã xong — về gặp ${q.giver === 'quest' ? 'Lý Bộ Đầu' : 'sứ giả môn phái'}.`, 'quest');
    }
    this.dropLoot(m);
    if (m.def.boss) {
      this.boss.mon = null;
      this.boss.respawnAt = this.t + this.boss.def.respawn;
      this.msg(`Đã hạ ${m.def.name}! Ngưu Ma Vương sẽ trở lại sau ${Math.round(this.boss.def.respawn / 60)} phút.`, 'boss');
    }
  }

  onLevel(lv) {
    if (this.ch.auto.alloc) { autoAlloc(this.ch); autoLearn(this.ch); }
    this.recalc();
    this.p.hp = this.st.maxHp; this.p.mp = this.st.maxMp;
    this.emit({ t: 'lvup', lv });
    this.emit({ t: 'fx', key: 'sparkle', x: this.p.x, y: this.p.y, on: 0 });
    this.msg(`Lên cấp ${lv}!`, 'good');
  }

  dropLoot(m) {
    const r = this.rng, L = m.lv;
    const add = (o) => {
      const a = r() * Math.PI * 2, d = 0.3 + r() * 0.8;
      let x = m.x + Math.cos(a) * d, y = m.y + Math.sin(a) * d;
      if (!this.grid.reachable(x, y)) { x = m.x; y = m.y; }
      this.drops.push({ id: this.uid++, x, y, t: this.t, ...o });
    };
    if (m.def.boss) {
      if (this.ch.phai) add({ item: goldDrop(r, this.ch.phai) });
      for (let k = 0; k < 4; k++) add({ item: rollDrop(r, L, this.ch.phai) });
      add({ money: L * 120 });
      return;
    }
    if (r() < 0.45) add({ money: Math.round(L * (1.5 + r() * 3) + 2) });
    if (r() < 0.1) add({ item: rollDrop(r, L, this.ch.phai) });
    if (r() < 0.06) {
      const tier = L >= 40 ? 3 : L >= 20 ? 2 : 1;
      add({ item: makeStack((r() < 0.6 ? 'hp' : 'mp') + tier, 1) });
    }
  }

  pick(d) {
    const ch = this.ch;
    this.p.goal = null;
    if (d.money) { ch.money += d.money; this.emit({ t: 'pick', money: d.money }); }
    else if (!this.addItem(d.item)) { this.msg('Hành trang đã đầy', 'bad'); this.emit({ t: 'bagfull' }); return false; }
    else this.emit({ t: 'pick', item: d.item });
    this.drops = this.drops.filter((x) => x !== d);
    return true;
  }

  // ---------- quái ----------
  updateMon(m, dt) {
    m.animT += dt * 1000;
    if (m.dead) {
      if (!m.def.boss && this.t - m.deadT > RESPAWN && Math.hypot(this.p.x - m.home.x, this.p.y - m.home.y) > 1.5) {
        Object.assign(m, { dead: false, hp: m.st.maxHp, x: m.home.x, y: m.home.y, state: 'idle', status: {}, atk: null, path: null });
        this.setAnim(m, 'stance');
      }
      if (m.def.boss && this.t - m.deadT > 8) this.mons = this.mons.filter((x) => x !== m);
      return;
    }
    this.updateStatus(m, dt);
    if (m.dead) return;
    if (this.stunned(m)) { this.setAnim(m, 'stance'); m.atk = null; return; }
    const p = this.p, slow = this.slowMul(m);
    const dp = Math.hypot(p.x - m.x, p.y - m.y);
    const dh = Math.hypot(m.home.x - m.x, m.home.y - m.y);
    if (m.atk) {
      m.atk.t += dt * slow;
      if (!m.atk.fired && m.atk.t >= 0.45) {
        m.atk.fired = true;
        if (m.def.ranged) {
          const a = Math.atan2(p.y - m.y, p.x - m.x);
          this.projs.push({ id: this.uid++, owner: 'm', mon: m, x: m.x, y: m.y, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, life: (m.st.range + 2) / 9, fx: m.def.ranged });
        } else if (dp <= m.st.range + 0.6) this.monHit(m, false);
      }
      if (m.atk.t >= 0.8) { m.atk = null; m.cd = this.t + m.st.cd / slow; this.setAnim(m, 'stance'); }
      return;
    }
    if (m.state === 'return') {
      if (this.moveTo(m, m.home.x, m.home.y, dt, m.st.spd * 1.4, 0.5) !== false) { m.state = 'idle'; m.hp = m.st.maxHp; if (m.x !== m.home.x) { m.x = m.home.x; m.y = m.home.y; } this.setAnim(m, 'stance'); }
      return;
    }
    const town = this.def.town;
    if (m.state !== 'chase' && !p.dead && !town && dp < (m.def.boss ? 6 : AGGRO)) m.state = 'chase';
    if (m.state === 'chase') {
      if (p.dead || dh > LEASH + (m.def.boss ? 6 : 0)) { m.state = 'return'; m.path = null; return; }
      const sight = !m.def.ranged || this.grid.lineFree(m.x, m.y, p.x, p.y, true);
      if (dp <= m.st.range && sight) {
        m.dir = dirOf(p.x - m.x, p.y - m.y);
        if (this.t >= m.cd) { m.atk = { t: 0, fired: false }; this.setAnim(m, m.def.atk); }
        else this.setAnim(m, 'stance');
      } else if (this.moveTo(m, p.x, p.y, dt, m.st.spd * slow, m.st.range * 0.8) === null) { m.state = 'return'; m.path = null; }
      return;
    }
    // đứng yên / đi lang thang quanh chỗ cũ
    m.wanderT -= dt;
    if (m.wanderT <= 0) {
      m.wanderT = 3 + this.rng() * 5;
      const a = this.rng() * Math.PI * 2, d = this.rng() * 2;
      m.wander = [m.home.x + Math.cos(a) * d, m.home.y + Math.sin(a) * d];
      if (!this.grid.ok(m.wander[0], m.wander[1])) m.wander = null;
    }
    if (m.wander) { if (this.moveTo(m, m.wander[0], m.wander[1], dt, m.st.spd * 0.4, 0.2) !== false) { m.wander = null; this.setAnim(m, 'stance'); } }
    else this.setAnim(m, 'stance');
  }

  /** Lưu vị trí + máu vào char trước khi rời map / save */
  snapshot() {
    this.ch.hp = Math.round(this.p.hp); this.ch.mp = Math.round(this.p.mp);
    this.ch.map = this.id; this.ch.pos = [this.p.x, this.p.y];
  }
}
