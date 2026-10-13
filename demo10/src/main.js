// Khởi động: màn chọn nhân vật -> tải map -> Phaser scene + HUD. Lưu localStorage 3 ô nhân vật.
import './style.css';
import Phaser from 'phaser';
import { WorldScene } from './render/scene.js';
import { UI } from './ui/ui.js';
import { setIconMeta } from './ui/common.js';
import { Game } from './core/game.js';
import { newChar, LV_MAX } from './core/char.js';
import { makeRng } from './core/util.js';
import { MAPS } from './core/data/world.js';
import { PHAI } from './core/data/phai.js';

const A = './a/';
const SAVE = (i) => `game-r.demo10.slot${i}`;
const STEP = 1 / 30;

class App {
  constructor() {
    this.ui = new UI(this);
    this.maps = {};
    this.game = null;
    this.scene = null;
    this.paused = true;
    this.acc = 0;
    this.saveT = 30;
  }

  async boot() {
    this.ui.loading('Đang tải bản đồ…', 0);
    const ids = Object.keys(MAPS);
    let n = 0;
    await Promise.all(ids.map(async (id) => {
      this.maps[id] = await (await fetch(`${A}maps/${id}.json`)).json();
      this.ui.loading('Đang tải bản đồ…', ++n / ids.length);
    }));
    setIconMeta(await (await fetch(A + 'icons.json')).json());
    this.ui.loading(null);
    this.titleScreen();
  }

  slots() { return [0, 1, 2].map((i) => { try { return JSON.parse(localStorage.getItem(SAVE(i))); } catch { return null; } }); }
  titleScreen() {
    this.ui.title(this.slots(), (i) => this.play(i, this.slots()[i]), (i, o) => {
      const ch = newChar(o);
      localStorage.setItem(SAVE(i), JSON.stringify(ch));
      this.play(i, ch);
    }, (i) => { localStorage.removeItem(SAVE(i)); this.titleScreen(); });
  }

  play(slot, ch) {
    this.slot = slot;
    this.game = new Game({ ch, getMap: (id) => this.maps[id], rng: makeRng() });
    const pos = !MAPS[ch.map]?.town && ch.pos ? ch.pos : null;
    this.game.enter(MAPS[ch.map] ? ch.map : 'balang', pos);
    this.game.ev.length = 0;
    this.ui.loading('Đang tải sprite…', 0);
    const go = () => this.scene.loadWorld(this.game.world, ch, () => {
      this.ui.loading(null);
      this.ui.startGame();
      this.paused = false;
      this.ui.banner(MAPS[this.game.world.id].name, ch.lv === 1 && !ch.quests.t1 ? 'Gặp Lý Bộ Đầu để nhận nhiệm vụ' : '');
      this.ui.log(`Chào mừng ${ch.name} đến với giang hồ. Phím Z bật auto, Esc xem phím tắt.`, 'good');
    });
    if (this.scene) go();
    else {
      this._onScene = go;
      const fontsReady = Promise.race([document.fonts.load('600 16px "Be Vietnam Pro"'), new Promise((r) => setTimeout(r, 2000))]).catch(() => {});
      fontsReady.then(() => new Phaser.Game({
        type: Phaser.AUTO, parent: 'app', backgroundColor: '#07060a',
        scale: { mode: Phaser.Scale.RESIZE, width: innerWidth, height: innerHeight },
        render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
        scene: [],
      }).scene.add('world', WorldScene, true, { app: this }));
    }
    addEventListener('beforeunload', () => this.save());
  }
  sceneReady(scene) { this.scene = scene; this._onScene && this._onScene(); this._onScene = null; }

  save() {
    if (!this.game) return;
    this.game.world.snapshot();
    localStorage.setItem(SAVE(this.slot), JSON.stringify(this.game.ch));
  }

  // ---------- vòng lặp ----------
  tick(dt) {
    if (this.paused || !this.game) return;
    this.acc = Math.min(this.acc + dt, 0.25);
    while (this.acc >= STEP && !this.paused) {
      this.acc -= STEP;
      this.game.update(STEP);
      this.events();
    }
    this.ui.frame(dt);
    this.saveT -= dt;
    if (this.saveT <= 0) { this.saveT = 30; this.save(); }
  }

  events() {
    const g = this.game, ui = this.ui, sc = this.scene;
    for (const e of g.ev) {
      switch (e.t) {
        case 'enter':
          this.paused = true;
          ui.panels.closeAll();
          ui.loading('Đang vào ' + MAPS[e.map].name + '…', 0);
          sc.loadWorld(g.world, g.ch, () => { this.paused = false; ui.loading(null); ui.banner(MAPS[e.map].name, MAPS[e.map].lv ? `Bãi luyện công cấp ${MAPS[e.map].lv[0]}-${MAPS[e.map].lv[1]}` : 'Thành trấn'); ui.refreshAll(); });
          this.save();
          break;
        case 'dmg': {
          const k = e.kind;
          if (k === 'miss') sc.floatText(e.x, e.y, 'Né', '#b8b0a0');
          else if (k === 'hurt') sc.floatText(e.x, e.y, '-' + e.v, '#ff6a5a');
          else if (k === 'heal') sc.floatText(e.x, e.y, '+' + e.v, '#7be07b');
          else if (k === 'xp') sc.floatText(e.x, e.y - 0.6, `+${e.v} kinh nghiệm`, '#c8a0ff');
          else if (k === 'crit') sc.floatText(e.x, e.y, e.v + '!', '#ffb030', true);
          else sc.floatText(e.x, e.y, String(e.v), '#ffffff');
          break;
        }
        case 'fx': sc.fx(e); break;
        case 'lvup': ui.banner(`Lên cấp ${e.lv}`, e.lv >= LV_MAX ? 'Đã đạt cấp tối đa' : g.ch.lv === 10 && !g.ch.phai ? 'Lên Tương Dương bái sư' : ''); ui.refreshAll(); break;
        case 'msg': ui.log(e.text, e.kind); if (e.kind === 'boss' || e.kind === 'quest') ui.toast(e.text); break;
        case 'npc': ui.panels.show('npc', { npc: e.npc, title: e.npc.name }); break;
        case 'pick':
          if (e.money) ui.log(`Nhặt được ${e.money} lượng`, 'gold');
          else ui.log(`Nhặt được ${e.item.name}${e.item.stack ? ` x${e.item.qty}` : ''}`, e.item.rarity === 'gold' ? 'gold' : e.item.rarity === 'blue' ? 'item' : '');
          if (ui.panels.isOpen('inv')) ui.panels.render('inv');
          break;
        case 'dead': ui.banner('Trọng thương', 'Đang đưa về thành'); break;
        case 'join': sc.ensureOutfit(g.ch); ui.banner(`Bái sư ${PHAI[e.phai].name}`, 'Bấm K để xem võ công'); ui.refreshAll(); break;
        case 'equip': case 'quest': ui.refreshAll(); break;
        case 'autostop': ui.hud(); break;
        default: break;
      }
    }
    g.ev.length = 0;
  }

  // ---------- thao tác ----------
  manual() { if (this.game.auto.on) { this.game.auto.stop(); this.ui.log('Tắt auto do điều khiển tay', ''); } }
  toggleAuto() {
    const g = this.game;
    if (g.auto.on) g.auto.stop(); else g.auto.start();
    this.ui.hud();
  }
  useRight(mon, x, y) {
    const w = this.game.world, s = w.skill(this.game.ch.keys.right);
    if (s.type === 'buff' || s.type === 'heal') { const why = w.canUse(s); if (why) this.ui.log(`${s.name}: ${why}`, 'bad'); else w.castSelf(s.id); return; }
    if (mon) w.cmdAttack(mon, s.id);
    else if (s.shape === 'nova') w.cmdSkillAt(s.id, w.p.x, w.p.y);
    else w.cmdSkillAt(s.id, x, y);
  }
  useTdp() {
    const w = this.game.world, it = this.game.ch.inv.find((x) => x.stack && x.id === 'tdp');
    if (!it) { this.ui.log('Không còn Thổ Địa Phù', 'bad'); return; }
    this.game.auto.stop();
    w.useItem(it.uid);
  }
  pickNearest() {
    const w = this.game.world, p = w.p;
    const d = w.drops.filter((x) => Math.hypot(x.x - p.x, x.y - p.y) < 6).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (d) w.cmdPick(d);
  }
}

function showErr(m) {
  const e = document.createElement('div');
  e.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;max-width:60vw;padding:6px 10px;background:#400;color:#fff;font:12px monospace';
  e.textContent = m;
  document.body.appendChild(e);
}
addEventListener('error', (e) => showErr(String(e.message || e)));
addEventListener('unhandledrejection', (e) => showErr(String(e.reason?.message || e.reason)));

const app = new App();
window.__APP = app;
app.boot();
