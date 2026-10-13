// Nhân vật: tạo mới, exp, 4 chỉ số -> chỉ số chiến đấu (gameplay.md mục 1.5). Hệ số [tự đặt].
import { ELEMS, KHAC } from './data/elements.js';
import { PHAI, TANTHU, SKILL_MAX, lvVal } from './data/phai.js';
import { SLOTS, AFFIX, RES_KEYS, activeHidden, countGold, GOLD_BONUS, makeStack, makeItem } from './items.js';

export const LV_MAX = 60;
export const INV_SIZE = 40;
export const STASH_SIZE = 40;

// điểm khởi đầu theo hệ (sức mạnh, thân pháp, sinh khí, nội công)
const BASE = { kim: [35, 25, 25, 15], moc: [20, 35, 25, 20], thuy: [22, 25, 25, 28], hoa: [30, 20, 25, 25], tho: [25, 20, 28, 27] };
// máu / nội lực mỗi điểm theo hệ (Kim nhiều máu, Thổ nhiều nội lực — theo bản TQ)
const HP_PER = { kim: 8, hoa: 7, thuy: 6, moc: 5, tho: 5 };
const MP_PER = { kim: 2, moc: 2, hoa: 3, thuy: 4, tho: 4 };

// số quái cần giết mỗi cấp x exp mỗi con -> lên 60 khoảng 2 giờ khi bật auto (đo bằng tools/selftest.mjs)
export const KILLS_PER_LV = (lv) => 5 + lv * 0.66;
export const xpNeed = (lv) => Math.round(KILLS_PER_LV(lv) * (8 + 4 * lv + 0.25 * lv * lv));

export function newChar({ name, gender, elem }) {
  const [str, dex, vit, ene] = BASE[elem];
  const ch = {
    v: 1, name, gender, elem, phai: null, lv: 1, xp: 0, money: 50,
    base: { str, dex, vit, ene }, free: 0, skillPts: 0, skills: { basic: 1 },
    eq: Object.fromEntries(SLOTS.map((s) => [s, null])),
    inv: [makeStack('hp1', 10), makeStack('mp1', 5), makeStack('tdp', 2)], stash: [],
    quests: {}, kills: {}, map: 'balang', town: 'balang', ret: null, pos: null,
    keys: { left: 'basic', right: 'basic' },
    auto: { radius: 10, hp: 50, mp: 30, pick: { white: false, blue: true, gold: true, money: true, potion: true }, alloc: true, buffs: true },
    played: 0, hp: null, mp: null,
  };
  return ch;
}

// trang bị khởi đầu khi nhập phái
export function starterWeapon(rng, phai, lv = 1) {
  return makeItem(rng, 'weapon', lv, { kind: PHAI[phai].weapon, rarity: 'white', elem: PHAI[phai].elem });
}

export const phaiOf = (ch) => PHAI[ch.phai] || TANTHU;
export const outfitOf = (ch) => phaiOf(ch).outfit[ch.gender] || TANTHU.outfit[ch.gender];

/** Chỉ số chiến đấu tổng hợp. buffs: [{ stats: {k: v} }] */
export function derive(ch, buffs = []) {
  const add = {};
  const put = (k, v) => { add[k] = (add[k] || 0) + v; };
  let wpn = null, def = 0;
  const on = activeHidden(ch.eq);
  for (const s of SLOTS) {
    const it = ch.eq[s];
    if (!it) continue;
    if (it.atk) wpn = it.atk;
    if (it.def) def += it.def;
    for (const l of it.lines) if (!l.hidden || on.has(s)) put(l.k, l.v);
  }
  const g = countGold(ch.eq);
  for (const [n, b] of GOLD_BONUS) if (g.n >= n) for (const [k, v] of Object.entries(b)) put(k, v);
  for (const b of buffs) for (const [k, v] of Object.entries(b.stats)) put(k, v);

  const str = ch.base.str + (add.str || 0), dex = ch.base.dex + (add.dex || 0);
  const vit = ch.base.vit + (add.vit || 0), ene = ch.base.ene + (add.ene || 0);
  const P = phaiOf(ch);
  const main = { str, dex, ene }[P.main || 'str'];
  const w = wpn || [2, 4];
  const atkMul = 1 + (add.atkPct || 0) / 100;
  const flat = (add.atkFlat || 0) + main * 0.55 + ch.lv * 1.2;
  const st = {
    str, dex, vit, ene,
    maxHp: Math.round((55 + vit * HP_PER[ch.elem] + ch.lv * 12 + (add.hp || 0)) * (1 + (add.hpPct || 0) / 100)),
    maxMp: Math.round(30 + ene * MP_PER[ch.elem] + ch.lv * 4 + (add.mp || 0)),
    atk: [(w[0] + flat) * atkMul, (w[1] + flat) * atkMul],
    acc: 50 + dex * 2 + ch.lv * 4 + (add.acc || 0),
    dodge: 20 + dex * 1.2 + ch.lv * 2 + (add.dodge || 0),
    def: def + (add.def || 0),
    crit: 3 + (add.crit || 0),
    leech: add.leech || 0,
    spd: 4.2 * (1 + (add.spd || 0) / 100),
    aspd: 1 + (add.aspd || 0) / 100,
    regen: add.regen || 0,
    res: {},
  };
  // kháng cơ bản: cùng hệ 15%, hệ khắc mình 0%, còn lại 5%; tối đa 75%
  for (const e of ELEMS) {
    const base = e === ch.elem ? 15 : KHAC[e] === ch.elem ? 0 : 5;
    st.res[e] = Math.min(75, base + (add['res_' + e] || 0) + (add.resAll || 0));
  }
  return st;
}

export function gainXp(ch, n) {
  const ups = [];
  if (ch.lv >= LV_MAX) return ups;
  ch.xp += n;
  while (ch.lv < LV_MAX && ch.xp >= xpNeed(ch.lv)) {
    ch.xp -= xpNeed(ch.lv);
    ch.lv++;
    ch.free += 5;
    ch.skillPts += 1;
    ups.push(ch.lv);
  }
  if (ch.lv >= LV_MAX) ch.xp = 0;
  return ups;
}

// cộng điểm tự động theo phái: 3 điểm chỉ số chính + 2 sinh khí
export function autoAlloc(ch) {
  const main = phaiOf(ch).main || 'str';
  while (ch.free > 0) {
    const k = ch.free % 5 < 2 ? 'vit' : main;
    ch.base[k]++;
    ch.free--;
  }
}

/** Skill đã mở (đủ cấp + xong nhiệm vụ) */
export function skillUnlocked(ch, s) {
  if (s.id === 'basic') return true;
  if (!ch.phai || ch.lv < s.lv) return false;
  return !s.q || !!ch.quests[s.q]?.done;
}
export function learnSkill(ch, s) {
  const cur = ch.skills[s.id] || 0;
  if (!skillUnlocked(ch, s) || ch.skillPts <= 0 || cur >= SKILL_MAX || s.id === 'basic') return false;
  ch.skills[s.id] = cur + 1;
  ch.skillPts--;
  return true;
}
// cộng điểm kỹ năng tự động: ưu tiên skill tấn công mới nhất, sau đó buff
export function autoLearn(ch) {
  const list = phaiOf(ch).skills.filter((s) => s.id !== 'basic' && skillUnlocked(ch, s));
  let guard = 100;
  while (ch.skillPts > 0 && guard--) {
    const cand = list.filter((s) => (ch.skills[s.id] || 0) < SKILL_MAX);
    if (!cand.length) break;
    // skill chưa học thì học trước; rồi tới skill tấn công cấp mở cao nhất
    const fresh = cand.find((s) => !ch.skills[s.id]);
    const pick = fresh || cand.filter((s) => s.type === 'atk').sort((a, b) => b.lv - a.lv)[0] || cand[0];
    learnSkill(ch, pick);
  }
}
export const skillLv = (ch, id) => (id === 'basic' ? 1 : ch.skills[id] || 0);
export { lvVal, RES_KEYS, AFFIX };
