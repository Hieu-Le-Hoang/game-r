// Dữ liệu game kiểu MU Online: class, skill, quái, vùng. Không phụ thuộc Phaser (selftest chạy được trên Node).

export const CLASSES = {
  dk: {
    name: 'Dark Knight', vn: 'Chiến Binh', portrait: 'male01', base: { str: 28, agi: 20, vit: 25, ene: 10 },
    basic: { name: 'Chém', icon: 1 }, skills: ['twist', 'rage'],
    desc: 'Cận chiến, máu trâu. Xoáy Kiếm dọn cả bầy quanh người.',
  },
  dw: {
    name: 'Dark Wizard', vn: 'Phù Thủy', portrait: 'male03', base: { str: 18, agi: 18, vit: 15, ene: 30 },
    basic: { name: 'Năng Lượng Cầu', icon: 45 }, skills: ['meteor', 'evil', 'tele'],
    desc: 'Phép xa, máu giấy. Evil Spirit bắn 8 luồng ma quanh người.',
  },
};

// mp: mana, cd: hồi chiêu (giây), lvl: cấp mở khóa, k: hệ số sát thương, r: bán kính AoE (ô)
export const SKILLS = {
  twist: { name: 'Twisting Slash', vn: 'Xoáy Kiếm', icon: 22, mp: 9, cd: 0.75, lvl: 1, k: 1.3, r: 2.5, self: true },
  rage: { name: 'Rageful Blow', vn: 'Nộ Long Phá', icon: 10, mp: 22, cd: 2.6, lvl: 8, k: 1.9, r: 3.4, self: true },
  meteor: { name: 'Meteor', vn: 'Thiên Thạch', icon: 34, mp: 9, cd: 0.55, lvl: 1, k: 1.6, r: 1.6, range: 7.5 },
  evil: { name: 'Evil Spirit', vn: 'Quỷ Hồn', icon: 39, mp: 16, cd: 0.9, lvl: 6, k: 1.15, r: 6.5, self: true },
  tele: { name: 'Teleport', vn: 'Dịch Chuyển', icon: 9, mp: 18, cd: 1.2, lvl: 3, range: 6 },
};

// beh: melee | swarm (bầy, nhanh) | hitrun (cắn rồi lùi) | ranged | ghost (đi xuyên tường) | flee (quái vàng) | boss
export const MOBS = {
  spider: { name: 'Spider', sp: 'antlion_small', lvl: 2, hp: 32, dmg: [4, 7], def: 1, spd: 2.7, range: 1.1, beh: 'swarm', sc: 0.7, sfx: 'spider' },
  budge: { name: 'Budge Dragon', sp: 'wyvern', lvl: 4, hp: 58, dmg: [6, 10], def: 2, spd: 2.6, range: 1.3, beh: 'hitrun', sc: 0.75, sfx: 'wyv' },
  bull: { name: 'Bull Fighter', sp: 'minotaur', lvl: 6, hp: 95, dmg: [9, 13], def: 4, spd: 1.9, range: 1.4, beh: 'melee', sc: 0.5, sfx: 'bull' },
  goblin: { name: 'Goblin', sp: 'goblin', lvl: 9, hp: 130, dmg: [12, 17], def: 6, spd: 3.1, range: 1.2, beh: 'melee', sc: 1, sfx: 'goblin' },
  ebull: { name: 'Elite Bull Fighter', sp: 'minotaur', lvl: 12, hp: 200, dmg: [16, 22], def: 10, spd: 2.0, range: 1.5, beh: 'melee', sc: 0.6, tint: 0xff9a8a, sfx: 'bull' },
  lich: { name: 'Lich', sp: 'skeleton_mage', lvl: 14, hp: 180, dmg: [20, 26], def: 8, spd: 1.9, range: 6, beh: 'ranged', bolt: 'spark_blue', atk: 'cast', tint: 0xc8a0ff, sfx: 'skel' },
  giant: { name: 'Giant', sp: 'hobgoblin', lvl: 17, hp: 380, dmg: [26, 34], def: 18, spd: 1.6, range: 1.6, beh: 'melee', sc: 1.3, sfx: 'goblin' },
  skelwar: { name: 'Skeleton Warrior', sp: 'skeleton', lvl: 19, hp: 320, dmg: [30, 38], def: 20, spd: 2.2, range: 1.4, beh: 'melee', sfx: 'skel' },
  // Dungeon
  skeleton: { name: 'Skeleton', sp: 'skeleton', lvl: 22, hp: 430, dmg: [36, 46], def: 24, spd: 2.2, range: 1.4, beh: 'melee', tint: 0xd8d0ff, sfx: 'skel' },
  ghost: { name: 'Ghost', sp: 'zombie', lvl: 24, hp: 380, dmg: [38, 48], def: 18, spd: 1.8, range: 1.3, beh: 'ghost', tint: 0x9fffb0, alpha: 0.6, sfx: 'zomb' },
  larva: { name: 'Larva', sp: 'antlion_small', lvl: 25, hp: 300, dmg: [34, 42], def: 16, spd: 3.0, range: 1.1, beh: 'swarm', sc: 0.6, tint: 0xa8ff70, sfx: 'spider' },
  tlich: { name: 'Thunder Lich', sp: 'skeleton_mage', lvl: 28, hp: 480, dmg: [44, 56], def: 24, spd: 1.9, range: 6.5, beh: 'ranged', bolt: 'lightning', atk: 'cast', tint: 0x80b0ff, sfx: 'skel' },
  pbull: { name: 'Poison Bull', sp: 'minotaur', lvl: 30, hp: 900, dmg: [52, 64], def: 32, spd: 2.0, range: 1.6, beh: 'melee', sc: 0.72, tint: 0x9cff7a, sfx: 'bull' },
  gorgon: { name: 'Gorgon', sp: 'minotaur', lvl: 40, hp: 7000, dmg: [70, 90], def: 40, spd: 2.2, range: 2.1, beh: 'boss', sc: 1.25, tint: 0xff7a6a, sfx: 'bull', boss: true },
  // Golden Invasion
  ggoblin: { name: 'Golden Goblin', sp: 'goblin', lvl: 15, hp: 300, dmg: [1, 1], def: 6, spd: 3.6, range: 1, beh: 'flee', tint: 0xffd040, gold: true, sfx: 'goblin' },
  gdragon: { name: 'Golden Budge Dragon', sp: 'wyvern', lvl: 20, hp: 450, dmg: [1, 1], def: 8, spd: 3.3, range: 1, beh: 'flee', sc: 0.85, tint: 0xffd040, gold: true, sfx: 'wyv' },
};

// Lorencia: nhóm spawn (theo map Flare) sắp theo đường đi xa dần thị trấn, gán cấp quái tăng dần
export const LORENCIA_TIERS = ['spider', 'spider', 'budge', 'budge', 'bull', 'bull', 'goblin', 'goblin', 'ebull', 'ebull', 'lich', 'lich', 'giant', 'giant', 'skelwar', 'skelwar', 'skelwar'];
export const DUNGEON_TIERS = ['skeleton', 'larva', 'skeleton', 'ghost', 'larva', 'tlich', 'ghost', 'skeleton', 'tlich', 'pbull', 'pbull'];
export const PER_GROUP = { lorencia: 9, dungeon: 7 };

export const MAPS = {
  lorencia: {
    name: 'Lorencia', amb: 'amb_field', dark: false,
    town: { x: 78.5, y: 50.5, r: 6.5 },            // vùng an toàn: quái không vào, hồi sinh ở đây
    npcs: [
      { key: 'amy', sp: 'peasant_woman1', name: 'Amy', role: 'Bán bình máu/mana', x: 80.5, y: 47.5, face: 'female02' },
      { key: 'hanzo', sp: 'guild_man', name: 'Hanzo', role: 'Thợ rèn, mua đồ cũ', x: 80.5, y: 53.5, face: 'male03' },
    ],
    portal: { x: 14.5, y: 50.5, to: 'dungeon', name: 'Dungeon', lvl: 15 },
    skipGroups: [0],                                // nhóm 0 nằm trong thị trấn
  },
  dungeon: {
    name: 'Dungeon', amb: 'amb_cave', dark: true,
    town: null,
    npcs: [],
    portal: { at: 'hero', dx: -1.5, dy: 1, to: 'lorencia', name: 'Lorencia', lvl: 0 },
    boss: { key: 'gorgon', x: 11.5, y: 5.5 },
    skipGroups: [],
  },
};

export const GOLDEN = { first: 240, every: 480, count: 36, dragonShare: 0.33, life: 180 };

// MU-ish: kinh nghiệm theo cấp quái, phạt khi chênh cấp nhiều
export const mobXp = (mlvl, hlvl) => {
  const base = Math.round((mlvl + 25) * mlvl / 3);
  const diff = hlvl - mlvl;
  return diff > 10 ? Math.max(1, Math.round(base * Math.max(0.2, 1 - (diff - 10) * 0.08))) : base;
};
export const xpNeed = (lvl) => Math.round(50 * lvl * lvl + 100 * lvl);
export const POINTS_PER_LEVEL = 5;
export const MAX_LEVEL = 99;
