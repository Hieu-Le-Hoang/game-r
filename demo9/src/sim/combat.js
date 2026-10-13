// Súng: bắn, spread, giật (KickBack kiểu CS), nạp đạn, đổi súng, dao, lựu đạn, đặt/gỡ bom (qua input).
import { WEAPONS, HITGROUP, MOVE, RULES } from './constants.js';
import { pressed } from './agent.js';

const DEG = Math.PI / 180;

export function updateWeapon(game, a, dt) {
  const now = game.now, inp = a.input;

  // Giật hồi về (CS: len -= (10 + len*0.5) * dt)
  const len = Math.hypot(a.punchP, a.punchY);
  if (len > 0) {
    const nl = Math.max(0, len - (10 + len * 0.5) * dt);
    a.punchP *= nl / len; a.punchY *= nl / len;
  }

  // Đổi slot
  if (inp.slot && inp.slot !== a.slot) switchSlot(game, a, inp.slot);
  if (pressed(a, 'drop')) game.dropCurrent(a);

  const w = a.weapon, gun = a.gun;

  // Nạp đạn xong
  if (a.reloadEnd && now >= a.reloadEnd) {
    a.reloadEnd = 0;
    if (gun) { const need = WEAPONS[gun.id].mag - gun.mag, n = Math.min(need, gun.reserve); gun.mag += n; gun.reserve -= n; }
  }
  if (a.rescope && now >= a.nextFire && !a.reloadEnd) { a.scoped = a.rescope; a.rescope = 0; }
  if (pressed(a, 'reload') && gun && !a.reloadEnd && gun.mag < WEAPONS[gun.id].mag && gun.reserve > 0) startReload(game, a);

  if (!inp.fire && now - a.lastShot > 0.2) a.shotsFired = 0;
  if (now < a.deployEnd || a.reloadEnd || game.phase === 'freeze' || game.phase === 'over') { a.plantStart = -1; return; }

  // C4: giữ chuột trái trong site
  if (a.weaponId === 'c4') {
    const site = game.siteAt(a.pos);
    if (inp.fire && site && a.onGround && game.phase === 'live') {
      if (a.plantStart < 0) { a.plantStart = now; game.emit({ type: 'planting', a }); }
      if (now - a.plantStart >= RULES.plantTime) game.plant(a, site);
    } else a.plantStart = -1;
    return;
  }

  if (w.melee) {
    if (inp.fire && now >= a.nextFire) knife(game, a, false);
    else if (inp.fire2 && now >= a.nextFire) knife(game, a, true);
    return;
  }

  if (w.grenade) {
    if (pressed(a, 'fire') && now >= a.nextFire) throwNade(game, a);
    return;
  }

  if (w.sniper && pressed(a, 'fire2') && now >= a.nextFire) {
    a.scoped = (a.scoped + 1) % 3;
    game.emit({ type: 'zoom', a });
  }

  if (!gun) return;
  const want = w.semi || w.sniper ? pressed(a, 'fire') : inp.fire;
  if (!want || now < a.nextFire) return;
  if (gun.mag <= 0) {
    if (pressed(a, 'fire')) { game.emit({ type: 'dry', a }); a.nextFire = now + 0.2; }
    if (gun.reserve > 0) startReload(game, a);
    return;
  }
  shoot(game, a, w, gun);
}

export function switchSlot(game, a, slot) {
  const has = slot <= 3 ? !!a.inv[slot] : slot === 4 ? a.inv[4] > 0 : a.inv[5];
  if (!has || slot === a.slot) return;
  a.lastSlot = a.slot;
  a.slot = slot;
  a.reloadEnd = 0;
  a.scoped = a.rescope = 0;
  a.plantStart = -1;
  a.shotsFired = 0;
  a.deployEnd = game.now + (WEAPONS[a.weaponId].deploy ?? 0.75);
  game.emit({ type: 'deploy', a });
}

function startReload(game, a) {
  const w = WEAPONS[a.gun.id];
  a.reloadEnd = game.now + w.reload;
  a.scoped = a.rescope = 0;
  game.emit({ type: 'reload', a, weapon: a.gun.id });
}

function shoot(game, a, w, gun) {
  const now = game.now;
  a.shotsFired++;
  let acc;
  if (w.pistol) acc = Math.min(0.9, Math.max(w.accMin, 0.9 - 0.275 * (0.325 - (now - a.lastShot))));
  else if (w.acc) acc = w.acc(a.shotsFired);
  else acc = 1;
  const spread = w.spread(a, acc);
  a.lastShot = now;
  a.nextFire = now + w.rate;
  gun.mag--;

  const eye = a.eye, d = a.viewDir();
  // vector phải / lên của hướng bắn
  const rx = -d.z, rz = d.x, rl = Math.hypot(rx, rz) || 1;
  const right = { x: rx / rl, y: 0, z: rz / rl };
  const up = { x: right.y * d.z - right.z * d.y, y: right.z * d.x - right.x * d.z, z: right.x * d.y - right.y * d.x };
  const rnd = game.rnd;
  const sx = (rnd() - 0.5 + rnd() - 0.5) * spread, sy = (rnd() - 0.5 + rnd() - 0.5) * spread;
  const dir = norm({ x: d.x + right.x * sx + up.x * sy, y: d.y + right.y * sx + up.y * sy, z: d.z + right.z * sx + up.z * sy });
  const res = traceBullet(game, a, eye, dir, w);
  game.emit({ type: 'shot', a, weapon: gun.id, from: eye, to: res.end, hit: res.victim, normal: res.normal, flesh: !!res.victim });

  // Giật
  if (w.kick) {
    const k = a.air ? w.kick.air : a.speed > 5 * 0.0254 && !a.ducking ? w.kick.move : a.ducking ? w.kick.duck : w.kick.stand;
    kickBack(a, k, rnd);
  } else a.punchP += w.punch ?? 1;

  if (w.sniper) { a.rescope = a.scoped; a.scoped = 0; }
}

function kickBack(a, [upBase, latBase, upMod, latMod, upMax, latMax, dirChange], rnd) {
  const n = a.shotsFired;
  const up = n === 1 ? upBase : upBase + n * upMod;
  const lat = n === 1 ? latBase : latBase + n * latMod;
  a.punchP = Math.min(upMax, a.punchP + up);
  a.punchY += a.kickDir * lat;
  if (Math.abs(a.punchY) > latMax) a.punchY = Math.sign(a.punchY) * latMax;
  if (Math.floor(rnd() * dirChange) === 0) a.kickDir = -a.kickDir;
}

export function traceBullet(game, a, o, d, w) {
  const maxD = 300;
  const wall = game.phys.ray(o, d, maxD);
  let best = wall ? wall.dist : maxD, victim = null, group = null;
  for (const b of game.agents) {
    if (b === a || !b.alive || b.team === a.team) continue;
    const h = hitTest(b, o, d, best);
    if (h) { best = h.t; victim = b; group = h.group; }
  }
  const end = { x: o.x + d.x * best, y: o.y + d.y * best, z: o.z + d.z * best };
  if (victim) {
    const dmg = w.dmg * Math.pow(w.rangeMod ?? 1, best / 12.7) * HITGROUP[group];
    game.damage(victim, a, dmg, group, a.gun?.id ?? a.weaponId, w.armorRatio, d);
    return { end, victim, group };
  }
  return { end, normal: wall ? wall.normal : null };
}

// Hitbox: đầu (cầu) + ngực/bụng/chân (trụ đứng). Ngồi thì co theo tỉ lệ mắt.
export function hitTest(b, o, d, maxT) {
  const s = b.eyeH / MOVE.standEye, px = b.pos.x, py = b.pos.y, pz = b.pos.z;
  let best = maxT, group = null;
  const head = raySphere(o, d, px, py + b.eyeH + 0.04, pz, 0.15);
  if (head !== null && head < best) { best = head; group = 'head'; }
  const parts = [['chest', 1.18, 1.52, 0.25], ['stomach', 0.88, 1.18, 0.23], ['legs', 0.05, 0.88, 0.2]];
  for (const [g, y0, y1, r] of parts) {
    const t = rayCyl(o, d, px, pz, py + y0 * s, py + y1 * s, r);
    if (t !== null && t < best) { best = t; group = g; }
  }
  return group ? { t: best, group } : null;
}

function raySphere(o, d, cx, cy, cz, r) {
  const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
  const b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : null;
}

function rayCyl(o, d, cx, cz, y0, y1, r) {
  const ox = o.x - cx, oz = o.z - cz;
  const A = d.x * d.x + d.z * d.z;
  if (A < 1e-9) return null;
  const B = ox * d.x + oz * d.z, C = ox * ox + oz * oz - r * r;
  const disc = B * B - A * C;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t0 = (-B - sq) / A, t1 = (-B + sq) / A;
  // Giao với khoảng chiều cao
  if (Math.abs(d.y) < 1e-9) { if (o.y < y0 || o.y > y1) return null; }
  else {
    let a0 = (y0 - o.y) / d.y, a1 = (y1 - o.y) / d.y;
    if (a0 > a1) [a0, a1] = [a1, a0];
    t0 = Math.max(t0, a0); t1 = Math.min(t1, a1);
  }
  if (t0 > t1 || t1 < 0) return null;
  return Math.max(t0, 0);
}

function knife(game, a, stab) {
  const w = WEAPONS.knife;
  a.nextFire = game.now + (stab ? w.rate2 : w.rate);
  a.lastShot = game.now;
  const o = a.eye, d = a.viewDir();
  const wall = game.phys.ray(o, d, w.range);
  let best = wall ? wall.dist : w.range, victim = null, group = null;
  for (const b of game.agents) {
    if (b === a || !b.alive || b.team === a.team) continue;
    const h = hitTest(b, o, d, best);
    if (h) { best = h.t; victim = b; group = h.group; }
  }
  game.emit({ type: 'knife', a, hit: !!victim, wall: !!wall && !victim, stab });
  if (!victim) return;
  // Đâm sau lưng x3 như CS
  const fwd = { x: -Math.sin(victim.yaw), z: -Math.cos(victim.yaw) };
  const back = fwd.x * d.x + fwd.z * d.z > 0.5;
  const dmg = (stab ? w.dmg2 : w.dmg) * (back ? 3 : 1);
  game.damage(victim, a, dmg, group === 'head' ? 'chest' : group, 'knife', w.armorRatio, d);
}

function throwNade(game, a) {
  const d = a.viewDir();
  const p = a.pitch + (a.punchP * DEG);
  const speed = 15 * (0.9 + 0.1 * Math.cos(p));
  const o = a.eye;
  const start = { x: o.x + d.x * 0.5, y: o.y + d.y * 0.5 - 0.1, z: o.z + d.z * 0.5 };
  game.throwNade(a, start, { x: d.x * speed + a.vel.x, y: d.y * speed + 2 + a.vel.y * 0.5, z: d.z * speed + a.vel.z });
  a.inv[4] = 0;
  a.nextFire = game.now + 0.5;
  switchSlot(game, a, a.bestSlot());
}

const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };

// Độ lệch hiện tại (để HUD vẽ tâm ngắm co giãn)
export function currentSpread(a, now) {
  const w = a.weapon;
  if (!w.spread) return 0.02;
  let acc;
  if (w.pistol) acc = Math.min(0.9, Math.max(w.accMin, 0.9 - 0.275 * (0.325 - (now - a.lastShot))));
  else if (w.acc) acc = w.acc(a.shotsFired);
  else acc = 1;
  return w.spread(a, acc);
}
