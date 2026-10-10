// Item roll kiểu Diablo: độ hiếm + affix ngẫu nhiên. Mỗi base gắn với layer paper-doll của Flare.

export const RAR = [
  { n: 'Thường', c: '#e8e2d2' },
  { n: 'Ma thuật', c: '#7c8cff' },
  { n: 'Hiếm', c: '#f2d64b' },
  { n: 'Độc nhất', c: '#c7a35a' },
];

// slot -> danh sách base: layer (sprite trên người), icon (icons.png), loot (sprite rơi dưới đất)
export const BASES = {
  main: [
    { n: 'Đoản Kiếm', layer: 'shortsword', icon: 97, loot: 'shortsword', d: [3, 6] },
    { n: 'Trường Kiếm', layer: 'longsword', icon: 98, loot: 'longsword', d: [5, 9] },
    { n: 'Đại Kiếm', layer: 'greatsword', icon: 99, loot: 'greatsword', d: [8, 14] },
    { n: 'Rìu Tay', layer: 'hand_axe', icon: 117, loot: 'hand_axe', d: [4, 8] },
    { n: 'Chùy Sắt', layer: 'mace', icon: 111, loot: 'mace', d: [5, 9] },
    { n: 'Búa Chiến', layer: 'war_hammer', icon: 102, loot: 'war_hammer', d: [7, 12] },
    { n: 'Trượng', layer: 'staff', icon: 104, loot: 'staff', d: [3, 7], magic: true },
  ],
  off: [
    { n: 'Khiên Nhỏ', layer: 'buckler', icon: 120, loot: 'buckler', a: [2, 4] },
    { n: 'Khiên Diều', layer: 'kite_shield', icon: 122, loot: 'shield', a: [4, 7] },
    { n: 'Khiên Tháp', layer: 'shield', icon: 123, loot: 'shield', a: [5, 9] },
  ],
  head: [
    { n: 'Mũ Da', layer: 'leather_hood', icon: 136, loot: 'clothes', a: [1, 3] },
    { n: 'Mũ Xích', layer: 'chain_coif', icon: 152, loot: 'steel_armor', a: [3, 5] },
    { n: 'Mũ Giáp', layer: 'plate_helm', icon: 160, loot: 'steel_armor', a: [5, 8] },
  ],
  chest: [
    { n: 'Áo Da', layer: 'leather_chest', icon: 137, loot: 'leather_armor', a: [3, 6] },
    { n: 'Giáp Xích', layer: 'chain_cuirass', icon: 153, loot: 'steel_armor', a: [6, 10] },
    { n: 'Giáp Tấm', layer: 'plate_cuirass', icon: 161, loot: 'steel_armor', a: [10, 15] },
  ],
  hands: [
    { n: 'Găng Da', layer: 'leather_gloves', icon: 138, loot: 'clothes', a: [1, 2] },
    { n: 'Găng Xích', layer: 'chain_gloves', icon: 154, loot: 'steel_armor', a: [2, 4] },
    { n: 'Găng Giáp', layer: 'plate_gauntlets', icon: 162, loot: 'steel_armor', a: [3, 6] },
  ],
  legs: [
    { n: 'Quần Da', layer: 'leather_pants', icon: 139, loot: 'clothes', a: [2, 4] },
    { n: 'Xà Cạp Xích', layer: 'chain_greaves', icon: 155, loot: 'steel_armor', a: [4, 7] },
    { n: 'Xà Cạp Giáp', layer: 'plate_greaves', icon: 163, loot: 'steel_armor', a: [6, 10] },
  ],
  feet: [
    { n: 'Ủng Da', layer: 'leather_boots', icon: 140, loot: 'boots', a: [1, 2] },
    { n: 'Ủng Xích', layer: 'chain_boots', icon: 156, loot: 'boots', a: [2, 4] },
    { n: 'Ủng Giáp', layer: 'plate_boots', icon: 164, loot: 'boots', a: [3, 6] },
  ],
};
export const SLOTS = ['head', 'chest', 'hands', 'legs', 'feet', 'main', 'off'];
export const SLOT_NAME = { head: 'Mũ', chest: 'Giáp', hands: 'Găng', legs: 'Quần', feet: 'Ủng', main: 'Vũ khí', off: 'Khiên' };
export const DEFAULT_LAYER = { chest: 'default_chest', hands: 'default_hands', legs: 'default_legs', feet: 'default_feet', head: 'head_short' };

const PREFIX = [
  { k: 'dmgPct', n: 'Sắc Bén', r: [10, 40], t: (v) => `+${v}% sát thương` },
  { k: 'fire', n: 'Hỏa Ngục', r: [2, 9], t: (v) => `+${v} sát thương lửa` },
  { k: 'atkSpd', n: 'Thần Tốc', r: [6, 20], t: (v) => `+${v}% tốc độ đánh` },
  { k: 'ls', n: 'Ma Cà Rồng', r: [2, 6], t: (v) => `Hút ${v}% máu mỗi đòn` },
  { k: 'armorPct', n: 'Kiên Cố', r: [10, 35], t: (v) => `+${v}% giáp` },
];
const SUFFIX = [
  { k: 'vit', n: 'của Gấu', r: [3, 14], t: (v) => `+${v} Thể lực` },
  { k: 'str', n: 'của Hổ', r: [3, 14], t: (v) => `+${v} Sức mạnh` },
  { k: 'dex', n: 'của Cáo', r: [3, 14], t: (v) => `+${v} Nhanh nhẹn` },
  { k: 'ene', n: 'của Cú', r: [3, 14], t: (v) => `+${v} Năng lượng` },
  { k: 'mf', n: 'của Thợ Săn', r: [5, 25], t: (v) => `+${v}% tìm đồ hiếm` },
];
const RARE_A = ['Nanh', 'Bóng', 'Lời Nguyền', 'Vết Thương', 'Tiếng Thét', 'Móng Vuốt'];
const RARE_B = ['Bão Tố', 'Huyết Nguyệt', 'Hư Không', 'Sấm Sét', 'Tro Tàn', 'Quạ Đen'];
const UNIQUE = [
  { n: 'Lưỡi Hái Của Ardwen', p: 'Quái bị hạ phát nổ, gây sát thương xung quanh', k: 'boom' },
  { n: 'Tim Lửa Lochport', p: 'Mỗi đòn đánh có 25% phóng cầu lửa', k: 'fireProc' },
  { n: 'Ấn Tín Người Giữ Mộ', p: 'Hồi 2% máu mỗi khi hạ quái', k: 'leech' },
];

const rnd = Math.random;
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];
let uid = 1;

function rollRarity(boost = 0) {
  const x = rnd() * 100 - boost;
  return x < 3 ? 3 : x < 14 ? 2 : x < 42 ? 1 : 0;
}
export function potion() {
  return { id: uid++, slot: 'potion', icon: 64, loot: 'hp_potion', rarity: 0, name: 'Bình Hồi Máu', ilvl: 1, affixes: [] };
}
export function rollItem(ilvl, opt = {}) {
  if (!opt.slot && rnd() < 0.16) return potion();
  const slot = opt.slot || pick(SLOTS);
  const r = opt.rarity ?? rollRarity(opt.boost || 0);
  const base = opt.base || pick(BASES[slot]);
  const sc = 1 + ilvl * 0.12 + r * 0.15;
  const it = { id: uid++, slot, layer: base.layer, icon: base.icon, loot: base.loot, base: base.n, rarity: r, ilvl, affixes: [], magic: !!base.magic };
  if (base.d) it.dmg = [Math.round(base.d[0] * sc), Math.round(base.d[1] * sc)];
  else it.armor = Math.round(rint(base.a[0], base.a[1]) * sc);
  const n = [0, rint(1, 2), rint(3, 4), 4][r];
  const pool = [...PREFIX.map((a) => ({ ...a, pre: true })), ...SUFFIX];
  for (let i = 0; i < n && pool.length; i++) {
    const a = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    const v = Math.round((a.r[0] + rnd() * (a.r[1] - a.r[0])) * (1 + ilvl * 0.05));
    it.affixes.push({ k: a.k, v, t: a.t(v), n: a.n, pre: !!a.pre });
  }
  if (r === 3) { const U = opt.unique || pick(UNIQUE); it.name = U.n; it.power = U; }
  else if (r === 2) it.name = `${pick(RARE_A)} ${pick(RARE_B)}`;
  else {
    const pre = it.affixes.find((a) => a.pre), suf = it.affixes.find((a) => !a.pre);
    it.name = [base.n, pre && pre.n, suf && suf.n].filter(Boolean).join(' ');
  }
  return it;
}
export const sellPrice = (it) => 5 + it.rarity * 18 + it.ilvl * 2;
export { UNIQUE };

// ---------- trạng thái nhân vật ----------
export const S = {
  lvl: 1, xp: 0, gold: 0, hp: 1, mp: 1,
  eq: { head: null, chest: null, hands: null, legs: null, feet: null, main: null, off: null },
  bag: [],
  quest: 0, // 0 chưa nhận, 1 đang săn Ardwen, 2 đã hạ, 3 đã trả
};
S.eq.main = rollItem(1, { slot: 'main', base: BASES.main[0], rarity: 0 });
S.eq.off = rollItem(1, { slot: 'off', base: BASES.off[0], rarity: 0 });
S.eq.chest = rollItem(1, { slot: 'chest', base: BASES.chest[0], rarity: 0 });
S.eq.legs = rollItem(1, { slot: 'legs', base: BASES.legs[0], rarity: 0 });
S.bag.push(potion(), potion(), potion());

export function stats() {
  const s = { dmg: [1, 3], armor: 0, armorPct: 0, dmgPct: 0, fire: 0, atkSpd: 0, ls: 0, vit: 0, str: 0, dex: 0, ene: 0, mf: 0, powers: {}, magic: false };
  for (const it of Object.values(S.eq)) {
    if (!it) continue;
    if (it.dmg) { s.dmg = it.dmg.slice(); s.magic = it.magic; }
    if (it.armor) s.armor += it.armor;
    for (const a of it.affixes) s[a.k] += a.v;
    if (it.power) s.powers[it.power.k] = true;
  }
  s.armor = Math.round(s.armor * (1 + s.armorPct / 100));
  s.maxHp = 70 + S.lvl * 12 + s.vit * 4;
  s.maxMp = 40 + S.lvl * 6 + s.ene * 3;
  s.crit = 5 + s.dex * 0.35;
  s.mult = 1 + (s.dmgPct + s.str) / 100;
  s.speed = 1 + s.atkSpd / 100;
  return s;
}
export const xpNeed = () => 40 + S.lvl * 30;
