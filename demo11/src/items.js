// Đồ kiểu MU: base theo class + bậc, cấp +0..+9 (ép bằng ngọc), Luck, Excellent (tên xanh lá).
// Không phụ thuộc Phaser.

// slot: main, off, head, chest, legs, hands, feet. cls: dk | dw. req: cấp tối thiểu.
// layer: sprite paperdoll Flare, icon: icons.png, loot: sprite rơi dưới đất.
const B = (k, n, cls, slot, req, layer, icon, loot, o) => ({ k, n, cls, slot, req, layer, icon, loot, ...o });

export const BASES = {};
[
  // Dark Knight: vũ khí
  B('kris', 'Kiếm Ngắn', 'dk', 'main', 1, 'shortsword', 97, 'shortsword', { dmg: [3, 7] }),
  B('katana', 'Katana', 'dk', 'main', 8, 'longsword', 98, 'longsword', { dmg: [9, 16] }),
  B('serpent', 'Kiếm Rắn', 'dk', 'main', 16, 'zweihander', 100, 'zweihander', { dmg: [17, 28] }),
  B('giant', 'Cự Kiếm', 'dk', 'main', 24, 'greatsword', 99, 'greatsword', { dmg: [28, 42] }),
  // khiên
  B('sshield', 'Khiên Nhỏ', 'dk', 'off', 1, 'buckler', 120, 'buckler', { def: 3 }),
  B('kite', 'Khiên Diều', 'dk', 'off', 10, 'kite_shield', 122, 'shield', { def: 8 }),
  B('tower', 'Khiên Tháp', 'dk', 'off', 20, 'shield', 123, 'shield', { def: 14 }),
  // Dark Wizard: gậy (mag = sát thương phép)
  B('skull', 'Gậy Đầu Lâu', 'dw', 'main', 1, 'wand', 104, 'wand', { mag: [4, 8] }),
  B('angelic', 'Gậy Thiên Thần', 'dw', 'main', 8, 'rod', 105, 'rod', { mag: [10, 18] }),
  B('sstaff', 'Gậy Rắn', 'dw', 'main', 16, 'staff', 106, 'staff', { mag: [18, 30] }),
  B('legstaff', 'Gậy Huyền Thoại', 'dw', 'main', 24, 'greatstaff', 107, 'greatstaff', { mag: [30, 46] }),
].forEach((b) => (BASES[b.k] = b));

// Bộ giáp: [tên bộ, cls, req, prefix layer, icon(head,chest,legs,hands,feet), def(head,chest,legs,hands,feet), loot]
const SETS = [
  ['Da', 'dk', 1, { head: 'leather_hood', chest: 'leather_chest', legs: 'leather_pants', hands: 'leather_gloves', feet: 'leather_boots' }, [144, 145, 147, 146, 148], [2, 4, 3, 1, 1], 'leather_armor'],
  ['Đồng', 'dk', 10, { head: 'chain_coif', chest: 'chain_cuirass', legs: 'chain_greaves', hands: 'chain_gloves', feet: 'chain_boots' }, [152, 153, 155, 154, 156], [5, 9, 7, 4, 4], 'steel_armor'],
  ['Thép', 'dk', 20, { head: 'plate_helm', chest: 'plate_cuirass', legs: 'plate_greaves', hands: 'plate_gauntlets', feet: 'plate_boots' }, [160, 161, 163, 162, 164], [9, 16, 12, 7, 7], 'steel_armor'],
  ['Vải', 'dw', 1, { chest: 'cloth_shirt', legs: 'cloth_pants', hands: 'cloth_gloves', feet: 'cloth_sandals' }, [0, 129, 131, 130, 132], [0, 3, 2, 1, 1], 'clothes'],
  ['Xương', 'dw', 10, { head: 'mage_hood', chest: 'mage_vest', legs: 'mage_skirt', hands: 'mage_sleeves', feet: 'mage_boots' }, [136, 137, 139, 138, 140], [4, 7, 5, 3, 3], 'clothes'],
  ['Nhân Sư', 'dw', 18, { head: 'mage_hood_alt1', chest: 'mage_vest_alt1', legs: 'mage_skirt_alt1', hands: 'mage_sleeves_alt1', feet: 'mage_boots_alt1' }, [184, 185, 187, 186, 188], [6, 11, 8, 5, 5], 'clothes'],
  ['Huyền Thoại', 'dw', 26, { head: 'mage_hood_alt2', chest: 'mage_vest_alt2', legs: 'mage_skirt_alt2', hands: 'mage_sleeves_alt2', feet: 'mage_boots_alt2' }, [192, 193, 195, 194, 196], [9, 15, 11, 7, 7], 'clothes'],
];
const PIECE = { head: 'Mũ', chest: 'Áo', legs: 'Quần', hands: 'Găng', feet: 'Giày' };
const ORDER = ['head', 'chest', 'legs', 'hands', 'feet'];
for (const [set, cls, req, layers, icons, defs, loot] of SETS) {
  ORDER.forEach((slot, i) => {
    if (!layers[slot]) return;
    const k = `${set}_${slot}`;
    BASES[k] = B(k, `${PIECE[slot]} ${set}`, cls, slot, req, layers[slot], icons[i], slot === 'feet' ? 'boots' : loot, { def: defs[i] });
  });
}

export const JEWELS = {
  bless: { k: 'bless', n: 'Ngọc Ước Nguyện', icon: 71, tint: 0x9fd0ff, desc: 'Kéo thả lên đồ để nâng cấp +0 → +6 (luôn thành công).' },
  soul: { k: 'soul', n: 'Ngọc Tâm Linh', icon: 68, tint: 0xd090ff, desc: 'Nâng đồ +6 → +9. Tỉ lệ 50%, đồ có May Mắn 75%. Thất bại: đồ về +0.' },
};
export const BOX = { k: 'box', n: 'Hộp Kundun', icon: 225, desc: 'Nhặt lên để mở: Zen, ngọc và đồ Excellent.' };

export const SLOTS = ['main', 'off', 'head', 'chest', 'legs', 'hands', 'feet'];
export const SLOT_NAME = { main: 'Vũ khí', off: 'Khiên', head: 'Mũ', chest: 'Áo', legs: 'Quần', hands: 'Găng', feet: 'Giày' };
export const DEFAULT_LAYER = { chest: 'default_chest', hands: 'default_hands', legs: 'default_legs', feet: 'default_feet', head: 'head_short' };

export const EXC_WEAPON = [
  { k: 'excRate', t: 'Tỉ lệ sát thương hoàn hảo +10%' },
  { k: 'dmgLvl', t: 'Tăng sát thương theo cấp (cấp/20)' },
  { k: 'dmgPct', t: 'Sát thương +2%' },
  { k: 'atkSpd', t: 'Tốc độ đánh +7' },
  { k: 'hpHunt', t: 'Hồi máu khi hạ quái (máu/8)' },
  { k: 'mpHunt', t: 'Hồi mana khi hạ quái (mana/8)' },
];
export const EXC_ARMOR = [
  { k: 'maxHp', t: 'Máu tối đa +4%' },
  { k: 'maxMp', t: 'Mana tối đa +4%' },
  { k: 'dd', t: 'Giảm sát thương nhận vào 4%' },
  { k: 'reflect', t: 'Phản sát thương 5%' },
  { k: 'dodge', t: 'Tỉ lệ né +10%' },
  { k: 'zen', t: 'Zen rơi +40%' },
];

let uid = 1;
export const nextId = () => uid++;
export const resetIds = (n = 1) => { uid = n; };

const pick = (a, r) => a[Math.floor(r() * a.length)];

export function makeItem(baseKey, o = {}) {
  return { id: nextId(), b: baseKey, lvl: o.lvl || 0, luck: !!o.luck, exc: o.exc || [] };
}
export function makeJewel(k) { return { id: nextId(), jewel: k }; }
export function makeBox() { return { id: nextId(), box: true }; }

/** Đồ rơi theo cấp quái. cls: class người chơi (75% rơi đồ đúng class). */
export function rollDrop(mlvl, cls, r = Math.random, o = {}) {
  const want = r() < 0.75 ? cls : cls === 'dk' ? 'dw' : 'dk';
  const pool = Object.values(BASES).filter((b) => b.cls === want && b.req <= mlvl + 3 && b.req >= mlvl - 14);
  const base = pool.length ? pick(pool, r) : pick(Object.values(BASES).filter((b) => b.cls === want && b.req === 1), r);
  const exc = [];
  if (o.exc || r() < 0.08) {
    const list = base.slot === 'main' ? EXC_WEAPON : EXC_ARMOR;
    const n = r() < 0.3 ? 2 : 1;
    const opts = list.slice();
    for (let i = 0; i < n; i++) exc.push(opts.splice(Math.floor(r() * opts.length), 1)[0].k);
  }
  const lvl = r() < 0.25 ? 1 + Math.floor(r() * 3) : 0;
  return makeItem(base.k, { lvl, luck: r() < 0.15, exc });
}

/** Ép ngọc. Trả { ok, msg, result: 'up' | 'fail' | 'invalid' }. Thay đổi it tại chỗ. */
export function applyJewel(jk, it, r = Math.random) {
  if (!it || it.jewel || it.box) return { ok: false, result: 'invalid', msg: 'Chỉ ép ngọc lên vũ khí, khiên hoặc giáp.' };
  if (jk === 'bless') {
    if (it.lvl >= 6) return { ok: false, result: 'invalid', msg: 'Ngọc Ước Nguyện chỉ nâng tới +6. Dùng Ngọc Tâm Linh.' };
    it.lvl++;
    return { ok: true, result: 'up', msg: `Thành công! ${itemName(it)}` };
  }
  if (jk === 'soul') {
    if (it.lvl < 6) return { ok: false, result: 'invalid', msg: 'Ngọc Tâm Linh dùng cho đồ +6 đến +8.' };
    if (it.lvl >= 9) return { ok: false, result: 'invalid', msg: 'Đồ đã đạt +9 (tối đa bản MVP).' };
    if (r() < soulRate(it)) { it.lvl++; return { ok: true, result: 'up', msg: `Thành công! ${itemName(it)}` }; }
    it.lvl = 0;
    return { ok: true, result: 'fail', msg: `Thất bại… ${itemName(it)} về +0` };
  }
  return { ok: false, result: 'invalid', msg: 'Không dùng được.' };
}
export const soulRate = (it) => (it.luck ? 0.75 : 0.5);

export const base = (it) => BASES[it.b];
export function itemName(it) {
  if (it.jewel) return JEWELS[it.jewel].n;
  if (it.box) return BOX.n;
  const b = base(it);
  return `${it.exc.length ? 'Excellent ' : ''}${b.n}${it.lvl ? ` +${it.lvl}` : ''}`;
}
/** Màu tên kiểu MU: trắng, xanh nhạt (+3), vàng (+7), xanh lá (Excellent). */
export function itemColor(it) {
  if (it.jewel || it.box) return '#f0d898';
  if (it.exc.length) return '#5ce65c';
  if (it.lvl >= 7) return '#f2d64b';
  if (it.lvl >= 3) return '#7cb8ff';
  return '#e8e2d2';
}
export const glowLevel = (it) => (it && !it.jewel && !it.box && it.lvl >= 7 ? it.lvl : 0);
export const GLOW = { 7: { c: 0x9fd8ff, s: 2.2 }, 8: { c: 0xffe080, s: 3 }, 9: { c: 0xff8040, s: 4 } };

/** Chỉ số thực của món đồ (đã cộng +N). */
export function itemStats(it) {
  const b = base(it), up = it.lvl * 3 + (it.lvl >= 7 ? (it.lvl - 6) * 2 : 0);
  const s = {};
  if (b.dmg) s.dmg = [b.dmg[0] + up, b.dmg[1] + up];
  if (b.mag) s.mag = [b.mag[0] + up, b.mag[1] + up];
  if (b.def) s.def = b.def + up;
  return s;
}
export function sellPrice(it) {
  if (it.jewel) return it.jewel === 'soul' ? 600 : 400;
  if (it.box) return 300;
  const b = base(it);
  return Math.round((20 + b.req * 12) * (1 + it.lvl * 0.5) * (it.exc.length ? 3 : 1));
}
export const canEquip = (it, cls, lvl) => !it.jewel && !it.box && base(it).cls === cls && base(it).req <= lvl;
