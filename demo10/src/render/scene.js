// Phaser scene: vẽ state của core/World (map isometric, người chơi, quái, NPC, đồ rơi, đạn, hiệu ứng) + nhận chuột.
// Không chứa luật chơi — mọi thứ gọi qua app.game (core/game.js).
import Phaser from 'phaser';
import { MONSTERS } from '../core/data/monsters.js';
import { MAPS } from '../core/data/world.js';
import { outfitOf } from '../core/char.js';
import { RARITY, WEAPON_KIND } from '../core/items.js';

const A = './a/';
const BG = { grassland: 0x0b0d08, snowplains: 0x0c0e12, cave: 0x070605 };

// ---------- atlas (định dạng tools/build_assets.py) ----------
const ATLAS = {};
function frameIdx(an, t) {
  const n = an.n, d = an.d || 400;
  if (an.t === 'looped') return Math.floor(t / d * n) % n;
  if (an.t === 'back_forth') { const m = Math.max(1, 2 * n - 2); const k = Math.floor(t / d * m) % m; return k < n ? k : m - k; }
  return Math.min(n - 1, Math.floor(t / d * n));
}

export class WorldScene extends Phaser.Scene {
  constructor() { super('world'); }
  init(data) { this.app = data.app; }

  preload() {
    const L = this.load;
    L.on('progress', (k) => this.app.ui.loading(`Đang tải sprite… ${Math.round(k * 100)}%`, k));
    this.atl('powers', 'powers');
    this.atl('loot', 'loot');
    for (const n of ['guild_man', 'guild_man1', 'guild_man2', 'knight', 'peasant_man1', 'peasant_man2', 'peasant_woman1', 'peasant_woman2', 'wandering_trader', 'wandering_trader1', 'wandering_trader2']) this.atl(n, 'npcs/' + n);
  }
  atl(key, path) { if (!this.textures.exists(key)) { this.load.image(key, A + path + '.webp'); this.load.json(key + '_j', A + path + '.json'); } }
  reg(key) {
    if (ATLAS[key]) return;
    const j = this.cache.json.get(key + '_j');
    ATLAS[key] = j;
    const tex = this.textures.get(key);
    j.frames.forEach((f, i) => tex.add('f' + i, 0, f[0], f[1], f[2], f[3]));
  }

  create() {
    this.load.off('progress');   // tải lười về sau tự báo qua loadWorld, không bật lại màn loading
    for (const k of this.cache.json.getKeys()) if (k.endsWith('_j')) this.reg(k.slice(0, -2));
    const mk = (key, w, h, fn) => { const c = this.textures.createCanvas(key, w, h); fn(c.getContext(), w, h); c.refresh(); };
    mk('glow', 128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
    mk('ring', 128, 64, (x) => { x.strokeStyle = '#fff'; x.lineWidth = 4; x.beginPath(); x.ellipse(64, 32, 58, 26, 0, 0, Math.PI * 2); x.stroke(); });
    mk('arrowp', 36, 6, (x) => { x.fillStyle = '#d8c8a0'; x.fillRect(0, 2, 30, 2); x.fillStyle = '#aaa'; x.beginPath(); x.moveTo(36, 3); x.lineTo(28, 0); x.lineTo(28, 6); x.fill(); });
    this.input.mouse.disableContextMenu();
    this.ents = new Map();      // id thực thể -> sprite bundle
    this.fxs = [];
    this.tiles = new Map();
    this.pool = [];
    this.lastCam = null;
    this.hover = null;
    this.setupInput();
    this.scale.on('resize', () => { this.lastCam = null; });
    this.app.sceneReady(this);
  }

  // ---------- map ----------
  iso(x, y) { return { x: (x - y) * this.TW / 2, y: (x + y) * this.TH / 2 }; }
  unIso(sx, sy) { return { x: sx / this.TW + sy / this.TH, y: sy / this.TH - sx / this.TW }; }

  /** Tải lười texture cho map mới rồi dựng lại cảnh */
  loadWorld(world, ch, done) {
    const need = [['tiles_' + world.map.ts, null]];
    need.push(['ch_' + outfitOf(ch), 'chars/' + outfitOf(ch)]);
    for (const m of world.mons) need.push([MONSTERS[m.type].sprite, 'enemies/' + MONSTERS[m.type].sprite]);
    let todo = 0;
    for (const [k, p] of need) {
      if (this.textures.exists(k)) continue;
      todo++;
      if (p) { this.load.image(k, A + p + '.webp'); this.load.json(k + '_j', A + p + '.json'); }
      else { this.load.image(k, A + k + '.webp'); this.load.json(k + '_t', A + k + '.json'); }
    }
    const finish = () => {
      for (const [k, p] of need) if (p) this.reg(k);
      const tk = 'tiles_' + world.map.ts, tj = this.cache.json.get(tk + '_t');
      const tex = this.textures.get(tk);
      if (!tex.has('t0')) { tex.add('t0', 0, 0, 0, 1, 1); for (const [id, f] of Object.entries(tj)) tex.add('t' + id, 0, f[0], f[1], f[2], f[3]); }
      this.tileDefs = tj;
      this.build(world, ch);
      done && done();
    };
    if (!todo) { finish(); return; }
    this.load.once('complete', finish);
    this.load.start();
  }
  ensureOutfit(ch, cb) {
    const k = 'ch_' + outfitOf(ch);
    if (this.textures.exists(k)) { this.reg(k); cb && cb(); return; }
    this.load.image(k, A + 'chars/' + outfitOf(ch) + '.webp'); this.load.json(k + '_j', A + 'chars/' + outfitOf(ch) + '.json');
    this.load.once('complete', () => { this.reg(k); cb && cb(); });
    this.load.start();
  }

  build(world, ch) {
    this.world = world;
    this.ch = ch;
    this.TW = world.map.tw; this.TH = world.map.th;
    for (const e of this.ents.values()) this.killEnt(e);
    this.ents.clear();
    for (const t of this.tiles.values()) { t.setVisible(false); this.pool.push(t); }
    this.tiles.clear();
    for (const f of this.fxs) f.img.destroy();
    this.fxs = [];
    this.cameras.main.setBackgroundColor(BG[world.map.ts] || 0x080808);
    const p = this.iso(world.p.x, world.p.y), cam = this.cameras.main;
    cam.scrollX = p.x - cam.width / 2; cam.scrollY = p.y - 40 - cam.height / 2;
    this.lastCam = null;
    // cổng ra map
    for (const ex of world.exits) {
      const q = this.iso(ex.x, ex.y);
      const ring = this.add.image(q.x, q.y, 'ring').setTint(0x7cc8ff).setAlpha(0.8).setDepth((ex.x + ex.y) * 10 - 5).setScale(1.2);
      const glow = this.add.image(q.x, q.y - 10, 'glow').setTint(0x5aa8ff).setAlpha(0.5).setScale(1.2, 0.8).setBlendMode('ADD').setDepth((ex.x + ex.y) * 10 - 4);
      const txt = this.label(q.x, q.y - 40, `→ ${MAPS[ex.to].name}`, '#9fd4ff').setDepth(1e6);
      this.ents.set('x' + ex.id, { kind: 'exit', ref: ex, imgs: [ring, glow, txt] });
      this.tweens.add({ targets: glow, alpha: 0.2, duration: 900, yoyo: true, repeat: -1 });
    }
  }

  label(x, y, text, color = '#ece4d2', size = 12) {
    return this.add.text(x, y, text, { fontFamily: 'Be Vietnam Pro, sans-serif', fontSize: size + 'px', fontStyle: '600', color, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1);
  }

  // dựng tile trong vùng camera, tái dùng image cũ (map Flare tới 132x132 ô)
  updateTiles() {
    const cam = this.cameras.main, v = cam.worldView;
    const key = `${Math.round(v.x / 24)},${Math.round(v.y / 24)},${v.width},${v.height}`;
    if (key === this.lastCam) return;
    this.lastCam = key;
    const M = this.world.map, W = M.w, H = M.h, TD = this.tileDefs;
    const pad = 360;
    const x0 = v.x - pad, x1 = v.right + pad, y0 = v.y - pad, y1 = v.bottom + 720;
    const c = [this.unIso(x0, y0), this.unIso(x1, y0), this.unIso(x0, y1), this.unIso(x1, y1)];
    const i0 = Math.max(0, Math.floor(Math.min(...c.map((q) => q.x)))), i1 = Math.min(W - 1, Math.ceil(Math.max(...c.map((q) => q.x))));
    const j0 = Math.max(0, Math.floor(Math.min(...c.map((q) => q.y)))), j1 = Math.min(H - 1, Math.ceil(Math.max(...c.map((q) => q.y))));
    const seen = new Set();
    const put = (k, id, x, y, depth) => {
      seen.add(k);
      if (this.tiles.has(k)) return;
      const f = TD[id];
      if (!f) return;
      const img = this.pool.pop() || this.add.image(0, 0, '__DEFAULT');
      img.setTexture('tiles_' + M.ts, 't' + id).setOrigin(f[4] / f[2], f[5] / f[3]).setPosition(x, y).setDepth(depth).setVisible(true).setAlpha(1);
      this.tiles.set(k, img);
    };
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const p = this.iso(i + 0.5, j + 0.5);
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      const n = j * W + i;
      if (M.bg[n]) put('b' + n, M.bg[n], p.x, p.y, -1e6 + i + j);
      if (M.obj[n]) put('o' + n, M.obj[n], p.x, p.y, (i + j + 1) * 10);
    }
    for (const [k, img] of this.tiles) if (!seen.has(k)) { img.setVisible(false); this.pool.push(img); this.tiles.delete(k); }
  }

  // ---------- thực thể ----------
  killEnt(e) { for (const i of e.imgs) i.destroy(); }
  setFrame(img, key, anim, dir, t, fallback = 'stance') {
    const at = ATLAS[key];
    let an = at && (at.anims[anim] || at.anims[fallback]);
    if (!an) { img.setVisible(false); return false; }
    const fr = an.dir[dir % an.dir.length][frameIdx(an, t)];
    if (fr == null || fr < 0) { img.setVisible(false); return false; }
    const f = at.frames[fr];
    img.setTexture(key, 'f' + fr).setOrigin(f[4] / f[2], f[5] / f[3]).setVisible(true);
    return true;
  }
  unit(id, kind, key, o = {}) {
    let e = this.ents.get(id);
    if (e) return e;
    const sh = this.add.image(0, 0, 'glow').setTint(0x000000).setAlpha(0.5).setScale(o.shadow || 0.6, (o.shadow || 0.6) * 0.42);
    const img = this.add.image(0, 0, '__DEFAULT');
    e = { kind, key, img, sh, imgs: [img, sh] };
    if (o.name) { e.name = this.label(0, 0, o.name, o.color, o.size || 12); e.imgs.push(e.name); }
    this.ents.set(id, e);
    return e;
  }

  sync(dt) {
    const w = this.world;
    if (!w) return;
    const cam = this.cameras.main, p = w.p;
    const pp = this.iso(p.x, p.y);
    const tx = pp.x - cam.width / 2, ty = pp.y - 40 - cam.height / 2;
    const k = Math.min(1, dt * 8);
    cam.scrollX += (tx - cam.scrollX) * k; cam.scrollY += (ty - cam.scrollY) * k;
    this.updateTiles();
    const alive = new Set();
    // người chơi
    {
      const key = 'ch_' + outfitOf(this.ch);
      if (this.ents.get('p') && this.ents.get('p').key !== key && ATLAS[key]) { this.killEnt(this.ents.get('p')); this.ents.delete('p'); }
      const e = this.unit('p', 'player', ATLAS[key] ? key : this.ents.get('p')?.key || key, { name: this.ch.name, color: '#ffffff', shadow: 0.62 });
      alive.add('p');
      const anim = p.anim === 'sit' ? 'die' : p.anim;
      const t = p.anim === 'sit' ? 300 : p.animT;   // khung 'die' thứ 3 = tư thế quỳ ngồi
      this.setFrame(e.img, e.key, anim, p.dir, t);
      e.img.setPosition(pp.x, pp.y).setDepth((p.x + p.y) * 10 + 1);
      e.sh.setPosition(pp.x, pp.y).setDepth((p.x + p.y) * 10 - 1);
      e.name.setPosition(pp.x, pp.y - 92).setDepth(1e6).setVisible(!p.dead);
      if (p.status.poison?.until > w.t) e.img.setTint(0x9cff9c); else if (p.status.slow?.until > w.t) e.img.setTint(0x9cc8ff); else e.img.clearTint();
    }
    // quái
    for (const m of w.mons) {
      const id = 'm' + m.id;
      const D = MONSTERS[m.type], key = D.sprite;
      if (m.dead && w.t - m.deadT > 6) { if (this.ents.has(id)) { this.killEnt(this.ents.get(id)); this.ents.delete(id); } continue; }
      alive.add(id);
      const e = this.unit(id, 'mon', key, { shadow: D.boss ? 1.3 : 0.55 });
      e.ref = m;
      const q = this.iso(m.x, m.y);
      this.setFrame(e.img, key, m.anim, m.dir, m.animT);
      e.img.setPosition(q.x, q.y).setDepth((m.x + m.y) * 10 + 1).setScale(D.scale || 1);
      const mod = ATLAS[key]?.mod;
      const hurt = w.t - m.hurtT < 0.1;
      if (hurt) e.img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else {
        e.img.setTintMode(Phaser.TintModes.MULTIPLY);
        if (D.tint) e.img.setTint(D.tint);
        else if (mod?.color_mod) e.img.setTint((mod.color_mod[0] << 16) | (mod.color_mod[1] << 8) | mod.color_mod[2]);
        else e.img.setTint(0xffffff);
      }
      e.img.setAlpha(m.dead ? Math.max(0, 1 - (w.t - m.deadT - 3) / 3) : (D.alpha || 1));
      e.sh.setPosition(q.x, q.y).setDepth((m.x + m.y) * 10 - 1).setVisible(!m.dead);
      if (D.boss && !e.aura) { e.aura = this.add.image(0, 0, 'glow').setTint(0xffb020).setBlendMode('ADD').setScale(2.4, 1); e.imgs.push(e.aura); }
      if (e.aura) e.aura.setPosition(q.x, q.y).setDepth((m.x + m.y) * 10 - 2).setAlpha(m.dead ? 0 : 0.35 + Math.sin(w.t * 3) * 0.12);
    }
    // NPC
    for (const n of w.npcs) {
      const id = 'n' + n.id;
      alive.add(id);
      const e = this.unit(id, 'npc', n.sprite, { name: n.name, color: '#f2d64b' });
      e.ref = n;
      const q = this.iso(n.x, n.y);
      this.setFrame(e.img, n.sprite, 'stance', n.dir, w.t * 1000);
      e.img.setPosition(q.x, q.y).setDepth((n.x + n.y) * 10 + 1);
      e.sh.setPosition(q.x, q.y).setDepth((n.x + n.y) * 10 - 1);
      e.name.setPosition(q.x, q.y - 96).setDepth(1e6);
    }
    // đồ rơi
    const alt = this.app.ui.altDown;
    for (const d of w.drops) {
      const id = 'd' + d.id;
      alive.add(id);
      let e = this.ents.get(id);
      const q = this.iso(d.x, d.y);
      if (!e) {
        const anim = d.money ? (d.money >= 100 ? 'coins100' : d.money >= 25 ? 'coins25' : 'coins5') : d.item.stack ? (d.item.id.startsWith('mp') ? 'mp_potion' : d.item.id === 'tdp' ? 'scroll' : 'hp_potion') : d.item.loot || 'gem';
        const img = this.add.image(q.x, q.y, '__DEFAULT');
        const it = d.item;
        const col = d.money ? '#f2d64b' : it.stack ? '#ece4d2' : RARITY[it.rarity].color;
        const name = this.label(q.x, q.y - 18, d.money ? `${d.money} lượng` : it.stack ? it.name : it.name, col, 11).setDepth(1e6);
        e = { kind: 'drop', ref: d, img, name, anim: anim + ':power', imgs: [img, name], t0: w.t };
        if (it && it.rarity !== 'white' && !it.stack) { e.beam = this.add.image(q.x, q.y - 20, 'glow').setTint(it.rarity === 'gold' ? 0xffc030 : 0x5a8cff).setBlendMode('ADD').setScale(0.5, 1.6).setAlpha(0.6); e.imgs.push(e.beam); }
        this.ents.set(id, e);
      }
      e.ref = d;
      this.setFrame(e.img, 'loot', e.anim, 0, (w.t - e.t0) * 1000);
      e.img.setPosition(q.x, q.y).setDepth((d.x + d.y) * 10);
      if (e.beam) e.beam.setPosition(q.x, q.y - 20).setDepth((d.x + d.y) * 10 - 1);
      e.name.setVisible(alt || this.hover === e || (d.item && !d.item.stack && d.item.rarity !== 'white'));
    }
    // đạn
    for (const pr of w.projs) {
      const id = 'j' + pr.id;
      alive.add(id);
      let e = this.ents.get(id);
      const q = this.iso(pr.x, pr.y);
      if (!e) {
        const img = this.add.image(q.x, q.y, '__DEFAULT');
        if (pr.fx === 'arrows') img.setTexture('arrowp').setOrigin(0.5);
        e = { kind: 'proj', img, imgs: [img], t0: w.t };
        if (pr.fx === 'fireball' || pr.fx === 'icicle' || pr.fx === 'spark_orange') { e.gl = this.add.image(q.x, q.y, 'glow').setBlendMode('ADD').setTint(pr.fx === 'icicle' ? 0x6ab0ff : 0xff7a30).setScale(0.5); e.imgs.push(e.gl); }
        this.ents.set(id, e);
      }
      const dir = Math.round((((Math.atan2(pr.vy, pr.vx) * 180 / Math.PI - 135) % 360 + 360) % 360) / 45) % 8;
      if (pr.fx === 'arrows') { const v = this.iso(pr.vx, pr.vy); e.img.setRotation(Math.atan2(v.y, v.x)); }
      else this.setFrame(e.img, 'powers', pr.fx + ':power', dir, (w.t - e.t0) * 1000);
      e.img.setPosition(q.x, q.y - 40).setDepth((pr.x + pr.y) * 10 + 5);
      if (e.gl) e.gl.setPosition(q.x, q.y - 40).setDepth((pr.x + pr.y) * 10 + 4);
    }
    for (const [id, e] of this.ents) if (!alive.has(id) && e.kind !== 'exit') { this.killEnt(e); this.ents.delete(id); }
    // hiệu ứng 1 lần
    this.fxs = this.fxs.filter((f) => {
      f.t += dt * 1000;
      const o = f.on === 0 ? w.p : f.on ? w.mons.find((m) => m.id === f.on) : null;
      if (o) { const q = this.iso(o.x, o.y); f.img.setPosition(q.x, q.y - f.lift); }
      const ok = this.setFrame(f.img, 'powers', f.key, 0, f.t);
      const an = ATLAS.powers.anims[f.key];
      if (!ok || f.t >= (an?.t === 'play_once' ? an.d : f.life)) { f.img.destroy(); return false; }
      return true;
    });
    this.pickHover();
  }

  fx(e) {
    const key = e.key + ':power';
    if (!ATLAS.powers.anims[key]) return;
    const q = this.iso(e.x, e.y);
    const lift = ['heal', 'shield', 'runes', 'runes_blue', 'runes_orange', 'sparkle', 'dark_mist', 'quake', 'blast', 'spikes', 'freeze', 'cleave'].includes(e.key) ? 0 : 36;
    const img = this.add.image(q.x, q.y - lift, '__DEFAULT').setDepth((e.x + e.y) * 10 + 6);
    if (e.big) img.setScale(Math.max(1, e.big / 2.2));
    if (e.small) img.setScale(0.7);
    if (['blast', 'fireball', 'spark_red', 'spark_orange', 'spark_blue', 'spark_green', 'thunderstrike', 'lightning', 'heal', 'sparkle', 'runes_orange', 'runes_blue'].includes(e.key)) img.setBlendMode('ADD');
    this.fxs.push({ img, key, t: 0, on: e.on, lift, life: 900 });
  }

  floatText(x, y, text, color, big) {
    const q = this.iso(x, y);
    const t = this.add.text(q.x + (Math.random() * 20 - 10), q.y - 80, text, { fontFamily: 'Be Vietnam Pro, sans-serif', fontSize: (big ? 20 : 15) + 'px', fontStyle: '700', color, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(1e6 + 1);
    this.tweens.add({ targets: t, y: t.y - 46, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  // ---------- chuột ----------
  pickHover() {
    const ptr = this.input.activePointer;
    const wx = ptr.worldX, wy = ptr.worldY;
    let best = null, bd = 1e9;
    for (const e of this.ents.values()) {
      if (!e.ref || e.kind === 'player') continue;
      if (e.kind === 'mon' && e.ref.dead) continue;
      const q = this.iso(e.ref.x, e.ref.y);
      const h = e.kind === 'drop' ? 26 : e.kind === 'exit' ? 30 : e.ref.def?.boss ? 140 : 80;
      const wdt = e.kind === 'drop' ? 26 : e.kind === 'exit' ? 50 : e.ref.def?.boss ? 60 : 30;
      if (wx < q.x - wdt || wx > q.x + wdt || wy < q.y - h || wy > q.y + 10) continue;
      const pri = e.kind === 'npc' ? 0 : e.kind === 'mon' ? 1 : e.kind === 'drop' ? 2 : 3;
      const d = pri * 1000 + Math.hypot(wx - q.x, wy - (q.y - h / 2));
      if (d < bd) { bd = d; best = e; }
    }
    if (this.hover !== best) {
      this.hover = best;
      this.input.setDefaultCursor(best?.kind === 'mon' ? 'crosshair' : best ? 'pointer' : 'default');
      this.app.ui.hoverMon(best?.kind === 'mon' ? best.ref : null);
    }
  }

  setupInput() {
    this.holding = false;
    this.input.on('pointerdown', (ptr) => {
      if (!this.world || this.app.paused) return;
      const right = ptr.rightButtonDown();
      const h = this.hover;
      const m = this.unIso(ptr.worldX, ptr.worldY);
      this.app.manual();
      if (right) { this.app.useRight(h?.kind === 'mon' ? h.ref : null, m.x, m.y); return; }
      if (h?.kind === 'mon') this.world.cmdAttack(h.ref, this.ch.keys.left);
      else if (h?.kind === 'npc') this.world.cmdNpc(h.ref);
      else if (h?.kind === 'drop') this.world.cmdPick(h.ref);
      else if (h?.kind === 'exit') this.world.cmdExit(h.ref);
      else { this.world.cmdMove(m.x, m.y); this.holding = true; this.holdT = 0; this.addClickMark(ptr.worldX, ptr.worldY); }
    });
    this.input.on('pointerup', () => { this.holding = false; });
    this.input.on('gameout', () => { this.holding = false; });
  }
  addClickMark(x, y) {
    const r = this.add.image(x, y, 'ring').setScale(0.35).setTint(0xf2d64b).setDepth(1e6).setAlpha(0.9);
    this.tweens.add({ targets: r, scale: 0.1, alpha: 0, duration: 400, onComplete: () => r.destroy() });
  }
  holdMove(dt) {
    if (!this.holding || !this.world) return;
    this.holdT -= dt;
    if (this.holdT > 0) return;
    this.holdT = 0.15;
    const ptr = this.input.activePointer;
    const m = this.unIso(ptr.worldX, ptr.worldY);
    if (this.world.p.goal?.type === 'move' || !this.world.p.goal) this.world.cmdMove(m.x, m.y);
  }

  update(time, delta) {
    const dt = Math.min(0.1, delta / 1000);
    this.holdMove(dt);
    this.app.tick(dt);
    this.sync(dt);
  }
}
export { ATLAS, WEAPON_KIND };
