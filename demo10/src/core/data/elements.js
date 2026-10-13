// Ngũ hành — vòng sinh/khắc theo cẩm nang VLTK (xem demo10/gameplay.md mục 1.4)

export const ELEMS = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
export const ELEM = {
  kim: { name: 'Kim', res: 'Phổ phòng', color: '#f2d64b', tint: 0xffe27a },
  moc: { name: 'Mộc', res: 'Độc phòng', color: '#6fd36f', tint: 0x8cff8c },
  thuy: { name: 'Thủy', res: 'Băng phòng', color: '#5aa8ff', tint: 0x8cc8ff },
  hoa: { name: 'Hỏa', res: 'Hỏa phòng', color: '#ff6a3a', tint: 0xff9a6a },
  tho: { name: 'Thổ', res: 'Lôi phòng', color: '#d0a066', tint: 0xe8c08a },
};
// A sinh B: Mộc -> Hỏa -> Thổ -> Kim -> Thủy -> Mộc
export const SINH = { moc: 'hoa', hoa: 'tho', tho: 'kim', kim: 'thuy', thuy: 'moc' };
// A khắc B: Kim khắc Mộc, Mộc khắc Thổ, Thổ khắc Thủy, Thủy khắc Hỏa, Hỏa khắc Kim
export const KHAC = { kim: 'moc', moc: 'tho', tho: 'thuy', thuy: 'hoa', hoa: 'kim' };

// hệ số sát thương khi khắc chế [tự đặt]
export const KHAC_BONUS = 1.2;
export const BI_KHAC = 0.85;
export function elemMul(atk, def) {
  if (KHAC[atk] === def) return KHAC_BONUS;
  if (KHAC[def] === atk) return BI_KHAC;
  return 1;
}

// hiệu ứng phụ của đòn đánh theo hệ [tự đặt]: Mộc độc, Thủy làm chậm, Thổ choáng, Hỏa thiêu đốt, Kim chí mạng
export const ELEM_STATUS = {
  moc: { kind: 'poison', chance: 0.35, dur: 3, pct: 0.3 },
  thuy: { kind: 'slow', chance: 0.3, dur: 2, pct: 0.4 },
  tho: { kind: 'stun', chance: 0.15, dur: 0.7 },
  hoa: { kind: 'burn', chance: 0.3, dur: 2, pct: 0.2 },
  kim: { kind: 'crit', chance: 0.12, mul: 1.6 },
};
