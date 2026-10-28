// cs_benthanh: chợ Bến Thành thu nhỏ. Trục: X = Đông, Y = Bắc, Z = lên. 1 m ~ 40 unit.
//
//              Lê Thánh Tôn (đường phía Bắc, T xoay hướng)
//    +------------------[Cửa Bắc]------------------+
//  P | T spawn   | khu vải       | gác lửng: CON TIN | P
//  B |---------- lối ngang (Cửa Tây <-> Cửa Đông) --| C
//  C | ăn uống   | lối giữa      | trái cây          | T
//    +---------[Cửa Nam + tháp đồng hồ]------------+
//              Vòng xoay: CT spawn + điểm rescue
import { aligned, alignedPlate, box, prism, type Brush, type Entity, type TexSel, type V2, type V3 } from './brush.ts';
import { TEXTURES as TEX } from './textures.ts';
import type { WaypointHints } from './waypoints.ts';
import { baGac, bikeRow, foodCart, pushCart, shoulderPole, standSign, streetStall, umbrella, utilityPole, type PropSink } from './props.ts';

export const TEXTURES = TEX;
export const TITLE = [
  'Cho Ben Thanh - Hostage Rescue',
  '',
  'Terrorists dang giu 4 con tin tren gac lung',
  'goc Dong Bac trong cho Ben Thanh.',
  '',
  'Counter-Terrorists: vao cho qua Cua Nam,',
  'Cua Dong hoac Cua Tay, dua con tin',
  've vong xoay truoc thap dong ho.',
  '',
  'Map: demo19 game-r (sinh bang script)',
].join('\n');

// ---- Kích thước chính ----
const EDGE = { x0: -1856, x1: 1856, y0: -1856, y1: 1728 }; // mép trong vỏ trời
export const BOUNDS = EDGE;
/** Con tin bà bán rong (tools/hostage.ts). CS 1.3 đọc key model của hostage_entity, map khác vẫn dùng scientist. */
export { HOSTAGE_MODEL } from './patch-hostage.ts';
import { HOSTAGE_MODEL } from './patch-hostage.ts';
const SKY_TOP = 1088;
const HALL = { x0: -1024, x1: 1024, y0: -704, y1: 1024 }; // mép ngoài tường chợ
const WALL = 32;
const BASE = 8; // nền chợ + vỉa hè cao 8
const CEIL = 320; // trần khu bên
const NAVE = 160; // lối giữa rộng 2*NAVE, trần cao hơn
const NAVE_CEIL = 480;
const GATE_H = BASE + 224;
const ROWS = { west: -1536, east: 1536, north: 1472, south: -1664 }; // mặt tiền dãy nhà phố

const world: Brush[] = [];
const detail: Brush[] = []; // func_detail: không cắt VIS
const ents: Entity[] = [];
const masked: Brush[] = []; // texture trong suốt, có va chạm (func_wall rendermode 4)
const illusion: Brush[] = []; // texture trong suốt, không va chạm (dây điện, hoa giấy)
const props: Brush[] = []; // đồ vật đường phố: 1 func_wall riêng để không cắt leaf của world
const M = (b: Brush) => masked.push(b);
const I = (b: Brush) => illusion.push(b);

const W = (b: Brush) => world.push(b);
const D = (b: Brush) => detail.push(b);
const point = (classname: string, o: V3, extra: Record<string, string> = {}) =>
  ents.push({ props: { classname, origin: o.join(' '), ...extra } });
const light = (o: V3, rgbBright: string) => point('light', o, { _light: rgbBright });

/** Tường chạy theo trục X (dày theo Y) có các lỗ cửa [a, b) từ chân tới `top`. */
function wallX(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, holes: { a: number; b: number; top: number }[], tex: TexSel) {
  let x = x0;
  for (const h of [...holes].sort((p, q) => p.a - q.a)) {
    if (h.a > x) W(box([x, y0, z0], [h.a, y1, z1], tex));
    if (h.top < z1) W(box([h.a, y0, h.top], [h.b, y1, z1], tex));
    x = h.b;
  }
  if (x < x1) W(box([x, y0, z0], [x1, y1, z1], tex));
}

/** Tường chạy theo trục Y (dày theo X). */
function wallY(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, holes: { a: number; b: number; top: number }[], tex: TexSel) {
  let y = y0;
  for (const h of [...holes].sort((p, q) => p.a - q.a)) {
    if (h.a > y) W(box([x0, y, z0], [x1, h.a, z1], tex));
    if (h.top < z1) W(box([x0, h.a, h.top], [x1, h.b, z1], tex));
    y = h.b;
  }
  if (y < y1) W(box([x0, y, z0], [x1, y1, z1], tex));
}

type Facing = 'n' | 's' | 'e' | 'w';
const NORMAL: Record<Facing, V3> = { n: [0, 1, 0], s: [0, -1, 0], e: [1, 0, 0], w: [-1, 0, 0] };

/** Tấm mỏng dán trên mặt đứng (biển hiệu, cửa sổ, cửa): neo texture vào góc trên-trái nhìn từ phía trước. */
function plate(min: V3, max: V3, tex: string, facing: Facing, into: (b: Brush) => void = D, cell: [number, number] = [0, 0]) {
  into(alignedPlate(min, max, tex, NORMAL[facing], cell));
}

/** Toạ độ cục bộ của một mặt tiền -> thế giới. along: dọc mặt tiền, d: sâu vào trong nhà (âm = nhô ra phố). */
function frame(facing: Facing, front: number) {
  return (along: number, d: number, z: number): V3 => {
    if (facing === 'e') return [front - d, along, z];
    if (facing === 'w') return [front + d, along, z];
    if (facing === 'n') return [along, front - d, z];
    return [along, front + d, z];
  };
}
function lbox(f: ReturnType<typeof frame>, a0: number, a1: number, d0: number, d1: number, z0: number, z1: number): [V3, V3] {
  const p = f(a0, d0, z0);
  const q = f(a1, d1, z1);
  return [
    [Math.min(p[0], q[0]), Math.min(p[1], q[1]), z0],
    [Math.max(p[0], q[0]), Math.max(p[1], q[1]), z1],
  ];
}

const HOUSE_COLORS = ['bt_house_pk', 'bt_house_bl', 'bt_house_yl', 'bt_house_gr'];
const SHOP_SIGNS = ['bt_sign_taphoa', 'bt_sign_pho', 'bt_sign_suaxe', 'bt_sign_cafe', 'bt_sign_banhmi', 'bt_sign_com'];
let houseNo = 0;

/** Dãy nhà phố (khối đặc) dọc một mặt tiền, từ `a0` tới `a1`, sâu `depth`. */
function shopRow(facing: Facing, front: number, a0: number, a1: number, depth: number) {
  const f = frame(facing, front);
  const widths = [192, 160, 224, 176, 256, 208];
  let a = a0;
  while (a < a1) {
    const w = Math.min(widths[houseNo % widths.length], a1 - a);
    const color = HOUSE_COLORS[houseNo % HOUSE_COLORS.length];
    const h = [352, 416, 384, 448][houseNo % 4];
    houseNo++;
    const [min, max] = lbox(f, a, a + w, 0, depth, 0, h);
    W(box(min, max, { side: color, top: 'bt_curb' }));
    if (w < 128) {
      a += w;
      continue;
    }
    // Tầng trệt: cửa sắt xếp + mái tôn che + biển hiệu
    const g = lbox(f, a + 16, a + w - 16, -2, 0, 0, 160);
    plate(g[0], g[1], 'bt_gate', facing);
    const aw = lbox(f, a, a + w, -72, 0, 176, 184);
    D(box(aw[0], aw[1], 'bt_tin'));
    const sMid = a + w / 2;
    const s = lbox(f, sMid - 48, sMid + 48, -4, 0, 192, 216);
    plate(s[0], s[1], SHOP_SIGNS[houseNo % SHOP_SIGNS.length], facing);
    // Các tầng trên: cửa sổ 64x96
    for (let z = 240; z + 96 <= h - 24; z += 128)
      for (let wx = a + 32; wx + 64 <= a + w - 24; wx += 96) {
        const win = lbox(f, wx, wx + 64, -2, 0, z, z + 96);
        plate(win[0], win[1], 'bt_window', facing);
      }
    // Bảng số nhà cạnh mép cửa, hộp thư (1/3 số nhà), chữ xịt sơn CẤM ĐẬU XE trên cửa (1/4)
    const n = lbox(f, a + w - 44, a + w - 28, -2, 0, 164, 180);
    plate(n[0], n[1], 'bt_sonha', facing, D, [houseNo % 4, Math.floor(houseNo / 4) % 2]);
    if (houseNo % 3 === 0) {
      const mb = lbox(f, a + 22, a + 34, -8, 0, 96, 112);
      plate(mb[0], mb[1], 'bt_mailbox', facing);
    }
    if (houseNo % 4 === 1) {
      const p = lbox(f, sMid - 48, sMid + 48, -3, -2, 48, 72);
      plate(p[0], p[1], '{bt_noparkpaint', facing, M);
    }
    // Ban công nhỏ có lan can + hoa giấy rủ (nhà chẵn, đủ cao)
    if (houseNo % 2 === 0 && h >= 384) {
      const ledge = lbox(f, a + 16, a + w - 16, -28, 0, 232, 240);
      D(box(ledge[0], ledge[1], 'bt_trim'));
      const r = lbox(f, a + 16, a + w - 16, -28, -26, 240, 288);
      plate(r[0], r[1], '{bt_rail', facing, M);
      const fl = lbox(f, a + 16, a + w - 16, -31, -30, 196, 244);
      plate(fl[0], fl[1], '{bt_hoagiay', facing, I);
      const top = lbox(f, a + 16, a + w - 16, -27, -26, 252, 300);
      plate(top[0], top[1], '{bt_hoagiay', facing, I);
    }
    a += w;
  }
}

/** Sạp hàng 160x160: kiểu kiosk kín (cao, cửa cuốn / vải) hoặc quầy thấp có bạt che. */
function stall(x: number, y: number, kind: 'kiosk' | 'counter', theme: { side: string; top: string; sign: string }) {
  const S = 160;
  if (kind === 'kiosk') {
    D(box([x, y, BASE], [x + S, y + S, BASE + 176], { side: theme.side, top: 'bt_tin' }));
    plate([x + 32, y - 4, BASE + 136], [x + 128, y, BASE + 160], theme.sign, 's');
    plate([x + 32, y + S, BASE + 136], [x + 128, y + S + 4, BASE + 160], theme.sign, 'n');
    return;
  }
  D(box([x + 8, y + 8, BASE], [x + S - 8, y + S - 8, BASE + 40], { side: 'bt_wood', top: theme.top }));
  for (const [px, py] of [[x, y], [x + S - 8, y], [x, y + S - 8], [x + S - 8, y + S - 8]]) D(box([px, py, BASE], [px + 8, py + 8, BASE + 152], 'bt_rust'));
  D(box([x - 8, y - 8, BASE + 152], [x + S + 8, y + S + 8, BASE + 158], 'bt_tarp'));
  plate([x + 32, y - 12, BASE + 120], [x + 128, y - 8, BASE + 144], theme.sign, 's');
}

/** Chồng thùng carton (nấp được). */
function crates(x: number, y: number, n: number, z = BASE) {
  for (let i = 0; i < n; i++) {
    const ox = (i % 2) * 48;
    const oz = Math.floor(i / 2) * 48;
    D(box([x + ox, y, z + oz], [x + ox + 48, y + 48, z + oz + 48], 'bt_cardboard'));
  }
}

function overlaps(x: number, y: number, s: number, r: [number, number, number, number]) {
  return x < r[2] && x + s > r[0] && y < r[3] && y + s > r[1];
}

// ---------------------------------------------------------------- vỏ + nền
function shellAndGround() {
  const t = 32;
  const { x0, x1, y0, y1 } = EDGE;
  W(box([x0 - t, y0 - t, SKY_TOP], [x1 + t, y1 + t, SKY_TOP + t], 'sky'));
  W(box([x0 - t, y0 - t, -32], [x0, y1 + t, SKY_TOP], 'sky'));
  W(box([x1, y0 - t, -32], [x1 + t, y1 + t, SKY_TOP], 'sky'));
  W(box([x0, y0 - t, -32], [x1, y0, SKY_TOP], 'sky'));
  W(box([x0, y1, -32], [x1, y1 + t, SKY_TOP], 'sky'));
  W(box([x0, y0, -32], [x1, y1, 0], { side: 'bt_curb', top: 'bt_road' }));

  // Vỉa hè quanh chợ (4 dải, không chồng lên nền chợ)
  const sw = { side: 'bt_curb', top: 'bt_sidewalk' };
  const m = 128;
  W(box([HALL.x0 - m, HALL.y0 - m, 0], [HALL.x1 + m, HALL.y0, BASE], sw));
  W(box([HALL.x0 - m, HALL.y1, 0], [HALL.x1 + m, HALL.y1 + m, BASE], sw));
  W(box([HALL.x0 - m, HALL.y0, 0], [HALL.x0, HALL.y1, BASE], sw));
  W(box([HALL.x1, HALL.y0, 0], [HALL.x1 + m, HALL.y1, BASE], sw));
  // Vỉa hè trước các dãy nhà phố
  W(box([ROWS.west, EDGE.y0, 0], [ROWS.west + m, ROWS.north, BASE], sw));
  W(box([ROWS.east - m, EDGE.y0, 0], [ROWS.east, ROWS.north, BASE], sw));
  W(box([ROWS.west + m, ROWS.north - m, 0], [ROWS.east - m, ROWS.north, BASE], sw));
  W(box([ROWS.west + m, ROWS.south, 0], [ROWS.east - m, ROWS.south + m, BASE], sw));
}

// ---------------------------------------------------------------- nhà lồng chợ
function hall() {
  const { x0, x1, y0, y1 } = HALL;
  const ix0 = x0 + WALL;
  const ix1 = x1 - WALL;
  const iy0 = y0 + WALL;
  const iy1 = y1 - WALL;
  const top = CEIL + 32;
  const wallTex = { side: 'bt_wall', top: 'bt_trim', bottom: 'bt_trim' };
  W(box([x0, y0, 0], [x1, y1, BASE], { side: 'bt_curb', top: 'bt_terrazzo' }));
  // 4 cửa: Nam, Bắc rộng bằng lối giữa; Đông, Tây ở lối ngang
  wallX(x0, x1, y0, iy0, BASE, top, [{ a: -128, b: 128, top: GATE_H }], wallTex);
  wallX(x0, x1, iy1, y1, BASE, top, [{ a: -128, b: 128, top: GATE_H }], wallTex);
  wallY(x0, ix0, iy0, iy1, BASE, top, [{ a: 64, b: 256, top: GATE_H }], wallTex);
  wallY(ix1, x1, iy0, iy1, BASE, top, [{ a: 64, b: 256, top: GATE_H }], wallTex);
  // Chân tường + gờ trắng chạy quanh
  for (const [a, b] of [[[x0 - 8, y0 - 8], [x1 + 8, y0]], [[x0 - 8, y1], [x1 + 8, y1 + 8]], [[x0 - 8, y0], [x0, y1]], [[x1, y0], [x1 + 8, y1]]] as [V2, V2][])
    D(box([a[0], a[1], CEIL - 16], [b[0], b[1], CEIL], 'bt_trim'));

  // Trần khu bên + tường cửa mái lối giữa + trần lối giữa
  const ceil = { side: 'bt_trim', top: 'bt_tin', bottom: 'bt_tin' };
  W(box([ix0, iy0, CEIL], [-NAVE, iy1, top], ceil));
  W(box([NAVE, iy0, CEIL], [ix1, iy1, top], ceil));
  W(box([-NAVE - 32, iy0, top], [-NAVE, iy1, NAVE_CEIL], wallTex));
  W(box([NAVE, iy0, top], [NAVE + 32, iy1, NAVE_CEIL], wallTex));
  W(box([-NAVE - 32, iy0, CEIL], [NAVE + 32, iy0 + 0 + 32, NAVE_CEIL], wallTex)); // đầu hồi Nam
  W(box([-NAVE - 32, iy1 - 32, CEIL], [NAVE + 32, iy1, NAVE_CEIL], wallTex)); // đầu hồi Bắc
  W(box([-NAVE - 32, iy0, NAVE_CEIL], [NAVE + 32, iy1, NAVE_CEIL + 32], ceil));

  // Mái ngói: 2 mái dốc khu bên + mái hồi lối giữa (lăng trụ dọc trục Y)
  const ry0 = y0 - 32;
  const ry1 = y1 + 32;
  const roof = 'bt_roof';
  W(prism([[x0 - 32, top], [-NAVE - 32, top], [-NAVE - 32, top + 112]], 'y', ry0, ry1, roof));
  W(prism([[NAVE + 32, top], [x1 + 32, top], [NAVE + 32, top + 112]], 'y', ry0, ry1, roof));
  W(prism([[-NAVE - 64, NAVE_CEIL + 32], [NAVE + 64, NAVE_CEIL + 32], [0, NAVE_CEIL + 128]], 'y', ry0, ry1, roof));

  // Cột dọc lối giữa (chừa lối ngang 64..256)
  for (let y = iy0 + 96; y < iy1 - 64; y += 256) {
    if (y + 32 > 64 && y < 256) continue;
    for (const x of [-NAVE - 32, NAVE]) D(box([x, y, BASE], [x + 32, y + 32, CEIL], 'bt_trim'));
  }

  // Đèn trong chợ
  for (let y = iy0 + 128; y < iy1; y += 256) light([0, y, NAVE_CEIL - 40], '255 228 180 230');
  for (const x of [-800, -480, 480, 800]) for (let y = iy0 + 160; y < iy1; y += 320) light([x, y, CEIL - 24], '255 222 170 170');
  for (const x of [-800, 800]) light([x, 160, 200], '255 222 170 140');
}

// ---------------------------------------------------------------- tháp đồng hồ + Cửa Nam
function clockTower() {
  const y0 = -800;
  const y1 = HALL.y0;
  const wallTex = { side: 'bt_wall', top: 'bt_trim', bottom: 'bt_trim' };
  W(box([-192, y0, BASE], [-128, y1, GATE_H], wallTex));
  W(box([128, y0, BASE], [192, y1, GATE_H], wallTex));
  W(box([-192, y0, GATE_H], [192, y1, 704], wallTex));
  W(box([-208, y0 - 16, 704], [208, y1 + 16, 736], 'bt_trim'));
  W(prism([[y0 - 16, 736], [y1 + 16, 736], [(y0 + y1) / 2, 816]], 'x', -208, 208, 'bt_roof'));
  // Gờ trang trí 2 bên + biển chữ + mặt đồng hồ (mặt Nam, Đông, Tây)
  D(box([-200, y0 - 8, GATE_H], [200, y0, GATE_H + 16], 'bt_trim'));
  plate([-192, y0 - 6, 256], [192, y0, 352], 'bt_sign_main', 's', W);
  plate([-64, y0 - 4, 480], [64, y0, 608], 'bt_clock', 's');
  plate([192, -800 + 0, 480], [196, -672 - 0, 608], 'bt_clock', 'e');
  plate([-196, -800, 480], [-192, -672, 608], 'bt_clock', 'w');
  light([0, y0 - 96, 640], '255 240 200 120');
}

// ---------------------------------------------------------------- sạp hàng 4 khu
function stalls() {
  const food = ['bt_sign_pho', 'bt_sign_com', 'bt_sign_banhmi', 'bt_sign_cafe'];
  const block = (x0: number, x1: number, y0: number, y1: number, fn: (x: number, y: number, i: number) => void, skip?: [number, number, number, number]) => {
    let i = 0;
    for (let y = y0; y + 160 <= y1; y += 256)
      for (let x = x0; x + 160 <= x1; x += 256) {
        if (skip && overlaps(x, y, 160, skip)) continue;
        fn(x, y, i++);
      }
  };
  // Tây Nam: ăn uống
  block(-928, -192, -608, 0, (x, y, i) => stall(x, y, i % 3 === 1 ? 'kiosk' : 'counter', { side: 'bt_shutter', top: 'bt_wood', sign: food[i % food.length] }));
  // Đông Nam: trái cây
  block(192, 928, -608, 0, (x, y, i) => stall(x, y, i % 2 ? 'kiosk' : 'counter', { side: 'bt_shutter', top: 'bt_fruit', sign: 'bt_sign_trai' }));
  // Tây Bắc: khu vải (chừa chỗ T spawn phía Bắc)
  block(-928, -192, 320, 800, (x, y) => stall(x, y, 'kiosk', { side: 'bt_fabric', top: 'bt_tin', sign: 'bt_sign_vai' }));
  // Đông Bắc: chừa cầu thang + gác lửng
  block(192, 928, 320, 928, (x, y) => stall(x, y, 'kiosk', { side: 'bt_shutter', top: 'bt_tin', sign: 'bt_sign_taphoa' }), [384, 368, 992, 992]);

  // Vật cản ở lối giữa để lối không thành hành lang AWP thuần
  crates(-112, -320, 4);
  crates(32, 480, 3);
  crates(-96, 704, 2);
  D(box([24, -64, BASE], [120, 0, BASE + 40], { side: 'bt_wood', top: 'bt_fruit' }));
}

// ---------------------------------------------------------------- gác lửng giữ con tin (góc Đông Bắc)
function mezzanine() {
  const x0 = 416;
  const x1 = HALL.x1 - WALL;
  const y0 = 640;
  const y1 = HALL.y1 - WALL;
  const top = BASE + 160;
  D(box([x0, y0, top - 16], [x1, y1, top], { side: 'bt_wood', top: 'bt_wood', bottom: 'bt_wood' }));
  for (const x of [x0, 640, 832]) D(box([x, y0, BASE], [x + 16, y0 + 16, top - 16], 'bt_rust'));
  // Cầu thang sắt đi lên hướng Bắc
  for (let i = 1; i <= 10; i++) D(box([x0, 400 + 24 * (i - 1), BASE], [x0 + 96, y0, BASE + 16 * i], { side: 'bt_rust', top: 'bt_wood' }));
  // Lan can (texture trong suốt -> func_wall render solid)
  ents.push({
    props: { classname: 'func_wall', rendermode: '4', renderamt: '255' },
    brushes: [
      aligned(box([x0 + 96, y0, top], [x1, y0 + 4, top + 48], '{bt_rail'), [x0, y0, top + 48]),
      aligned(box([x0, y0 + 4, top], [x0 + 4, y1, top + 48], '{bt_rail'), [x0, y0, top + 48]),
    ],
  });
  // Hàng hoá dưới gác + trên gác
  crates(480, 704, 4);
  crates(800, 880, 3);
  crates(900, 700, 2, top);
  for (const [x, y] of [[620, 860], [720, 930], [860, 840], [940, 940]]) point('hostage_entity', [x, y, top + 8], { angle: '225', model: HOSTAGE_MODEL });
  light([700, 800, 120], '255 210 160 110');
  light([700, 820, CEIL - 24], '255 222 170 160');
}

// ---------------------------------------------------------------- nhà phố vào được (đường Phan Bội Châu, đối diện Cửa Tây)
const HOUSE = { x0: EDGE.x0, x1: ROWS.west, y0: -480, y1: 288 };
function enterableHouse() {
  const { x0, x1, y0, y1 } = HOUSE;
  const t = 32;
  const h = 352;
  const color = { side: 'bt_house_bl', top: 'bt_curb' };
  const inner = { side: 'bt_trim', top: 'bt_curb', bottom: 'bt_trim' };
  W(box([x0, y0, 0], [x1, y1, BASE], { side: 'bt_curb', top: 'bt_gachbong' }));
  // Mặt tiền (Đông): cửa trệt + cửa ra ban công tầng 2
  wallY(x1 - t, x1, y0, y1, 0, h, [{ a: -448, b: -320, top: BASE + 136 }, { a: 64, b: 256, top: 296 }], color);
  W(box([x0, y0, 0], [x1 - t, y0 + t, h], color));
  W(box([x0, y1 - t, 0], [x1 - t, y1, h], color));
  W(box([x0, y0 + t, 320], [x1 - t, y1 - t, h], inner));
  // Sàn tầng 2 + cầu thang đi lên hướng Bắc
  const f2 = BASE + 160;
  W(box([x0, -192, f2 - 16], [x1 - t, y1 - t, f2], { side: 'bt_wood', top: 'bt_wood', bottom: 'bt_trim' }));
  for (let i = 1; i <= 10; i++) D(box([x0 + 32, -392 + 20 * (i - 1), BASE], [x0 + 128, -192, BASE + 16 * i], { side: 'bt_trim', top: 'bt_wood' }));
  // Ban công nhìn sang Cửa Tây
  D(box([x1, 64, f2 - 16], [x1 + 64, 256, f2], { side: 'bt_trim', top: 'bt_gachbong', bottom: 'bt_trim' }));
  ents.push({
    props: { classname: 'func_wall', rendermode: '4', renderamt: '255' },
    brushes: [
      aligned(box([x1 + 60, 64, f2], [x1 + 64, 256, f2 + 48], '{bt_rail'), [x1, 64, f2 + 48]),
      aligned(box([x1, 64, f2], [x1 + 60, 68, f2 + 48], '{bt_rail'), [x1, 64, f2 + 48]),
      aligned(box([x1, 252, f2], [x1 + 60, 256, f2 + 48], '{bt_rail'), [x1, 252, f2 + 48]),
    ],
  });
  // Hoa giấy rủ dưới ban công và vắt trên lan can
  plate([x1 + 65, 64, f2 - 64], [x1 + 66, 256, f2 - 16], '{bt_hoagiay', 'e', I);
  plate([x1 + 66, 64, f2 + 20], [x1 + 67, 256, f2 + 68], '{bt_hoagiay', 'e', I);
  // Mặt tiền: biển SỬA XE, cửa sổ tầng 2, mái tôn trên cửa
  plate([x1, -432, BASE + 148], [x1 + 4, -336, BASE + 172], 'bt_sign_suaxe', 'e');
  D(box([x1, -480, 176], [x1 + 72, -288, 184], 'bt_tin'));
  for (const y of [-416, -288, -160]) plate([x1, y, 200], [x1 + 2, y + 64, 296], 'bt_window', 'e');
  // Đồ đạc: quầy, thùng
  D(box([x0 + 160, -96, BASE], [x0 + 224, 160, BASE + 40], { side: 'bt_wood', top: 'bt_wood' }));
  crates(x0 + 40, 96, 3);
  crates(x0 + 40, 120, 2, f2);
  light([x0 + 160, -300, 140], '255 220 170 110');
  light([x0 + 160, 40, 290], '255 220 170 110');
}

// ---------------------------------------------------------------- phố + vòng xoay
function streets() {
  // Dãy nhà phố 4 phía (chừa nhà vào được)
  shopRow('e', ROWS.west, EDGE.y0, HOUSE.y0, ROWS.west - EDGE.x0);
  shopRow('e', ROWS.west, HOUSE.y1, ROWS.north, ROWS.west - EDGE.x0);
  shopRow('w', ROWS.east, EDGE.y0, ROWS.north, EDGE.x1 - ROWS.east);
  shopRow('s', ROWS.north, EDGE.x0, EDGE.x1, EDGE.y1 - ROWS.north);
  shopRow('n', ROWS.south, ROWS.west, ROWS.east, ROWS.south - EDGE.y0);

  // Vòng xoay: đảo bát giác cỏ + bệ tượng + tượng (khối)
  const c: V2 = [0, -1184];
  const r = 224;
  const oct: V2[] = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    return [Math.round(c[0] + Math.cos(a) * r), Math.round(c[1] + Math.sin(a) * r)];
  });
  W(prism(oct, 'z', 0, 12, { side: 'bt_curb', top: 'bt_grass' }));
  D(box([c[0] - 56, c[1] - 56, 12], [c[0] + 56, c[1] + 56, 168], 'bt_trim'));
  D(box([c[0] - 24, c[1] - 56, 168], [c[0] + 24, c[1] + 48, 216], 'bt_bronze'));
  D(box([c[0] - 20, c[1] + 40, 200], [c[0] + 20, c[1] + 76, 248], 'bt_bronze'));
  D(box([c[0] - 14, c[1] - 16, 216], [c[0] + 14, c[1] + 12, 280], 'bt_bronze'));
  light([c[0], c[1] - 120, 120], '255 240 210 90');

  // Phan Chu Trinh (Đông): quầy ngoài trời dưới bạt dọc tường chợ
  const ex = HALL.x1 + 128;
  D(box([HALL.x1, -640, 176], [ex + 32, -64, 184], 'bt_tarp'));
  D(box([HALL.x1, 352, 176], [ex + 32, 928, 184], 'bt_tarp'));
  for (const y of [-640, -352, -96, 352, 640, 896]) D(box([ex + 16, y, BASE], [ex + 32, y + 16, 176], 'bt_rust'));
  for (const y of [-560, -288, 432, 704]) D(box([HALL.x1 + 24, y, BASE], [HALL.x1 + 104, y + 160, BASE + 40], { side: 'bt_wood', top: y % 3 ? 'bt_fruit' : 'bt_cardboard' }));
  crates(1248, -224, 4, 0);
  crates(1296, 560, 3, 0);
  crates(1200, 160, 2, 0);

  // Phan Bội Châu (Tây): thùng hàng làm chỗ nấp
  crates(-1296, -560, 3, 0);
  crates(-1232, 512, 4, 0);
  crates(-1360, 832, 2, 0);
  // Lê Thánh Tôn (Bắc): xe đẩy hàng + thùng
  D(box([-480, 1216, 0], [-352, 1280, 40], { side: 'bt_wood', top: 'bt_fruit' }));
  crates(256, 1200, 4, 0);
  crates(-864, 1296, 3, 0);
  crates(800, 1232, 2, 0);
  // Quảng trường phía Nam: bồn hoa + thùng
  D(box([-704, -960, 0], [-576, -896, 24], { side: 'bt_curb', top: 'bt_grass' }));
  D(box([576, -960, 0], [704, -896, 24], { side: 'bt_curb', top: 'bt_grass' }));
  crates(-1008, -1360, 3, 0);
  crates(960, -1424, 2, 0);

  // Hàng rong dọc vỉa hè: xe hủ tiếu / bánh mì / nước mía, xe đẩy trái cây, gánh hàng, ô dù, quán cóc
  const s: PropSink = { solid: props, masked };
  const z = BASE;
  // Phan Bội Châu (vỉa hè dãy nhà phía Tây, x -1536..-1408)
  foodCart(s, -1472, -1200, z, 'y', 'ht');
  streetStall(s, -1472, -1060, z);
  shoulderPole(s, -1480, -760, z, 'y', 'bt_veg');
  pushCart(s, -1472, 560, z, 'y', 'bt_fruit');
  umbrella(s, -1472, 960, z);
  shoulderPole(s, -1484, 960, z, 'y', 'bt_fruit');
  // Phan Chu Trinh (vỉa hè dãy nhà phía Đông, x 1408..1536)
  foodCart(s, 1472, -1100, z, 'y', 'bm');
  foodCart(s, 1472, -560, z, 'y', 'nm');
  streetStall(s, 1472, -430, z);
  foodCart(s, 1472, 300, z, 'y', 'ht');
  streetStall(s, 1472, 440, z);
  umbrella(s, 1472, 440, z);
  shoulderPole(s, 1480, 900, z, 'y', 'bt_fruit');
  umbrella(s, 1460, 1010, z);
  // Lê Thánh Tôn (vỉa hè phía Bắc, y 1344..1472)
  streetStall(s, -1000, 1408, z);
  umbrella(s, -1000, 1408, z);
  foodCart(s, -400, 1408, z, 'x', 'bm');
  pushCart(s, 420, 1408, z, 'x', 'bt_veg');
  shoulderPole(s, 1000, 1400, z, 'x', 'bt_fruit');
  // Quảng trường phía Nam (vỉa hè y -1664..-1536)
  foodCart(s, -700, -1600, z, 'x', 'ht');
  streetStall(s, -540, -1600, z);
  umbrella(s, -540, -1600, z);
  shoulderPole(s, 700, -1600, z, 'x', 'bt_veg');
  umbrella(s, 700, -1560, z);
  // Vỉa hè sát chợ
  shoulderPole(s, -1088, -400, z, 'y', 'bt_fruit');
  foodCart(s, 600, -768, z, 'x', 'bm');
  streetStall(s, -600, -768, z);
  // Xe kẹo bông (quảng trường) + xe cà phê cóc có ghế (vỉa hè sát chợ)
  foodCart(s, -260, -1600, z, 'x', 'kb');
  foodCart(s, -820, -768, z, 'x', 'cf');
  streetStall(s, -960, -768, z);

  // Hàng xe máy đậu, đầu xe quay vào nhà, kèm biển GIỮ XE
  bikeRow(s, -1496, -980, z, 'x', -1, 6, 0);
  bikeRow(s, -1496, 680, z, 'x', -1, 6, 2);
  bikeRow(s, 1496, -900, z, 'x', 1, 6, 1);
  bikeRow(s, 1496, 600, z, 'x', 1, 6, 3);
  bikeRow(s, -800, 1438, z, 'y', 1, 6, 4);
  bikeRow(s, 640, 1438, z, 'y', 1, 6, 5);
  bikeRow(s, 200, -1630, z, 'y', -1, 6, 2);
  standSign(s, -1440, -1010, z, [1, 0, 0], 'bt_sign_giuxe', 64, 16);
  standSign(s, 1440, -930, z, [-1, 0, 0], 'bt_sign_giuxe', 64, 16);
  standSign(s, -830, 1380, z, [0, -1, 0], 'bt_sign_giuxe', 64, 16);
  standSign(s, 170, -1580, z, [0, 1, 0], 'bt_sign_giuxe', 64, 16);
  // Biển CẤM ĐẬU XE đứng trước vài cửa nhà
  standSign(s, -1440, -1300, z, [1, 0, 0], 'bt_noparking', 24, 24);
  standSign(s, 1440, 150, z, [-1, 0, 0], 'bt_noparking', 24, 24);
  standSign(s, -200, 1380, z, [0, -1, 0], 'bt_noparking', 24, 24);

  // Cột điện bê tông ở đầu các đường dây vắt ngang phố (quảng cáo RÚT HẦM CẦU nhìn ra đường)
  utilityPole(s, -1424, -640, z, [1, 0, 0]);
  utilityPole(s, -1424, 704, z, [1, 0, 0]);
  utilityPole(s, 1424, -256, z, [-1, 0, 0]);
  utilityPole(s, 1424, 512, z, [-1, 0, 0]);
  utilityPole(s, -640, 1360, z, [0, -1, 0]);
  utilityPole(s, 448, 1360, z, [0, -1, 0]);

  // Xe ba gác chở hàng đỗ dưới lòng đường (chỗ nấp)
  baGac(s, 1290, -40, 0, 'y', 1);
  baGac(s, -1300, -150, 0, 'y', -1);
  baGac(s, 200, 1300, 0, 'x', 1);

  // Dây điện vắt ngang phố (không va chạm)
  const wires = illusion;
  const wireX = (y: number, xa: number, xb: number) => wires.push(aligned(box([xa, y, 300], [xb, y + 2, 364], '{bt_wires'), [xa, y, 364]));
  const wireY = (x: number, ya: number, yb: number) => wires.push(aligned(box([x, ya, 300], [x + 2, yb, 364], '{bt_wires'), [x, ya, 364]));
  wireX(-640, ROWS.west, HALL.x0);
  wireX(704, ROWS.west, HALL.x0);
  wireX(-256, HALL.x1, ROWS.east);
  wireX(512, HALL.x1, ROWS.east);
  wireY(-640, HALL.y1, ROWS.north);
  wireY(448, HALL.y1, ROWS.north);
}

// ---------------------------------------------------------------- spawn, rescue, ánh sáng
function gameplay() {
  for (const side of [-1, 1]) for (const x of [416, 512, 608, 704, 800]) point('info_player_start', [side * x, -1260, 36], { angle: '90' });
  for (const y of [864, 928]) for (const x of [-896, -768, -640, -512, -384]) point('info_player_deathmatch', [x, y, BASE + 36], { angle: '270' });
  for (const o of [[0, -1480, 36], [-640, -1080, 36], [640, -1080, 36]] as V3[]) point('info_hostage_rescue', o);
  point('light_environment', [0, 0, 900], { angles: '-50 225 0', pitch: '-50', _light: '255 236 200 300', _diffuse_light: '170 195 235 70' });
}

/** Gợi ý cho waypoint bot: 4 cửa + giao lộ trong chợ, chỗ T giữ con tin, chỗ CT canh. Toạ độ = mặt sàn. */
export const WAYPOINT_HINTS: WaypointHints = {
  crossings: [[0, -688, BASE], [0, 1008, BASE], [1008, 160, BASE], [-1008, 160, BASE], [0, 160, BASE], [0, -900, 0], [-1280, 160, 0], [1344, 96, 0], [0, 1248, 0]],
  points: [[-1776, -424, BASE], [464, 376, BASE]],
  camps: [
    { at: [480, 700, BASE + 160], team: 'T', look: [[464, 400], [160, 660]] },
    { at: [-120, 900, BASE], team: 'T', look: [[0, -600], [0, 160]] },
    { at: [900, 320, BASE], team: 'T', look: [[1024, 160], [500, 160]] },
    { at: [-1504, 160, BASE + 160], team: 'CT', look: [[-1024, 160], [-1024, 700]] },
    { at: [320, -780, BASE], team: 'CT', look: [[0, -688], [600, -760]] },
  ],
};

export function benThanhMap(wads: string): Entity[] {
  world.length = 0;
  detail.length = 0;
  ents.length = 0;
  masked.length = 0;
  props.length = 0;
  illusion.length = 0;
  houseNo = 0;
  shellAndGround();
  hall();
  clockTower();
  stalls();
  mezzanine();
  enterableHouse();
  streets();
  gameplay();
  return [
    {
      props: { classname: 'worldspawn', mapversion: '220', wad: wads, skyname: 'city1', message: 'Cho Ben Thanh', _minlight: '0.05' },
      brushes: world,
    },
    { props: { classname: 'func_detail', zhlt_detaillevel: '1' }, brushes: detail },
    { props: { classname: 'func_wall', zhlt_lightflags: '2' }, brushes: props },
    { props: { classname: 'func_wall', rendermode: '4', renderamt: '255' }, brushes: masked },
    { props: { classname: 'func_illusionary', rendermode: '4', renderamt: '255' }, brushes: illusion },
    ...ents,
  ];
}
