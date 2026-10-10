import './style.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { N8AOPass } from 'n8ao';
import { loadAll, inst, anims, makeThumbs, weaponForHand, WEAPON_NODES } from './assets.js';
import { pbr, box, plane, column, merge, mesh, sconce, coinPile, coinGeo, goldMat } from './env.js';
const COIN = coinGeo();
import { Tweens, Particles, lootBeam, shock, slash, telegraph, orb, arrow } from './fx.js';
import { UI } from './ui.js';
import { S, stats, xpNeed, rollItem, potion, RAR, LEGEND } from './items.js';

const $ = (s) => document.querySelector(s);
const rnd = Math.random;
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
const angLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
const DEBUG = new URLSearchParams(location.search).has('debug');
const HQ = new URLSearchParams(location.search).has('hq');

// ---------- map: mỗi ô = 4 đơn vị (~3 m) ----------
const C = 4;
const WALL_H = 4, CUT_H = 1.1, WALL_T = 0.8; // tường phía nam cắt thấp (cutaway) kiểu Diablo
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
];
const DOORS = [[24, 10, Math.PI / 2], [20, 22, Math.PI / 2]];
const AREAS = {
  t: ['Quán Trọ Nấm Lùn', 'Khu an toàn'],
  h: ['Đại Sảnh Orc', 'Cẩn thận phía trước'],
  c: ['Ngai Quỷ Vương', 'Trùm cuối'],
};
const cellCh = (x, z) => MAP[Math.floor(z / C)]?.[Math.floor(x / C)];
const floorAt = (x, z) => { const ch = cellCh(x, z); return !!ch && ch !== '#'; };

// ---------- renderer ----------
const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
// review demo2: mobile DPR 3 bị render 1x -> mờ. Giờ render tối đa 2x, máy yếu tự hạ.
let PR = Math.min(devicePixelRatio || 1, 2);
renderer.setPixelRatio(PR);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
$('#app').appendChild(renderer.domElement);

const FOG = 0x07060a;
const scene = new THREE.Scene();
scene.background = new THREE.Color(FOG);
scene.fog = new THREE.Fog(FOG, 24, 52);
// env map rất nhẹ: chỉ để kim loại (vàng, sắt, vũ khí) có phản chiếu, không làm sáng cảnh
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.12;
const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 200);

// post: AO (N8AO) -> bloom -> tone map -> color grade + vignette + grain -> SMAA
const rt = new THREE.WebGLRenderTarget(innerWidth * PR, innerHeight * PR, { type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, rt);
const ao = new N8AOPass(scene, camera, innerWidth * PR, innerHeight * PR);
Object.assign(ao.configuration, { aoRadius: 2.4, distanceFalloff: 1.4, intensity: 3.4, aoSamples: 12, denoiseSamples: 6, denoiseRadius: 10, halfRes: true, gammaCorrection: false, color: new THREE.Color(0x050307) });
composer.addPass(ao);
const plain = new RenderPass(scene, camera); // máy yếu: tắt AO thì vẫn cần pass vẽ cảnh
plain.enabled = false;
composer.addPass(plain);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.55, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uAspect; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c, c * vec3(0.88, 0.98, 1.12), (1.0 - l) * 0.45); // bóng tối ngả lạnh
      c = mix(c, c * vec3(1.08, 1.0, 0.86), l * 0.35);          // vùng sáng ngả ấm (lửa)
      c = mix(vec3(l), c, 0.9);                                  // giảm bão hòa nhẹ cho tông u ám
      c = (c - 0.5) * 1.08 + 0.5;
      vec2 d = vUv - 0.5; d.x *= uAspect;
      c *= mix(0.42, 1.0, smoothstep(0.95, 0.3, length(d)));
      float n = fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
      gl_FragColor = vec4(c + (n - 0.5) * 0.02, 1.0);
    }`,
});
composer.addPass(grade);
// FXAA thay SMAA: SMAA 3 pass tốn ~18 ms trên iGPU Intel, FXAA 1 pass
const fxaa = new ShaderPass(FXAAShader);
composer.addPass(fxaa);

// ---------- lights ----------
// ánh trăng lạnh + fill rất thấp: phần lớn ánh sáng đến từ đuốc
scene.add(new THREE.HemisphereLight(0x5a6890, 0x140e0a, 0.55));
const moon = new THREE.DirectionalLight(0x8fa2e0, 0.7);
moon.castShadow = true;
// shadow map vẽ lại cách 1 frame (xem frame()), khung chỉ vừa vùng camera nhìn
moon.shadow.mapSize.set(isTouch ? 1024 : 1536, isTouch ? 1024 : 1536);
Object.assign(moon.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 60 });
renderer.shadowMap.autoUpdate = false;
moon.shadow.bias = -0.0004;
moon.shadow.normalBias = 0.03;
scene.add(moon, moon.target);
// review demo3 #1: hero lẫn vào nền tối -> đèn bám theo hero (không đổ bóng) + rim lạnh phía sau
const heroLight = new THREE.PointLight(0xffd6a8, 30, 8, 2);
const heroRim = new THREE.PointLight(0x8fb4ff, 14, 5, 2);
scene.add(heroLight, heroRim);
// light pool cho đuốc/lửa: số đèn cố định (không recompile shader), mỗi frame gán cho nguồn gần hero nhất.
// iGPU: 10 point light tốn ~15 ms/frame, pool 5 đèn cắt còn một nửa
const LIGHTS = Array.from({ length: 5 }, () => { const L = new THREE.PointLight(0xff8a3c, 0, 12, 1.8); scene.add(L); return L; });

const tweens = new Tweens();
const glow = new Particles(scene, 2500, true);
const dust = new Particles(scene, 800, false);

// ---------- hero / enemy defs (tên animation theo Quaternius) ----------
const HEROES = {
  Warrior: {
    key: 'Warrior', name: 'Chiến Binh Borin', style: 'melee', idle: 'Idle_Weapon', run: 'Run_Weapon',
    atk: ['Sword_Attack', 'Sword_Attack2'], skill: 'Sword_Attack2', skillName: 'Chém Lốc',
    atkIcon: 'w:sword', skillIcon: 'Sword_WallMount',
  },
  Wizard: {
    key: 'Wizard', name: 'Pháp Sư Mira', style: 'magic', idle: 'Idle_Weapon', run: 'Run_Weapon',
    atk: ['Spell1'], skill: 'Spell2', skillName: 'Nova Băng',
    atkIcon: 'w:staff', skillIcon: 'm_Book_Open',
  },
  Ranger: {
    key: 'Ranger', name: 'Xạ Thủ Kael', style: 'bow', idle: 'Idle_Weapon', run: 'Run',
    atk: ['Bow_Shoot'], skill: 'Bow_Shoot', skillName: 'Mưa Tên',
    atkIcon: 'w:bow', skillIcon: 'Spikes',
  },
};
for (const d of Object.values(HEROES)) d.native = Object.values(WEAPON_NODES).find(([k]) => k === d.key)?.[1];

const ENEMIES = {
  orc: { key: 'Orc', name: 'Orc Lính', hp: 34, dmg: [4, 7], spd: 3.4, range: 1.8, atk: 'Weapon', hitT: 0.45, cd: 1.3, xp: 9, run: 'Run' },
  ninja: { key: 'Ninja', name: 'Ninja Bóng Đêm', hp: 26, dmg: [3, 6], spd: 4.4, range: 1.6, atk: 'Punch', hitT: 0.4, cd: 1.0, xp: 8, run: 'Run' },
  brute: { key: 'Orc_Skull', name: 'Orc Đầu Lâu', hp: 64, dmg: [6, 10], spd: 2.9, range: 2.0, atk: 'Weapon', hitT: 0.5, cd: 1.6, xp: 15, run: 'Walk', runSpd: 1.4, scale: 1.12 },
  caster: { key: 'BlueDemon', name: 'Quỷ Lam', hp: 40, dmg: [7, 11], spd: 2.6, range: 8, atk: 'Punch', hitT: 0.45, cd: 2.2, xp: 16, ranged: true, run: 'Walk', runSpd: 1.3 },
  boss: { key: 'Demon', name: 'Quỷ Vương Azgar', hp: 520, dmg: [12, 18], spd: 2.7, range: 3.0, atk: 'Weapon', hitT: 0.5, cd: 2.0, xp: 150, scale: 1.8, boss: true, run: 'Walk', runSpd: 1.2 },
};

// ---------- actor ----------
class Actor {
  constructor(key, scale = 1) {
    this.key = key;
    this.root = new THREE.Group();
    this.model = inst(key);
    this.model.scale.multiplyScalar(scale);
    this.root.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.clips = anims(key);
    this.actions = {};
    this.cur = null; this.curName = '';
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
  hide(names) { for (const n of names) { const o = n && this.model.getObjectByName(n); if (o) o.visible = false; } }
  show(names) { for (const n of names) { const o = n && this.model.getObjectByName(n); if (o) o.visible = true; } }
  dispose() { this.mixer.stopAllAction(); scene.remove(this.root); }
}

// ---------- game ----------
const G = {
  C, MAP, ST: stats(), xpNeed, enemies: [], npcs: [], chests: [], loot: [], bolts: [], walls: [], colliders: [], timers: [], torches: [],
  seen: new Set(), keys: {}, cd: { q: 0, e: 0, r: 0 }, now: 0, shake: 0, hallTotal: 0, area: '',
  hero: null, def: null, state: 'idle', target: null, goal: null, atkReady: 0, invuln: 0, dashV: null, joy: null,
};
window.__G = G;
if (DEBUG) Object.assign(G, { scene, camera, renderer, post: { ao, plain, bloom, grade, fxaa }, moon });

function after(sec, fn) { G.timers.push({ t: G.now + sec, fn }); }

// ---------- world ----------
// opt.s: scale đều hoặc [sx, sy, sz]; opt.r: bán kính va chạm
function place(key, x, z, rot = 0, y = 0, opt = {}) {
  const o = inst(key);
  o.position.set(x, y, z);
  o.rotation.y = rot;
  if (Array.isArray(opt.s)) o.scale.set(...opt.s);
  else if (opt.s || opt.scale) o.scale.setScalar(opt.s || opt.scale);
  scene.add(o);
  if (opt.r) G.colliders.push({ x, z, r: opt.r });
  return o;
}
// đặt vật vừa khít kích thước (asset có tỉ lệ không đồng nhất)
function fit(o, s) {
  const b = new THREE.Box3().setFromObject(o), v = b.getSize(new THREE.Vector3());
  o.scale.multiplyScalar(s / Math.max(v.x, v.y, v.z));
  return o;
}

// vật liệu theo phòng: quán trọ ấm (gỗ + gạch), đại sảnh lạnh (đá tu viện + đá phiến), ngai quỷ (đá đen nứt + gạch tối)
const MAT = {};
function buildMats() {
  Object.assign(MAT, {
    floor: {
      t: pbr('wood_floor_worn', { tile: 3.2, color: 0xb89a80 }),
      h: pbr('monastery_stone_floor', { tile: 4.5, color: 0xc4bcb0 }),
      c: pbr('slab_tiles', { tile: 4, color: 0x8a8088 }),
    },
    wall: {
      t: pbr('castle_brick_01', { tile: 3, color: 0xa08672 }),
      h: pbr('castle_wall_slates', { tile: 3.4, color: 0x8a8a92 }),
      c: pbr('dark_brick_wall', { tile: 2.6, color: 0x8a7c8a }),
    },
    pillar: pbr('castle_wall_slates', { tile: 2.4, color: 0x9a96a0 }),
    cap: pbr('castle_brick_01', { tile: 1.6, color: 0xc8b8a8 }),
    rock: pbr('rock_wall_08', { tile: 6, color: 0x4a4440, normal: 1.6 }),
  });
}

// tường / cột / cổng: mỗi khối 1 mesh có material riêng để fade khi che nhân vật
function fadeable(geo, mat, pos, o = {}) {
  geo.translate(-pos.x, 0, -pos.z);
  const m = mesh(geo, mat.clone());
  m.position.set(pos.x, 0, pos.z);
  m.userData.mats = [m.material]; m.userData.op = 1; m.userData.fx = o.fx; m.userData.fz = o.fz;
  scene.add(m);
  G.walls.push(m);
  return m;
}

function buildWorld() {
  buildMats();
  const rows = MAP.length, cols = MAP[0].length;
  const fl = (q, r) => { const ch = MAP[r]?.[q]; return !!ch && ch !== '#'; };
  const room = (q, r) => { const ch = MAP[r]?.[q]; return ch === '.' ? 'h' : ch; };

  // sàn: gộp theo phòng (3 draw call)
  const floors = { t: [], h: [], c: [] };
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    if (!fl(q, r)) continue;
    const k = room(q, r);
    floors[k].push(plane(q * C, r * C, q * C + C, r * C + C, 0, MAT.floor[k].userData.tile));
  }
  for (const k of Object.keys(floors)) scene.add(mesh(merge(floors[k]), MAT.floor[k], false));

  // khối đá ngoài phòng (thay "khoảng đen"): mặt đá có texture ngang đỉnh tường, phía nam ngang tường cắt
  const rocks = [];
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    if (fl(q, r)) continue;
    let near = false;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (fl(q + a, r + b)) near = true;
    if (!near) continue;
    const y = (fl(q, r - 1) ? CUT_H : WALL_H) - 0.04;
    rocks.push(plane(q * C, r * C, q * C + C, r * C + C, y, MAT.rock.userData.tile));
  }
  scene.add(mesh(merge(rocks), MAT.rock, false));
  const under = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: FOG }));
  under.rotation.x = -Math.PI / 2; under.position.y = -0.6;
  scene.add(under);

  // tường: box dày WALL_T nằm giữa ranh giới ô; tường nam cắt thấp + gờ đá sáng màu (review demo3: mảng cắt tối phẳng)
  const T2 = WALL_T / 2;
  const wall = (x0, z0, x1, z1, k, cut) => {
    const mat = MAT.wall[k], h = cut ? CUT_H : WALL_H;
    const parts = [box(x0, 0, z0, x1, h, z1, mat.userData.tile)];
    const pos = new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const m = fadeable(merge(parts), mat, pos);
    if (cut) {
      const cap = box(x0, h, z0 - 0.06, x1, h + 0.14, z1 + 0.06, MAT.cap.userData.tile);
      cap.translate(-pos.x, 0, -pos.z);
      const cm = mesh(cap, MAT.cap.clone());
      m.add(cm);
      m.userData.mats.push(cm.material);
    }
  };
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    if (!fl(q, r)) continue;
    const k = room(q, r), x0 = q * C, z0 = r * C;
    if (!fl(q, r - 1)) wall(x0, z0 - T2, x0 + C, z0 + T2, k, false);
    if (!fl(q, r + 1)) wall(x0, z0 + C - T2, x0 + C, z0 + C + T2, k, true);
    if (!fl(q - 1, r)) wall(x0 - T2, z0, x0 + T2, z0 + C, k, false);
    if (!fl(q + 1, r)) wall(x0 + C - T2, z0, x0 + C + T2, z0 + C, k, false);
  }
  // cột ở góc tường (che chỗ hai bức tường giao nhau); góc giáp tường cắt thì cột cũng thấp
  const H = (q, r) => fl(q, r) !== fl(q, r - 1);
  const V = (q, r) => fl(q, r) !== fl(q - 1, r);
  const cutH = (q, r) => fl(q, r - 1) && !fl(q, r);
  for (let r = 0; r <= rows; r++) for (let q = 0; q <= cols; q++) {
    const h = H(q - 1, r) || H(q, r), v = V(q, r - 1) || V(q, r);
    if (!(h && v)) continue;
    const low = cutH(q - 1, r) || cutH(q, r);
    const x = q * C, z = r * C, s = 0.62, top = low ? CUT_H + 0.32 : WALL_H + 0.3;
    fadeable(merge([box(x - s, 0, z - s, x + s, top, z + s, MAT.pillar.userData.tile), box(x - s - 0.1, top - 0.2, z - s - 0.1, x + s + 0.1, top, z + s + 0.1, 1.6)]), MAT.pillar, new THREE.Vector3(x, 0, z));
  }
  // khung cửa đá
  for (const [x, z] of DOORS) {
    const t = MAT.pillar.userData.tile;
    fadeable(merge([
      box(x - 0.55, 0, z - 2.25, x + 0.55, 4.3, z - 1.25, t), box(x - 0.55, 0, z + 1.25, x + 0.55, 4.3, z + 2.25, t),
      box(x - 0.6, 3.5, z - 2.3, x + 0.6, 4.4, z + 2.3, t),
    ]), MAT.pillar, new THREE.Vector3(x, 0, z));
    G.colliders.push({ x, z: z - 1.75, r: 0.55 }, { x, z: z + 1.75, r: 0.55 });
  }

  // đuốc: chỉ là "nguồn sáng" (vị trí lửa + thông số đèn); point light thật lấy từ light pool gần hero
  const torch = (x, z, nx, nz, color = 0xff8a3c, dist = 13) => {
    const s = sconce();
    s.position.set(x + nx * T2, 2.2, z + nz * T2);
    s.rotation.y = Math.atan2(nx, nz);
    scene.add(s);
    const warm = color === 0xff8a3c;
    G.torches.push({
      x: x + nx * (T2 + 0.47), y: 2.78, z: z + nz * (T2 + 0.47), warm, ph: rnd() * 10,
      lp: new THREE.Vector3(x + nx * (T2 + 0.9), 2.98, z + nz * (T2 + 0.9)), color, base: warm ? 46 : 26, dist,
    });
  };
  torch(7, 4, 0, 1); torch(15, 4, 0, 1);
  torch(30, 4, 0, 1); torch(42, 4, 0, 1); torch(24, 17, 1, 0); torch(48, 14, -1, 0);
  torch(8, 20, 0, 1, 0x9b5cff, 11); torch(16, 20, 0, 1, 0x9b5cff, 11);

  // --- quán trọ ---
  place('bull_head', 11, 4.55, 0, 2.3, { s: 2.2 });
  place('GothicCabinet_01', 17.2, 4.9, 0, 0, { r: 1.0, s: 0.9 });
  place('wooden_bookshelf_worn', 19.15, 9.5, -Math.PI / 2, 0, { r: 1.0, s: 0.95 });
  const pit = place('stone_fire_pit', 5.9, 6.4, 0.3, 0, { r: 1.0, s: 0.75 });
  G.torches.push({ x: 5.9, y: 0.35, z: 6.4, lp: new THREE.Vector3(5.9, 1.4, 6.4), color: 0xff8a3a, base: 26, dist: 11, ph: 3, warm: true, fire: pit });
  place('wooden_table_02', 11, 9.8, Math.PI / 2, 0, { s: [2.1, 1, 1.4] }); G.colliders.push({ x: 11, z: 8.6, r: 1.0 }, { x: 11, z: 11, r: 1.0 });
  place('wooden_stool_01', 9.6, 8.5, 0.3, 0, { r: 0.35 }); place('wooden_stool_01', 12.6, 9.2, 1.2, 0, { r: 0.35 }); place('wooden_stool_01', 9.5, 11.4, 2, 0, { r: 0.35 });
  const top = 1.04;
  place('wooden_candlestick', 11.2, 10.4, 0, top, { s: 1.2 });
  place('brass_goblets#brass_goblet_01', 10.8, 9.2, 0, top); place('brass_goblets#brass_goblet_02', 11.3, 8.8, 1, top);
  place('wine_bottles_01#wine_bottles_01_bordeaux', 10.7, 10.9, 0, top);
  G.torches.push({ x: 11.2, y: top + 0.62, z: 10.4, lp: new THREE.Vector3(11.2, 2.2, 10.4), color: 0xffb066, base: 8, dist: 5, ph: 1, warm: true, candle: true });
  place('wine_barrel_01', 18.3, 13.2, 0, 0, { r: 0.7 }); place('wine_barrel_01', 17.2, 14.6, 0.6, 0, { r: 0.7 }); place('wine_barrel_01', 18.5, 14.8, 1, 0, { r: 0.7 });
  place('wooden_crate_01', 5.6, 14.5, 0.2, 0, { r: 0.8, s: 1.3 }); place('wooden_crate_01', 5.7, 14.5, -0.1, 0.6, { s: 1.15 });
  place('wooden_bucket_01', 7.1, 15.0, 0, 0);
  place('wooden_lantern_01', 5.0, 12.6, 0.4, 0);
  // --- đại sảnh ---
  // cột sảnh: fade khi che nhân vật như tường
  for (const [x, z] of [[30, 10], [42, 10], [30, 18], [42, 18]]) { fadeable(column(x, z, 0.62, 4.4, 2.4), MAT.pillar, new THREE.Vector3(x, 0, z), { fx: 7.5, fz: 11 }); G.colliders.push({ x, z, r: 0.85 }); }
  // 2 chậu lửa giữa sảnh: sảnh rộng, chỉ đuốc trên tường thì giữa phòng tối om
  for (const [x, z] of [[33, 14], [39, 14]]) {
    const b = place('stone_fire_pit', x, z, rnd() * 6, 0, { r: 0.7, s: 0.45 });
    G.torches.push({ x, y: 0.3, z, lp: new THREE.Vector3(x, 1.5, z), color: 0xff8a3a, base: 22, dist: 12, ph: rnd() * 9, warm: true, fire: b });
  }
  scene.add(mesh(box(34.6, 0, 5.3, 37.4, 0.7, 7.5, 2), MAT.pillar));
  place('gothic_statue', 36, 6.4, 0, 0.7, { r: 1.6, s: 1.25 });
  place('wooden_crate_01', 46.4, 6.4, 0.3, 0, { r: 0.8, s: 1.3 }); place('wine_barrel_01', 25.8, 6.5, 0, 0, { r: 0.7 });
  place('large_iron_gate', 47.3, 21.5, -Math.PI / 2, 0, { s: 0.75 });
  place('kite_shield', 46.9, 9.6, -Math.PI / 2, 1.4, { s: 1.1 });
  const bag = coinPile(40, 0.6); bag.position.set(44.6, 0, 9.4); scene.add(bag);
  // --- ngai quỷ vương ---
  place('large_iron_gate', 4.45, 26, Math.PI / 2, 0, { s: 0.8 });
  scene.add(mesh(merge([box(4.9, 0, 29.3, 6.7, 1.1, 31.1, 2), box(17.3, 0, 29.3, 19.1, 1.1, 31.1, 2)]), MAT.pillar));
  G.colliders.push({ x: 5.8, z: 30.2, r: 0.9 }, { x: 18.2, z: 30.2, r: 0.9 });
  for (const [x, z] of [[5.8, 30.2], [18.2, 30.2]]) { const p = coinPile(50, 0.7); p.position.set(x, 1.1, z); scene.add(p); }
  place('brass_candleholders#brass_candleholder_01', 5.8, 21.5, 0, 0, { r: 0.4, s: 1.7 }); place('brass_candleholders#brass_candleholder_01', 18.2, 21.5, 0, 0, { r: 0.4, s: 1.7 });
  for (const [x, z] of [[6.2, 26.5], [17.4, 26.8], [8.8, 31]]) { const p = coinPile(70, 0.9); p.position.set(x, 0, z); scene.add(p); }
  scene.add(mesh(merge([column(18, 25, 0.6, 2.2, 2.4), column(6, 25, 0.6, 4.8, 2.4)]), MAT.pillar));
  G.colliders.push({ x: 18, z: 25, r: 0.8 }, { x: 6, z: 25, r: 0.8 });
  scene.add(mesh(box(9.6, 0, 30.2, 14.4, 0.35, 32, 2), MAT.pillar));
  place('WoodenChair_01', 12, 31.1, Math.PI, 0.35, { r: 1.1, s: 1.15 });

  // rương: nắp là node riêng -> bọc vào pivot đặt ở bản lề
  const chest = (key, x, z, rot, boost, n, s = 1.25) => {
    const obj = place(key, x, z, rot, 0, { r: 1, s });
    let lid = null;
    obj.traverse((o) => { if (!lid && /lid|Top/i.test(o.name) && o.isMesh) lid = o; });
    let hinge = null;
    if (lid) {
      obj.updateMatrixWorld(true);
      const local = new THREE.Box3().setFromObject(lid).applyMatrix4(new THREE.Matrix4().copy(lid.parent.matrixWorld).invert());
      hinge = new THREE.Group();
      hinge.position.set((local.min.x + local.max.x) / 2, local.min.y, local.min.z);
      lid.parent.add(hinge);
      hinge.attach(lid);
    }
    G.chests.push({ obj, lid: hinge, opened: false, boost, n });
  };
  chest('treasure_chest', 36, 9.6, 0, 10, 3);
  chest('treasure_chest', 15.6, 30.6, Math.PI, 30, 4, 1.4);
}

// ---------- thumbnails ----------
function buildThumbs() {
  const list = [];
  for (const k of ['w:sword', 'w:dagger', 'w:staff', 'w:holy', 'w:bow']) {
    const o = inst(k); o.rotation.z = -Math.PI / 4;
    list.push({ id: k, obj: o, dir: new THREE.Vector3(0.2, 0.2, 1) });
  }
  for (const k of ['m_Book2', 'Skull', 'Bag_Standing', 'm_Potion2', 'Sword_WallMount', 'm_Book_Open', 'Spikes']) list.push({ id: k, obj: inst(k), dir: new THREE.Vector3(0.4, 0.5, 1) });
  for (const k of ['Warrior', 'Wizard', 'Ranger', 'Cleric', 'Monk', 'MushroomKing']) {
    const o = inst(k);
    const mx = new THREE.AnimationMixer(o);
    const clip = THREE.AnimationClip.findByName(anims(k), 'Idle');
    if (clip) { mx.clipAction(clip).play(); mx.update(0.3); }
    list.push({ id: 'face_' + k, obj: o, face: true, dir: new THREE.Vector3(0.35, 0.12, 1) });
  }
  UI.thumbs = makeThumbs(list);
}

// ---------- hero ----------
function spawnHero(key, pos, rotY) {
  if (G.hero) G.hero.dispose();
  const def = HEROES[key];
  const a = new Actor(key);
  a.root.position.copy(pos);
  a.root.rotation.y = rotY;
  G.hero = a; G.def = def; S.hero = key;
  equipVisual();
  a.play(def.idle);
  G.state = 'idle';
  UI.hero(def);
}

// vũ khí trang bị hiện trên tay nếu hợp class (xạ thủ không cầm kiếm bắn tên); không hợp thì giữ vũ khí gốc
const CLASS_W = { Warrior: ['sword', 'dagger'], Wizard: ['staff', 'holy'], Ranger: ['bow'] };
function equipVisual() {
  const a = G.hero;
  if (a.wpn) { a.wpn.parent?.remove(a.wpn); a.wpn = null; }
  const id = S.eq.weapon?.m?.slice(2);
  const w = CLASS_W[G.def.key]?.includes(id) && weaponForHand(id);
  const bone = w && a.model.getObjectByName(w.bone);
  if (!bone) { a.show([G.def.native]); return; }
  a.hide([G.def.native]);
  bone.add(w.mesh);
  a.wpn = w.mesh;
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
  glow.emit({ x: p.x, y: 1.2, z: p.z, count: 26, colors: [RAR[it.rarity].hex], speed: [1.5, 4], life: 0.7, size: [0.35, 0], up: 1 });
  UI.toast(`Trang bị: ${it.name}`, RAR[it.rarity].c);
};
G.refresh = () => { G.ST = stats(); S.hp = Math.min(S.hp, G.ST.maxHp); S.mp = Math.min(S.mp, G.ST.maxMp); UI.vitals(G.ST); };

// ---------- enemies ----------
function spawnEnemy(type, x, z, o = {}) {
  const def = ENEMIES[type];
  const a = new Actor(def.key, def.scale || 1);
  a.model.traverse((m) => { if (m.isMesh) m.material = m.material.clone(); });
  a.root.position.set(x, 0, z);
  a.root.rotation.y = o.rot ?? rnd() * Math.PI * 2;
  const lvl = o.lvl || 1;
  const hp = Math.round(def.hp * (1 + (lvl - 1) * 0.15));
  const e = { a, root: a.root, def, type, hp, max: hp, lvl, alive: true, state: o.dormant ? 'dormant' : 'idle', atkReady: 0, room: o.room, slow: 0, bar: null };
  // quái "ngủ" nằm dưới sàn, khi có người vào thì trồi lên
  if (o.dormant) { a.root.position.y = -2.8 * (def.scale || 1); a.root.visible = false; }
  a.play('Idle');
  G.enemies.push(e);
  return e;
}

// ---------- NPC ----------
function spawnNpc(key, x, z, rot, o) {
  const a = new Actor(key, o.scale || 1);
  a.root.position.set(x, 0, z);
  a.root.rotation.y = rot;
  a.play(o.anim || 'Idle');
  const n = { a, root: a.root, key, name: o.name, onTalk: o.onTalk, marker: null };
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
function move(p, dx, dz, r = 0.85) {
  if (free(p.x + dx, p.z, r)) p.x += dx;
  if (free(p.x, p.z + dz, r)) p.z += dz;
}

// ---------- combat ----------
const HIT = new THREE.Vector3();
const awake = (e) => e.alive && e.state !== 'dormant' && e.state !== 'awaken';
function nearestEnemy(range) {
  let best = null, bd = range;
  const p = G.hero.root.position;
  for (const e of G.enemies) {
    if (!awake(e)) continue;
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
  const sc = e.def.scale || 1;
  UI.dmg(HIT.clone().setY(0.6 * sc), crit ? `${d}!` : `${d}`, crit ? 'crit' : o.fire ? 'fire' : '');
  glow.emit({ x: HIT.x, y: 1.2 * sc, z: HIT.z, count: crit ? 22 : 12, colors: o.fire ? [0xff9a3a, 0xffd36a] : [0xfff2c0, 0xffffff], speed: [3, 7], life: 0.35, size: [0.28, 0], up: 0.8 });
  e.a.model.traverse((m) => { if (m.isMesh && m.material.emissive) { m.material.emissive.setRGB(0.32, 0.22, 0.16); m.userData.flash = G.now + 0.07; } });
  if (crit) { G.shake = Math.max(G.shake, 0.25); hitstop(0.05); }
  if (!e.def.boss) { const p = G.hero.root.position, ep = e.root.position; const dx = ep.x - p.x, dz = ep.z - p.z, l = Math.hypot(dx, dz) || 1; move(ep, dx / l * 0.45, dz / l * 0.45, 0.7); }
  if (ST.ls) S.hp = Math.min(ST.maxHp, S.hp + Math.max(1, Math.round(d * ST.ls / 100)));
  if (o.slow) e.slow = G.now + o.slow;
  if (e.hp <= 0) return killEnemy(e);
  if (!awake(e)) return;
  if (!e.def.boss && e.state !== 'attack') { e.state = 'hit'; e.a.play('HitReact', { once: true, speed: 1.5, onDone: () => { if (e.alive) e.state = 'chase'; } }); }
  if (!e.bar && !e.def.boss) {
    const el = document.createElement('div'); el.className = 'ehp'; el.innerHTML = '<i></i>';
    e.bar = UI.anchor(el, () => e.root.position, { dy: 2.7 * sc });
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
  e.a.play('Death', { once: true });
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
  if (e.def.boss) { UI.boss(null); G.shake = 0.6; UI.banner('Quỷ Vương đã ngã', 'Chiến thắng'); }
  if (e.room === 'h' && S.quest === 1 && G.hallLeft() === 0) { S.quest = 2; UI.toast('Đại Sảnh đã sạch! Quay lại gặp Tu Sĩ Elara.', '#7be38a'); }
  UI.quest();
  after(3.2, () => tweens.add(1.2, (k) => { e.root.position.y = -k * 1.6; }, () => e.a.dispose()));
}
G.hallLeft = () => G.enemies.filter((e) => e.room === 'h' && e.alive).length;

function explode(p, rad, dmg, color) {
  shock(scene, tweens, p, color, rad, 0.4);
  glow.emit({ x: p.x, y: 0.8, z: p.z, count: 40, colors: [color, 0xffd36a, 0xffffff], speed: [3, 9], life: 0.5, size: [0.5, 0], up: 0.9 });
  for (const e of G.enemies) if (awake(e) && e.root.position.distanceTo(p) < rad) damageEnemy(e, dmg, { fire: true, noFire: true });
}

function hurtHero(d) {
  if (G.state === 'dead' || G.now < G.invuln) return;
  d = Math.max(1, Math.round(d * (1 - Math.min(0.6, G.ST.armor / 70))));
  S.hp -= d;
  UI.dmg(G.hero.root.position.clone().setY(0.3), `-${d}`, 'hurt');
  G.shake = Math.max(G.shake, 0.2);
  const h = $('#hurt'); h.style.opacity = 1; clearTimeout(G._ht); G._ht = setTimeout(() => (h.style.opacity = 0), 160);
  if (S.hp <= 0) return heroDie();
  if (G.state === 'idle' || G.state === 'run') { G.state = 'hit'; G.hero.play('RecieveHit', { once: true, speed: 1.6, onDone: () => { if (G.state === 'hit') G.state = 'idle'; } }); }
  UI.vitals(G.ST);
}

const SPAWN = new THREE.Vector3(8.5, 0, 12.5);
function heroDie() {
  G.state = 'dead'; S.hp = 0;
  G.hero.play('Death', { once: true });
  UI.banner('Bạn đã gục ngã', 'Hồi sinh tại quán trọ');
  after(3, () => {
    S.hp = G.ST.maxHp; S.mp = G.ST.maxMp; S.gold = Math.floor(S.gold * 0.85);
    G.hero.root.position.copy(SPAWN);
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
const fwdOf = (ang) => new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
const RANGE = { melee: 3.4, magic: 14, bow: 15 };
const REACH = { melee: 2.4, magic: 11, bow: 12 };

G.attack = (tgt) => {
  if (busy() || G.now < G.atkReady || UI.busy) return;
  const def = G.def, ST = G.ST, h = G.hero;
  tgt = tgt && tgt.alive ? tgt : nearestEnemy(RANGE[def.style]);
  if (tgt) faceTo(h.root, tgt.root.position);
  G.state = 'attack';
  const anim = def.atk[(G.combo = ((G.combo || 0) + 1) % def.atk.length)];
  const sp = ST.speed * (def.style === 'melee' ? 1.2 : 1.35);
  const dur = h.play(anim, { once: true, speed: sp, fade: 0.08, onDone: () => { if (G.state === 'attack') G.state = 'idle'; } });
  G.atkReady = G.now + dur * 0.62;
  G.cancelAt = G.now + dur * 0.6;
  after(dur * (def.style === 'melee' ? 0.38 : 0.45), () => {
    if (G.state === 'dead') return;
    const p = h.root.position, fwd = fwdOf(h.root.rotation.y);
    const dir = tgt && tgt.alive ? tgt.root.position.clone().sub(p).setY(0).normalize() : fwd;
    if (def.style === 'magic') fireBolt(p.clone().addScaledVector(dir, 0.9).setY(1.4), dir, 'hero', rint(ST.dmg[0], ST.dmg[1]) + 3, 0x7fc8ff);
    else if (def.style === 'bow') fireArrow(p.clone().addScaledVector(dir, 0.8).setY(1.35), dir, rint(ST.dmg[0], ST.dmg[1]) + 2);
    else {
      slash(scene, tweens, p.clone().addScaledVector(fwd, 0.6), h.root.rotation.y, 0xffc880, 2.0);
      let hit = false;
      for (const e of G.enemies) {
        if (!awake(e)) continue;
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
  const def = G.def, h = G.hero;
  G.state = 'skill';
  const end = () => { if (G.state === 'skill') G.state = 'idle'; };
  if (def.style === 'magic') {
    const dur = h.play(def.skill, { once: true, speed: 1.5, onDone: end });
    after(dur * 0.5, () => {
      const q = h.root.position;
      shock(scene, tweens, q, 0x6fc4ff, 6, 0.55); shock(scene, tweens, q, 0xb8e6ff, 4, 0.35);
      glow.emit({ x: q.x, y: 0.4, z: q.z, count: 90, colors: [0x8fd8ff, 0xd8f4ff, 0x5aa2ff], speed: [6, 12], life: 0.6, size: [0.45, 0], flat: true });
      G.shake = 0.3;
      for (const e of G.enemies) if (awake(e) && e.root.position.distanceTo(q) < 6) damageEnemy(e, rint(G.ST.dmg[0], G.ST.dmg[1]) * 1.4 + 6, { slow: 2.5 });
    });
  } else if (def.style === 'bow') {
    // Mưa Tên: 7 mũi tên xòe quạt về phía mục tiêu gần nhất
    const t = nearestEnemy(15);
    if (t) faceTo(h.root, t.root.position);
    const dur = h.play(def.skill, { once: true, speed: 1.1, onDone: end });
    after(dur * 0.45, () => {
      const p = h.root.position, base = h.root.rotation.y;
      for (let i = -3; i <= 3; i++) {
        const dir = fwdOf(base + i * 0.13);
        fireArrow(p.clone().addScaledVector(dir, 0.8).setY(1.35), dir, Math.round(rint(G.ST.dmg[0], G.ST.dmg[1]) * 0.9) + 3, true);
      }
      glow.emit({ x: p.x, y: 1.3, z: p.z, count: 24, colors: [0xfff0c8, 0xffd36a], speed: [2, 5], life: 0.4, size: [0.3, 0] });
      G.shake = 0.15;
    });
  } else {
    const dur = h.play(def.skill, { once: true, speed: 1.0, onDone: end });
    for (const k of [0.3, 0.6]) after(dur * k, () => {
      const q = h.root.position;
      shock(scene, tweens, q, 0xff9a40, 3.6, 0.35);
      slash(scene, tweens, q, h.root.rotation.y + k * 6, 0xffb060, 3.2);
      glow.emit({ x: q.x, y: 1, z: q.z, count: 30, colors: [0xffb060, 0xffe0b0], speed: [4, 8], life: 0.35, size: [0.3, 0], flat: true });
      dust.emit({ x: q.x, y: 0.2, z: q.z, count: 14, colors: [0x5a5048, 0x766a5e], speed: [2, 4], life: 0.8, size: [0.9, 0.3], alpha: 0.45, flat: true });
      G.shake = Math.max(G.shake, 0.18);
      for (const e of G.enemies) if (awake(e) && e.root.position.distanceTo(q) < 3.6) damageEnemy(e, rint(G.ST.dmg[0], G.ST.dmg[1]) * 0.9 + 2);
    });
  }
  UI.vitals(G.ST);
};

G.dodge = () => {
  if (G.state === 'dead' || G.state === 'dodge' || G.now < G.cd.e || UI.busy) return;
  const h = G.hero;
  let dir = inputDir();
  if (!dir) dir = fwdOf(h.root.rotation.y);
  h.root.rotation.y = Math.atan2(dir.x, dir.z);
  G.state = 'dodge'; G.cd.e = G.now + 1.2; G.invuln = G.now + 0.45;
  G.dashV = dir.multiplyScalar(12); G.dashEnd = G.now + 0.36;
  h.play('Roll', { once: true, speed: 1.6, fade: 0.05, onDone: () => { if (G.state === 'dodge') G.state = 'idle'; } });
  const p = h.root.position;
  dust.emit({ x: p.x, y: 0.2, z: p.z, count: 12, colors: [0x5a5048, 0x766a5e], speed: [1, 2.5], life: 0.7, size: [0.8, 0.3], alpha: 0.5, up: 0.3 });
};

G.drink = () => {
  if (G.state === 'dead' || G.now < G.cd.r) return;
  const i = S.bag.findIndex((it) => it.kind === 'potion');
  if (i < 0) { UI.toast('Hết bình máu — mua thêm ở Vua Nấm', '#ff7a6b'); return; }
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
  G.bolts.push({ m, v: dir.clone().multiplyScalar(owner === 'hero' ? 17 : 10), owner, dmg, color, life: 1.6, fire, trail: true });
}
function fireArrow(pos, dir, dmg, pierce) {
  const m = arrow(0xfff0c8);
  m.position.copy(pos);
  m.lookAt(pos.clone().add(dir));
  scene.add(m);
  G.bolts.push({ m, v: dir.clone().multiplyScalar(24), owner: 'hero', dmg, color: 0xfff0c8, life: 0.75, pierce, hits: new Set() });
}
function updateBolts(dt) {
  for (let i = G.bolts.length - 1; i >= 0; i--) {
    const b = G.bolts[i];
    b.m.position.addScaledVector(b.v, dt);
    b.life -= dt;
    const p = b.m.position;
    if (b.trail) glow.emit({ x: p.x, y: p.y, z: p.z, count: 2, colors: [b.color, 0xffffff], speed: [0.2, 0.8], life: 0.35, size: [0.32, 0], spread: 0.15 });
    else if (rnd() < 0.5) glow.emit({ x: p.x, y: p.y, z: p.z, count: 1, color: 0xffe6b0, speed: [0, 0.2], life: 0.18, size: [0.16, 0], spread: 0.05 });
    let hit = null;
    if (b.owner === 'hero') {
      for (const e of G.enemies) if (awake(e) && !b.hits?.has(e) && Math.hypot(e.root.position.x - p.x, e.root.position.z - p.z) < 0.9 * (e.def.scale || 1)) { hit = e; break; }
    } else if (Math.hypot(G.hero.root.position.x - p.x, G.hero.root.position.z - p.z) < 0.8) hit = 'hero';
    if (hit && b.pierce && hit !== 'hero') { b.hits.add(hit); damageEnemy(hit, b.dmg); continue; }
    if (hit || b.life <= 0 || !floorAt(p.x, p.z)) {
      glow.emit({ x: p.x, y: p.y, z: p.z, count: b.trail ? 26 : 8, colors: [b.color, 0xffffff], speed: [2, 6], life: 0.4, size: [0.35, 0] });
      if (b.trail) shock(scene, tweens, p.clone(), b.color, 1.4, 0.25, 0.1);
      if (hit === 'hero') hurtHero(b.dmg);
      else if (hit) damageEnemy(hit, b.dmg, { fire: b.fire });
      scene.remove(b.m);
      b.m.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
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
  if (it.kind !== 'weapon') fit(m, it.kind === 'potion' ? 0.75 : 0.85);
  else m.rotation.z = 0.5;
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
    // review demo2 #3: label chỉ hiện trong bán kính 9, né HUD, tự xếp tầng khi chồng
    o.label = UI.anchor(el, () => g.position, { dy: it.rarity >= 2 ? 2.2 : 1.6, cull: 9 });
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
    const c = new THREE.Mesh(COIN, goldMat);
    scene.add(c);
    const a = rnd() * Math.PI * 2, r = 0.8 + rnd() * 1.6;
    const to = new THREE.Vector3(p.x + Math.cos(a) * r, 0.05, p.z + Math.sin(a) * r);
    const h = 1.5 + rnd() * 1.5;
    tweens.add(0.5 + rnd() * 0.2, (k) => { c.position.set(p.x + (to.x - p.x) * k, 0.05 + Math.sin(k * Math.PI) * h, p.z + (to.z - p.z) * k); c.rotation.x += 0.4; }, () => {
      c.rotation.x = 0;
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
  if (ch.lid) tweens.add(0.45, (k) => { ch.lid.rotation.x = -1.7 * (1 - (1 - k) ** 3); });
  glow.emit({ x: p.x, y: 0.9, z: p.z, count: 50, colors: [0xffd36a, 0xfff3c4, 0xffa83a], speed: [2, 6], life: 0.9, size: [0.35, 0], up: 1.4, gravity: 3 });
  G.shake = 0.2;
  coinBurst(p, 12, rint(25, 45) + ch.boost);
  const fwd = fwdOf(ch.obj.rotation.y);
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
  faceTo(n.root, G.hero.root.position);
  n.onTalk(n);
};

function setupNpcs() {
  const T = () => UI.thumbs;
  const elara = spawnNpc('Cleric', 15.5, 11.4, -0.7, {
    name: 'Tu Sĩ Elara',
    onTalk: (n) => {
      if (S.quest === 0) UI.dialog(T().face_Cleric, n.name, 'Lũ orc đang ngủ dưới nền Đại Sảnh, chỉ cần có bước chân là chúng trồi lên. Dọn sạch chúng giúp ta, phần thưởng sẽ xứng đáng.', [
        ['Nhận nhiệm vụ', () => { S.quest = 1; UI.quest(); UI.toast('Nhận nhiệm vụ: Dọn sạch Đại Sảnh', '#9fd0ff'); n.a.play('Spell1', { once: true, onDone: () => n.a.play('Idle') }); }],
        ['Để sau', null, true],
      ]);
      else if (S.quest === 1) UI.dialog(T().face_Cleric, n.name, `Vẫn còn ${G.hallLeft()} con quái trong Đại Sảnh. Cửa ở phía đông quán.`, [['Đi ngay', null]]);
      else if (S.quest === 2) UI.dialog(T().face_Cleric, n.name, 'Tuyệt vời! Đại Sảnh đã yên. Nhận lấy món này, nó từng thuộc về một hiệp sĩ huyền thoại.', [
        ['Nhận thưởng', () => {
          S.quest = 3; UI.quest();
          n.a.play('Spell1', { once: true, onDone: () => n.a.play('Idle') });
          const p = n.root.position.clone();
          dropItem(rollItem(S.lvl + 2, { kind: 'weapon', rarity: 3, legend: LEGEND[0] }), p.clone().setY(1), G.hero.root.position.clone().lerp(p, 0.5).setY(0));
          coinBurst(p, 10, 120); gainXp(60);
        }],
      ]);
      else UI.dialog(T().face_Cleric, n.name, 'Ngai Quỷ Vương ở phía nam Đại Sảnh. Mua thêm bình máu chỗ Vua Nấm rồi hẵng xuống.', [['Hiểu rồi', null]]);
    },
  });
  // Vua Nấm bán bình máu (25 vàng)
  const shroom = spawnNpc('MushroomKing', 17.2, 7.6, -0.9, {
    name: 'Vua Nấm Tí Hon', scale: 0.85,
    onTalk: (n) => UI.dialog(T().face_MushroomKing, n.name, `Bình máu tươi rói đây! 25 vàng một bình. Ngươi đang có ${S.gold} vàng.`, [
      ['Mua 1 bình (25)', () => {
        if (S.gold < 25) { UI.toast('Không đủ vàng', '#ff7a6b'); n.a.play('No', { once: true, onDone: () => n.a.play('Idle') }); return; }
        if (S.bag.length >= 20) { UI.toast('Túi đầy', '#ff7a6b'); return; }
        S.gold -= 25; S.bag.push(potion()); UI.vitals(G.ST); UI.toast('Mua: Bình Hồi Máu', '#7be38a');
        n.a.play('Yes', { once: true, onDone: () => n.a.play('Idle') });
      }],
      ['Thôi', null, true],
    ]),
  });
  const monk = spawnNpc('Monk', 9.6, 14.2, Math.PI * 0.9, { name: 'Sư Huynh Tảo', anim: 'Idle', onTalk: (n) => UI.dialog(T().face_Monk, n.name, [
    'Quỷ Vương Azgar quất đòn rất chậm, nhưng trúng là văng. Thấy vòng đỏ dưới chân thì lăn ngay.',
    'Quỷ Lam đứng xa bắn cầu lửa xanh. Lao vào đánh nó trước, lũ orc để sau.',
    'Xạ thủ bắn tên xuyên được nhiều con một lúc. Thử bấm phím 3 xem.',
  ][rint(0, 2)], [['Cảm ơn sư huynh', null]]) });
  for (const n of G.npcs) {
    const el = document.createElement('div'); el.className = 'marker'; el.textContent = '!';
    n.marker = UI.anchor(el, () => n.root.position, { dy: n.key === 'MushroomKing' ? 2.5 : 2.9 });
    n.marker.el.hidden = n.key !== 'Cleric';
  }
  G.elara = elara; G.shroom = shroom; G.monk = monk;
  const quips = ['Bình máu đây! Bình máu nóng hổi đây!', 'Nấm ăn được, nấm biết nói, nấm bán thuốc.', 'Dưới hầm có tiếng gầm… đừng nhìn ta, ta chỉ là cây nấm.'];
  let qi = 0;
  setInterval(() => {
    if (document.hidden) return;
    const el = document.createElement('div'); el.className = 'bubble'; el.textContent = quips[qi++ % quips.length];
    UI.anchor(el, () => shroom.root.position, { dy: 2.4, life: 4.5, hud: true });
  }, 9000);
}

// ---------- input ----------
const TP = [[8.5, 12.5], [36, 13], [12, 24]];
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
  if (k === '1') G.switchHero('Warrior');
  if (k === '2') G.switchHero('Wizard');
  if (k === '3') G.switchHero('Ranger');
  // ?debug: T dịch chuyển quán -> sảnh -> ngai (phục vụ test)
  if (DEBUG && k === 't') { const [x, z] = TP[(G.tp = ((G.tp ?? 0) + 1) % TP.length)]; G.hero.root.position.set(x, 0, z); }
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
  let best = null, bd = isTouch ? 70 : 50;
  const v = new THREE.Vector3();
  for (const e of G.enemies) {
    if (!awake(e)) continue;
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

// cần gạt ảo: trên máy cảm ứng luôn hiện mờ ở góc trái dưới (review demo2: không thấy cần gạt)
const joyEl = $('#joy');
function joyHome() {
  if (!isTouch) return;
  joyEl.hidden = false; joyEl.classList.add('idle');
  joyEl.style.left = '92px'; joyEl.style.top = `${innerHeight - 170}px`;
  $('#joy-knob').style.transform = '';
}
const cvs = renderer.domElement;
cvs.addEventListener('pointerdown', (e) => {
  if (UI.busy) return;
  if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.5 && !G.joy) {
    const hit = pickAt(e.clientX, e.clientY);
    if (hit.enemy) { G.target = hit.enemy; G.goal = null; return; }
    G.joy = { id: e.pointerId, x: e.clientX, y: e.clientY, v: null };
    joyEl.hidden = false; joyEl.classList.remove('idle');
    joyEl.style.left = `${e.clientX}px`; joyEl.style.top = `${e.clientY}px`;
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
  if (G.joy && e.pointerId === G.joy.id) { G.joy = null; joyEl.hidden = true; joyHome(); }
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
      const reach = REACH[G.def.style] + (G.target.def.boss && G.def.style === 'melee' ? 1 : 0);
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
    if (G.state !== 'hit') { G.state = 'run'; h.play(G.def.run, { speed: 1.05 }); }
  } else if (G.state === 'run') { G.state = 'idle'; h.play(G.def.idle); }
  else if (G.state === 'idle' && h.curName !== G.def.idle) h.play(G.def.idle);
}

function awaken(e) {
  e.state = 'awaken';
  const p = e.root.position, sc = e.def.scale || 1, y0 = p.y;
  e.root.visible = true;
  faceTo(e.root, G.hero.root.position);
  e.a.play('Jump', { once: true, speed: 0.9 });
  dust.emit({ x: p.x, y: 0.2, z: p.z, count: 22, colors: [0x5a5048, 0x766a5e], speed: [1, 3], life: 1.1, size: [1, 0.3], alpha: 0.5, up: 0.5 });
  glow.emit({ x: p.x, y: 0.1, z: p.z, count: 16, colors: [0xc04cff, 0xff6aa8], speed: [1, 3], life: 0.6, size: [0.35, 0], flat: true });
  shock(scene, tweens, p, 0xc04cff, 1.8 * sc, 0.5);
  tweens.add(0.8, (k) => { p.y = y0 * (1 - (1 - (1 - k) ** 3)); }, () => {
    p.y = 0;
    if (e.alive) e.state = 'chase';
  });
}

function updateEnemies(dt) {
  const hp = G.hero.root.position;
  for (const e of G.enemies) {
    e.a.mixer.update(dt * (e.slow > G.now ? 0.5 : 1));
    e.a.model.traverse((m) => { if (m.userData.flash && G.now > m.userData.flash) { m.material.emissive.setRGB(0, 0, 0); m.userData.flash = 0; } });
    if (!e.alive) continue;
    const p = e.root.position, d = Math.hypot(hp.x - p.x, hp.z - p.z);
    const def = e.def, sc = def.scale || 1;
    if (e.state === 'dormant') {
      const hc = cellCh(hp.x, hp.z);
      if (d < 9 && G.state !== 'dead' && (hc === 'h' || (hc === '.' && hp.z < 16))) after(rnd() * 0.5, () => { if (e.state === 'dormant') awaken(e); });
      continue;
    }
    if (e.state === 'idle') {
      const hc = cellCh(hp.x, hp.z);
      if (d < 11 && G.state !== 'dead' && (hc === 'c' || (hc === '.' && hp.z > 20))) {
        e.state = 'taunt'; faceTo(e.root, hp);
        if (def.boss) { UI.boss(e); UI.banner(def.name, 'Trùm xuất hiện'); G.shake = 0.35; }
        const dur = e.a.play('Jump', { once: true, speed: 0.8, onDone: () => { if (e.alive) e.state = 'chase'; } });
        if (def.boss) after(dur * 0.75, () => { shock(scene, tweens, p, 0xff6a3a, 5, 0.5); G.shake = 0.45; dust.emit({ x: p.x, y: 0.2, z: p.z, count: 30, colors: [0x5a5048, 0x766a5e], speed: [2, 5], life: 1, size: [1.2, 0.3], alpha: 0.5, flat: true }); });
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
    const range = def.range;
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
      e.a.play(def.run, { speed: def.runSpd || 1 });
    } else if (G.now > e.atkReady) {
      e.state = 'attack'; faceTo(e.root, hp);
      const dur = e.a.play(def.atk, { once: true, speed: def.boss ? 0.85 : 1.1, fade: 0.1, onDone: () => { if (e.alive) e.state = 'chase'; } });
      e.atkReady = G.now + def.cd;
      if (def.boss) telegraph(scene, tweens, p.clone().add(fwdOf(e.root.rotation.y).multiplyScalar(1.9)), 2.9, dur * def.hitT);
      after(dur * def.hitT, () => {
        if (!e.alive || e.state !== 'attack') return;
        const q = G.hero.root.position, fwd = fwdOf(e.root.rotation.y);
        if (def.ranged) {
          const dir = new THREE.Vector3(q.x - p.x, 0, q.z - p.z).normalize();
          fireBolt(p.clone().addScaledVector(dir, 0.8).setY(1.5), dir, 'enemy', rint(def.dmg[0], def.dmg[1]), 0x6a8bff);
        } else {
          const v = new THREE.Vector3(q.x - p.x, 0, q.z - p.z), dd = v.length();
          if (def.boss) { shock(scene, tweens, p.clone().addScaledVector(fwd, 1.9), 0xff6a3a, 3, 0.35); G.shake = 0.35; dust.emit({ x: p.x + fwd.x * 1.9, y: 0.2, z: p.z + fwd.z * 1.9, count: 20, colors: [0x5a5048, 0x766a5e], speed: [2, 4], life: 0.9, size: [1, 0.3], alpha: 0.5, flat: true }); }
          if (dd < range + 0.9 && v.normalize().dot(fwd) > 0.1) hurtHero(rint(def.dmg[0], def.dmg[1]) + e.lvl);
        }
      });
    } else {
      faceTo(e.root, hp);
      if (e.a.curName !== 'Idle') e.a.play('Idle');
    }
  }
}

function updateWorld(dt, t) {
  const hp = G.hero.root.position;
  // fade tường/cột/cổng đứng giữa camera và nhân vật
  for (const w of G.walls) {
    const dz = w.position.z - hp.z, dx = Math.abs(w.position.x - hp.x);
    const hide = dz > 0.3 && dz < (w.userData.fz || 7.5) && dx < (w.userData.fx || 3.6);
    const target = hide ? 0.12 : 1;
    if (Math.abs(w.userData.op - target) > 0.01) {
      w.userData.op = damp(w.userData.op, target, 12, dt);
      if (Math.abs(w.userData.op - target) < 0.02) w.userData.op = target;
      for (const m of w.userData.mats) { m.transparent = w.userData.op < 1; m.opacity = w.userData.op; m.depthWrite = w.userData.op > 0.9; }
    }
  }
  // light pool: LIGHTS.length đèn thật gán cho nguồn sáng gần hero nhất; nguồn sắp bị loại mờ dần -> không "pop"
  for (const T of G.torches) T.d = Math.hypot(T.lp.x - camLook.x, T.lp.z - camLook.z);
  const byDist = G.torches.slice().sort((a, b) => a.d - b.d);
  const cut = byDist[LIGHTS.length]?.d ?? 1e9;
  LIGHTS.forEach((L, i) => {
    const T = byDist[i];
    if (!T) { L.intensity = 0; return; }
    const f = 0.82 + Math.sin(t * 9 + T.ph) * 0.08 + Math.sin(t * 23 + T.ph * 2) * 0.06 + rnd() * 0.05;
    L.position.copy(T.lp); L.color.setHex(T.color); L.distance = T.dist;
    L.intensity = T.base * f * Math.min(1, (cut - T.d) / 4);
  });
  // lửa chập chờn (particle)
  for (const T of G.torches) {
    if (T.d > 30) continue;
    if (T.candle) { if (rnd() < 0.5) glow.emit({ x: T.x, y: T.y, z: T.z, count: 1, color: 0xffc070, speed: [0.05, 0.2], dir: new THREE.Vector3(0, 1, 0), life: 0.3, size: [0.16, 0.04], spread: 0.03, drag: 0.5 }); continue; }
    const p = rnd() < (T.fire ? 0.95 : 0.6);
    if (p) glow.emit({ x: T.x, y: T.y, z: T.z, count: T.fire ? 2 : 1, colors: T.warm ? [0xff9a3a, 0xff6a1a, 0xffc060] : [0xc9a0ff, 0x9b5cff, 0xe6d4ff], speed: [0.2, 0.7], dir: new THREE.Vector3(0, 1.4, 0), life: T.fire ? 0.7 : 0.55, size: [T.fire ? 0.55 : 0.42, 0.05], spread: T.fire ? 0.45 : 0.18, drag: 0.5 });
    // tàn lửa bay lên (ember)
    if (rnd() < (T.fire ? 0.25 : 0.05)) glow.emit({ x: T.x, y: T.y + 0.3, z: T.z, count: 1, color: 0xffa040, speed: [0.6, 1.4], dir: new THREE.Vector3(0, 2.5, 0), life: 1.6, size: [0.09, 0.03], spread: 0.3, drag: 0.2 });
  }
  if (rnd() < 0.25) glow.emit({ x: hp.x + (rnd() - 0.5) * 16, y: 0.5 + rnd() * 3, z: hp.z + (rnd() - 0.5) * 12, count: 1, color: 0xffe2b0, speed: [0.05, 0.25], life: 4, size: [0.09, 0.04], alpha: 0.5, drag: 0 });
  // loot
  for (const o of G.loot.slice()) {
    o.holder.rotation.y += dt * 1.6;
    o.holder.position.y = 0.75 + Math.sin(t * 2.4 + o.it.id) * 0.12;
    const b = o.beam.userData.beam;
    if (b) b.material.uniforms.uA.value = 0.65 + Math.sin(t * 3 + o.it.id) * 0.3;
    if (o.ready && Math.hypot(o.g.position.x - hp.x, o.g.position.z - hp.z) < 1.4) pickup(o);
  }
  for (const ch of G.chests) if (!ch.opened && ch.obj.position.distanceTo(hp) < 2.4) openChest(ch);
  // NPC gần
  let near = null;
  for (const n of G.npcs) { n.a.mixer.update(dt); if (n.root.position.distanceTo(hp) < 3.2) near = n; }
  G.nearNpc = near;
  $('#talk').hidden = !near || UI.busy || G.state === 'dead';
  G.elara.marker.el.textContent = S.quest === 2 ? '?' : '!';
  G.elara.marker.el.hidden = !(S.quest === 0 || S.quest === 2);
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
  // màn dọc: lùi + nâng camera để thấy đủ phòng theo chiều ngang hẹp
  const aspect = innerWidth / innerHeight;
  const k = aspect < 1 ? Math.min(1.7, 1 / aspect * 0.85) : 1;
  camOff.set(0, 15 * k, 11 * k);
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
  // đèn hero: phía trước-trên (phía camera) để soi mặt, rim lạnh phía sau lưng
  heroLight.position.set(hp.x, 3.6, hp.z + 1.6);
  heroRim.position.set(hp.x - 0.6, 2.4, hp.z - 1.6);
}

// ---------- loop ----------
const clock = new THREE.Clock();
let uiT = 0, mmT = 0;
function frame() {
  requestAnimationFrame(frame);
  const raw = clock.getDelta();
  const t0 = performance.now();
  quality(raw);
  // chặn dt ở 1/12 s (trước là 1/20): máy chậm thì game vẫn chạy đúng tốc độ, không bị "slow motion" giật cục
  let dt = Math.min(raw, G.fast ? 0.2 : 1 / 12); // G.fast: chỉ dùng khi test headless
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
  const t1 = performance.now();
  grade.uniforms.uTime.value = t;
  renderer.shadowMap.needsUpdate = true; // mọi frame: cập nhật cách frame làm nhịp frame lệch (frame nặng/nhẹ xen kẽ = giật)
  composer.render();
  const t2 = performance.now();
  UI.update(camera, innerWidth, innerHeight, dt);
  if ((uiT += dt) > 0.15) { uiT = 0; UI.vitals(G.ST); UI.cooldowns(G.cd, G.now, S.mp >= (G.ST.powers.freeSkill ? 0 : 20)); }
  if ((mmT += dt) > 0.25) { mmT = 0; UI.minimap(G); }
  if (DEBUG) (G.prof ||= []).push([raw * 1000, t1 - t0, t2 - t1, performance.now() - t2]);
}

// ---------- quality tự thích ứng ----------
// tier 0: đủ hiệu ứng · 1: tắt AO · 2: render 80% độ phân giải · 3: 67% + tắt bloom
// UI là HTML nên vẫn nét; FXAA làm mượt cạnh khi hạ độ phân giải. Chỉ hạ, không tự nâng (tránh dao động).
const TIERS = [{ ao: true, rs: 1, bloom: true }, { ao: false, rs: 1, bloom: true }, { ao: false, rs: 0.8, bloom: true }, { ao: false, rs: 0.67, bloom: false }];
const BASE_PR = Math.min(devicePixelRatio || 1, 2);
const Q = { tier: 0, acc: 0, n: 0, skip: 0 };
function setTier(n) {
  Q.tier = Math.max(0, Math.min(TIERS.length - 1, n));
  const T = TIERS[Q.tier];
  ao.enabled = T.ao; plain.enabled = !T.ao; bloom.enabled = T.bloom;
  PR = BASE_PR * T.rs;
  renderer.setPixelRatio(PR);
  onResize();
  Q.acc = Q.n = 0; Q.skip = 20; // bỏ vài frame đầu sau khi đổi (resize render target)
}
G.setTier = setTier;
function quality(raw) {
  if (HQ || Q.lock || Q.tier >= TIERS.length - 1) return;
  if (Q.skip > 0) { Q.skip--; return; }
  if (raw > 0.25) return; // tab vừa quay lại / hitch lẻ, không tính
  Q.acc += raw; Q.n++;
  if (Q.acc < 2) return; // đo theo cửa sổ 2 giây
  const avg = Q.acc / Q.n;
  Q.acc = Q.n = 0;
  if (avg > 1 / 45) setTier(Q.tier + 1); // dưới ~45 FPS thì hạ 1 bậc
}

function onResize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setPixelRatio(PR); composer.setSize(w, h);
  grade.uniforms.uAspect.value = w / h;
  fxaa.material.uniforms.resolution.value.set(1 / (w * PR), 1 / (h * PR));
  glow.mat.uniforms.uScale.value = dust.mat.uniforms.uScale.value = h * PR * 0.9;
  joyHome();
}
addEventListener('resize', onResize);

// ---------- boot ----------
function showErr(m) { const e = document.createElement('div'); e.id = 'err'; e.textContent = m; document.body.appendChild(e); }
addEventListener('error', (e) => showErr(String(e.message || e)));
addEventListener('unhandledrejection', (e) => showErr(String(e.reason?.message || e.reason)));

async function boot() {
  await loadAll((k) => { const v = Math.round(k * 100); $('#ld-fill').style.width = `${v}%`; $('#ld-txt').textContent = `Đang tải mô hình 3D… ${v}%`; });
  $('#ld-txt').textContent = 'Dựng hầm ngục…';
  await new Promise((r) => requestAnimationFrame(r));
  buildThumbs();
  UI.init(G);
  buildWorld();
  setupNpcs();
  for (const [type, x, z] of [['orc', 28.5, 8], ['brute', 35, 12.5], ['ninja', 45, 13], ['caster', 39, 16], ['orc', 40, 21], ['ninja', 27.5, 19.5], ['caster', 45.5, 18], ['brute', 31, 21.5]]) spawnEnemy(type, x, z, { dormant: true, room: 'h', lvl: 2 });
  G.hallTotal = G.hallLeft();
  spawnEnemy('boss', 12, 26, { rot: 0, room: 'c', lvl: 4 });
  G.ST = stats(); S.hp = G.ST.maxHp; S.mp = G.ST.maxMp;
  UI.heroButtons(Object.values(HEROES));
  spawnHero('Warrior', SPAWN, Math.PI * 0.85);
  // vài món mẫu dưới sàn quán để xem hiệu ứng độ hiếm
  [0, 1, 2, 3].forEach((rar, i) => {
    const it = rollItem(2, { rarity: rar, kind: rar === 0 ? 'shield' : 'weapon' });
    const to = new THREE.Vector3(7 + i * 2.2, 0, 6);
    after(0.6 + i * 0.25, () => dropItem(it, to.clone().setY(1.5), to));
  });
  camLook.copy(G.hero.root.position);
  // compile sẵn shader VFX (lần đầu tung skill không bị khựng): bắn 1 lượt dưới sàn rồi compile cả cảnh
  const far = new THREE.Vector3(SPAWN.x, -3, SPAWN.z);
  shock(scene, tweens, far, 0xffffff, 1, 0.05, -3); slash(scene, tweens, far, 0); telegraph(scene, tweens, far, 1, 0.05);
  renderer.compile(scene, camera);
  // tier khởi đầu: ?tier=N ép; GPU tích hợp / máy cảm ứng bắt đầu từ tier 1 (khỏi giật 2 giây đầu)
  const qp = new URLSearchParams(location.search).get('tier');
  const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
  G.gpu = gpu; Q.lock = qp != null;
  setTier(qp != null ? +qp : HQ ? 0 : isTouch || /Intel|UHD|Iris|Mali|Adreno|PowerVR|Apple GPU|SwiftShader/i.test(gpu) ? 1 : 0);
  onResize();
  UI.vitals(G.ST); UI.quest();
  $('#loading').hidden = true;
  clock.start();
  frame();
}
boot().catch((e) => { console.error(e); showErr('Lỗi khởi động: ' + (e.message || e)); });
