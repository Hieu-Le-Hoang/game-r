// Bản đồ, NPC, cửa hàng. Map lấy từ Flare (tools/build_assets.py MAPS), tên + cấp quái là [tự đặt].

export const MAPS = {
  balang: { name: 'Ba Lăng Huyện', town: true, music: 'town' },
  tuongduong: { name: 'Tương Dương', town: true, music: 'town' },
  m1: { name: 'Ngoại Ô Ba Lăng', lv: [1, 10], mons: ['sontac', 'dochat', 'cuongthi'], back: 'balang', density: 5 },
  m2: { name: 'Phục Ngưu Sơn', lv: [10, 25], mons: ['cuongdao', 'cungthu', 'daumuc', 'bocap', 'hoanghi'], back: 'tuongduong', density: 9 },
  m3: { name: 'Thiên Sơn Tuyết Lĩnh', lv: [25, 45], mons: ['bangnghi', 'bangthi', 'banghon', 'khovo', 'uhon'], back: 'tuongduong', density: 4 },
  m4: { name: 'Lão Hổ Động', lv: [45, 60], mons: ['khocung', 'hoahon', 'thietgiap', 'hoalong', 'khovo'], back: 'tuongduong', density: 4, boss: { type: 'nguuma', lv: 60, respawn: 600 } },
};
export const TRAIN_MAPS = ['m1', 'm2', 'm3', 'm4'];
export const mapForLevel = (lv) => TRAIN_MAPS.find((m) => lv < MAPS[m].lv[1]) || 'm4';

// NPC chức năng trong thành. role: shop (bán hàng), stash (rương), travel (xa phu), quest (nhiệm vụ tân thủ), envoy (sứ giả môn phái)
const BASE_NPCS = [
  { role: 'travel', name: 'Xa Phu', sprite: 'peasant_man1', face: 'male03' },
  { role: 'shop', shop: 'duoc', name: 'Dược Điếm', sprite: 'peasant_woman1', face: 'female01' },
  { role: 'shop', shop: 'taphoa', name: 'Tạp Hóa', sprite: 'wandering_trader', face: 'male02' },
  { role: 'shop', shop: 'thoren', name: 'Thợ Rèn', sprite: 'guild_man2', face: 'male05' },
  { role: 'stash', name: 'Thủ Khố', sprite: 'guild_man', face: 'male01' },
];
export const TOWN_NPCS = {
  balang: [...BASE_NPCS, { role: 'quest', name: 'Lý Bộ Đầu', sprite: 'knight', face: 'male04' }],
  tuongduong: [...BASE_NPCS, { role: 'envoys' }],   // 5 sứ giả môn phái lấy từ PHAI[*].envoy
};

// Xa phu: giá theo số chặng [tự đặt]
export const TRAVEL = ['balang', 'tuongduong', 'm1', 'm2', 'm3', 'm4'];
export const travelCost = (from, to) => (from === to ? 0 : 4 + 6 * Math.abs(TRAVEL.indexOf(from) - TRAVEL.indexOf(to)));
