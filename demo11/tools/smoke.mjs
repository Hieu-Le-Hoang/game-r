// Smoke test không cần browser: jsdom + Phaser HEADLESS chạy scene thật, asset đọc thẳng từ public/a (texture = canvas giả đúng kích thước).
// Bot chơi hết 1 vòng core loop: chọn class -> farm Lorencia -> cộng điểm -> ép ngọc -> Golden Invasion -> Dungeon -> diệt Gorgon.
// Bắt lỗi runtime trong scene/UI mà `vite build` không thấy. Không đo hình/FPS (cái đó anh test tay).
//   JSDOM_PATH=<node_modules/jsdom> node tools/smoke.mjs [dk|dw] [bench]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const CLS = process.argv[2] === 'dw' ? 'dw' : 'dk';
const BENCH = process.argv[3] === 'bench';
const { JSDOM } = await import(pathToFileURL(path.join(process.env.JSDOM_PATH ?? 'jsdom', 'lib/api.js')).href);
const BN = +(process.argv[4] || 200);
const url = BENCH ? `http://localhost/?bench=${BN}&auto&cls=${CLS}` : 'http://localhost/?xp=40&gold';
const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), { pretendToBeVisual: true, url });
const w = dom.window;
for (const k of ['window', 'document', 'HTMLElement', 'HTMLCanvasElement', 'HTMLImageElement', 'HTMLVideoElement', 'Image', 'Element', 'Node', 'Event', 'localStorage', 'getComputedStyle', 'SVGElement', 'requestAnimationFrame', 'cancelAnimationFrame', 'location', 'innerWidth', 'innerHeight', 'screen', 'XMLHttpRequest'])
  Object.defineProperty(globalThis, k, { value: k === 'window' ? w : w[k], configurable: true, writable: true });
Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true });
globalThis.self = w; globalThis.devicePixelRatio = 1; w.devicePixelRatio = 1;
globalThis.addEventListener = w.addEventListener.bind(w);
w.matchMedia = globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
// Canvas 2D giả: lệnh vẽ là no-op, đo chữ / đọc pixel trả số hợp lệ
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
// ảnh base64 mặc định của Phaser: giả load xong ngay với kích thước 32x32
Object.defineProperty(w.HTMLImageElement.prototype, 'src', { set(v) { this.setAttribute('width', 32); this.setAttribute('height', 32); setTimeout(() => this.onload?.(), 0); }, get() { return ''; } });

function webpSize(file) {
  const b = fs.readFileSync(file), t = b.toString('ascii', 12, 16);
  if (t === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (t === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}

const Phaser = (await import('phaser')).default;
// loader -> đọc đĩa đồng bộ (FileTypesManager gắn method lên từng instance loader, nên vá trong preload)
const LP = {};
// HEADLESS không có renderer: CanvasTexture.refresh vẫn đọc renderer.gl
const TS = Phaser.Textures.TextureSource.prototype, tsUpdate = TS.update;
TS.update = function () { if (this.renderer) return tsUpdate.call(this); };
const pub = (u) => path.join(ROOT, 'public', u.replace(/^\.\//, ''));
LP.json = function (key, u) { if (!this.cacheManager.json.exists(key)) this.cacheManager.json.add(key, JSON.parse(fs.readFileSync(pub(u), 'utf8'))); return this; };
LP.image = function (key, u) {
  if (this.textureManager.exists(key)) return this;
  const [cw, ch] = webpSize(pub(u)), c = w.document.createElement('canvas'); c.width = cw; c.height = ch;
  this.textureManager.addCanvas(key, c);
  return this;
};
LP.audio = function () { return this; };

const { Game, OPT } = await import('../src/game.js');
const pre = Game.prototype.preload;
Game.prototype.preload = function () { Object.assign(this.load, LP); return pre.call(this); };
const { UI } = await import('../src/ui.js');
const { S, newChar, stats } = await import('../src/state.js');
const { MAPS, SKILLS, CLASSES } = await import('../src/data.js');
const { makeItem, makeJewel } = await import('../src/items.js');

const errors = [];
w.addEventListener('error', (e) => errors.push(String(e.message)));
process.on('uncaughtException', (e) => { errors.push(e.stack); console.log('UNCAUGHT', e.stack); });

if (BENCH) {
  const { addPoint } = await import('../src/state.js');
  newChar(CLS); S.lvl = 30; S.pts = 145; addPoint(CLS === 'dk' ? 'str' : 'ene', 90); addPoint('vit', S.pts);
} else newChar(CLS);
const game = new Phaser.Game({ type: Phaser.HEADLESS, width: 1280, height: 720, parent: 'app', audio: { noAudio: true }, banner: false, scene: [Game] });
await new Promise((r) => { const t = setInterval(() => { if (w.__G?.hero) { clearInterval(t); r(); } }, 20); setTimeout(() => { clearInterval(t); r(); }, 8000); });
game.loop.sleep();
if (!w.__G) { console.log('FAIL scene không create được', errors); process.exit(1); }

let T = 0;
const step = (n = 1) => { for (let i = 0; i < n; i++) { T += 1000 / 60; game.headlessStep(T, 1000 / 60); if (errors.length) throw new Error(errors.join('\n')); } };
const G = () => w.__G;
const log = (...a) => console.log(`[${(T / 1000).toFixed(0).padStart(4)}s]`, ...a);
const checks = [];
const ok = (c, m) => { checks.push([!!c, m]); if (!c) console.log('FAIL', m); };

try {
  step(30);
  if (BENCH) {
    step(60 * 4);
    const ms = [];
    for (let i = 0; i < 60 * 20; i++) { const t0 = performance.now(); step(); ms.push(performance.now() - t0); }
    ms.sort((a, b) => a - b);
    log(`logic JS/frame (không render): TB ${(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(2)} ms · p95 ${ms[Math.floor(ms.length * 0.95)].toFixed(2)} ms · max ${ms[ms.length - 1].toFixed(1)} ms`);
    step(60 * 2);
    const g = G();
    ok(g.bench.done, 'bench chạy xong 20s đo');
    ok(g.aliveMobs > BN * 0.75, `bench giữ đủ quái (${g.aliveMobs})`);
    ok(S.kills > 20, `auto skill hạ quái (${S.kills})`);
    log('bench kết thúc', g.aliveMobs, 'quái, kills', S.kills, 'shots', g.shots.length, 'fx', g.fxs.length);
  } else {
    const g = G();
    ok(g.mobs.length > 140, `Lorencia spawn ${g.mobs.length} quái`);
    log('Lorencia', g.mobs.length, 'quái');
    // bot farm: luôn nhắm quái gần nhất, xả skill, uống bình, nhặt đồ
    let lastMap = 'lorencia', golden = false, upgraded = 0, boss = false;
    const brain = () => {
      const g = G(), h = g.hero;
      S.hp = Math.max(S.hp, g.ST.maxHp * 0.5); // bot không chết để đi hết vòng
      if (S.pts) { const k = CLS === 'dk' ? 'str' : 'ene'; UI.toggle('char'); document.querySelector(`#char .plus[data-k="${k}"]`)?.dispatchEvent(new w.MouseEvent('click', { shiftKey: true })); UI.closeAll(); }
      // mặc đồ tốt hơn + ép ngọc qua đúng UI
      if (S.bag.some((x) => x.jewel)) {
        UI.toggle('inv');
        const j = S.bag.find((x) => x.jewel), target = S.eq.main;
        const before = target.lvl;
        UI.useJewel(j, target);
        if (target.lvl !== before) upgraded++;
        UI.closeAll();
      }
      for (const it of S.bag.filter((x) => x.b)) { UI.toggle('inv'); UI.act(it, 'eq'); UI.closeAll(); }
      if (S.bag.length > 40) S.bag.length = 20;
      if (g.golden.until) golden = true;
      // mục tiêu: đủ cấp -> đi cổng
      if (g.mapKey === 'lorencia' && S.lvl >= MAPS.lorencia.portal.lvl && T > 1000 * 150) { h.x = g.portal.x; h.y = g.portal.y; return; }
      if (g.mapKey === 'dungeon' && g.boss?.alive) {
        // bot được buff + bất tử trong Dungeon để chạy hết code boss (phase 2, gọi đệ tử, dậm AoE, chiến thắng)
        h.inv = g.now + 1; if (S.stat.str < 400) { S.stat.str = 400; S.stat.ene = 400; g.equipChanged(); }
        const b = g.boss, d = Math.hypot(b.x - h.x, b.y - h.y);
        if (d > 6) { const p = g.grid.nearestWalk(b.x + 2, b.y + 2, 3); h.x = p.x; h.y = p.y; }
      }
      const t = g.nearestMob(9);
      if (t) {
        const sk = CLASSES[S.cls].skills.filter((k) => SKILLS[k].lvl <= S.lvl && k !== 'tele');
        g.selectSkill(sk[Math.floor(T / 3000) % sk.length]);
        g.castSelected({ x: t.x, y: t.y });
        h.target = { mob: t };
      } else if (!h.path?.length) { const a = Math.random() * 6.28; h.path = g.grid.path(h.x, h.y, h.x + Math.cos(a) * 6, h.y + Math.sin(a) * 6) || []; }
      if (S.hp < g.ST.maxHp * 0.6) g.drink('hp');
      if (S.mp < 20) g.drink('mp');
      g.pickNearest();
    };
    for (let s = 0; s < 60 * 60 * 9 && !boss; s++) {
      if (s % 6 === 0) brain();
      step();
      const g = G();
      if (g.mapKey !== lastMap) { log('đổi map ->', g.mapKey, 'cấp', S.lvl); lastMap = g.mapKey; step(30); }
      if (S.boss) boss = true;
      if (s % 1800 === 0) { const g = G(), h = g.hero, b = g.boss, t = g.nearestMob(30); log('  dbg hero', h.x.toFixed(1), h.y.toFixed(1), h.state, h.anim, 'mp', S.mp.toFixed(0) + '/' + g.ST.maxMp, 'pot', S.hpPot, S.mpPot, 'near', t ? t.d.name + ' ' + Math.hypot(t.x - h.x, t.y - h.y).toFixed(1) + ' ' + t.state : '-', b ? 'boss ' + b.x.toFixed(1) + ',' + b.y.toFixed(1) + ' ' + b.state + ' ' + b.hp + ' alive ' + b.alive : ''); }
      if (s % 3600 === 0) log(`cấp ${S.lvl} · kills ${S.kills} · zen ${S.zen} · túi ${S.bag.length} · quái ${G().aliveMobs} · ${G().mapKey} · vũ khí +${S.eq.main.lvl}`);
    }
    step(60 * 3);
    ok(S.boss && !document.querySelector('#result').hidden, 'hiện panel chiến thắng');
    // tách riêng test UI ép ngọc + NPC + tháo đồ
    UI.toggle('inv'); const it = makeItem(CLS === 'dk' ? 'katana' : 'angelic', { lvl: 6, luck: true }); S.bag.push(it, makeJewel('soul'), makeJewel('bless')); UI.inv();
    UI.useJewel(S.bag.find((x) => x.jewel === 'soul'), it); ok([7, 0].includes(it.lvl), 'ép Ngọc Tâm Linh từ UI');
    UI.closeAll();
    const npc = G().npcs?.[0]; if (npc) { UI.npc(npc); document.querySelectorAll('#dlg-acts .btn')[0]?.click(); UI.closeAll(); }
    step(120);
    ok(golden, 'Golden Invasion đã nổ');
    log(`bot tự ép ngọc ${upgraded} lần`);
    ok(lastMap === 'dungeon' || G().mapKey === 'dungeon' || S.boss, 'đã vào Dungeon');
    ok(S.boss, 'đã diệt Gorgon');
    log(`kết thúc: cấp ${S.lvl}, kills ${S.kills}, boss ${S.boss}, vũ khí ${S.eq.main.b} +${S.eq.main.lvl}`);
  }
  const g = G();
  log('objects', g.children.list.length, 'fx', g.fxs.length, 'pool fx', g.fxPool.length, 'pool số', g.numPool.length, 'loot', g.loot.length, 'timers', g.timers.length);
  ok(g.children.list.length < 6000, 'không rò rỉ game object');
} catch (e) {
  console.log('LỖI RUNTIME:', e.stack || e);
  checks.push([false, 'runtime']);
}
const bad = checks.filter((c) => !c[0]);
console.log(bad.length ? `${bad.length}/${checks.length} FAIL` : `OK ${checks.length} checks`);
process.exit(bad.length ? 1 : 0);
