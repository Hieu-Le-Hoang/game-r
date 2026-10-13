// Thông số gameplay. Đơn vị mét / giây. Số liệu súng phỏng theo CS 1.6 (1 unit GoldSrc ~ 0.0254 m).
export const U = 0.0254;

export const RULES = {
  freezeTime: 5,
  buyTime: 20, // tính từ đầu round (gồm freeze)
  roundTime: 115,
  c4Timer: 35,
  plantTime: 3,
  defuseTime: 10,
  defuseKitTime: 5,
  endDelay: 5,
  winRounds: 16,
  startMoney: 800,
  maxMoney: 16000,
  killReward: 300,
  plantReward: 300,
  defuseReward: 300,
  winElim: 3250,
  winBomb: 3500,
  winTime: 3250,
  lossBase: 1400,
  lossStep: 500,
  lossMax: 3400,
  plantedLossBonus: 800,
  teamSize: 5,
  bombRadius: 22, // bán kính sát thương bom (m)
  bombDamage: 500,
};

export const MOVE = {
  gravity: 800 * U,
  jumpSpeed: 268 * U,
  friction: 4,
  stopSpeed: 100 * U,
  accel: 5.5,
  airAccel: 10,
  airCap: 30 * U,
  walkMul: 0.52,
  duckMul: 0.34,
  radius: 0.4,
  standHeight: 1.8,
  duckHeight: 1.2,
  standEye: 1.62,
  duckEye: 1.05,
  duckSpeed: 8, // tốc độ chuyển tư thế (1/s)
};

// Nhóm hitbox -> hệ số sát thương
export const HITGROUP = { head: 4, chest: 1, stomach: 1.25, legs: 0.75 };

const rifleSpread = (air, move, stand) => (a, acc) =>
  a.air ? air[0] + air[1] * acc : a.speed > 140 * U ? move[0] + move[1] * acc : stand * acc * (a.duck ? 0.85 : 1);
const pistolSpread = (air, move, duck, stand) => (a, acc) =>
  (a.air ? air : a.speed > 5 * U ? move : a.duck ? duck : stand) * (1 - acc);

// kick: [upBase, latBase, upMod, latMod, upMax, latMax, dirChange] (độ) cho 4 trạng thái
export const WEAPONS = {
  knife: {
    name: 'Dao', slot: 3, price: 0, speed: 250 * U, dmg: 20, dmg2: 65, range: 1.7, rate: 0.4, rate2: 1.1,
    armorRatio: 1.7, melee: true, deploy: 0.5, kill: 'dao',
  },
  glock: {
    name: 'Glock 18', slot: 2, price: 400, speed: 250 * U, dmg: 25, rangeMod: 0.75, rate: 0.16, mag: 20, reserve: 120,
    reload: 2.2, armorRatio: 1.05, semi: true, pistol: true, accMin: 0.6, punch: 2, team: null,
    spread: pistolSpread(1.0, 0.165, 0.075, 0.1),
  },
  usp: {
    name: 'USP .45', slot: 2, price: 500, speed: 250 * U, dmg: 34, rangeMod: 0.79, rate: 0.17, mag: 12, reserve: 100,
    reload: 2.7, armorRatio: 1.0, semi: true, pistol: true, accMin: 0.6, punch: 2, team: null,
    spread: pistolSpread(1.2, 0.225, 0.08, 0.1),
  },
  deagle: {
    name: 'Desert Eagle', slot: 2, price: 650, speed: 250 * U, dmg: 54, rangeMod: 0.81, rate: 0.25, mag: 7, reserve: 35,
    reload: 2.2, armorRatio: 1.5, semi: true, pistol: true, accMin: 0.55, punch: 2.6, team: null,
    spread: pistolSpread(1.5, 0.25, 0.115, 0.13),
  },
  mp5: {
    name: 'MP5 Navy', slot: 1, price: 1500, speed: 250 * U, dmg: 26, rangeMod: 0.84, rate: 0.075, mag: 30, reserve: 120,
    reload: 2.63, armorRatio: 1.0, auto: true, team: null,
    acc: (n) => Math.min(0.75, (n * n) / 220.1 + 0.45),
    spread: (a, acc) => (a.air ? 0.2 : 0.04) * acc,
    kick: {
      air: [0.9, 0.475, 0.35, 0.0425, 5, 3, 6], move: [0.5, 0.275, 0.2, 0.03, 4, 2.25, 7],
      duck: [0.225, 0.15, 0.1, 0.015, 2.5, 1.5, 9], stand: [0.25, 0.175, 0.125, 0.02, 2.25, 1.25, 10],
    },
  },
  ak47: {
    name: 'AK-47', slot: 1, price: 2500, speed: 221 * U, dmg: 36, rangeMod: 0.98, rate: 0.0955, mag: 30, reserve: 90,
    reload: 2.45, armorRatio: 1.55, auto: true, team: 'T',
    acc: (n) => Math.min(1.25, (n * n * n) / 200 + 0.35),
    spread: rifleSpread([0.04, 0.4], [0.04, 0.07], 0.0275),
    kick: {
      air: [2.0, 1.0, 0.5, 0.35, 9, 6, 5], move: [1.5, 0.45, 0.225, 0.05, 6.5, 2.5, 7],
      duck: [0.9, 0.35, 0.15, 0.025, 5.5, 1.5, 9], stand: [1.0, 0.375, 0.175, 0.0375, 5.75, 1.75, 8],
    },
  },
  m4a1: {
    name: 'M4A1', slot: 1, price: 3100, speed: 230 * U, dmg: 33, rangeMod: 0.97, rate: 0.09, mag: 30, reserve: 90,
    reload: 3.05, armorRatio: 1.4, auto: true, team: 'CT',
    acc: (n) => Math.min(1.0, (n * n * n) / 220 + 0.3),
    spread: rifleSpread([0.035, 0.4], [0.035, 0.07], 0.025),
    kick: {
      air: [1.2, 0.5, 0.23, 0.15, 5.5, 3.5, 6], move: [1.0, 0.45, 0.28, 0.045, 3.75, 3, 7],
      duck: [0.6, 0.3, 0.2, 0.0125, 3.25, 2, 7], stand: [0.65, 0.35, 0.25, 0.015, 3.5, 2.25, 7],
    },
  },
  awp: {
    name: 'AWP', slot: 1, price: 4750, speed: 210 * U, scopedSpeed: 150 * U, dmg: 115, rangeMod: 0.99, rate: 1.45,
    mag: 10, reserve: 30, reload: 2.5, armorRatio: 1.95, sniper: true, punch: 2, team: null,
    spread: (a) => (a.air ? 0.85 : a.speed > 140 * U ? 0.25 : a.speed > 10 * U ? 0.1 : a.duck ? 0 : 0.001) + (a.scoped ? 0 : 0.08),
  },
  he: {
    name: 'HE Grenade', slot: 4, price: 300, speed: 250 * U, dmg: 100, radius: 8.9, rate: 1.0, armorRatio: 1.0,
    grenade: true, fuse: 1.5, deploy: 0.5, team: null,
  },
  c4: { name: 'C4', slot: 5, price: 0, speed: 250 * U, deploy: 0.5 },
};

export const EQUIP = {
  vest: { name: 'Kevlar', price: 650 },
  vesthelm: { name: 'Kevlar + Mũ', price: 1000 },
  defuser: { name: 'Bộ gỡ bom', price: 200, team: 'CT' },
  ammo1: { name: 'Đạn súng chính', price: 60 },
  ammo2: { name: 'Đạn súng lục', price: 50 },
};

// Menu mua kiểu CS 1.3 (phím B -> số)
export const BUY_MENU = [
  { key: 1, name: 'Súng lục', items: ['glock', 'usp', 'deagle'] },
  { key: 2, name: 'Tiểu liên', items: ['mp5'] },
  { key: 3, name: 'Súng trường', items: ['ak47', 'm4a1', 'awp'] },
  { key: 4, name: 'Đạn súng chính', item: 'ammo1' },
  { key: 5, name: 'Đạn súng lục', item: 'ammo2' },
  { key: 6, name: 'Trang bị', items: ['vest', 'vesthelm', 'he', 'defuser'] },
];

export const SKILLS = {
  easy: { name: 'Dễ', reaction: 0.6, aimErr: 3.2, turn: 260, comp: 0.25, headChance: 0.1 },
  normal: { name: 'Thường', reaction: 0.38, aimErr: 1.9, turn: 420, comp: 0.55, headChance: 0.3 },
  hard: { name: 'Khó', reaction: 0.22, aimErr: 0.9, turn: 720, comp: 0.85, headChance: 0.55 },
};

export const BOT_NAMES = ['Tèo', 'Tí', 'Sửu', 'Dần', 'Mẹo', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi', 'Bin', 'Bo'];
