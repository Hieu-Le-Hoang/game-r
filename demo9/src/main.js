// demo9 — Bụi Sa Mạc: FPS chiến thuật kiểu Counter-Strike 1.3, 5v5 với bot.
// main.js chỉ lo renderer, menu, bàn phím/chuột; một trận nằm trong client/session.js.
import './style.css';
import * as THREE from 'three';
import { Game } from './sim/game.js';
import { initPhysics } from './sim/physics.js';
import { loadModels } from './client/assets.js';
import { MANIFEST, GUN_NODE, SOUND_FILES } from './client/models-config.js';
import { Session } from './client/session.js';
import { Input } from './client/input.js';
import { Audio3D } from './client/audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 500);
const input = new Input(canvas);
const audio = new Audio3D();
const showFps = new URLSearchParams(location.search).has('fps');
let S = null; // session hiện tại
let skill = 'normal';
let last = performance.now(), frames = 0, fpsT = 0, fps = 0;

(async () => {
  const pct = $('loadpct');
  await Promise.all([initPhysics(), loadModels(MANIFEST, GUN_NODE, (p) => { pct.textContent = `${Math.round(p * 100)}%`; })]);
  $('loading').classList.add('hidden');
  $('setup').classList.remove('hidden');
  setupMenu();
})();

function setupMenu() {
  const sens = $('sens'), vol = $('vol'), voice = $('voice');
  sens.value = input.sens; $('sensv').textContent = (+sens.value).toFixed(1);
  vol.value = audio.volume; $('volv').textContent = Math.round(vol.value * 100) + '%';
  voice.checked = audio.voice;
  sens.oninput = () => { input.setSens(+sens.value); $('sensv').textContent = (+sens.value).toFixed(1); };
  vol.oninput = () => { audio.setVolume(+vol.value); $('volv').textContent = Math.round(vol.value * 100) + '%'; };
  voice.onchange = () => { audio.voice = voice.checked; localStorage.setItem('demo9.voice', voice.checked ? '1' : '0'); };
  for (const b of document.querySelectorAll('#skillOpts button')) b.onclick = () => {
    skill = b.dataset.skill;
    document.querySelectorAll('#skillOpts button').forEach((x) => x.classList.toggle('on', x === b));
  };
  for (const b of document.querySelectorAll('#teamOpts button')) b.onclick = () => start(b.dataset.team);
  $('resumeBtn').onclick = () => input.lock();
  $('quitBtn').onclick = () => { stop(); showMenu(false); };
  addEventListener('keydown', (e) => {
    if (S || $('setup').classList.contains('hidden')) return;
    const map = { Digit1: 'T', Digit2: 'CT', Digit5: 'auto', Digit6: 'spec' };
    if (map[e.code]) start(map[e.code]);
  });
}

function showMenu(ingame) {
  $('menu').classList.remove('hidden');
  $('menu').classList.toggle('ingame', ingame);
  $('setup').classList.toggle('hidden', ingame);
  $('resume').classList.toggle('hidden', !ingame);
}

async function start(team) {
  await audio.init(SOUND_FILES);
  if (team === 'auto') team = Math.random() < 0.5 ? 'T' : 'CT';
  const specMode = team === 'spec';
  const game = await Game.create({ humanTeam: specMode ? null : team, humanName: 'Bạn', skill });
  window.__game = game;
  S = new Session(game, { renderer, camera, audio, specMode });
  S.hud.show(true);
  S.hud.center(specMode ? 'Chế độ xem bot<small>Click để đổi người xem · Tab bảng điểm</small>'
    : `Bạn là ${team === 'T' ? 'Terrorist' : 'Counter-Terrorist'}<small>Bấm B để mua đồ · ${team === 'T' ? 'đặt bom ở site A hoặc B' : 'giữ site, gỡ bom nếu bị đặt'}</small>`, 4);
  $('menu').classList.add('hidden');
  input.lock();
  last = performance.now();
}

function stop() {
  if (!S) return;
  S.hud.show(false);
  S.hud.closeBuy();
  S = null;
  renderer.clear();
}

// ---------- Phím ----------
input.onLockChange = (locked) => {
  if (!S) return;
  if (!locked) { showMenu(true); S.hud.closeBuy(); } else $('menu').classList.add('hidden');
};
input.onKey = (code) => {
  if (!S || !input.locked) return false;
  const me = S.game.human, hud = S.hud;
  const digit = /^Digit(\d)$/.exec(code);
  if (code === 'KeyB' && me) { hud.toggleBuy(me); return true; }
  if (digit && hud.buyOpen) return hud.buyKey(+digit[1], me);
  if (digit && me && +digit[1] >= 1 && +digit[1] <= 5) { me.input.slot = +digit[1]; return true; }
  if (code === 'KeyQ' && me) { me.input.slot = me.lastSlot; return true; }
  if (code === 'Tab') { hud.scoreboard(true, me); return true; }
  return false;
};
input.onKeyUp = (code) => { if (code === 'Tab' && S) S.hud.scoreboard(false); };
canvas.addEventListener('mousedown', () => {
  if (!S) return;
  if (!input.locked) { input.lock(); return; }
  if (!S.game.human?.alive) S.cycleSpec(1);
});

// ---------- Vòng lặp ----------
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (t - last) / 1000);
  last = t;
  if (!S) return;
  frames++;
  if (t - fpsT > 1000) { fps = showFps ? frames : 0; frames = 0; fpsT = t; }
  const me = S.game.human;
  const mouseDx = input.dx;
  if (me?.alive && input.locked && !S.hud.buyOpen) input.apply(me, me.scoped === 1 ? 0.4 : me.scoped === 2 ? 0.12 : 1);
  else {
    input.dx = input.dy = 0;
    if (me) Object.assign(me.input, { fwd: 0, side: 0, fire: false, fire2: false, jump: false });
  }
  S.frame(dt, mouseDx, fps);
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
