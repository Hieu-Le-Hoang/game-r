// In map ra ASCII + kiểm tra mọi spawn/site nối được với nhau (A*). Chạy: node tools/map-ascii.mjs
import { buildMap, ZONES, SPAWNS } from '../src/sim/map.js';
import { Nav } from '../src/sim/nav.js';
const map = buildMap();
const nav = new Nav(map);
const rows = [];
for (let z = 0; z < nav.h; z += 4) {
  let s = '';
  for (let x = 0; x < nav.w; x += 2) {
    const X = x / 2, Z = z / 2;
    const inZ = (r) => X >= r.x0 && X < r.x1 && Z >= r.z0 && Z < r.z1;
    const crate = map.boxes.some((b) => (b.mat === 'crate' || b.mat === 'pillar') && X + 0.25 > b.min[0] && X + 0.25 < b.max[0] && Z + 0.25 > b.min[2] && Z + 0.25 < b.max[2]);
    const sp = [...SPAWNS.T, ...SPAWNS.CT].some((p) => Math.floor(p.x) === Math.floor(X) && Math.abs(p.z - Z - 0.5) < 1.1);
    s += sp ? '@' : crate ? 'c' : map.solid[Math.floor(Z / 2) * map.W + Math.floor(X / 2)] ? '#' : nav.blocked[z * nav.w + x] ? ':' : inZ(ZONES.A) ? 'a' : inZ(ZONES.B) ? 'b' : '.';
  }
  rows.push(s);
}
console.log(rows.join('\n'));
let ok = true;
for (const t of ['A', 'B']) for (const s of ['T', 'CT']) for (const p of SPAWNS[s]) {
  const c = { x: (ZONES[t].x0 + ZONES[t].x1) / 2, z: (ZONES[t].z0 + ZONES[t].z1) / 2 };
  if (!nav.walkable(p.x, p.z)) { ok = false; console.log('spawn bị chặn', s, p); }
  const t0 = performance.now();
  const path = nav.path(p, c);
  if (!path) { ok = false; console.log('KHÔNG có đường', s, p, '->', t); }
  else if (s === 'T' && p === SPAWNS.T[0]) console.log(`T0 -> ${t}: ${path.length} điểm, ${(performance.now() - t0).toFixed(2)}ms`);
}
console.log(ok ? 'NAV OK' : 'NAV LỖI');
process.exit(ok ? 0 : 1);
