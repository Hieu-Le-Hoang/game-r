// Quái — sprite Flare, tên/hệ theo VLTK [tự đặt]. Chỉ số tính theo cấp trong monStats().
// atk: animation đánh; ranged: key hiệu ứng đạn (atlas powers) nếu đánh xa; tint/alpha: biến thể màu (thay color_mod của Flare)

export const MONSTERS = {
  sontac: { name: 'Sơn Tặc', sprite: 'goblin', elem: 'tho', atk: 'swing' },
  dochat: { name: 'Độc Hạt', sprite: 'antlion_small', elem: 'moc', atk: 'swing', hp: 0.8 },
  cuongthi: { name: 'Cương Thi', sprite: 'zombie', elem: 'tho', atk: 'swing', hp: 1.3, spd: 0.7 },
  cuongdao: { name: 'Cường Đạo', sprite: 'hobgoblin', elem: 'kim', atk: 'swing', hp: 1.1 },
  cungthu: { name: 'Cường Đạo Cung Thủ', sprite: 'hobgoblin_archer', elem: 'kim', atk: 'shoot', ranged: 'arrows', range: 6, hp: 0.8 },
  daumuc: { name: 'Sơn Tặc Đầu Mục', sprite: 'goblin_elite', elem: 'tho', atk: 'swing', hp: 1.4, dmg: 1.15 },
  bocap: { name: 'Bọ Cạp Độc', sprite: 'antlion', elem: 'moc', atk: 'swing', hp: 1.2 },
  hoanghi: { name: 'Hỏa Nghĩ', sprite: 'fire_ant', elem: 'hoa', atk: 'swing' },
  bangnghi: { name: 'Băng Nghĩ', sprite: 'ice_ant', elem: 'thuy', atk: 'swing' },
  bangthi: { name: 'Băng Thi', sprite: 'zombie', elem: 'thuy', atk: 'swing', hp: 1.4, spd: 0.7, tint: 0xb8c8ff },
  banghon: { name: 'Băng Hồn Pháp Sư', sprite: 'skeleton_mage', elem: 'thuy', atk: 'cast', ranged: 'icicle', range: 6, hp: 0.8, tint: 0xc8d4ff },
  khovo: { name: 'Khô Lâu Võ Sĩ', sprite: 'skeleton', elem: 'kim', atk: 'swing', hp: 1.1 },
  uhon: { name: 'U Hồn', sprite: 'zombie', elem: 'moc', atk: 'swing', hp: 1.0, tint: 0xb0ffb0, alpha: 0.6 },
  khocung: { name: 'Khô Lâu Cung Thủ', sprite: 'skeleton_archer', elem: 'kim', atk: 'shoot', ranged: 'arrows', range: 6.5, hp: 0.85 },
  hoahon: { name: 'Hỏa Hồn Pháp Sư', sprite: 'skeleton_mage', elem: 'hoa', atk: 'cast', ranged: 'fireball', range: 6, hp: 0.85, tint: 0xffc0b0 },
  thietgiap: { name: 'Thiết Giáp Hạt', sprite: 'antlion_armored', elem: 'kim', atk: 'swing', hp: 1.5, dmg: 1.1 },
  hoalong: { name: 'Hỏa Dực Long', sprite: 'wyvern_fire', elem: 'hoa', atk: 'cast', ranged: 'fireball', range: 6, hp: 1.6, dmg: 1.2, scale: 0.85 },
  // boss hoàng kim
  nguuma: { name: 'Ngưu Ma Vương', sprite: 'minotaur', elem: 'tho', atk: 'swing', hp: 40, dmg: 2.2, boss: true, range: 2.2, scale: 1.25, tint: 0xffd890 },
};

// chỉ số theo cấp [tự đặt, cân bằng bằng tools/selftest.mjs]
export function monStats(type, lv) {
  const d = MONSTERS[type];
  return {
    maxHp: Math.round((30 + 14 * lv + 0.35 * lv * lv) * (d.hp || 1)),
    dmg: (5 + 2.4 * lv + 0.05 * lv * lv) * (d.dmg || 1),
    acc: 40 + lv * 5,
    dodge: 10 + lv * 2.5,
    def: lv * 0.6,
    res: 3 + lv * 0.25,
    exp: Math.round((8 + 4 * lv + 0.25 * lv * lv) * (d.boss ? 30 : 1) * (d.hp && !d.boss ? Math.sqrt(d.hp) : 1)),
    spd: 2.4 * (d.spd || 1),
    range: d.range || 1.3,
    cd: d.ranged ? 2.0 : 1.5,
  };
}
