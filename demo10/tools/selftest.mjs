// Selftest headless: bot đóng vai người chơi bật auto train từ cấp 1 -> 60 cho từng phái.
// Bot chỉ làm việc "tay" của người chơi: nhận/trả nhiệm vụ, nhập phái, mua thuốc, bán đồ, mặc đồ tốt hơn, chọn bãi, bật auto,
// dùng Thổ Địa Phù khi auto dừng. Còn đánh quái/uống thuốc/nhặt đồ là auto (src/core/auto.js) tự làm.
// Đạt: lên 60 trong 1h45-2h15 thời gian giả lập, không kẹt.
// Usage: node tools/selftest.mjs [phai|all] [seed]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game } from '../src/core/game.js';
import { newChar, xpNeed, LV_MAX, INV_SIZE } from '../src/core/char.js';
import { makeRng } from '../src/core/util.js';
import { PHAI, PHAI_IDS } from '../src/core/data/phai.js';
import { MAPS, mapForLevel } from '../src/core/data/world.js';
import { itemScore, canEquip, CONSUMABLE } from '../src/core/items.js';
import * as Q from '../src/core/quests.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MAPJ = {};
for (const id of Object.keys(MAPS)) MAPJ[id] = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/a/maps', id + '.json'), 'utf8'));

const DT = 0.1;
const LIMIT = 4 * 3600;
const TOWN_TIME = 45;       // giây đi bộ giữa các NPC mỗi lần vào thành

function run(phai, seed) {
  const P = PHAI[phai];
  const rng = makeRng(seed);
  const ch = newChar({ name: 'Bot', gender: P.genders[0], elem: P.elem });
  const g = new Game({ ch, getMap: (id) => MAPJ[id], rng });
  g.enter('balang');
  const log = { phai, lvAt: {}, deaths: 0, townTrips: 0, stops: {}, unreach: 0, maxStuck: 0, why: {} };
  let t = 0, nextThink = 0, fieldSince = 0, lastLv = 1, lastProgress = 0, lastXp = 0;

  const step = (sec) => { for (let k = 0; k < sec / DT; k++) { g.update(DT); t += DT; drain(); } };
  const drain = () => {
    for (const e of g.ev) {
      if (e.t === 'dead') log.deaths++;
      if (e.t === 'autostop' && e.reason) log.stops[e.reason] = (log.stops[e.reason] || 0) + 1;
      if (e.t === 'unreachable') log.unreach++;
    }
    g.ev.length = 0;
  };

  // việc cần làm trong thành: { balang: bool, td: bool }
  const errands = () => {
    const at = { balang: false, td: false };
    for (const id of Q.QUEST_IDS) {
      const q = Q.QUESTS[id];
      const k = q.giver === 'quest' ? 'balang' : 'td';
      if (Q.ready(ch, id)) at[k] = true;
    }
    if (Q.available(ch, 'quest').length) at.balang = true;
    if (ch.phai && Q.available(ch, 'envoy').length) at.td = true;
    if (!ch.phai && ch.lv >= 10) at.td = true;
    return at;
  };
  const doTown = () => {
    const w = g.world;
    for (const id of Q.QUEST_IDS) if (Q.ready(ch, id) && (Q.QUESTS[id].giver === 'quest') === (w.id === 'balang')) g.completeQuest(id);
    if (w.id === 'balang') for (const id of Q.available(ch, 'quest')) g.acceptQuest(id);
    if (w.id === 'tuongduong') {
      if (!ch.phai && ch.lv >= 10) g.join(phai);
      for (const id of Q.available(ch, 'envoy')) g.acceptQuest(id);
      for (const id of Q.QUEST_IDS) if (Q.ready(ch, id) && Q.QUESTS[id].giver === 'envoy') g.completeQuest(id);
    }
  };
  const town = () => {
    log.townTrips++;
    step(TOWN_TIME / 3);
    for (let k = 0; k < 3; k++) {
      const at = errands();
      if (at.balang) { if (g.world.id !== 'balang') g.travel('balang'); doTown(); }
      if (errands().td) { if (g.world.id !== 'tuongduong') g.travel('tuongduong'); doTown(); }
    }
    doTown();
    const w = g.world;
    equipBest();
    for (const it of ch.inv.slice()) if (!it.stack) g.sell(it.uid);
    const tier = ch.lv >= 35 ? 3 : ch.lv >= 15 ? 2 : 1;
    const buy = (id, n) => {
      const have = w.invCount(id);
      if (have >= n) return;
      const e = g.shopList(id === 'tdp' ? 'taphoa' : 'duoc').find((x) => x.id === id);
      if (!e) return;
      const k = Math.min(n - have, Math.floor((ch.money - 40) / e.price));   // chừa tiền xe
      if (k > 0) g.buy(e, k);
    };
    buy('tdp', 3);
    buy('hp' + tier, 60);
    buy('mp' + tier, 30);
    step(TOWN_TIME * 2 / 3);
  };
  const equipBest = () => {
    for (const it of ch.inv.slice()) {
      if (it.stack || canEquip(it, ch)) continue;
      const slots = it.base === 'ring' ? ['ring1', 'ring2'] : [it.slot];
      for (const s of slots) if (itemScore(it) > itemScore(ch.eq[s]) * 1.05) { g.equip(it.uid, s); break; }
    }
  };
  // điểm neo: vùng quái có cấp sát cấp mình (vùng đã sắp theo khoảng cách từ cổng vào, cấp tăng dần)
  const goField = () => {
    let target = mapForLevel(ch.lv);
    const boss = ch.quests.xs && !ch.quests.xs.done && ch.lv >= 55;
    if (boss) target = 'm4';
    if (g.world.id !== target && !g.travel(target)) { log.broke = (log.broke || 0) + 1; ch.money += 100; g.travel(target); }
    const w = g.world, d = MAPS[target];
    let zi = Math.round((ch.lv - d.lv[0]) / Math.max(1, d.lv[1] - d.lv[0]) * (w.zones.length - 1));
    zi = Math.max(0, Math.min(w.zones.length - 1, zi));
    if (boss) zi = w.zones.length - 1;
    const z = w.zones[zi];
    const goal = w.grid.nearestWalkable(z[0] + z[2] / 2, z[1] + z[3] / 2, 6) || [w.p.x, w.p.y];
    g.auto.start(goal);
    fieldSince = t;
    lastProgress = t;
    log.zone = `${target}#${zi}`;
    if (process.env.DEBUG) console.log(`[${Math.round(t)}s] lv${ch.lv} -> ${log.zone} pos ${w.p.x.toFixed(1)},${w.p.y.toFixed(1)} auto=${g.auto.on} money=${ch.money} quests=${JSON.stringify(ch.quests)}`);
  };

  town();
  while (ch.lv < LV_MAX && t < LIMIT) {
    if (g.world.def.town) { town(); goField(); continue; }
    step(1);
    if (t < nextThink) continue;
    nextThink = t + 5;
    if (ch.lv !== lastLv || ch.xp !== lastXp) { lastProgress = t; lastLv = ch.lv; lastXp = ch.xp; }
    log.maxStuck = Math.max(log.maxStuck, t - lastProgress);
    equipBest();
    const w = g.world;
    const d = MAPS[w.id];
    const at = errands();
    const why = !g.auto.on ? 'auto tắt' : (d.lv && ch.lv >= d.lv[1] && w.id !== 'm4') ? 'đổi map'
      : ch.inv.length >= INV_SIZE - 1 ? 'túi đầy' : at.balang || at.td ? 'nhiệm vụ' : t - lastProgress > 120 ? 'kẹt' : '';
    if (why) {
      log.why[why] = (log.why[why] || 0) + 1;
      if (process.env.DEBUG && why === 'kẹt' && log.why[why] <= 3) {
        const p = w.p, A = g.auto.anchor;
        const tg = p.goal?.id && w.monById(p.goal.id);
        console.log('KẸT pos', p.x.toFixed(1), p.y.toFixed(1), 'anchor', A.x.toFixed(1), A.y.toFixed(1), 'target', tg ? `${tg.type}@${tg.x.toFixed(1)},${tg.y.toFixed(1)} st=${tg.state} hp=${Math.round(tg.hp)} d=${Math.hypot(tg.x - p.x, tg.y - p.y).toFixed(1)} sight=${w.grid.lineFree(p.x, p.y, tg.x, tg.y, true)}` : '-');
        console.log('KẸT', 'hp', Math.round(p.hp), '/', w.st.maxHp, 'mp', Math.round(p.mp), 'goal', JSON.stringify(p.goal), 'act', !!p.act, 'anim', p.anim, 'sit', p.sit, 'stun', JSON.stringify(p.status),
          'atk', w.st.atk.map(Math.round), 'keys', JSON.stringify(ch.keys), 'skills', JSON.stringify(ch.skills),
          '\n  near:', w.mons.filter((m) => Math.hypot(m.x - A.x, m.y - A.y) <= 10).map((m) => `${m.type}${m.dead ? '†' : ''}:${m.state}:${Math.round(m.hp)}/${m.st.maxHp}`).join(' '));
      }
      if (w.p.dead) { step(4); continue; }
      const it = ch.inv.find((x) => x.stack && x.id === 'tdp');
      g.auto.stop();
      if (it) w.useItem(it.uid); else g.enter(d.back);
      drain();
      continue;
    }
    if (t - fieldSince > 300) { g.auto.stop(); goField(); }
    log.lvAt[ch.lv] = log.lvAt[ch.lv] || Math.round(t);
  }
  log.time = Math.round(t);
  log.lv = ch.lv;
  log.money = ch.money;
  log.quests = Object.entries(ch.quests).filter(([, s]) => s.done).map(([id]) => id).join(',');
  log.skills = JSON.stringify(ch.skills);
  log.eq = Object.values(ch.eq).filter(Boolean).map((i) => i.rarity[0]).join('');
  return log;
}

const arg = process.argv[2] || 'all';
const seed = Number(process.argv[3] || 7);
const list = arg === 'all' ? PHAI_IDS : [arg];
let fail = 0;
for (const ph of list) {
  const t0 = Date.now();
  const r = run(ph, seed);
  const mins = (r.time / 60).toFixed(0);
  const ok = r.lv >= 60 && r.time >= 105 * 60 && r.time <= 135 * 60;
  if (!ok) fail++;
  const marks = [10, 20, 30, 40, 50, 60].map((l) => `${l}:${r.lvAt[l] ? Math.round(r.lvAt[l] / 60) + 'p' : '-'}`).join(' ');
  console.log(`${ok ? 'PASS' : 'FAIL'} ${PHAI[ph].name.padEnd(10)} cấp ${r.lv} sau ${mins} phút · ${marks} · chết ${r.deaths} · về thành ${r.townTrips} · kẹt max ${Math.round(r.maxStuck)}s · không tới được ${r.unreach} · NV ${r.quests} · đồ ${r.eq} · ${((Date.now() - t0) / 1000).toFixed(1)}s thật`);
  console.log('   về thành vì:', JSON.stringify(r.why), Object.keys(r.stops).length ? 'auto dừng: ' + JSON.stringify(r.stops) : '');
}
process.exit(fail ? 1 : 0);
