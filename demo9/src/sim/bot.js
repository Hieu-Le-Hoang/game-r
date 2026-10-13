// Bot: mua đồ -> đi theo nav -> giao tranh -> đặt/gỡ bom. Điều khiển qua cùng input như người chơi.
import { SKILLS, WEAPONS } from './constants.js';
import { HOLDS, WATCH } from './map.js';
import { inRect } from './map.js';
import { pressed } from './agent.js';

const DEG = Math.PI / 180;
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const yawTo = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));

export class Bot {
  constructor(game, a) {
    this.g = game;
    this.a = a;
    this.sk = SKILLS[game.skill] ?? SKILLS.normal;
    this.onRoundStart();
  }

  onRoundStart() {
    const g = this.g, a = this.a, rnd = g.rnd;
    this.bought = false;
    this.buyAt = g.now + 0.5 + rnd() * 2.5;
    this.path = null;
    this.goal = null;
    this.goalKey = '';
    this.enemy = null;
    this.reactAt = 0;
    this.lastSeen = null;
    this.lastSeenT = -10;
    this.nextPerceive = 0;
    this.errYaw = 0; this.errPitch = 0; this.nextErr = 0;
    this.strafe = rnd() < 0.5 ? -1 : 1; this.nextStrafe = 0;
    this.burst = 0; this.burstPause = 0;
    this.lookYaw = a.yaw; this.nextLook = 0; this.watchIdx = 0;
    this.stuckT = g.now; this.stuckPos = { ...a.pos };
    this.jumpReq = false;
    this.nadePlan = null;
    this.departAt = g.now + (a.team === 'T' ? rnd() * 2 : rnd() * 1.5);
    this.aimHead = rnd() < this.sk.headChance;
    this.rotated = false;
    this.postPlant = this.plantSpot = this.siteSpot = this.retake = null;
    this.wantC4 = false;
    this.lurk = a.team === 'T' && rnd() < 0.2;
    const cts = g.team('CT').filter((b) => b.bot);
    if (a.team === 'CT') {
      const roles = ['A', 'B', 'A', 'B', 'MID'];
      this.role = roles[(cts.indexOf(a) + g.round) % roles.length];
    } else this.role = g.tPlan;
    const holds = a.team === 'CT' ? HOLDS[`CT_${this.role}`] : null;
    this.hold = holds ? holds[(rnd() * holds.length) | 0] : null;
  }

  update(dt) {
    const g = this.g, a = this.a, inp = a.input;
    inp.fwd = inp.side = 0;
    inp.fire = inp.fire2 = inp.use = inp.jump = inp.reload = false;
    inp.duck = false; inp.walk = false;
    if (g.phase === 'end' || g.phase === 'over') { this.idleLook(dt); return; }
    if (!this.bought && g.now >= this.buyAt) this.doBuy();
    if (g.phase === 'freeze') { this.idleLook(dt); return; }

    if (g.now >= this.nextPerceive) { this.perceive(); this.nextPerceive = g.now + 0.1; }

    if (this.nadePlan) this.doNade(dt);
    else if (this.enemy) this.fight(dt);
    else this.objective(dt);
    this.chooseWeapon();
    if (this.jumpReq) { inp.jump = !a.prev.jump; this.jumpReq = false; }
  }

  // ---------- Nhận biết ----------
  perceive() {
    const g = this.g, a = this.a, eye = a.eye;
    let best = null, bestD = 1e9;
    for (const e of g.agents) {
      if (!e.alive || e.team === a.team) continue;
      const dx = e.pos.x - a.pos.x, dz = e.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d > 70) continue;
      const ang = Math.abs(wrap(yawTo(a.pos, e.pos) - a.yaw));
      const heard = d < 18 && g.now - e.lastShot < 0.3;
      if (ang > 80 * DEG && !heard && e !== this.enemy) continue;
      const head = { x: e.pos.x, y: e.pos.y + e.eyeH, z: e.pos.z };
      const chest = { x: e.pos.x, y: e.pos.y + e.eyeH * 0.75, z: e.pos.z };
      if (!g.phys.los(eye, head) && !g.phys.los(eye, chest)) continue;
      if (d < bestD) { bestD = d; best = e; }
    }
    if (best) {
      if (best !== this.enemy) {
        const surprise = this.enemy ? 0.5 : 1;
        this.reactAt = g.now + this.sk.reaction * (0.75 + g.rnd() * 0.5) * surprise;
        this.aimHead = g.rnd() < this.sk.headChance;
        this.burst = 0;
        if (a.inv[4] > 0 && bestD > 10 && bestD < 28 && g.rnd() < 0.15 && this.a.hp > 40) this.nadePlan = { target: { ...best.pos }, stage: 0 };
      }
      this.enemy = best;
      this.seenNow = true;
      this.lastSeen = { ...best.pos };
      this.lastSeenT = g.now;
      g.noteEnemy(a.team, best.pos, 1);
    } else this.seenNow = false;
    if (!best && this.enemy && (!this.enemy.alive || g.now - this.lastSeenT > 0.6)) {
      this.enemy = null;
    }
  }

  // ---------- Giao tranh ----------
  fight(dt) {
    const g = this.g, a = this.a, e = this.enemy, inp = a.input, sk = this.sk;
    const d = Math.hypot(e.pos.x - a.pos.x, e.pos.z - a.pos.z);
    if (g.now >= this.nextErr) {
      const k = sk.aimErr * DEG * (0.6 + g.rnd() * 0.6);
      this.errYaw = (g.rnd() - 0.5) * 2 * k;
      this.errPitch = (g.rnd() - 0.5) * k;
      this.nextErr = g.now + 0.25 + g.rnd() * 0.4;
    }
    const aimY = e.pos.y + (this.aimHead ? e.eyeH + 0.04 : e.eyeH * 0.78);
    const eye = a.eye;
    const tYaw = yawTo(a.pos, e.pos) + this.errYaw;
    const tPitch = Math.atan2(aimY - eye.y, d) + this.errPitch;
    // Bù giật theo kỹ năng
    const wantYaw = tYaw - a.punchY * DEG * sk.comp;
    const wantPitch = tPitch - a.punchP * DEG * sk.comp;
    this.turnTo(wantYaw, wantPitch, dt, g.now < this.reactAt ? 0.5 : 1);

    const w = a.weapon;
    const effYaw = a.yaw + a.punchY * DEG, effPitch = a.pitch + a.punchP * DEG;
    const err = Math.hypot(wrap(tYaw - effYaw), tPitch - effPitch);
    const tol = Math.max(Math.atan2(0.3, d), 1.2 * DEG) * (w.sniper ? 0.7 : 1.4);

    // Di chuyển: lắc ngang giữa các loạt bắn, dừng hẳn khi bóp cò (counter-strafe như CS)
    const firing = a.shotsFired > 0 || (g.now >= this.reactAt && err < tol * 2);
    if (w.melee) this.moveToward(e.pos, 1);
    else if (!firing || d < 5) {
      if (g.now >= this.nextStrafe) { this.strafe = -this.strafe; this.nextStrafe = g.now + 0.3 + g.rnd() * 0.6; }
      inp.side = this.strafe;
    } else if (sk.comp > 0.5 && d > 25 && !w.sniper && a.shotsFired > 2) inp.duck = true;
    const gun = a.gun;
    if (w.sniper && a.scoped === 0 && d > 5 && g.now >= a.nextFire && !a.reloadEnd) { inp.fire2 = !a.prev.fire2; return; }
    if (gun && gun.mag === 0) { inp.reload = true; return; }
    if (!this.seenNow || g.now < this.reactAt || err > tol) { this.burst = 0; return; }
    if (a.speed > (d < 5 ? 99 : 1.2) && !w.melee) return;
    if (w.melee) { if (d < 1.8) inp.fire = true; return; }
    if (w.sniper && a.speed > 1) return;
    if (w.semi || w.sniper) {
      if (g.now - a.lastShot < (w.sniper ? 0 : 0.12 + d / 70)) return;
      inp.fire = !a.prev.fire;
      return;
    }
    // Súng tự động: xả gần, bắn loạt xa
    if (g.now < this.burstPause) return;
    const maxBurst = d > 25 ? 3 : d > 12 ? 5 : 12;
    if (a.shotsFired >= maxBurst) { this.burstPause = g.now + 0.25 + (d / 60) + g.rnd() * 0.2; return; }
    inp.fire = true;
    this.burst = a.shotsFired;
  }

  doNade(dt) {
    const g = this.g, a = this.a, p = this.nadePlan, inp = a.input;
    if (a.inv[4] <= 0) { this.nadePlan = null; return; }
    if (a.slot !== 4) { inp.slot = 4; return; }
    const d = Math.hypot(p.target.x - a.pos.x, p.target.z - a.pos.z);
    const pitch = Math.min(40, 8 + d * 0.9) * DEG;
    this.turnTo(yawTo(a.pos, p.target), pitch, dt, 1);
    if (g.now >= a.deployEnd && Math.abs(a.pitch - pitch) < 3 * DEG) { inp.fire = !a.prev.fire; if (inp.fire) this.nadePlan = null; }
  }

  chooseWeapon() {
    const a = this.a, inp = a.input;
    if (this.nadePlan || a.plantStart >= 0 || this.wantC4) return;
    let s = 3;
    if (a.inv[1] && (a.inv[1].mag > 0 || a.inv[1].reserve > 0)) s = 1;
    else if (a.inv[2] && (a.inv[2].mag > 0 || a.inv[2].reserve > 0)) s = 2;
    // Hết đạn giữa trận thì rút lục thay vì nạp
    if (s === 1 && this.enemy && a.inv[1].mag === 0 && a.inv[2]?.mag > 0) s = 2;
    if (s === 2 && a.slot === 1 && a.reloadEnd && !this.enemy) s = 1;
    if (a.slot !== s && !(a.slot === 1 && a.reloadEnd && !this.enemy)) inp.slot = s;
  }

  // ---------- Mục tiêu ----------
  objective(dt) {
    const g = this.g, a = this.a, inp = a.input, b = g.bomb;
    this.wantC4 = false;
    // Nạp đạn lúc rảnh
    const gun = a.gun;
    if (gun && gun.mag < WEAPONS[gun.id].mag * 0.5 && gun.reserve > 0 && !a.reloadEnd) inp.reload = !a.prev.reload;

    // Truy theo chỗ vừa thấy địch
    const huntR = a.team === 'CT' && b.state !== 'planted' ? 15 : 40;
    if (this.lastSeen && g.now - this.lastSeenT < 4 && dist(this.lastSeen, a.pos) < huntR && !(a.team === 'CT' && b.state === 'planted')) {
      this.go(this.lastSeen, 'hunt');
      inp.walk = Math.hypot(this.lastSeen.x - a.pos.x, this.lastSeen.z - a.pos.z) < 10;
      return;
    }
    if (g.now < this.departAt) { this.idleLook(dt); return; }

    if (a.team === 'T') this.tObjective(dt);
    else this.ctObjective(dt);
  }

  tObjective(dt) {
    const g = this.g, a = this.a, inp = a.input, b = g.bomb;
    const zones = g.map.zones;
    if (b.state === 'dropped') {
      const ts = g.alive('T').filter((t) => t.bot);
      const nearest = ts.sort((p, q) => dist(p.pos, b.pos) - dist(q.pos, b.pos))[0];
      if (nearest === a) { this.go(b.pos, 'bomb'); return; }
    }
    if (b.state === 'planted') {
      const site = zones[b.site];
      if (!this.postPlant) this.postPlant = g.nav.randomIn(site, g.rnd);
      if (this.go(this.postPlant, 'post')) this.watch(dt, WATCH[b.site], true);
      return;
    }
    const site = zones[g.tPlan];
    if (a.inv[5]) {
      if (inRect(site, a.pos.x, a.pos.z) && a.onGround) {
        // Đặt bom: đứng yên, rút C4, giữ chuột trái
        this.wantC4 = true;
        if (a.slot !== 5) a.input.slot = 5;
        else if (g.now >= a.deployEnd) inp.fire = true;
        inp.duck = true;
        return;
      }
      if (!this.plantSpot) this.plantSpot = g.nav.randomIn(site, g.rnd);
      this.go(this.plantSpot, 'plant');
      return;
    }
    if (!this.siteSpot) this.siteSpot = g.nav.randomIn(site, g.rnd);
    // Lurk: chờ một lúc rồi mới đi
    if (this.lurk && g.now - g.roundStart < 25) { this.idleLook(dt); return; }
    if (this.go(this.siteSpot, 'site')) this.watch(dt, WATCH[g.tPlan], true);
  }

  ctObjective(dt) {
    const g = this.g, a = this.a, inp = a.input, b = g.bomb;
    if (b.state === 'planted') {
      const cts = g.alive('CT').filter((c) => c.bot);
      const defuser = b.defuser && b.defuser.alive ? b.defuser : cts.sort((p, q) => dist(p.pos, b.pos) - dist(q.pos, b.pos))[0];
      if (defuser === a) {
        const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
        if (d < 1.0) { inp.use = true; inp.duck = true; this.lookAt(b.pos, dt); return; }
        this.go(b.pos, 'defuse');
        return;
      }
      if (!this.retake) this.retake = g.nav.randomIn(g.map.zones[b.site], g.rnd);
      if (this.go(this.retake, 'retake')) this.watch(dt, WATCH[b.site], false);
      return;
    }
    // Xoay site khi đồng đội báo có địch ở site kia
    if (!this.rotated && this.role !== 'MID') {
      const other = this.role === 'A' ? 'B' : 'A';
      const z = g.map.zones[other];
      const hot = g.intel.CT.filter((i) => g.now - i.t < 3 && inRect(z, i.x, i.z)).length;
      if (hot >= 2 && g.rnd() < 0.02) { this.rotated = true; this.role = other; this.hold = g.nav.randomIn(z, g.rnd); }
    }
    const hold = this.hold;
    if (this.go(hold, 'hold')) {
      const site = this.role === 'MID' ? [{ x: 43, z: 70 }] : WATCH[this.role];
      this.watch(dt, site, false);
      if (this.sk.comp > 0.5 && this.role !== 'MID') inp.duck = g.rnd() < 0.002 ? !inp.duck : inp.duck;
    }
  }

  // ---------- Di chuyển ----------
  // Đi tới goal; trả true khi đã tới nơi
  go(goal, key) {
    const g = this.g, a = this.a;
    const k = `${key}:${Math.round(goal.x / 2)},${Math.round(goal.z / 2)}`;
    if (k !== this.goalKey || !this.path) {
      this.goalKey = k;
      this.path = g.nav.path(a.pos, goal) ?? [];
      this.stuckT = g.now; this.stuckPos = { ...a.pos };
    }
    while (this.path.length && Math.hypot(this.path[0].x - a.pos.x, this.path[0].z - a.pos.z) < 0.7) this.path.shift();
    if (!this.path.length) return true;
    const wp = this.path[0];
    this.moveToward(wp, 1);
    if (!this.enemy) this.lookAt({ x: wp.x, y: a.pos.y + a.eyeH, z: wp.z }, 1 / 60, true);
    // Kẹt -> nhảy + tìm đường lại
    if (g.now - this.stuckT > 1) {
      if (dist(a.pos, this.stuckPos) < 0.4) { this.jumpReq = true; this.path = null; }
      this.stuckT = g.now; this.stuckPos = { ...a.pos };
    }
    return false;
  }

  moveToward(p, k) {
    const a = this.a, inp = a.input;
    const dx = p.x - a.pos.x, dz = p.z - a.pos.z, l = Math.hypot(dx, dz);
    if (l < 1e-3) return;
    const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw), rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw);
    inp.fwd = ((dx * fx + dz * fz) / l) * k;
    inp.side = ((dx * rx + dz * rz) / l) * k;
  }

  lookAt(p, dt, flat) {
    const a = this.a, eye = a.eye;
    const yaw = yawTo(a.pos, p);
    const pitch = flat ? 0 : Math.atan2((p.y ?? eye.y) - eye.y, Math.hypot(p.x - a.pos.x, p.z - a.pos.z));
    this.turnTo(yaw, pitch, dt, 0.6);
  }

  turnTo(yaw, pitch, dt, k) {
    const a = this.a, max = this.sk.turn * DEG * dt * k;
    const dy = wrap(yaw - a.yaw), dp = pitch - a.pitch;
    a.yaw = wrap(a.yaw + Math.sign(dy) * Math.min(Math.abs(dy), max));
    a.pitch += Math.sign(dp) * Math.min(Math.abs(dp), max * 0.7);
    a.pitch = Math.max(-1.4, Math.min(1.4, a.pitch));
  }

  watch(dt, pts, rot) {
    const g = this.g;
    if (g.now >= this.nextLook) { this.watchIdx = (g.rnd() * pts.length) | 0; this.nextLook = g.now + 1.5 + g.rnd() * 2.5; }
    // Có tin địch gần thì nhìn về đó
    const intel = g.intel[this.a.team].filter((i) => g.now - i.t < 3).pop();
    const p = intel && dist(intel, this.a.pos) < 35 ? intel : pts[this.watchIdx];
    this.lookAt({ x: p.x, y: this.a.pos.y + this.a.eyeH, z: p.z }, dt, true);
  }

  idleLook(dt) {
    const g = this.g;
    if (g.now >= this.nextLook) { this.lookYaw = this.a.yaw + (g.rnd() - 0.5) * 1.2; this.nextLook = g.now + 1 + g.rnd() * 2; }
    this.turnTo(this.lookYaw, 0, dt, 0.3);
  }

  // ---------- Mua đồ ----------
  doBuy() {
    const g = this.g, a = this.a;
    this.bought = true;
    if (!g.canBuy(a)) return;
    const rnd = g.rnd;
    const buy = (id) => g.buy(a, id);
    const pistolRound = g.round === 1;
    const team = g.team(a.team);
    if (!a.inv[1]) {
      const awps = team.filter((b) => b.inv[1]?.id === 'awp').length;
      const rifle = a.team === 'T' ? 'ak47' : 'm4a1';
      if (a.money >= 5750 && awps === 0 && rnd() < 0.3) buy('awp');
      else if (a.money >= WEAPONS[rifle].price + 650) buy(rifle);
      else if (!pistolRound && a.money >= 2150 && rnd() < 0.6) buy('mp5');
    }
    if (a.money >= 1000 && (a.inv[1] || pistolRound === false)) buy('vesthelm');
    else if (a.money >= 650 && a.armor < 100) buy('vest');
    if (!a.inv[1] && a.money >= 650 && a.inv[2]?.id !== 'deagle' && rnd() < (pistolRound ? 0.2 : 0.5)) buy('deagle');
    if (a.money >= 300 && rnd() < 0.5) buy('he');
    if (a.team === 'CT' && a.money >= 200 && rnd() < 0.6) buy('defuser');
  }
}

const dist = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
export { pressed };
