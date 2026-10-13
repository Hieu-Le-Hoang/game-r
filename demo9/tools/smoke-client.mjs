// Smoke test phía client không cần browser: DOM giả (jsdom) + renderer giả, chạy Session y như main.js vài phút game.
// Bắt lỗi runtime JS trong render/HUD/fx/actor/viewmodel + kiểm rò rỉ object trong scene.
//   JSDOM_PATH=/path/to/node_modules/jsdom npx vite-node tools/smoke-client.mjs [giây] [T|CT|spec]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const { JSDOM } = await import(process.env.JSDOM_PATH ?? 'jsdom');
const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
for (const k of ['window', 'document', 'HTMLElement', 'HTMLCanvasElement', 'HTMLImageElement', 'Image', 'localStorage', 'getComputedStyle', 'SVGElement'])
  if (!(k in globalThis) || k === 'window') globalThis[k] = k === 'window' ? w : w[k];
globalThis.self = w;
// Canvas 2D giả: mọi lệnh vẽ là no-op
const noop = new Proxy(function () {}, { get: (t, p) => (p === 'canvas' ? null : noop), apply: () => noop, set: () => true });
w.HTMLCanvasElement.prototype.getContext = function (t) { return t === '2d' ? noop : null; };

const THREE = await import('three');
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
const { MODELS } = await import('../src/client/assets.js');
const { GUN_NODE } = await import('../src/client/models-config.js');
const { Game } = await import('../src/sim/game.js');
const { Session } = await import('../src/client/session.js');

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const parse = (f) => { const b = fs.readFileSync(path.join(ROOT, 'public/models', f)); return new Promise((res, rej) => loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', res, rej)); };
MODELS.chars.T = await parse('chars/t.glb');
MODELS.chars.CT = await parse('chars/ct.glb');
const guns = await parse('guns/guns.glb');
for (const [id, node] of Object.entries(GUN_NODE)) {
  const n = guns.scene.getObjectByName(node).clone(true);
  n.position.set(0, 0, 0);
  n.userData.muzzle = n.getObjectByName(`${node}_muzzle`)?.position.clone() ?? new THREE.Vector3();
  MODELS.guns[id] = n;
}

const SECS = +(process.argv[2] ?? 240), MODE = process.argv[3] ?? 'T';
const sounds = {};
const audio = { listener: null, play: (n) => { sounds[n] = (sounds[n] ?? 0) + 1; }, say: (t) => { sounds[`say:${t}`] = (sounds[`say:${t}`] ?? 0) + 1; } };
let renders = 0;
const renderer = { autoClear: true, render: () => { renders++; }, clearDepth: () => {} };
const camera = new THREE.PerspectiveCamera(74, 16 / 9, 0.05, 500);
const game = await Game.create({ humanTeam: MODE === 'spec' ? null : MODE, seed: 5 });
const S = new Session(game, { renderer, camera, audio, specMode: MODE === 'spec' });
S.hud.show(true);

// Người chơi "giả": đi + xoay + bắn + mua đồ + đổi súng
const me = game.human;
let maxChildren = 0, maxFx = 0;
const t0 = performance.now();
const dt = 1 / 60;
for (let f = 0; f < SECS * 60; f++) {
  if (me?.alive) {
    const t = f * dt;
    Object.assign(me.input, { fwd: Math.sin(t * 0.7) > -0.3 ? 1 : 0, side: Math.sin(t * 1.3) > 0.6 ? 1 : 0, fire: Math.sin(t * 3) > 0.4, fire2: f % 300 === 0, jump: f % 97 === 0, duck: Math.sin(t * 0.4) > 0.9, reload: f % 400 === 0 });
    me.yaw += 0.01;
    if (f % 600 === 30) { S.hud.toggleBuy(me); S.hud.buyKey(3, me); S.hud.buyKey(1, me); S.hud.toggleBuy(me); S.hud.buyKey(6, me); S.hud.buyKey(2, me); }
    if (f % 700 === 0) me.input.slot = 1 + (f / 700) % 4;
    if (f % 2000 === 0) S.hud.scoreboard(true, me);
  }
  S.frame(dt, 0, 60);
  maxChildren = Math.max(maxChildren, S.scene.children.length);
  maxFx = Math.max(maxFx, S.fx.items.length);
}
const ms = performance.now() - t0;
console.log(`client chạy ${SECS}s game (${MODE}) trong ${(ms / 1000).toFixed(1)}s — ${(SECS * 60 / (ms / 1000)).toFixed(0)} frame/s CPU (không tính GPU)`);
console.log(`round ${game.round}, điểm ${game.score.T}-${game.score.CT}, renders ${renders}, scene children max ${maxChildren} (cuối ${S.scene.children.length}), fx max ${maxFx}`);
console.log('âm thanh:', JSON.stringify(sounds));
console.log('HUD:', document.getElementById('time').textContent, '$' + document.getElementById('money').textContent, 'killfeed', document.getElementById('killfeed').children.length);
const fail = [];
if (renders < SECS * 60) fail.push('thiếu lần render');
if (S.scene.children.length > 600) fail.push('scene phình (rò rỉ object?)');
if (!sounds.pistol && !sounds.rifle) fail.push('không có tiếng súng');
if (fail.length) { console.log('FAIL:', fail.join('; ')); process.exit(1); }
console.log('SMOKE PASS');
