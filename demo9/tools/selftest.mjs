// Selftest không cần browser: 10 bot tự đánh nhau N round, kiểm luật + kinh tế + bom + bot có tiến triển.
// Chạy: npm run selftest  (tuỳ chọn: ROUNDS=6 SKILL=hard SEED=7)
import { Game, DT } from '../src/sim/game.js';
import { RULES } from '../src/sim/constants.js';

const ROUNDS = +(process.env.ROUNDS ?? 6), SEED = +(process.env.SEED ?? 7), SKILL = process.env.SKILL ?? 'normal';
const HUMAN = process.env.HUMAN ?? null; // T | CT: thêm 1 người chơi đứng yên để kiểm luồng có người
const g = await Game.create({ seed: SEED, skill: SKILL, humanTeam: HUMAN });
const c = {};
const fail = [];
const check = (ok, msg) => { if (!ok) fail.push(msg); };
const t0 = performance.now();
let steps = 0, roundsDone = 0, maxStepMs = 0;
const startMoneyOk = g.agents.every((a) => a.money === RULES.startMoney);
check(startMoneyOk, 'tiền khởi đầu sai');
let roundStartT = 0;
while (roundsDone < ROUNDS && g.now < ROUNDS * 200) {
  const s = performance.now();
  g.step(DT);
  maxStepMs = Math.max(maxStepMs, performance.now() - s);
  steps++;
  for (const e of g.drain()) {
    c[e.type] = (c[e.type] ?? 0) + 1;
    if (e.type === 'roundStart') roundStartT = g.now;
    if (e.type === 'kill') c[`kill_${e.weapon}`] = (c[`kill_${e.weapon}`] ?? 0) + 1;
    if (e.type === 'kill' && e.headshot) c.headshot = (c.headshot ?? 0) + 1;
    if (e.type === 'buy') c[`buy_${e.item}`] = (c[`buy_${e.item}`] ?? 0) + 1;
    if (e.type === 'roundEnd') {
      roundsDone++;
      const dur = (g.now - roundStartT).toFixed(1);
      console.log(`round ${g.round}: ${e.winner} thắng (${e.reason}) sau ${dur}s | ${g.score.T}-${g.score.CT} | T sống ${g.alive('T').length}, CT sống ${g.alive('CT').length} | bom ${g.bomb.state}${g.bomb.site ? '@' + g.bomb.site : ''}`);
      check(g.agents.every((a) => a.money >= 0 && a.money <= RULES.maxMoney), 'tiền vượt giới hạn');
    }
  }
  for (const a of g.agents) {
    if (!a.alive) continue;
    if (!Number.isFinite(a.pos.x + a.pos.y + a.pos.z + a.yaw + a.pitch)) { fail.push(`NaN ở ${a.name}`); break; }
    if (a.pos.y < -0.5 || a.pos.y > 4) fail.push(`${a.name} lọt map y=${a.pos.y.toFixed(2)}`);
    if (!g.nav.walkable(a.pos.x, a.pos.z) && !g.map.boxes.some((b) => b.mat === 'crate' && a.pos.y >= b.max[1] - 0.1)) {
      const cx = Math.floor(a.pos.x / 2), cz = Math.floor(a.pos.z / 2);
      if (g.map.solid[cz * g.map.W + cx]) fail.push(`${a.name} xuyên tường (${a.pos.x.toFixed(1)},${a.pos.z.toFixed(1)})`);
    }
  }
  if (fail.length > 20) break;
}
const ms = performance.now() - t0;
console.log('\nsự kiện:', JSON.stringify(c));
console.log(`mô phỏng ${g.now.toFixed(0)}s game trong ${(ms / 1000).toFixed(1)}s (${(steps / (ms / 1000)).toFixed(0)} tick/s, tick chậm nhất ${maxStepMs.toFixed(1)}ms)`);
console.log('điểm:', g.agents.map((a) => `${a.team}:${a.name} ${a.kills}/${a.deaths} $${a.money}`).join(' | '));
check(roundsDone === ROUNDS, `chỉ xong ${roundsDone}/${ROUNDS} round`);
check((c.kill ?? 0) >= ROUNDS * 3, `quá ít kill (${c.kill ?? 0})`);
check((c.plant ?? 0) >= 1, 'T chưa đặt bom lần nào');
check((c.buy ?? 0) > 10, 'bot không mua đồ');
check((c.shot ?? 0) > 50, 'bot ít bắn');
const reasons = new Set(g.history.map((h) => h.reason));
console.log('lý do thắng:', [...reasons].join(', '));
const uniq = [...new Set(fail)];
if (uniq.length) { console.log('\nFAIL:\n- ' + uniq.slice(0, 20).join('\n- ')); process.exit(1); }
console.log('\nSELFTEST PASS');
