// Người chơi / bot: trạng thái, túi đồ, di chuyển kiểu GoldSrc (friction + accelerate + air strafe).
import { MOVE, WEAPONS, RULES } from './constants.js';

export const newInput = () => ({ fwd: 0, side: 0, jump: false, duck: false, walk: false, fire: false, fire2: false, reload: false, use: false, slot: 0, drop: false });

export class Agent {
  constructor(id, name, team, bot) {
    this.id = id;
    this.name = name;
    this.team = team;
    this.bot = bot;
    this.money = RULES.startMoney;
    this.kills = 0;
    this.deaths = 0;
    this.alive = false;
    this.hp = 100;
    this.armor = 0;
    this.helmet = false;
    this.defuser = false;
    this.pos = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.pitch = 0;
    this.punchP = 0; // độ, dương = hất lên
    this.punchY = 0;
    this.kickDir = 1;
    this.onGround = true;
    this.ducking = false;
    this.height = MOVE.standHeight;
    this.eyeH = MOVE.standEye;
    this.input = newInput();
    this.prev = newInput();
    this.inv = { 1: null, 2: null, 3: { id: 'knife' }, 4: 0, 5: false };
    this.slot = 3;
    this.lastSlot = 2;
    this.nextFire = 0;
    this.reloadEnd = 0;
    this.deployEnd = 0;
    this.shotsFired = 0;
    this.lastShot = -10;
    this.scoped = 0;
    this.rescope = 0;
    this.plantStart = -1;
    this.defuseStart = -1;
    this.lastHurt = -10;
    this.lastAttacker = null;
    this.stepAcc = 0;
    this.collider = null;
    this.brain = null;
  }

  get eye() { return { x: this.pos.x, y: this.pos.y + this.eyeH, z: this.pos.z }; }
  get weaponId() {
    if (this.slot === 4) return this.inv[4] > 0 ? 'he' : 'knife';
    if (this.slot === 5) return this.inv[5] ? 'c4' : 'knife';
    return this.inv[this.slot]?.id ?? 'knife';
  }
  get weapon() { return WEAPONS[this.weaponId]; }
  get gun() { return this.slot <= 2 ? this.inv[this.slot] : null; }
  get speed() { return Math.hypot(this.vel.x, this.vel.z); }
  get air() { return !this.onGround; }
  get duck() { return this.ducking; }

  // Hướng nhìn (gồm punch do giật)
  viewDir() {
    const y = this.yaw + (this.punchY * Math.PI) / 180, p = this.pitch + (this.punchP * Math.PI) / 180;
    return { x: -Math.sin(y) * Math.cos(p), y: Math.sin(p), z: -Math.cos(y) * Math.cos(p) };
  }

  bestSlot() { return this.inv[1] ? 1 : this.inv[2] ? 2 : 3; }

  give(id) {
    const w = WEAPONS[id];
    if (w.slot === 4) { this.inv[4] = 1; return; }
    this.inv[w.slot] = { id, mag: w.mag, reserve: w.reserve };
  }

  resetForRound(keepGear) {
    this.alive = true;
    this.hp = 100;
    if (!keepGear) {
      this.armor = 0; this.helmet = false; this.defuser = false;
      this.inv = { 1: null, 2: null, 3: { id: 'knife' }, 4: 0, 5: false };
      this.give(this.team === 'T' ? 'glock' : 'usp');
    } else {
      for (const s of [1, 2]) { const g = this.inv[s]; if (g) { const w = WEAPONS[g.id]; g.reserve = Math.max(g.reserve, w.reserve - (w.mag - g.mag)); } }
      this.inv[5] = false;
    }
    this.vel.x = this.vel.y = this.vel.z = 0;
    this.punchP = this.punchY = 0;
    this.ducking = false;
    this.height = MOVE.standHeight;
    this.eyeH = MOVE.standEye;
    this.slot = this.bestSlot();
    this.lastSlot = 3;
    this.nextFire = this.reloadEnd = this.deployEnd = 0;
    this.shotsFired = 0;
    this.scoped = this.rescope = 0;
    this.plantStart = this.defuseStart = -1;
    this.lastAttacker = null;
  }
}

const pressed = (a, k) => a.input[k] && !a.prev[k];
export { pressed };

export function moveAgent(game, a, dt) {
  const phys = game.phys, inp = a.input;
  const frozen = game.phase === 'freeze' || a.plantStart >= 0 || a.defuseStart >= 0;

  // Ngồi: trên không thì co chân lên (crouch-jump)
  if (inp.duck && !a.ducking) {
    a.ducking = true;
    if (!a.onGround) a.pos.y += MOVE.standHeight - MOVE.duckHeight;
    a.height = MOVE.duckHeight;
    phys.setAgentShape(a, a.height);
  } else if (!inp.duck && a.ducking) {
    const lift = a.onGround ? 0 : -(MOVE.standHeight - MOVE.duckHeight);
    a.pos.y += lift;
    if (phys.canStand(a)) {
      a.ducking = false;
      a.height = MOVE.standHeight;
      phys.setAgentShape(a, a.height);
    } else a.pos.y -= lift;
  }
  const eyeT = a.ducking ? MOVE.duckEye : MOVE.standEye;
  a.eyeH += (eyeT - a.eyeH) * Math.min(1, MOVE.duckSpeed * dt);

  const w = a.weapon;
  let maxSpeed = (a.scoped && w.scopedSpeed) || w.speed;
  if (inp.walk) maxSpeed *= MOVE.walkMul;
  if (a.ducking) maxSpeed *= MOVE.duckMul;
  if (game.now - a.lastHurt < 0.35) maxSpeed *= 0.6; // bị bắn trúng thì khựng lại (tagging)

  let fx = 0, fz = 0;
  if (!frozen) {
    const sy = Math.sin(a.yaw), cy = Math.cos(a.yaw);
    fx = -sy * inp.fwd + cy * inp.side;
    fz = -cy * inp.fwd - sy * inp.side;
    const l = Math.hypot(fx, fz);
    if (l > 1e-3) { fx /= l; fz /= l; } else { fx = fz = 0; }
  }
  const v = a.vel;
  if (a.onGround) {
    const sp = Math.hypot(v.x, v.z);
    if (sp > 1e-4) {
      const drop = Math.max(sp, MOVE.stopSpeed) * MOVE.friction * dt;
      const k = Math.max(0, sp - drop) / sp;
      v.x *= k; v.z *= k;
    }
    if (!frozen && pressed(a, 'jump')) { v.y = MOVE.jumpSpeed; a.onGround = false; game.emit({ type: 'jump', a }); }
    accelerate(v, fx, fz, maxSpeed, maxSpeed, MOVE.accel, dt);
  } else {
    accelerate(v, fx, fz, maxSpeed, Math.min(maxSpeed, MOVE.airCap), MOVE.airAccel, dt);
  }
  v.y -= MOVE.gravity * dt;

  const wasAir = !a.onGround, vy = v.y;
  const m = phys.move(a, v.x * dt, v.y * dt, v.z * dt);
  if (dt > 0) {
    if (Math.abs(m.x - v.x * dt) > 1e-4) v.x = m.x / dt;
    if (Math.abs(m.z - v.z * dt) > 1e-4) v.z = m.z / dt;
  }
  a.onGround = m.grounded && v.y <= 0.01;
  if (a.onGround) v.y = 0;
  else if (v.y > 0 && m.y < v.y * dt * 0.5) v.y = 0; // đụng trần
  phys.syncAgent(a);
  if (wasAir && a.onGround && vy < -6) game.emit({ type: 'land', a, hard: vy < -9 });
  if (a.pos.y < -5) game.kill(a, null, 'world', false); // rơi khỏi map (không xảy ra, phòng hờ)

  // Bước chân (đi bộ / ngồi thì im lặng như CS)
  const sp = a.speed;
  if (a.onGround && sp > 150 * 0.0254 && !inp.walk && !a.ducking) {
    a.stepAcc += sp * dt;
    if (a.stepAcc > 2.1) { a.stepAcc = 0; game.emit({ type: 'step', a }); }
  }
}

function accelerate(v, dx, dz, wishSpeed, capSpeed, accel, dt) {
  if (!dx && !dz) return;
  const cur = v.x * dx + v.z * dz;
  const add = capSpeed - cur;
  if (add <= 0) return;
  const as = Math.min(accel * dt * wishSpeed, add);
  v.x += as * dx; v.z += as * dz;
}
