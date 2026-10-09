import './style.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { loadAll, inst, get, makeThumbs } from './assets.js';
import { Tweens, Particles, lootBeam, shock, slash, telegraph, orb } from './fx.js';
import { UI } from './ui.js';
import { S, stats, xpNeed, rollItem, RAR, LEGEND } from './items.js';

const $ = (s) => document.querySelector(s);
const rnd = Math.random;
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
const angLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

// ---------- map: mỗi ô = 4 đơn vị (floor_tile_large) ----------
const C = 4;
const MAP = [
  '#############',
  '#tttt#hhhhhh#',
  '#tttt.hhhhhh#',
  '#tttt#hhhhhh#',
  '######hhhhhh#',
  '#cccc.hhhhhh#',
  '#cccc########',
  '#cccc########',
  '#############',
].map((r) => r.padEnd(13, '#'));
const DOORS = [[24, 10, Math.PI / 2], [20, 22, Math.PI / 2]];
const AREAS = {
  t: ['Quán Rượu Đầu Hầm', 'Khu an toàn'],
  h: ['Đại Sảnh Xương Khô', 'Cẩn thận phía trước'],
  c: ['Hầm Mộ Vua Xương', 'Trùm cuối'],
};
const cellCh = (x, z) => MAP[Math.floor(z / C)]?.[Math.floor(x / C)];
const floorAt = (x, z) => { const ch = cellCh(x, z); return !!ch && ch !== '#'; };

// ---------- renderer ----------
const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
let PR = Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 1.75);
renderer.setPixelRatio(PR);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
$('#app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07080d);
scene.fog = new THREE.Fog(0x07080d, 30, 60);
const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 200);

const rt = new THREE.WebGLRenderTarget(innerWidth * PR, innerHeight * PR, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.55, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());
let useBloom = true;

// ---------- lights ----------
scene.add(new THREE.HemisphereLight(0x8090c8, 0x2a1d14, 1.1));
const moon = new THREE.DirectionalLight(0xb4c2ff, 1.6);
moon.castShadow = true;
moon.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
Object.assign(moon.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 70 });
moon.shadow.bias = -0.0004;
moon.shadow.normalBias = 0.03;
scene.add(moon, moon.target);

const tweens = new Tweens();
const glow = new Particles(scene, 2500, true);
const dust = new Particles(scene, 800, false);

// ---------- hero / enemy defs ----------
const HEROES = {
  Knight: {
    key: 'Knight', name: 'Hiệp Sĩ Aldric', style: 'melee', idle: 'Idle',
    hide: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword', 'Round_Shield'],
    atk: ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Chop'], skill: '2H_Melee_Attack_Spin', skillName: 'Lốc Xoáy',
    atkIcon: 'sword_1handed', skillIcon: 'axe_2handed',
  },
  Barbarian: {
    key: 'Barbarian', name: 'Chiến Binh Brann', style: 'melee', idle: '2H_Melee_Idle',
    hide: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug'],
    atk: ['2H_Melee_Attack_Chop', '1H_Melee_Attack_Chop'], skill: '2H_Melee_Attack_Spin', skillName: 'Lốc Xoáy',
    atkIcon: 'axe_2handed', skillIcon: 'axe_1handed',
  },
  Mage: {
    key: 'Mage', name: 'Pháp Sư Lyra', style: 'magic', idle: 'Idle',
    hide: ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff'],
    atk: ['Spellcast_Shoot'], skill: 'Spellcast_Long', skillName: 'Nova Băng',
    atkIcon: 'wand', skillIcon: 'staff',
  },
};
const ENEMIES = {
  minion: { key: 'Skeleton_Minion', name: 'Lính Xương', hp: 34, dmg: [4, 7], spd: 3.4, range: 1.7, atk: 'Unarmed_Melee_Attack_Punch_A', hitT: 0.4, cd: 1.3, xp: 9, run: 'Running_A' },
  warrior: { key: 'Skeleton_Warrior', name: 'Chiến Binh Xương', hp: 60, dmg: [6, 10], spd: 2.9, range: 1.9, atk: '1H_Melee_Attack_Chop', hitT: 0.45, cd: 1.6, xp: 15, weapon: 'Skeleton_Blade', shield: 'Skeleton_Shield_Small_A', run: 'Walking_D_Skeletons' },
  mage: { key: 'Skeleton_Mage', name: 'Pháp Sư Xương', hp: 40, dmg: [7, 11], spd: 2.6, range: 8, atk: 'Spellcast_Shoot', hitT: 0.5, cd: 2.2, xp: 16, weapon: 'Skeleton_Staff', ranged: true, run: 'Walking_D_Skeletons' },
  boss: { key: 'Skeleton_Warrior', name: 'Vua Xương Morvak', hp: 520, dmg: [12, 18], spd: 2.7, range: 2.9, atk: '2H_Melee_Attack_Chop', hitT: 0.55, cd: 2.0, xp: 150, weapon: 'Skeleton_Axe', scale: 1.65, boss: true, run: 'Running_A' },
};

// ---------- actor ----------
class Actor {
  constructor(key, scale = 1) {
    this.key = key;
    this.root = new THREE.Group();
    this.model = inst(key);
    this.model.scale.setScalar(scale);
    this.root.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.clips = get(key).animations;
    this.actions = {};
    this.cur = null; this.curName = '';
    this.slots = {};
    this.onDone = null;
    this.mixer.addEventListener('finished', (e) => {
      if (e.action === this.cur && this.onDone) { const f = this.onDone; this.onDone = null; f(); }
    });
    scene.add(this.root);
  }
  action(n) {
    if (!this.actions[n]) {
      const clip = THREE.AnimationClip.findByName(this.clips, n);
      if (!clip) return null;
      this.actions[n] = this.mixer.clipAction(clip);
    }
    return this.actions[n];
  }
  play(n, o = {}) {
    const a = this.action(n);
    if (!a) return 0;
    if (this.cur === a && !o.once && !o.restart) { a.timeScale = o.speed ?? 1; return a.getClip().duration; }
    a.reset();
    a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = !!o.once;
    a.timeScale = o.speed ?? 1;
    a.setEffectiveWeight(1);
    a.play();
    if (this.cur && this.cur !== a) a.crossFadeFrom(this.cur, o.fade ?? 0.15, false);
    this.cur = a; this.curName = n;
    this.onDone = o.onDone || null;
    return a.getClip().duration / (o.speed ?? 1);
  }
  hide(names) { for (const n of names) { const o = this.model.getObjectByName(n); if (o) o.visible = false; } }
  show(names) { for (const n of names) { const o = this.model.getObjectByName(n); if (o) o.visible = true; } }
  attach(slot, key, ref) {
    // three.js bỏ dấu '.' trong tên node: handslot.r -> handslotr
    const bone = this.model.getObjectByName(slot === 'r' ? 'handslotr' : 'handslotl');
    if (!bone) return;
    if (this.slots[slot]) { bone.remove(this.slots[slot]); this.slots[slot] = null; }
    if (!key) return;
    const m = inst(key);
    const r = ref && this.model.getObjectByName(ref);
    if (r) { m.position.copy(r.position); m.quaternion.copy(r.quaternion); m.scale.copy(r.scale); }
    bone.add(m);
    this.slots[slot] = m;
  }
  dispose() { this.mixer.stopAllAction(); scene.remove(this.root); }
}

// ---------- game ----------
const G = {
  C, MAP, ST: stats(), xpNeed, enemies: [], npcs: [], chests: [], loot: [], bolts: [], walls: [], colliders: [], timers: [],
  seen: new Set(), keys: {}, cd: { q: 0, e: 0, r: 0 }, now: 0, shake: 0, hallTotal: 0, area: '',
  hero: null, def: null, state: 'idle', target: null, goal: null, atkReady: 0, invuln: 0, dashV: null, joy: null,
};
window.__G = G;

function after(sec, fn) { G.timers.push({ t: G.now + sec, fn }); }

// ---------- world ----------
function place(key, x, z, rot = 0, y = 0, opt = {}) {
  const o = inst(key);
  o.position.set(x, y, z);
  o.rotation.y = rot;
  if (opt.scale) o.scale.setScalar(opt.scale);
  scene.add(o);
  if (opt.r) G.colliders.push({ x, z, r: opt.r });
  return o;
}

function buildWorld() {
  const rows = MAP.length, cols = MAP[0].length;
  const fl = (q, r) => { const ch = MAP[r]?.[q]; return !!ch && ch !== '#'; };
  // sàn
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    if (!fl(q, r)) continue;
    const x = q * C + 2, z = r * C + 2, ch = MAP[r][q];
    const v = rnd();
    const key = ch === 'h' && v < 0.08 ? 'floor_tile_big_grate' : v < 0.22 ? 'floor_tile_large_rocks' : 'floor_tile_large';
    place(key, x, z, Math.floor(rnd() * 4) * Math.PI / 2);
  }
  // tường trên cạnh ô sàn giáp ô đặc
  const wallAt = (key, x, z, rot) => { const o = place(key, x, z, rot); G.walls.push(o); return o; };
  const pick = (ch) => { const v = rnd(); return v < 0.12 ? 'wall_cracked' : ch === 'h' && v < 0.2 ? 'wall_arched' : 'wall'; };
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    if (!fl(q, r)) continue;
    const ch = MAP[r][q], cx = q * C + 2, cz = r * C + 2;
    if (!fl(q, r - 1)) wallAt(ch === 't' && q === 1 ? 'wall_shelves' : pick(ch), cx, r * C, 0);
    if (!fl(q, r + 1)) wallAt(pick(ch), cx, r * C + C, Math.PI);
    if (!fl(q - 1, r)) wallAt(pick(ch), q * C, cz, Math.PI / 2);
    if (!fl(q + 1, r)) wallAt(pick(ch), q * C + C, cz, -Math.PI / 2);
  }
  // cột ở góc tường
  const H = (q, r) => fl(q, r) !== fl(q, r - 1);
  const V = (q, r) => fl(q, r) !== fl(q - 1, r);
  for (let r = 0; r <= rows; r++) for (let q = 0; q <= cols; q++) {
    const h = H(q - 1, r) || H(q, r), v = V(q, r - 1) || V(q, r);
    if (h && v) G.walls.push(place('pillar', q * C, r * C, 0));
  }
  for (const [x, z, rot] of DOORS) {
    G.walls.push(place('wall_doorway', x, z, rot));
    G.colliders.push({ x, z: z - 1.7, r: 0.5 }, { x, z: z + 1.7, r: 0.5 });
  }
  // vật liệu tường riêng để fade khi che nhân vật
  for (const w of G.walls) {
    w.userData.mats = [];
    w.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; w.userData.mats.push(o.material); } });
    w.userData.op = 1;
  }

  // đuốc + đèn (tối đa 8 point light)
  const torch = (x, z, nx, nz, color = 0xff8a3c, dist = 12) => {
    const rot = Math.atan2(nx, nz);
    place('torch_mounted', x + nx * 0.5, z + nz * 0.5, rot, 2.4);
    const fx = x + nx * 0.95, fz = z + nz * 0.95, fy = 3.15;
    const base = color === 0xff8a3c ? 32 : 16;
    const L = new THREE.PointLight(color, base, dist, 1.7);
    L.position.set(fx + nx * 0.3, fy, fz + nz * 0.3);
    scene.add(L);
    G.torches.push({ L, x: fx, y: fy, z: fz, color, base, ph: rnd() * 10 });
  };
  G.torches = [];
  torch(7, 4, 0, 1); torch(15, 4, 0, 1);
  torch(30, 4, 0, 1); torch(42, 4, 0, 1); torch(24, 15, 1, 0); torch(48, 14, -1, 0);
  torch(7, 20, 0, 1, 0x3cf0c0, 9.5); torch(17, 20, 0, 1, 0x3cf0c0, 9.5);

  // --- quán rượu ---
  place('banner_patternA_blue', 11, 4, 0); place('banner_red', 3 * C + 2, 4, 0);
  place('table_long_decorated_A', 10, 9.6, 0, 0, {}); G.colliders.push({ x: 8.9, z: 9.6, r: 1.1 }, { x: 11.1, z: 9.6, r: 1.1 });
  place('stool', 7.4, 11.4, 0, 0, { r: 0.4 }); place('stool', 12.6, 7.7, 0, 0, { r: 0.4 });
  place('keg_decorated', 18.2, 5.8, 0, 0, { r: 0.9 }); place('barrel_large', 18.6, 14.6, 0, 0, { r: 1 });
  place('barrel_small_stack', 5.6, 14.6, 0.4, 0, { r: 0.9 }); place('crates_stacked', 14.5, 5.8, 0, 0, { r: 1.1 });
  place('shelf_large', 5.4, 8.5, Math.PI / 2, 0, { r: 0.8 });
  place('candle_triple', 10.4, 9.4, 0, 1.0); place('plate_food_A', 9.4, 9.8, 0, 1.0);
  // --- đại sảnh ---
  for (const [x, z] of [[30, 10], [42, 10], [30, 18], [42, 18]]) place('pillar_decorated', x, z, 0, 0, { r: 1 });
  place('banner_shield_red', 36, 4, 0); place('banner_red', 26, 4, 0); place('banner_red', 46, 4, 0);
  place('crates_stacked', 46.5, 6.2, 0.3, 0, { r: 1.1 }); place('barrel_large', 26, 6.2, 0, 0, { r: 1 });
  place('box_stacked', 46.8, 10, 0, 0, { r: 0.9 }); place('rubble_large', 45.5, 21.8, 0.6, 0, { r: 1.2 });
  place('rubble_half', 27, 22.4, 0, 0); place('sword_shield', 35.5, 22.6, 0, 0);
  place('barrel_small_stack', 25.8, 21.6, 0, 0, { r: 0.9 });
  // --- hầm mộ ---
  place('banner_triple_yellow', 12, 20, 0); place('coin_stack_large', 5.8, 30.4, 0, 0, { r: 0.5 });
  place('coin_stack_small', 10.6, 30.8, 0); place('candle_triple', 5.3, 21.2, 0); place('candle_triple', 18.6, 30.6, 0);
  place('trunk_medium_A', 18.2, 21.6, -Math.PI / 2, 0, { r: 0.9 }); place('rubble_half', 15.6, 30.6, 1.2, 0);
  place('column', 6, 25, 0, 0, { r: 0.5 }); place('column', 18, 25, 0, 0, { r: 0.5 });

  // rương
  const chest = (key, x, z, rot, boost, n) => {
    const obj = place(key, x, z, rot, 0, { r: 1 });
    G.chests.push({ obj, lid: obj.getObjectByName('chest_lid'), opened: false, boost, n });
  };
  chest('chest', 36, 6.2, 0, 10, 3);
  chest('chest_gold', 8.5, 30.4, Math.PI, 30, 4);

  // bụi lơ lửng trong ánh đuốc
  G.motes = [];
}

// ---------- thumbnails ----------
function buildThumbs() {
  const list = [];
  for (const k of ['sword_1handed', 'axe_1handed', 'axe_2handed', 'sword_2handed', 'staff', 'wand', 'dagger', 'shield_round', 'shield_spikes', 'shield_badge']) {
    const o = inst(k);
    const isShield = k.startsWith('shield');
    if (!isShield) o.rotation.z = -Math.PI / 4;
    list.push({ id: k, obj: o, dir: isShield ? new THREE.Vector3(0.3, 0.2, 1) : new THREE.Vector3(0.2, 0.2, 1) });
  }
  const b = inst('bottle_A_green'); list.push({ id: 'bottle_A_green', obj: b, dir: new THREE.Vector3(0.4, 0.4, 1) });
  for (const k of ['Knight', 'Barbarian', 'Mage']) {
    const o = inst(k);
    for (const n of HEROES[k].hide) { const x = o.getObjectByName(n); if (x) x.visible = false; }
    const mx = new THREE.AnimationMixer(o);
    const clip = THREE.AnimationClip.findByName(get(k).animations, 'Idle');
    if (clip) { mx.clipAction(clip).play(); mx.update(0.3); }
    list.push({ id: 'face_' + k, obj: o, face: true, dir: new THREE.Vector3(0.35, 0.1, 1) });
  }
  UI.thumbs = makeThumbs(list);
}

// ---------- hero ----------
function spawnHero(key, pos, rotY) {
  if (G.hero) G.hero.dispose();
  const def = HEROES[key];
  const a = new Actor(key);
  a.hide(def.hide);
  a.root.position.copy(pos);
  a.root.rotation.y = rotY;
  G.hero = a; G.def = def; S.hero = key;
  equipVisual();
  a.play(def.idle);
  G.state = 'idle';
  UI.hero(def);
}

function equipVisual() {
  const a = G.hero, def = G.def;
  const two = ['sword_2handed', 'axe_2handed', 'staff'].includes(S.eq.weapon?.m);
  const refR = { Knight: two ? '2H_Sword' : '1H_Sword', Barbarian: two ? '2H_Axe' : '1H_Axe', Mage: two ? '2H_Staff' : '1H_Wand' }[def.key];
  const refL = { Knight: 'Round_Shield', Barbarian: 'Barbarian_Round_Shield' }[def.key];
  a.attach('r', S.eq.weapon?.m, refR);
  a.attach('l', S.eq.shield?.m, refL);
}

G.switchHero = (key) => {
  if (key === S.hero || G.state === 'dead') return;
  const p = G.hero.root.position.clone(), r = G.hero.root.rotation.y;
  spawnHero(key, p, r);
  glow.emit({ x: p.x, y: 1, z: p.z, count: 40, color: 0xffe08a, speed: [2, 6], life: 0.8, size: [0.4, 0], up: 1.2 });
  shock(scene, tweens, p, 0xffd27a, 3.2, 0.5);
  UI.toast(`Đổi sang ${HEROES[key].name}`, '#f5c451');
};
G.equipChanged = (it) => {
  equipVisual();
  const p = G.hero.root.position;
  glow.emit({ x: p.x, y: 1.2, z: p.z, count: 26, color: RAR[it.rarity].hex, speed: [1.5, 4], life: 0.7, size: [0.35, 0], up: 1 });
  UI.toast(`Trang bị: ${it.name}`, RAR[it.rarity].c);
};
G.refresh = () => { G.ST = stats(); S.hp = Math.min(S.hp, G.ST.maxHp); S.mp = Math.min(S.mp, G.ST.maxMp); UI.vitals(G.ST); };

// ---------- enemies ----------
function spawnEnemy(type, x, z, o = {}) {
  const def = ENEMIES[type];
  const a = new Actor(def.key, def.scale || 1);
  a.model.traverse((m) => { if (m.isMesh) m.material = m.material.clone(); });
  if (def.weapon) a.attach('r', def.weapon);
  if (def.shield) a.attach('l', def.shield);
  a.root.position.set(x, 0, z);
  a.root.rotation.y = o.rot ?? rnd() * Math.PI * 2;
  const lvl = o.lvl || 1;
  const hp = Math.round(def.hp * (1 + (lvl - 1) * 0.15));
  const e = { a, root: a.root, def, type, hp, max: hp, lvl, alive: true, state: o.dormant ? 'dormant' : 'idle', atkReady: 0, room: o.room, slow: 0, bar: null };
  if (o.dormant) a.play('Skeletons_Inactive_Floor_Pose', { once: true });
  else a.play('Idle');
  G.enemies.push(e);
  return e;
}

// ---------- NPC ----------
function spawnNpc(key, x, z, rot, o) {
  const a = new Actor(key);
  a.hide(HEROES[key].hide);
  if (o.show) a.show(o.show);
  a.root.position.set(x, 0, z);
  a.root.rotation.y = rot;
  a.play(o.anim || 'Idle');
  const n = { a, root: a.root, key, name: o.name, lines: o.lines, onTalk: o.onTalk, marker: null };
  G.colliders.push({ x, z, r: 0.8 });
  G.npcs.push(n);
  return n;
}

// ---------- movement & collision ----------
function free(x, z, r) {
  if (!floorAt(x - r, z) || !floorAt(x + r, z) || !floorAt(x, z - r) || !floorAt(x, z + r)) return false;
  const d = r * 0.7;
  if (!floorAt(x - d, z - d) || !floorAt(x + d, z - d) || !floorAt(x - d, z + d) || !floorAt(x + d, z + d)) return false;
  for (const c of G.colliders) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (r + c.r) ** 2) return false;
  return true;
}
function move(p, dx, dz, r = 0.95) {
  if (free(p.x + dx, p.z, r)) p.x += dx;
  if (free(p.x, p.z + dz, r)) p.z += dz;
}

// ---------- combat ----------
const HIT = new THREE.Vector3();
function nearestEnemy(range) {
  let best = null, bd = range;
  const p = G.hero.root.position;
  for (const e of G.enemies) {
    if (!e.alive || e.state === 'dormant' || e.state === 'awaken') continue;
    const d = e.root.position.distanceTo(p);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function faceTo(root, target) { root.rotation.y = Math.atan2(target.x - root.position.x, target.z - root.position.z); }

function damageEnemy(e, base, o = {}) {
  if (!e.alive) return;
  const ST = G.ST;
  const crit = rnd() * 100 < ST.crit;
  const d = Math.max(1, Math.round(base * ST.mult * (crit ? 1 + ST.critDmg / 100 : 1)) + (o.noFire ? 0 : ST.fire));
  e.hp -= d;
  HIT.copy(e.root.position);
  UI.dmg(HIT.clone().setY((e.def.scale || 1) * 0.6), crit ? `${d}!` : `${d}`, crit ? 'crit' : o.fire ? 'fire' : '');
  glow.emit({ x: HIT.x, y: 1.2 * (e.def.scale || 1), z: HIT.z, count: crit ? 22 : 12, colors: o.fire ? [0xff9a3a, 0xffd36a] : [0xfff2c0, 0xffffff], speed: [3, 7], life: 0.35, size: [0.28, 0], up: 0.8 });
  // chớp trắng
  e.a.model.traverse((m) => { if (m.isMesh && m.material.emissive) { m.material.emissive.setRGB(0.9, 0.9, 0.9); m.userData.flash = G.now + 0.08; } });
  if (crit) { G.shake = Math.max(G.shake, 0.25); hitstop(0.05); }
  // knockback
  if (!e.def.boss) { const p = G.hero.root.position, ep = e.root.position; const dx = ep.x - p.x, dz = ep.z - p.z, l = Math.hypot(dx, dz) || 1; move(ep, dx / l * 0.45, dz / l * 0.45, 0.7); }
  if (ST.ls) S.hp = Math.min(ST.maxHp, S.hp + Math.max(1, Math.round(d * ST.ls / 100)));
  if (o.slow) e.slow = G.now + o.slow;
  if (e.hp <= 0) return killEnemy(e);
  if (e.state === 'dormant' || e.state === 'awaken') return;
  if (!e.def.boss && e.state !== 'attack') { e.state = 'hit'; e.a.play(rnd() < 0.5 ? 'Hit_A' : 'Hit_B', { once: true, speed: 1.4, onDone: () => { if (e.alive) e.state = 'chase'; } }); }
  if (!e.bar && !e.def.boss) {
    const el = document.createElement('div'); el.className = 'ehp'; el.innerHTML = '<i></i>';
    e.bar = UI.anchor(el, () => e.root.position, { dy: 2.6 * (e.def.scale || 1) });
  }
  if (e.bar) e.bar.el.firstChild.style.width = `${Math.max(0, e.hp / e.max) * 100}%`;
  if (e.def.boss) UI.boss(e);
}

let stopUntil = 0;
function hitstop(t) { stopUntil = performance.now() + t * 1000; }

function killEnemy(e) {
  e.alive = false; e.state = 'dead';
  if (e.bar) { UI.drop(e.bar); e.bar = null; }
  const p = e.root.position.clone();
  e.a.play(e.a.action('Death_C_Skeletons') ? 'Death_C_Skeletons' : 'Death_A', { once: true });
  dust.emit({ x: p.x, y: 0.4, z: p.z, count: e.def.boss ? 60 : 24, colors: [0x6b6478, 0x4a4456, 0x8a8296], speed: [0.5, 2.5], life: 1.2, size: [0.9, 0.2], alpha: 0.55, up: 0.4, drag: 2 });
  gainXp(e.def.xp + e.lvl * 2);
  if (G.ST.powers.boom) explode(p, 3, 14, 0xff7a2a);
  const n = e.def.boss ? 4 : rnd() < 0.6 ? 1 : 0;
  for (let i = 0; i < n; i++) {
    const ang = rnd() * Math.PI * 2;
    after(0.25 + i * 0.15, () => dropItem(rollItem(e.lvl + 1, { boost: e.def.boss ? 30 : G.ST.mf / 2, rarity: e.def.boss && i === 0 ? 3 : undefined }), p, new THREE.Vector3(p.x + Math.cos(ang) * 1.6, 0, p.z + Math.sin(ang) * 1.6)));
  }
  const gold = rint(3, 9) * (e.def.boss ? 8 : 1);
  after(0.3, () => coinBurst(p, Math.min(14, 3 + gold / 3), gold));
  if (e.def.boss) { UI.boss(null); G.shake = 0.6; UI.banner('Vua Xương đã ngã', 'Chiến thắng'); }
  if (e.room === 'h' && S.quest === 1 && G.hallLeft() === 0) { S.quest = 2; UI.toast('Đại Sảnh đã sạch! Quay lại gặp Pháp Sư Lyra.', '#7be38a'); }
  UI.quest();
  after(3.2, () => tweens.add(1.2, (k) => { e.root.position.y = -k * 1.4; }, () => e.a.dispose()));
}
G.hallLeft = () => G.enemies.filter((e) => e.room === 'h' && e.alive).length;

function explode(p, rad, dmg, color) {
  shock(scene, tweens, p, color, rad, 0.4);
  glow.emit({ x: p.x, y: 0.8, z: p.z, count: 40, colors: [color, 0xffd36a, 0xffffff], speed: [3, 9], life: 0.5, size: [0.5, 0], up: 0.9 });
  for (const e of G.enemies) if (e.alive && e.state !== 'dormant' && e.root.position.distanceTo(p) < rad) damageEnemy(e, dmg, { fire: true, noFire: true });
}

function hurtHero(d) {
  if (G.state === 'dead' || G.now < G.invuln) return;
  d = Math.max(1, Math.round(d * (1 - Math.min(0.6, G.ST.armor / 70))));
  S.hp -= d;
  UI.dmg(G.hero.root.position.clone().setY(0.3), `-${d}`, 'hurt');
  G.shake = Math.max(G.shake, 0.2);
  const h = $('#hurt'); h.style.opacity = 1; clearTimeout(G._ht); G._ht = setTimeout(() => (h.style.opacity = 0), 160);
  if (S.hp <= 0) return heroDie();
  if (G.state === 'idle' || G.state === 'run') { G.state = 'hit'; G.hero.play('Hit_A', { once: true, speed: 1.6, onDone: () => { if (G.state === 'hit') G.state = 'idle'; } }); }
  UI.vitals(G.ST);
}

function heroDie() {
  G.state = 'dead'; S.hp = 0;
  G.hero.play('Death_A', { once: true });
  UI.banner('Bạn đã gục ngã', 'Hồi sinh tại quán rượu');
  after(3, () => {
    S.hp = G.ST.maxHp; S.mp = G.ST.maxMp; S.gold = Math.floor(S.gold * 0.85);
    G.hero.root.position.set(8.5, 0, 13.5);
    G.state = 'idle'; G.hero.play(G.def.idle);
    G.invuln = G.now + 2;
    UI.vitals(G.ST);
  });
}

function gainXp(n) {
  S.xp += n;
  while (S.xp >= xpNeed()) {
    S.xp -= xpNeed(); S.lvl++;
    G.ST = stats(); S.hp = G.ST.maxHp; S.mp = G.ST.maxMp;
    const p = G.hero.root.position;
    shock(scene, tweens, p, 0xffd27a, 4, 0.6); after(0.15, () => shock(scene, tweens, G.hero.root.position, 0xfff0b0, 2.6, 0.5));
    for (let i = 0; i < 6; i++) after(i * 0.08, () => glow.emit({ x: G.hero.root.position.x, y: 0.2, z: G.hero.root.position.z, count: 14, colors: [0xffd27a, 0xfff3c4], speed: [3, 6], dir: new THREE.Vector3(0, 3, 0), life: 0.9, size: [0.35, 0], spread: 1.2 }));
    UI.dmg(p.clone().setY(0.6), `LÊN CẤP ${S.lvl}!`, 'big');
    UI.toast(`Lên cấp ${S.lvl}: +12 máu, +8 mana`, '#f5c451');
  }
  UI.vitals(G.ST);
}

// ---------- hero actions ----------
const busy = () => ['attack', 'skill', 'dodge', 'dead'].includes(G.state);

G.attack = (tgt) => {
  if (busy() || G.now < G.atkReady || UI.busy) return;
  const def = G.def, ST = G.ST, h = G.hero;
  tgt = tgt && tgt.alive ? tgt : nearestEnemy(def.style === 'magic' ? 14 : 3.4);
  if (tgt) faceTo(h.root, tgt.root.position);
  G.state = 'attack';
  const anim = def.atk[(G.combo = ((G.combo || 0) + 1) % def.atk.length)];
  const sp = ST.speed * (def.style === 'magic' ? 1.25 : 1.15);
  const dur = h.play(anim, { once: true, speed: sp, fade: 0.08, onDone: () => { if (G.state === 'attack') G.state = 'idle'; } });
  G.atkReady = G.now + dur * 0.62;
  G.cancelAt = G.now + dur * 0.6;
  after(dur * (def.style === 'magic' ? 0.42 : 0.36), () => {
    if (G.state === 'dead') return;
    const p = h.root.position, ang = h.root.rotation.y;
    const fwd = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
    if (def.style === 'magic') {
      const dir = tgt && tgt.alive ? tgt.root.position.clone().sub(p).setY(0).normalize() : fwd;
      fireBolt(p.clone().addScaledVector(dir, 0.9).setY(1.4), dir, 'hero', rint(ST.dmg[0], ST.dmg[1]) + 3, 0x7fc8ff);
    } else {
      slash(scene, tweens, p.clone().addScaledVector(fwd, 0.6), ang, 0xfff0c8, 2.0);
      let hit = false;
      for (const e of G.enemies) {
        if (!e.alive || e.state === 'dormant' || e.state === 'awaken') continue;
        const v = e.root.position.clone().sub(p).setY(0), d = v.length();
        if (d < 2.9 + (e.def.boss ? 1 : 0) && v.normalize().dot(fwd) > 0.2) { damageEnemy(e, rint(ST.dmg[0], ST.dmg[1])); hit = true; }
      }
      if (hit) G.shake = Math.max(G.shake, 0.12);
    }
    if (ST.powers.fireProc && rnd() < 0.25) fireBolt(p.clone().addScaledVector(fwd, 0.8).setY(1.3), fwd, 'hero', 12, 0xff8a2a, true);
  });
};

G.skill = () => {
  if (busy() || G.now < G.cd.q || UI.busy) return;
  const cost = G.ST.powers.freeSkill ? 0 : 20;
  if (S.mp < cost) { UI.dmg(G.hero.root.position.clone(), 'Hết mana', 'heal'); return; }
  S.mp -= cost; G.cd.q = G.now + 4;
  const def = G.def, h = G.hero, p = h.root.position;
  G.state = 'skill';
  if (def.style === 'magic') {
    const dur = h.play(def.skill, { once: true, speed: 1.6, onDone: () => { if (G.state === 'skill') G.state = 'idle'; } });
    after(dur * 0.5, () => {
      const q = h.root.position;
      shock(scene, tweens, q, 0x8fd8ff, 6, 0.55); shock(scene, tweens, q, 0xffffff, 4, 0.35);
      glow.emit({ x: q.x, y: 0.4, z: q.z, count: 90, colors: [0x8fd8ff, 0xd8f4ff, 0x5aa2ff], speed: [6, 12], life: 0.6, size: [0.45, 0], flat: true });
      G.shake = 0.3;
      for (const e of G.enemies) if (e.alive && e.state !== 'dormant' && e.state !== 'awaken' && e.root.position.distanceTo(q) < 6) damageEnemy(e, rint(G.ST.dmg[0], G.ST.dmg[1]) * 1.4 + 6, { slow: 2.5 });
    });
  } else {
    const dur = h.play(def.skill, { once: true, speed: 1.35, onDone: () => { if (G.state === 'skill') G.state = 'idle'; } });
    for (const k of [0.3, 0.6]) after(dur * k, () => {
      const q = h.root.position;
      shock(scene, tweens, q, 0xcfe6ff, 3.6, 0.35);
      glow.emit({ x: q.x, y: 1, z: q.z, count: 30, colors: [0xcfe6ff, 0xffffff], speed: [4, 8], life: 0.35, size: [0.3, 0], flat: true });
      dust.emit({ x: q.x, y: 0.2, z: q.z, count: 14, colors: [0x5a5048, 0x766a5e], speed: [2, 4], life: 0.8, size: [0.9, 0.3], alpha: 0.45, flat: true });
      G.shake = Math.max(G.shake, 0.18);
      for (const e of G.enemies) if (e.alive && e.state !== 'dormant' && e.state !== 'awaken' && e.root.position.distanceTo(q) < 3.6) damageEnemy(e, rint(G.ST.dmg[0], G.ST.dmg[1]) * 0.9 + 2);
    });
  }
  UI.vitals(G.ST);
};

G.dodge = () => {
  if (G.state === 'dead' || G.state === 'dodge' || G.now < G.cd.e || UI.busy) return;
  const h = G.hero;
  let dir = inputDir();
  if (!dir) { const a = h.root.rotation.y; dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)); }
  h.root.rotation.y = Math.atan2(dir.x, dir.z);
  G.state = 'dodge'; G.cd.e = G.now + 1.2; G.invuln = G.now + 0.45;
  G.dashV = dir.multiplyScalar(13); G.dashEnd = G.now + 0.32;
  h.play('Dodge_Forward', { once: true, speed: 1.5, fade: 0.05, onDone: () => { if (G.state === 'dodge') G.state = 'idle'; } });
  const p = h.root.position;
  dust.emit({ x: p.x, y: 0.2, z: p.z, count: 12, colors: [0x5a5048, 0x766a5e], speed: [1, 2.5], life: 0.7, size: [0.8, 0.3], alpha: 0.5, up: 0.3 });
};

G.drink = () => {
  if (G.state === 'dead' || G.now < G.cd.r) return;
  const i = S.bag.findIndex((it) => it.kind === 'potion');
  if (i < 0) { UI.toast('Hết bình máu', '#ff7a6b'); return; }
  S.bag.splice(i, 1); G.cd.r = G.now + 5;
  const heal = Math.round(G.ST.maxHp * 0.45);
  S.hp = Math.min(G.ST.maxHp, S.hp + heal);
  const p = G.hero.root.position;
  UI.dmg(p.clone().setY(0.4), `+${heal}`, 'heal');
  for (let k = 0; k < 5; k++) after(k * 0.07, () => glow.emit({ x: G.hero.root.position.x, y: 0.3, z: G.hero.root.position.z, count: 10, colors: [0x7be38a, 0xc8ffd0], speed: [1, 2], dir: new THREE.Vector3(0, 2.5, 0), spread: 1.4, life: 0.8, size: [0.3, 0] }));
  UI.vitals(G.ST);
  if (!$('#inv').hidden) UI.inv();
};

// ---------- projectiles ----------
function fireBolt(pos, dir, owner, dmg, color, fire) {
  const m = orb(color, owner === 'hero' ? 0.22 : 0.26);
  m.position.copy(pos);
  scene.add(m);
  G.bolts.push({ m, v: dir.clone().multiplyScalar(owner === 'hero' ? 17 : 10), owner, dmg, color, life: 1.6, fire });
}
function updateBolts(dt) {
  for (let i = G.bolts.length - 1; i >= 0; i--) {
    const b = G.bolts[i];
    b.m.position.addScaledVector(b.v, dt);
    b.life -= dt;
    const p = b.m.position;
    glow.emit({ x: p.x, y: p.y, z: p.z, count: 2, colors: [b.color, 0xffffff], speed: [0.2, 0.8], life: 0.35, size: [0.32, 0], spread: 0.15 });
    let hit = null;
    if (b.owner === 'hero') {
      for (const e of G.enemies) if (e.alive && e.state !== 'dormant' && e.state !== 'awaken' && Math.hypot(e.root.position.x - p.x, e.root.position.z - p.z) < 0.9 * (e.def.scale || 1)) { hit = e; break; }
    } else if (Math.hypot(G.hero.root.position.x - p.x, G.hero.root.position.z - p.z) < 0.8) hit = 'hero';
    if (hit || b.life <= 0 || !floorAt(p.x, p.z)) {
      glow.emit({ x: p.x, y: p.y, z: p.z, count: 26, colors: [b.color, 0xffffff], speed: [2, 6], life: 0.4, size: [0.35, 0] });
      shock(scene, tweens, p.clone(), b.color, 1.4, 0.25, p.y * 0 + 0.1);
      if (hit === 'hero') hurtHero(b.dmg);
      else if (hit) damageEnemy(hit, b.dmg, { fire: b.fire });
      scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose();
      G.bolts.splice(i, 1);
    }
  }
}

// ---------- loot ----------
function dropItem(it, from, to) {
  const R = RAR[it.rarity];
  const g = new THREE.Group();
  const beam = lootBeam(R.hex, it.rarity);
  g.add(beam);
  const holder = new THREE.Group();
  const m = inst(it.m);
  if (it.kind === 'potion') m.scale.setScalar(1.6);
  else if (it.kind === 'weapon') m.rotation.z = 0.5;
  holder.add(m);
  holder.position.y = 0.75;
  g.add(holder);
  g.position.copy(from);
  scene.add(g);
  const o = { it, g, holder, beam, ready: false, label: null };
  G.loot.push(o);
  tweens.add(0.6, (k) => {
    g.position.set(from.x + (to.x - from.x) * k, Math.sin(k * Math.PI) * 2.6, from.z + (to.z - from.z) * k);
    holder.rotation.x = k * Math.PI * 4;
  }, () => {
    holder.rotation.x = 0; g.position.y = 0; o.ready = true;
    glow.emit({ x: to.x, y: 0.3, z: to.z, count: 12 + it.rarity * 8, color: R.hex, speed: [1.5, 4], life: 0.5, size: [0.3, 0], up: 0.6 });
    const el = document.createElement('div'); el.className = 'loot-lbl'; el.style.color = R.c; el.textContent = it.name;
    o.label = UI.anchor(el, () => g.position, { dy: it.rarity >= 2 ? 2.2 : 1.6 });
    if (it.rarity === 3) { G.shake = 0.3; UI.toast(`Rơi đồ HUYỀN THOẠI: ${it.name}!`, R.c); }
  });
}

function pickup(o) {
  G.loot.splice(G.loot.indexOf(o), 1);
  if (o.label) UI.drop(o.label);
  const g = o.g, start = g.position.clone();
  tweens.add(0.3, (k) => { g.position.y = start.y + k * 1.8; g.scale.setScalar(1 - k * 0.7); }, () => scene.remove(g));
  if (S.bag.length >= 20) { S.gold += 6 + o.it.rarity * 15; UI.toast(`Túi đầy, tự bán ${o.it.name}`, '#a8a3b8'); }
  else { S.bag.push(o.it); UI.toast(`Nhặt: ${o.it.name}`, RAR[o.it.rarity].c); }
  UI.vitals(G.ST);
  if (!$('#inv').hidden) UI.inv();
}

function coinBurst(p, n, gold) {
  for (let i = 0; i < n; i++) {
    const c = inst('coin');
    c.scale.setScalar(1.6);
    scene.add(c);
    const a = rnd() * Math.PI * 2, r = 0.8 + rnd() * 1.6;
    const to = new THREE.Vector3(p.x + Math.cos(a) * r, 0.1, p.z + Math.sin(a) * r);
    const h = 1.5 + rnd() * 1.5;
    tweens.add(0.5 + rnd() * 0.2, (k) => { c.position.set(p.x + (to.x - p.x) * k, 0.1 + Math.sin(k * Math.PI) * h, p.z + (to.z - p.z) * k); c.rotation.x += 0.4; }, () => {
      after(0.35 + rnd() * 0.3, () => {
        const s = c.position.clone();
        tweens.add(0.35, (k) => { const hp = G.hero.root.position; c.position.set(s.x + (hp.x - s.x) * k, s.y + (1.2 - s.y) * k + Math.sin(k * Math.PI) * 1, s.z + (hp.z - s.z) * k); }, () => {
          scene.remove(c);
          glow.emit({ x: c.position.x, y: 1.2, z: c.position.z, count: 3, color: 0xffd36a, speed: [1, 2], life: 0.3, size: [0.25, 0] });
        });
      });
    });
  }
  S.gold += gold;
  UI.dmg(p.clone().setY(0.2), `+${gold} vàng`, 'gold');
  after(1.2, () => UI.vitals(G.ST));
}

function openChest(ch) {
  ch.opened = true;
  const p = ch.obj.position.clone();
  if (ch.lid) tweens.add(0.45, (k) => { ch.lid.rotation.x = -1.9 * (1 - (1 - k) ** 3); });
  glow.emit({ x: p.x, y: 0.9, z: p.z, count: 50, colors: [0xffd36a, 0xfff3c4, 0xffa83a], speed: [2, 6], life: 0.9, size: [0.35, 0], up: 1.4, gravity: 3 });
  G.shake = 0.2;
  coinBurst(p, 12, rint(25, 45) + ch.boost);
  const fwd = new THREE.Vector3(Math.sin(ch.obj.rotation.y), 0, Math.cos(ch.obj.rotation.y));
  for (let i = 0; i < ch.n; i++) {
    const a = (i - (ch.n - 1) / 2) * 0.55;
    const dir = fwd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
    after(0.25 + i * 0.16, () => dropItem(rollItem(S.lvl + 1, { boost: ch.boost }), p.clone().setY(0.6), p.clone().addScaledVector(dir, 2.6).setY(0)));
  }
}

// ---------- NPC talk ----------
G.talk = () => {
  const n = G.nearNpc;
  if (!n || UI.busy) return;
  if (!n.seated) faceTo(n.root, G.hero.root.position);
  n.onTalk(n);
};

function setupNpcs() {
  const brann = spawnNpc('Barbarian', 10, 11.5, Math.PI, {
    name: 'Brann Bụng Bia', anim: 'Sit_Chair_Idle', show: ['Mug'],
    onTalk: (n) => UI.dialog(UI.thumbs.face_Barbarian, n.name, [
      'Hầm dưới kia toàn xương khô biết đi. Ta xuống ba lần, cả ba lần đều quay lên… để uống thêm một ly.',
      'Nghe đồn Vua Xương Morvak canh rương vàng ở hầm mộ phía nam. Ai hạ được hắn thì ta bao rượu cả tháng!',
      'Lăn né đúng lúc là sống. Đứng đỡ đòn của Vua Xương là thành bột xương đấy, nhóc.',
    ][rint(0, 2)], [['Cạn ly!', null]]),
  });
  brann.seated = true;
  place('chair', 10, 11.5, Math.PI);
  const lyra = spawnNpc('Mage', 16.5, 11.6, -0.65, {
    name: 'Pháp Sư Lyra', anim: 'Idle', show: ['Spellbook_open'],
    onTalk: (n) => {
      if (S.quest === 0) UI.dialog(UI.thumbs.face_Mage, n.name, 'Lũ xương trong Đại Sảnh đang ngủ, nhưng chỉ cần có người bước vào là chúng trồi dậy. Dọn sạch chúng giúp ta, phần thưởng sẽ xứng đáng.', [
        ['Nhận nhiệm vụ', () => { S.quest = 1; UI.quest(); UI.toast('Nhận nhiệm vụ: Dọn sạch Đại Sảnh', '#9fd0ff'); n.a.play('Interact', { once: true, onDone: () => n.a.play('Idle') }); }],
        ['Để sau', null, true],
      ]);
      else if (S.quest === 1) UI.dialog(UI.thumbs.face_Mage, n.name, `Vẫn còn ${G.hallLeft()} bộ xương trong Đại Sảnh. Cửa ở phía đông quán.`, [['Đi ngay', null]]);
      else if (S.quest === 2) UI.dialog(UI.thumbs.face_Mage, n.name, 'Tuyệt vời! Đại Sảnh đã yên. Nhận lấy món này, nó từng thuộc về một hiệp sĩ huyền thoại.', [
        ['Nhận thưởng', () => {
          S.quest = 3; UI.quest();
          n.a.play('Cheer', { once: true, onDone: () => n.a.play('Idle') });
          const p = n.root.position.clone();
          dropItem(rollItem(S.lvl + 2, { kind: 'weapon', rarity: 3, legend: LEGEND[0] }), p.clone().setY(1), G.hero.root.position.clone().lerp(p, 0.5).setY(0));
          coinBurst(p, 10, 120); gainXp(60);
        }],
      ]);
      else UI.dialog(UI.thumbs.face_Mage, n.name, 'Hầm mộ phía nam là nơi Vua Xương Morvak ngự. Chuẩn bị kỹ rồi hẵng xuống.', [['Hiểu rồi', null]]);
    },
  });
  for (const n of G.npcs) {
    const el = document.createElement('div'); el.className = 'marker'; el.textContent = '!';
    n.marker = UI.anchor(el, () => n.root.position, { dy: 2.9 });
    n.marker.el.hidden = n.key !== 'Mage';
  }
  G.brann = brann; G.lyra = lyra;
  // Brann thỉnh thoảng nói
  const quips = ['Ê nhóc! Uống một ly đã rồi hẵng xuống hầm.', 'Nghe tiếng lạch cạch dưới kia chưa? Xương đấy.', 'Rương vàng ở hầm mộ… ta thề là có thật!'];
  let qi = 0;
  setInterval(() => {
    if (document.hidden) return;
    const el = document.createElement('div'); el.className = 'bubble'; el.textContent = quips[qi++ % quips.length];
    UI.anchor(el, () => brann.root.position, { dy: 2.6, life: 4.5 });
  }, 9000);
}

// ---------- input ----------
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  G.keys[k] = true;
  if (k === ' ') { e.preventDefault(); G.dodge(); }
  if (k === 'j') G.attack();
  if (k === 'q') G.skill();
  if (k === 'r') G.drink();
  if (k === 'f') { if (!$('#dialog').hidden) $('#dlg-acts button')?.click(); else G.talk(); }
  if (k === 'i') UI.toggleInv();
  if (k === 'escape') { $('#inv').hidden = true; $('#dialog').hidden = true; }
  if (k === '1') G.switchHero('Knight');
  if (k === '2') G.switchHero('Barbarian');
  if (k === '3') G.switchHero('Mage');
});
addEventListener('keyup', (e) => { G.keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { G.keys = {}; });

function inputDir() {
  const k = G.keys;
  let x = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0);
  let z = (k.s || k.arrowdown ? 1 : 0) - (k.w || k.arrowup ? 1 : 0);
  if (G.joy && G.joy.v) { x = G.joy.v.x; z = G.joy.v.y; }
  const l = Math.hypot(x, z);
  if (l < 0.15) return null;
  return new THREE.Vector3(x / Math.max(1, l), 0, z / Math.max(1, l));
}

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function pickAt(cx, cy) {
  // ưu tiên quái gần con trỏ trên màn hình
  let best = null, bd = isTouch ? 70 : 50;
  const v = new THREE.Vector3();
  for (const e of G.enemies) {
    if (!e.alive || e.state === 'dormant') continue;
    v.copy(e.root.position); v.y = 1.1 * (e.def.scale || 1); v.project(camera);
    const sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight;
    const d = Math.hypot(sx - cx, sy - cy);
    if (d < bd) { bd = d; best = e; }
  }
  if (best) return { enemy: best };
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  return ray.ray.intersectPlane(ground, p) ? { point: p } : {};
}
const cvs = renderer.domElement;
cvs.addEventListener('pointerdown', (e) => {
  if (UI.busy) return;
  if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.5 && !G.joy) {
    const hit = pickAt(e.clientX, e.clientY);
    if (hit.enemy) { G.target = hit.enemy; G.goal = null; return; }
    G.joy = { id: e.pointerId, x: e.clientX, y: e.clientY, v: null };
    const j = $('#joy'); j.hidden = false; j.style.left = `${e.clientX}px`; j.style.top = `${e.clientY}px`;
    $('#joy-knob').style.transform = '';
    return;
  }
  const hit = pickAt(e.clientX, e.clientY);
  if (hit.enemy) { G.target = hit.enemy; G.goal = null; }
  else if (hit.point) { G.target = null; G.goal = hit.point; G.holding = e.pointerType === 'mouse'; }
});
addEventListener('pointermove', (e) => {
  if (G.joy && e.pointerId === G.joy.id) {
    let dx = e.clientX - G.joy.x, dy = e.clientY - G.joy.y;
    const l = Math.hypot(dx, dy), m = 50;
    if (l > m) { dx = dx / l * m; dy = dy / l * m; }
    G.joy.v = { x: dx / m, y: dy / m };
    $('#joy-knob').style.transform = `translate(${dx}px, ${dy}px)`;
    return;
  }
  if (G.holding && G.goal) { const hit = pickAt(e.clientX, e.clientY); if (hit.point) G.goal = hit.point; }
});
const endPtr = (e) => {
  if (G.joy && e.pointerId === G.joy.id) { G.joy = null; $('#joy').hidden = true; }
  G.holding = false;
};
addEventListener('pointerup', endPtr);
addEventListener('pointercancel', endPtr);

// ---------- update ----------
const camOff = new THREE.Vector3();
const camLook = new THREE.Vector3();
function updateHero(dt) {
  const h = G.hero, p = h.root.position, ST = G.ST;
  S.mp = Math.min(ST.maxMp, S.mp + dt * (4 + ST.int * 0.15));
  if (G.state === 'dead') return;
  if (G.state === 'dodge') {
    if (G.now < G.dashEnd) { move(p, G.dashV.x * dt, G.dashV.z * dt); if (rnd() < 0.5) dust.emit({ x: p.x, y: 0.15, z: p.z, count: 1, color: 0x6a5f55, speed: [0.3, 1], life: 0.5, size: [0.6, 0.2], alpha: 0.4 }); }
    return;
  }
  let dir = inputDir();
  if (dir) { G.goal = null; G.target = null; }
  if (G.state === 'attack' || G.state === 'skill') {
    if (dir && G.state === 'attack' && G.now > G.cancelAt) G.state = 'idle';
    else return;
  }
  if (!dir && G.target) {
    if (!G.target.alive) G.target = null;
    else {
      const tp = G.target.root.position, d = Math.hypot(tp.x - p.x, tp.z - p.z);
      const reach = G.def.style === 'magic' ? 11 : 2.4 + (G.target.def.boss ? 1 : 0);
      if (d <= reach) { G.attack(G.target); return; }
      dir = new THREE.Vector3(tp.x - p.x, 0, tp.z - p.z).normalize();
    }
  } else if (!dir && G.goal) {
    const d = Math.hypot(G.goal.x - p.x, G.goal.z - p.z);
    if (d < 0.35) G.goal = null; else dir = new THREE.Vector3(G.goal.x - p.x, 0, G.goal.z - p.z).normalize();
  }
  if (dir) {
    const sp = 6.4;
    const ox = p.x, oz = p.z;
    move(p, dir.x * sp * dt, dir.z * sp * dt);
    if (G.goal && Math.hypot(p.x - ox, p.z - oz) < sp * dt * 0.2) G.goal = null;
    h.root.rotation.y = angLerp(h.root.rotation.y, Math.atan2(dir.x, dir.z), 1 - Math.exp(-14 * dt));
    if (G.state !== 'hit') { G.state = 'run'; h.play('Running_A', { speed: 1.05 }); }
  } else if (G.state === 'run') { G.state = 'idle'; h.play(G.def.idle); }
  else if (G.state === 'idle' && h.curName !== G.def.idle) h.play(G.def.idle);
}

function updateEnemies(dt) {
  const hp = G.hero.root.position;
  for (const e of G.enemies) {
    e.a.mixer.update(dt * (e.slow > G.now ? 0.5 : 1));
    // hết chớp trắng
    e.a.model.traverse((m) => { if (m.userData.flash && G.now > m.userData.flash) { m.material.emissive.setRGB(0, 0, 0); m.userData.flash = 0; } });
    if (!e.alive) continue;
    const p = e.root.position, d = Math.hypot(hp.x - p.x, hp.z - p.z);
    const def = e.def, sc = def.scale || 1;
    if (e.state === 'dormant') {
      const hc = cellCh(hp.x, hp.z);
      if (d < 9 && G.state !== 'dead' && (hc === 'h' || hc === '.')) {
        e.state = 'awaken';
        e.a.play('Skeletons_Awaken_Floor', { once: true, speed: 1.35, onDone: () => { if (e.alive) e.state = 'chase'; } });
        dust.emit({ x: p.x, y: 0.2, z: p.z, count: 18, colors: [0x5a5048, 0x766a5e], speed: [1, 3], life: 1.1, size: [1, 0.3], alpha: 0.5, up: 0.5 });
      }
      continue;
    }
    if (e.state === 'idle') {
      const hc = cellCh(hp.x, hp.z);
      if (d < 11 && G.state !== 'dead' && (hc === 'c' || (hc === '.' && hp.z > 20))) {
        e.state = 'taunt'; faceTo(e.root, hp);
        if (def.boss) { UI.boss(e); UI.banner(def.name, 'Trùm xuất hiện'); G.shake = 0.35; }
        e.a.play('Taunt', { once: true, speed: 1.2, onDone: () => { if (e.alive) e.state = 'chase'; } });
      }
      continue;
    }
    if (e.state === 'awaken' || e.state === 'taunt' || e.state === 'hit') continue;
    if (def.boss && e.state === 'chase') {
      const hc = cellCh(hp.x, hp.z);
      if (hc !== 'c' && !(hc === '.' && hp.z > 20)) { e.state = 'idle'; e.a.play('Idle'); UI.boss(null); continue; }
    }
    if (e.state === 'attack') continue;
    if (G.state === 'dead') { if (e.a.curName !== 'Idle') e.a.play('Idle'); continue; }
    // chase
    const range = def.range * (def.boss ? 1 : 1);
    if (d > range) {
      const spd = def.spd * (e.slow > G.now ? 0.45 : 1);
      let vx = (hp.x - p.x) / d, vz = (hp.z - p.z) / d;
      for (const o of G.enemies) {
        if (o === e || !o.alive) continue;
        const ox = p.x - o.root.position.x, oz = p.z - o.root.position.z, od = Math.hypot(ox, oz);
        if (od < 1.4 * Math.max(sc, o.def.scale || 1) && od > 0.001) { vx += ox / od * 0.8; vz += oz / od * 0.8; }
      }
      const l = Math.hypot(vx, vz) || 1;
      move(p, vx / l * spd * dt, vz / l * spd * dt, 0.6 * sc);
      e.root.rotation.y = angLerp(e.root.rotation.y, Math.atan2(vx, vz), 1 - Math.exp(-10 * dt));
      e.a.play(def.run, { speed: def.run === 'Running_A' ? 0.95 : 1.25 });
    } else if (G.now > e.atkReady) {
      e.state = 'attack'; faceTo(e.root, hp);
      const dur = e.a.play(def.atk, { once: true, speed: def.boss ? 0.9 : 1.1, fade: 0.1, onDone: () => { if (e.alive) e.state = 'chase'; } });
      e.atkReady = G.now + def.cd;
      if (def.boss) telegraph(scene, tweens, p.clone().add(new THREE.Vector3(Math.sin(e.root.rotation.y), 0, Math.cos(e.root.rotation.y)).multiplyScalar(1.8)), 2.8, dur * def.hitT);
      after(dur * def.hitT, () => {
        if (!e.alive || e.state !== 'attack') return;
        const q = G.hero.root.position, ang = e.root.rotation.y;
        const fwd = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
        if (def.ranged) {
          const dir = new THREE.Vector3(q.x - p.x, 0, q.z - p.z).normalize();
          fireBolt(p.clone().addScaledVector(dir, 0.8).setY(1.5), dir, 'enemy', rint(def.dmg[0], def.dmg[1]), 0xb46bff);
        } else {
          const v = new THREE.Vector3(q.x - p.x, 0, q.z - p.z), dd = v.length();
          if (def.boss) { shock(scene, tweens, p.clone().addScaledVector(fwd, 1.8), 0xff6a3a, 3, 0.35); G.shake = 0.35; dust.emit({ x: p.x + fwd.x * 1.8, y: 0.2, z: p.z + fwd.z * 1.8, count: 20, colors: [0x5a5048, 0x766a5e], speed: [2, 4], life: 0.9, size: [1, 0.3], alpha: 0.5, flat: true }); }
          if (dd < range + 0.9 && v.normalize().dot(fwd) > 0.1) hurtHero(rint(def.dmg[0], def.dmg[1]) + e.lvl);
        }
      });
    } else {
      faceTo(e.root, hp);
      if (e.a.curName !== 'Idle_Combat' && e.a.action('Idle_Combat')) e.a.play('Idle_Combat'); else if (!e.a.action('Idle_Combat')) e.a.play('Idle');
    }
  }
}

function updateWorld(dt, t) {
  const hp = G.hero.root.position;
  // fade tường che nhân vật
  for (const w of G.walls) {
    const dz = w.position.z - hp.z, dx = Math.abs(w.position.x - hp.x);
    const hide = dz > 0.3 && dz < 7.5 && dx < 3.6;
    const target = hide ? 0 : 1;
    if (Math.abs(w.userData.op - target) > 0.01) {
      w.userData.op = damp(w.userData.op, target, 12, dt);
      if (Math.abs(w.userData.op - target) < 0.02) w.userData.op = target;
      w.visible = w.userData.op > 0.04;
      for (const m of w.userData.mats) { m.opacity = w.userData.op; m.depthWrite = w.userData.op > 0.9; }
    }
  }
  // đuốc chập chờn
  for (const T of G.torches) {
    const f = 0.82 + Math.sin(t * 9 + T.ph) * 0.08 + Math.sin(t * 23 + T.ph * 2) * 0.06 + rnd() * 0.05;
    T.L.intensity = T.base * f;
    if (rnd() < 0.55) glow.emit({ x: T.x, y: T.y, z: T.z, count: 1, colors: T.color === 0xff8a3c ? [0xffb347, 0xff7a1a, 0xffe08a] : [0x5cf5d0, 0x2ad8b0, 0xc8fff0], speed: [0.2, 0.7], dir: new THREE.Vector3(0, 1.4, 0), life: 0.55, size: [0.45, 0.05], spread: 0.18, drag: 0.5 });
  }
  // bụi lơ lửng quanh nhân vật
  if (rnd() < 0.25) glow.emit({ x: hp.x + (rnd() - 0.5) * 16, y: 0.5 + rnd() * 3, z: hp.z + (rnd() - 0.5) * 12, count: 1, color: 0xffe2b0, speed: [0.05, 0.25], life: 4, size: [0.09, 0.04], alpha: 0.5, drag: 0 });
  // loot
  for (const o of G.loot.slice()) {
    o.holder.rotation.y += dt * 1.6;
    o.holder.position.y = 0.75 + Math.sin(t * 2.4 + o.it.id) * 0.12;
    const b = o.beam.userData.beam;
    if (b) b.material.uniforms.uA.value = 0.65 + Math.sin(t * 3 + o.it.id) * 0.3;
    if (o.ready && Math.hypot(o.g.position.x - hp.x, o.g.position.z - hp.z) < 1.4) pickup(o);
  }
  // rương
  for (const ch of G.chests) if (!ch.opened && ch.obj.position.distanceTo(hp) < 2.4) openChest(ch);
  // NPC gần
  let near = null;
  for (const n of G.npcs) { n.a.mixer.update(dt); if (n.root.position.distanceTo(hp) < 3.2) near = n; }
  G.nearNpc = near;
  $('#talk').hidden = !near || UI.busy || G.state === 'dead';
  G.lyra.marker.el.textContent = S.quest === 2 ? '?' : '!';
  G.lyra.marker.el.hidden = !(S.quest === 0 || S.quest === 2);
  // khu vực
  const q = Math.floor(hp.x / C), r = Math.floor(hp.z / C), ch = MAP[r]?.[q];
  if (ch && ch !== '.' && ch !== '#' && ch !== G.area) {
    G.area = ch;
    for (let rr = 0; rr < MAP.length; rr++) for (let qq = 0; qq < MAP[0].length; qq++) if (MAP[rr][qq] === ch) G.seen.add(`${qq},${rr}`);
    if (!G.areaSeen?.[ch]) { G.areaSeen = { ...(G.areaSeen || {}), [ch]: 1 }; UI.banner(AREAS[ch][0], AREAS[ch][1]); }
  }
  if (ch === '.') G.seen.add(`${q},${r}`);
}

function updateCamera(dt) {
  const hp = G.hero.root.position;
  const portrait = innerWidth / innerHeight < 0.8;
  camOff.set(0, portrait ? 21 : 15, portrait ? 13.5 : 11);
  camLook.x = damp(camLook.x, hp.x, 7, dt); camLook.z = damp(camLook.z, hp.z, 7, dt); camLook.y = 1;
  camera.position.copy(camLook).add(camOff);
  if (G.shake > 0) {
    const s = G.shake * 0.35;
    camera.position.x += (rnd() - 0.5) * s; camera.position.y += (rnd() - 0.5) * s; camera.position.z += (rnd() - 0.5) * s;
    G.shake = Math.max(0, G.shake - dt * 1.6);
  }
  camera.lookAt(camLook);
  moon.position.set(hp.x - 9, 22, hp.z - 6);
  moon.target.position.set(hp.x, 0, hp.z);
}

// ---------- loop ----------
const clock = new THREE.Clock();
let frames = 0, ftAcc = 0, qualityChecked = false, uiT = 0, mmT = 0;
function frame() {
  requestAnimationFrame(frame);
  let dt = Math.min(clock.getDelta(), G.fast ? 0.2 : 1 / 20); // G.fast: chỉ dùng khi test headless
  if (performance.now() < stopUntil) dt *= 0.08;
  G.now += dt;
  const t = G.now;
  for (let i = G.timers.length - 1; i >= 0; i--) if (G.now >= G.timers[i].t) { const f = G.timers[i].fn; G.timers.splice(i, 1); f(); }
  G.hero.mixer.update(dt);
  updateHero(dt);
  updateEnemies(dt);
  updateBolts(dt);
  updateWorld(dt, t);
  tweens.update(dt);
  glow.update(dt); dust.update(dt);
  updateCamera(dt);
  if (useBloom) composer.render(); else renderer.render(scene, camera);
  UI.update(camera, innerWidth, innerHeight, dt);
  if ((uiT += dt) > 0.15) { uiT = 0; UI.vitals(G.ST); UI.cooldowns(G.cd, G.now, S.mp >= (G.ST.powers.freeSkill ? 0 : 20)); }
  if ((mmT += dt) > 0.25) { mmT = 0; UI.minimap(G); }
  // tự hạ chất lượng nếu máy yếu
  if (!qualityChecked) {
    frames++; ftAcc += dt;
    if (frames === 150) {
      qualityChecked = true;
      const avg = ftAcc / frames;
      if (avg > 1 / 35) { useBloom = false; renderer.toneMapping = THREE.ACESFilmicToneMapping; PR = 1; renderer.setPixelRatio(1); onResize(); }
    }
  }
}

function onResize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setPixelRatio(PR); composer.setSize(w, h);
  bloom.setSize(w * PR, h * PR);
  glow.mat.uniforms.uScale.value = dust.mat.uniforms.uScale.value = h * PR * 0.9;
}
addEventListener('resize', onResize);

// ---------- boot ----------
function showErr(m) { const e = document.createElement('div'); e.id = 'err'; e.textContent = m; document.body.appendChild(e); }
addEventListener('error', (e) => showErr(String(e.message || e)));
addEventListener('unhandledrejection', (e) => showErr(String(e.reason?.message || e.reason)));

async function boot() {
  await loadAll((k) => { $('#ld-fill').style.width = `${Math.round(k * 100)}%`; $('#ld-txt').textContent = `Đang tải mô hình 3D… ${Math.round(k * 100)}%`; });
  $('#ld-txt').textContent = 'Dựng hầm ngục…';
  buildThumbs();
  UI.init(G);
  buildWorld();
  setupNpcs();
  // quái
  for (const [type, x, z] of [['minion', 28.5, 8], ['warrior', 35, 9.5], ['minion', 45, 13], ['mage', 36, 14.5], ['warrior', 39.5, 21], ['minion', 27.5, 19.5], ['mage', 45.5, 18]]) spawnEnemy(type, x, z, { dormant: true, room: 'h', lvl: 2 });
  G.hallTotal = G.hallLeft();
  spawnEnemy('boss', 12.5, 26.5, { rot: 2.1, room: 'c', lvl: 4 });
  G.ST = stats(); S.hp = G.ST.maxHp; S.mp = G.ST.maxMp;
  UI.heroButtons(Object.values(HEROES));
  spawnHero('Knight', new THREE.Vector3(8.5, 0, 13.5), Math.PI * 0.85);
  // vài món mẫu dưới sàn quán để xem hiệu ứng độ hiếm
  [0, 1, 2, 3].forEach((rar, i) => {
    const it = rollItem(2, { rarity: rar, kind: rar === 0 ? 'shield' : 'weapon' });
    const to = new THREE.Vector3(6.5 + i * 2.2, 0, 7);
    after(0.6 + i * 0.25, () => dropItem(it, to.clone().setY(1.5), to));
  });
  camLook.copy(G.hero.root.position);
  onResize();
  UI.vitals(G.ST); UI.quest();
  $('#loading').hidden = true;
  clock.start();
  frame();
}
boot().catch((e) => { console.error(e); showErr('Lỗi khởi động: ' + (e.message || e)); });
