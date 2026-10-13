import './style.css';
import Phaser from 'phaser';
import { Game, OPT } from './game.js';
import { UI } from './ui.js';
import { S, newChar, stats, addPoint } from './state.js';
import { makeItem } from './items.js';

function showErr(m) { const e = document.createElement('div'); e.id = 'err'; e.textContent = m; document.body.appendChild(e); }
addEventListener('error', (e) => showErr(String(e.message || e)));
addEventListener('unhandledrejection', (e) => showErr(String(e.reason?.message || e.reason)));

// benchmark: nhân vật cấp 30, full đồ +7..+9 để đo cả glow
function benchChar(cls) {
  newChar(cls);
  S.lvl = 30; S.pts = 29 * 5;
  addPoint(cls === 'dk' ? 'str' : 'ene', 90); addPoint('agi', 30); addPoint('vit', S.pts);
  const set = cls === 'dk'
    ? { main: 'giant', off: 'tower', head: 'Thép_head', chest: 'Thép_chest', legs: 'Thép_legs', hands: 'Thép_hands', feet: 'Thép_feet' }
    : { main: 'legstaff', head: 'Huyền Thoại_head', chest: 'Huyền Thoại_chest', legs: 'Huyền Thoại_legs', hands: 'Huyền Thoại_hands', feet: 'Huyền Thoại_feet' };
  let lv = 9;
  for (const [slot, b] of Object.entries(set)) { S.eq[slot] = makeItem(b, { lvl: lv, luck: true }); lv = lv === 9 ? 8 : lv === 8 ? 7 : 9; }
  const st = stats(); S.hp = st.maxHp; S.mp = st.maxMp;
}

function start(cls) {
  if (OPT.bench) benchChar(cls); else newChar(cls);
  new Phaser.Game({
    type: Phaser.AUTO, parent: 'app', backgroundColor: '#07090a',
    scale: { mode: Phaser.Scale.RESIZE, width: innerWidth, height: innerHeight },
    render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
    fps: { smoothStep: false },
    scene: [Game],
  });
}

const fontsReady = Promise.race([Promise.all([document.fonts.load('600 16px "Be Vietnam Pro"'), document.fonts.load('800 30px "Be Vietnam Pro"'), document.fonts.load('700 16px "Cormorant Garamond"')]), new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
fontsReady.then(() => {
  if (OPT.bench) start(OPT.cls);
  else UI.chooseClass(start);
});
