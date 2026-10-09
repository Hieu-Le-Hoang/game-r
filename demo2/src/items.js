// Item roll: độ hiếm + affix ngẫu nhiên (kiểu Diablo), model lấy từ KayKit Adventurers

export const RAR = [
  { n: 'Thường', c: '#e6e1d6', hex: 0xe6e1d6 },
  { n: 'Ma thuật', c: '#5aa2ff', hex: 0x4d8dff },
  { n: 'Hiếm', c: '#ffd34d', hex: 0xffc83a },
  { n: 'Huyền thoại', c: '#ff8a2a', hex: 0xff7a1a },
];

export const BASES = {
  weapon: [
    { n: 'Kiếm Hiệp Sĩ', m: 'sword_1handed', d: [4, 7] },
    { n: 'Đại Kiếm', m: 'sword_2handed', d: [7, 12] },
    { n: 'Rìu Chiến', m: 'axe_1handed', d: [5, 9] },
    { n: 'Rìu Khổng Lồ', m: 'axe_2handed', d: [8, 13] },
    { n: 'Dao Găm', m: 'dagger', d: [3, 6] },
    { n: 'Trượng Pháp Sư', m: 'staff', d: [4, 8] },
    { n: 'Đũa Phép', m: 'wand', d: [3, 7] },
  ],
  shield: [
    { n: 'Khiên Tròn', m: 'shield_round', a: [3, 6] },
    { n: 'Khiên Gai', m: 'shield_spikes', a: [5, 9] },
    { n: 'Khiên Huy Hiệu', m: 'shield_badge', a: [4, 8] },
  ],
};

const PREFIX = [
  { k: 'dmgPct', n: 'Sắc Bén', r: [10, 40], t: (v) => `+${v}% sát thương` },
  { k: 'fire', n: 'Rực Lửa', r: [2, 9], t: (v) => `+${v} sát thương lửa` },
  { k: 'atkSpd', n: 'Thần Tốc', r: [6, 20], t: (v) => `+${v}% tốc độ đánh` },
  { k: 'ls', n: 'Khát Máu', r: [2, 6], t: (v) => `Hút ${v}% máu mỗi đòn` },
  { k: 'crit', n: 'Chí Mạng', r: [3, 10], t: (v) => `+${v}% tỉ lệ chí mạng` },
];
const SUFFIX = [
  { k: 'vit', n: 'của Gấu', r: [3, 14], t: (v) => `+${v} Thể lực` },
  { k: 'str', n: 'của Hổ', r: [3, 14], t: (v) => `+${v} Sức mạnh` },
  { k: 'dex', n: 'của Cáo', r: [3, 14], t: (v) => `+${v} Nhanh nhẹn` },
  { k: 'int', n: 'của Cú', r: [3, 14], t: (v) => `+${v} Trí tuệ` },
  { k: 'critDmg', n: 'của Đại Bàng', r: [10, 45], t: (v) => `+${v}% sát thương chí mạng` },
  { k: 'mf', n: 'của Thợ Săn', r: [5, 25], t: (v) => `+${v}% tỉ lệ rơi đồ hiếm` },
];
const RARE_A = ['Nanh', 'Bóng', 'Lời Nguyền', 'Vết Cắt', 'Tiếng Gầm', 'Móng'];
const RARE_B = ['Bão Tố', 'Huyết Nguyệt', 'Hư Không', 'Sấm Sét', 'Tro Tàn', 'Quạ Đen'];
export const LEGEND = [
  { n: 'Nanh Phượng Hoàng', p: 'Mỗi đòn đánh có 25% bắn ra cầu lửa', k: 'fireProc' },
  { n: 'Lưỡi Hái Tháng Bảy', p: 'Quái bị hạ phát nổ, gây sát thương xung quanh', k: 'boom' },
  { n: 'Gió Lốc Vĩnh Cửu', p: 'Kỹ năng Q không tốn mana', k: 'freeSkill' },
];

const rnd = Math.random;
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];
let uid = 1;

function rollRarity(boost = 0) {
  const x = rnd() * 100 - boost;
  return x < 2.5 ? 3 : x < 13 ? 2 : x < 42 ? 1 : 0;
}

export function potion() {
  return { id: uid++, kind: 'potion', m: 'bottle_A_green', rarity: 0, name: 'Bình Hồi Máu', ilvl: 1, affixes: [] };
}

export function rollItem(ilvl, opt = {}) {
  const r = opt.rarity ?? rollRarity(opt.boost || 0);
  if (!opt.kind && rnd() < 0.15) return potion();
  const kind = opt.kind || (rnd() < 0.28 ? 'shield' : 'weapon');
  const base = opt.base || pick(BASES[kind]);
  const sc = 1 + ilvl * 0.12 + r * 0.15;
  const it = { id: uid++, kind, m: base.m, base: base.n, rarity: r, ilvl, affixes: [] };
  if (kind === 'weapon') it.dmg = [Math.round(base.d[0] * sc), Math.round(base.d[1] * sc)];
  else it.armor = Math.round(rint(base.a[0], base.a[1]) * sc);
  const n = [0, rint(1, 2), rint(3, 4), 4][r];
  const pool = [...PREFIX.map((a) => ({ ...a, pre: true })), ...SUFFIX];
  for (let i = 0; i < n && pool.length; i++) {
    const a = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    const v = Math.round((a.r[0] + rnd() * (a.r[1] - a.r[0])) * (1 + ilvl * 0.05));
    it.affixes.push({ k: a.k, v, t: a.t(v), n: a.n, pre: !!a.pre });
  }
  if (r === 3) { const L = opt.legend || pick(LEGEND); it.name = L.n; it.power = L; }
  else if (r === 2) it.name = `${pick(RARE_A)} ${pick(RARE_B)}`;
  else {
    const pre = it.affixes.find((a) => a.pre), suf = it.affixes.find((a) => !a.pre);
    it.name = [base.n, pre && pre.n, suf && suf.n].filter(Boolean).join(' ');
  }
  return it;
}

export const sellPrice = (it) => 4 + it.rarity * 14 + it.ilvl;

// ---------- trạng thái nhân vật (sống qua đổi hero) ----------
export const S = {
  hero: 'Knight', lvl: 1, xp: 0, gold: 40, hp: 1, mp: 1,
  bag: [], eq: { weapon: null, shield: null },
  quest: 0, // 0 chưa nhận, 1 đang làm, 2 xong chờ trả, 3 đã trả
};
S.eq.weapon = rollItem(1, { kind: 'weapon', base: BASES.weapon[0], rarity: 0 });
S.eq.shield = rollItem(1, { kind: 'shield', base: BASES.shield[0], rarity: 0 });
S.bag.push(rollItem(3, { kind: 'weapon', base: BASES.weapon[3], rarity: 2 }));
S.bag.push(rollItem(2, { kind: 'weapon', base: BASES.weapon[5], rarity: 1 }));
S.bag.push(potion(), potion(), potion());

export function stats() {
  const s = { dmg: [1, 3], armor: 0, dmgPct: 0, fire: 0, atkSpd: 0, ls: 0, crit: 5, critDmg: 50, vit: 0, str: 0, dex: 0, int: 0, mf: 0, powers: {} };
  for (const it of [S.eq.weapon, S.eq.shield]) {
    if (!it) continue;
    if (it.dmg) s.dmg = it.dmg.slice();
    if (it.armor) s.armor += it.armor;
    for (const a of it.affixes) s[a.k] += a.v;
    if (it.power) s.powers[it.power.k] = true;
  }
  s.maxHp = 80 + S.lvl * 12 + s.vit * 5;
  s.maxMp = 50 + S.lvl * 8 + s.int * 3;
  s.crit += s.dex * 0.3;
  s.mult = 1 + (s.dmgPct + s.str) / 100;
  s.speed = 1.15 * (1 + s.atkSpd / 100);
  return s;
}
export const xpNeed = () => 30 + S.lvl * 25;
