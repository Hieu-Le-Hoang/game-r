// Trang bị, dòng thuộc tính, kích ẩn theo vòng tương sinh (gameplay.md mục 1.4, 1.7). Số liệu [tự đặt].
import { ELEMS, ELEM, SINH } from './data/elements.js';
import { PHAI } from './data/phai.js';

export const SLOTS = ['weapon', 'armor', 'helm', 'gloves', 'boots', 'belt', 'necklace', 'pendant', 'ring1', 'ring2'];
export const SLOT_NAME = {
  weapon: 'Vũ khí', armor: 'Áo', helm: 'Mũ', gloves: 'Bao tay', boots: 'Giày', belt: 'Thắt lưng',
  necklace: 'Dây chuyền', pendant: 'Ngọc bội', ring1: 'Nhẫn trên', ring2: 'Nhẫn dưới',
};
// ô nhận kích <- ô kích (5 cặp nối vòng: Áo+Dây chuyền -> Mũ+Vũ khí -> Giày+Nhẫn trên -> Bao tay+Ngọc bội -> Thắt lưng+Nhẫn dưới -> Áo+Dây chuyền)
export const KICH_SRC = {
  helm: 'armor', weapon: 'necklace', boots: 'helm', ring1: 'weapon', gloves: 'boots',
  pendant: 'ring1', belt: 'gloves', ring2: 'pendant', armor: 'belt', necklace: 'ring2',
};
const slotOfBase = (b) => (b === 'ring' ? 'ring1' : b);

export const TIER_LV = [1, 10, 20, 30, 40, 50];
export const tierFor = (lv) => { let t = 0; TIER_LV.forEach((l, i) => { if (lv >= l) t = i; }); return t; };

export const WEAPON_KIND = {
  con: { name: 'Côn', names: ['Mộc Côn', 'Tề Mi Côn', 'Thiết Côn', 'Huyền Thiết Côn', 'Hàn Ngọc Côn', 'Tử Kim Côn'], icons: [106, 106, 106, 107, 107, 107], loot: 'staff' },
  dao: { name: 'Phi đao', names: ['Phi Tiêu', 'Liễu Diệp Đao', 'Thiết Phi Đao', 'Truy Hồn Đao', 'Hàn Quang Đao', 'Tử Kim Phi Đao'], icons: [96, 96, 96, 96, 96, 96], loot: 'dagger' },
  kiem: { name: 'Kiếm', names: ['Đoản Kiếm', 'Thanh Phong Kiếm', 'Thiết Kiếm', 'Long Tuyền Kiếm', 'Hàn Quang Kiếm', 'Tử Kim Kiếm'], icons: [97, 97, 98, 98, 99, 99], loot: 'longsword' },
  bong: { name: 'Bổng', names: ['Trúc Bổng', 'Mộc Bổng', 'Thiết Bổng', 'Đả Cẩu Bổng', 'Hàn Ngọc Bổng', 'Tử Kim Bổng'], icons: [109, 109, 110, 110, 105, 105], loot: 'club' },
};
const BASES = {
  armor: { names: ['Bố Y', 'Bì Giáp', 'Hắc Bì Giáp', 'Liên Hoàn Giáp', 'Huyền Y', 'Tử Kim Bào'], icons: [129, 137, 145, 153, 185, 161], def: 1, loot: 'leather_armor' },
  helm: { names: ['Bố Cân', 'Bì Mạo', 'Hắc Bì Mạo', 'Thiết Khôi', 'Huyền Mạo', 'Tử Kim Quan'], icons: [136, 136, 144, 152, 184, 160], def: 0.5, loot: 'clothes' },
  gloves: { names: ['Bố Hộ Uyển', 'Bì Hộ Uyển', 'Hắc Bì Hộ Uyển', 'Thiết Hộ Uyển', 'Huyền Hộ Uyển', 'Tử Kim Hộ Uyển'], icons: [130, 138, 146, 154, 186, 162], def: 0.4, loot: 'clothes' },
  boots: { names: ['Bố Hài', 'Bì Ngoa', 'Hắc Bì Ngoa', 'Thiết Ngoa', 'Huyền Ngoa', 'Tử Kim Ngoa'], icons: [132, 140, 148, 156, 188, 164], def: 0.4, loot: 'boots' },
  belt: { names: ['Bố Đai', 'Bì Đai', 'Hắc Bì Đai', 'Thiết Đai', 'Huyền Đai', 'Tử Kim Đai'], icons: [208, 208, 208, 208, 208, 208], def: 0.3, loot: 'belt' },
  necklace: { names: ['Đồng Hạng Liên', 'Ngân Hạng Liên', 'Ngọc Hạng Liên', 'Phỉ Thúy Hạng Liên', 'Bích Ngọc Hạng Liên', 'Tử Kim Hạng Liên'], icons: [212, 213, 214, 215, 212, 213], loot: 'gem' },
  pendant: { names: ['Thạch Bội', 'Ngọc Bội', 'Huyết Ngọc Bội', 'Bích Ngọc Bội', 'Lam Ngọc Bội', 'Tử Ngọc Bội'], icons: [219, 218, 216, 217, 219, 216], loot: 'gem' },
  ring: { names: ['Đồng Giới Chỉ', 'Ngân Giới Chỉ', 'Ngọc Giới Chỉ', 'Hồng Ngọc Giới Chỉ', 'Lam Ngọc Giới Chỉ', 'Tử Kim Giới Chỉ'], icons: [198, 199, 200, 202, 204, 207], loot: 'ring' },
};
const WEAPON_DMG = [8, 20, 36, 56, 80, 108];
const ARMOR_DEF = [10, 26, 46, 70, 98, 130];

// Dòng thuộc tính: giá trị tối đa theo cấp món đồ L; khi roll lấy 60-100%
export const AFFIX = {
  atkFlat: { name: 'Sát thương', f: (L) => 2 + L * 0.9 },
  atkPct: { name: 'Sát thương', pct: true, f: (L) => 4 + L * 0.18 },
  hp: { name: 'Sinh lực', f: (L) => 15 + L * 6 },
  mp: { name: 'Nội lực', f: (L) => 10 + L * 3 },
  def: { name: 'Phòng thủ', f: (L) => 5 + L * 1.6 },
  acc: { name: 'Chính xác', f: (L) => 10 + L * 4 },
  dodge: { name: 'Né tránh', f: (L) => 6 + L * 2 },
  resAll: { name: 'Kháng tất cả', pct: true, f: (L) => 2 + L * 0.12 },
  str: { name: 'Sức mạnh', f: (L) => 2 + L * 0.25 },
  dex: { name: 'Thân pháp', f: (L) => 2 + L * 0.25 },
  vit: { name: 'Sinh khí', f: (L) => 2 + L * 0.25 },
  ene: { name: 'Nội công', f: (L) => 2 + L * 0.25 },
  spd: { name: 'Tốc độ di chuyển', pct: true, f: (L) => 4 + L * 0.1 },
  aspd: { name: 'Tốc độ xuất chiêu', pct: true, f: (L) => 3 + L * 0.12 },
  leech: { name: 'Hút sinh lực', pct: true, f: (L) => 1 + L * 0.05 },
  crit: { name: 'Chí mạng', pct: true, f: (L) => 2 + L * 0.06 },
};
for (const e of ELEMS) AFFIX['res_' + e] = { name: `Kháng ${ELEM[e].name.toLowerCase()}`, pct: true, f: (L) => 4 + L * 0.28 };
export const RES_KEYS = ELEMS.map((e) => 'res_' + e);

const POOL = {
  weapon: ['atkFlat', 'atkPct', 'acc', 'leech', 'crit', 'aspd', 'str', 'dex', 'ene'],
  armor: ['hp', 'def', 'resAll', 'vit', ...RES_KEYS],
  helm: ['hp', 'mp', 'ene', ...RES_KEYS],
  gloves: ['aspd', 'acc', 'atkFlat', 'str', 'crit'],
  boots: ['spd', 'dodge', 'dex', ...RES_KEYS],
  belt: ['hp', 'mp', 'vit', 'def', ...RES_KEYS],
  necklace: ['resAll', 'hp', 'mp', ...RES_KEYS],
  pendant: ['resAll', 'dodge', 'ene', ...RES_KEYS],
  ring: ['atkFlat', 'acc', 'crit', 'leech', 'str', 'dex', 'vit', 'ene'],
};

export const RARITY = {
  white: { name: 'Thường', color: '#e8e2d2' },
  blue: { name: 'Xanh', color: '#7ca8ff' },
  gold: { name: 'Hoàng Kim', color: '#f2c94c' },
};

// Bộ Hoàng Kim theo phái (rơi từ boss) — tên bộ [tự đặt]
export const GOLD_SETS = {
  thieulam: 'Phục Ma', duongmon: 'Truy Hồn', ngamy: 'Tịnh Thủy', caibang: 'Hàng Long', vodang: 'Thái Cực',
};
const GOLD_PIECES = ['weapon', 'armor', 'helm', 'ring'];
export const GOLD_BONUS = [ // số món đang mặc -> thưởng thêm
  [2, { atkPct: 10 }], [3, { resAll: 10 }], [4, { hpPct: 15, aspd: 10 }],
];

let UID = 1;
export const newUid = () => `${Date.now().toString(36)}${(UID++).toString(36)}`;

function rollLines(rng, base, L, elem, n, used) {
  const pool = POOL[base].filter((k) => !used.has(k));
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    // dòng kháng cùng hệ món đồ ra nhiều gấp đôi
    const weighted = pool.flatMap((k) => (k === 'res_' + elem ? [k, k] : [k]));
    const k = rng.pick(weighted);
    pool.splice(pool.indexOf(k), 1);
    used.add(k);
    out.push({ k, v: Math.max(1, Math.round(AFFIX[k].f(L) * (0.6 + rng() * 0.4))) });
  }
  return out;
}

/** Tạo trang bị. base: 'weapon' | 'armor' | ... | 'ring'. o: { kind (loại vũ khí), rarity, elem, phai (cho Hoàng Kim) } */
export function makeItem(rng, base, L, o = {}) {
  const tier = tierFor(L);
  const elem = o.elem || rng.pick(ELEMS);
  const rarity = o.rarity || 'white';
  const it = { uid: newUid(), base, slot: slotOfBase(base), tier, lvReq: TIER_LV[tier], ilvl: L, elem, rarity, lines: [] };
  if (base === 'weapon') {
    const kind = o.kind || rng.pick(Object.keys(WEAPON_KIND));
    const K = WEAPON_KIND[kind];
    Object.assign(it, { kind, name: K.names[tier], icon: K.icons[tier], loot: K.loot });
    const d = WEAPON_DMG[tier];
    it.atk = [Math.round(d * 0.8), Math.round(d * 1.2)];
  } else {
    const B = BASES[base];
    Object.assign(it, { name: B.names[tier], icon: B.icons[tier], loot: B.loot });
    if (B.def) it.def = Math.round(ARMOR_DEF[tier] * B.def);
  }
  const used = new Set();
  if (rarity === 'blue') {
    it.lines = rollLines(rng, base, L, elem, rng.int(1, 3), used);
    it.lines.push(...rollLines(rng, base, L, elem, rng.int(1, 3), used).map((l) => ({ ...l, hidden: true })));
  } else if (rarity === 'gold') {
    const set = GOLD_SETS[o.phai];
    it.set = o.phai;
    it.name = `${set} ${SLOT_NAME[it.slot].toLowerCase()}`;
    if (base === 'weapon') it.name = `${set} ${WEAPON_KIND[it.kind].name}`;
    it.lvReq = Math.min(L, 55);
    it.lines = rollLines(rng, base, L * 1.3, elem, 3, used).map((l) => ({ ...l, v: Math.round(AFFIX[l.k].f(L * 1.3)) }));
    it.lines.push(...rollLines(rng, base, L * 1.3, elem, 2, used).map((l) => ({ ...l, hidden: true })));
  }
  it.price = itemPrice(it);
  return it;
}

export function itemPrice(it) {
  if (it.stack) return CONSUMABLE[it.id].price;
  const r = it.rarity === 'gold' ? 8 : it.rarity === 'blue' ? 2.5 : 1;
  return Math.round((12 + it.ilvl * it.ilvl * 0.6 + it.ilvl * 4) * r);
}
export const sellPrice = (it) => Math.max(1, Math.floor((it.stack ? CONSUMABLE[it.id].price * it.qty : it.price) * 0.25));

/** Đồ rơi từ quái cấp L */
export function rollDrop(rng, L, phai) {
  const r = rng();
  const rarity = r < 0.22 ? 'blue' : 'white';
  const bases = ['weapon', 'armor', 'helm', 'gloves', 'boots', 'belt', 'necklace', 'pendant', 'ring'];
  const base = rng.pick(bases);
  const kind = base === 'weapon' && phai && rng() < 0.6 ? PHAI[phai].weapon : undefined;
  return makeItem(rng, base, Math.max(1, L + rng.int(-2, 2)), { rarity, kind });
}
export function goldDrop(rng, phai) {
  const base = rng.pick(GOLD_PIECES);
  return makeItem(rng, base, 58, { rarity: 'gold', phai, kind: base === 'weapon' ? PHAI[phai].weapon : undefined });
}

// ---------- vật phẩm tiêu hao (xếp chồng) ----------
export const CONSUMABLE = {
  hp1: { name: 'Kim Sáng Dược (tiểu)', icon: 64, hp: 150, price: 8 },
  hp2: { name: 'Kim Sáng Dược (trung)', icon: 84, hp: 450, price: 30, lv: 20 },
  hp3: { name: 'Kim Sáng Dược (đại)', icon: 85, hp: 1100, price: 90, lv: 40 },
  mp1: { name: 'Thanh Tâm Tán (tiểu)', icon: 65, mp: 80, price: 8 },
  mp2: { name: 'Thanh Tâm Tán (trung)', icon: 86, mp: 240, price: 30, lv: 20 },
  mp3: { name: 'Thanh Tâm Tán (đại)', icon: 87, mp: 560, price: 90, lv: 40 },
  tdp: { name: 'Thổ Địa Phù', icon: 72, price: 40, desc: 'Về thành gần nhất. Xa phu đưa quay lại được chỗ cũ.' },
};
export const STACK_MAX = 50;
export const makeStack = (id, qty = 1) => ({ uid: newUid(), stack: true, id, qty, name: CONSUMABLE[id].name, icon: CONSUMABLE[id].icon });

// ---------- kích ẩn ----------
/** Trả về set slot có dòng ẩn đang được kích */
export function activeHidden(eq) {
  const goldCount = countGold(eq);
  const on = new Set();
  for (const s of SLOTS) {
    const it = eq[s];
    if (!it || !it.lines.some((l) => l.hidden)) continue;
    const src = eq[KICH_SRC[s]];
    if ((src && SINH[src.elem] === it.elem) || (it.rarity === 'gold' && goldCount.n >= 2)) on.add(s);
  }
  return on;
}
export function countGold(eq) {
  const by = {};
  for (const s of SLOTS) if (eq[s]?.rarity === 'gold') by[eq[s].set] = (by[eq[s].set] || 0) + 1;
  const best = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
  return { set: best?.[0], n: best?.[1] || 0 };
}

export function canEquip(it, ch) {
  if (it.stack) return 'Không mặc được';
  if (ch.lv < it.lvReq) return `Cần cấp ${it.lvReq}`;
  if (it.base === 'weapon' && ch.phai && PHAI[ch.phai].weapon !== it.kind) return `${PHAI[ch.phai].name} không dùng ${WEAPON_KIND[it.kind].name.toLowerCase()}`;
  return null;
}

/** Điểm đánh giá nhanh 1 món (auto/selftest so sánh đồ) */
export function itemScore(it) {
  if (!it || it.stack) return 0;
  let s = (it.atk ? (it.atk[0] + it.atk[1]) * 1.5 : 0) + (it.def || 0);
  for (const l of it.lines) s += (l.hidden ? 0.5 : 1) * l.v / AFFIX[l.k].f(it.ilvl) * (8 + it.ilvl * 1.2);
  return s;
}
