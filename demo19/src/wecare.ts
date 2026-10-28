// cs_wecare: khu xưởng Wecare (Quy Nhơn Bắc), layout v8 trong PLAN-cs_wecare.md. Trục: X = Đông, Y = Bắc, Z = lên. 1 m ~ 40 unit.
//
//        kho bên cạnh (cảnh nền)          | dãy xưởng vàng (cảnh nền)
//   CT  [CỔNG]==== đường nội bộ, mái tôn lớn (lane AWP) ===========> xe nâng
//  spawn | nhà VP |  sân  | khu soạn hàng (lưới che)       | phòng KT |
//  đường |        |  nhà  |hẻm| kho T: kệ, bạt cam, bao tải | PHÒNG HỌP| xưởng
//  Trung | nhà xe |  xe   |   |                            | con tin  | phía Đông
//  Tâm   |---- dãy WC ----|---- T spawn: hành lang ống nhựa xanh -----|
import { alignedPlate, box, octagon, prism, pyramid, type Brush, type Entity, type TexSel, type V2, type V3 } from './brush.ts';
import { TEXTURES as TEX } from './textures.ts';
import type { WaypointHints } from './waypoints.ts';
import { WC_TEXTURES } from './wecare-textures.ts';

export const TEXTURES = [...TEX, ...WC_TEXTURES];
export const TITLE = [
  'Wecare - Hostage Rescue',
  '',
  'Terrorists giu 4 con tin trong phong hop',
  'cua kho hang khu xuong Wecare.',
  '',
  'Counter-Terrorists: vao qua cong chinh,',
  'di duong noi bo, khu soan hang hoac',
  'vong qua nha xe - day WC - hem,',
  'dua con tin ra duong Trung Tam.',
  '',
  'Map: demo19 game-r (sinh bang script)',
].join('\n');

// ---- Kích thước chính ----
const EDGE = { x0: -2272, x1: 1536, y0: -2304, y1: 1408 }; // mép trong vỏ trời (Nam nới cho núi + tượng đài; Bắc + Tây nới cho khu CT spawn)
export const BOUNDS = EDGE;
const SKY_TOP = 1216;
const FENCE = { x0: -1488, x1: -1472, h: 128 }; // tường rào vàng phía Tây (dời ra 2 lần cho nhà xe rộng: 224 rồi 160)
const GATE = { y0: 176, y1: 544 }; // cổng chính rộng ~9 m, gần hết bề ngang đường nội bộ
const ROAD = { y0: 160, y1: 560 }; // đường nội bộ dưới mái tôn lớn
const FACADE_Y = 568; // mặt tiền kho bên cạnh + dãy xưởng vàng
const FRONT = { y0: -160, y1: 160 }; // dải khu soạn hàng + phòng KT
const SOAN = { x0: -560, x1: 700 };
const KT = { x0: 700, x1: 1100 };
const ROAD_END = KT.x1; // tường chặn cuối đường nội bộ, ngang vách Đông phòng KT + kho
const KHO = { x0: -440, x1: 1100, y0: -760, y1: -160, h: 400 };
const HEM = { x0: -560, x1: -440 };
const ROOMS = { x0: 700, y0: KHO.y0 + 16, mid: -420, y1: KHO.y1 - 16, h: 288 }; // phòng IT (Nam) + phòng họp (Bắc) sát vách, dựa tường Đông kho
const BACK = { y0: -1040, y1: -760 }; // hành lang sau: dãy WC + T spawn
const TBACK = -948; // mép Nam hành lang T spawn (hẹp 2/3 so với đoạn WC)
const BASE = 0; // sàn khu soạn hàng + phòng KT ngang mặt sân
const KB = BASE + 48; // sàn kho cao hơn khu soạn hàng 3 bậc (như kho thật)
const T = 16; // độ dày tường

const world: Brush[] = [];
const detail: Brush[] = []; // func_detail: biển, cửa giả, ô cửa sổ dán tường
const props: Brush[] = []; // đồ vật (chỗ nấp): 1 func_wall riêng
const masked: Brush[] = []; // texture trong suốt có va chạm: lưới che, lưới rào
const illusion: Brush[] = []; // tán cây: trong suốt, không va chạm
const glass: Brush[] = []; // kính bắn vỡ được: mỗi tấm 1 func_breakable
const frosted: Brush[] = []; // kính mờ không vỡ: func_wall bán trong suốt
const ents: Entity[] = [];
const W = (b: Brush) => world.push(b);
const D = (b: Brush) => detail.push(b);
const P = (b: Brush) => props.push(b);
const point = (classname: string, o: V3, extra: Record<string, string> = {}) => ents.push({ props: { classname, origin: o.join(' '), ...extra } });
/** Đèn; có `targetname` thì công tắc (func_button) bật / tắt được, SDHLT tự cấp style riêng. */
const light = (o: V3, rgbBright: string, targetname?: string) => point('light', o, { _light: rgbBright, ...(targetname ? { targetname } : {}) });

/** Tường dọc trục X (dày theo Y) có lỗ cửa [a, b) từ chân `z0` tới `top`. */
function wallX(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, holes: { a: number; b: number; top: number; bottom?: number }[], tex: TexSel) {
  let x = x0;
  for (const h of [...holes].sort((p, q) => p.a - q.a)) {
    if (h.a > x) W(box([x, y0, z0], [h.a, y1, z1], tex));
    if (h.bottom !== undefined && h.bottom > z0) W(box([h.a, y0, z0], [h.b, y1, h.bottom], tex));
    if (h.top < z1) W(box([h.a, y0, h.top], [h.b, y1, z1], tex));
    x = h.b;
  }
  if (x < x1) W(box([x, y0, z0], [x1, y1, z1], tex));
}

/** Tường dọc trục Y (dày theo X), lỗ cửa theo Y. */
function wallY(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, holes: { a: number; b: number; top: number; bottom?: number }[], tex: TexSel) {
  let y = y0;
  for (const h of [...holes].sort((p, q) => p.a - q.a)) {
    if (h.a > y) W(box([x0, y, z0], [x1, h.a, z1], tex));
    if (h.bottom !== undefined && h.bottom > z0) W(box([x0, h.a, z0], [x1, h.b, h.bottom], tex));
    if (h.top < z1) W(box([x0, h.a, h.top], [x1, h.b, z1], tex));
    y = h.b;
  }
  if (y < y1) W(box([x0, y, z0], [x1, y1, z1], tex));
}

/** Tấm dán lên mặt đứng (biển, cửa giả, ô cửa sổ): `n` là pháp tuyến của mặt tường, tấm nhô ra 4 unit. */
function plate(a0: number, a1: number, z0: number, z1: number, face: number, n: V3, tex: string) {
  const d = 4;
  if (n[1] !== 0) {
    const y0 = n[1] > 0 ? face : face - d;
    D(alignedPlate([a0, y0, z0], [a1, y0 + d, z1], tex, n));
  } else {
    const x0 = n[0] > 0 ? face : face - d;
    D(alignedPlate([x0, a0, z0], [x0 + d, a1, z1], tex, n));
  }
}

// ---------------------------------------------------------------- vỏ trời, nền, tường rào, cổng
function shellAndGround() {
  const t = 32;
  const { x0, x1, y0, y1 } = EDGE;
  W(box([x0 - t, y0 - t, SKY_TOP], [x1 + t, y1 + t, SKY_TOP + t], 'sky'));
  W(box([x0 - t, y0 - t, -32], [x0, y1 + t, SKY_TOP], 'sky'));
  W(box([x1, y0 - t, -32], [x1 + t, y1 + t, SKY_TOP], 'sky'));
  W(box([x0, y0 - t, -32], [x1, y0, SKY_TOP], 'sky'));
  W(box([x0, y1, -32], [x1, y1 + t, SKY_TOP], 'sky'));
  // Nền: đường nhựa Trung Tâm, vạt đất trước cổng, sân bê tông, đường nội bộ đá dăm phía Đông
  W(box([x0, y0, -32], [-1984, y1, 0], { side: 'bt_curb', top: 'bt_grass' })); // dải cỏ bên kia đường
  W(box([-1984, y0, -32], [-1684, y1, 0], { side: 'bt_curb', top: 'bt_road' }));
  W(box([-1684, y0, -32], [FENCE.x0, y1, 0], { side: 'bt_curb', top: 'wc_dirt' }));
  // Đường nội bộ đá dăm chạy suốt từ cổng tới cuối đường, 2 bên sân bê tông
  W(box([FENCE.x0, ROAD.y0, -32], [x1, ROAD.y1, 0], { side: 'bt_curb', top: 'wc_gravel' }));
  W(box([FENCE.x0, y0, -32], [x1, ROAD.y0, 0], { side: 'bt_curb', top: 'wc_concrete' }));
  W(box([FENCE.x0, ROAD.y1, -32], [x1, y1, 0], { side: 'bt_curb', top: 'wc_concrete' }));

  // Tường rào vàng: phía Tây có cổng, phía Nam (sau WC + T spawn)
  const fence = { side: 'wc_wall_yl', top: 'wc_wall_old' };
  W(box([FENCE.x0, BACK.y0 - T, 0], [FENCE.x1, GATE.y0 - 48, FENCE.h], fence));
  W(box([FENCE.x0, GATE.y1 + 48, 0], [FENCE.x1, y1, FENCE.h], fence));
  // CLIP vô hình trên đỉnh tường rào tới 280: đứng trên nóc xe tải / tán cây cũng không nhảy vào được (cổng vẫn mở)
  W(box([FENCE.x0, BACK.y0 - T, FENCE.h], [FENCE.x1, GATE.y0 - 48, 280], 'CLIP'));
  W(box([FENCE.x0, GATE.y1 + 48, FENCE.h], [FENCE.x1, y1, 280], 'CLIP'));
  W(box([FENCE.x0, BACK.y0 - T, 0], [KHO.x1, BACK.y0, 128], { side: 'wc_wall_old', top: 'wc_wall_old' }));
  // Đoạn T spawn: khối tường đặc đẩy mép Nam vào TBACK, lưới B40 + CLIP trên đỉnh
  W(box([KHO.x0 + 12, BACK.y0 - T, 0], [KHO.x1, TBACK, 128], { side: 'wc_wall_old', top: 'wc_wall_old' }));
  masked.push(box([KHO.x0, TBACK - 8, 128], [KHO.x1, TBACK - 4, 224], '{wc_mesh'));
  W(box([KHO.x0 + 12, TBACK - 8, 128], [KHO.x1, TBACK, 400], 'CLIP'));
  // Trụ cổng kem + cánh cổng trượt đã kéo vào sát tường rào
  for (const [ya, yb] of [[GATE.y0 - 48, GATE.y0], [GATE.y1, GATE.y1 + 48]]) W(box([FENCE.x0 - 16, ya, 0], [FENCE.x1 + 16, yb, 136], { side: 'wc_wall_old', top: 'wc_wall_wh' }));
  // Cổng xếp inox tự động đang mở: bó thanh xếp gọn sát trụ Bắc, đầu cổng hộp mô tơ trơn, ray mảnh băng ngang lối vào
  P(box([FENCE.x0 - 4, GATE.y1 - 40, 0], [FENCE.x1 + 4, GATE.y1, 64], { side: 'wc_gate_fold', top: 'bt_steel' }));
  P(box([FENCE.x0 - 12, GATE.y1 - 56, 0], [FENCE.x1 + 12, GATE.y1 - 40, 80], 'bt_steel'));
  D(box([FENCE.x0 + 4, GATE.y0, 0], [FENCE.x1 - 4, GATE.y1 - 56, 1], 'bt_steel'));
  // Bảng hiệu Wecare trên tường rào bên trái cổng (nhìn từ đường vào)
  plate(792, 920, 24, 88, FENCE.x0, [-1, 0, 0], 'wc_sign_main');
}

// ---------------------------------------------------------------- cảnh nền phía Bắc + Đông
function backdrops() {
  // Kho bên cạnh: tôn rỉ, 2 cửa lớn tối, biển cấm + biển cổng xuất hàng.
  // Đầu Tây lùi vào chừa hành lang mái tôn để 1 dãy xe máy dọc tường rào, cuối hành lang bịt bằng khối kho phía sau.
  const LANE = { x1: -1248, y1: FACADE_Y + 416 };
  W(box([LANE.x1, FACADE_Y, 0], [KT.x0, EDGE.y1, 416], { side: 'wc_tin_rust', top: 'wc_tin_rust' }));
  W(box([FENCE.x1, LANE.y1, 0], [LANE.x1, EDGE.y1, 416], { side: 'wc_wall_yl', top: 'wc_tin_wh' })); // tường vàng cho khỏi lẫn với kho tôn rỉ
  W(box([FENCE.x1, FACADE_Y, 232], [LANE.x1, LANE.y1, 240], { side: 'wc_tin_wh', top: 'wc_tin_wh', bottom: 'wc_tin_wh' }));
  bikes(LANE.x1 - 42, FACADE_Y + 30, 1, 10, 6);
  light([-1380, FACADE_Y + 200, 210], '255 236 205 100');
  const n: V3 = [0, -1, 0];
  plate(-640, -416, 0, 288, FACADE_Y, n, 'wc_door_gy');
  plate(-120, 104, 0, 288, FACADE_Y, n, 'wc_door_gy');
  plate(-800, -672, 96, 128, FACADE_Y, n, 'wc_sign_vpsmv');
  plate(-592, -464, 300, 332, FACADE_Y, n, 'wc_sign_xh'); // trên cửa 1 (cổng xuất)
  plate(-72, 56, 300, 332, FACADE_Y, n, 'wc_sign_nh'); // trên cửa 2 (cổng nhập)
  plate(-200, -168, 64, 112, FACADE_Y, n, 'wc_paper');
  for (const x of [-1184, -960, 240, 480]) plate(x, x + 64, 200, 264, FACADE_Y, n, 'wc_louvre');
  // Dãy xưởng vàng phía Đông Bắc + khối xưởng chặn cuối đường
  W(box([KT.x0, FACADE_Y, 0], [EDGE.x1, EDGE.y1, 352], { side: 'wc_wall_yl', top: 'wc_tin_wh' }));
  for (let x = 760; x < ROAD_END - 64; x += 160) plate(x, x + 64, 176, 240, FACADE_Y, n, 'wc_louvre');
  plate(880, 976, 0, 192, FACADE_Y, n, 'wc_dark');
  W(box([ROAD_END, ROAD.y0, 0], [EDGE.x1, FACADE_Y, 352], { side: 'wc_wall_yl', top: 'wc_tin_wh' }));
  plate(ROAD.y0 + 120, ROAD.y0 + 248, 0, 224, ROAD_END, [-1, 0, 0], 'wc_dark');
  // Khối xưởng phía Đông của kho (cao 416 để kín mép mái kho)
  W(box([KT.x1, BACK.y0 - T, 0], [EDGE.x1, ROAD.y0, 416], { side: 'wc_wall_yl', top: 'wc_tin_wh' }));
  // Mái tôn lớn xanh rêu che đường nội bộ, cột thép 2 bên
  W(box([-400, ROAD.y0, 448], [ROAD_END, ROAD.y1, 456], { side: 'wc_tin_green', top: 'wc_tin_green', bottom: 'wc_tin_green' }));
  for (const x of [-400, 120, 600, ROAD_END - 16]) // né cửa tối, biển, cửa nhà VP
    for (const y of [ROAD.y0 + 8, ROAD.y1 - 24]) P(box([x, y, 0], [x + 16, y + 16, 448], 'wc_steel_rust'));
  for (let x = -300; x < ROAD_END; x += 400) light([x, 360, 420], '255 240 215 170');
}

// ---------------------------------------------------------------- nhà xe, nhà VP, hẻm WC, phòng bảo vệ (phía Nam cổng)
//   Tây -> Đông: [nhà xe dọc tường rào] [nhà VP 2 tầng + nhà mái ngói phía sau] [hẻm nhỏ 128 unit xuống dãy WC]
const VP = { x0: -944, x1: -704, y0: -440, y1: FRONT.y0 }; // rộng 240; mặt trước ngang vách dãy nhà xám + kho
function westBuildings() {
  // Nhà VP 2 tầng: phòng làm việc tầng 2 có ban công nhìn ra đường nội bộ
  W(box([VP.x0, VP.y0, 0], [VP.x1, VP.y1, 288], { side: 'wc_wall_wh', top: 'bt_roof' }));
  W(box([VP.x0, KHO.y0, 0], [VP.x1, VP.y0, 288], { side: 'wc_wall_wh', top: 'bt_roof' })); // phần sau cùng dãy nhà VP
  // Mặt trước 2 tầng, nhìn từ đường vào: cửa chính bên trái (phía hẻm, tầng trệt lên 3 bậc), cửa sổ bên phải (phía nhà xe)
  plate(-772, -724, 24, 120, VP.y1, [0, 1, 0], 'wc_door');
  W(box([-788, VP.y1, 0], [-708, VP.y1 + 60, 8], { side: 'wc_wall_old', top: 'wc_concrete' }));
  W(box([-780, VP.y1, 8], [-716, VP.y1 + 40, 16], { side: 'wc_wall_old', top: 'wc_concrete' }));
  W(box([-776, VP.y1, 16], [-720, VP.y1 + 20, 24], { side: 'wc_wall_old', top: 'wc_concrete' }));
  plate(-922, -858, 48, 112, VP.y1, [0, 1, 0], 'wc_glasswin');
  // Bàn ăn cơm ngoài sân dưới cửa sổ tầng trệt: bàn đặt dọc (vuông góc mặt nhà), 2 băng ghế nhựa trắng có tựa 2 bên
  table(-908, VP.y1 + 16, 36, 96);
  plasticBench(-936, VP.y1 + 16, 96, 'w');
  plasticBench(-864, VP.y1 + 16, 96, 'e');
  for (const [x, y, tex] of [[-890, -128, 'wc_bottle'], [-882, -112, 'wc_bottle_am'], [-892, -70, 'wc_bottle']] as const) bottle(x, y, BASE + 40, tex);
  plate(-772, -724, 144, 240, VP.y1, [0, 1, 0], 'wc_door'); // cửa ra ban công
  plate(-922, -858, 160, 224, VP.y1, [0, 1, 0], 'wc_glasswin');
  P(box([VP.x0 + 12, VP.y1, 136], [VP.x1 - 12, VP.y1 + 56, 144], 'wc_wall_old'));
  masked.push(box([VP.x0 + 12, VP.y1 + 52, 144], [VP.x1 - 12, VP.y1 + 56, 184], '{bt_rail'));
  for (const x of [VP.x0 + 12, VP.x1 - 16]) masked.push(box([x, VP.y1, 144], [x + 4, VP.y1 + 52, 184], '{bt_rail'));
  // Mặt Đông nhìn ra hẻm: cửa sau (phía WC, cao hơn nền 24, không bậc), cửa sổ 2 tầng
  plate(-672, -624, 24, 120, VP.x1, [1, 0, 0], 'wc_door');
  for (const y of [-560, -400]) for (const z of [64, 176]) plate(y, y + 64, z, z + 64, VP.x1, [1, 0, 0], 'wc_louvre');
  light([-640, -300, 220], '255 222 175 90');
  // Phòng bảo vệ tường vàng sát cổng: cửa sổ nhìn ra cổng, cửa ra thềm gạch bông
  const BV = FENCE.x1 + 192; // mặt Đông phòng bảo vệ (rộng 192)
  W(box([FENCE.x1, -48, 0], [BV, GATE.y0 - 48, 160], { side: 'wc_wall_yl', top: 'bt_roof' }));
  W(box([BV, -48, 0], [BV + 44, GATE.y0 - 48, 8], { side: 'wc_wall_old', top: 'bt_gachbong' })); // thềm thấp chạy hết mặt nhà
  plate(62, 110, 8, 104, BV, [1, 0, 0], 'wc_door');
  plate(62, 110, 110, 122, BV, [1, 0, 0], 'wc_sign_bv');
  D(box([BV, -38, 70], [BV + 6, -14, 94], { side: 'wc_timeclock', top: 'bt_steel' })); // máy chấm công
  // Bồn rửa mặt + gương dựa tường rào phía Tây, mặt quay ra lối đi nhà xe; vách ốp cao hơn tường rào để treo gương
  W(box([FENCE.x1, -96, 0], [FENCE.x1 + 8, -48, 152], { side: 'wc_wall_wh', top: 'wc_wall_old' }));
  P(box([FENCE.x1 + 8, -80, 0], [FENCE.x1 + 24, -64, 32], 'wc_alu'));
  P(box([FENCE.x1 + 8, -88, 32], [FENCE.x1 + 40, -56, 40], 'wc_alu'));
  plate(-88, -56, 48, 96, FENCE.x1 + 8, [1, 0, 0], 'wc_mirror');
  plate(FENCE.x1 + 64, FENCE.x1 + 128, 64, 128, GATE.y0 - 48, [0, 1, 0], 'wc_glasswin'); // rộng đúng 64 như texture (hẹp hơn là mất khung) // 1 cửa sổ giữa mặt nhìn ra cổng
  // Nhà xe dọc tường rào (phía Tây nhà VP): 2 mái cùng bạt xám tối (khỏi trùng màu xe tải xanh), mái trước thấp hơn mái sau
  const batToi = { side: 'wc_bat_toi', top: 'wc_bat_toi', bottom: 'wc_bat_toi' };
  W(box([FENCE.x1, -300, 232], [VP.x0, VP.y1 + 16, 240], batToi)); // mép Bắc lố mặt trước nhà VP 16
  P(box([VP.x0 - 12, VP.y1 + 4, 0], [VP.x0, VP.y1 + 16, 232], 'wc_steel_rust')); // cột đỡ góc mái bạt, sát góc Tây Bắc nhà VP
  W(box([FENCE.x1, KHO.y0, 256], [VP.x0, -300, 264], batToi));
  for (const x of [-1380, -1008]) P(box([x, KHO.y0, 0], [x + 12, KHO.y0 + 12, 256], 'wc_steel_rust')); // 2 cột đỡ mép mái hiên nhà xe
  // 4 dãy xe máy: 1 dãy sát tường rào đầu xe hướng ra đường, 1 cặp quay lưng vào nhau ở giữa, 1 dãy sát vách nhà VP
  for (const [x, dir, seed] of [[-1412, -1, 4], [-1200, 1, 2], [-1122, -1, 5], [-984, 1, 3]] as const) {
    bikes(x, -720, dir, 7, seed); // #7
    bikes(x, -280, dir, 5, seed + 1);
  }
  for (const x of [-1200, -976]) {
    light([x, -560, 230], '255 236 205 110');
    light([x, -150, 210], '235 240 255 100');
  }
}

// ---------------------------------------------------------------- khu soạn hàng + phòng KT (dải trước kho)
function frontBand() {
  // Khu soạn hàng dùng luôn nền sân; phòng KT lát gạch (tấm mỏng 2 unit)
  W(box([KT.x0 + T, FRONT.y0, 0], [KT.x1, FRONT.y1, 2], { side: 'wc_wall_old', top: 'bt_terrazzo' }));
  // Mái hiên tôn trắng phủ cả khu soạn hàng + phòng KT, cột thép mép đường
  W(box([SOAN.x0 - T, FRONT.y0 - T, 320], [KT.x1, FRONT.y1, 328], { side: 'wc_tin_wh', top: 'wc_tin_wh', bottom: 'wc_tin_wh' }));
  for (const x of [SOAN.x0, -200, 200, 600 - 16]) P(box([x, FRONT.y1 - 16, BASE], [x + 16, FRONT.y1, 320], 'wc_steel_rust'));
  // #8 Lưới che xanh: kín mặt Tây (nhìn ra sân + cổng), treo từng tấm phía đường
  // Tấm lưới không va chạm + CLIP: chặn người, đạn vẫn xuyên qua
  // Lưới chỉ phủ từ y -80 lên phía đường; dải sát dãy nhà xám (y -160..-80) chừa lối ra hẻm WC
  illusion.push(box([SOAN.x0, -80, BASE], [SOAN.x0 + 4, FRONT.y1, 320], '{wc_net'));
  W(box([SOAN.x0, -80, BASE], [SOAN.x0 + 8, FRONT.y1, 320], 'CLIP'));
  for (const [a, b] of [[SOAN.x0 + 16, -360], [0, 200], [440, 620]]) illusion.push(box([a, FRONT.y1 - 6, 120], [b, FRONT.y1 - 2, 320], '{wc_net'));
  table(-500, 20, 96, 56);
  // Hàng linh kiện: kệ khay bu lông ốc vít sát tường kho, bàn soạn hàng có hộp bu lông, thùng BU LÔNG / ỐC VÍT trên pallet
  for (const [a, b] of [[-400, -200], [-180, -20]]) P(box([a, FRONT.y0, BASE], [b, FRONT.y0 + 36, BASE + 160], { side: 'wc_binrack', top: 'bt_steel' }));
  table(-360, -40, 120, 60);
  for (const x of [-230, -190]) P(box([x, 16, BASE], [x + 40, 56, BASE + 40], 'bt_wood')); // 2 bàn gỗ vuông đặc cao ~1 m giữa khu soạn hàng
  for (const [x, y] of [[-350, -30], [-326, -30], [-302, -26], [-270, -4], [-262, -30]]) P(box([x, y, BASE + 40], [x + 20, y + 16, BASE + 52], { side: 'bt_plastic_b', top: 'wc_bolts' }));
  cartonStack(-140, 90, 2, 2, 3, 'wc_box_bulong', BASE, true);
  cartonStack(-300, 100, 2, 1, 2, 'wc_box_ocvit');
  cartonStack(260, 90, 2, 2, 2, 'wc_box_ocvit', BASE, true);
  // #9 Bình nước 20L trên pallet, bao kraft, cân
  pallet(0, 60, BASE, 1);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) P(box([-30 + i * 22, 36 + j * 24, BASE + 8 + k * 40], [-8 + i * 22, 58 + j * 24, BASE + 48 + k * 40], 'wc_jug'));
  for (const [x, y] of [[60, 20], [92, 28], [70, 52]]) breakable('1', 20, () => P(box([x, y, BASE], [x + 28, y + 20, BASE + 40], 'bt_cardboard')));
  P(box([120, -40, BASE], [148, -12, BASE + 28], 'bt_plastic_b'));
  // #10 Đống đồ trùm bạt xanh dương
  P(box([450, 40, BASE], [570, 140, BASE + 48], 'wc_bat_xanh'));
  P(box([470, 60, BASE + 48], [550, 120, BASE + 76], 'wc_bat_xanh'));
  // #11 Thùng đá + chồng ghế nhựa 2 bên cửa chính phòng KT
  // 7 bình nước 20L tròn sát vách phòng KT (6 bình 2 x 3 + 1 bình chồng trên)
  for (const [x, y, z] of [[656, -146, 0], [682, -146, 0], [656, -120, 0], [682, -120, 0], [656, -94, 0], [682, -94, 0], [669, -120, 44]]) P(prism(octagon(x, y, 12), 'z', BASE + z, BASE + z + 44, { side: 'wc_jug', top: 'bt_plastic_b' }));
  P(box([650, 110, BASE], [682, 142, BASE + 64], { side: 'bt_plastic_r', top: 'bt_plastic_b' }));
  for (let x = -400; x < 700; x += 250) light([x, 0, 296], '255 240 220 140');

  // Phòng KT: vách trắng, chỉ 1 cửa chính khung nhôm mở ra khu soạn hàng
  const kt = { side: 'wc_wall_wh', top: 'wc_wall_wh' };
  wallY(KT.x0, KT.x0 + T, FRONT.y0, FRONT.y1, 0, 320, [{ a: -48, b: 48, top: 128 + BASE }], kt);
  for (const y of [-52, 48]) P(box([KT.x0 - 4, y, BASE], [KT.x0 + T + 4, y + 4, 128 + BASE], 'wc_alu'));
  P(box([KT.x0 - 4, -52, 128 + BASE], [KT.x0 + T + 4, 52, 132 + BASE], 'wc_alu'));
  // Cửa kính 2 cánh khung nhôm trắng (kính mỏng 2), mở sẵn ra ngoài phía khu soạn hàng sát 2 mép cửa + biển tên phòng
  for (const [y0, y1] of [[-48, -46], [46, 48]]) {
    glass.push(box([KT.x0 - 48, y0, BASE + 4], [KT.x0 - 4, y1, BASE + 124], 'wc_glass'));
    for (const z of [BASE, BASE + 124]) P(box([KT.x0 - 52, y0, z], [KT.x0 - 4, y1, z + 4], 'wc_alu'));
    P(box([KT.x0 - 52, y0, BASE + 4], [KT.x0 - 48, y1, BASE + 124], 'wc_alu'));
  }
  plate(-32, 32, 152, 168, KT.x0, [-1, 0, 0], 'wc_sign_kt');
  W(box([KT.x0 + T, FRONT.y1 - T, 0], [KT.x1, FRONT.y1, 320], kt));
  // 2 dãy bàn cách tường, lối đi giữa nhìn thẳng ra bảng trắng trên vách đối diện cửa; mỗi dãy 2 ghế mỗi bên
  for (const y of [48, -112]) {
    table(830, y, 170, 48); // lùi vào 30 cho rộng lối từ cửa xuống góc tủ lạnh
    for (const x of [842, 903, 964]) {
      chair(x, y - 28, 's'); // phía Nam bàn, lưng quay Nam
      chair(x, y + 52, 'n'); // phía Bắc bàn, lưng quay Bắc
    }
  }
  P(box([1040, -120, BASE], [1084, -40, BASE + 120], 'bt_steel')); // tủ hồ sơ
  plate(-32, 64, 64, 112, KT.x1, [-1, 0, 0], 'wc_whiteboard');
  P(box([800, FRONT.y1 - T - 16, 240], [896, FRONT.y1 - T, 276], { side: 'wc_ac_in', top: 'wc_alu' })); // máy lạnh
  P(box([720, -158, BASE], [752, -126, BASE + 80], { side: 'wc_fridge', top: 'wc_alu' })); // tủ lạnh góc Tây Nam
  // Góc nước cạnh cửa: bàn nhỏ, cây nước nóng lạnh + bình 20L, ly
  table(720, 96, 56, 44);
  // Cây nước thấp (thân 48) sát vách, ngay bên phải cửa nhìn từ trong phòng, sau cánh cửa kính phía Bắc
  waterCooler(KT.x0 + T + 2, 56, BASE);
  for (const y of [102, 112, 122]) P(box([756, y, BASE + 40], [762, y + 6, BASE + 48], 'wc_alu'));
  light([900, 0, 290], '230 240 255 150', 'den_kt');
  lightSwitch(KT.x0 + T, -68, BASE, 'den_kt'); // trong phòng, mép Nam cửa (mép Bắc có cây nước che)
}

// ---------------------------------------------------------------- kho T + phòng họp + phòng IT + hẻm
function warehouse() {
  // Sàn kho cao KB (hơn khu soạn hàng 2 bậc); bậc lên ở cửa lớn phía Bắc + cửa ra T spawn phía Nam
  W(box([KHO.x0, KHO.y0, 0], [KHO.x1, KHO.y1, KB], { side: 'wc_wall_old', top: 'wc_floor_kho' }));
  const DOOR = { a: 156, b: 540, leaf: 160 }; // cửa lớn rộng 384 (~9,6 m), mỗi cánh kéo 160 (phải sát vách KT)
  W(box([DOOR.a, KHO.y1, 0], [DOOR.b, KHO.y1 + 24, 32], { side: 'wc_wall_old', top: 'wc_concrete' })); // 2 bậc ngoài + mép sàn kho = 3 bậc
  W(box([DOOR.a, KHO.y1 + 24, 0], [DOOR.b, KHO.y1 + 48, 16], { side: 'wc_wall_old', top: 'wc_concrete' }));
  const TDOORS = [{ a: 120, b: 248, top: 128 + KB }, { a: 520, b: 648, top: 128 + KB }]; // 2 cửa rộng ra T spawn
  for (const d of TDOORS) {
    W(box([d.a, KHO.y0 - 32, 0], [d.b, KHO.y0 - 16, 16], { side: 'wc_wall_old', top: 'wc_concrete' }));
    W(box([d.a, KHO.y0 - 16, 0], [d.b, KHO.y0, 32], { side: 'wc_wall_old', top: 'wc_concrete' }));
  }
  const wall = { side: 'wc_wall_yl', top: 'wc_wall_old' };
  // Tường Bắc (giáp khu soạn hàng): 1 cửa lớn duy nhất. Tường Tây giáp hẻm kín, không cửa.
  wallX(KHO.x0, KHO.x1, KHO.y1 - T, KHO.y1, 0, KHO.h, [{ a: DOOR.a, b: DOOR.b, top: 256 }], wall);
  W(box([KHO.x0, KHO.y0, 0], [KHO.x0 + T, KHO.y1 - T, KHO.h], wall));
  wallX(KHO.x0, KHO.x1, KHO.y0, KHO.y0 + T, 0, KHO.h, TDOORS, wall);
  W(box([KHO.x1 - T, KHO.y0 + T, 0], [KHO.x1, KHO.y1 - T, KHO.h], wall));
  W(box([KHO.x0, KHO.y0, KHO.h], [KHO.x1, KHO.y1, KHO.h + 16], { side: 'wc_tin_wh', top: 'wc_tin_wh', bottom: 'wc_tin_wh' }));
  // 2 cánh cửa lớn tôn xám kéo sẵn sang 2 bên cửa (phía khu soạn hàng) + ray trên
  for (const x of [DOOR.a - DOOR.leaf, DOOR.b]) P(box([x, KHO.y1, BASE], [x + DOOR.leaf, KHO.y1 + 8, 256], { side: 'wc_door_gy', top: 'bt_steel' }));
  P(box([DOOR.a - DOOR.leaf, KHO.y1, 256], [DOOR.b + DOOR.leaf, KHO.y1 + 8, 264], 'bt_steel'));

  // 2 phòng trắng sát nhau dựa tường Đông kho, trần thấp: phòng IT (phía Nam) + phòng họp (phía Bắc, con tin).
  // Tường vàng của kho bên trong 2 phòng được ốp vách trắng; vách chung có ô kính mờ (không vỡ) nhìn sang phòng IT.
  const R = ROOMS;
  const wh = { side: 'wc_wall_wh', top: 'wc_wall_wh' };
  const IN = { x1: KHO.x1 - T - 8, y0: R.y0 + 8, y1: R.y1 - 8 }; // mặt trong sau lớp ốp trắng
  wallY(R.x0, R.x0 + T, R.y0, R.y1, KB, R.h, [{ a: -620, b: -540, top: 128 + KB }, { a: -340, b: -260, top: 128 + KB }], wh);
  W(box([IN.x1, R.y0, KB], [KHO.x1 - T, R.y1, R.h], wh)); // ốp vách Đông
  W(box([R.x0 + T, R.y0, KB], [IN.x1, IN.y0, R.h], wh)); // ốp vách Nam (phòng IT)
  W(box([R.x0 + T, IN.y1, KB], [IN.x1, R.y1, R.h], wh)); // ốp vách Bắc (phòng họp)
  wallX(R.x0 + T, IN.x1, R.mid - 8, R.mid + 8, KB, R.h, [{ a: 740, b: 1060, top: R.h, bottom: KB + 60 }], wh); // vách chung: ô kính mờ dài gần hết vách, cao tới trần
  frosted.push(box([740, R.mid - 2, KB + 60], [1060, R.mid + 2, R.h], 'wc_frosted'));
  W(box([R.x0, R.y0, R.h], [KHO.x1 - T, R.y1, R.h + 8], wh)); // trần
  for (const y of [-624, -540, -344, -260]) P(box([R.x0 - 4, y, KB], [R.x0 + T + 4, y + 4, 128 + KB], 'wc_alu'));
  plate(-612, -548, KB + 132, KB + 148, R.x0, [-1, 0, 0], 'wc_sign_it');
  plate(-332, -268, KB + 132, KB + 148, R.x0, [-1, 0, 0], 'wc_sign_hop');
  // Cửa kính 2 cánh cho cả phòng IT + phòng họp: bản lề 2 mép, cánh Bắc đảo chiều (spawnflags 2) để 2 cánh cùng mở ra phía kho.
  // One-way (16): luôn mở ra ngoài, không mở ngược vào phòng theo hướng người đẩy. Chạm hoặc E là mở, mở rồi giữ nguyên.
  const leaves = [[-618, -581, -618, '16'], [-579, -542, -542, '18'], [-338, -301, -338, '16'], [-299, -262, -262, '18']] as const;
  for (const [a, b, hinge, flags] of leaves) {
    ents.push({
      props: { classname: 'func_door_rotating', speed: '120', distance: '90', wait: '-1', rendermode: '2', renderamt: '140', lip: '0', spawnflags: flags },
      brushes: [box([R.x0 + 7, a, KB], [R.x0 + 9, b, KB + 128], 'wc_glass'), box([R.x0 + 4, hinge - 4, KB], [R.x0 + 12, hinge + 4, KB + 128], 'ORIGIN')],
    });
  }

  // Phòng họp: #17 bàn họp dài từ gần cửa vào tới tivi, 4 con tin 2 bên bàn; máy lạnh trên cửa; tủ vàng + bảng điện góc Tây Bắc
  table(780, -320, 260, 50, KB);
  for (const x of [800, 860, 920, 980]) {
    chair(x, -348, 's', KB);
    chair(x, -266, 'n', KB);
  }
  for (const [x, y] of [[830, -380], [830, -212], [1040, -380], [1040, -212]]) point('hostage_entity', [x, y, KB + 8], { angle: '180' });
  D(box([IN.x1 - 6, -330, KB + 96], [IN.x1, -250, KB + 156], { side: 'wc_tv', top: 'bt_tire' })); // tivi vách Đông
  P(box([R.x0 + T, -348, KB + 180], [R.x0 + T + 16, -252, KB + 216], { side: 'wc_ac_in', top: 'wc_alu' })); // máy lạnh trên cửa
  // Tủ gỗ nâu thấp: chân đen, thân + mặt tủ gỗ, khe giữa 2 cánh, 2 tay nắm
  P(box([732, IN.y1 - 28, KB], [768, IN.y1, KB + 4], 'bt_tire'));
  P(box([730, IN.y1 - 30, KB + 4], [770, IN.y1, KB + 50], 'bt_wood'));
  P(box([728, IN.y1 - 32, KB + 50], [772, IN.y1, KB + 54], 'bt_wood'));
  D(box([749, IN.y1 - 31, KB + 8], [751, IN.y1 - 30, KB + 46], 'bt_tire'));
  for (const x of [744, 754]) D(box([x, IN.y1 - 32, KB + 26], [x + 2, IN.y1 - 30, KB + 34], 'wc_alu'));
  D(box([780, IN.y1 - 6, KB + 64], [812, IN.y1, KB + 104], { side: 'wc_elecpanel', top: 'bt_steel' })); // bảng điện ngang tầm đầu
  light([930, -300, R.h - 20], '230 240 255 150', 'den_hop');
  lightSwitch(R.x0 + T, -250, KB, 'den_hop');
  waterCooler(R.x0 - 26, ROOMS.y1 - 26, KB); // góc kho: tường Bắc kho + vách Tây phòng họp, bên trái cửa
  // Phòng IT: 2 dãy bàn (chạy Bắc - Nam) đẩy sát vách Nam, mỗi dãy 4 chỗ mỗi bên, màn hình quay lưng vào nhau giữa bàn.
  // Lối 84 sát vách cửa, lối 76 giữa 2 dãy, ghế Đông dãy 2 tựa vách (không chừa khe kẹt); lối đi vòng 132 phía Bắc 2 dãy.
  for (const tx of [830, 1006]) {
    table(tx, IN.y0, 40, 252, KB); // dài tới cách vách kính mờ 48 (lối vòng nhỏ)
    const cx = tx + 20;
    for (const y of [-728, -665, -602, -539]) {
      chair(tx - 30, y, 'w', KB);
      chair(tx + 46, y, 'e', KB);
      P(box([cx - 5, y + 7, KB + 40], [cx + 5, y + 17, KB + 41], 'bt_tire')); // đế
      P(box([cx - 1, y + 11, KB + 41], [cx + 1, y + 13, KB + 47], 'bt_tire')); // cổ
      P(box([cx - 1, y, KB + 46], [cx + 1, y + 24, KB + 62], 'bt_tire')); // lưng 2 màn
      P(alignedPlate([cx - 2, y, KB + 46], [cx - 1, y + 24, KB + 62], 'wc_monitor', [-1, 0, 0]));
      P(alignedPlate([cx + 1, y, KB + 46], [cx + 2, y + 24, KB + 62], 'wc_monitor', [1, 0, 0]));
    }
  }
  // Tranh Trái Đất ban đêm khung nhôm đen trên vách Đông, phía trên dãy ghế
  P(box([IN.x1 - 3, -664, KB + 116], [IN.x1, -528, KB + 188], 'bt_tire'));
  P(alignedPlate([IN.x1 - 4, -660, KB + 120], [IN.x1 - 3, -532, KB + 184], 'wc_poster_earth', [-1, 0, 0]));
  for (const x of [760, 940]) P(box([x, IN.y0, KB + 190], [x + 96, IN.y0 + 16, KB + 226], { side: 'wc_ac_in', top: 'wc_alu' }));
  // Vách cửa, phía Bắc cửa: máy lạnh trên cao + quạt treo tường bên dưới
  P(box([R.x0 + T, -524, KB + 180], [R.x0 + T + 16, -436, KB + 216], { side: 'wc_ac_in', top: 'wc_alu' }));
  P(box([R.x0 + T, -484, KB + 112], [R.x0 + T + 12, -476, KB + 124], 'bt_steel')); // giá treo
  P(box([R.x0 + T + 12, -488, KB + 108], [R.x0 + T + 24, -472, KB + 128], 'bt_tire')); // mô tơ
  P(box([R.x0 + T + 24, -498, KB + 116], [R.x0 + T + 26, -462, KB + 120], 'wc_alu')); // 2 cánh quạt chữ thập
  P(box([R.x0 + T + 24, -482, KB + 100], [R.x0 + T + 26, -478, KB + 136], 'wc_alu'));
  masked.push(prism(octagon(-480, KB + 118, 22), 'x', R.x0 + T + 26, R.x0 + T + 30, '{bt_rail')); // lồng quạt
  light([880, -500, R.h - 20], '220 235 255 140', 'den_it');
  light([880, -650, R.h - 20], '220 235 255 140', 'den_it');
  lightSwitch(R.x0 + T, -534, KB, 'den_it');
  P(box([R.x0 + T + 4, IN.y0, KB], [R.x0 + T + 36, IN.y0 + 32, KB + 80], { side: 'wc_fridge', top: 'wc_alu' })); // tủ lạnh góc cuối lối sát vách cửa
  waterCooler(R.x0 + T + 2, -664, KB); // mép Nam cửa kính

  // #13 Kệ sắt chất thùng carton (4 dãy), #15 bao tải trắng, #16 pallet + hàng bọc nilon
  for (const y of [-460, -300, -640, -728]) shelf(-380, y, -120, y + 40, KB);
  // Bó ống nhựa PVC xanh dài 6 m nằm dọc vách Tây, xếp 3 - 2 - 1 (khe sau kệ hẹp, không đi lọt)
  for (const [n, z] of [[3, 5], [2, 14], [1, 23]] as const)
    for (let i = 0; i < n; i++) P(prism(octagon(-419 + (3 - n) * 5 + i * 10, KB + z, 5), 'y', -700, -460, { side: 'wc_pvc', top: 'wc_dark' }));
  // Pallet chất carton, bao tải ngay sau cửa lớn, cuộn ống nhựa. Chừa lối cửa Nam (x 150..270) và lối tới 2 phòng.
  for (const [x, y, nz] of [[-40, -620, 3], [60, -300, 4], [320, -640, 2], [180, -480, 3]]) cartonStack(x, y, 2, 2, nz, 'bt_cardboard', KB, true);
  for (const [x, y, k] of [[230, -380, 0], [262, -380, 0], [246, -350, 0], [246, -366, 1]]) P(box([x, y, KB + k * 24], [x + 32, y + 30, KB + 24 + k * 24], 'bt_sack'));
  P(prism(octagon(-380, -216, 36), 'z', KB, KB + 96, { side: 'wc_hose_bl', top: 'wc_dark' }));
  for (const [x, y, k] of [[-20, -440, 0], [12, -440, 0], [-20, -408, 0], [-4, -428, 1], [28, -410, 0]]) P(box([x, y, KB + k * 24], [x + 32, y + 30, KB + 24 + k * 24], 'bt_sack'));
  // 3 khoanh ống xanh lá nằm dẹt (cao 16/khoanh): chồng 2 + 1 lẻ, lấp kín khe giữa bao tải và chồng carton (khe còn lại < 32, không kẹt người)
  for (const [x, y, k] of [[120, -444, 0], [120, -444, 1], [120, -510, 0]]) P(prism(octagon(x, y, 30), 'z', KB + k * 16, KB + 16 + k * 16, { side: 'wc_hose_gr', top: 'wc_dark' }));
  pallet(470, -620, KB, 1); // lệch sang Tây, chừa lối cửa ra T spawn (x 520..648)
  P(box([442, -648, KB + 8], [498, -592, KB + 72], 'bt_sack'));
  pallet(-300, -216, KB, 3); // cụm pallet + cuộn ống dồn sát góc Tây Bắc, chừa lối dọc tường Bắc
  // #14 Chồng cuộn bạt cam: leo được, đứng cao nhìn bao quát kho + cửa phòng họp
  // Bậc pallet cao 16 rồi mỗi lớp bạt cao 40 (nhảy thường được, không cần nhảy ngồi)
  pallet(440, -552, KB, 2);
  P(box([360, -520, KB], [520, -400, KB + 40], { side: 'wc_bat_cam', top: 'wc_orange' }));
  P(box([380, -505, KB + 40], [500, -415, KB + 80], { side: 'wc_bat_cam', top: 'wc_orange' }));
  P(box([400, -490, KB + 80], [480, -430, KB + 120], { side: 'wc_bat_cam', top: 'wc_orange' }));
  for (let x = -300; x < 1000; x += 260) for (const y of [-620, -320]) if (!(x > ROOMS.x0 && y < ROOMS.y1)) light([x, y, 370], '250 248 235 190');

  // Dãy nhà xám giữa hẻm WC và kho (khối kín). Hẻm duy nhất xuống WC là hẻm giữa nhà VP và dãy này:
  // #12 thùng rác xanh sát vách nhà VP, bồn rửa mặt + gương soi sát vách nhà xám
  W(box([HEM.x0 - T, KHO.y0, 0], [HEM.x1, FRONT.y0, 288], { side: 'wc_wall_gy', top: 'wc_wall_old' }));
  for (const y of [-700, -420]) plate(y, y + 64, 120, 184, HEM.x0 - T, [-1, 0, 0], 'wc_louvre');
  wheelieBin(VP.x1 + 2, VP.y1 - 38, 'w');
  P(box([-592, -294, 0], [-576, -278, 32], 'wc_alu')); // bồn + gương đặt giữa 2 cửa sổ lá sách; mặt bồn cao 40 (~1 m)
  P(box([-604, -302, 32], [-576, -270, 40], 'wc_alu'));
  plate(-302, -270, 48, 96, HEM.x0 - T, [-1, 0, 0], 'wc_mirror');
}

// ---------------------------------------------------------------- dãy WC + T spawn (hành lang sau kho)
function backCorridor() {
  // Dãy WC: 3 phòng vào được (nền cao bằng bậc thềm 16, trần 128), bậc thềm (#18), biển WC.
  // Phòng Tây cùng (sát hồ cá) không cánh cửa; 2 phòng giữa cánh cửa mở sẵn áp vào trong làm chỗ nấp.
  // Nhìn từ ngoài vào: thùng nước nhựa tròn xanh dương giữa vách sau, bồn cầu sát vách bên trái (phía Đông).
  const yl = { side: 'wc_wall_yl', top: 'wc_wall_old' };
  const wh = { side: 'wc_wall_wh', top: 'wc_wall_wh' };
  const WCF = { y0: -932, y1: -920, back: BACK.y0 + 12, floor: 16, top: 128 }; // tường trước, mặt trong vách sau
  W(box([-1000, -920, 0], [-660, -896, 16], { side: 'wc_wall_old', top: 'wc_wall_old' }));
  W(box([-1000, BACK.y0, 0], [-660, WCF.y1, WCF.floor], { side: 'wc_wall_old', top: 'bt_gachbong' })); // nền
  W(box([-1000, BACK.y0, WCF.top], [-660, WCF.y1, 224], { side: 'wc_wall_yl', top: 'wc_wall_old', bottom: 'wc_wall_wh' })); // mái bằng
  W(box([-1000, BACK.y0, WCF.floor], [-660, WCF.back, WCF.top], wh)); // vách sau
  wallX(-1000, -660, WCF.y0, WCF.y1, WCF.floor, WCF.top, [-960, -860, -760].map((a) => ({ a, b: a + 48, top: 112 })), yl);
  for (const [a, b, tex] of [[-1000, -988, yl], [-908, -888, wh], [-808, -788, wh], [-708, -660, wh]] as const) W(box([a, WCF.back, WCF.floor], [b, WCF.y0, WCF.top], tex));
  for (const [x0, x1, door] of [[-988, -908, -960], [-888, -808, -860], [-788, -708, -760]] as const) {
    awning(door - 8, door + 56);
    if (door !== -960) P(alignedPlate([door - 4, WCF.y0 - 48, WCF.floor], [door, WCF.y0, WCF.floor + 96], 'wc_door', [1, 0, 0])); // cánh mở vào, bản lề mép Tây
    P(prism(octagon(x0 + 28, WCF.back + 18, 16), 'z', WCF.floor, WCF.floor + 48, { side: 'wc_drum', top: 'bt_plastic_b' })); // thùng nước
    // Bồn cầu quay ra cửa: két nước sát vách sau, bệ + bồn
    const tx = x1 - 26;
    P(box([tx, WCF.back, WCF.floor + 28], [tx + 20, WCF.back + 8, WCF.floor + 48], 'wc_plastic_wh'));
    P(box([tx + 3, WCF.back + 8, WCF.floor], [tx + 17, WCF.back + 26, WCF.floor + 14], 'wc_plastic_wh'));
    P(box([tx, WCF.back + 6, WCF.floor + 14], [tx + 20, WCF.back + 30, WCF.floor + 20], 'wc_plastic_wh'));
    light([(x0 + x1) / 2, -980, 112], '255 240 220 60');
  }
  plate(-812, -780, 160, 176, -920, [0, 1, 0], 'wc_sign_wc');
  // Hồ cá xây xi măng dài hết đầu Tây dãy WC, góc tường rào sau: nhô ra 1,2 m, dài 3 m, cao 1,6 m (48 x 120 x 64)
  const pond = { x0: -1048, x1: -1000, y0: BACK.y0, y1: -920, h: 64 };
  for (const [a, b] of [[[pond.x0, pond.y0], [pond.x1, pond.y0 + 4]], [[pond.x0, pond.y1 - 4], [pond.x1, pond.y1]], [[pond.x0, pond.y0 + 4], [pond.x0 + 4, pond.y1 - 4]]] as const)
    W(box([a[0], a[1], 0], [b[0], b[1], pond.h], { side: 'wc_wall_old', top: 'wc_concrete' }));
  W(box([pond.x0 + 4, pond.y0 + 4, 0], [pond.x1, pond.y1 - 4, pond.h - 6], { side: 'wc_dark', top: 'wc_water' }));
  // 2 phòng WC nối dài tới sát lưới B40 (thay tường thấp cũ, vẫn chắn tầm bắn dọc hành lang)
  W(box([-660, BACK.y0, 0], [-448, -920, 224], { side: 'wc_wall_yl', top: 'wc_wall_old' }));
  W(box([-660, -920, 0], [-448, -896, 16], { side: 'wc_wall_old', top: 'wc_wall_old' }));
  for (const x of [-620, -520]) {
    plate(x, x + 48, 16, 112, -920, [0, 1, 0], 'wc_door');
    awning(x - 8, x + 56);
  }
  plate(-562, -530, 160, 176, -920, [0, 1, 0], 'wc_sign_wc');
  // Lưới B40 ngăn T spawn với phía WC + nhà xe: nhìn xuyên, bắn xuyên (tấm lưới không va chạm) nhưng không đi qua (CLIP)
  illusion.push(box([-436, BACK.y0, 0], [-432, KHO.y0, 128], '{wc_mesh'));
  W(box([-440, BACK.y0, 0], [-428, KHO.y0, 280], 'CLIP')); // CLIP cao tới mái: không đứng lên chồng ống nhảy qua lưới thấp
  for (const y of [BACK.y0, -900, KHO.y0 - 8]) P(box([-438, y, 0], [-430, y + 8, 128], 'wc_steel_rust'));
  // Mái tôn đua ra sau kho, cột thép
  W(box([KHO.x0, TBACK, 280], [KHO.x1, KHO.y0, 288], { side: 'wc_tin_wh', top: 'wc_tin_wh', bottom: 'wc_tin_wh' }));
  // #19 Cuộn ống nhựa xanh chồng cao, #20 ghế văn phòng đen + cục nóng máy lạnh
  const hose = (x: number, y: number, h: number, tex: string) => P(prism(octagon(x, y, 36), 'z', 0, h, { side: tex, top: 'wc_dark' }));
  hose(-380, -854, 96, 'wc_hose_bl'); // các cuộn ống nằm giữa 2 hàng spawn
  hose(500, -854, 120, 'wc_hose_gr');
  hose(940, -854, 96, 'wc_hose_bl');
  for (const [x, y] of [[1068, -792]]) { // 1 ghế VP đen dồn sát góc cuối hành lang (không để khe kẹt)
    P(box([x, y, 0], [x + 28, y + 28, 20], 'bt_tire'));
    P(box([x, y + 24, 20], [x + 28, y + 28, 48], 'bt_tire'));
  }
  for (const x of [-200, 360, 700]) D(box([x, KHO.y0 - 24, 160], [x + 64, KHO.y0, 208], { side: 'wc_ac', top: 'wc_alu' }));
  for (let x = -300; x < 1100; x += 320) light([x, -830, 250], '255 230 190 120');
  light([-800, -840, 200], '255 236 205 90');
}

// ---------------------------------------------------------------- đường Trung Tâm (CT) + đồ trên đường nội bộ
function outside() {
  tree(-1584, 800); // #1
  tree(-640, 60, 290, 140, true); // cây bóng mát giữa sân trước, miệng hẻm WC: tán dày, ngọn ngang mái nhà VP
  tree(-1594, -500); // #3
  for (const y of [-1350, -760, -120, 720, 1200]) tree(-1954, y);
  for (const y of [-900, -200, 500, 1150]) tree(-2220, y);
  tree(-1584, 1240);
  truck(-1680, -300); // #2 lùi về phía Nam, không che mặt cổng
  // #5 Xe đẩy hàng dọc mặt tiền kho bên cạnh, ghế băng trắng dưới lưới che
  for (const x of [400, 480, 560]) own(PUSHABLE, () => trolley(x, 340)); // 3 xe đẩy hàng giữa đường nội bộ, cạnh khu soạn hàng: đi vào là đẩy, E để kéo
  paintBuckets(-300, 180); // thùng sơn WIN thay ghế băng
  // Pallet rải giữa đường để lane AWP không trống trơn
  pallet(320, 480, 0, 3);
  pallet(760, 220, 0, 4);
  pallet(1030, 470, 0, 2);
  // #6 Xe nâng + thùng phuy xanh cuối đường: T giữ lane
  forklift(-620, 470); // sát mặt tiền kho bên cạnh
  for (const [x, y] of [[1040, 300], [1056, 336], [1026, 342]]) own(PUSHABLE, () => P(prism(octagon(x, y, 16), 'z', 0, 48, { side: 'wc_drum', top: 'bt_plastic_b' })));
  pallet(1050, 230, 0, 5);
}

// ---------------------------------------------------------------- prop dựng bằng brush
/** Gom các brush `draw` vừa đẩy vào props thành 1 entity riêng (đẩy được, bắn vỡ...). */
function own(kv: Record<string, string>, draw: () => void) {
  const n = props.length;
  draw();
  ents.push({ props: kv, brushes: props.splice(n) });
}
/** Đẩy được: bbox lấy theo model (engine đặt lại sau SET_MODEL), vật liệu kim loại cho tiếng kéo lê. */
const PUSHABLE = { classname: 'func_pushable', friction: '50', buoyancy: '20', material: '2' };
/** Bắn vỡ được: material 0 kính, 1 gỗ / carton. */
const breakable = (material: string, health: number, draw: () => void) => own({ classname: 'func_breakable', material, health: String(health) }, draw);

/** Cây nước nóng lạnh thân 24 x 24 cao 48 từ góc (x, y) + bình 20L úp ngược trên đầu. */
function waterCooler(x: number, y: number, z: number) {
  P(box([x, y, z], [x + 24, y + 24, z + 48], { side: 'wc_dispenser', top: 'wc_alu' }));
  P(prism(octagon(x + 12, y + 12, 10), 'z', z + 48, z + 80, 'wc_jug'));
}

/** Chai thủy tinh đứng trên mặt bàn z: thân + cổ, 1 phát là vỡ. */
function bottle(x: number, y: number, z: number, tex: string) {
  breakable('0', 1, () => {
    P(prism(octagon(x, y, 3), 'z', z, z + 12, tex));
    P(prism(octagon(x, y, 2), 'z', z + 12, z + 18, tex));
  });
}

/** Công tắc đèn trên vách mặt quay +X (phía trong phòng), cao ngang hông: bấm E bật / tắt đèn `target`. */
function lightSwitch(x: number, y: number, z: number, target: string) {
  ents.push({
    props: { classname: 'func_button', spawnflags: '1', wait: '1', sounds: '14', target },
    brushes: [alignedPlate([x, y, z + 60], [x + 2, y + 8, z + 72], 'wc_switch', [1, 0, 0])],
  });
}
function pallet(x: number, y: number, z: number, n: number) {
  P(box([x - 32, y - 32, z], [x + 32, y + 32, z + 8 * n], 'bt_wood'));
}

/** Pallet (trên sàn z) chất nx x ny x nz thùng carton 28 unit; `tex` là mặt hông thùng. `breakTop`: lớp trên cùng bắn vỡ được (bên trên không còn gì nên không có thùng lơ lửng). */
function cartonStack(x: number, y: number, nx: number, ny: number, nz: number, tex = 'bt_cardboard', z = BASE, breakTop = false) {
  pallet(x, y, z, 1);
  const x0 = x - nx * 15;
  const y0 = y - ny * 15;
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++)
      for (let k = 0; k < nz; k++) {
        const draw = () => P(box([x0 + i * 30 + 1, y0 + j * 30 + 1, z + 8 + k * 28], [x0 + i * 30 + 29, y0 + j * 30 + 29, z + 36 + k * 28], { side: tex, top: 'bt_cardboard' }));
        if (breakTop && k === nz - 1) breakable('1', 20, draw);
        else draw();
      }
}

function table(x: number, y: number, w: number, d: number, z = BASE) {
  P(box([x, y, z + 36], [x + w, y + d, z + 40], 'bt_wood'));
  P(box([x + 4, y + 4, z], [x + w - 4, y + d - 4, z + 36], 'bt_steel'));
}

/** Ghế văn phòng có tựa, chiếm ô 24 x 24 từ (x, y): chân sao + trụ, mặt ngồi, lưng tựa ở cạnh `back` (phía xa bàn). */
function chair(x: number, y: number, back: 'n' | 's' | 'e' | 'w', z = BASE) {
  P(box([x + 4, y + 4, z], [x + 20, y + 20, z + 4], 'bt_steel'));
  P(box([x + 10, y + 10, z + 4], [x + 14, y + 14, z + 20], 'bt_steel'));
  P(box([x, y, z + 20], [x + 24, y + 24, z + 24], 'bt_tire'));
  const b: Record<typeof back, [V3, V3]> = {
    n: [[x, y + 20, z + 24], [x + 24, y + 24, z + 56]],
    s: [[x, y, z + 24], [x + 24, y + 4, z + 56]],
    e: [[x + 20, y, z + 24], [x + 24, y + 24, z + 56]],
    w: [[x, y, z + 24], [x + 4, y + 24, z + 56]],
  };
  P(box(...b[back], 'bt_tire'));
}

/** Băng ghế nhựa trắng sâu 20, dài `len` dọc Y từ (x, y): 2 tấm chân, mặt ngồi, 2 trụ + 3 thanh tựa ở cạnh `back`. */
function plasticBench(x: number, y: number, len: number, back: 'e' | 'w', z = BASE) {
  const t = 'wc_plastic_wh';
  for (const dy of [2, len - 4]) P(box([x + 1, y + dy, z], [x + 19, y + dy + 2, z + 16], t));
  P(box([x, y, z + 16], [x + 20, y + len, z + 18], t));
  const bx = back === 'w' ? x : x + 18;
  for (const dy of [0, len - 2]) P(box([bx, y + dy, z + 18], [bx + 2, y + dy + 2, z + 40], t));
  for (const dz of [24, 30, 36]) P(box([bx, y + 2, z + dz], [bx + 2, y + len - 2, z + dz + 3], t));
}

/** Thùng rác nhựa có bánh xe: thân xanh, nắp đè chìa ra phía trước, tay kéo + 2 bánh phía sau (`back` = hướng lưng). */
function wheelieBin(x: number, y: number, back: 'w' | 'e') {
  const s = back === 'w' ? 1 : -1; // trục u: từ lưng ra mặt trước
  const X = (u: number) => x + u * s;
  const bx = (u0: number, u1: number, v0: number, v1: number, z0: number, z1: number, tex: TexSel) =>
    P(box([Math.min(X(u0), X(u1)), y + v0, z0], [Math.max(X(u0), X(u1)), y + v1, z1], tex));
  const bin = { side: 'wc_bin', top: 'wc_bin' };
  bx(4, 32, 2, 30, 4, 20, bin); // thân dưới hẹp
  bx(3, 34, 1, 31, 20, 48, bin); // thân trên loe
  bx(1, 37, 0, 32, 48, 52, { side: 'wc_bin', top: 'wc_dark' }); // nắp
  bx(0, 3, 4, 28, 44, 48, 'bt_tire'); // tay kéo
  for (const [v0, v1] of [[-2, 2], [30, 34]]) P(prism(octagon(X(7), 7, 7), 'y', y + v0, y + v1, 'bt_tire'));
}

/** Thùng sơn WIN: cụm 3 x 2 thùng tròn trên pallet, lớp trên 2 x 2 (chỗ nấp thấp ven đường). */
function paintBuckets(x: number, y: number) {
  P(box([x, y, 0], [x + 108, y + 72, 8], 'bt_wood'));
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++)
      for (let k = 0; k < (i < 2 ? 2 : 1); k++)
        P(prism(octagon(x + 18 + i * 36, y + 18 + j * 36, 16), 'z', 8 + k * 32, 40 + k * 32, { side: 'wc_paint_win', top: 'wc_paint_lid' }));
}

function trolley(x: number, y: number) {
  P(box([x, y, 8], [x + 48, y + 80, 14], 'bt_steel'));
  P(box([x, y + 76, 14], [x + 48, y + 80, 80], 'bt_steel'));
  for (const [dx, dy] of [[4, 4], [36, 4], [4, 64], [36, 64]]) P(box([x + dx, y + dy, 0], [x + dx + 8, y + dy + 12, 8], 'bt_tire'));
}

function shelf(x0: number, y0: number, x1: number, y1: number, z0 = BASE) {
  for (const x of [x0, (x0 + x1) / 2 - 2, x1 - 4]) P(box([x, y0, z0], [x + 4, y1, z0 + 192], 'bt_steel'));
  for (let k = 0; k < 4; k++) {
    const z = z0 + 4 + k * 48;
    P(box([x0, y0, z], [x1, y1, z + 4], 'bt_steel'));
    for (let x = x0 + 8; x + 40 <= x1 - 8; x += 52) P(box([x, y0 + 4, z + 4], [x + 40, y1 - 4, z + 4 + 36 - ((x + k) % 3) * 4], 'bt_cardboard'));
  }
}

/** Cây: thân tròn, tán là 2 tấm lá chéo + 1 tấm ngang (không va chạm); `top` = ngọn tán, `r` = bán kính tán; `dense`: thêm 2 tấm dọc lệch tâm + 2 tầng ngang cho tán kín bóng. */
function tree(x: number, y: number, top = 330, r = 120, dense = false) {
  P(prism(octagon(x, y, 14), 'z', 0, top - 130, 'wc_bark'));
  illusion.push(box([x - r, y - 2, top - 180], [x + r, y + 2, top], '{wc_leaves'));
  illusion.push(box([x - 2, y - r, top - 180], [x + 2, y + r, top], '{wc_leaves'));
  illusion.push(box([x - r + 10, y - r + 10, top - 90], [x + r - 10, y + r - 10, top - 86], '{wc_leaves'));
  if (!dense) return;
  const h = r / 2;
  illusion.push(box([x - h, y - r + 20, top - 160], [x - h + 4, y + r - 20, top - 20], '{wc_leaves'));
  illusion.push(box([x - r + 20, y + h, top - 160], [x + r - 20, y + h + 4, top - 20], '{wc_leaves'));
  for (const [dz, k] of [[40, 30], [140, 20]]) illusion.push(box([x - r + k, y - r + k, top - dz], [x + r - k, y + r - k, top - dz + 4], '{wc_leaves'));
}

/**
 * Xe tải thùng lửng cabin bằng (kiểu xe tải xanh trước cổng trong ảnh Street View), dọc trục Y, đầu xe hướng Bắc.
 * Sàn thùng cao 64 -> đứng lên nhìn qua tường rào (96). Cabin y0+262..y0+336, kính lái nghiêng.
 */
function truck(x0: number, y0: number) {
  const x1 = x0 + 96;
  const cab = y0 + 262;
  const nose = y0 + 336;
  // Bánh: lốp đen + mâm xám, thanh dọc gầm, thùng dầu
  for (const y of [y0 + 40, y0 + 200, y0 + 300]) {
    for (const [a, b] of [[x0 - 4, x0 + 10], [x1 - 10, x1 + 4]]) D(prism(octagon(y, 22, 22), 'x', a, b, 'bt_tire'));
    D(prism(octagon(y, 22, 10), 'x', x0 - 6, x0 - 4, 'bt_steel'));
    D(prism(octagon(y, 22, 10), 'x', x1 + 4, x1 + 6, 'bt_steel'));
  }
  for (const x of [x0 + 14, x1 - 26]) D(box([x, y0 + 8, 24], [x + 12, nose, 40], 'bt_steel'));
  D(prism(octagon(x0 + 14, 34, 10), 'y', y0 + 120, y0 + 176, 'bt_steel'));
  // Thùng lửng: sàn gỗ, thành xanh + trụ thép, vách đầu thùng, đèn hậu đỏ, bậc leo sau thùng
  D(box([x0, y0, 40], [x1, y0 + 256, 64], { side: 'wc_truck', top: 'bt_wood' }));
  D(box([x0, y0, 64], [x0 + 6, y0 + 250, 92], 'wc_truck'));
  D(box([x1 - 6, y0, 64], [x1, y0 + 250, 92], 'wc_truck'));
  for (let y = y0; y < y0 + 250; y += 62) for (const x of [x0 - 2, x1 - 4]) D(box([x, y, 60], [x + 6, y + 6, 96], 'bt_steel'));
  D(box([x0, y0 + 250, 64], [x1, y0 + 256, 136], 'bt_steel'));
  for (const x of [x0 + 4, x1 - 16]) D(box([x, y0 - 2, 44], [x + 12, y0, 58], 'bt_plastic_r'));
  D(box([x0 + 16, y0 - 24, 24], [x1 - 16, y0, 36], 'bt_steel'));
  // Cabin: thân dưới vuông, thân trên vát kính lái
  D(box([x0, cab, 32], [x1, nose, 100], 'wc_truck'));
  D(prism([[cab, 100], [nose, 100], [nose - 8, 152], [cab, 152]], 'x', x0, x1, 'wc_truck'));
  D(prism([[nose, 104], [nose + 2, 104], [nose - 6, 148], [nose - 8, 148]], 'x', x0 + 6, x1 - 6, 'wc_dark'));
  for (const x of [x0 - 2, x1]) D(box([x, cab + 28, 104], [x + 2, nose - 12, 144], 'wc_dark')); // kính hông
  // Mặt trước: lưới tản nhiệt, đèn pha, cản; gương chiếu hậu 2 bên
  D(box([x0 + 24, nose, 56], [x1 - 24, nose + 2, 88], 'bt_tire'));
  for (const x of [x0 + 6, x1 - 22]) D(box([x, nose, 62], [x + 16, nose + 3, 76], 'wc_alu'));
  D(box([x0 - 2, nose, 30], [x1 + 2, nose + 8, 46], 'bt_steel'));
  for (const [arm, m] of [[x0 - 12, x0 - 16], [x1, x1 + 12]]) {
    D(box([arm, nose - 10, 112], [arm + 12, nose - 6, 116], 'bt_steel'));
    D(box([m, nose - 14, 98], [m + 4, nose - 4, 126], 'bt_tire'));
  }
  D(box([x0 - 4, cab + 16, 46], [x0 + 10, cab + 56, 50], 'bt_tire')); // chắn bùn bánh trước
  D(box([x1 - 10, cab + 16, 46], [x1 + 4, cab + 56, 50], 'bt_tire'));
}

/**
 * Xe máy tay ga / xe số dọc trục X (đầu xe theo `dir`), dài ~72, cao ~48 tới ghi đông.
 * Profile vẽ trên mặt phẳng (u dọc xe, z) rồi đùn theo bề ngang Y.
 */
function bike(x: number, y: number, dir: 1 | -1, color: string) {
  const X = (u: number) => x + u * dir;
  const bx = (u0: number, u1: number, v0: number, v1: number, z0: number, z1: number, tex: TexSel) =>
    P(box([Math.min(X(u0), X(u1)), y + v0, z0], [Math.max(X(u0), X(u1)), y + v1, z1], tex));
  const side = (pts: [number, number][], v0: number, v1: number, tex: TexSel) => P(prism(pts.map(([u, z]) => [X(u), z] as V2), 'y', y + v0, y + v1, tex));
  // Rút gọn còn 8 khối (bỏ phuộc, gương, máy, ống pô): ~60 chiếc xe trong 1 func_wall từng đẩy leaf vượt 8192
  for (const u of [-27, 27]) P(prism(octagon(X(u), 11, 11), 'y', y - 3, y + 3, 'bt_tire'));
  side([[12, 14], [22, 16], [26, 38], [18, 46], [10, 40]], -8, 8, color); // yếm trước
  bx(14, 19, -18, 18, 44, 48, 'bt_tire'); // ghi đông + tay nắm
  bx(-14, 12, -9, 9, 8, 18, 'bt_tire'); // sàn để chân + máy
  side([[-32, 20], [-8, 18], [-4, 30], [-30, 36]], -9, 9, color); // thân sau
  side([[-30, 36], [-4, 30], [-2, 34], [-28, 40]], -8, 8, 'bt_tire'); // yên
  bx(-35, -31, -5, 5, 26, 32, 'bt_plastic_r'); // đèn hậu
}

const BIKE_COLORS = ['bt_plastic_r', 'bt_plastic_b', 'wc_alu', 'bt_tire', 'bt_plastic_r', 'wc_alu', 'bt_steel'];
/** `n` xe đậu nối nhau dọc trục Y cách 36, lệch nhẹ theo X cho khỏi thẳng tắp. */
function bikes(x: number, y0: number, dir: 1 | -1, n: number, seed: number) {
  for (let i = 0; i < n; i++) bike(x + (((i * 7 + seed) % 3) - 1) * 3, y0 + i * 36, dir, BIKE_COLORS[(i + seed) % BIKE_COLORS.length]);
}

/**
 * Xe nâng vàng lái được (func_vehicle của CS): đứng lên sàn cabin rồi bấm E để cầm lái, W/S ga - lùi, A/D đánh lái.
 * Vẽ theo trục u (đuôi -> càng; càng hướng Tây vì func_vehicle coi -X của model là đầu xe), v ngang, gốc ở tâm cabin.
 * Khung nâng 2 tầng thép chữ C đen, xi lanh giữa, xích, giá đỡ có lưới tựa hàng, càng chữ L vuốt mỏng về mũi.
 */
function forklift(x: number, y: number) {
  const fk: Brush[] = [];
  const bx = (u0: number, u1: number, v0: number, v1: number, z0: number, z1: number, tex: TexSel) =>
    fk.push(box([x - u1, y + v0, z0], [x - u0, y + v1, z1], tex));
  const yl = { side: 'wc_yellow', top: 'wc_yellow' };
  bx(-64, 53, -32, 32, 8, 32, yl); // khung gầm, sàn cabin cao 32 (nhảy lên được)
  bx(-64, -36, -32, 32, 32, 72, yl); // đối trọng sau
  bx(-36, -20, -14, 14, 32, 48, 'bt_tire'); // nệm ghế
  bx(-38, -34, -14, 14, 48, 68, 'bt_tire'); // tựa ghế
  bx(32, 53, -32, 32, 32, 48, yl); // nắp capo trước
  bx(26, 30, -2, 2, 48, 60, 'wc_dark'); // trụ lái
  bx(22, 30, -10, 10, 60, 62, 'bt_tire'); // vô lăng
  for (const u of [-40, 44]) for (const v of [-32, 28]) bx(u, u + 4, v, v + 4, 32, 124, 'wc_dark'); // khung bảo vệ đầu
  bx(-42, 48, -32, 32, 124, 128, yl); // mái che: đứng trên sàn cabin (32) đầu người tới ~104 vẫn lọt
  for (const [u, r] of [[32, 16], [-43, 15]] as const)
    for (const [v0, v1] of [[-39, -32], [32, 39]]) fk.push(prism(octagon(x - u, r, r), 'y', y + v0, y + v1, 'bt_tire'));
  // Khung nâng: trụ ngoài chữ C (bụng + 2 cánh), trụ trong lồng vào, xích; 2 thanh giằng trên dưới
  for (const sg of [-1, 1]) {
    const V = (a: number, b: number): [number, number] => (sg > 0 ? [a, b] : [-b, -a]);
    bx(54, 64, ...V(27, 30), 12, 128, 'wc_dark');
    bx(54, 57, ...V(21, 27), 12, 128, 'wc_dark');
    bx(61, 64, ...V(21, 27), 12, 128, 'wc_dark');
    bx(57, 61, ...V(17, 21), 20, 132, 'bt_tire');
    bx(60, 61, ...V(8, 10), 40, 124, 'bt_steel');
  }
  for (const z of [12, 122]) bx(55, 63, -27, 27, z, z + 6, 'wc_dark');
  fk.push(prism(octagon(x - 56, y, 4), 'z', 18, 96, 'wc_dark')); // xi lanh
  fk.push(prism(octagon(x - 56, y, 2), 'z', 96, 122, 'wc_alu')); // ty ben
  // Giá đỡ càng + lưới tựa hàng
  for (const z of [24, 48]) bx(64, 68, -30, 30, z, z + 8, 'wc_dark');
  for (const v of [-30, -15, -1, 13, 27]) bx(64, 67, v, v + 3, 56, 96, 'wc_dark');
  bx(64, 67, -30, 30, 92, 96, 'wc_dark');
  // 2 càng chữ L: cán đứng trước giá, lưỡi nằm sát đất
  for (const v of [-22, 14]) {
    bx(68, 72, v, v + 8, 8, 56, 'bt_tire');
    bx(68, 130, v, v + 8, 8, 14, 'bt_tire');
    bx(130, 160, v + 1, v + 7, 8, 11, 'bt_tire');
  }
  fk.push(box([x - 4, y - 4, 12], [x + 4, y + 4, 20], 'ORIGIN'));
  // 2 path_track chỉ để đặt chỗ đỗ + hướng đầu xe lúc spawn (càng hướng Tây)
  point('path_track', [x, y, 0], { targetname: 'xenang_p1', target: 'xenang_p2' });
  point('path_track', [x - 200, y, 0], { targetname: 'xenang_p2' });
  ents.push({
    props: { classname: 'func_vehicle', targetname: 'xenang', target: 'xenang_p1', spawnflags: '1', sounds: '0', length: '192', width: '64', height: '16', speed: '260', acceleration: '5', dmg: '0', volume: '10', bank: '0' },
    brushes: fk,
  });
}

// ---------------------------------------------------------------- núi + tượng đài Nữ Tù Binh phía Nam (cảnh nền)
function mountain() {
  // 2 quả đồi kim tự tháp đáy lồi, ráp nhau ở x -100; đường Trung Tâm chạy tới chân đồi thì hết
  W(pyramid([[EDGE.x0, EDGE.y0], [-100, EDGE.y0], [-100, -1700], [-700, -1300], [EDGE.x0, -1600]], 0, [-1000, -2000, 900], 'wc_hill'));
  W(pyramid([[-100, EDGE.y0], [EDGE.x1, EDGE.y0], [EDGE.x1, -1500], [700, -1200], [-100, -1700]], 0, [800, -2000, 520], 'wc_hill'));
  // Tượng đài trên đỉnh núi chính: bệ đá + tượng đồng cách điệu (thân áo dài, đầu, tay giơ cao)
  const [mx, my] = [-1000, -2000];
  D(box([mx - 56, my - 56, 840], [mx + 56, my + 56, 940], { side: 'wc_wall_old', top: 'wc_concrete' }));
  for (const [r, z0, z1] of [[26, 940, 980], [20, 980, 1020], [15, 1020, 1052], [9, 1052, 1070]]) D(prism(octagon(mx, my, r), 'z', z0, z1, 'bt_bronze'));
  D(box([mx + 10, my - 4, 1030], [mx + 18, my + 4, 1104], 'bt_bronze'));
  // CLIP: cuối đoạn đường được đi + trên đỉnh tường rào Nam, không ai ra vùng núi
  W(box([EDGE.x0, -1516, 0], [FENCE.x0, -1500, SKY_TOP], 'CLIP'));
  W(box([FENCE.x0, BACK.y0 - T, 128], [KHO.x1, BACK.y0, 400], 'CLIP'));
}

/** Mái tôn vát nhỏ che mưa trên cửa WC (mặt tường y -920 hướng Bắc). */
function awning(x0: number, x1: number) {
  P(prism([[-920, 128], [-896, 120], [-896, 116], [-920, 124]], 'x', x0, x1, 'wc_tin_wh'));
}

// ---------------------------------------------------------------- spawn, rescue
function gameplay() {
  // Mỗi phe 16 điểm, cách nhau >= 144: engine chỉ coi điểm spawn là trống khi trong 128 unit không có ai,
  // hết điểm trống thì người spawn sau đè chết người đứng sẵn (telefrag).
  for (const x of [-1914, -1770]) for (let y = -540; y <= 468; y += 144) point('info_player_start', [x, y, 36], { angle: '0' });
  // T: 2 hàng cách 132 trong hành lang hẹp (y -920 / -788), cách nhau >= 132 theo cả 2 trục; hàng sau né 2 bậc cửa kho
  for (const x of [-300, -156, -12, 132, 276, 420, 564, 708, 852]) point('info_player_deathmatch', [x, -920, 36], { angle: '90' });
  for (const x of [-300, -156, -12, 276, 420, 708, 852]) point('info_player_deathmatch', [x, -788, 36], { angle: '90' });
  for (const y of [0, 360, 700]) point('info_hostage_rescue', [-1784, y, 36]);
  point('light_environment', [-1784, 0, 400], { angles: '-55 210 0', pitch: '-55', _light: '255 238 205 300', _diffuse_light: '175 200 235 80' });
}

/** Gợi ý waypoint bot: cổng, các cửa kho, cửa phòng KT, cửa phòng họp, đầu hẻm. Toạ độ = mặt sàn. */
export const WAYPOINT_HINTS: WaypointHints = {
  crossings: [[-1480, 360, 0], [348, -168, KB], [708, 0, BASE], [184, -752, KB], [584, -752, KB], [708, -580, KB], [708, -300, KB], [-640, -140, 0], [-500, -100, BASE], [-640, -800, 0]],
  // Dẫn đường cố định dọc hẻm WC + lối giữa nhà xe (lối hẹp, lưới đều dễ lệch khi nới map)
  // Nhà VP lùi về y -160 -> sân trước mở rộng, điểm đầu lối có đủ 8 link phía sân: thêm điểm giữa để chuỗi đi xuống không đứt
  points: [[-640, -160, 0], [-640, -290, 0], [-640, -420, 0], [-640, -640, 0], [-1054, 0, 0], [-1054, -150, 0], [-1054, -300, 0], [-1054, -600, 0], [-1054, -840, 0], [-1300, -300, 0], [-1300, -600, 0], [750, -230, KB], [750, -300, KB], [750, -380, KB], [750, -500, KB], [770, -660, KB], [750, -452, KB], [880, -452, KB], [938, -460, KB], [938, -560, KB], [938, -680, KB], [748, -580, KB]], // điểm cuối: ngay sau cửa phòng IT, đầu lối sát vách
  camps: [
    { at: [960, -370, KB], team: 'T', look: [[708, -300], [830, -230]] },
    { at: [-480, -80, BASE], team: 'T', look: [[-1480, 360], [-700, 0]] },
    { at: [-1534, 150, 0], team: 'CT', look: [[-1480, 360], [-1084, 360]] },
  ],
};

export function wecareMap(wads: string): Entity[] {
  for (const a of [world, detail, props, masked, illusion, glass, frosted, ents]) a.length = 0;
  shellAndGround();
  backdrops();
  westBuildings();
  frontBand();
  warehouse();
  backCorridor();
  outside();
  mountain();
  gameplay();
  return [
    { props: { classname: 'worldspawn', mapversion: '220', wad: wads, skyname: 'grnplsnt', message: 'Wecare', _minlight: '0.06' }, brushes: world },
    { props: { classname: 'func_detail', zhlt_detaillevel: '1' }, brushes: detail },
    { props: { classname: 'func_wall', zhlt_lightflags: '2' }, brushes: props },
    { props: { classname: 'func_wall', rendermode: '4', renderamt: '255' }, brushes: masked },
    // Kính bắn vỡ được: mỗi tấm 1 func_breakable (material 0 = kính), CS tự dựng lại đầu mỗi round
    ...glass.map((b) => ({ props: { classname: 'func_breakable', material: '0', health: '30', rendermode: '2', renderamt: '110' }, brushes: [b] })),
    { props: { classname: 'func_wall', rendermode: '2', renderamt: '170' }, brushes: frosted },
    { props: { classname: 'func_illusionary', rendermode: '4', renderamt: '255' }, brushes: illusion },
    ...ents,
  ];
}
