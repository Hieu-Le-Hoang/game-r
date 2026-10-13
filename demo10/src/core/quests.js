// Nhiệm vụ: 3 nhiệm vụ tân thủ (Lý Bộ Đầu ở Ba Lăng) + chuỗi môn phái 20/30/40/50 + Xuất sư (sứ giả ở Tương Dương)
import { xpNeed } from './char.js';
import { MONSTERS } from './data/monsters.js';

export const QUESTS = {
  t1: { name: 'Trừ Sơn Tặc', giver: 'quest', lv: 1, kill: 'sontac', n: 8, where: 'Ngoại Ô Ba Lăng',
    text: 'Bọn Sơn Tặc ngoài Ngoại Ô Ba Lăng cướp bóc dân lành. Ngươi đi trừ 8 tên giúp ta.', xp: 0.6, money: 80, give: [['hp1', 10]] },
  t2: { name: 'Độc Hạt Hại Dân', giver: 'quest', lv: 4, pre: 't1', kill: 'dochat', n: 10, where: 'Ngoại Ô Ba Lăng',
    text: 'Độc Hạt bò khắp ruộng đồng, đã có người trúng độc. Diệt 10 con rồi về báo.', xp: 0.6, money: 120, give: [['mp1', 10]] },
  t3: { name: 'Bái Sư Học Nghệ', giver: 'quest', lv: 8, pre: 't2', join: true,
    text: 'Ngươi có căn cơ. Đạt cấp 10 thì lên Tương Dương gặp sứ giả môn phái hợp ngũ hành của mình mà bái sư.', xp: 0.5, money: 150, give: [['tdp', 3]] },
  // thử thách môn phái: diệt N quái bất kỳ ở map chỉ định (hợp với auto train)
  p20: { name: 'Thử Thách Cấp 20', giver: 'envoy', lv: 20, map: 'm2', n: 40, where: 'Phục Ngưu Sơn',
    text: 'Muốn học tầng võ công kế tiếp, hãy lên Phục Ngưu Sơn trừ 40 tên cường đạo, thú dữ.', xp: 0.4, money: 300 },
  p30: { name: 'Thử Thách Cấp 30', giver: 'envoy', lv: 30, pre: 'p20', map: 'm3', n: 50, where: 'Thiên Sơn Tuyết Lĩnh',
    text: 'Thiên Sơn Tuyết Lĩnh yêu khí ngút trời. Diệt 50 con quái ở đó.', xp: 0.4, money: 500 },
  p40: { name: 'Thử Thách Cấp 40', giver: 'envoy', lv: 40, pre: 'p30', map: 'm3', n: 60, where: 'Thiên Sơn Tuyết Lĩnh',
    text: 'Băng Hồn Pháp Sư luyện tà thuật trên núi tuyết. Diệt 60 quái ở Thiên Sơn Tuyết Lĩnh.', xp: 0.4, money: 800 },
  p50: { name: 'Thử Thách Cấp 50', giver: 'envoy', lv: 50, pre: 'p40', map: 'm4', n: 60, where: 'Lão Hổ Động',
    text: 'Lão Hổ Động đầy quái vật vỏ cứng như sắt. Diệt 60 con để chứng tỏ công lực.', xp: 0.4, money: 1200 },
  xs: { name: 'Xuất Sư', giver: 'envoy', lv: 55, pre: 'p50', kill: 'nguuma', n: 1, where: 'Lão Hổ Động',
    text: 'Ngưu Ma Vương trong Lão Hổ Động là mối họa võ lâm. Hạ được nó, ngươi đủ tư cách xuất sư và học tuyệt kỹ.', xp: 0.6, money: 3000 },
};
export const QUEST_IDS = Object.keys(QUESTS);

export const qState = (ch, id) => ch.quests[id] || null;
/** Nhiệm vụ NPC có thể giao (role 'quest' | 'envoy') */
export function available(ch, giver) {
  return QUEST_IDS.filter((id) => {
    const q = QUESTS[id];
    if (q.giver !== giver || ch.quests[id] || ch.lv < q.lv) return false;
    if (q.pre && !ch.quests[q.pre]?.done) return false;
    if (giver === 'envoy' && !ch.phai) return false;
    return true;
  });
}
export const active = (ch) => QUEST_IDS.filter((id) => ch.quests[id] && !ch.quests[id].done);
export function accept(ch, id) { ch.quests[id] = { n: 0, done: false }; }
export function ready(ch, id) {
  const q = QUESTS[id], s = ch.quests[id];
  if (!s || s.done) return false;
  if (q.join) return !!ch.phai;
  return s.n >= q.n;
}
export function onKill(ch, type, map) {
  const hits = [];
  for (const id of active(ch)) {
    const q = QUESTS[id], s = ch.quests[id];
    if ((q.kill === type || (q.map && q.map === map)) && s.n < q.n) { s.n++; hits.push(id); }
  }
  return hits;
}
/** Trả thưởng, trả về { xp, money, give } để UI/World xử lý (cộng exp qua gainXp) */
export function complete(ch, id) {
  const q = QUESTS[id];
  ch.quests[id].done = true;
  return { xp: Math.round(xpNeed(ch.lv) * q.xp), money: q.money, give: q.give || [] };
}
export const progressText = (ch, id) => {
  const q = QUESTS[id], s = ch.quests[id];
  if (q.join) return ch.phai ? 'Đã bái sư — về gặp Lý Bộ Đầu' : 'Cấp 10, lên Tương Dương gặp sứ giả môn phái';
  return `${q.kill ? MONSTERS[q.kill].name : 'Quái'} ${s.n}/${q.n} · ${q.where}`;
};
