// Smoke test demo5 không cần browser: jsdom + Phaser HEADLESS, dựa trên demo11/tools/smoke.mjs.
// Bot: nhận quest -> farm quái (Q/W/E/R + đánh thường) -> nhặt đồ -> mặc đồ -> hạ Morvak -> nhận thưởng.
// main.js chạy boot ngay khi import, nên script sinh bản headless tools/.main.smoke.js (bỏ css + boot, export Game/UI,
// lớp tối RenderTexture thay bằng stub vì HEADLESS không có renderer). Logic game giữ nguyên.
//   JSDOM_PATH=<node_modules/jsdom> node tools/smoke.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const { JSDOM } = await import(pathToFileURL(path.join(process.env.JSDOM_PATH ?? 'jsdom', 'lib/api.js')).href);
const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
for (const k of ['window', 'document', 'HTMLElement', 'HTMLCanvasElement', 'HTMLImageElement', 'HTMLVideoElement', 'Image', 'Element', 'Node', 'Event', 'localStorage', 'getComputedStyle', 'SVGElement', 'requestAnimationFrame', 'cancelAnimationFrame', 'location', 'innerWidth', 'innerHeight', 'screen', 'XMLHttpRequest'])
  Object.defineProperty(globalThis, k, { value: k === 'window' ? w : w[k], configurable: true, writable: true });
Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true });
globalThis.self = w; globalThis.devicePixelRatio = 1; w.devicePixelRatio = 1;
globalThis.addEventListener = w.addEventListener.bind(w);
w.matchMedia = globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const fakeCtx = () => {
  const st = {};
  const M = {
    measureText: (t) => ({ width: String(t).length * 8, actualBoundingBoxAscent: 12, actualBoundingBoxDescent: 4, fontBoundingBoxAscent: 12, fontBoundingBoxDescent: 4 }),
    getImageData: (x, y, w2, h2) => ({ width: w2, height: h2, data: new Uint8ClampedArray(Math.max(4, (w2 | 0) * (h2 | 0) * 4)) }),
    createImageData: (w2, h2) => ({ width: w2, height: h2, data: new Uint8ClampedArray(Math.max(4, (w2 | 0) * (h2 | 0) * 4)) }),
    createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }), createPattern: () => ({}),
    getLineDash: () => [], isPointInPath: () => false,
  };
  return new Proxy({}, { get: (t, p) => (p in st ? st[p] : p in M ? M[p] : p === 'canvas' ? null : () => {}), set: (t, p, v) => ((st[p] = v), true) });
};
w.HTMLCanvasElement.prototype.getContext = function (t) { return t === '2d' ? (this._ctx ??= fakeCtx()) : null; };
Object.defineProperty(w.HTMLImageElement.prototype, 'src', { set(v) { this.setAttribute('width', 32); this.setAttribute('height', 32); setTimeout(() => this.onload?.(), 0); }, get() { return ''; } });

function webpSize(file) {
  const b = fs.readFileSync(file), t = b.toString('ascii', 12, 16);
  if (t === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (t === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}

const Phaser = (await import('phaser')).default;
const TS = Phaser.Textures.TextureSource.prototype, tsUpdate = TS.update;
TS.update = function () { if (this.renderer) return tsUpdate.call(this); };
const pub = (u) => path.join(ROOT, 'public', u.replace(/^\.\//, ''));
const missing = [];
const LP = {};
LP.json = function (key, u) { if (!fs.existsSync(pub(u))) { missing.push(u); return this; } if (!this.cacheManager.json.exists(key)) this.cacheManager.json.add(key, JSON.parse(fs.readFileSync(pub(u), 'utf8'))); return this; };
LP.image = function (key, u) {
  if (!fs.existsSync(pub(u))) { missing.push(u); return this; }
  if (this.textureManager.exists(key)) return this;
  const [cw, ch] = webpSize(pub(u)), c = w.document.createElement('canvas'); c.width = cw; c.height = ch;
  this.textureManager.addCanvas(key, c);
  return this;
};

const patch = (s, a, b) => { if (!s.includes(a)) throw new Error(`smoke: không tìm thấy "${a}" trong main.js`); return s.replaceAll(a, b); };
let src = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
src = patch(src, "import './style.css';\n", '');
src = patch(src, "from './items.js'", "from '../src/items.js'");
src = patch(src, 'this.renderer.gl', 'this.renderer?.gl');
src = patch(src, 'this.dark = this.add.renderTexture(', 'this.dark = !this.renderer ? { setPosition() { return this; }, clear() {}, fill() {}, stamp() {}, render() {}, destroy() {} } : this.add.renderTexture(');
src = src.slice(0, src.indexOf('const fontsReady')) + 'export { Game, UI };\n';
const SMOKE = path.join(ROOT, 'tools/.main.smoke.js');
fs.writeFileSync(SMOKE, src);
const { Game, UI } = await import(pathToFileURL(SMOKE).href);
fs.unlinkSync(SMOKE);
const pre = Game.prototype.preload;
Game.prototype.preload = function () { Object.assign(this.load, LP); return pre.call(this); };
const { S, stats } = await import('../src/items.js');

const errors = [];
w.addEventListener('error', (e) => errors.push(String(e.error?.stack || e.message)));
process.on('uncaughtException', (e) => { errors.push(e.stack); console.log('UNCAUGHT', e.stack); });
process.on('unhandledRejection', (e) => { errors.push(String(e?.stack || e)); console.log('UNHANDLED', e?.stack || e); });

const game = new Phaser.Game({ type: Phaser.HEADLESS, width: 1280, height: 720, parent: 'app', audio: { noAudio: true }, banner: false, scene: [Game] });
await new Promise((r) => { const t = setInterval(() => { if (w.__G?.hero) { clearInterval(t); r(); } }, 20); setTimeout(() => { clearInterval(t); r(); }, 8000); });
game.loop.sleep();
if (!w.__G?.hero) { console.log('FAIL scene không create được', errors, missing); process.exit(1); }

let T = 0;
const step = (n = 1) => { for (let i = 0; i < n; i++) { T += 1000 / 60; game.headlessStep(T, 1000 / 60); if (errors.length) throw new Error(errors.join('\n')); } };
const G = () => w.__G;
const $ = (s) => document.querySelector(s);
const log = (...a) => console.log(`[${(T / 1000).toFixed(0).padStart(4)}s]`, ...a);
const checks = [];
const ok = (c, m) => { checks.push([!!c, m]); console.log(c ? '  ok ' : 'FAIL', m); };

try {
  step(30);
  const g = G(), h = g.hero;
  ok(g.enemies.length > 10, `spawn ${g.enemies.length} quái`);
  ok($('#loading').hidden, 'tắt màn loading');
  ok(!missing.length, `asset thiếu: ${missing.join(', ') || 'không'}`);
  step(60);
  ok(!!g.boss, 'boss Morvak được lazy-load + spawn');

  // nhận quest qua dialog NPC
  h.x = g.npc.x + 1; h.y = g.npc.y + 1; g.talk();
  ok(!$('#dialog').hidden, 'mở dialog NPC');
  $('#dlg-acts .btn')?.click();
  ok(S.quest === 1, 'nhận quest Kẻ Canh Mộ');

  // click-to-move qua đúng handler input
  g.clickAt({ worldX: 0, worldY: 0, x: 0, y: 0 });
  ok(Array.isArray(h.path), 'click-to-move tìm đường');
  step(5); h.target = null; h.path = null;

  // farm: nhắm quái gần nhất, xả skill, nhặt đồ
  let picked = 0, casts = 0;
  const startXp = S.lvl;
  const brain = () => {
    S.hp = Math.max(S.hp, g.ST.maxHp * 0.6);
    const lootNear = g.loot.find((o) => o.ready);
    if (lootNear) { h.x = lootNear.x; h.y = lootNear.y; h.target = { loot: lootNear }; return; }
    const alive = g.enemies.filter((u) => u.alive && (S.quest > 1 || !u.d.boss || g.enemies.filter((v) => v.alive && !v.d.boss).length < 3));
    if (!alive.length) return;
    alive.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
    const u = alive[0];
    if (Math.hypot(u.x - h.x, u.y - h.y) > 8) { h.x = u.x + 0.4; h.y = u.y + 0.4; }
    h.target = { enemy: u };
    const r = (T / 1000) % 9;
    if (r < 0.2) { g.castFire({ x: u.x, y: u.y }); casts++; }
    else if (r > 3 && r < 3.2) { g.castQuake(); casts++; }
    else if (r > 6 && r < 6.2) { g.castHeal(); g.drink(); casts++; }
  };
  for (let s = 0; s < 60 * 60 * 6 && S.quest < 2; s++) {
    if (s % 6 === 0) brain();
    const nl = g.loot.length; step(); if (g.loot.length < nl) picked++;
    if (s % 3600 === 0) log(`cấp ${S.lvl} · quái còn ${g.enemies.filter((u) => u.alive).length} · túi ${S.bag.length} · vàng ${S.gold} · boss hp ${g.boss?.hp}`);
  }
  ok(casts > 5, `bot cast skill ${casts} lần`);
  ok(S.lvl > startXp, `lên cấp (${S.lvl})`);
  ok(picked > 0, `nhặt ${picked} loot`);
  ok(S.quest === 2, 'hạ Morvak -> quest = 2');

  // nhận thưởng
  h.x = g.npc.x + 1; h.y = g.npc.y + 1; h.target = null; g.talk(); $('#dlg-acts .btn')?.click();
  step(60);
  ok(S.quest === 3, 'nhận thưởng quest');

  // hành trang: mở, mặc đồ, bán đồ
  UI.toggleInv(); UI.inv();
  ok(!$('#inv').hidden, 'mở hành trang');
  const gear = S.bag.find((x) => x.slot && x.slot !== 'potion' && x.slot !== 'gold');
  if (gear) { UI.act(gear, 'eq'); step(30); ok(Object.values(S.eq).includes(gear), `mặc ${gear.name}`); }
  const sell = S.bag.find((x) => x.slot !== 'potion'); if (sell) { const g0 = S.gold; UI.act(sell, 'sell'); ok(S.gold > g0, 'bán đồ'); }
  UI.toggleInv();

  // chết -> không crash
  S.hp = 1; g.hurtHero(999); step(60 * 3);
  ok(true, 'hero chết không crash');
  log('objects', g.children.list.length, 'fx', g.fxs.length, 'loot', g.loot.length, 'timers', g.timers.length);
  ok(g.children.list.length < 6000, 'không rò rỉ game object');
} catch (e) {
  console.log('LỖI RUNTIME:', e.stack || e);
  checks.push([false, 'runtime']);
}
const bad = checks.filter((c) => !c[0]);
console.log(bad.length ? `${bad.length}/${checks.length} FAIL` : `OK ${checks.length} checks`);
process.exit(bad.length ? 1 : 0);
