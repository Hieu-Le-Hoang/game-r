// Selftest không cần mở game:
//  1. WAD ghi ra đọc lại khớp.
//  2. Mọi brush lồi, pháp tuyến hướng ra ngoài.
//  3. Đi được: lưới 16 unit, hull người chơi 32x32x72. CT tới được T + con tin; con tin đi bộ (bậc <= 18) về được rescue.
//  4. Waypoint POD-Bot: đọc lại đúng format, CT spawn -> con tin -> rescue đi được theo link.
//  5. Ảnh layout nhìn từ trên xuống (kèm waypoint) -> build/layout.png (cs_wecare: layout-wecare.png)
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { V3 } from '../src/brush.ts';
import * as benthanh from '../src/benthanh.ts';
import * as wecare from '../src/wecare.ts';
import { CELL, buildNav, key, type Node } from '../src/nav.ts';
import { blank, fill } from '../src/proc.ts';
import { readWad, toMipTex, writeWad } from '../src/wad.ts';
import { WF, makeWaypoints, reachable, readPwf, writePwf } from '../src/waypoints.ts';

const OUT = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'build');
mkdirSync(OUT, { recursive: true });
let failed = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`);
  if (!ok) failed++;
};

// ---- 1. WAD round-trip
{
  const img = fill(blank(64, 32), [200, 120, 40], 0.3, 2);
  const m = toMipTex('t_test', img);
  const back = readWad(writeWad([m, toMipTex('{t_mask', blank(16, 16))]));
  check(back.length === 2 && back[0].name === 't_test' && back[0].w === 64 && back[0].h === 32, 'WAD đọc lại đúng tên + kích thước');
  check(back[0].mip0.every((v, i) => v === m.mips[0][i]) && back[0].palette.every((v, i) => v === m.palette[i]), 'WAD đọc lại đúng pixel + palette');
  check(back[1].mip0.every((v) => v === 255) && back[1].palette[765] === 0 && back[1].palette[767] === 255, 'texture "{" trong suốt -> index 255 xanh');
}

// ---- 2. Brush lồi, pháp tuyến ra ngoài
// --map=wecare kiểm cs_wecare, mặc định cs_benthanh
const wc = process.argv.includes('--map=wecare');
const MAP = wc ? 'cs_wecare' : 'cs_benthanh';
const { BOUNDS, WAYPOINT_HINTS } = wc ? wecare : benthanh;
const ents = (wc ? wecare.wecareMap : benthanh.benThanhMap)('test.wad');
const brushes = ents.flatMap((e) => e.brushes ?? []);
{
  let bad = 0;
  for (const b of brushes) {
    const verts = b.flatMap((f) => f.pts);
    for (const f of b) {
      const d = f.normal[0] * f.pts[0][0] + f.normal[1] * f.pts[0][1] + f.normal[2] * f.pts[0][2];
      if (verts.some((v) => v[0] * f.normal[0] + v[1] * f.normal[1] + v[2] * f.normal[2] - d > 0.01)) bad++;
    }
  }
  check(bad === 0, `${brushes.length} brush lồi, pháp tuyến hướng ra ngoài (${bad} mặt lỗi)`);
}

// ---- 3. Đi được
const nav = buildNav(ents, BOUNDS);
const pts = (c: string) => ents.filter((e) => e.props.classname === c).map((e) => e.props.origin.split(' ').map(Number) as V3);
const ct = pts('info_player_start').map((o) => nav.nodeAt(o, 36));
const t = pts('info_player_deathmatch').map((o) => nav.nodeAt(o, 36));
const hostages = pts('hostage_entity').map((o) => nav.nodeAt(o, 8));
const rescue = pts('info_hostage_rescue').map((o) => nav.nodeAt(o, 36));
check([...ct, ...t].every(Boolean), `${ct.length + t.length} spawn đều đứng trên sàn, không kẹt trong khối`);
check(hostages.every(Boolean) && rescue.every(Boolean), `${hostages.length} con tin + ${rescue.length} điểm rescue đều đứng được`);

const fromCT = nav.bfs(ct.filter(Boolean) as Node[], 44);
const reach = (n: Node | undefined, d: Map<string, number>) => (n ? d.get(key(n)) : undefined);
const minOf = (xs: (number | undefined)[]) => Math.round(Math.min(...(xs as number[])));
const tDist = t.map((n) => reach(n, fromCT));
check(tDist.every((d) => d !== undefined), `CT đi tới được mọi T spawn (gần nhất ~${minOf(tDist)} unit)`);
const hDist = hostages.map((n) => reach(n, fromCT));
check(hDist.every((d) => d !== undefined), `CT đi tới được 4 con tin (~${minOf(hDist)} unit, ~${(minOf(hDist) / 250).toFixed(1)} s chạy)`);
const fromRescue = nav.bfs(rescue.filter(Boolean) as Node[], 18);
check(hostages.every((n) => reach(n, fromRescue) !== undefined), 'con tin đi bộ (chỉ bậc <= 18) về được điểm rescue');
const fromT = nav.bfs(t.filter(Boolean) as Node[], 44);
const tToHost = minOf(hostages.map((n) => reach(n, fromT)));
console.log(`     T tới con tin ~${tToHost} unit (~${(tToHost / 250).toFixed(1)} s)`);
const spots: [string, V3][] = wc
  ? [
      ['thùng xe tải', [-1632, -150, 64]],
      ['đỉnh chồng bạt cam', [440, -460, 168]],
      ['phòng KT', [900, -8, 2]], // lối giữa 2 dãy bàn (ghế 2 bên chừa 56)
      ['hẻm WC', [-640, -460, 0]],
      ['dãy WC', [-800, -840, 0]],
      ['trong phòng WC', [-940, -950, 16]], // phòng Tây cùng, không cửa
      ['phòng họp', [960, -210, 48]], // khe giữa 2 ghế phía Bắc bàn họp
      ['phòng IT', [938, -600, 48]], // lối giữa 2 dãy bàn
    ]
  : [
      ['ban công nhà phố', [-1500, 160, 168]],
      ['gác lửng', [700, 760, 168]],
      ['Cửa Nam', [0, -688, 8]],
      ['Cửa Bắc', [0, 1008, 8]],
      ['Cửa Đông', [1008, 160, 8]],
      ['Cửa Tây', [-1008, 160, 8]],
    ];
for (const [name, o] of spots) check(reach(nav.nodeAt(o, 0), fromCT) !== undefined, `CT tới được ${name}`);

// ---- 4. Waypoint POD-Bot
const wps = makeWaypoints(ents, BOUNDS, WAYPOINT_HINTS);
const pwf = readPwf(writePwf(wps, MAP, 'game-r demo19'));
check(pwf.version === 7 && pwf.map === MAP && pwf.size === 80 + 204 * wps.length && pwf.wps.every((w, i) => w.num === i), `pwf đọc lại đúng format (${wps.length} waypoint, ${pwf.size} byte)`);
check(wps.length <= 1000, `số waypoint ${wps.length} <= 1000`);
const avg = wps.reduce((s, w) => s + w.links.length, 0) / wps.length;
check(wps.every((w) => w.links.length > 0), `mọi waypoint có link đi ra (trung bình ${avg.toFixed(1)}, cs_italy: 4,6)`);
const idxOf = (flag: number) => pwf.wps.flatMap((w, i) => (w.flags & flag ? [i] : []));
const goals = idxOf(WF.GOAL);
const rescues = idxOf(WF.RESCUE);
const nearestWp = (o: V3) => pwf.wps.map((w, i) => ({ i, d: Math.hypot(w.p[0] - o[0], w.p[1] - o[1], w.p[2] - o[2]) })).sort((a, b) => a.d - b.d)[0].i;
const ctWp = pts('info_player_start').map(nearestWp);
const tWp = pts('info_player_deathmatch').map(nearestWp);
const fromCtWp = reachable(pwf.wps, ctWp);
check(goals.length === 4 && goals.every((g) => fromCtWp.has(g)), 'theo link: CT spawn -> 4 waypoint GOAL (con tin)');
check(rescues.length === 3 && goals.every((g) => rescues.some((r) => reachable(pwf.wps, [g]).has(r))), 'theo link: GOAL -> RESCUE (dắt con tin về)');
check(tWp.every((w) => reachable(pwf.wps, [w]).has(ctWp[0])), 'theo link: T spawn -> CT spawn');
const unreachable = pwf.wps.length - fromCtWp.size;
check(unreachable === 0, `mọi waypoint tới được từ CT spawn (${unreachable} điểm lẻ)`);
if (unreachable) console.log(`     điểm lẻ: ${pwf.wps.filter((_, i) => !fromCtWp.has(i)).slice(0, 8).map((w) => w.p.map(Math.round).join(',')).join(' | ')}`);
const stuck = pwf.wps.filter((_, i) => !reachable(pwf.wps, [i]).has(ctWp[0])).length;
check(stuck === 0, `từ mọi waypoint đều về được CT spawn (${stuck} điểm cụt)`);

// ---- 5. Ảnh layout + waypoint
const S = 3;
const { NX, NY } = nav;
const img = Buffer.alloc(NX * S * NY * S * 4);
const put = (x: number, y: number, c: number[]) => {
  if (x < 0 || y < 0 || x >= NX * S || y >= NY * S) return;
  img.set([...c, 255], ((NY * S - 1 - y) * NX * S + x) * 4);
};
const cellRect = (i: number, j: number, c: number[]) => {
  for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) put(i * S + dx, j * S + dy, c);
};
for (let i = 0; i < NX; i++)
  for (let j = 0; j < NY; j++) {
    const hs = nav.floors(i, j);
    const reached = hs.filter((h) => fromCT.has(key({ i, j, h })));
    if (!hs.length) cellRect(i, j, [40, 42, 46]);
    else if (!reached.length) cellRect(i, j, [90, 70, 70]);
    else {
      const k = Math.min(1, Math.max(...reached) / 180);
      cellRect(i, j, [Math.round(120 + 120 * k), Math.round(130 + 60 * k), Math.round(110 - 60 * k)]);
    }
  }
const toPx = (p: V3) => [((p[0] - nav.X0) / CELL) * S, ((p[1] - nav.Y0) / CELL) * S];
for (const w of pwf.wps)
  for (const l of w.links) {
    const [ax, ay] = toPx(w.p);
    const [bx, by] = toPx(pwf.wps[l].p);
    const n = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let s = 0; s <= n; s++) put(Math.round(ax + ((bx - ax) * s) / n), Math.round(ay + ((by - ay) * s) / n), [70, 90, 110]);
  }
const dot = (p: V3, c: number[], r = 2) => {
  const [x, y] = toPx(p);
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) put(Math.round(x) + dx, Math.round(y) + dy, c);
};
for (const w of pwf.wps) dot(w.p, w.flags & WF.GOAL ? [255, 230, 0] : w.flags & WF.RESCUE ? [0, 230, 120] : w.flags & WF.CAMP ? [255, 140, 0] : [235, 235, 235], w.flags ? 3 : 1);
pts('info_player_start').forEach((o) => dot(o, [40, 110, 255], 3));
pts('info_player_deathmatch').forEach((o) => dot(o, [230, 40, 40], 3));
await sharp(img, { raw: { width: NX * S, height: NY * S, channels: 4 } }).png().toFile(join(OUT, wc ? 'layout-wecare.png' : 'layout.png'));
console.log(`     ảnh layout -> ${join(OUT, wc ? 'layout-wecare.png' : 'layout.png')}`);

if (failed) {
  console.log(`${failed} kiểm tra FAIL`);
  process.exit(1);
}
console.log('selftest OK');
