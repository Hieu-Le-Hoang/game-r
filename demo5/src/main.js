import './style.css';
import Phaser from 'phaser';
import { S, stats, xpNeed, rollItem, RAR, SLOTS, SLOT_NAME, DEFAULT_LAYER, sellPrice, UNIQUE } from './items.js';

const $ = (s) => document.querySelector(s);
const rnd = Math.random;
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const A = './a/';
const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');

let MAP, TW, TH, ICONS;
const iso = (mx, my) => ({ x: (mx - my) * TW / 2, y: (mx + my) * TH / 2 });
const unIso = (sx, sy) => ({ x: sx / TW + sy / TH, y: sy / TH - sx / TW });
const walk = (x, y) => { const i = Math.floor(x), j = Math.floor(y); return i >= 0 && j >= 0 && i < MAP.w && j < MAP.h && MAP.col[j * MAP.w + i] === 0; };
// hướng Flare: dir0 nhìn trái màn hình, quay theo chiều kim đồng hồ (xem tools/build_assets.py)
const dirOf = (dx, dy) => { const a = Math.atan2(dy, dx) * 180 / Math.PI; return ((Math.round(((a - 135) % 360 + 360) % 360 / 45)) % 8); };
const LAYER_ORDER = [
  'main,feet,legs,hands,chest,off,head', 'main,feet,legs,hands,chest,off,head', 'main,feet,legs,hands,chest,off,head',
  'feet,legs,hands,chest,off,head,main', 'feet,legs,hands,chest,off,head,main', 'feet,legs,hands,chest,off,head,main',
  'feet,legs,hands,main,chest,head,off', 'main,feet,legs,hands,chest,head,off',
].map((s) => s.split(','));

const EN = {
  skeleton: { name: 'Bộ Xương Chiến Binh', hp: 46, dmg: [5, 9], spd: 2.2, range: 1.3, xp: 14, atk: 'swing', hitAt: 0.55, cd: 1.3 },
  skeleton_weak: { name: 'Bộ Xương Mục Rữa', hp: 28, dmg: [3, 6], spd: 2.5, range: 1.25, xp: 9, atk: 'swing', hitAt: 0.55, cd: 1.1 },
  zombie: { name: 'Xác Sống', hp: 64, dmg: [6, 10], spd: 1.25, range: 1.25, xp: 15, atk: 'swing', hitAt: 0.6, cd: 1.6 },
  skeleton_archer: { name: 'Cung Thủ Xương', hp: 30, dmg: [5, 8], spd: 2.0, range: 6, xp: 14, atk: 'shoot', ranged: 'arrow', hitAt: 0.6, cd: 1.9 },
  skeleton_mage: { name: 'Pháp Sư Xương', hp: 32, dmg: [7, 11], spd: 1.9, range: 6.5, xp: 16, atk: 'cast', ranged: 'icicle', hitAt: 0.6, cd: 2.2 },
  minotaur: { name: 'Morvak Đầu Bò', hp: 640, dmg: [14, 22], spd: 2.1, range: 1.9, xp: 220, atk: 'swing', hitAt: 0.5, cd: 1.8, boss: true },
};
const UNDEAD = ['skeleton', 'skeleton', 'skeleton_weak', 'zombie', 'skeleton_mage'];

// ---------- atlas ----------
const ATLAS = {};
function regAtlas(scene, key) {
  const j = scene.cache.json.get(key + '_j');
  ATLAS[key] = j;
  const tex = scene.textures.get(key);
  j.frames.forEach((f, i) => tex.add('f' + i, 0, f[0], f[1], f[2], f[3]));
}
function frameIdx(an, t) {
  const n = an.n, d = an.d || 400;
  if (an.t === 'looped') return Math.floor(t / d * n) % n;
  if (an.t === 'back_forth') { const m = Math.max(1, 2 * n - 2); const k = Math.floor(t / d * m) % m; return k < n ? k : m - k; }
  return Math.min(n - 1, Math.floor(t / d * n));
}
function setFrame(img, key, anim, dir, t) {
  const at = ATLAS[key];
  const an = at && at.anims[anim];
  if (!an) { img.setVisible(false); return false; }
  const fr = an.dir[dir][frameIdx(an, t)];
  if (fr == null || fr < 0) { img.setVisible(false); return false; }
  const f = at.frames[fr];
  img.setTexture(key, 'f' + fr).setOrigin(f[4] / f[2], f[5] / f[3]).setVisible(true);
  return true;
}
const animDone = (key, anim, t) => { const an = ATLAS[key]?.anims[anim]; return !an || t >= an.d; };

// ---------- pathfinding (A*, 8 hướng, không cắt góc) ----------
function findPath(sx, sy, tx, ty, maxN = 2500) {
  const W = MAP.w, si = Math.floor(sx), sj = Math.floor(sy);
  let ti = Math.floor(tx), tj = Math.floor(ty);
  if (!walk(ti + 0.5, tj + 0.5)) {
    let best = null, bd = 9;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (walk(ti + di + 0.5, tj + dj + 0.5)) { const d = di * di + dj * dj; if (d < bd) { bd = d; best = [ti + di, tj + dj]; } }
    if (!best) return null; [ti, tj] = best;
  }
  const key = (i, j) => j * W + i;
  const open = [[si, sj]], g = new Map([[key(si, sj), 0]]), from = new Map(), h = (i, j) => Math.hypot(ti - i, tj - j);
  const f = new Map([[key(si, sj), h(si, sj)]]);
  let n = 0;
  while (open.length && n++ < maxN) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (f.get(key(...open[k])) < f.get(key(...open[bi]))) bi = k;
    const [ci, cj] = open.splice(bi, 1)[0];
    if (ci === ti && cj === tj) {
      const path = [[ti + 0.5, tj + 0.5]]; let k = key(ti, tj);
      while (from.has(k)) { k = from.get(k); path.unshift([k % W + 0.5, Math.floor(k / W) + 0.5]); }
      path.shift();
      return path;
    }
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = ci + di, nj = cj + dj;
      if (!walk(ni + 0.5, nj + 0.5)) continue;
      if (di && dj && (!walk(ci + di + 0.5, cj + 0.5) || !walk(ci + 0.5, cj + dj + 0.5))) continue;
      const ng = g.get(key(ci, cj)) + (di && dj ? 1.414 : 1);
      const nk = key(ni, nj);
      if (ng < (g.get(nk) ?? 1e9)) { g.set(nk, ng); f.set(nk, ng + h(ni, nj)); from.set(nk, key(ci, cj)); if (!open.some((o) => o[0] === ni && o[1] === nj)) open.push([ni, nj]); }
    }
  }
  return null;
}
function lineFree(ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d * 4);
  for (let k = 1; k <= n; k++) { const t = k / n; if (!walk(ax + (bx - ax) * t, ay + (by - ay) * t)) return false; }
  return true;
}
function slide(u, dx, dy, r = 0.28) {
  const ok = (x, y) => walk(x - r, y - r) && walk(x + r, y - r) && walk(x - r, y + r) && walk(x + r, y + r);
  if (ok(u.x + dx, u.y)) u.x += dx;
  if (ok(u.x, u.y + dy)) u.y += dy;
}

// ---------- scene ----------
class Game extends Phaser.Scene {
  constructor() { super('game'); }

  preload() {
    const L = this.load;
    L.on('progress', (k) => { $('#ld-fill').style.width = `${Math.round(k * 100)}%`; $('#ld-txt').textContent = `Đang tải sprite… ${Math.round(k * 100)}%`; });
    L.json('map', A + 'map.json');
    L.json('icons_j', A + 'icons.json');
    const atl = (key, path) => { L.image(key, A + path + '.webp'); L.json(key + '_j', A + path + '.json'); };
    L.image('tiles', A + 'tiles.webp');
    atl('loot', 'loot'); atl('powers', 'powers'); atl('knight', 'npcs/knight');
    for (const e of ['skeleton', 'skeleton_weak', 'zombie', 'skeleton_archer', 'skeleton_mage']) atl(e, 'enemies/' + e);
    for (const l of this.heroLayerKeys()) atl(l, 'hero/' + l);
  }

  heroLayerKeys() {
    const ks = new Set(Object.values(DEFAULT_LAYER));
    for (const s of SLOTS) if (S.eq[s]) ks.add(S.eq[s].layer);
    return [...ks];
  }

  create() {
    window.__G = this;
    MAP = this.cache.json.get('map'); TW = MAP.tw; TH = MAP.th;
    ICONS = this.cache.json.get('icons_j');
    for (const k of ['loot', 'powers', 'knight', 'skeleton', 'skeleton_weak', 'zombie', 'skeleton_archer', 'skeleton_mage', ...this.heroLayerKeys()]) regAtlas(this, k);
    const tex = this.textures.get('tiles');
    for (const [id, f] of Object.entries(MAP.tiles)) tex.add('t' + id, 0, f[0], f[1], f[2], f[3]);
    this.makeTextures();

    this.ST = stats(); S.hp = this.ST.maxHp; S.mp = this.ST.maxMp;
    this.ents = []; this.enemies = []; this.loot = []; this.fxs = []; this.shots = []; this.timers = []; this.lamps = [];
    this.now = 0; this.cd = { q: 0, w: 0, e: 0, r: 0 }; this.shake = 0;
    this.buildMap();
    this.spawnHero();
    this.spawnEnemies();
    this.spawnNpc();
    this.dark = null; this.onResize();
    { const hp = iso(this.hero.x, this.hero.y), cam = this.cameras.main; cam.scrollX = hp.x - cam.width / 2; cam.scrollY = hp.y - 60 - cam.height / 2; }
    this.scale.on('resize', () => this.onResize());
    this.setupInput();
    UI.init(this);
    UI.banner('Hầm Mộ Ardwen', 'Lochport · Tầng mộ');
    $('#loading').hidden = true;
    // tải nền boss + đồ còn lại
    this.lazy(['enemies/minotaur'], () => this.spawnBoss());
  }

  // ---------- textures phụ ----------
  makeTextures() {
    const mk = (key, w, h, fn) => { const c = this.textures.createCanvas(key, w, h); fn(c.getContext(), w, h); c.refresh(); };
    mk('light', 512, 512, (x) => { const g = x.createRadialGradient(256, 256, 0, 256, 256, 256); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 512, 512); });
    mk('glow', 128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
    mk('arrow', 40, 6, (x) => { x.strokeStyle = '#d8c8a0'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 3); x.lineTo(34, 3); x.stroke(); x.fillStyle = '#9a9a9a'; x.beginPath(); x.moveTo(40, 3); x.lineTo(32, 0); x.lineTo(32, 6); x.fill(); x.fillStyle = '#7a4a2a'; x.fillRect(0, 1, 6, 4); });
    mk('ring', 256, 128, (x) => { x.strokeStyle = 'rgba(255,255,255,1)'; x.lineWidth = 6; x.beginPath(); x.ellipse(128, 64, 120, 58, 0, 0, Math.PI * 2); x.stroke(); });
  }

  // ---------- map ----------
  buildMap() {
    const { w: W, h: H } = MAP;
    this.objImgs = {};
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const p = iso(i + 0.5, j + 0.5);
      const b = MAP.bg[j * W + i];
      if (b && MAP.tiles[b]) { const f = MAP.tiles[b]; this.add.image(p.x, p.y, 'tiles', 't' + b).setOrigin(f[4] / f[2], f[5] / f[3]).setDepth(-1e6 + i + j); }
      const o = MAP.obj[j * W + i];
      if (o && MAP.tiles[o]) { const f = MAP.tiles[o]; this.objImgs[j * W + i] = this.add.image(p.x, p.y, 'tiles', 't' + o).setOrigin(f[4] / f[2], f[5] / f[3]).setDepth((i + j + 1) * 10); }
    }
    this.chests = MAP.chests.map((c) => ({ ...c, img: this.objImgs[c.y * W + c.x], opened: false }));
  }
  setTile(i, j, id) {
    const img = this.objImgs[j * MAP.w + i];
    const f = MAP.tiles[id];
    if (img && f) img.setTexture('tiles', 't' + id).setOrigin(f[4] / f[2], f[5] / f[3]);
  }

  // ---------- lazy load ----------
  lazy(paths, cb) {
    const todo = paths.filter((p) => !ATLAS[p.split('/').pop()]);
    if (!todo.length) { cb && cb(); return; }
    for (const p of todo) { const k = p.split('/').pop(); this.load.image(k, A + p + '.webp'); this.load.json(k + '_j', A + p + '.json'); }
    this.load.once('complete', () => { for (const p of todo) { const k = p.split('/').pop(); if (!ATLAS[k] && this.textures.exists(k)) regAtlas(this, k); } cb && cb(); });
    this.load.start();
  }

  // ---------- hero ----------
  spawnHero() {
    const [hx, hy] = MAP.hero;
    const h = { x: hx + 0.5, y: hy + 0.5, dir: 7, anim: 'stance', t: 0, imgs: {}, state: 'idle', path: null, target: null };
    for (const s of SLOTS) h.imgs[s] = this.add.image(0, 0, '__DEFAULT').setVisible(false);
    this.shadow = this.add.image(0, 0, 'glow').setTint(0x000000).setAlpha(0.55).setScale(0.75, 0.35);
    this.hero = h;
  }
  heroKey(slot) { return S.eq[slot]?.layer || DEFAULT_LAYER[slot] || null; }
  heroAnim(name, once) { const h = this.hero; if (h.anim === name && !once) return; h.anim = name; h.t = 0; }
  equipChanged() {
    const need = SLOTS.map((s) => this.heroKey(s)).filter(Boolean).filter((k) => !ATLAS[k]).map((k) => 'hero/' + k);
    this.lazy(need, () => { this.ST = stats(); UI.vitals(); });
    this.ST = stats();
    const p = iso(this.hero.x, this.hero.y);
    this.power('sparkle:power', this.hero.x, this.hero.y, 0, { add: true, scale: 0.8 });
    this.lightAt(p.x, p.y - 40, 0.6, 400);
  }
  drawHero(dt) {
    const h = this.hero;
    h.t += dt * 1000 * (h.anim === 'swing' || h.anim === 'cast' ? this.ST.speed : 1);
    const p = iso(h.x, h.y);
    const base = (h.x + h.y) * 10 + 1;
    LAYER_ORDER[h.dir].forEach((slot, k) => {
      const img = h.imgs[slot], key = this.heroKey(slot);
      if (!key || !ATLAS[key]) { img.setVisible(false); return; }
      setFrame(img, key, h.anim, h.dir, h.t);
      img.setPosition(p.x, p.y).setDepth(base + k * 0.01);
    });
    this.shadow.setPosition(p.x, p.y).setDepth(base - 0.5);
  }

  // ---------- units ----------
  makeUnit(type, x, y, o = {}) {
    const d = EN[type];
    const u = { type, d, x, y, dir: rint(0, 7), anim: 'stance', t: rnd() * 1000, hp: Math.round(d.hp * (o.mul || 1)), max: Math.round(d.hp * (o.mul || 1)), alive: true, state: 'idle', home: { x, y }, atkReady: 0, path: null, repath: 0, lvl: o.lvl || 2 };
    u.img = this.add.image(0, 0, type).setVisible(false);
    if (d.boss) u.img.setScale(1.0);
    u.shadow = this.add.image(0, 0, 'glow').setTint(0x000000).setAlpha(0.5).setScale(d.boss ? 1.4 : 0.7, d.boss ? 0.6 : 0.32);
    this.enemies.push(u);
    return u;
  }
  spawnEnemies() {
    for (const g of MAP.enemies) {
      const n = g.n.length > 1 ? rint(g.n[0], g.n[1]) : g.n[0];
      for (let k = 0; k < n; k++) {
        let x, y, tries = 0;
        do { x = g.x + rnd() * g.w; y = g.y + rnd() * g.h; } while (!walk(x, y) && tries++ < 30);
        if (!walk(x, y)) continue;
        this.makeUnit(g.cat === 'skeleton_archer' ? 'skeleton_archer' : UNDEAD[rint(0, UNDEAD.length - 1)], x, y);
      }
    }
  }
  spawnBoss() {
    const b = this.makeUnit('minotaur', 11.5, 5.5, { lvl: 5 });
    b.dir = 6;
    this.boss = b;
  }
  spawnNpc() {
    let x = MAP.hero[0] - 1.5, y = MAP.hero[1] - 1.5;
    if (!walk(x, y)) { x = MAP.hero[0] + 0.5; y = MAP.hero[1] - 1.5; }
    const n = { x, y, dir: 7, t: 0, img: this.add.image(0, 0, 'knight') };
    this.npc = n;
    this.npcLabel = this.add.text(0, 0, '!', { fontFamily: 'Cormorant Garamond', fontStyle: '700', fontSize: '40px', color: '#f0d898', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5, 1).setDepth(1e6);
  }

  // ---------- input ----------
  setupInput() {
    this.input.mouse?.disableContextMenu();
    this.keys = this.input.keyboard.addKeys('Q,W,E,R,I,ESC,UP,DOWN,LEFT,RIGHT,F');
    this.keys.Q.on('down', () => this.castFire(this.aimPoint()));
    this.keys.W.on('down', () => this.castQuake());
    this.keys.E.on('down', () => this.castHeal());
    this.keys.R.on('down', () => this.drink());
    this.keys.I.on('down', () => UI.toggleInv());
    this.keys.F.on('down', () => this.talk());
    this.keys.ESC.on('down', () => { $('#inv').hidden = true; $('#dialog').hidden = true; });
    this.ptr = { x: 0, y: 0, down: false };
    this.input.on('pointerdown', (p) => {
      if (UI.busy) return;
      const m = unIso(p.worldX, p.worldY);
      this.ptr = { x: m.x, y: m.y, down: true, sx: p.x, sy: p.y };
      if (p.rightButtonDown()) { this.castFire(m); return; }
      if (p.pointerType === 'touch' && p.x < this.scale.width * 0.45 && p.y > this.scale.height * 0.35) {
        const hit = this.pick(p);
        if (!hit) { this.joy = { id: p.id, x: p.x, y: p.y, v: null }; const j = $('#joy'); j.hidden = false; j.style.left = `${p.x}px`; j.style.top = `${p.y}px`; return; }
      }
      this.clickAt(p);
    });
    this.input.on('pointermove', (p) => {
      const m = unIso(p.worldX, p.worldY);
      this.ptr.x = m.x; this.ptr.y = m.y;
      if (this.joy && p.id === this.joy.id) {
        let dx = p.x - this.joy.x, dy = p.y - this.joy.y; const l = Math.hypot(dx, dy), M = 50;
        if (l > M) { dx = dx / l * M; dy = dy / l * M; }
        this.joy.v = { x: dx / M, y: dy / M };
        $('#joy-knob').style.transform = `translate(${dx}px, ${dy}px)`;
      }
      if (!isTouch) UI.hover(this.pick(p), p);
    });
    this.input.on('pointerup', (p) => { this.ptr.down = false; if (this.joy && p.id === this.joy.id) { this.joy = null; $('#joy').hidden = true; } });
  }
  pick(p) {
    let best = null, bd = isTouch ? 70 : 46;
    for (const u of this.enemies) {
      if (!u.alive) continue;
      const s = iso(u.x, u.y), sy = s.y - (u.d.boss ? 110 : 55);
      const cam = this.cameras.main;
      const d = Math.hypot((s.x - cam.worldView.x) * cam.zoom - p.x, (sy - cam.worldView.y) * cam.zoom - p.y);
      if (d < bd) { bd = d; best = { enemy: u }; }
    }
    if (best) return best;
    const m = unIso(p.worldX, p.worldY);
    for (const o of this.loot) if (o.ready && Math.hypot(o.x - m.x, o.y - m.y) < 0.8) return { loot: o };
    for (const c of this.chests) if (!c.opened && Math.hypot(c.x + 0.5 - m.x, c.y + 0.5 - m.y) < 1) return { chest: c };
    if (Math.hypot(this.npc.x - m.x, this.npc.y - m.y) < 1) return { npc: true };
    return null;
  }
  clickAt(p) {
    const hit = this.pick(p), h = this.hero;
    const m = unIso(p.worldX, p.worldY);
    h.target = hit;
    const goal = hit?.enemy ? hit.enemy : hit?.loot ? hit.loot : hit?.chest ? { x: hit.chest.x + 0.5, y: hit.chest.y + 0.5 } : hit?.npc ? this.npc : m;
    h.path = findPath(h.x, h.y, goal.x, goal.y) || null;
    if (!hit && h.path === null) h.path = [];
    if (!hit) this.marker(m.x, m.y);
  }
  aimPoint() {
    const t = this.nearest(9);
    return isTouch && t ? t : { x: this.ptr.x, y: this.ptr.y };
  }
  marker(x, y) {
    const p = iso(x, y);
    const r = this.add.image(p.x, p.y, 'ring').setScale(0.35).setTint(0xc7a35a).setDepth(-1e5).setAlpha(0.9);
    this.tweens.add({ targets: r, scale: 0.12, alpha: 0, duration: 380, onComplete: () => r.destroy() });
  }
  talk() {
    if (Math.hypot(this.npc.x - this.hero.x, this.npc.y - this.hero.y) > 2.2) return;
    UI.npcDialog();
  }

  // ---------- combat ----------
  nearest(range) {
    let best = null, bd = range;
    for (const u of this.enemies) if (u.alive && u.state !== 'dormant') { const d = Math.hypot(u.x - this.hero.x, u.y - this.hero.y); if (d < bd) { bd = d; best = u; } }
    return best;
  }
  after(sec, fn) { this.timers.push({ t: this.now + sec, fn }); }
  faceTo(u, x, y) { u.dir = dirOf(x - u.x, y - u.y); }
  busy() { return ['swing', 'cast', 'hit', 'die'].includes(this.hero.anim) && !animDone(this.heroKey('chest'), this.hero.anim, this.hero.t); }

  attack(u) {
    const h = this.hero;
    if (this.now < (h.atkReady || 0) || h.state === 'dead') return;
    this.faceTo(h, u.x, u.y);
    const magic = this.ST.magic;
    this.heroAnim(magic ? 'cast' : 'swing', true);
    h.atkReady = this.now + 0.62 / this.ST.speed;
    this.after(0.22 / this.ST.speed, () => {
      if (magic) return this.shoot('hero', h, u, 'fireball', rint(this.ST.dmg[0], this.ST.dmg[1]) + 4);
      this.power('cleave:power', h.x, h.y, h.dir, { add: true, scale: 0.9 });
      if (u.alive && Math.hypot(u.x - h.x, u.y - h.y) < 1.9 + (u.d.boss ? 0.6 : 0)) this.hitEnemy(u, rint(this.ST.dmg[0], this.ST.dmg[1]));
      if (this.ST.powers.fireProc && rnd() < 0.25) this.shoot('hero', h, u, 'fireball', 12);
    });
  }
  castFire(pt) {
    const h = this.hero;
    if (!pt || h.state === 'dead' || this.now < this.cd.q || UI.busy) return;
    if (S.mp < 8) return this.say('Không đủ mana');
    S.mp -= 8; this.cd.q = this.now + 0.55;
    this.faceTo(h, pt.x, pt.y); h.path = null; h.target = null;
    this.heroAnim('cast', true);
    this.after(0.18, () => this.shoot('hero', h, pt, 'fireball', rint(8, 13) + S.lvl * 2 + this.ST.ene));
  }
  castQuake() {
    const h = this.hero;
    if (h.state === 'dead' || this.now < this.cd.w || UI.busy) return;
    if (S.mp < 18) return this.say('Không đủ mana');
    S.mp -= 18; this.cd.w = this.now + 3.5; h.path = null;
    this.heroAnim('cast', true);
    this.after(0.25, () => {
      this.power('quake:power', h.x, h.y, 0, { scale: 1.6 });
      this.shake = 0.6;
      const p = iso(h.x, h.y); this.lightAt(p.x, p.y, 1.1, 350, 0xffa040);
      for (const u of this.enemies) if (u.alive && u.state !== 'dormant' && Math.hypot(u.x - h.x, u.y - h.y) < 3.2) this.hitEnemy(u, rint(14, 22) + S.lvl * 3, { stun: 1.2 });
    });
  }
  castHeal() {
    const h = this.hero;
    if (h.state === 'dead' || this.now < this.cd.e || UI.busy) return;
    if (S.mp < 15) return this.say('Không đủ mana');
    S.mp -= 15; this.cd.e = this.now + 6;
    const v = Math.round(this.ST.maxHp * 0.35); S.hp = Math.min(this.ST.maxHp, S.hp + v);
    this.power('heal:power', h.x, h.y, 0, { add: true });
    this.float(h.x, h.y, `+${v}`, '#6fd36f');
    UI.vitals();
  }
  drink() {
    if (this.hero.state === 'dead' || this.now < this.cd.r) return;
    const i = S.bag.findIndex((it) => it.slot === 'potion');
    if (i < 0) return this.say('Hết bình máu');
    S.bag.splice(i, 1); this.cd.r = this.now + 2;
    const v = Math.round(this.ST.maxHp * 0.5); S.hp = Math.min(this.ST.maxHp, S.hp + v);
    this.float(this.hero.x, this.hero.y, `+${v}`, '#6fd36f');
    this.power('spark_red:power', this.hero.x, this.hero.y, 0, { add: true });
    UI.vitals(); if (!$('#inv').hidden) UI.inv();
  }
  say(t) { this.float(this.hero.x, this.hero.y, t, '#9db4ff'); }

  shoot(owner, from, to, kind, dmg) {
    const dx = to.x - from.x, dy = to.y - from.y, l = Math.hypot(dx, dy) || 1;
    const sp = kind === 'arrow' ? 9 : kind === 'icicle' ? 7 : 8.5;
    const s = { owner, kind, x: from.x + dx / l * 0.5, y: from.y + dy / l * 0.5, vx: dx / l * sp, vy: dy / l * sp, dmg, life: 1.6, dir: dirOf(dx, dy), t: 0 };
    if (kind === 'arrow') { const a = iso(dx, dy); s.img = this.add.image(0, 0, 'arrow').setRotation(Math.atan2(a.y, a.x)); }
    else { s.img = this.add.image(0, 0, 'powers').setBlendMode(kind === 'fireball' ? 'ADD' : 'NORMAL'); }
    this.shots.push(s);
  }
  updateShots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; s.t += dt * 1000;
      const p = iso(s.x, s.y);
      if (s.kind === 'arrow') s.img.setPosition(p.x, p.y - 60).setDepth((s.x + s.y) * 10 + 2);
      else { setFrame(s.img, 'powers', s.kind + ':power', s.dir, s.t); s.img.setPosition(p.x, p.y - 20).setDepth((s.x + s.y) * 10 + 2); }
      if (s.kind === 'fireball') this.lamps.push({ x: p.x, y: p.y - 50, s: 0.5, c: 0xff8a30, once: true });
      let hit = null;
      if (s.owner === 'hero') hit = this.enemies.find((u) => u.alive && u.state !== 'dormant' && Math.hypot(u.x - s.x, u.y - s.y) < (u.d.boss ? 1.1 : 0.6));
      else if (this.hero.state !== 'dead' && Math.hypot(this.hero.x - s.x, this.hero.y - s.y) < 0.55) hit = this.hero;
      if (hit || s.life <= 0 || !walk(s.x, s.y)) {
        if (s.kind === 'fireball') {
          this.power('blast:power', s.x, s.y, 0, { add: true, scale: 0.9 });
          this.lightAt(p.x, p.y - 40, 0.9, 300, 0xff8a30);
          for (const u of this.enemies) if (u.alive && u.state !== 'dormant' && Math.hypot(u.x - s.x, u.y - s.y) < 1.4) this.hitEnemy(u, u === hit ? s.dmg : Math.round(s.dmg * 0.5), { fire: true });
        } else if (s.kind === 'icicle') this.power('freeze:power', s.x, s.y, 0, { add: true, scale: 0.7 });
        if (hit === this.hero) this.hurtHero(s.dmg);
        s.img.destroy(); this.shots.splice(i, 1);
      }
    }
  }

  hitEnemy(u, base, o = {}) {
    if (!u.alive) return;
    const ST = this.ST, crit = rnd() * 100 < ST.crit;
    const d = Math.max(1, Math.round(base * ST.mult * (crit ? 2 : 1)) + (o.fire ? 0 : ST.fire));
    u.hp -= d;
    if (u.state === 'dormant' || u.state === 'idle') u.state = 'chase';
    this.float(u.x, u.y, crit ? `${d}!` : `${d}`, crit ? '#f0d898' : o.fire ? '#ff9a4a' : '#ffffff', crit);
    this.power('spark_red:power', u.x, u.y, 0, { add: true, scale: 0.6, dy: -50 });
    u.img.setTintFill(0xffffff); this.after(0.06, () => u.img.active && u.img.clearTint());
    if (ST.ls) S.hp = Math.min(ST.maxHp, S.hp + Math.max(1, Math.round(d * ST.ls / 100)));
    if (crit) this.shake = Math.max(this.shake, 0.25);
    if (o.stun) u.stun = this.now + o.stun;
    if (u.hp <= 0) return this.killEnemy(u);
    if (!u.d.boss && u.anim !== u.d.atk && rnd() < 0.6) { u.anim = 'hit'; u.t = 0; }
    UI.target(u);
  }
  killEnemy(u) {
    u.alive = false; u.anim = 'die'; u.t = 0;
    this.gainXp(u.d.xp + u.lvl * 2);
    if (this.ST.powers.boom) { this.power('blast:power', u.x, u.y, 0, { add: true }); for (const o of this.enemies) if (o.alive && Math.hypot(o.x - u.x, o.y - u.y) < 1.8) this.after(0.05, () => this.hitEnemy(o, 12, { fire: true })); }
    if (this.ST.powers.leech) S.hp = Math.min(this.ST.maxHp, S.hp + Math.round(this.ST.maxHp * 0.02));
    const n = u.d.boss ? 5 : rnd() < 0.5 ? 1 : 0;
    for (let k = 0; k < n; k++) this.after(0.2 + k * 0.15, () => this.dropItem(rollItem(u.lvl + 1, { boost: u.d.boss ? 30 : this.ST.mf / 2, rarity: u.d.boss && k === 0 ? 3 : undefined }), u.x, u.y));
    if (rnd() < 0.55 || u.d.boss) this.after(0.1, () => this.dropGold(u.x, u.y, rint(4, 14) * (u.d.boss ? 10 : 1)));
    if (u.d.boss) { UI.target(null); UI.banner('Morvak đã gục ngã', 'Hầm mộ đã yên'); this.shake = 0.8; if (S.quest === 1) { S.quest = 2; UI.quest(); } }
    else UI.target(null);
    this.after(9, () => this.tweens.add({ targets: [u.img, u.shadow], alpha: 0, duration: 1500, onComplete: () => { u.img.destroy(); u.shadow.destroy(); } }));
  }
  hurtHero(d) {
    const h = this.hero;
    if (h.state === 'dead') return;
    d = Math.max(1, Math.round(d * (1 - Math.min(0.65, this.ST.armor / (this.ST.armor + 60)))));
    S.hp -= d;
    this.float(h.x, h.y, `-${d}`, '#ff6a5a');
    this.cameras.main.flash(80, 120, 0, 0, false);
    this.shake = Math.max(this.shake, 0.18);
    if (S.hp <= 0) {
      S.hp = 0; h.state = 'dead'; this.heroAnim('die', true); h.path = null;
      UI.banner('Bạn đã chết', 'Hồi sinh sau 3 giây');
      this.after(3, () => { S.hp = this.ST.maxHp; S.mp = this.ST.maxMp; S.gold = Math.floor(S.gold * 0.8); h.x = MAP.hero[0] + 0.5; h.y = MAP.hero[1] + 0.5; h.state = 'idle'; this.heroAnim('stance', true); h.inv = this.now + 2; });
    } else if (!this.busy() && rnd() < 0.35) this.heroAnim('hit', true);
    UI.vitals();
  }
  gainXp(n) {
    S.xp += n;
    while (S.xp >= xpNeed()) {
      S.xp -= xpNeed(); S.lvl++;
      this.ST = stats(); S.hp = this.ST.maxHp; S.mp = this.ST.maxMp;
      this.power('sparkle:power', this.hero.x, this.hero.y, 0, { add: true, scale: 1.2 });
      const p = iso(this.hero.x, this.hero.y);
      this.lightAt(p.x, p.y - 40, 1.2, 800, 0xf0d898);
      this.float(this.hero.x, this.hero.y, `Lên cấp ${S.lvl}!`, '#f0d898', true);
      UI.toast(`Lên cấp ${S.lvl}`, '#f0d898');
    }
    UI.vitals();
  }

  // ---------- loot ----------
  spot(x, y) {
    for (let k = 0; k < 20; k++) { const a = rnd() * Math.PI * 2, r = 0.4 + rnd() * 1.1; const nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r; if (walk(nx, ny) && !this.loot.some((o) => Math.hypot(o.x - nx, o.y - ny) < 0.6)) return [nx, ny]; }
    return [x, y];
  }
  dropItem(it, x, y) {
    const [lx, ly] = this.spot(x, y);
    const o = { it, x: lx, y: ly, t: 0, ready: false, img: this.add.image(0, 0, 'loot') };
    const R = RAR[it.rarity];
    o.label = this.add.text(0, 0, it.name, { fontFamily: 'Be Vietnam Pro', fontSize: '13px', color: R.c, backgroundColor: 'rgba(0,0,0,.72)', padding: { x: 5, y: 2 } }).setOrigin(0.5, 1).setDepth(1e6).setVisible(false).setResolution(Math.min(2, devicePixelRatio || 1));
    if (it.rarity === 3) { UI.toast(`Rơi đồ độc nhất: ${it.name}`, R.c); this.shake = 0.3; }
    this.loot.push(o);
  }
  dropGold(x, y, n) { this.dropItem({ id: -1, slot: 'gold', loot: n > 60 ? 'coins100' : n > 20 ? 'coins25' : 'coins5', name: `${n} vàng`, rarity: 0, gold: n, affixes: [] }, x, y); }
  updateLoot(dt) {
    const h = this.hero;
    for (let i = this.loot.length - 1; i >= 0; i--) {
      const o = this.loot[i];
      o.t += dt * 1000;
      const p = iso(o.x, o.y);
      setFrame(o.img, 'loot', o.it.loot + ':power', 0, o.t);
      o.img.setPosition(p.x, p.y).setDepth((o.x + o.y) * 10);
      if (!o.ready && o.t > 600) { o.ready = true; o.label.setVisible(true); }
      o.label.setPosition(p.x, p.y - 26);
      if (o.it.rarity >= 1) this.lamps.push({ x: p.x, y: p.y, s: 0.12 + o.it.rarity * 0.04, once: true });
      if (o.ready && h.state !== 'dead' && Math.hypot(o.x - h.x, o.y - h.y) < 0.65) this.pickup(o, i);
    }
  }
  pickup(o, i) {
    this.loot.splice(i, 1); o.img.destroy(); o.label.destroy();
    if (o.it.gold) { S.gold += o.it.gold; UI.vitals(); return; }
    if (S.bag.length >= 30) { S.gold += sellPrice(o.it); UI.toast(`Hành trang đầy, tự bán ${o.it.name}`, '#9a907c'); }
    else { S.bag.push(o.it); UI.toast(`Nhặt: ${o.it.name}`, RAR[o.it.rarity].c); }
    if (o.it.layer) this.lazy(['hero/' + o.it.layer]);
    UI.vitals(); if (!$('#inv').hidden) UI.inv();
  }
  openChest(c) {
    c.opened = true;
    const open = { 144: 160, 145: 161, 147: 163 }[MAP.obj[c.y * MAP.w + c.x]];
    if (open) this.setTile(c.x, c.y, open);
    const p = iso(c.x + 0.5, c.y + 0.5);
    this.lightAt(p.x, p.y - 30, 0.8, 600, 0xf0d898);
    this.power('sparkle:power', c.x + 0.5, c.y + 0.5, 0, { add: true });
    for (let k = 0; k < 3; k++) this.after(0.15 + k * 0.15, () => this.dropItem(rollItem(S.lvl + 1, { boost: 14 }), c.x + 0.5, c.y + 0.5));
    this.after(0.1, () => this.dropGold(c.x + 0.5, c.y + 0.5, rint(30, 70)));
  }

  // ---------- fx ----------
  power(anim, x, y, dir, o = {}) {
    const p = iso(x, y);
    const img = this.add.image(p.x, p.y + (o.dy || 0), 'powers').setScale(o.scale || 1).setDepth((x + y) * 10 + 3);
    if (o.add) img.setBlendMode('ADD');
    this.fxs.push({ img, anim, dir, t: 0 });
  }
  updateFx(dt) {
    for (let i = this.fxs.length - 1; i >= 0; i--) {
      const f = this.fxs[i]; f.t += dt * 1000;
      if (animDone('powers', f.anim, f.t)) { f.img.destroy(); this.fxs.splice(i, 1); continue; }
      setFrame(f.img, 'powers', f.anim, f.dir, f.t);
    }
  }
  float(x, y, txt, color, big) {
    const p = iso(x, y);
    const t = this.add.text(p.x + rint(-14, 14), p.y - 110, txt, { fontFamily: 'Be Vietnam Pro', fontStyle: '600', fontSize: big ? '26px' : '18px', color, stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(1e6 + 1).setResolution(Math.min(2, devicePixelRatio || 1));
    this.tweens.add({ targets: t, y: t.y - 46, alpha: { from: 1, to: 0 }, duration: big ? 1400 : 900, ease: 'Cubic.Out', onComplete: () => t.destroy() });
  }
  lightAt(x, y, s, ms, c) {
    const L = { x, y, s, c, until: this.now + ms / 1000 };
    this.lamps.push(L);
  }

  // ---------- AI ----------
  updateEnemies(dt) {
    const h = this.hero;
    for (const u of this.enemies) {
      u.t += dt * 1000;
      const p = iso(u.x, u.y);
      if (!u.alive) {
        const da = ATLAS[u.type].anims.die;
        setFrame(u.img, u.type, 'die', u.dir, Math.min(u.t, da.d * (da.t === 'back_forth' ? 0.5 : 1) - 1));
        u.img.setPosition(p.x, p.y).setDepth((u.x + u.y) * 10 - 5);
        u.shadow.setPosition(p.x, p.y).setDepth((u.x + u.y) * 10 - 6);
        continue;
      }
      const d = Math.hypot(h.x - u.x, h.y - u.y), D = u.d;
      const stunned = u.stun && this.now < u.stun;
      if (u.anim === 'hit' && u.t < 260) { /* khựng lại */ }
      else if (u.anim === D.atk && !animDone(u.type, D.atk, u.t)) { /* đang đánh */ }
      else if (h.state === 'dead' || stunned) u.anim = 'stance';
      else if (u.state === 'idle') {
        u.anim = 'stance';
        if (d < (D.boss ? 6 : 7) && lineFree(u.x, u.y, h.x, h.y)) { u.state = 'chase'; if (D.boss) { UI.banner(D.name, 'Kẻ canh mộ'); UI.target(u); this.shake = 0.4; } }
      } else if (u.state === 'chase') {
        const inRange = d <= D.range && (!D.ranged || lineFree(u.x, u.y, h.x, h.y));
        if (inRange && this.now > u.atkReady) {
          this.faceTo(u, h.x, h.y); u.anim = D.atk; u.t = 0; u.atkReady = this.now + D.cd;
          const dur = ATLAS[u.type].anims[D.atk].d / 1000;
          this.after(dur * D.hitAt, () => {
            if (!u.alive) return;
            if (D.ranged) this.shoot('enemy', u, { x: this.hero.x, y: this.hero.y }, D.ranged, rint(D.dmg[0], D.dmg[1]) + u.lvl);
            else if (Math.hypot(this.hero.x - u.x, this.hero.y - u.y) < D.range + 0.6) {
              this.hurtHero(rint(D.dmg[0], D.dmg[1]) + u.lvl);
              if (D.boss) { this.power('quake:power', u.x, u.y, 0, { scale: 1.2 }); this.shake = 0.5; }
            }
          });
        } else if (!inRange || D.ranged === undefined) {
          if (!inRange) {
            // đi theo path, tính lại định kỳ
            if (this.now > u.repath) { u.repath = this.now + 0.6 + rnd() * 0.3; u.path = lineFree(u.x, u.y, h.x, h.y) ? [[h.x, h.y]] : findPath(u.x, u.y, h.x, h.y, 900); }
            const wp = u.path && u.path[0];
            if (wp) {
              const dx = wp[0] - u.x, dy = wp[1] - u.y, l = Math.hypot(dx, dy);
              if (l < 0.15) u.path.shift();
              else {
                let vx = dx / l, vy = dy / l;
                for (const o of this.enemies) if (o !== u && o.alive) { const ox = u.x - o.x, oy = u.y - o.y, od = Math.hypot(ox, oy); if (od < 0.7 && od > 0.001) { vx += ox / od * 0.6; vy += oy / od * 0.6; } }
                const vl = Math.hypot(vx, vy) || 1;
                slide(u, vx / vl * D.spd * dt, vy / vl * D.spd * dt, D.boss ? 0.4 : 0.25);
                u.dir = dirOf(dx, dy); u.anim = 'run';
              }
            } else u.anim = 'stance';
          } else { this.faceTo(u, h.x, h.y); u.anim = 'stance'; }
        } else { this.faceTo(u, h.x, h.y); u.anim = 'stance'; }
      }
      setFrame(u.img, u.type, u.anim, u.dir, u.t);
      u.img.setPosition(p.x, p.y).setDepth((u.x + u.y) * 10 + 1);
      u.shadow.setPosition(p.x, p.y).setDepth((u.x + u.y) * 10);
      if (u.state === 'chase' && UI.tgt === u) UI.target(u);
    }
  }

  // ---------- hero update ----------
  updateHero(dt) {
    const h = this.hero, ST = this.ST;
    S.mp = Math.min(ST.maxMp, S.mp + dt * (2.5 + ST.ene * 0.1));
    if (h.state === 'dead') { this.drawHero(dt); return; }
    const locked = this.busy();
    // input trực tiếp
    let vx = 0, vy = 0;
    const k = this.keys;
    const sx = (k.RIGHT.isDown ? 1 : 0) - (k.LEFT.isDown ? 1 : 0);
    const sy = (k.DOWN.isDown ? 1 : 0) - (k.UP.isDown ? 1 : 0);
    let jx = sx, jy = sy;
    if (this.joy && this.joy.v) { jx = this.joy.v.x; jy = this.joy.v.y; }
    if (jx || jy) { const m = unIso(jx, jy); const l = Math.hypot(m.x, m.y); vx = m.x / l; vy = m.y / l; h.path = null; h.target = null; }
    // giữ chuột trái để đi liên tục
    if (!vx && !vy && this.ptr.down && !isTouch && !h.target && this.now > (h.repath || 0)) { h.repath = this.now + 0.15; h.path = findPath(h.x, h.y, this.ptr.x, this.ptr.y, 1200); }
    if (locked) { this.drawHero(dt); return; }
    // mục tiêu
    const T = h.target;
    if (T && !vx && !vy) {
      const pos = T.enemy || T.loot || (T.chest && { x: T.chest.x + 0.5, y: T.chest.y + 0.5 }) || (T.npc && this.npc);
      const d = Math.hypot(pos.x - h.x, pos.y - h.y);
      if (T.enemy) {
        if (!T.enemy.alive) h.target = null;
        else if (d < (ST.magic ? 7 : 1.5 + (T.enemy.d.boss ? 0.6 : 0))) { h.path = null; this.attack(T.enemy); this.drawHero(dt); return; }
        else if (!h.path || this.now > (h.repath || 0)) { h.repath = this.now + 0.4; h.path = findPath(h.x, h.y, pos.x, pos.y, 1200); }
      } else if (T.chest && d < 1.6) { h.target = null; h.path = null; if (!T.chest.opened) this.openChest(T.chest); }
      else if (T.npc && d < 2) { h.target = null; h.path = null; this.talk(); }
      else if (T.loot && !this.loot.includes(T.loot)) h.target = null;
    }
    if (!vx && !vy && h.path && h.path.length) {
      // bỏ qua waypoint thấy thẳng
      while (h.path.length > 1 && lineFree(h.x, h.y, h.path[1][0], h.path[1][1])) h.path.shift();
      const [wx, wy] = h.path[0];
      const dx = wx - h.x, dy = wy - h.y, l = Math.hypot(dx, dy);
      if (l < 0.12) h.path.shift(); else { vx = dx / l; vy = dy / l; }
    }
    if (vx || vy) {
      slide(h, vx * 3.9 * dt, vy * 3.9 * dt);
      h.dir = dirOf(vx, vy);
      this.heroAnim('run');
    } else this.heroAnim('stance');
    this.drawHero(dt);
  }

  // ---------- light ----------
  onResize() {
    const w = this.scale.width, hgt = this.scale.height;
    const z = clamp(Math.min(w, hgt) / 760, 0.55, 1.0);
    this.cameras.main.setZoom(z);
    if (this.dark) this.dark.destroy();
    this.dark = this.add.renderTexture(0, 0, Math.ceil(w / z) + 4, Math.ceil(hgt / z) + 4).setOrigin(0).setDepth(9e5);
    this.lstamp = this.make.image({ key: 'light', add: false });
  }
  updateLight() {
    const cam = this.cameras.main, wv = cam.worldView, dk = this.dark;
    dk.setPosition(wv.x - 2, wv.y - 2);
    dk.clear();
    dk.fill(0x000000, 0.94);
    const hp = iso(this.hero.x, this.hero.y);
    const R = Math.max(wv.width, wv.height) / 512 * 0.95;
    const flick = 1 + Math.sin(this.now * 7) * 0.012 + Math.sin(this.now * 17) * 0.008;
    const st = this.lstamp;
    st.setPosition(hp.x - wv.x + 2, hp.y - 40 - wv.y + 2).setScale(R * flick); dk.erase(st);
    st.setScale(R * 0.55); dk.erase(st);
    for (let i = this.lamps.length - 1; i >= 0; i--) {
      const L = this.lamps[i];
      st.setPosition(L.x - wv.x + 2, L.y - wv.y + 2).setScale(L.s * 2); dk.erase(st);
      if (L.once || (L.until && this.now > L.until)) this.lamps.splice(i, 1);
    }
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, this.fast ? 0.2 : 0.05);
    this.now += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) if (this.now >= this.timers[i].t) { const f = this.timers[i].fn; this.timers.splice(i, 1); f(); }
    this.updateHero(dt);
    this.updateEnemies(dt);
    this.updateShots(dt);
    this.updateLoot(dt);
    this.updateFx(dt);
    // NPC
    const n = this.npc, np = iso(n.x, n.y);
    n.t += dt * 1000; setFrame(n.img, 'knight', 'stance', n.dir, n.t); n.img.setPosition(np.x, np.y).setDepth((n.x + n.y) * 10 + 1);
    this.npcLabel.setPosition(np.x, np.y - 150 + Math.sin(this.now * 4) * 5).setVisible(S.quest === 0 || S.quest === 2).setText(S.quest === 2 ? '?' : '!');
    // camera
    const cam = this.cameras.main, hp = iso(this.hero.x, this.hero.y);
    const tx = hp.x - cam.width / 2, ty = hp.y - 60 - cam.height / 2;
    cam.scrollX += (tx - cam.scrollX) * Math.min(1, dt * 8);
    cam.scrollY += (ty - cam.scrollY) * Math.min(1, dt * 8);
    if (this.shake > 0) { cam.scrollX += (rnd() - 0.5) * this.shake * 14; cam.scrollY += (rnd() - 0.5) * this.shake * 14; this.shake = Math.max(0, this.shake - dt * 1.8); }
    this.updateLight();
    if ((this.uiT = (this.uiT || 0) + dt) > 0.15) {
      this.uiT = 0; UI.vitals(); UI.cooldowns();
      const tg = UI.tgt; if (tg && (!tg.alive || Math.hypot(tg.x - this.hero.x, tg.y - this.hero.y) > 11)) UI.target(null);
    }
  }
}

// ---------- DOM UI ----------
const UI = {
  sel: null, tgt: null,
  icon(iid, size = 46) {
    const p = ICONS.pos[iid]; if (!p) return '';
    const s = ICONS.size, k = size / s, rows = Math.ceil(Object.keys(ICONS.pos).length / ICONS.cols);
    return `background-image:url(${A}icons.webp);background-size:${ICONS.cols * s * k}px ${rows * s * k}px;background-position:-${p[0] * k}px -${p[1] * k}px;width:${size}px;height:${size}px`;
  },
  init(G) {
    this.G = G;
    document.querySelectorAll('.sk .ic').forEach((el) => el.setAttribute('style', this.icon(+el.dataset.ic, innerWidth <= 560 ? 40 : 46)));
    const bind = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
    bind('#sk-atk', () => { const t = G.nearest(8); if (t) { G.hero.target = { enemy: t }; G.hero.path = null; } });
    bind('#sk-q', () => G.castFire(G.aimPoint()));
    bind('#sk-w', () => G.castQuake());
    bind('#sk-e', () => G.castHeal());
    bind('#sk-r', () => G.drink());
    $('#b-inv').onclick = () => this.toggleInv();
    document.querySelectorAll('.modal').forEach((m) => m.addEventListener('pointerdown', (e) => { if (e.target === m && m.id === 'inv') m.hidden = true; if (e.target.closest('[data-close]')) m.hidden = true; }));
    setTimeout(() => { const h = $('#hint'); if (h) h.style.opacity = 0; }, 14000);
    this.vitals(); this.quest();
  },
  get busy() { return !$('#dialog').hidden || !$('#inv').hidden; },
  vitals() {
    const ST = this.G.ST;
    $('#hp-fill').style.height = `${clamp(S.hp / ST.maxHp, 0, 1) * 100}%`;
    $('#mp-fill').style.height = `${clamp(S.mp / ST.maxMp, 0, 1) * 100}%`;
    $('#hp-txt').textContent = `${Math.ceil(S.hp)}/${ST.maxHp}`;
    $('#mp-txt').textContent = `${Math.floor(S.mp)}/${ST.maxMp}`;
    $('#xp-fill').style.width = `${S.xp / xpNeed() * 100}%`;
    $('#lvl').textContent = S.lvl; $('#gold').textContent = S.gold;
    $('#pot-n').textContent = S.bag.filter((i) => i.slot === 'potion').length;
  },
  cooldowns() {
    const G = this.G, tot = { q: 0.55, w: 3.5, e: 6, r: 2 }, cost = { q: 8, w: 18, e: 15, r: 0 };
    for (const k of ['q', 'w', 'e', 'r']) {
      const b = $('#sk-' + k), left = Math.max(0, G.cd[k] - G.now);
      b.querySelector('.cd').style.setProperty('--p', `${left / tot[k] * 100}%`);
      b.classList.toggle('off', S.mp < cost[k]);
    }
  },
  toast(msg, color = '#e8e2d2') {
    const el = document.createElement('div'); el.className = 'toast'; el.style.color = color; el.textContent = msg;
    const box = $('#toasts'); box.appendChild(el); while (box.children.length > 5) box.firstChild.remove();
    setTimeout(() => el.remove(), 3700);
  },
  banner(t, sub) { const b = $('#banner'); b.innerHTML = `<small>${sub}</small>${t}`; b.classList.add('on'); clearTimeout(this._b); this._b = setTimeout(() => b.classList.remove('on'), 2800); },
  target(u) {
    this.tgt = u;
    const box = $('#boss');
    if (!u || !u.alive) { box.hidden = true; return; }
    box.hidden = false; $('#boss-name').textContent = u.d.name; $('#boss-fill').style.width = `${Math.max(0, u.hp / u.max) * 100}%`;
  },
  quest() {
    const q = $('#quest');
    q.hidden = S.quest === 0 || S.quest === 3;
    q.innerHTML = S.quest === 1 ? '<b>Kẻ Canh Mộ</b>Hạ Morvak Đầu Bò trong phòng quan tài phía bắc.' : S.quest === 2 ? '<b>Kẻ Canh Mộ</b>Quay lại gặp Ser Aldric.' : '';
  },
  hover(hit, p) {
    const tip = $('#tip');
    if (hit?.loot && hit.loot.it.layer) { this.tip(hit.loot.it, p.x, p.y); return; }
    tip.hidden = true;
    if (hit?.enemy && hit.enemy.alive) this.target(hit.enemy);
  },
  itemHtml(it, cmp) {
    const R = RAR[it.rarity];
    return `<div class="nm" style="color:${R.c}">${it.name}</div>
      <div class="sub">${it.rarity >= 2 ? it.base + ' · ' : ''}${R.n}${it.slot !== 'potion' ? ' · ' + SLOT_NAME[it.slot] : ''} · cấp ${it.ilvl}</div>
      ${it.dmg ? `<div class="base">Sát thương: ${it.dmg[0]}–${it.dmg[1]}</div>` : ''}${it.armor ? `<div class="base">Giáp: ${it.armor}</div>` : ''}
      ${it.slot === 'potion' ? '<div class="base">Hồi 50% máu (phím R)</div>' : ''}
      ${it.affixes.length ? `<ul>${it.affixes.map((a) => `<li>${a.t}</li>`).join('')}</ul>` : ''}${it.power ? `<div class="pow">${it.power.p}</div>` : ''}${cmp || ''}`;
  },
  tip(it, x, y) {
    const t = $('#tip'); t.innerHTML = this.itemHtml(it); t.hidden = false;
    t.style.left = `${clamp(x + 16, 8, innerWidth - 300)}px`; t.style.top = `${clamp(y - 20, 8, innerHeight - 200)}px`;
  },
  toggleInv() { const m = $('#inv'); m.hidden = !m.hidden; $('#tip').hidden = true; if (!m.hidden) this.inv(); },
  inv() {
    const cell = (it, slot) => {
      if (!it) return `<div class="cell empty" style="grid-area:${slot || 'auto'}">${slot ? `<span class="lbl">${SLOT_NAME[slot]}</span>` : ''}</div>`;
      return `<button class="cell${this.sel === it.id ? ' sel' : ''}" data-id="${it.id}" data-r="${it.rarity}" style="grid-area:${slot || 'auto'}" aria-label="${it.name}"><span class="ic" style="${this.icon(it.icon, slot ? 50 : 40)}"></span></button>`;
    };
    $('#doll').innerHTML = SLOTS.map((s) => cell(S.eq[s], s)).join('');
    $('#bag').innerHTML = Array.from({ length: 30 }, (_, i) => cell(S.bag[i])).join('');
    const ST = this.G.ST;
    $('#stats').innerHTML = [['Sát thương', `${Math.round(ST.dmg[0] * ST.mult)}–${Math.round(ST.dmg[1] * ST.mult)}`], ['Giáp', ST.armor], ['Chí mạng', `${ST.crit.toFixed(1)}%`], ['Vàng', S.gold]].map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
    document.querySelectorAll('#inv .cell[data-id]').forEach((c) => {
      const it = this.find(+c.dataset.id);
      c.onmouseenter = () => this.detail(it);
      c.onclick = () => { this.sel = it.id; this.inv(); };
    });
    this.detail(this.find(this.sel) || S.eq.main);
  },
  find(id) { return [...Object.values(S.eq), ...S.bag].find((x) => x && x.id === id); },
  detail(it) {
    const d = $('#detail');
    if (!it) { d.innerHTML = '<span class="sub">Chọn một món đồ.</span>'; return; }
    const worn = Object.values(S.eq).includes(it);
    let cmp = '';
    if (!worn && it.slot !== 'potion') {
      const cur = S.eq[it.slot], val = (x) => (x ? (x.dmg ? (x.dmg[0] + x.dmg[1]) / 2 : x.armor) : 0);
      const diff = Math.round((val(it) - val(cur)) * 10) / 10;
      cmp = `<div class="${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff)} ${it.dmg ? 'sát thương TB' : 'giáp'} so với đồ đang mặc</div>`;
    }
    d.innerHTML = this.itemHtml(it, cmp) + (worn ? '<div class="sub">Đang mặc</div>' : `<div class="acts">${it.slot === 'potion' ? '<button class="btn" data-a="use">Uống</button>' : '<button class="btn" data-a="eq">Mặc vào</button>'}<button class="btn alt" data-a="sell">Bán ${sellPrice(it)}v</button></div>`);
    d.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => this.act(it, b.dataset.a)));
  },
  act(it, a) {
    const i = S.bag.indexOf(it); if (i < 0) return;
    if (a === 'eq') { const old = S.eq[it.slot]; S.eq[it.slot] = it; S.bag.splice(i, 1); if (old) S.bag.splice(i, 0, old); this.G.equipChanged(); UI.toast(`Mặc: ${it.name}`, RAR[it.rarity].c); }
    if (a === 'sell') { S.bag.splice(i, 1); S.gold += sellPrice(it); this.sel = null; }
    if (a === 'use') this.G.drink();
    this.G.ST = stats(); this.vitals(); this.inv();
  },
  dialog(face, name, text, acts) {
    $('#dialog').hidden = false; $('#dlg-face').src = face; $('#dlg-name').textContent = name; $('#dlg-text').textContent = text;
    const box = $('#dlg-acts'); box.innerHTML = '';
    for (const [label, fn, alt] of acts) { const b = document.createElement('button'); b.className = `btn${alt ? ' alt' : ''}`; b.textContent = label; b.onclick = () => { $('#dialog').hidden = true; fn && fn(); }; box.appendChild(b); }
  },
  npcDialog() {
    const G = this.G, face = A + 'portraits/male03.webp', name = 'Ser Aldric';
    if (S.quest === 0) this.dialog(face, name, 'Mộ của Ardwen đã bị quấy nhiễu. Một con quái đầu bò tên Morvak chiếm phòng quan tài phía bắc, lũ xương khô trỗi dậy khắp nơi. Hạ nó giúp ta.', [['Nhận nhiệm vụ', () => { S.quest = 1; this.quest(); this.toast('Nhận nhiệm vụ: Kẻ Canh Mộ', '#f0d898'); }], ['Để sau', null, true]]);
    else if (S.quest === 1) this.dialog(face, name, 'Morvak vẫn còn sống. Đi theo cây cầu đá về phía bắc, phòng quan tài ở cuối đường.', [['Đi ngay', null]]);
    else if (S.quest === 2) this.dialog(face, name, 'Ngươi làm được rồi! Linh hồn Ardwen có thể yên nghỉ. Nhận lấy di vật của dòng họ.', [['Nhận thưởng', () => {
      S.quest = 3; this.quest();
      G.dropItem(rollItem(S.lvl + 2, { slot: 'main', rarity: 3, unique: UNIQUE[1] }), G.npc.x, G.npc.y); G.dropGold(G.npc.x, G.npc.y, 150); G.gainXp(120);
    }]]);
    else this.dialog(face, name, 'Lochport nợ ngươi một ân tình. Cẩn thận khi xuống những tầng sâu hơn.', [['Tạm biệt', null]]);
  },
};

// ---------- boot ----------
function showErr(m) { const e = document.createElement('div'); e.id = 'err'; e.textContent = m; document.body.appendChild(e); }
addEventListener('error', (e) => showErr(String(e.message || e)));
addEventListener('unhandledrejection', (e) => showErr(String(e.reason?.message || e.reason)));

const fontsReady = Promise.race([Promise.all([document.fonts.load('600 16px "Be Vietnam Pro"'), document.fonts.load('700 16px "Cormorant Garamond"')]), new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
fontsReady.then(() => {
  new Phaser.Game({
    type: Phaser.AUTO, parent: 'app', backgroundColor: '#050405',
    scale: { mode: Phaser.Scale.RESIZE, width: innerWidth, height: innerHeight },
    render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
    scene: [Game],
  });
});
