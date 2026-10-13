// Scene chính: map isometric, hero paperdoll, quái đông (flow field + spatial hash + culling), skill AoE, loot, ép đồ, Golden Invasion, boss.
import Phaser from 'phaser';
import { CLASSES, SKILLS, MOBS, MAPS, LORENCIA_TIERS, DUNGEON_TIERS, PER_GROUP, GOLDEN, mobXp } from './data.js';
import { S, stats, gainXp, need, skillReady } from './state.js';
import { SLOTS, DEFAULT_LAYER, base, rollDrop, makeJewel, makeBox, itemName, itemColor, glowLevel, GLOW, JEWELS } from './items.js';
import { Grid, Hash } from './grid.js';
import { UI } from './ui.js';

export const A = './a/';
const Q = new URLSearchParams(location.search);
export const OPT = {
  nofx: Q.has('nofx'),
  bench: Q.has('bench') ? Math.max(1, +Q.get('bench') || 300) : 0,
  auto: Q.has('auto'),
  xp: Math.max(1, +Q.get('xp') || 1),
  gold: Q.has('gold'),
  cls: Q.get('cls') === 'dw' ? 'dw' : 'dk',
};
const rnd = Math.random;
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const HERO_SPD = 3.8;
const LAYER_ORDER = [
  'main,feet,legs,hands,chest,off,head', 'main,feet,legs,hands,chest,off,head', 'main,feet,legs,hands,chest,off,head',
  'feet,legs,hands,chest,off,head,main', 'feet,legs,hands,chest,off,head,main', 'feet,legs,hands,chest,off,head,main',
  'feet,legs,hands,main,chest,head,off', 'main,feet,legs,hands,chest,head,off',
].map((s) => s.split(','));
const SPRITES_OF = (keys) => [...new Set(keys.map((k) => MOBS[k].sp))];

let TW = 144, TH = 72;
const iso = (mx, my) => ({ x: (mx - my) * TW / 2, y: (mx + my) * TH / 2 });
const unIso = (sx, sy) => ({ x: sx / TW + sy / TH, y: sy / TH - sx / TW });
// hướng Flare: dir0 nhìn trái màn hình, quay theo chiều kim đồng hồ
const dirOf = (dx, dy) => { const a = Math.atan2(dy, dx) * 180 / Math.PI; return ((Math.round(((a - 135) % 360 + 360) % 360 / 45)) % 8); };

// ---------- atlas Flare ----------
const ATLAS = {};
function regAtlas(scene, key) {
  if (ATLAS[key]) return;
  const j = scene.cache.json.get(key + '_j');
  ATLAS[key] = j;
  const tex = scene.textures.get(key);
  j.frames.forEach((f, i) => { if (!tex.has('f' + i)) tex.add('f' + i, 0, f[0], f[1], f[2], f[3]); });
}
function frameIdx(an, t, loop) {
  const n = an.n, d = an.d || 400;
  if (an.t === 'looped' || loop) return Math.floor(t / d * n) % n;
  if (an.t === 'back_forth') { const m = Math.max(1, 2 * n - 2); const k = Math.floor(t / d * m) % m; return k < n ? k : m - k; }
  return Math.min(n - 1, Math.floor(t / d * n));
}
function setFrame(img, key, anim, dir, t, loop) {
  const at = ATLAS[key];
  const an = at && at.anims[anim];
  if (!an) { img.setVisible(false); return false; }
  const fr = an.dir[dir][frameIdx(an, t, loop)];
  if (fr == null || fr < 0) { img.setVisible(false); return false; }
  const f = at.frames[fr];
  img.setTexture(key, 'f' + fr).setOrigin(f[4] / f[2], f[5] / f[3]).setVisible(true);
  return true;
}
const animLen = (key, anim) => ATLAS[key]?.anims[anim]?.d || 400;
const animDone = (key, anim, t) => { const an = ATLAS[key]?.anims[anim]; return !an || t >= an.d; };

export class Game extends Phaser.Scene {
  constructor() { super('game'); }
  init(data) {
    this.mapKey = data.map || 'lorencia'; this.arrive = data.arrive || null;
    // scene.restart() dùng lại cùng instance: xoá trạng thái của map trước
    this.leaving = false; this.boss = null; this.hover = null; this.dark = null; this.bench = null; this.fx = null; this.aliveMobs = 0;
  }

  // ---------- load ----------
  preload() {
    const L = this.load, M = MAPS[this.mapKey];
    const first = !this.registry.get('booted');
    L.on('progress', (k) => UI.loading(k, first ? 'Đang tải Lorencia…' : `Đang vào ${M.name}…`));
    const json = (k, p) => { if (!this.cache.json.exists(k)) L.json(k, A + p); };
    const img = (k, p) => { if (!this.textures.exists(k)) L.image(k, A + p); };
    const atl = (k, p) => { img(k, p + '.webp'); json(k + '_j', p + '.json'); };
    json('map_' + this.mapKey, `maps/${this.mapKey}.json`);
    json('icons_j', 'icons.json');
    atl('loot', 'loot'); atl('powers', 'powers');
    for (const n of M.npcs) atl(n.sp, 'npcs/' + n.sp);
    const mobs = this.mapMobs();
    for (const sp of SPRITES_OF(mobs)) atl(sp, 'enemies/' + sp);
    for (const k of this.heroLayerKeys()) atl(k, 'hero/' + k);
    if (first) for (const k of ['swing1', 'swing2', 'swing3', 'hurt', 'die', 'levelup', 'nomana', 'fireball', 'quake', 'shock', 'teleport', 'heal', 'potion', 'burn', 'thunder', 'warcry', 'coins', 'gem', 'metal', 'loot', 'cloth',
      'spider_hit', 'spider_die', 'goblin_hit', 'goblin_die', 'bull_hit', 'bull_die', 'skel_hit', 'skel_die', 'wyv_hit', 'wyv_die', 'zomb_hit', 'zomb_die', 'amb_field', 'amb_cave']) {
      if (!this.cache.audio.exists(k)) L.audio(k, A + 'sfx/' + k + '.ogg');
    }
    // trang tile của map: tên trang lấy sau khi có json -> nạp ở filecomplete
    L.once('filecomplete-json-map_' + this.mapKey, () => this.queueMapPages());
    if (this.cache.json.exists('map_' + this.mapKey)) this.queueMapPages();
  }
  queueMapPages() {
    const m = this.cache.json.get('map_' + this.mapKey);
    for (let i = 0; i < m.pages; i++) { const k = `${this.mapKey}_${i}`; if (!this.textures.exists(k)) this.load.image(k, `${A}maps/${k}.webp`); }
  }
  mapMobs() {
    if (OPT.bench) return [...LORENCIA_TIERS, 'ggoblin', 'gdragon'];
    if (this.mapKey === 'lorencia') return [...LORENCIA_TIERS, 'ggoblin', 'gdragon'];
    return [...DUNGEON_TIERS, 'gorgon'];
  }
  heroLayerKeys() {
    const ks = new Set(Object.values(DEFAULT_LAYER));
    for (const s of SLOTS) if (S.eq[s]) ks.add(base(S.eq[s]).layer);
    return [...ks];
  }

  // ---------- create ----------
  create() {
    this.registry.set('booted', true);
    window.__G = this;
    const M = this.M = MAPS[this.mapKey];
    const MAP = this.MAP = this.cache.json.get('map_' + this.mapKey);
    TW = MAP.tw; TH = MAP.th;
    this.ICONS = this.cache.json.get('icons_j');
    for (const k of ['loot', 'powers', ...M.npcs.map((n) => n.sp), ...SPRITES_OF(this.mapMobs()), ...this.heroLayerKeys()]) regAtlas(this, k);
    for (let i = 0; i < MAP.pages; i++) {
      const tex = this.textures.get(`${this.mapKey}_${i}`);
      for (const [id, f] of Object.entries(MAP.tiles)) if (f[6] === i && !tex.has('t' + id)) tex.add('t' + id, 0, f[0], f[1], f[2], f[3]);
    }
    this.makeTextures();
    this.grid = new Grid(MAP);
    this.hash = new Hash(MAP.w, MAP.h, 2);
    this.ST = stats();
    this.now = 0; this.shake = 0; this.timers = []; this.cd = {}; this.hitstop = 0;
    this.mobs = []; this.loot = []; this.fxs = []; this.shots = []; this.lamps = []; this.respawns = [];
    this.fxPool = []; this.numPool = []; this.sfxLast = {};
    this.perf = { dts: [], acc: 0, frames: 0, fps: 60, low: 60, obj: 0 };
    this.golden = { next: OPT.gold ? 20 : GOLDEN.first, until: 0, left: 0 };
    if (!S.t0) S.t0 = performance.now();

    this.buildMap();
    this.spawnHero();
    this.spawnNpcs();
    this.spawnPortal();
    this.setupFx();
    this.makeDamageFont();
    this.onResize();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => { this.scale.off('resize', this.onResize, this); this.amb?.stop(); });
    this.setupInput();
    if (OPT.bench) this.startBench(); else this.spawnMapMobs();
    { const hp = iso(this.hero.x, this.hero.y), cam = this.cameras.main; cam.scrollX = hp.x - cam.width / 2; cam.scrollY = hp.y - 60 - cam.height / 2; }
    this.amb = this.sound.add(M.amb, { loop: true, volume: 0.22 });
    this.amb.play();
    UI.attach(this);
    UI.loaded();
    UI.banner(M.name, this.mapKey === 'lorencia' ? 'Lục Địa MU' : 'Hầm ngục · cấp 15+');
    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  makeTextures() {
    const mk = (key, w, h, fn) => { if (this.textures.exists(key)) return; const c = this.textures.createCanvas(key, w, h); fn(c.getContext(), w, h); c.refresh(); };
    mk('light', 512, 512, (x) => { const g = x.createRadialGradient(256, 256, 0, 256, 256, 256); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 512, 512); });
    mk('glow', 128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
    mk('ring', 256, 128, (x) => { x.strokeStyle = 'rgba(255,255,255,1)'; x.lineWidth = 6; x.beginPath(); x.ellipse(128, 64, 120, 58, 0, 0, Math.PI * 2); x.stroke(); });
    mk('disc', 256, 128, (x) => { const g = x.createRadialGradient(128, 64, 0, 128, 64, 128); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,.35)'); g.addColorStop(0.95, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.save(); x.scale(1, 0.5); x.beginPath(); x.arc(128, 128, 128, 0, Math.PI * 2); x.fill(); x.restore(); });
    mk('beam', 64, 256, (x) => { const g = x.createLinearGradient(0, 0, 64, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 256); const v = x.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(0.3, 'rgba(0,0,0,0)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = v; x.fillRect(0, 0, 64, 256); });
  }

  // Số damage: RetroFont (BitmapText) thay cho Text để không tạo canvas mới mỗi lần trúng đòn
  makeDamageFont() {
    if (this.cache.bitmapFont.exists('dmg')) return;
    const chars = '0123456789+-!', W = 26, H = 36;
    const c = this.textures.createCanvas('dmgfont', W * chars.length, H), x = c.getContext();
    x.font = '800 30px "Be Vietnam Pro", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round'; x.lineWidth = 6; x.strokeStyle = '#000'; x.fillStyle = '#fff';
    [...chars].forEach((ch, i) => { x.strokeText(ch, i * W + W / 2, H / 2 + 1); x.fillText(ch, i * W + W / 2, H / 2 + 1); });
    c.refresh();
    this.cache.bitmapFont.add('dmg', Phaser.GameObjects.RetroFont.Parse(this, { image: 'dmgfont', width: W, height: H, chars, charsPerRow: chars.length, spacing: { x: 0, y: 0 } }));
  }

  // ---------- map ----------
  buildMap() {
    const { MAP } = this, { w: W, h: H } = MAP;
    // nền: Blitter 1 object cho cả nghìn ô, chia chunk 8x8 để bật/tắt theo camera
    this.blitters = [];
    for (let i = 0; i < MAP.pages; i++) this.blitters.push(this.add.blitter(0, 0, `${this.mapKey}_${i}`).setDepth(-1e7));
    const CH = 8;
    this.chunks = [];
    for (let cj = 0; cj < Math.ceil(H / CH); cj++) for (let ci = 0; ci < Math.ceil(W / CH); ci++) {
      const ch = { bobs: [], objs: [], vis: true, minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9 };
      for (let j = cj * CH; j < Math.min(H, cj * CH + CH); j++) for (let i = ci * CH; i < Math.min(W, ci * CH + CH); i++) {
        const p = iso(i + 0.5, j + 0.5);
        for (const [layer, isObj] of [[MAP.bg, false], [MAP.obj, true]]) {
          const t = layer[j * W + i];
          if (!t) continue;
          const f = MAP.tiles[t];
          const x0 = p.x - f[4], y0 = p.y - f[5];
          ch.minX = Math.min(ch.minX, x0); ch.maxX = Math.max(ch.maxX, x0 + f[2]);
          ch.minY = Math.min(ch.minY, y0); ch.maxY = Math.max(ch.maxY, y0 + f[3]);
          if (!isObj) ch.bobs.push(this.blitters[f[6]].create(x0, y0, 't' + t));
          else ch.objs.push(this.add.image(p.x, p.y, `${this.mapKey}_${f[6]}`, 't' + t).setOrigin(f[4] / f[2], f[5] / f[3]).setDepth((i + j + 1) * 10));
        }
      }
      if (ch.bobs.length || ch.objs.length) this.chunks.push(ch);
    }
    this.cullKey = '';
  }
  cullMap() {
    const v = this.cameras.main.worldView;
    const key = `${Math.round(v.x / 64)},${Math.round(v.y / 64)},${Math.round(v.width / 64)}`;
    if (key === this.cullKey) return;
    this.cullKey = key;
    for (const ch of this.chunks) {
      const vis = ch.maxX > v.x - 64 && ch.minX < v.right + 64 && ch.maxY > v.y - 64 && ch.minY < v.bottom + 64;
      if (vis === ch.vis) continue;
      ch.vis = vis;
      for (const b of ch.bobs) b.visible = vis;
      for (const o of ch.objs) o.setVisible(vis);
    }
  }
  inTown(x, y) { const t = this.M.town; return !OPT.bench && t && Math.hypot(x - t.x, y - t.y) < t.r; }

  // ---------- hero ----------
  spawnHero() {
    const M = this.M;
    let p;
    if (this.arrive === 'portal' && this.mapKey === 'lorencia') p = { x: M.portal.x + 1.5, y: M.portal.y };
    else if (this.mapKey === 'lorencia') p = { x: M.town.x, y: M.town.y };
    else p = { x: this.MAP.hero[0] + 0.5, y: this.MAP.hero[1] + 0.5 };
    p = this.grid.nearestWalk(p.x, p.y, 5) || p;
    const h = { x: p.x, y: p.y, dir: 3, anim: 'stance', t: 0, imgs: {}, glow: {}, state: 'idle', path: null, target: null, atkReady: 0, inv: 0, repath: 0 };
    this.shadow = this.add.image(0, 0, 'glow').setTint(0x000000).setAlpha(0.5).setScale(0.75, 0.35);
    for (const s of SLOTS) h.imgs[s] = this.add.image(0, 0, '__DEFAULT').setVisible(false);
    this.hero = h;
    this.refreshGlow();
  }
  heroKey(slot) { return S.eq[slot] ? base(S.eq[slot]).layer : DEFAULT_LAYER[slot] || null; }
  heroAnim(name, once) { const h = this.hero; if (h.anim === name && !once) return; h.anim = name; h.t = 0; }
  heroBusy() { const h = this.hero; return ['swing', 'cast', 'die'].includes(h.anim) && !animDone('default_chest', h.anim, h.t * this.ST.speed); }
  equipChanged() {
    const need = SLOTS.map((s) => this.heroKey(s)).filter((k) => k && !ATLAS[k]).map((k) => 'hero/' + k);
    this.lazy(need, () => this.refreshGlow());
    this.ST = stats();
    S.hp = Math.min(S.hp, this.ST.maxHp); S.mp = Math.min(S.mp, this.ST.maxMp);
    this.refreshGlow();
    UI.vitals();
  }
  // đồ +7..+9 phát sáng ngay trên người (Glow filter từng layer paperdoll)
  refreshGlow() {
    if (!this.fx) return;
    for (const s of SLOTS) {
      const lv = glowLevel(S.eq[s]), img = this.hero.imgs[s];
      if ((this.hero.glow[s] || 0) === lv) continue;
      this.hero.glow[s] = lv;
      if (img.filters) img.filters.internal.clear();
      if (lv) { const g = GLOW[lv]; img.enableFilters().filters.internal.addGlow(g.c, g.s, 0, 1); }
    }
  }
  drawHero(dt) {
    const h = this.hero;
    h.t += dt * 1000;
    const p = iso(h.x, h.y), base = (h.x + h.y) * 10 + 1;
    const sp = h.anim === 'swing' || h.anim === 'cast' ? this.ST.speed : 1;
    LAYER_ORDER[h.dir].forEach((slot, k) => {
      const img = h.imgs[slot], key = this.heroKey(slot);
      if (!key || !ATLAS[key]) { img.setVisible(false); return; }
      setFrame(img, key, h.anim, h.dir, h.t * sp);
      img.setPosition(p.x, p.y).setDepth(base + k * 0.01).setAlpha(this.now < h.inv && Math.floor(this.now * 12) % 2 ? 0.5 : 1);
    });
    this.shadow.setPosition(p.x, p.y).setDepth(base - 0.5);
    // đồ +9: thỉnh thoảng toé sao lấp lánh
    if (this.fx && glowLevel(S.eq.main) >= 9 && rnd() < dt * 3) this.power('sparkle:power', h.x + (rnd() - 0.5) * 0.6, h.y + (rnd() - 0.5) * 0.6, 0, { add: true, scale: 0.35, dy: -40 - rnd() * 40 });
  }

  lazy(paths, cb) {
    const todo = paths.filter((p) => !ATLAS[p.split('/').pop()]);
    if (!todo.length) { cb && cb(); return; }
    for (const p of todo) { const k = p.split('/').pop(); if (!this.textures.exists(k)) this.load.image(k, A + p + '.webp'); if (!this.cache.json.exists(k + '_j')) this.load.json(k + '_j', A + p + '.json'); }
    this.load.once('complete', () => { for (const p of todo) { const k = p.split('/').pop(); if (this.textures.exists(k) && this.cache.json.exists(k + '_j')) regAtlas(this, k); } cb && cb(); });
    this.load.start();
  }

  // ---------- NPC + cổng ----------
  spawnNpcs() {
    this.npcs = this.M.npcs.map((n) => {
      const o = { ...n, dir: 1, t: rnd() * 1000, img: this.add.image(0, 0, n.sp) };
      const p = iso(n.x, n.y);
      o.label = this.add.text(p.x, p.y - 118, n.name, { fontFamily: 'Be Vietnam Pro', fontStyle: '600', fontSize: '15px', color: '#9fe0ff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5, 1).setDepth(1e6).setResolution(Math.min(2, devicePixelRatio || 1));
      return o;
    });
  }
  spawnPortal() {
    const P = this.M.portal;
    let x = P.x, y = P.y;
    if (P.at === 'hero') { x = this.MAP.hero[0] + 0.5 + P.dx; y = this.MAP.hero[1] + 0.5 + P.dy; }
    const w = this.grid.nearestWalk(x, y, 4) || { x, y };
    const p = iso(w.x, w.y);
    this.portal = { ...P, x: w.x, y: w.y, t: 0, cool: this.now + 2 };
    this.portal.disc = this.add.image(p.x, p.y, 'disc').setTint(0x5aa0ff).setBlendMode('ADD').setScale(0.75).setDepth((w.x + w.y) * 10 - 2);
    this.portal.img = this.add.image(p.x, p.y, 'powers').setBlendMode('ADD').setDepth((w.x + w.y) * 10 + 2);
    this.portal.label = this.add.text(p.x, p.y - 96, `Cổng → ${P.name}`, { fontFamily: 'Be Vietnam Pro', fontStyle: '600', fontSize: '15px', color: '#f0d898', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5, 1).setDepth(1e6).setResolution(Math.min(2, devicePixelRatio || 1));
    this.lamps.push({ x: p.x, y: p.y, s: 0.35, keep: true });
  }
  updatePortal(dt) {
    const P = this.portal, h = this.hero;
    P.t += dt * 1000;
    setFrame(P.img, 'powers', 'runes:power', 0, P.t, true);
    P.disc.setScale(0.7 + Math.sin(this.now * 3) * 0.05);
    if (h.state === 'dead' || this.now < P.cool || Math.hypot(h.x - P.x, h.y - P.y) > 0.9) return;
    P.cool = this.now + 2;
    if (S.lvl < P.lvl) { UI.toast(`Cần cấp ${P.lvl} để vào ${P.name} (hiện ${S.lvl})`, '#ff9a7a'); return; }
    this.changeMap(P.to, 'portal');
  }
  changeMap(to, arrive) {
    if (this.leaving) return;
    this.leaving = true;
    this.sfx('teleport', 0.6);
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.time.delayedCall(360, () => this.scene.restart({ map: to, arrive }));
  }

  // ---------- quái ----------
  spawnMapMobs() {
    const { MAP, M } = this;
    const ref = M.town || { x: MAP.hero[0] + 0.5, y: MAP.hero[1] + 0.5 };
    const dist = this.grid.distances(ref.x, ref.y);
    const groups = MAP.enemies.map((g, i) => ({ ...g, i })).filter((g) => !M.skipGroups.includes(g.i));
    for (const g of groups) {
      let best = 1e9;
      for (let j = g.y; j < g.y + g.h; j++) for (let i = g.x; i < g.x + g.w; i++) { const d = dist[j * MAP.w + i]; if (d >= 0 && d < best) best = d; }
      g.d = best;
    }
    groups.sort((a, b) => a.d - b.d);
    const tiers = this.mapKey === 'lorencia' ? LORENCIA_TIERS : DUNGEON_TIERS;
    groups.forEach((g, r) => {
      g.mob = tiers[Math.min(tiers.length - 1, Math.floor(r * tiers.length / groups.length))];
      for (let k = 0; k < PER_GROUP[this.mapKey]; k++) { const p = this.spotIn(g); if (p) this.spawnMob(g.mob, p.x, p.y, { grp: g }); }
    });
    if (M.boss) this.boss = this.spawnMob(M.boss.key, M.boss.x, M.boss.y, {});
  }
  spotIn(g) {
    for (let k = 0; k < 30; k++) { const x = g.x + rnd() * g.w, y = g.y + rnd() * g.h; if (this.grid.walk(x, y) && !this.inTown(x, y)) return { x, y }; }
    // vài nhóm của map Flare nằm gần như trọn trong tường: lấy ô đi được gần tâm nhóm
    const c = this.grid.nearestWalk(g.x + g.w / 2, g.y + g.h / 2, 5);
    return c && !this.inTown(c.x, c.y) ? { x: c.x + (rnd() - 0.5) * 0.6, y: c.y + (rnd() - 0.5) * 0.6 } : null;
  }
  spawnMob(k, x, y, o = {}) {
    const d = MOBS[k];
    const u = { k, d, x, y, dir: rint(0, 7), anim: 'stance', t: rnd() * 1000, hp: d.hp, max: d.hp, alive: true, state: o.aggro ? 'chase' : 'idle', home: { x, y }, grp: o.grp, atkReady: 0, stun: 0, think: rnd(), wander: null, vis: true, sc: d.sc || 1, skip: 0 };
    u.img = this.add.image(0, 0, d.sp).setScale(u.sc);
    if (d.tint) u.img.setTint(d.tint);
    if (d.alpha) u.img.setAlpha(d.alpha);
    u.shadow = this.add.image(0, 0, 'glow').setTint(0x000000).setAlpha(0.45).setScale(0.7 * u.sc * (d.boss ? 1.6 : 1), 0.32 * u.sc * (d.boss ? 1.6 : 1));
    if (this.fx && (d.gold || d.boss)) u.img.enableFilters().filters.internal.addGlow(d.gold ? 0xffc030 : 0xff3020, d.boss ? 2.5 : 1.6, 0, 1);
    this.mobs.push(u);
    return u;
  }
  removeMob(u) {
    u.img.destroy(); u.shadow.destroy();
    const i = this.mobs.indexOf(u); if (i >= 0) this.mobs.splice(i, 1);
  }
  updateMobs(dt) {
    const h = this.hero, G = this.grid, hash = this.hash;
    const v = this.cameras.main.worldView, x0 = v.x - 160, x1 = v.right + 160, y0 = v.y - 120, y1 = v.bottom + 260;
    const heroSafe = this.inTown(h.x, h.y) || h.state === 'dead';
    G.buildFlow(h.x, h.y, 26);
    hash.clear();
    for (const u of this.mobs) if (u.alive) hash.add(u);
    let alive = 0;
    for (let n = this.mobs.length - 1; n >= 0; n--) {
      const u = this.mobs[n], D = u.d;
      u.t += dt * 1000;
      const p = iso(u.x, u.y);
      const onScreen = p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1;
      if (!u.alive) {
        u.dead += dt;
        if (onScreen) {
          const da = ATLAS[D.sp].anims.die;
          setFrame(u.img, D.sp, 'die', u.dir, Math.min(u.t, da.d * (da.t === 'back_forth' ? 0.5 : 1) - 1));
          u.img.setPosition(p.x, p.y).setDepth((u.x + u.y) * 10 - 5).setVisible(true);
          u.shadow.setPosition(p.x, p.y).setDepth((u.x + u.y) * 10 - 6).setVisible(true);
          if (u.dead > 3) { const a = Math.max(0, 1 - (u.dead - 3)); u.img.setAlpha(a * (D.alpha || 1)); u.shadow.setAlpha(0.45 * a); }
        } else { u.img.setVisible(false); u.shadow.setVisible(false); }
        if (u.dead > 4) this.removeMob(u);
        continue;
      }
      alive++;
      const dx = h.x - u.x, dy = h.y - u.y, d = Math.hypot(dx, dy);
      // quái xa + đang rảnh: nghĩ 1/4 số frame
      if (u.state === 'idle' && d > 22 && !onScreen) { u.skip = (u.skip + 1) & 3; if (u.skip) continue; }
      this.thinkMob(u, D, d, dx, dy, dt * (u.state === 'idle' && d > 22 && !onScreen ? 4 : 1), heroSafe);
      if (onScreen) {
        setFrame(u.img, D.sp, u.anim, u.dir, u.t);
        const q = iso(u.x, u.y);
        u.img.setPosition(q.x, q.y).setDepth((u.x + u.y) * 10 + 1);
        u.shadow.setPosition(q.x, q.y).setDepth((u.x + u.y) * 10).setVisible(true);
        u.vis = true;
      } else if (u.vis) { u.img.setVisible(false); u.shadow.setVisible(false); u.vis = false; }
    }
    this.aliveMobs = alive;
  }
  thinkMob(u, D, d, dx, dy, dt, heroSafe) {
    const h = this.hero, G = this.grid;
    if (u.anim === 'hit' && u.t < 220) return;
    if (u.anim === (D.atk || 'swing') && !animDone(D.sp, u.anim, u.t)) return;
    if (u.stun > this.now) { u.anim = 'stance'; return; }
    // quái vàng: bị đánh thì bỏ chạy
    if (D.beh === 'flee') {
      if (u.flee > this.now) { this.moveMob(u, -dx / (d || 1), -dy / (d || 1), D.spd, dt, true); return; }
      return this.wanderMob(u, dt);
    }
    if (u.state === 'idle') {
      if (!heroSafe && d < (D.beh === 'ranged' ? 7 : D.boss ? 8 : 5.5) && (D.beh === 'ghost' || G.lineFree(u.x, u.y, h.x, h.y))) { u.state = 'chase'; if (D.boss) this.bossAwake(u); }
      else return this.wanderMob(u, dt);
    }
    // chase
    const leash = u.grp && Math.hypot(u.x - u.home.x, u.y - u.home.y) > 16;
    if (heroSafe || leash || d > 20) {
      u.state = 'idle'; u.wander = { x: u.home.x, y: u.home.y };
      if (leash) u.hp = u.max;
      return;
    }
    if (D.boss) this.bossThink(u, d);
    const range = D.range + (D.boss ? 0.4 : 0);
    if (D.beh === 'ranged' && d < 2.6) { this.moveMob(u, -dx / d, -dy / d, D.spd * 0.8, dt); return; }
    if (D.beh === 'hitrun' && u.retreat > this.now) { this.moveMob(u, -dx / (d || 1), -dy / (d || 1), D.spd, dt); return; }
    if (d <= range && (D.beh !== 'ranged' || G.lineFree(u.x, u.y, h.x, h.y, true))) {
      u.dir = dirOf(dx, dy);
      if (this.now < u.atkReady) { u.anim = 'stance'; return; }
      const atk = D.atk || 'swing';
      u.anim = atk; u.t = 0; u.atkReady = this.now + (D.cd || 1.4) * (u.rage ? 0.7 : 1);
      this.after(animLen(D.sp, atk) / 1000 * 0.55, () => {
        if (!u.alive) return;
        if (D.bolt) this.shoot('mob', u, { x: this.hero.x, y: this.hero.y }, D.bolt, rint(D.dmg[0], D.dmg[1]));
        else if (Math.hypot(this.hero.x - u.x, this.hero.y - u.y) < range + 0.7) this.hurtHero(rint(D.dmg[0], D.dmg[1]), u);
        if (D.beh === 'hitrun') u.retreat = this.now + 0.8;
      });
      return;
    }
    // đi tới: thấy thẳng thì đi thẳng, không thì xuống dốc flow field
    let vx = dx / d, vy = dy / d;
    if (D.beh !== 'ghost' && d > 1.5 && (u.stuck > 0 || !G.lineFreeR(u.x, u.y, h.x, h.y, 0.25))) {
      const f = G.flowDir(u.x, u.y);
      if (f) { vx = f.x; vy = f.y; } else { u.anim = 'stance'; return; }
    }
    this.moveMob(u, vx, vy, D.spd * (u.rage ? 1.3 : 1), dt, D.beh !== 'ghost');
  }
  moveMob(u, vx, vy, spd, dt, collide = true) {
    // tách bầy: đẩy nhẹ khỏi quái đứng sát (spatial hash)
    this.hash.each(u.x, u.y, 0.7, (o, od) => { if (o !== u && od > 0.001) { vx += (u.x - o.x) / od * 0.55; vy += (u.y - o.y) / od * 0.55; } });
    const l = Math.hypot(vx, vy) || 1;
    vx /= l; vy /= l;
    if (collide) {
      // kẹt (trượt không được) -> nửa giây tới đi theo flow field thay vì đâm thẳng
      const moved = this.grid.slide(u, vx * spd * dt, vy * spd * dt, u.d.boss ? 0.45 : 0.24);
      u.stuck = moved ? Math.max(0, (u.stuck || 0) - dt) : 0.5;
    } else { u.x += vx * spd * dt; u.y += vy * spd * dt; }
    u.dir = dirOf(vx, vy); u.anim = 'run';
  }
  wanderMob(u, dt) {
    if (!u.wander) {
      u.think -= dt;
      u.anim = 'stance';
      if (u.think <= 0) {
        u.think = 2 + rnd() * 4;
        const a = rnd() * Math.PI * 2, r = 0.8 + rnd() * 2.2, x = u.home.x + Math.cos(a) * r, y = u.home.y + Math.sin(a) * r;
        if (this.grid.walk(x, y) && !this.inTown(x, y)) u.wander = { x, y };
      }
      return;
    }
    const dx = u.wander.x - u.x, dy = u.wander.y - u.y, l = Math.hypot(dx, dy);
    if (l < 0.2) { u.wander = null; return; }
    const before = u.x + u.y;
    this.moveMob(u, dx / l, dy / l, u.d.spd * 0.5, dt);
    if (u.x + u.y === before) u.wander = null; // kẹt tường
  }

  // ---------- boss Gorgon ----------
  bossAwake(u) { UI.banner('Gorgon', 'Chúa tể Dungeon'); this.shake = 0.5; this.sfx('bull_hit', 0.8); }
  bossThink(u, d) {
    if (!u.rage && u.hp < u.max * 0.5) {
      u.rage = true;
      UI.banner('Gorgon nổi giận!', 'Phase 2 · gọi đệ tử');
      this.shake = 0.7;
      this.sfx('warcry', 0.8);
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, p = this.grid.nearestWalk(u.x + Math.cos(a) * 2.2, u.y + Math.sin(a) * 2.2, 2); if (p) { const m = this.spawnMob(k % 2 ? 'skeleton' : 'ghost', p.x, p.y, { aggro: true }); this.power('sparkle:power', p.x, p.y, 0, { add: true }); m.summon = true; } }
    }
    if (d < 6 && this.now > (u.stomp || 4)) {
      u.stomp = this.now + (u.rage ? 4.5 : 6.5);
      // báo trước 0.9s bằng vòng đỏ rồi dậm AoE
      const p = iso(u.x, u.y), ring = this.add.image(p.x, p.y, 'disc').setTint(0xff3020).setBlendMode('ADD').setScale(0.3).setAlpha(0.8).setDepth((u.x + u.y) * 10 - 1);
      this.tweens.add({ targets: ring, scale: 3.3 * 144 / 256 * 1.3, duration: 900, onComplete: () => ring.destroy() });
      this.after(0.9, () => {
        if (!u.alive) return;
        this.power('quake:power', u.x, u.y, 0, { scale: 2.2 });
        this.shake = 0.8; this.sfx('quake', 0.8);
        if (Math.hypot(this.hero.x - u.x, this.hero.y - u.y) < 3.3) this.hurtHero(rint(u.d.dmg[0], u.d.dmg[1]) * 1.6, u);
      });
    }
  }

  // ---------- input ----------
  setupInput() {
    this.input.mouse?.disableContextMenu();
    const K = this.input.keyboard;
    this.keys = K.addKeys('Q,W,C,V,SPACE,ESC,ONE,TWO,THREE,FOUR');
    this.keys.Q.on('down', () => this.drink('hp'));
    this.keys.W.on('down', () => this.drink('mp'));
    this.keys.C.on('down', () => UI.toggle('char'));
    this.keys.V.on('down', () => UI.toggle('inv'));
    this.keys.ESC.on('down', () => UI.closeAll());
    this.keys.SPACE.on('down', () => this.pickNearest());
    ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((k, i) => this.keys[k].on('down', () => this.selectSkill(CLASSES[S.cls].skills[i])));
    this.ptr = { x: 0, y: 0, left: false, right: false };
    this.input.on('pointerdown', (p) => {
      if (UI.blocking()) return;
      const m = unIso(p.worldX, p.worldY);
      this.ptr.x = m.x; this.ptr.y = m.y;
      if (p.rightButtonDown()) { this.ptr.right = true; this.castSelected(); return; }
      this.ptr.left = true;
      this.clickAt(p);
    });
    this.input.on('pointermove', (p) => {
      const m = unIso(p.worldX, p.worldY);
      this.ptr.x = m.x; this.ptr.y = m.y; this.ptr.sx = p.x; this.ptr.sy = p.y;
      this.hover = this.pick(p);
      if (this.hover?.mob) UI.target(this.hover.mob);
    });
    this.input.on('pointerup', (p) => { if (!p.rightButtonDown()) this.ptr.right = false; if (!p.leftButtonDown()) this.ptr.left = false; });
    this.input.on('gameout', () => { this.ptr.left = false; this.ptr.right = false; });
  }
  pick(p) {
    const cam = this.cameras.main;
    let best = null, bd = 44;
    const m = unIso(p.worldX, p.worldY);
    this.hash.each(m.x + 0.6, m.y + 0.6, 3, (u) => {
      if (!u.alive) return;
      const s = iso(u.x, u.y), sy = s.y - (u.d.boss ? 100 : 45) * u.sc;
      const d = Math.hypot((s.x - cam.worldView.x) * cam.zoom - p.x, (sy - cam.worldView.y) * cam.zoom - p.y);
      if (d < bd) { bd = d; best = { mob: u }; }
    });
    if (best) return best;
    for (const o of this.loot) if (o.ready && Math.hypot(o.x - m.x, o.y - m.y) < 0.7) return { loot: o };
    for (const n of this.npcs) if (Math.hypot(n.x - m.x, n.y - m.y) < 1) return { npc: n };
    return null;
  }
  clickAt(p) {
    const h = this.hero;
    if (h.state === 'dead') return;
    const hit = this.pick(p), m = unIso(p.worldX, p.worldY);
    h.target = hit;
    const goal = hit?.mob || hit?.loot || hit?.npc || m;
    h.path = this.grid.path(h.x, h.y, goal.x, goal.y) || [];
    if (!hit) this.marker(m.x, m.y);
  }
  marker(x, y) {
    const p = iso(x, y);
    const r = this.add.image(p.x, p.y, 'ring').setScale(0.35).setTint(0xc7a35a).setDepth(-1e5).setAlpha(0.9);
    this.tweens.add({ targets: r, scale: 0.12, alpha: 0, duration: 380, onComplete: () => r.destroy() });
  }
  pickNearest() {
    let best = null, bd = 4;
    for (const o of this.loot) { const d = Math.hypot(o.x - this.hero.x, o.y - this.hero.y); if (o.ready && d < bd) { bd = d; best = o; } }
    if (best) { this.hero.target = { loot: best }; this.hero.path = this.grid.path(this.hero.x, this.hero.y, best.x, best.y) || []; }
  }
  selectSkill(k) {
    if (!k) return;
    if (!skillReady(k)) { UI.toast(`${SKILLS[k].vn} mở ở cấp ${SKILLS[k].lvl}`, '#9a907c'); return; }
    S.skill = k; UI.skills();
  }

  // ---------- combat ----------
  after(sec, fn) { this.timers.push({ t: this.now + sec, fn }); }
  aimPoint() {
    const hv = this.hover?.mob;
    if (hv && hv.alive) return { x: hv.x, y: hv.y };
    return { x: this.ptr.x, y: this.ptr.y };
  }
  spend(mp) {
    if (OPT.bench && OPT.auto) return true;
    if (S.mp < mp) { if (this.now > (this.noMana || 0)) { this.noMana = this.now + 1; this.sfx('nomana', 0.5); this.float(this.hero.x, this.hero.y, 'Hết mana', '#7fa8ff'); } return false; }
    S.mp -= mp; return true;
  }
  castSelected(pt) {
    const h = this.hero, k = S.skill, sk = SKILLS[k];
    if (!sk || h.state === 'dead' || UI.blocking() || !skillReady(k)) return;
    if (this.now < (this.cd[k] || 0) || this.heroBusy()) return;
    pt = pt || this.aimPoint();
    if (!this.spend(sk.mp)) return;
    this.cd[k] = this.now + sk.cd / Math.min(1.6, this.ST.speed);
    h.path = null; h.target = null;
    if (!sk.self || k === 'evil') h.dir = dirOf(pt.x - h.x, pt.y - h.y);
    this[k](pt);
  }
  // Dark Knight
  twist() {
    const h = this.hero;
    this.heroAnim('swing', true);
    this.sfx('swing' + rint(1, 3), 0.6);
    // 8 nhát chém xoay vòng quanh người
    for (let k = 0; k < 8; k++) this.after(k * 0.035, () => {
      const a = h.dir * Math.PI / 4 + k * Math.PI / 4, r = 1.1;
      this.power('cleave:power', h.x + Math.cos(a) * r, h.y + Math.sin(a) * r, dirOf(Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2)), { add: true, scale: 1.1 });
    });
    const p = iso(h.x, h.y), ring = this.add.image(p.x, p.y, 'disc').setTint(0x9fd8ff).setBlendMode('ADD').setScale(0.5).setAlpha(0.9).setDepth((h.x + h.y) * 10 - 1);
    this.tweens.add({ targets: ring, scale: 2.5 * 144 / 256 * 1.6, alpha: 0, duration: 320, onComplete: () => ring.destroy() });
    this.after(0.12, () => this.aoe(h.x, h.y, SKILLS.twist.r, SKILLS.twist.k));
  }
  rage() {
    const h = this.hero;
    this.heroAnim('cast', true);
    this.sfx('warcry', 0.6);
    this.after(0.25, () => {
      this.power('quake:power', h.x, h.y, 0, { scale: 2 });
      for (let k = 0; k < 5; k++) { const a = rnd() * Math.PI * 2, r = 1.2 + rnd() * 1.8; this.after(0.06 * k, () => this.power('quake:power', h.x + Math.cos(a) * r, h.y + Math.sin(a) * r, 0, { scale: 1.2 })); }
      this.shake = 0.65; this.hitstop = 0.06;
      this.sfx('quake', 0.8);
      this.lightAt(h.x, h.y, 1.1, 0xffa040);
      this.aoe(h.x, h.y, SKILLS.rage.r, SKILLS.rage.k, { stun: 0.8, push: 0.6 });
    });
  }
  // Dark Wizard
  meteor(pt) {
    const h = this.hero, sk = SKILLS.meteor;
    const d = Math.hypot(pt.x - h.x, pt.y - h.y);
    if (d > sk.range) { pt = { x: h.x + (pt.x - h.x) / d * sk.range, y: h.y + (pt.y - h.y) / d * sk.range }; }
    this.heroAnim('cast', true);
    this.sfx('fireball', 0.5);
    const p = iso(pt.x, pt.y), img = this.add.image(p.x + 120, p.y - 420, 'powers').setBlendMode('ADD').setScale(1.6).setDepth((pt.x + pt.y) * 10 + 4);
    const f = { img, anim: 'fireball:power', dir: 5, t: 0, loop: true };
    this.fxs.push(f);
    this.tweens.add({ targets: img, x: p.x, y: p.y - 30, duration: 420, ease: 'Quad.In', onComplete: () => {
      f.done = true;
      this.power('blast:power', pt.x, pt.y, 0, { add: true, scale: 1.5 });
      this.shake = Math.max(this.shake, 0.3); this.sfx('burn', 0.6);
      this.lightAt(pt.x, pt.y, 0.9, 0xff8a30);
      this.aoe(pt.x, pt.y, sk.r, sk.k, { magic: true });
    } });
  }
  evil(pt) {
    const h = this.hero, sk = SKILLS.evil;
    this.heroAnim('cast', true);
    this.sfx('shock', 0.55);
    const a0 = Math.atan2(pt.y - h.y, pt.x - h.x);
    for (let k = 0; k < 8; k++) {
      const a = a0 + k * Math.PI / 4;
      this.shoot('hero', h, { x: h.x + Math.cos(a), y: h.y + Math.sin(a) }, 'evil', 0, { k: sk.k, pierce: true, spin: 1.6, life: sk.r / 7.5, speed: 7.5 });
    }
  }
  tele(pt) {
    const h = this.hero, sk = SKILLS.tele;
    let dx = pt.x - h.x, dy = pt.y - h.y, d = Math.hypot(dx, dy);
    if (d > sk.range) { dx = dx / d * sk.range; dy = dy / d * sk.range; }
    const to = this.grid.nearestWalk(h.x + dx, h.y + dy, 2);
    if (!to) return;
    this.heroAnim('cast', true);
    this.power('sparkle:power', h.x, h.y, 0, { add: true, scale: 0.9 });
    this.sfx('teleport', 0.6);
    h.x = to.x; h.y = to.y; h.path = null;
    this.power('sparkle:power', h.x, h.y, 0, { add: true, scale: 0.9 });
    this.lightAt(h.x, h.y, 0.6, 0x9fd8ff);
  }
  basicAttack(u) {
    const h = this.hero;
    if (this.now < h.atkReady || h.state === 'dead') return;
    h.dir = dirOf(u.x - h.x, u.y - h.y);
    h.atkReady = this.now + 0.62 / this.ST.speed;
    if (S.cls === 'dk') {
      this.heroAnim('swing', true);
      this.after(0.2 / this.ST.speed, () => {
        this.sfx('swing' + rint(1, 3), 0.45);
        if (u.alive && Math.hypot(u.x - h.x, u.y - h.y) < 1.9 + (u.d.boss ? 0.6 : 0)) {
          this.power('cleave:power', h.x, h.y, h.dir, { add: true, scale: 0.8 });
          this.heroHit(u, 1);
        }
      });
    } else {
      if (!this.spend(1)) return;
      this.heroAnim('cast', true);
      this.after(0.16 / this.ST.speed, () => this.shoot('hero', h, u, 'plasmaball', 0, { k: 1, target: u }));
    }
  }
  aoe(x, y, r, k, o = {}) {
    const hit = [];
    this.hash.each(x, y, r + 0.3, (u) => { if (u.alive) hit.push(u); });
    for (const u of hit) this.heroHit(u, k, o);
  }
  heroHit(u, k, o = {}) {
    if (!u.alive) return;
    const ST = this.ST, dk = S.cls === 'dk';
    const [lo, hi] = dk ? ST.dmg : (o.magic !== false ? ST.mag : ST.dmg);
    let b = rint(lo, hi), kind = 'n';
    if (rnd() * 100 < ST.exc) { b = hi * 1.2; kind = 'exc'; } else if (rnd() * 100 < ST.crit) { b = hi; kind = 'crit'; }
    const raw = (b * k + ST.dmgAdd) * ST.dmgMul;
    const dmg = Math.max(1, Math.round(Math.max(raw * 0.1, raw - u.d.def)));
    u.hp -= dmg;
    if (u.state === 'idle' && u.d.beh !== 'flee') { u.state = 'chase'; if (u.d.boss) this.bossAwake(u); }
    if (u.d.beh === 'flee') u.flee = this.now + 2.5;
    this.num(u.x, u.y, dmg, kind === 'exc' ? 0x5cff6a : kind === 'crit' ? 0x60c8ff : 0xffe0a0, kind !== 'n');
    if (u.vis) {
      u.img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      u.flash = this.now + 0.06;
    }
    if (o.stun) u.stun = this.now + o.stun;
    if (o.push) { const dx = u.x - this.hero.x, dy = u.y - this.hero.y, l = Math.hypot(dx, dy) || 1; this.grid.slide(u, dx / l * o.push, dy / l * o.push); }
    if (kind !== 'n') this.hitstop = Math.max(this.hitstop, 0.03);
    if (u.hp <= 0) return this.killMob(u);
    if (!u.d.boss && u.anim !== (u.d.atk || 'swing') && rnd() < 0.5) { u.anim = 'hit'; u.t = 0; }
    if (rnd() < 0.3) this.sfx(u.d.sfx + '_hit', 0.35);
    if (UI.tgt === u || u.d.boss) UI.target(u);
  }
  killMob(u) {
    u.alive = false; u.anim = 'die'; u.t = 0; u.dead = 0; u.hp = 0;
    S.kills++;
    this.sfx(u.d.sfx + '_die', 0.45);
    if (!OPT.bench) {
      const up = gainXp(mobXp(u.d.lvl, S.lvl) * OPT.xp);
      if (up) this.levelUp(up);
      this.dropFrom(u);
    }
    const ST = this.ST;
    if (ST.hpHunt) S.hp = Math.min(ST.maxHp, S.hp + Math.round(ST.maxHp / 8 * ST.hpHunt));
    if (ST.mpHunt) S.mp = Math.min(ST.maxMp, S.mp + Math.round(ST.maxMp / 8 * ST.mpHunt));
    if (u.d.boss) this.bossDown(u);
    if (UI.tgt === u) UI.target(null);
    // hồi sinh kiểu MU: 10 giây sau tại bãi cũ
    if (u.grp) this.respawns.push({ t: this.now + 10, k: u.k, grp: u.grp });
    if (OPT.bench) this.after(1.2, () => this.benchSpawn(1, u.k));
    if (this.fx && (u.d.gold || u.d.boss) && u.img.filters) u.img.filters.internal.clear();
    UI.vitals();
  }
  bossDown(u) {
    S.boss = true;
    UI.target(null);
    UI.banner('Gorgon đã gục ngã', 'Dungeon được giải phóng');
    this.shake = 1; this.sfx('levelup', 0.7);
    for (const m of this.mobs) if (m.summon && m.alive) this.killMob(m);
    this.after(2.5, () => UI.victory());
  }
  levelUp(n) {
    const h = this.hero;
    this.ST = stats(); S.hp = this.ST.maxHp; S.mp = this.ST.maxMp;
    this.power('sparkle:power', h.x, h.y, 0, { add: true, scale: 1.3 });
    const p = iso(h.x, h.y), b = this.add.image(p.x, p.y + 10, 'beam').setOrigin(0.5, 1).setBlendMode('ADD').setTint(0xffe7a0).setScale(1.4, 0.1).setDepth((h.x + h.y) * 10 + 5);
    this.tweens.add({ targets: b, scaleY: 1.6, alpha: { from: 1, to: 0 }, duration: 1100, ease: 'Cubic.Out', onComplete: () => b.destroy() });
    this.lightAt(h.x, h.y, 1.2, 0xf0d898);
    this.sfx('levelup', 0.7);
    UI.toast(`Lên cấp ${S.lvl}! +${n * 5} điểm (phím C)`, '#f0d898');
    for (const k of CLASSES[S.cls].skills) if (SKILLS[k].lvl > S.lvl - n && SKILLS[k].lvl <= S.lvl) UI.toast(`Mở khóa skill: ${SKILLS[k].vn} (${SKILLS[k].name})`, '#9fe0ff');
    UI.skills(); UI.vitals();
  }
  hurtHero(raw, from) {
    const h = this.hero, ST = this.ST;
    if (h.state === 'dead' || this.now < h.inv) return;
    if (OPT.bench) return;
    if (rnd() * 100 < 5 + ST.dodge) { this.float(h.x, h.y, 'Né', '#cfd8e8'); return; }
    let d = Math.max(1, Math.round((raw - ST.def * 0.5) * (1 - ST.dd)));
    S.hp -= d;
    if (from && ST.reflect && from.alive) { from.hp -= Math.round(raw * ST.reflect); if (from.hp <= 0) this.killMob(from); }
    this.num(h.x, h.y, d, 0xff5040, false);
    if (this.fx) this.fx.hurt = 1;
    this.shake = Math.max(this.shake, 0.15);
    if (rnd() < 0.3) this.sfx('hurt', 0.4);
    if (S.hp <= 0) this.heroDie();
    else if (!this.heroBusy() && rnd() < 0.25) this.heroAnim('hit', true);
    UI.vitals();
  }
  heroDie() {
    const h = this.hero;
    S.hp = 0; h.state = 'dead'; this.heroAnim('die', true); h.path = null; h.target = null;
    const lostXp = Math.min(S.xp, Math.round(need() * 0.03)), lostZen = Math.floor(S.zen * 0.05);
    S.xp -= lostXp; S.zen -= lostZen;
    this.sfx('die', 0.7);
    UI.banner('Bạn đã chết', `Mất ${lostXp} EXP · ${lostZen} Zen · hồi sinh ở Lorencia`);
    this.grayTo(1, 900);
    this.after(3.2, () => {
      S.hp = this.ST.maxHp; S.mp = this.ST.maxMp;
      if (this.mapKey !== 'lorencia') { this.changeMap('lorencia', 'town'); return; }
      this.grayTo(0, 400);
      h.x = this.M.town.x; h.y = this.M.town.y; h.state = 'idle'; this.heroAnim('stance', true); h.inv = this.now + 2;
    });
  }
  drink(kind) {
    const h = this.hero, key = kind === 'hp' ? 'hpPot' : 'mpPot';
    if (h.state === 'dead' || this.now < (this.cd['pot' + kind] || 0)) return;
    if (S[key] <= 0) { UI.toast(kind === 'hp' ? 'Hết bình máu: mua ở Amy (thị trấn)' : 'Hết bình mana: mua ở Amy', '#ff9a7a'); return; }
    S[key]--; this.cd['pot' + kind] = this.now + 0.35;
    const ST = this.ST;
    if (kind === 'hp') { const v = Math.round(ST.maxHp * 0.4); S.hp = Math.min(ST.maxHp, S.hp + v); this.float(h.x, h.y, `+${v}`, '#6fd36f'); }
    else { const v = Math.round(ST.maxMp * 0.45); S.mp = Math.min(ST.maxMp, S.mp + v); this.float(h.x, h.y, `+${v}`, '#7fa8ff'); }
    this.sfx('potion', 0.5);
    UI.vitals();
  }

  // ---------- đạn ----------
  shoot(owner, from, to, kind, dmg, o = {}) {
    const dx = to.x - from.x, dy = to.y - from.y, l = Math.hypot(dx, dy) || 1;
    const sp = o.speed || (kind === 'plasmaball' ? 10 : kind === 'lightning' ? 9 : 7.5);
    const s = { owner, kind, x: from.x + dx / l * 0.5, y: from.y + dy / l * 0.5, vx: dx / l * sp, vy: dy / l * sp, sp, dmg, k: o.k || 1, life: o.life || 1.4, dir: dirOf(dx, dy), t: 0, pierce: o.pierce ? new Set() : null, spin: o.spin || 0, target: o.target };
    const anim = kind === 'evil' ? 'plasmaball' : kind;
    s.anim = anim + ':power';
    s.img = this.add.image(0, 0, 'powers').setBlendMode('ADD');
    if (kind === 'evil') s.img.setTint(0xb070ff).setScale(1.15);
    this.shots.push(s);
  }
  updateShots(dt) {
    const h = this.hero;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      if (s.spin) { const c = Math.cos(s.spin * dt), sn = Math.sin(s.spin * dt), vx = s.vx * c - s.vy * sn, vy = s.vx * sn + s.vy * c; s.vx = vx; s.vy = vy; s.dir = dirOf(vx, vy); }
      if (s.target && s.target.alive) { const dx = s.target.x - s.x, dy = s.target.y - s.y, l = Math.hypot(dx, dy) || 1; s.vx += (dx / l * s.sp - s.vx) * Math.min(1, dt * 8); s.vy += (dy / l * s.sp - s.vy) * Math.min(1, dt * 8); }
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; s.t += dt * 1000;
      const p = iso(s.x, s.y);
      setFrame(s.img, 'powers', s.anim, s.dir, s.t, true);
      s.img.setPosition(p.x, p.y - 40).setDepth((s.x + s.y) * 10 + 3);
      let end = s.life <= 0 || !this.grid.fly(s.x, s.y);
      if (s.owner === 'hero') {
        this.hash.each(s.x, s.y, 0.75, (u) => {
          if (end || !u.alive || (s.pierce && s.pierce.has(u))) return;
          if (s.pierce) { s.pierce.add(u); this.heroHit(u, s.k, { magic: true }); this.power('spark_blue:power', u.x, u.y, 0, { add: true, scale: 0.6, dy: -40 }); }
          else { this.heroHit(u, s.k, { magic: true }); end = true; }
        });
        if (end && !s.pierce) this.power('spark_blue:power', s.x, s.y, 0, { add: true, scale: 0.8, dy: -30 });
      } else if (h.state !== 'dead' && Math.hypot(h.x - s.x, h.y - s.y) < 0.55) {
        this.hurtHero(s.dmg); end = true;
        this.power(s.kind === 'lightning' ? 'spark_blue:power' : 'freeze:power', s.x, s.y, 0, { add: true, scale: 0.7 });
      }
      if (end) { s.img.destroy(); this.shots.splice(i, 1); }
    }
  }

  // ---------- loot ----------
  dropFrom(u) {
    const D = u.d, lvl = D.lvl, ST = this.ST;
    const at = (fn, k = 0) => this.after(0.15 + k * 0.12, fn);
    if (D.boss) {
      for (let k = 0; k < 3; k++) at(() => this.dropItem(rollDrop(lvl, S.cls, rnd, { exc: true }), u.x, u.y), k);
      for (let k = 0; k < 4; k++) at(() => this.dropItem(makeJewel(k % 2 ? 'soul' : 'bless'), u.x, u.y), k + 3);
      at(() => this.dropZen(u.x, u.y, 8000), 7);
      return;
    }
    if (D.gold) {
      if (D.sp === 'wyvern' || rnd() < 0.6) at(() => this.dropItem(makeBox(), u.x, u.y));
      at(() => this.dropZen(u.x, u.y, rint(200, 600)), 1);
      return;
    }
    if (rnd() < 0.5) at(() => this.dropZen(u.x, u.y, Math.round(rint(lvl * 4, lvl * 9) * (1 + ST.zen))));
    if (rnd() < 0.08) at(() => this.dropItem({ pot: 'hp' }, u.x, u.y), 1);
    else if (rnd() < 0.08) at(() => this.dropItem({ pot: 'mp' }, u.x, u.y), 1);
    if (rnd() < 0.07) at(() => this.dropItem(rollDrop(lvl, S.cls), u.x, u.y), 2);
    if (rnd() < 0.016) at(() => this.dropItem(makeJewel('bless'), u.x, u.y), 3);
    else if (rnd() < 0.011) at(() => this.dropItem(makeJewel('soul'), u.x, u.y), 3);
  }
  spot(x, y) {
    for (let k = 0; k < 20; k++) { const a = rnd() * Math.PI * 2, r = 0.3 + rnd() * 1.1; const nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r; if (this.grid.walk(nx, ny) && !this.loot.some((o) => Math.hypot(o.x - nx, o.y - ny) < 0.5)) return [nx, ny]; }
    return [x, y];
  }
  dropItem(it, x, y) {
    const [lx, ly] = this.spot(x, y);
    const o = { it, x: lx, y: ly, t: 0, ready: false, life: 90, img: this.add.image(0, 0, 'loot') };
    if (it.zen) o.anim = it.zen > 400 ? 'coins100' : it.zen > 80 ? 'coins25' : 'coins5';
    else if (it.pot) o.anim = it.pot === 'hp' ? 'hp_potion' : 'mp_potion';
    else if (it.jewel) { o.anim = 'gem'; o.img.setTint(JEWELS[it.jewel].tint); }
    else if (it.box) { o.anim = 'book'; o.img.setTint(0xffd060); }
    else o.anim = base(it).loot;
    o.anim += ':power';
    const named = it.jewel || it.box || it.b;
    if (named) {
      o.label = this.add.text(0, 0, itemName(it), { fontFamily: 'Be Vietnam Pro', fontStyle: '600', fontSize: '13px', color: itemColor(it), backgroundColor: 'rgba(0,0,0,.66)', padding: { x: 5, y: 2 } }).setOrigin(0.5, 1).setDepth(1e6).setVisible(false).setResolution(Math.min(2, devicePixelRatio || 1));
      if (this.fx && (it.jewel || it.box || glowLevel(it) || it.exc?.length)) o.img.enableFilters().filters.internal.addGlow(it.jewel ? JEWELS[it.jewel].tint : it.box ? 0xffc030 : it.exc?.length ? 0x5cff6a : GLOW[glowLevel(it)].c, 2, 0, 1);
      if (it.jewel || it.box) { this.sfx('gem', 0.5); UI.toast(`Rơi: ${itemName(it)}`, itemColor(it)); }
    }
    this.loot.push(o);
  }
  dropZen(x, y, n) { this.dropItem({ zen: n }, x, y); }
  updateLoot(dt) {
    const h = this.hero, v = this.cameras.main.worldView;
    for (let i = this.loot.length - 1; i >= 0; i--) {
      const o = this.loot[i];
      o.t += dt * 1000; o.life -= dt;
      if (o.life <= 0) { this.removeLoot(o, i); continue; }
      const p = iso(o.x, o.y);
      const vis = p.x > v.x - 80 && p.x < v.right + 80 && p.y > v.y - 80 && p.y < v.bottom + 80;
      if (vis) { setFrame(o.img, 'loot', o.anim, 0, o.t); o.img.setPosition(p.x, p.y).setDepth((o.x + o.y) * 10); } else o.img.setVisible(false);
      if (!o.ready && o.t > 500) o.ready = true;
      if (o.label) o.label.setPosition(p.x, p.y - 24).setVisible(o.ready && vis);
      if (o.ready && h.state !== 'dead' && Math.hypot(o.x - h.x, o.y - h.y) < 0.6) this.pickup(o, i);
    }
  }
  removeLoot(o, i) { this.loot.splice(i, 1); o.img.destroy(); o.label?.destroy(); }
  pickup(o, i) {
    const it = o.it;
    if (it.zen) { S.zen += it.zen; this.sfx('coins', 0.4); this.removeLoot(o, i); UI.vitals(); return; }
    if (it.pot) { S[it.pot === 'hp' ? 'hpPot' : 'mpPot']++; this.sfx('potion', 0.3); this.removeLoot(o, i); UI.vitals(); return; }
    if (it.box) { this.removeLoot(o, i); this.openBox(o.x, o.y); return; }
    if (S.bag.length >= 64) { if (this.now > (this.fullMsg || 0)) { this.fullMsg = this.now + 3; UI.toast('Túi đồ đầy (64 ô). Bán bớt ở Hanzo.', '#ff9a7a'); } return; }
    S.bag.push(it);
    this.removeLoot(o, i);
    this.sfx(it.jewel ? 'gem' : 'metal', 0.45);
    UI.toast(`Nhặt: ${itemName(it)}`, itemColor(it));
    if (it.b) this.lazy(['hero/' + base(it).layer]);
    UI.refresh();
  }
  openBox(x, y) {
    UI.toast('Mở Hộp Kundun!', '#f0d898');
    this.power('sparkle:power', x, y, 0, { add: true, scale: 1.2 });
    this.lightAt(x, y, 1, 0xffd060);
    this.sfx('loot', 0.6);
    const lvl = Math.max(10, S.lvl);
    this.after(0.2, () => this.dropItem(rollDrop(lvl, S.cls, rnd, { exc: rnd() < 0.5 }), x, y));
    this.after(0.35, () => this.dropItem(makeJewel(rnd() < 0.55 ? 'bless' : 'soul'), x, y));
    if (rnd() < 0.4) this.after(0.5, () => this.dropItem(makeJewel(rnd() < 0.5 ? 'bless' : 'soul'), x, y));
    this.after(0.6, () => this.dropZen(x, y, rint(500, 1500)));
  }

  // ---------- Golden Invasion ----------
  updateGolden() {
    if (this.mapKey !== 'lorencia' || OPT.bench) return;
    const g = this.golden;
    if (!g.until && this.now > g.next) {
      g.until = this.now + GOLDEN.life;
      const h = this.hero;
      let n = 0;
      for (let k = 0; k < 400 && n < GOLDEN.count; k++) {
        const a = rnd() * Math.PI * 2, r = 5 + rnd() * 22, x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r;
        if (!this.grid.walk(x, y) || this.inTown(x, y)) continue;
        const m = this.spawnMob(rnd() < GOLDEN.dragonShare ? 'gdragon' : 'ggoblin', x, y, {});
        m.golden = true; n++;
      }
      UI.banner('Golden Invasion!', `${n} quái vàng xuất hiện quanh Lorencia`);
      this.sfx('warcry', 0.7);
    }
    if (g.until) {
      g.left = this.mobs.filter((m) => m.golden && m.alive).length;
      if (!g.left || this.now > g.until) {
        for (const m of this.mobs.filter((m) => m.golden && m.alive)) { m.alive = false; m.dead = 3; }
        if (g.left === 0) UI.toast('Golden Invasion kết thúc', '#f0d898');
        g.until = 0; g.left = 0; g.next = this.now + GOLDEN.every;
      }
    }
  }

  // ---------- FX ----------
  power(anim, x, y, dir, o = {}) {
    const p = iso(x, y);
    const img = this.fxPool.pop() || this.add.image(0, 0, 'powers');
    img.setPosition(p.x, p.y + (o.dy || 0)).setScale(o.scale || 1).setDepth((x + y) * 10 + 3).setBlendMode(o.add ? 'ADD' : 'NORMAL').setAlpha(1).setVisible(true);
    if (o.tint) img.setTint(o.tint); else img.clearTint();
    this.fxs.push({ img, anim, dir, t: 0, pooled: true });
  }
  updateFx(dt) {
    for (let i = this.fxs.length - 1; i >= 0; i--) {
      const f = this.fxs[i]; f.t += dt * 1000;
      if (f.done || (!f.loop && animDone('powers', f.anim, f.t))) {
        if (f.pooled) { f.img.setVisible(false); this.fxPool.push(f.img); } else f.img.destroy();
        this.fxs.splice(i, 1); continue;
      }
      setFrame(f.img, 'powers', f.anim, f.dir, f.t, f.loop);
    }
  }
  num(x, y, n, color, big) {
    const p = iso(x, y);
    const t = this.numPool.pop() || this.add.bitmapText(0, 0, 'dmg', '').setOrigin(0.5).setDepth(1e6 + 1);
    t.setText(String(n)).setTint(color).setPosition(p.x + rint(-16, 16), p.y - 90).setScale(big ? 1 : 0.7).setAlpha(1).setVisible(true);
    this.tweens.add({ targets: t, y: t.y - (big ? 60 : 44), alpha: { from: 1, to: 0 }, scale: big ? { from: 1.3, to: 1 } : 0.7, duration: big ? 1000 : 750, ease: 'Cubic.Out', onComplete: () => { t.setVisible(false); this.numPool.push(t); } });
  }
  float(x, y, txt, color) {
    const p = iso(x, y);
    const t = this.add.text(p.x, p.y - 110, txt, { fontFamily: 'Be Vietnam Pro', fontStyle: '700', fontSize: '18px', color, stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(1e6 + 1).setResolution(Math.min(2, devicePixelRatio || 1));
    this.tweens.add({ targets: t, y: t.y - 40, alpha: { from: 1, to: 0 }, duration: 1100, ease: 'Cubic.Out', onComplete: () => t.destroy() });
  }
  lightAt(x, y, s, c) {
    if (!this.M.dark) return;
    const p = iso(x, y);
    this.lamps.push({ x: p.x, y: p.y - 30, s, until: this.now + 0.4 });
  }
  sfx(k, vol = 0.5) {
    const t = this.time.now;
    if ((this.sfxLast[k] || 0) > t - 70 || !this.cache.audio.exists(k)) return;
    this.sfxLast[k] = t;
    this.sound.play(k, { volume: vol * 0.7 });
  }

  // ---------- filters Phaser 4 ----------
  setupFx() {
    this.fx = null;
    if (OPT.nofx || !this.renderer?.gl) return;
    const cam = this.cameras.main;
    Phaser.Actions.AddEffectBloom(cam, { useInternal: true, threshold: this.M.dark ? 0.6 : 0.72, blurRadius: 2, blendAmount: this.M.dark ? 0.7 : 0.45 });
    const cm = cam.filters.internal.addColorMatrix().setActive(false);
    const vig = cam.filters.external.addVignette(0.5, 0.5, 0.75, 0, 0x8a0000).setActive(false);
    this.fx = { cm, vig, gray: { v: 0 }, hurt: 0 };
    this.refreshGlow();
  }
  grayTo(v, ms) {
    const f = this.fx;
    if (!f) return;
    this.tweens.killTweensOf(f.gray);
    this.tweens.add({ targets: f.gray, v, duration: ms, onUpdate: () => { f.cm.colorMatrix.grayscale(f.gray.v); f.cm.setActive(f.gray.v > 0.01); }, onComplete: () => f.cm.setActive(f.gray.v > 0.01) });
  }
  updateFilters(dt) {
    const f = this.fx;
    if (!f) return;
    f.hurt = Math.max(0, f.hurt - dt * 3);
    const low = S.hp > 0 && S.hp < this.ST.maxHp * 0.3 ? 0.07 + Math.sin(this.now * 5) * 0.03 : 0;
    const s = Math.max(low, f.hurt * 0.14);
    f.vig.strength = s;
    f.vig.setActive(s > 0.005);
  }
  onResize() {
    const w = this.scale.width, hgt = this.scale.height;
    const z = clamp(Math.min(w, hgt) / 780, 0.55, 1.0);
    this.cameras.main.setZoom(z);
    if (this.M.dark && this.renderer) {
      if (this.dark) this.dark.destroy();
      this.dark = this.add.renderTexture(0, 0, Math.ceil(w / z) + 4, Math.ceil(hgt / z) + 4).setOrigin(0).setDepth(9e5);
    }
    this.cullKey = '';
  }
  // Dungeon tối: phủ đen rồi khoét sáng quanh hero, cổng, nổ phép
  updateDark() {
    if (!this.dark) return;
    const cam = this.cameras.main, wv = cam.worldView, dk = this.dark;
    dk.setPosition(wv.x - 2, wv.y - 2);
    dk.clear();
    dk.fill(0x000000, 0.9);
    const cut = (x, y, scale) => dk.stamp('light', null, x - wv.x + 2, y - wv.y + 2, { scale, blendMode: Phaser.BlendModes.ERASE });
    const hp = iso(this.hero.x, this.hero.y);
    const R = Math.max(wv.width, wv.height) / 512 * 0.9;
    cut(hp.x, hp.y - 40, R * (1 + Math.sin(this.now * 7) * 0.012));
    cut(hp.x, hp.y - 40, R * 0.5);
    for (let i = this.lamps.length - 1; i >= 0; i--) {
      const L = this.lamps[i];
      cut(L.x, L.y, L.s * 2);
      if (!L.keep && (!L.until || this.now > L.until)) this.lamps.splice(i, 1);
    }
    for (const s of this.shots) { const p = iso(s.x, s.y); cut(p.x, p.y - 40, 0.35); }
    dk.render();
  }

  // ---------- hero update ----------
  updateHero(dt) {
    const h = this.hero, ST = this.ST;
    S.mp = Math.min(ST.maxMp, S.mp + dt * (ST.maxMp * 0.03 + 1.2));
    S.hp = Math.min(ST.maxHp, S.hp + dt * ST.maxHp * (this.inTown(h.x, h.y) ? 0.05 : 0.004));
    if (h.state === 'dead') { this.drawHero(dt); return; }
    if (this.ptr.right && !UI.blocking()) this.castSelected();
    if (this.heroBusy()) { this.drawHero(dt); return; }
    // giữ chuột trái trên mặt đất: đi theo con trỏ
    if (this.ptr.left && !h.target && this.now > h.repath) { h.repath = this.now + 0.15; h.path = this.grid.path(h.x, h.y, this.ptr.x, this.ptr.y, 1500) || h.path; }
    const T = h.target;
    if (T) {
      const pos = T.mob || T.loot || T.npc;
      const d = Math.hypot(pos.x - h.x, pos.y - h.y);
      if (T.mob) {
        const reach = S.cls === 'dk' ? 1.5 + (T.mob.d.boss ? 0.6 : 0) : 6.5;
        if (!T.mob.alive) h.target = null;
        else if (d < reach && (S.cls === 'dk' || this.grid.lineFree(h.x, h.y, pos.x, pos.y, true))) { h.path = null; this.basicAttack(T.mob); this.drawHero(dt); return; }
        else if (this.now > h.repath) { h.repath = this.now + 0.35; h.path = this.grid.path(h.x, h.y, pos.x, pos.y, 1500) || []; }
      } else if (T.npc && d < 1.8) { h.target = null; h.path = null; UI.npc(T.npc); }
      else if (T.loot && !this.loot.includes(T.loot)) h.target = null;
    }
    let vx = 0, vy = 0;
    if (h.path && h.path.length) {
      while (h.path.length > 1 && this.grid.lineFreeR(h.x, h.y, h.path[1][0], h.path[1][1])) h.path.shift();
      const [wx, wy] = h.path[0], dx = wx - h.x, dy = wy - h.y, l = Math.hypot(dx, dy);
      if (l < 0.1) h.path.shift(); else { vx = dx / l; vy = dy / l; }
    }
    if (vx || vy) {
      if (!this.grid.slide(h, vx * HERO_SPD * dt, vy * HERO_SPD * dt) && (h.stuck = (h.stuck || 0) + dt) > 0.25) {
        h.stuck = 0; const end = h.path[h.path.length - 1]; h.path = this.grid.path(h.x, h.y, end[0], end[1]) || [];
      }
      h.dir = dirOf(vx, vy);
      this.heroAnim('run');
    } else this.heroAnim('stance');
    this.drawHero(dt);
  }

  // ---------- benchmark ----------
  startBench() {
    const h = this.hero;
    // ra giữa bãi phía nam, bỏ vùng an toàn
    const p = this.grid.nearestWalk(49, 60, 6) || h;
    h.x = p.x; h.y = p.y;
    this.benchSpawn(OPT.bench);
    this.bench = { t: 0, warm: 3, dur: 20, dts: [], done: false };
    UI.toast(`Benchmark: ${OPT.bench} quái${OPT.auto ? ' · tự đánh' : ''}${OPT.nofx ? ' · tắt FX' : ''}`, '#9fe0ff');
  }
  benchSpawn(n, k) {
    const h = this.hero;
    for (let c = 0, tries = 0; c < n && tries < n * 40; tries++) {
      const a = rnd() * Math.PI * 2, r = 3 + rnd() * 13, x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r;
      if (!this.grid.walk(x, y)) continue;
      const key = k || LORENCIA_TIERS[rint(0, LORENCIA_TIERS.length - 1)];
      const m = this.spawnMob(key, x, y, { aggro: true });
      m.home = { x: h.x, y: h.y }; c++;
    }
  }
  updateBench(dt, rawDt) {
    const b = this.bench;
    if (!b) return;
    if (OPT.auto && this.hero.state !== 'dead') {
      // tự xả skill AoE chính để đo cả phần FX
      const k = S.cls === 'dk' ? 'twist' : 'evil';
      if (S.skill !== k) S.skill = k;
      const t = this.nearestMob(9);
      if (t) this.castSelected({ x: t.x, y: t.y });
    }
    b.t += rawDt;
    if (b.done || b.t < b.warm) return;
    b.dts.push(rawDt * 1000);
    if (b.t > b.warm + b.dur) {
      b.done = true;
      const a = b.dts.slice().sort((x, y) => x - y), n = a.length;
      const avg = a.reduce((s, v) => s + v, 0) / n;
      const p99 = a[Math.min(n - 1, Math.floor(n * 0.99))], p95 = a[Math.floor(n * 0.95)];
      const res = { n: OPT.bench, fx: !!this.fx, auto: OPT.auto, cls: S.cls, fps: +(1000 / avg).toFixed(1), low1: +(1000 / p99).toFixed(1), p95ms: +p95.toFixed(1), frames: n, alive: this.aliveMobs, obj: this.perf.obj, ua: navigator.userAgent };
      console.log('[bench]', JSON.stringify(res));
      UI.benchResult(res);
    }
  }
  nearestMob(r) {
    let best = null, bd = r;
    this.hash.each(this.hero.x, this.hero.y, r, (u, d) => { if (u.alive && d < bd) { bd = d; best = u; } });
    return best;
  }

  // ---------- vòng lặp ----------
  update(time, delta) {
    const rawDt = Math.min(delta / 1000, 0.1);
    this.trackPerf(rawDt);
    let dt = Math.min(rawDt, 0.05);
    if (this.hitstop > 0) { this.hitstop -= dt; dt *= 0.15; }
    this.now += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) if (this.now >= this.timers[i].t) { const f = this.timers[i].fn; this.timers.splice(i, 1); f(); }
    for (let i = this.respawns.length - 1; i >= 0; i--) {
      const r = this.respawns[i];
      if (this.now < r.t) continue;
      const p = this.spotIn(r.grp);
      if (p && Math.hypot(p.x - this.hero.x, p.y - this.hero.y) > 4) { this.spawnMob(r.k, p.x, p.y, { grp: r.grp }); this.respawns.splice(i, 1); } else r.t = this.now + 2;
    }
    this.updateHero(dt);
    this.updateMobs(dt);
    for (const u of this.mobs) if (u.flash && this.now > u.flash) { u.flash = 0; u.img.clearTint().setTintMode(Phaser.TintModes.MULTIPLY); if (u.d.tint) u.img.setTint(u.d.tint); }
    this.updateShots(dt);
    this.updateLoot(dt);
    this.updateFx(dt);
    this.updateGolden();
    this.updatePortal(dt);
    for (const n of this.npcs) { n.t += dt * 1000; const p = iso(n.x, n.y); setFrame(n.img, n.sp, 'stance', n.dir, n.t); n.img.setPosition(p.x, p.y).setDepth((n.x + n.y) * 10 + 1); }
    // camera bám hero
    const cam = this.cameras.main, hp = iso(this.hero.x, this.hero.y);
    cam.scrollX += (hp.x - cam.width / 2 - cam.scrollX) * Math.min(1, dt * 8);
    cam.scrollY += (hp.y - 60 - cam.height / 2 - cam.scrollY) * Math.min(1, dt * 8);
    if (this.shake > 0) { cam.scrollX += (rnd() - 0.5) * this.shake * 14; cam.scrollY += (rnd() - 0.5) * this.shake * 14; this.shake = Math.max(0, this.shake - dt * 1.8); }
    this.cullMap();
    this.updateDark();
    this.updateFilters(dt);
    this.updateBench(dt, rawDt);
    if ((this.uiT = (this.uiT || 0) + dt) > 0.15) {
      this.uiT = 0; UI.vitals(); UI.cooldowns(); UI.where();
      const tg = UI.tgt; if (tg && (!tg.alive || Math.hypot(tg.x - this.hero.x, tg.y - this.hero.y) > 12)) UI.target(null);
    }
  }
  trackPerf(dt) {
    const P = this.perf;
    P.dts.push(dt); if (P.dts.length > 120) P.dts.shift();
    P.acc += dt; P.frames++;
    if (P.acc >= 0.5) {
      P.fps = P.frames / P.acc;
      const worst = P.dts.slice().sort((a, b) => b - a)[Math.max(0, Math.floor(P.dts.length * 0.01))];
      P.low = 1 / worst;
      P.obj = this.children.list.reduce((n, o) => n + (o.visible ? 1 : 0), 0) + this.blitters.reduce((n, b) => n + b.children.list.reduce((m, c) => m + (c.visible ? 1 : 0), 0), 0);
      P.acc = 0; P.frames = 0;
      UI.perf(P, this.aliveMobs || 0, this.golden.until ? this.golden.left : 0);
    }
  }
}
