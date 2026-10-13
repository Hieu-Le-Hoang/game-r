// 5 môn phái MVP — mỗi phái đại diện 1 hệ, 1 hướng tu luyện (chốt 2026-10-13, gameplay.md mục 3)
// Tên skill lấy theo bản gốc; hiệu ứng / con số là [tự đặt].
//
// Skill:
//   shape  melee (1 mục tiêu) | cleave (mục tiêu + vùng quanh) | proj (n viên đạn hình quạt) | area (vùng tại mục tiêu) | nova (vùng quanh mình)
//   mult   [hệ số sát thương cấp 1, cộng thêm mỗi cấp]     mp [nội lực cấp 1, mỗi cấp]
//   fx     key animation trong atlas powers ('fireball' = 'fireball:power')
//   buff   { stat: [giá trị cấp 1, mỗi cấp] }, dur giây — tự bật lại khi auto
//   unlock cấp mở; q = id nhiệm vụ môn phái cần hoàn thành (xem data/quests.js)

export const SKILL_MAX = 10;

const basic = (o) => ({ id: 'basic', name: 'Đánh thường', lv: 1, type: 'atk', mult: [1, 0], mp: [0, 0], cd: 0, icon: 1, ...o });

export const PHAI = {
  thieulam: {
    name: 'Thiếu Lâm', elem: 'kim', genders: ['m'], weapon: 'con', main: 'str', ranged: false,
    outfit: { m: 'thieulam_m' }, envoy: { sprite: 'guild_man1', name: 'Sứ giả Thiếu Lâm', face: 'male04' },
    desc: 'Côn pháp cận chiến, máu dày, đánh lan và gây choáng.',
    skills: [
      basic({ shape: 'melee', range: 1.7, anim: 'swing', icon: 22 }),
      { id: 'tl1', name: 'La Hán Trận', lv: 10, type: 'atk', shape: 'cleave', range: 1.8, radius: 1.6, mult: [1.5, 0.12], mp: [6, 1], cd: 0, anim: 'swing', fx: 'cleave', icon: 33 },
      { id: 'tl2', name: 'Bất Động Minh Vương', lv: 20, q: 'p20', type: 'buff', buff: { def: [40, 15], resAll: [6, 1.2] }, dur: 60, mp: [30, 4], cd: 2, anim: 'cast', fx: 'shield', icon: 4 },
      { id: 'tl3', name: 'Sư Tử Hống', lv: 30, q: 'p30', type: 'atk', shape: 'nova', radius: 3.2, mult: [1.6, 0.14], mp: [22, 3], cd: 4, anim: 'cast', fx: 'blast', stun: 0.9, icon: 45 },
      { id: 'tl4', name: 'Long Hổ Trảo', lv: 40, q: 'p40', type: 'atk', shape: 'melee', range: 1.8, mult: [3.2, 0.25], mp: [18, 3], cd: 0, anim: 'swing', fx: 'spark_orange', icon: 31 },
      { id: 'tl5', name: 'Dịch Cân Kinh', lv: 50, q: 'p50', type: 'buff', buff: { hpPct: [10, 2], regen: [1, 0.3] }, dur: 90, mp: [40, 5], cd: 2, anim: 'cast', fx: 'runes_orange', icon: 15 },
      { id: 'tl6', name: 'Hoành Tảo Thiên Quân', lv: 55, q: 'xs', type: 'atk', shape: 'nova', radius: 3.6, mult: [3.4, 0.3], mp: [45, 5], cd: 1.5, anim: 'swing', fx: 'cleave', icon: 46 },
    ],
  },
  duongmon: {
    name: 'Đường Môn', elem: 'moc', genders: ['m', 'f'], weapon: 'dao', main: 'dex', ranged: true,
    outfit: { m: 'duongmon_m', f: 'duongmon_f' }, envoy: { sprite: 'wandering_trader1', name: 'Sứ giả Đường Môn', face: 'male02' },
    desc: 'Phi đao tầm xa, ra đòn nhanh, gây trúng độc.',
    skills: [
      basic({ shape: 'proj', range: 7, count: 1, speed: 14, anim: 'cast', fx: 'throw_knife', icon: 41 }),
      { id: 'dm1', name: 'Tiểu Lý Phi Đao', lv: 10, type: 'atk', shape: 'proj', range: 8, count: 1, speed: 16, mult: [1.5, 0.12], mp: [5, 1], cd: 0, anim: 'cast', fx: 'throw_knife', icon: 36 },
      { id: 'dm2', name: 'Thiên La Địa Võng', lv: 20, q: 'p20', type: 'atk', shape: 'area', range: 8, radius: 2.4, mult: [1.4, 0.12], mp: [20, 3], cd: 3, anim: 'cast', fx: 'spikes', slow: 0.5, icon: 43 },
      { id: 'dm3', name: 'Hàn Băng Thích', lv: 30, q: 'p30', type: 'atk', shape: 'proj', range: 8, count: 1, speed: 15, pierce: true, mult: [2.4, 0.2], mp: [14, 2], cd: 0, anim: 'cast', fx: 'icicle', slow: 0.4, icon: 24 },
      { id: 'dm4', name: 'Bạo Vũ Lê Hoa', lv: 40, q: 'p40', type: 'atk', shape: 'proj', range: 8, count: 5, spread: 0.5, speed: 15, mult: [1.5, 0.12], mp: [24, 3], cd: 0.6, anim: 'cast', fx: 'throw_knife', icon: 8 },
      { id: 'dm5', name: 'Mê Ảnh Tung', lv: 50, q: 'p50', type: 'buff', buff: { dodge: [60, 15], spd: [10, 1.5], aspd: [10, 1.5] }, dur: 90, mp: [40, 5], cd: 2, anim: 'cast', fx: 'dark_mist', icon: 9 },
      { id: 'dm6', name: 'Nhiếp Hồn Nguyệt Ảnh', lv: 55, q: 'xs', type: 'atk', shape: 'proj', range: 9, count: 7, spread: 0.9, speed: 17, pierce: true, mult: [2.2, 0.2], mp: [45, 5], cd: 1, anim: 'cast', fx: 'throw_knife', icon: 23 },
    ],
  },
  ngamy: {
    name: 'Nga My', elem: 'thuy', genders: ['f'], weapon: 'kiem', main: 'ene', ranged: false,
    outfit: { f: 'ngamy_f' }, envoy: { sprite: 'peasant_woman2', name: 'Sứ giả Nga My', face: 'female03' },
    desc: 'Kiếm pháp nội công kèm hồi phục, đánh băng làm chậm.',
    skills: [
      basic({ shape: 'melee', range: 1.6, anim: 'swing', icon: 5 }),
      { id: 'nm1', name: 'Nga My Kiếm Pháp', lv: 10, type: 'atk', shape: 'melee', range: 1.7, mult: [1.8, 0.14], mp: [5, 1], cd: 0, anim: 'swing', fx: 'spark_blue', icon: 5 },
      { id: 'nm2', name: 'Từ Hàng Phổ Độ', lv: 20, q: 'p20', type: 'heal', heal: [0.25, 0.03], mp: [30, 4], cd: 8, anim: 'cast', fx: 'heal', icon: 11 },
      { id: 'nm3', name: 'Phong Sương Toái Ảnh', lv: 30, q: 'p30', type: 'atk', shape: 'cleave', range: 1.8, radius: 2, mult: [2.2, 0.18], mp: [16, 2], cd: 0, anim: 'swing', fx: 'freeze', slow: 0.5, icon: 24 },
      { id: 'nm4', name: 'Phật Tâm Từ Hữu', lv: 40, q: 'p40', type: 'buff', buff: { resAll: [10, 1.5], regen: [1, 0.3] }, dur: 90, mp: [36, 4], cd: 2, anim: 'cast', fx: 'runes_blue', icon: 25 },
      { id: 'nm5', name: 'Tam Nga Tế Nguyệt', lv: 50, q: 'p50', type: 'atk', shape: 'proj', range: 7, count: 3, spread: 0.35, speed: 13, mult: [2.4, 0.2], mp: [26, 3], cd: 0.5, anim: 'cast', fx: 'icicle', icon: 26 },
      { id: 'nm6', name: 'Phổ Độ Chúng Sinh', lv: 55, q: 'xs', type: 'atk', shape: 'nova', radius: 3.6, mult: [3.2, 0.3], mp: [48, 5], cd: 1.5, anim: 'cast', fx: 'freeze', healSelf: 0.08, icon: 18 },
    ],
  },
  caibang: {
    name: 'Cái Bang', elem: 'hoa', genders: ['m', 'f'], weapon: 'bong', main: 'ene', ranged: true,
    outfit: { m: 'caibang_m', f: 'caibang_f' }, envoy: { sprite: 'peasant_man2', name: 'Sứ giả Cái Bang', face: 'male05' },
    desc: 'Chưởng lực tầm trung, sát thương hỏa lớn.',
    skills: [
      basic({ shape: 'proj', range: 5.5, count: 1, speed: 11, anim: 'cast', fx: 'spark_orange', icon: 31 }),
      { id: 'cb1', name: 'Giáng Long Chưởng', lv: 10, type: 'atk', shape: 'proj', range: 6.5, count: 1, speed: 12, mult: [1.7, 0.14], mp: [6, 1], cd: 0, anim: 'cast', fx: 'fireball', icon: 34 },
      { id: 'cb2', name: 'Đả Cẩu Trận', lv: 20, q: 'p20', type: 'atk', shape: 'nova', radius: 2.8, mult: [1.5, 0.13], mp: [20, 3], cd: 3, anim: 'swing', fx: 'blast', icon: 45 },
      { id: 'cb3', name: 'Hỗn Thiên Khí Công', lv: 30, q: 'p30', type: 'buff', buff: { atkPct: [12, 2], aspd: [8, 1.2] }, dur: 90, mp: [34, 4], cd: 2, anim: 'cast', fx: 'runes_orange', icon: 10 },
      { id: 'cb4', name: 'Phi Long Tại Thiên', lv: 40, q: 'p40', type: 'atk', shape: 'area', range: 7, radius: 2.6, mult: [2.6, 0.22], mp: [24, 3], cd: 0.8, anim: 'cast', fx: 'quake', icon: 39 },
      { id: 'cb5', name: 'Kháng Long Hữu Hối', lv: 50, q: 'p50', type: 'atk', shape: 'proj', range: 7, count: 1, speed: 13, pierce: true, mult: [3.4, 0.28], mp: [26, 3], cd: 0, anim: 'cast', fx: 'fireball', icon: 34 },
      { id: 'cb6', name: 'Thiên Hạ Vô Cẩu', lv: 55, q: 'xs', type: 'atk', shape: 'area', range: 7, radius: 3.6, mult: [3.6, 0.32], mp: [48, 5], cd: 1.2, anim: 'cast', fx: 'blast', icon: 37 },
    ],
  },
  vodang: {
    name: 'Võ Đang', elem: 'tho', genders: ['m', 'f'], weapon: 'kiem', main: 'str', ranged: false,
    outfit: { m: 'vodang_m', f: 'vodang_f' }, envoy: { sprite: 'wandering_trader2', name: 'Sứ giả Võ Đang', face: 'male01' },
    desc: 'Kiếm pháp cân bằng công thủ, đòn lôi gây choáng.',
    skills: [
      basic({ shape: 'melee', range: 1.6, anim: 'swing', icon: 5 }),
      { id: 'vd1', name: 'Võ Đang Kiếm Pháp', lv: 10, type: 'atk', shape: 'melee', range: 1.7, mult: [1.8, 0.14], mp: [5, 1], cd: 0, anim: 'swing', fx: 'spark_orange', icon: 5 },
      { id: 'vd2', name: 'Thất Tinh Trận', lv: 20, q: 'p20', type: 'atk', shape: 'nova', radius: 2.8, mult: [1.5, 0.13], mp: [20, 3], cd: 3, anim: 'cast', fx: 'runes', icon: 42 },
      { id: 'vd3', name: 'Tọa Vọng Vô Ngã', lv: 30, q: 'p30', type: 'buff', buff: { def: [35, 12], atkPct: [8, 1.5] }, dur: 90, mp: [34, 4], cd: 2, anim: 'cast', fx: 'shield', icon: 4 },
      { id: 'vd4', name: 'Thái Cực Kiếm', lv: 40, q: 'p40', type: 'atk', shape: 'cleave', range: 1.8, radius: 1.8, mult: [2.6, 0.22], mp: [18, 3], cd: 0, anim: 'swing', fx: 'thunderstrike', stun: 0.5, icon: 7 },
      { id: 'vd5', name: 'Nhân Kiếm Hợp Nhất', lv: 50, q: 'p50', type: 'atk', shape: 'proj', range: 7, count: 1, speed: 14, pierce: true, mult: [3.2, 0.26], mp: [26, 3], cd: 0, anim: 'swing', fx: 'lightning', icon: 35 },
      { id: 'vd6', name: 'Thiên Địa Vô Cực', lv: 55, q: 'xs', type: 'atk', shape: 'nova', radius: 3.8, mult: [3.4, 0.3], mp: [48, 5], cd: 1.5, anim: 'cast', fx: 'thunderstrike', stun: 0.6, icon: 7 },
    ],
  },
};
export const PHAI_IDS = Object.keys(PHAI);

// trước khi nhập phái: tân thủ đánh tay không
export const TANTHU = {
  name: 'Tân thủ', outfit: { m: 'tanthu_m', f: 'tanthu_f' },
  skills: [basic({ shape: 'melee', range: 1.5, anim: 'swing' })],
};

export function skillOf(phaiId, id) {
  const p = PHAI[phaiId] || TANTHU;
  return p.skills.find((s) => s.id === id) || p.skills[0];
}
export const lvVal = (pair, lvl) => pair[0] + pair[1] * Math.max(0, lvl - 1);
