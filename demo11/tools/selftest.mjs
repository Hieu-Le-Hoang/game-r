// Selftest logic thuần (không Phaser): item, ép ngọc, chỉ số, XP, pathfinding, flow field, spatial hash, dữ liệu map/atlas.
// Chạy: npm run selftest
import { readFileSync } from 'node:fs';
import { MOBS, SKILLS, CLASSES, MAPS, LORENCIA_TIERS, DUNGEON_TIERS, mobXp, xpNeed } from '../src/data.js';
import { BASES, makeItem, makeJewel, applyJewel, rollDrop, itemStats, itemName, itemColor, canEquip, glowLevel } from '../src/items.js';
import { S, newChar, stats, gainXp, addPoint } from '../src/state.js';
import { Grid, Hash } from '../src/grid.js';

let fails = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { fails++; console.log('FAIL', msg); } };
const json = (p) => JSON.parse(readFileSync(new URL('../public/a/' + p, import.meta.url)));
let seed = 7;
const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---- dữ liệu ----
for (const [k, m] of Object.entries(MOBS)) {
  const at = json(`enemies/${m.sp}.json`);
  for (const a of ['stance', 'run', m.atk || 'swing', 'die']) ok(at.anims[a], `${k}: atlas ${m.sp} thiếu anim ${a}`);
  if (m.bolt) ok(json('powers.json').anims[m.bolt + ':power'], `${k}: thiếu power ${m.bolt}`);
}
for (const k of [...LORENCIA_TIERS, ...DUNGEON_TIERS]) ok(MOBS[k], `tier ${k} không có trong MOBS`);
const icons = json('icons.json').pos, loot = json('loot.json').anims;
for (const b of Object.values(BASES)) {
  ok(icons[b.icon], `${b.k}: thiếu icon ${b.icon}`);
  ok(loot[b.loot + ':power'], `${b.k}: thiếu loot ${b.loot}`);
  const h = json(`hero/${b.layer}.json`);
  for (const a of ['stance', 'run', 'swing', 'cast', 'hit', 'die']) ok(h.anims[a], `${b.layer}: thiếu anim ${a}`);
}
for (const c of Object.values(CLASSES)) { ok(icons[c.basic.icon], `icon basic ${c.name}`); for (const k of c.skills) ok(icons[SKILLS[k].icon], `icon skill ${k}`); }

// ---- ép ngọc ----
const it = makeItem('katana');
for (let i = 0; i < 6; i++) ok(applyJewel('bless', it, r).result === 'up', 'bless +' + (i + 1));
ok(it.lvl === 6, 'bless tới +6');
ok(applyJewel('bless', it, r).result === 'invalid', 'bless không quá +6');
ok(applyJewel('soul', makeItem('katana'), r).result === 'invalid', 'soul cần +6');
let up = 0, fail = 0;
for (let i = 0; i < 4000; i++) { const x = makeItem('katana', { lvl: 6 }); const rr = applyJewel('soul', x, r); if (rr.result === 'up') { up++; ok(x.lvl === 7, 'soul up -> +7'); } else { fail++; ok(x.lvl === 0, 'soul fail -> +0'); } }
ok(Math.abs(up / 4000 - 0.5) < 0.04, `soul 50%: ${up / 4000}`);
up = 0;
for (let i = 0; i < 4000; i++) { const x = makeItem('katana', { lvl: 8, luck: true }); if (applyJewel('soul', x, r).result === 'up') up++; }
ok(Math.abs(up / 4000 - 0.75) < 0.04, `soul luck 75%: ${up / 4000}`);
ok(applyJewel('soul', makeItem('katana', { lvl: 9 }), r).result === 'invalid', 'tối đa +9');
ok(applyJewel('bless', makeJewel('soul'), r).result === 'invalid', 'không ép ngọc lên ngọc');
ok(itemStats(makeItem('katana', { lvl: 9 })).dmg[0] === 9 + 27 + 6, '+9 cộng damage');
ok(glowLevel(makeItem('katana', { lvl: 7 })) === 7 && glowLevel(makeItem('katana', { lvl: 6 })) === 0, 'glow từ +7');
ok(itemColor(makeItem('katana', { exc: ['dmgPct'] })) === '#5ce65c', 'excellent xanh lá');
ok(itemName(makeItem('katana', { lvl: 3 })) === 'Katana +3', 'tên +N');

// ---- rơi đồ ----
let own = 0, exc = 0;
for (let i = 0; i < 3000; i++) { const d = rollDrop(12, 'dk', r); const b = BASES[d.b]; ok(b && b.req <= 15, 'drop req hợp cấp'); if (b.cls === 'dk') own++; if (d.exc.length) exc++; }
ok(own / 3000 > 0.7 && own / 3000 < 0.8, `75% đồ đúng class: ${own / 3000}`);
ok(exc / 3000 > 0.05 && exc / 3000 < 0.11, `~8% excellent: ${exc / 3000}`);

// ---- nhân vật ----
newChar('dk');
let st = stats();
ok(st.dmg[0] > 0 && st.dmg[1] >= st.dmg[0], 'DK damage');
ok(st.maxHp > 100, 'DK máu trâu');
ok(canEquip(S.eq.main, 'dk', 1) && !canEquip(makeItem('skull'), 'dk', 1), 'class restriction');
ok(!canEquip(makeItem('giant'), 'dk', 10), 'level restriction');
const hp0 = st.maxHp;
ok(gainXp(xpNeed(1) + xpNeed(2)) === 2 && S.lvl === 3 && S.pts === 10, 'lên 2 cấp, +10 điểm');
ok(addPoint('vit', 10) && stats().maxHp === hp0 + 2 * 2 + 30, 'cộng VIT tăng máu');
newChar('dw');
st = stats();
ok(st.mag[1] > st.dmg[1], 'DW sát thương phép > vật lý');
ok(mobXp(30, 50) < mobXp(30, 30), 'phạt XP khi chênh cấp');

// ---- lưới ----
for (const mk of ['lorencia', 'dungeon']) {
  const m = json(`maps/${mk}.json`), g = new Grid(m), M = MAPS[mk];
  const start = M.town ? g.nearestWalk(M.town.x, M.town.y, 3) : g.nearestWalk(m.hero[0] + 0.5, m.hero[1] + 0.5, 3);
  ok(start, `${mk}: điểm xuất phát đi được`);
  const dist = g.distances(start.x, start.y);
  const reach = dist.filter((v) => v >= 0).length, walk = m.col.filter((v) => v === 0).length;
  ok(reach > walk * 0.8, `${mk}: ${reach}/${walk} ô đi tới được`);
  if (M.portal.x) { const p = g.nearestWalk(M.portal.x, M.portal.y, 4); ok(p && dist[Math.floor(p.y) * m.w + Math.floor(p.x)] > 0, `${mk}: cổng đi tới được`); const path = g.path(start.x, start.y, p.x, p.y, 20000); ok(path && path.length > 10, `${mk}: A* tới cổng`); }
  if (M.boss) { const b = g.nearestWalk(M.boss.x, M.boss.y, 3); ok(b && dist[Math.floor(b.y) * m.w + Math.floor(b.x)] > 0, `${mk}: phòng boss đi tới được`); }
  let groups = 0;
  m.enemies.forEach((e, i) => {
    if (M.skipGroups.includes(i)) return;
    let w = 0; for (let y = e.y; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++) if (g.walk(x + 0.5, y + 0.5)) w++;
    if (w > 3 || g.nearestWalk(e.x + e.w / 2, e.y + e.h / 2, 5)) groups++;
  });
  ok(groups === m.enemies.length - M.skipGroups.length, `${mk}: nhóm spawn có chỗ đứng (${groups})`);
  // flow field: từ 1 ô xa đi xuống dốc phải về gần hero
  g.flowOrigin = -1; g.buildFlow(start.x, start.y, 30);
  let u = null;
  for (let k = 0; k < m.w * m.h && !u; k++) { const v = g.flow[k]; if (v > 150 && v < 250) u = { x: k % m.w + 0.5, y: Math.floor(k / m.w) + 0.5 }; }
  if (u) { for (let s = 0; s < 400; s++) { const f = g.flowDir(u.x, u.y); if (!f) break; g.slide(u, f.x * 0.1, f.y * 0.1); } ok(Math.hypot(u.x - start.x, u.y - start.y) < 2, `${mk}: flow field dẫn quái về hero`); }
}
// spatial hash
const hs = new Hash(100, 100, 2), pts = Array.from({ length: 500 }, () => ({ x: r() * 100, y: r() * 100 }));
pts.forEach((p) => hs.add(p));
let c1 = 0, c2 = 0;
hs.each(50, 50, 7, () => c1++);
for (const p of pts) if (Math.hypot(p.x - 50, p.y - 50) <= 7) c2++;
ok(c1 === c2, `hash query ${c1} = brute ${c2}`);

console.log(fails ? `${fails}/${n} FAIL` : `OK ${n} checks`);
process.exit(fails ? 1 : 0);
