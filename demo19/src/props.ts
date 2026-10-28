// Đồ vật đường phố Việt Nam dựng bằng brush: xe hủ tiếu / bánh mì / nước mía, xe đẩy trái cây, gánh hàng rong,
// ô dù, quán cóc. Toạ độ cục bộ: u dọc trục dài của món đồ, v ngang, z từ mặt đất `z0`.
import { aligned, alignedPlate, box, octagon, prism, pyramid, type Brush, type V2, type V3 } from './brush.ts';

export interface PropSink {
  solid: Brush[];
  /** Brush texture trong suốt ('{'), phải đặt vào func_wall rendermode 4. */
  masked: Brush[];
}
export type Along = 'x' | 'y';

/** `dir` = -1 lật hướng u (đầu xe quay về phía ngược lại). */
function local(x: number, y: number, along: Along, dir: 1 | -1 = 1) {
  const at = (u: number, v: number): V2 => (along === 'x' ? [x + u * dir, y + v] : [x + v, y + u * dir]);
  const b = (u0: number, u1: number, v0: number, v1: number, z0: number, z1: number): [V3, V3] => {
    const p = at(u0, v0);
    const q = at(u1, v1);
    return [
      [Math.min(p[0], q[0]), Math.min(p[1], q[1]), z0],
      [Math.max(p[0], q[0]), Math.max(p[1], q[1]), z1],
    ];
  };
  /** Bánh xe: đĩa bát giác đứng, trục ngang theo v, tâm (u, zc). */
  const wheel = (u: number, v0: number, v1: number, zc: number, r: number, tex: string): Brush => {
    const c = at(u, 0);
    return along === 'x' ? prism(octagon(c[0], zc, r), 'y', y + v0, y + v1, tex) : prism(octagon(c[1], zc, r), 'x', x + v0, x + v1, tex);
  };
  return { at, b, wheel };
}

const PANELS = {
  ht: ['bt_cart_ht', '{bt_glass_ht'],
  bm: ['bt_cart_bm', '{bt_glass_bm'],
  nm: ['bt_cart_nm', '{bt_glass_bm'],
  kb: ['bt_cart_kb', '{bt_glass_kb'],
  cf: ['bt_cart_cf', '{bt_glass_cf'],
} as const;

/** Xe hàng có tủ kính + mái che + 2 bánh (hủ tiếu, bánh mì, nước mía). Dài 96, rộng 40, cao 116. */
export function foodCart(s: PropSink, x: number, y: number, z0: number, along: Along, kind: keyof typeof PANELS) {
  const { b, wheel } = local(x, y, along);
  const [panel, glass] = PANELS[kind];
  // Thân xe cao đúng 48 = 1 lần texture (128x64 * 0.75) nên chữ nằm trọn trên cả 2 mặt dài
  const [bmin, bmax] = b(-48, 48, -20, 20, z0 + 12, z0 + 60);
  s.solid.push(aligned(box(bmin, bmax, { side: panel, top: 'bt_steel', bottom: 'bt_wood' }), [bmin[0], bmin[1], bmax[2]]));
  const [gmin, gmax] = b(-4, 44, -18, 18, z0 + 60, z0 + 108);
  s.masked.push(aligned(box(gmin, gmax, glass), [gmin[0], gmin[1], gmax[2]]));
  if (kind === 'ht') {
    const c = local(x, y, along).at(-26, 0);
    s.solid.push(prism(octagon(c[0], c[1], 14), 'z', z0 + 60, z0 + 84, 'bt_steel'));
  } else if (kind === 'nm') {
    s.solid.push(box(...b(-44, -12, -14, 14, z0 + 60, z0 + 92), 'bt_steel'));
  }
  for (const [u, v] of [[-50, -22], [46, -22], [-50, 18], [46, 18]]) s.solid.push(box(...b(u, u + 4, v, v + 4, z0 + 60, z0 + 112), 'bt_rust'));
  s.solid.push(box(...b(-54, 54, -26, 26, z0 + 112, z0 + 116), { side: 'bt_tin', top: 'bt_tin', bottom: 'bt_tin' }));
  s.solid.push(wheel(20, -27, -22, z0 + 20, 20, 'bt_tire'));
  s.solid.push(wheel(20, 22, 27, z0 + 20, 20, 'bt_tire'));
  s.solid.push(box(...b(-44, -38, -4, 4, z0, z0 + 12), 'bt_rust'));
  s.solid.push(box(...b(-68, -48, -18, 18, z0 + 50, z0 + 54), 'bt_rust'));
}

/** Xe đẩy trái cây: sàn gỗ, thúng trái cây, 2 bánh, tay đẩy. Dài 80, rộng 40. */
export function pushCart(s: PropSink, x: number, y: number, z0: number, along: Along, goods: 'bt_fruit' | 'bt_veg' = 'bt_fruit') {
  const { b, wheel } = local(x, y, along);
  s.solid.push(box(...b(-40, 40, -20, 20, z0 + 28, z0 + 34), 'bt_wood'));
  s.solid.push(box(...b(-36, 36, -16, 16, z0 + 34, z0 + 46), { side: 'bt_bamboo', top: goods }));
  s.solid.push(wheel(18, -25, -21, z0 + 14, 14, 'bt_tire'));
  s.solid.push(wheel(18, 21, 25, z0 + 14, 14, 'bt_tire'));
  s.solid.push(box(...b(-36, -32, -4, 4, z0, z0 + 28), 'bt_rust'));
  s.solid.push(box(...b(-58, -40, -16, 16, z0 + 40, z0 + 44), 'bt_rust'));
}

/** Gánh hàng rong: 2 thúng tre + dây + đòn gánh, cái nón lá đặt cạnh. */
export function shoulderPole(s: PropSink, x: number, y: number, z0: number, along: Along, goods: 'bt_fruit' | 'bt_veg' = 'bt_veg') {
  const { at, b } = local(x, y, along);
  for (const u of [-36, 36]) {
    const c = at(u, 0);
    s.solid.push(prism(octagon(c[0], c[1], 14), 'z', z0, z0 + 16, { side: 'bt_bamboo', top: goods, bottom: 'bt_bamboo' }));
    for (const v of [-11, 9]) s.solid.push(box(...b(u - 1, u + 1, v, v + 2, z0 + 16, z0 + 44), 'bt_bamboo'));
  }
  s.solid.push(box(...b(-52, 52, -1, 1, z0 + 44, z0 + 47), 'bt_bamboo'));
  const n = at(0, 26);
  s.solid.push(pyramid(octagon(n[0], n[1], 15), z0, [n[0], n[1], z0 + 11], 'bt_nonla'));
}

/** Ô dù che bán hàng: cột + tán hình nón (cao 112, người chơi đi lọt dưới tán). */
export function umbrella(s: PropSink, x: number, y: number, z0: number) {
  s.solid.push(box([x - 2, y - 2, z0], [x + 2, y + 2, z0 + 96], 'bt_steel'));
  s.solid.push(pyramid(octagon(x, y, 56), z0 + 92, [x, y, z0 + 114], 'bt_umbrella'));
}

/** Quán cóc: bàn nhựa thấp + 4 ghế đỏ / xanh. */
export function streetStall(s: PropSink, x: number, y: number, z0: number) {
  s.solid.push(box([x - 2, y - 2, z0], [x + 2, y + 2, z0 + 20], 'bt_plastic_b'));
  s.solid.push(box([x - 16, y - 16, z0 + 20], [x + 16, y + 16, z0 + 24], 'bt_plastic_b'));
  for (const [dx, dy, i] of [[-30, 0, 0], [30, 0, 1], [0, -30, 2], [0, 30, 3]]) {
    s.solid.push(box([x + dx - 7, y + dy - 7, z0], [x + dx + 7, y + dy + 7, z0 + 16], i % 2 ? 'bt_plastic_b' : 'bt_plastic_r'));
  }
}

const BIKE_COLORS = ['bt_plastic_r', 'bt_plastic_b', 'bt_steel', 'bt_tire', 'bt_plastic_r', 'bt_steel'];

/** Xe máy số dáng Dream/Wave: dài ~68, cao ~47. `dir` = hướng đầu xe theo trục `along`. */
export function motorbike(s: PropSink, x: number, y: number, z0: number, along: Along, dir: 1 | -1, color: string) {
  const { b, wheel } = local(x, y, along, dir);
  s.solid.push(wheel(-26, -2, 2, z0 + 11, 11, 'bt_tire'));
  s.solid.push(wheel(27, -2, 2, z0 + 11, 11, 'bt_tire'));
  s.solid.push(box(...b(-14, 14, -5, 5, z0 + 12, z0 + 22), 'bt_steel')); // máy
  s.solid.push(box(...b(-24, 2, -7, 7, z0 + 22, z0 + 32), color)); // ốp hông
  s.solid.push(box(...b(-26, 4, -6, 6, z0 + 32, z0 + 37), 'bt_tire')); // yên
  s.solid.push(box(...b(-34, -24, -5, 5, z0 + 26, z0 + 32), color)); // đuôi
  s.solid.push(box(...b(10, 20, -8, 8, z0 + 16, z0 + 40), color)); // yếm
  s.solid.push(box(...b(23, 26, -2, 2, z0 + 11, z0 + 42), 'bt_steel')); // phuộc
  s.solid.push(box(...b(18, 30, -6, 6, z0 + 40, z0 + 47), color)); // đầu đèn
  s.solid.push(box(...b(21, 24, -14, 14, z0 + 44, z0 + 46), 'bt_steel')); // ghi đông
}

/** Hàng xe máy đậu sát nhau, đầu xe quay vào nhà. Xe thứ i lệch nhau 24 unit dọc vỉa hè. */
export function bikeRow(s: PropSink, x: number, y: number, z0: number, along: Along, dir: 1 | -1, count: number, seed = 0) {
  for (let i = 0; i < count; i++) {
    const c = BIKE_COLORS[(i + seed) % BIKE_COLORS.length];
    const jitter = ((i * 7 + seed) % 3) * 3 - 3; // xe đậu không thẳng hàng tuyệt đối
    if (along === 'x') motorbike(s, x + jitter * dir, y + i * 24, z0, 'x', dir, c);
    else motorbike(s, x + i * 24, y + jitter * dir, z0, 'y', dir, c);
  }
}

/** Biển đứng 2 mặt (chữ đọc xuôi ở cả 2 phía): cột + 2 tấm áp lưng nhau. */
export function standSign(s: PropSink, x: number, y: number, z0: number, facingNormal: V3, tex: string, w: number, h: number) {
  const ax = Math.abs(facingNormal[0]) > 0.5; // mặt biển vuông góc trục X
  s.solid.push(box([x - 1, y - 1, z0], [x + 1, y + 1, z0 + 56], 'bt_steel'));
  const lo = (d: number): [V3, V3] =>
    ax ? [[x + d, y - w / 2, z0 + 56], [x + d + 1, y + w / 2, z0 + 56 + h]] : [[x - w / 2, y + d, z0 + 56], [x + w / 2, y + d + 1, z0 + 56 + h]];
  const back: V3 = [-facingNormal[0], -facingNormal[1], 0];
  const front = ax ? (facingNormal[0] > 0 ? 1 : -2) : facingNormal[1] > 0 ? 1 : -2;
  s.solid.push(alignedPlate(...lo(front), tex, facingNormal));
  s.solid.push(alignedPlate(...lo(front === 1 ? 0 : -1), tex, back));
}

/** Cột điện bê tông: cột vuông 16, xà ngang, sứ cách điện, hộp công tơ, quảng cáo dán ở mặt nhìn ra đường. */
export function utilityPole(s: PropSink, x: number, y: number, z0: number, road: V3) {
  s.solid.push(box([x - 8, y - 8, z0], [x + 8, y + 8, z0 + 392], 'bt_curb'));
  const alongX = Math.abs(road[0]) > 0.5; // xà ngang chạy song song đường dây (cùng hướng ra đường)
  s.solid.push(box(alongX ? [x - 40, y - 3, z0 + 352] : [x - 3, y - 40, z0 + 352], alongX ? [x + 40, y + 3, z0 + 360] : [x + 3, y + 40, z0 + 360], 'bt_rust'));
  for (const k of [-32, 0, 32]) {
    const [ix, iy] = alongX ? [x + k, y] : [x, y + k];
    s.solid.push(box([ix - 2, iy - 2, z0 + 360], [ix + 2, iy + 2, z0 + 370], 'bt_trim'));
  }
  // Quảng cáo trên mặt hướng ra đường (16 x 32) + hộp công tơ ở mặt bên
  const fx = x + road[0] * 8;
  const fy = y + road[1] * 8;
  const adMin: V3 = alongX ? [Math.min(fx, fx + road[0]), y - 8, z0 + 56] : [x - 8, Math.min(fy, fy + road[1]), z0 + 56];
  const adMax: V3 = alongX ? [Math.max(fx, fx + road[0]), y + 8, z0 + 88] : [x + 8, Math.max(fy, fy + road[1]), z0 + 88];
  s.solid.push(alignedPlate(adMin, adMax, 'bt_pole_ads', road));
  const side: V3 = [-road[1], road[0], 0];
  const mx = x + side[0] * 13;
  const my = y + side[1] * 13;
  const sx = Math.abs(side[0]) > 0.5;
  s.solid.push(box([sx ? mx - 5 : x - 8, sx ? y - 8 : my - 5, z0 + 120], [sx ? mx + 5 : x + 8, sx ? y + 8 : my + 5, z0 + 144], 'bt_steel'));
}

/** Xe ba gác máy chở hàng: đầu xe máy + thùng gỗ sau có bao tải, thùng carton. Dài ~120, rộng ~62. */
export function baGac(s: PropSink, x: number, y: number, z0: number, along: Along, dir: 1 | -1) {
  const { b, wheel } = local(x, y, along, dir);
  s.solid.push(box(...b(-64, 8, -26, 26, z0 + 22, z0 + 28), 'bt_wood'));
  s.solid.push(box(...b(-64, 8, -26, -23, z0 + 28, z0 + 44), 'bt_wood'));
  s.solid.push(box(...b(-64, 8, 23, 26, z0 + 28, z0 + 44), 'bt_wood'));
  s.solid.push(box(...b(-64, -61, -23, 23, z0 + 28, z0 + 44), 'bt_wood'));
  s.solid.push(wheel(-30, -31, -27, z0 + 13, 13, 'bt_tire'));
  s.solid.push(wheel(-30, 27, 31, z0 + 13, 13, 'bt_tire'));
  s.solid.push(box(...b(8, 30, -4, 4, z0 + 18, z0 + 28), 'bt_rust'));
  s.solid.push(box(...b(20, 40, -7, 7, z0 + 20, z0 + 32), 'bt_plastic_b'));
  s.solid.push(box(...b(14, 34, -6, 6, z0 + 32, z0 + 37), 'bt_tire'));
  s.solid.push(wheel(50, -2, 2, z0 + 11, 11, 'bt_tire'));
  s.solid.push(box(...b(46, 49, -2, 2, z0 + 11, z0 + 42), 'bt_steel'));
  s.solid.push(box(...b(42, 54, -6, 6, z0 + 40, z0 + 47), 'bt_plastic_b'));
  s.solid.push(box(...b(44, 47, -14, 14, z0 + 44, z0 + 46), 'bt_steel'));
  // Hàng: 3 bao tải nằm + 2 thùng carton chồng
  for (const [u, v] of [[-58, -20], [-58, 2], [-34, -20]]) s.solid.push(box(...b(u, u + 22, v, v + 18, z0 + 28, z0 + 42), 'bt_sack'));
  s.solid.push(box(...b(-30, -6, 0, 22, z0 + 28, z0 + 52), 'bt_cardboard'));
  s.solid.push(box(...b(-28, -8, 2, 20, z0 + 52, z0 + 70), 'bt_cardboard'));
}
