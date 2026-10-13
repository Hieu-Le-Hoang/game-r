// Smoke test UI không cần browser: DOM giả (Proxy) chỉ để chạy hết code dựng HUD/bảng, bắt lỗi runtime (ReferenceError, TypeError).
// Usage: node tools/uitest.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mkEl = () => {
  const store = { children: [], style: { setProperty() {} }, dataset: {}, classList: { add() {}, remove() {}, toggle() {} } };
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'querySelector') return () => mkEl();
      if (k === 'querySelectorAll') return () => [];
      if (k === 'getContext') return () => new Proxy({}, { get: (o, kk) => (kk in o ? o[kk] : () => {}), set: (o, kk, v) => { o[kk] = v; return true; } });
      if (k === 'getBoundingClientRect') return () => ({ width: 100, height: 100, left: 0, top: 0 });
      if (k === 'closest') return () => mkEl();
      if (['appendChild', 'remove', 'addEventListener', 'removeEventListener', 'setAttribute', 'focus'].includes(k)) return () => {};
      if (k === 'firstChild') return mkEl();
      return '';
    },
    set(t, k, v) { t[k] = v; return true; },
  });
};
globalThis.document = { querySelector: () => mkEl(), querySelectorAll: () => [], createElement: () => mkEl(), addEventListener() {}, fonts: { load: async () => {} } };
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
globalThis.confirm = () => true;

const { UI } = await import('../src/ui/ui.js');
const { Game } = await import('../src/core/game.js');
const { newChar } = await import('../src/core/char.js');
const { makeRng } = await import('../src/core/util.js');
const { makeItem, makeStack } = await import('../src/core/items.js');
const { PHAI } = await import('../src/core/data/phai.js');

const maps = {};
for (const id of ['balang', 'tuongduong', 'm1', 'm2', 'm3', 'm4']) maps[id] = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/a/maps', id + '.json'), 'utf8'));
let errors = 0;
const tryit = (name, fn) => { try { fn(); } catch (e) { errors++; console.log('FAIL', name, '-', e.stack.split('\n').slice(0, 3).join(' | ')); } };

for (const [phai, P] of Object.entries(PHAI)) {
  const rng = makeRng(1);
  const ch = newChar({ name: 'Test', gender: P.genders[0], elem: P.elem });
  const app = { game: null, scene: { ensureOutfit() {} }, save() {}, toggleAuto() {}, useTdp() {}, pickNearest() {} };
  const ui = new UI(app);
  app.ui = ui;
  const g = new Game({ ch, getMap: (id) => maps[id], rng });
  app.game = g;
  g.enter('balang');
  tryit('title', () => ui.title([ch, null, null], () => {}, () => {}, () => {}));
  tryit('create', () => ui.createForm(1, () => {}));
  tryit('hud lv1', () => { ui.startGame(); ui.frame(0.3); ui.drawMini(true); });
  for (const k of ['char', 'inv', 'skills', 'quests', 'auto', 'menu']) tryit('panel ' + k, () => ui.panels.show(k));
  for (const n of g.world.npcs) tryit('npc ' + n.name, () => ui.panels.show('npc', { npc: n, title: n.name }));
  tryit('shop duoc', () => ui.panels.show('shop', { shop: 'duoc' }));
  tryit('shop thoren', () => ui.panels.show('shop', { shop: 'thoren' }));
  tryit('stash', () => ui.panels.show('stash'));
  // lên cấp, nhập phái, mặc đồ xanh + hoàng kim, vào map luyện công
  ch.lv = 56; ch.skillPts = 40; ch.free = 20;
  g.enter('tuongduong');
  tryit('join', () => g.join(Object.keys(PHAI).find((k) => k === phai)));
  for (const q of ['p20', 'p30', 'p40', 'p50', 'xs']) ch.quests[q] = { n: 0, done: true };
  for (const b of ['weapon', 'armor', 'helm', 'gloves', 'boots', 'belt', 'necklace', 'pendant', 'ring', 'ring']) {
    const it = makeItem(rng, b, 50, { rarity: b === 'armor' ? 'gold' : 'blue', phai, kind: P.weapon });
    g.world.addItem(it); g.equip(it.uid);
  }
  g.world.addItem(makeStack('hp3', 20));
  for (const n of g.world.npcs) tryit('npc td ' + n.name, () => ui.panels.show('npc', { npc: n, title: n.name }));
  g.enter('m4');
  for (const k of ['char', 'inv', 'skills', 'quests']) tryit('panel ' + k + ' lv56', () => ui.panels.show(k));
  tryit('hud m4', () => { g.auto.start(); for (let i = 0; i < 300; i++) { g.update(1 / 30); } ui.frame(0.3); ui.hud(true); ui.drawMini(true); });
  tryit('tooltips', () => { for (const it of [...ch.inv, ...Object.values(ch.eq).filter(Boolean)]) ui.panels.findItem(it.uid); });
  const { itemTip } = await import('../src/ui/common.js');
  tryit('itemTip', () => { for (const s of Object.keys(ch.eq)) if (ch.eq[s]) itemTip(ch.eq[s], ch, { slot: s, sell: true }); for (const it of ch.inv) itemTip(it, ch, { price: 10 }); });
  tryit('log/toast/banner', () => { ui.log('x', 'good'); ui.toast('y'); ui.banner('z', 'w'); });
}
console.log(errors ? `${errors} lỗi` : 'UI smoke test: OK (5 phái, mọi bảng + NPC + HUD)');
process.exit(errors ? 1 : 0);
