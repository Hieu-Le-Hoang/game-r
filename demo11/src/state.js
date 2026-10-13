// Trạng thái nhân vật + công thức chỉ số kiểu MU. Không phụ thuộc Phaser.
import { CLASSES, SKILLS, xpNeed, POINTS_PER_LEVEL, MAX_LEVEL } from './data.js';
import { makeItem, itemStats, SLOTS, base } from './items.js';

export const S = {};

export function newChar(cls) {
  const C = CLASSES[cls];
  Object.assign(S, {
    cls, lvl: 1, xp: 0, zen: 0, pts: 0, hp: 1, mp: 1,
    stat: { ...C.base },
    eq: { main: null, off: null, head: null, chest: null, legs: null, hands: null, feet: null },
    bag: [], hpPot: 8, mpPot: 10,
    skill: C.skills[0],
    kills: 0, t0: 0, boss: false,
  });
  if (cls === 'dk') {
    S.eq.main = makeItem('kris'); S.eq.off = makeItem('sshield'); S.eq.chest = makeItem('Da_chest'); S.eq.legs = makeItem('Da_legs');
  } else {
    S.eq.main = makeItem('skull'); S.eq.chest = makeItem('Vải_chest'); S.eq.legs = makeItem('Vải_legs'); S.eq.feet = makeItem('Vải_feet');
  }
  const st = stats();
  S.hp = st.maxHp; S.mp = st.maxMp;
  return S;
}

/** Chỉ số tổng hợp từ stat + đồ. */
export function stats() {
  const { str, agi, vit, ene } = S.stat;
  const o = { excRate: 0, dmgLvl: 0, dmgPct: 0, atkSpd: 0, hpHunt: 0, mpHunt: 0, maxHp: 0, maxMp: 0, dd: 0, reflect: 0, dodge: 0, zen: 0 };
  let wdmg = [0, 0], wmag = [0, 0], def = 0, luck = 0;
  for (const s of SLOTS) {
    const it = S.eq[s];
    if (!it) continue;
    const st = itemStats(it);
    if (st.dmg) wdmg = st.dmg;
    if (st.mag) wmag = st.mag;
    if (st.def) def += st.def;
    if (it.luck) luck++;
    for (const k of it.exc) o[k]++;
  }
  const dk = S.cls === 'dk';
  const r = {
    dmg: dk ? [Math.floor(str / 6) + wdmg[0], Math.floor(str / 4) + wdmg[1]] : [Math.floor(str / 8) + 1, Math.floor(str / 6) + 2],
    mag: dk ? [0, 0] : [Math.floor(ene / 9) + wmag[0], Math.floor(ene / 4) + wmag[1]],
    def: Math.floor(agi / (dk ? 3 : 4)) + def,
    maxHp: Math.round((dk ? 60 + S.lvl * 2 + vit * 3 : 30 + S.lvl + vit * 2) * (1 + o.maxHp * 0.04)),
    maxMp: Math.round((dk ? 20 + S.lvl * 1.5 + ene * 2 : S.lvl * 2 + ene * 2) * (1 + o.maxMp * 0.04)),
    speed: 1 + agi / (dk ? 160 : 200) + o.atkSpd * 0.07,
    crit: 5 + luck * 5,            // % đánh ra max damage
    exc: o.excRate * 10,           // % đánh hoàn hảo (x1.2 max)
    dmgMul: 1 + o.dmgPct * 0.02,
    dmgAdd: Math.floor(S.lvl / 20) * o.dmgLvl,
    hpHunt: o.hpHunt, mpHunt: o.mpHunt,
    dd: o.dd * 0.04, reflect: o.reflect * 0.05, dodge: o.dodge * 10, zen: o.zen * 0.4,
  };
  return r;
}

export const need = () => xpNeed(S.lvl);

/** Cộng XP, trả số cấp vừa lên. */
export function gainXp(n) {
  if (S.lvl >= MAX_LEVEL) return 0;
  S.xp += n;
  let up = 0;
  while (S.xp >= need() && S.lvl < MAX_LEVEL) { S.xp -= need(); S.lvl++; S.pts += POINTS_PER_LEVEL; up++; }
  return up;
}

export function addPoint(k, n = 1) {
  n = Math.min(n, S.pts);
  if (n <= 0 || !(k in S.stat)) return false;
  S.stat[k] += n; S.pts -= n;
  return true;
}

export const skillReady = (k) => SKILLS[k].lvl <= S.lvl;
export const equipped = () => SLOTS.map((s) => S.eq[s]).filter(Boolean);
export const reqOk = (it) => base(it).req <= S.lvl;
