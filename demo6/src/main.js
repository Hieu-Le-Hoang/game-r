import './style.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadAll, inst, anims, makeThumbs, weaponForHand, takeVrm, peekVrm, toon, VRM_SCALE } from './assets.js';
import { Tweens, Particles, lootBeam, shock, slash, telegraph, orb, arrow } from './fx.js';
import { UI } from './ui.js';
import { S, stats, xpNeed, rollItem, potion, RAR, LEGEND } from './items.js';

const $ = (s) => document.querySelector(s);
const rnd = Math.random;
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
const angLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
const DEBUG = new URLSearchParams(location.search).has('debug');

// ---------- map: mỗi ô = 4 đơn vị = 2x2 module Quaternius (module 2 đơn vị) ----------
const C = 4;
const WALL_H = 4, CUT_H = 1.1; // tường thường cao 2 module; tường phía nam cắt thấp (cutaway)
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
  t: ['Quán Trọ Hoa Anh Đào', 'Khu an toàn'],
  h: ['Thánh Đường Hắc Giáo', 'Cẩn thận phía trước'],
  c: ['Ngai Ma Nữ', 'Trùm cuối'],
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
// anime: Neutral giữ màu tươi (ACES làm xỉn da/tóc MToon)
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
$('#app').appendChild(renderer.domElement);

// trời ban ngày: sương xanh nhạt thay cho bóng tối
const FOG = 0xbfe0f5, GROUND = 0x6f9f5a;
const scene = new THREE.Scene();
scene.background = new THREE.Color(FOG);
scene.fog = new THREE.Fog(FOG, 30, 70);
const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 200);

const rt = new THREE.WebGLRenderTarget(innerWidth * PR, innerHeight * PR, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.4, 0.45, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- lights ----------
scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x8c7a5c, 1.6));
const moon = new THREE.DirectionalLight(0xfff0d8, 2.6); // nắng chiều
moon.castShadow = true;
moon.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
Object.assign(moon.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 70 });
moon.shadow.bias = -0.0004;
moon.shadow.normalBias = 0.03;
scene.add(moon, moon.target);

const tweens = new Tweens();
const glow = new Particles(scene, 2500, true);
const dust = new Particles(scene, 800, false);

// ---------- hero / enemy defs (avatar VRoid, tên animation theo Quaternius UAL) ----------
const HEROES = {
  Warrior: {
    key: 'Warrior', av: 'sakura', name: 'Kiếm Sĩ Fumiya', style: 'melee', idle: 'Sword_Idle', run: 'Jog_Fwd_Loop',
    atk: ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C'], skill: 'Sword_Regular_Combo', skillName: 'Liên Trảm',
    atkIcon: 'w:sword', skillIcon: 'Sword_WallMount', weapon: 'sword',
  },
  Wizard: {
    key: 'Wizard', av: 'bibi', name: 'Pháp Sư Bibi', style: 'magic', idle: 'Idle_Loop', run: 'Jog_Fwd_Loop',
    atk: ['Spell_Simple_Shoot'], skill: 'Spell_Simple_Enter', skillName: 'Nova Băng',
    atkIcon: 'w:staff', skillIcon: 'm_Book_Open', weapon: 'staff',
  },
  Ranger: {
    key: 'Ranger', av: 'vita', name: 'Xạ Thủ Vita', style: 'bow', idle: 'Idle_Loop', run: 'Jog_Fwd_Loop',
    atk: ['Pistol_Shoot'], skill: 'OverhandThrow', skillName: 'Mưa Tên',
    atkIcon: 'w:bow', skillIcon: 'Spikes', weapon: 'bow',
  },
};

// kẻ địch: cùng 1 avatar D_Darkness, đổi màu áo + vũ khí + dáng đánh
const FOE = { av: 'dark', idle: 'Sword_Idle', hit: 'Hit_Chest', death: 'Death01', rise: 'LayToIdle', taunt: 'Spell_Simple_Enter' };
const ENEMIES = {
  orc: { ...FOE, name: 'Giáo Đồ Kiếm', tint: 0xffb4b4, weapon: 'sword', hp: 34, dmg: [4, 7], spd: 3.4, range: 1.8, atk: 'Sword_Regular_A', hitT: 0.4, cd: 1.3, xp: 9, run: 'Jog_Fwd_Loop' },
  ninja: { ...FOE, name: 'Sát Thủ Bóng Đêm', tint: 0xb9a4ff, weapon: 'dagger', hp: 26, dmg: [3, 6], spd: 4.4, range: 1.6, atk: 'Sword_Regular_B', hitT: 0.35, cd: 1.0, xp: 8, run: 'Sprint_Loop', runSpd: 0.9 },
  brute: { ...FOE, name: 'Hắc Kỵ Sĩ', tint: 0x8a8a9a, weapon: 'sword', hp: 64, dmg: [6, 10], spd: 2.9, range: 2.0, atk: 'Sword_Attack', hitT: 0.45, cd: 1.6, xp: 15, run: 'Walk_Loop', runSpd: 1.4, scale: 1.15 },
  caster: { ...FOE, name: 'Pháp Sư Lam', tint: 0x9cc8ff, weapon: 'staff', idle: 'Idle_Loop', hp: 40, dmg: [7, 11], spd: 2.6, range: 8, atk: 'Spell_Simple_Shoot', hitT: 0.4, cd: 2.2, xp: 16, ranged: true, run: 'Walk_Loop', runSpd: 1.3 },
  boss: { ...FOE, name: 'Ma Nữ Azura', tint: 0xffd6f0, weapon: 'holy', hp: 520, dmg: [12, 18], spd: 2.7, range: 3.0, atk: 'Sword_Attack', hitT: 0.45, cd: 2.0, xp: 150, scale: 1.8, boss: true, run: 'Walk_Loop', runSpd: 1.2 },
};

// ---------- actor (VRM) ----------
class Actor {
  constructor(av, scale = 1) {
    this.key = av;
    this.vrm = takeVrm(av);
    this.root = new THREE.Group();
    this.model = new THREE.Group();
    this.model.add(this.vrm.scene);
    this.model.scale.setScalar(VRM_SCALE * scale);
    this.root.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.vrm.scene);
    this.clips = anims(av);
    this.actions = {};
    this.cur = null; this.curName = '';
    this.onDone = null;
    this.blinkAt = rnd() * 3; this.mood = null;
    this.mixer.addEventListener('finished', (e) => {
      if (e.action === this.cur && this.onDone) { const f = this.onDone; this.onDone = null; f(); }
    });
    scene.add(this.root);
  }
  // biểu cảm: chớp mắt ngẫu nhiên + 1 cảm xúc tạm thời (angry khi đánh, sorrow khi trúng đòn...)
  face(name, w = 1, dur = 0.6) {
    const em = this.vrm.expressionManager;
    if (!em) return;
    if (this.mood && this.mood.name !== name) em.setValue(this.mood.name, 0);
    this.mood = { name, w, until: G.now + dur };
  }
  update(dt, full = true) {
    this.mixer.update(dt);
    // ngoài khung hình (cullActors): chỉ chép pose cho vũ khí/đạn vẫn bám tay, bỏ spring bone + biểu cảm
    if (!this.model.visible) { this.vrm.humanoid.update(); return; }
    const em = this.vrm.expressionManager;
    if (em) {
      const t = G.now - this.blinkAt;
      em.setValue('blink', t > 0 && t < 0.14 ? Math.sin((t / 0.14) * Math.PI) : 0);
      if (t >= 0.14) this.blinkAt = G.now + 1.8 + rnd() * 3.2;
      if (this.mood) {
        const left = this.mood.until - G.now;
        em.setValue(this.mood.name, Math.max(0, Math.min(1, left * 6)) * this.mood.w);
        if (left <= 0) this.mood = null;
      }
    }
    // xa camera: bỏ spring bone (tóc/váy) cho nhẹ, vẫn chép pose + biểu cảm
    if (full) this.vrm.update(dt);
    else { this.vrm.humanoid.update(); em?.update(); }
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
  // vũ khí trên tay (gỡ cái cũ trước)
  hold(id) {
    if (this.wpn) { this.wpn.parent?.remove(this.wpn); this.wpn = null; }
    this.wpn = id ? weaponForHand(id, this.vrm) : null;
  }
  dispose() { this.mixer.stopAllAction(); scene.remove(this.root); }
  show(v) {
    if (v === this.model.visible) return;
    this.model.visible = v;
    if (v) this.vrm.springBoneManager?.reset(); // tóc/váy đứng yên lâu -> đặt lại, tránh giật
  }
}

// Mesh VRM tắt frustumCulled (bounding của skinned mesh không chạy theo animation) -> cull cả nhân vật
// bằng 1 hình cầu quanh root. Trước đây quái ở sảnh vẫn vẽ (cả bóng + outline) khi đang đứng trong quán.
const frustum = new THREE.Frustum(), _pv = new THREE.Matrix4(), _sph = new THREE.Sphere();
function cullActors() {
  camera.updateMatrixWorld();
  frustum.setFromProjectionMatrix(_pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const test = (a) => {
    const s = a.model.scale.x / VRM_SCALE;
    _sph.center.copy(a.root.position); _sph.center.y += 1.2 * s;
    _sph.radius = 3 * s; // gồm vũ khí + bóng đổ lệch ra ngoài
    a.show(frustum.intersectsSphere(_sph));
  };
  test(G.hero);
  for (const e of G.enemies) if (e.root.parent) test(e.a);
  for (const n of G.npcs) test(n.a);
}

// ---------- game ----------
const G = {
  C, MAP, ST: stats(), xpNeed, enemies: [], npcs: [], chests: [], loot: [], bolts: [], walls: [], colliders: [], timers: [], torches: [],
  seen: new Set(), keys: {}, cd: { q: 0, e: 0, r: 0 }, now: 0, shake: 0, hallTotal: 0, area: '',
  hero: null, def: null, state: 'idle', target: null, goal: null, atkReady: 0, invuln: 0, dashV: null, joy: null,
};
window.__G = G;
if (DEBUG) Object.assign(G, { scene, camera, renderer, composer, bloom });

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
// đặt vật vừa khít kích thước (asset Quaternius có pivot/tỉ lệ không đồng nhất)
function fit(o, s) {
  const b = new THREE.Box3().setFromObject(o), v = b.getSize(new THREE.Vector3());
  o.scale.multiplyScalar(s / Math.max(v.x, v.y, v.z));
  return o;
}

// Gộp mesh tĩnh: màu vật liệu -> vertex color, gộp thành 1 geometry = 1 draw call
// (Modular Dungeon toàn màu phẳng, không texture nên gộp được không mất gì)
const bakeMat = toon({ vertexColors: true, color: new THREE.Color(0xffffff) });
function bakeGeoms(objs, origin) {
  const inv = new THREE.Matrix4().copy(origin?.matrixWorld || new THREE.Matrix4()).invert();
  const out = [];
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (const o of objs) {
    o.updateMatrixWorld(true);
    o.traverse((m) => {
      if (!m.isMesh || !m.visible) return;
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      // bỏ quantization (int16) để transform không bị tràn số
      const ng = new THREE.BufferGeometry();
      for (const name of ['position', 'normal']) {
        const a = g.getAttribute(name);
        const arr = new Float32Array(a.count * 3);
        for (let i = 0; i < a.count; i++) { arr[i * 3] = a.getX(i); arr[i * 3 + 1] = a.getY(i); arr[i * 3 + 2] = a.getZ(i); }
        ng.setAttribute(name, new THREE.BufferAttribute(arr, 3));
      }
      const n = ng.getAttribute('position').count, c = new Float32Array(n * 3);
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const groups = g.groups.length ? g.groups : [{ start: 0, count: n, materialIndex: 0 }];
      for (const gr of groups) {
        col.copy(mats[gr.materialIndex || 0]?.color || col.set(0x888888));
        for (let i = gr.start; i < Math.min(n, gr.start + gr.count); i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
      }
      ng.setAttribute('color', new THREE.BufferAttribute(c, 3));
      m4.multiplyMatrices(inv, m.matrixWorld);
      ng.applyMatrix4(m4);
      out.push(ng);
      g.dispose();
    });
  }
  return out;
}
function bake(objs, opt = {}) {
  const geo = mergeGeometries(bakeGeoms(objs, opt.origin));
  const mesh = new THREE.Mesh(geo, opt.mat || bakeMat);
  mesh.castShadow = opt.cast ?? true; mesh.receiveShadow = true;
  return mesh;
}

// thảm cỏ phủ trên đỉnh khối tường -> phế tích giữa đồng cỏ thay cho hầm tối
const GRASS = [0x7fb85c, 0x93c766, 0x6aa653, 0xa5cf6e].map((h) => new THREE.Color(h));
function rockGeo(x, z, y) {
  const g = new THREE.PlaneGeometry(C, C, 4, 4);
  g.rotateX(-Math.PI / 2);
  const p = g.getAttribute('position'), c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    p.setY(i, (rnd() - 0.5) * 0.18);
    GRASS[Math.floor(rnd() * GRASS.length)].toArray(c, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.translate(x, y, z);
  g.computeVertexNormals();
  return g;
}

function buildWorld() {
  const rows = MAP.length, cols = MAP[0].length;
  const fl = (q, r) => { const ch = MAP[r]?.[q]; return !!ch && ch !== '#'; };
  const temp = [];
  const tmp = (key, x, y, z, rot = 0, sy = 1) => { const o = inst(key); o.position.set(x, y, z); o.rotation.y = rot; o.scale.y = sy; temp.push(o); return o; };

  // sàn: 4 tấm 2x2 mỗi ô, xoay ngẫu nhiên cho đỡ lặp
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    if (!fl(q, r)) continue;
    for (const dx of [1, 3]) for (const dz of [1, 3]) tmp('Floor_Modular', q * C + dx, -0.25, r * C + dz, Math.floor(rnd() * 4) * Math.PI / 2);
  }
  const floor = bake(temp.splice(0), { cast: false });
  scene.add(floor);

  // khối đá ngoài phòng
  const rocks = [];
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    if (fl(q, r)) continue;
    let near = false;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (fl(q + a, r + b)) near = true;
    if (!near) continue;
    rocks.push(rockGeo(q * C + 2, r * C + 2, fl(q, r - 1) ? CUT_H + 0.4 : WALL_H + 0.42));
  }
  const rockMesh = new THREE.Mesh(mergeGeometries(rocks), toon({ vertexColors: true, color: new THREE.Color(0xffffff) }));
  rockMesh.receiveShadow = true;
  scene.add(rockMesh);
  // đồng cỏ xa dưới chân, mờ dần vào sương trời
  const under = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: GROUND }));
  under.rotation.x = -Math.PI / 2; under.position.y = -0.6;
  scene.add(under);

  // tường: mỗi cạnh ô = 1 nhóm gộp (1 draw call), có material riêng để fade khi che nhân vật
  const edge = (x, z, rot, cut) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g); g.updateMatrixWorld(true);
    const parts = [];
    for (const dx of [-1, 1]) {
      const add = (key, y, sy = 1) => { const o = inst(key); o.position.set(dx, y, 0); o.scale.y = sy; g.add(o); parts.push(o); };
      if (cut) add('Wall_Modular', 0, CUT_H / 2);
      else { add('Wall_Modular', 0); add('Wall_Modular', 2); }
      add('WallCover_Modular', cut ? CUT_H : WALL_H);
    }
    const mesh = bake(parts, { origin: g, mat: bakeMat.clone() });
    for (const p of parts) g.remove(p);
    g.add(mesh);
    g.userData.mats = [mesh.material];
    g.userData.op = 1;
    G.walls.push(g);
    return g;
  };
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    if (!fl(q, r)) continue;
    const cx = q * C + 2, cz = r * C + 2;
    if (!fl(q, r - 1)) edge(cx, r * C, 0, false);
    if (!fl(q, r + 1)) edge(cx, r * C + C, Math.PI, true); // tường phía nam: cắt thấp kiểu Diablo
    if (!fl(q - 1, r)) edge(q * C, cz, Math.PI / 2, false);
    if (!fl(q + 1, r)) edge(q * C + C, cz, -Math.PI / 2, false);
  }
  // cột ở góc tường (góc giáp tường cắt thì cột cũng thấp)
  const H = (q, r) => fl(q, r) !== fl(q, r - 1);
  const V = (q, r) => fl(q, r) !== fl(q - 1, r);
  const cutH = (q, r) => fl(q, r - 1) && !fl(q, r);
  for (let r = 0; r <= rows; r++) for (let q = 0; q <= cols; q++) {
    const h = H(q - 1, r) || H(q, r), v = V(q, r - 1) || V(q, r);
    if (!(h && v)) continue;
    const low = cutH(q - 1, r) || cutH(q, r);
    const g = new THREE.Group(); g.position.set(q * C, 0, r * C); scene.add(g); g.updateMatrixWorld(true);
    const col = inst('Column'); col.scale.set(0.75, low ? (CUT_H + 0.45) / 4.07 : 1.06, 0.75); g.add(col);
    const mesh = bake([col], { origin: g, mat: bakeMat.clone() });
    g.remove(col); g.add(mesh);
    g.userData.mats = [mesh.material]; g.userData.op = 1;
    G.walls.push(g);
  }
  for (const [x, z, rot] of DOORS) {
    const a = place('Arch', x, z, rot);
    a.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; } });
    a.userData.mats = []; a.traverse((m) => m.isMesh && a.userData.mats.push(m.material)); a.userData.op = 1;
    G.walls.push(a);
    G.colliders.push({ x, z: z - 1.75, r: 0.55 }, { x, z: z + 1.75, r: 0.55 });
  }

  // đuốc + đèn (tối đa 8 point light)
  const torch = (x, z, nx, nz, color = 0xff8a3c, dist = 12) => {
    const o = place('Torch', x + nx * 0.32, z + nz * 0.32, Math.atan2(nx, nz), 1.9);
    const top = new THREE.Box3().setFromObject(o).max.y;
    const fx = x + nx * 0.5, fz = z + nz * 0.5, fy = top + 0.15;
    const warm = color === 0xff8a3c;
    const L = new THREE.PointLight(color, warm ? 12 : 14, dist, 1.7);
    L.position.set(fx + nx * 0.3, fy, fz + nz * 0.3);
    scene.add(L);
    G.torches.push({ L, x: fx, y: fy, z: fz, color, base: L.intensity, ph: rnd() * 10, warm });
  };
  torch(7, 4, 0, 1); torch(15, 4, 0, 1);
  torch(30, 4, 0, 1); torch(42, 4, 0, 1); torch(24, 17, 1, 0); torch(48, 14, -1, 0);
  torch(8, 20, 0, 1, 0xc04cff, 10); torch(16, 20, 0, 1, 0xc04cff, 10);

  // --- quán trọ ---
  place('Banner_wall', 11, 4.35, 0, 1.2);
  const fire = place('Woodfire', 5.6, 6.2, 0.3, 0, { r: 0.7 });
  const FL = new THREE.PointLight(0xff9a4a, 12, 9, 1.8); FL.position.set(5.6, 1.2, 6.2); scene.add(FL);
  G.torches.push({ L: FL, x: 5.6, y: 0.7, z: 6.2, color: 0xff8a3c, base: 12, ph: 3, warm: true, fire: fire });
  place('Table_Big', 11, 9.8, Math.PI / 2, 0); G.colliders.push({ x: 9.6, z: 9.8, r: 1.0 }, { x: 12.4, z: 9.8, r: 1.0 });
  place('Chair', 9.4, 8.4, 0, 0, { r: 0.35 }); place('Chair', 12.6, 8.4, 0.2, 0, { r: 0.35 }); place('Chair', 12.2, 11.3, Math.PI, 0, { r: 0.35 });
  place('m_Candelabrum', 11.4, 9.7, 0, 0.85); place('m_Book_Open', 10.2, 9.9, 0.4, 0.85, { scale: 0.6 });
  place('Barrel', 18.4, 5.6, 0, 0, { r: 0.6 }); place('Barrel2', 17.2, 5.4, 0.6, 0, { r: 0.6 }); place('Barrel', 18.2, 6.8, 1, 0, { r: 0.6 });
  place('Crate', 18.3, 14.6, 0.2, 0, { r: 0.8 }); place('Crate', 18.3, 14.6, 0.9, 1.31, { scale: 0.8 });
  place('Bucket', 16.7, 14.9, 0, 0); place('Vase', 5.2, 14.6, 0, 0, { r: 0.3 }); place('Vase', 5.9, 15.0, 1, 0);
  place('m_Carpet', 11, 13.6, Math.PI / 2, 0.01);
  place('m_Candelabrum_tall', 14.6, 4.9, 0, 0, { r: 0.4 });
  // --- đại sảnh ---
  for (const [x, z] of [[30, 10], [42, 10], [30, 18], [42, 18]]) place('Column2', x, z, 0, 0, { r: 0.75 });
  place('Statue_Horse', 36, 6.4, 0, 0, { r: 1.6, scale: 0.85 });
  place('Banner', 26.5, 4.5, 0, 0); place('Banner', 45.5, 4.5, 0, 0);
  place('Cobweb', 25.2, 4.6, 0.6, 3.0); place('Cobweb2', 46.8, 4.6, -0.6, 3.0);
  place('Crate', 46.4, 6.4, 0.3, 0, { r: 0.8 }); place('Barrel2', 25.8, 6.5, 0, 0, { r: 0.6 });
  place('m_Bones', 33, 21.5, 0.4, 0); place('Skull', 39.5, 15.2, 2.2, 0); place('m_Column_Broken', 46.2, 21.4, 0.8, 0, { r: 1 });
  place('Trap_empty', 36, 14, 0, 0.01); place('m_Bones2', 26.6, 13.5, 1.2, 0);
  place('Bag_Coins', 44.6, 9.4, 0.4, 0, { scale: 1.6 });
  // --- ngai quỷ vương ---
  place('Banner', 12, 20.6, 0, 0); place('m_Bars', 4.4, 25.5, 0, 0);
  place('Pedestal2', 5.8, 30.2, 0, 0, { r: 0.9, scale: 0.6 }); place('Pedestal2', 18.2, 30.2, 0, 0, { r: 0.9, scale: 0.6 });
  place('m_Candelabrum_tall', 5.8, 21.5, 0, 0, { r: 0.4 }); place('m_Candelabrum_tall', 18.2, 21.5, 0, 0, { r: 0.4 });
  place('m_Bones', 15.6, 30.4, 1.2, 0); place('Skull', 7.6, 27.4, 0.5, 0); place('Skull', 16.8, 24.4, 2.5, 0);
  for (const [x, z] of [[6.2, 26.5], [17.4, 26.8], [9.5, 30.8]]) place('Coin_Pile', x, z, rnd() * 6, 0, { scale: 4 });
  place('m_Column_Broken2', 18, 25, 0, 0, { r: 0.8 }); place('Column2', 6, 25, 0, 0, { r: 0.7 });

  // rương: nắp là node riêng -> bọc vào pivot đặt ở bản lề
  const chest = (key, x, z, rot, boost, n) => {
    const obj = place(key, x, z, rot, 0, { r: 1 });
    let lid = null;
    obj.traverse((o) => { if (!lid && /Top/i.test(o.name) && o.isMesh) lid = o; });
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
  chest('Chest', 36, 9.6, 0, 10, 3);
  chest('Chest_Gold', 12, 30.4, Math.PI, 30, 4);
}

// ---------- thumbnails ----------
async function buildThumbs() {
  const list = [];
  for (const k of ['w:sword', 'w:dagger', 'w:staff', 'w:holy', 'w:bow']) {
    const o = inst(k); o.rotation.z = -Math.PI / 4;
    list.push({ id: k, obj: o, dir: new THREE.Vector3(0.2, 0.2, 1) });
  }
  for (const k of ['m_Book2', 'Skull', 'Bag_Standing', 'm_Potion2', 'Sword_WallMount', 'm_Book_Open', 'Spikes']) list.push({ id: k, obj: inst(k), dir: new THREE.Vector3(0.4, 0.5, 1) });
  // chân dung: dùng chính instance VRM sẽ vào game, tạo dáng đứng rồi chụp mặt
  const cleanup = [];
  const faces = { Warrior: 'sakura', Wizard: 'bibi', Ranger: 'vita', victoria: 'victoria', shino: 'shino', shibu: 'shibu' };
  for (const [id, av] of Object.entries(faces)) {
    const vrm = peekVrm(av);
    const mx = new THREE.AnimationMixer(vrm.scene);
    mx.clipAction(THREE.AnimationClip.findByName(anims(av), 'Idle_Loop')).play();
    mx.update(0.4);
    vrm.expressionManager?.setValue('joy', 0.35);
    vrm.update(0);
    list.push({ id: 'face_' + id, obj: vrm.scene, face: [0.09, 0.2], dir: new THREE.Vector3(0.3, 0.08, 1) });
    cleanup.push(() => { mx.stopAllAction(); vrm.expressionManager?.setValue('joy', 0); });
  }
  UI.thumbs = await makeThumbs(list);
  cleanup.forEach((f) => f());
}

// ---------- hero ----------
// 3 hero tạo sẵn 1 lần (VRM parse tốn), đổi hero chỉ tháo/gắn vào scene
const heroActors = {};
function spawnHero(key, pos, rotY) {
  if (G.hero) scene.remove(G.hero.root);
  const def = HEROES[key];
  const a = heroActors[key] ||= new Actor(def.av);
  scene.add(a.root);
  a.root.position.copy(pos);
  a.root.rotation.y = rotY;
  a.vrm.springBoneManager?.reset();
  G.hero = a; G.def = def; S.hero = key;
  equipVisual();
  a.play(def.idle);
  G.state = 'idle';
  UI.hero(def);
}

// vũ khí trang bị hiện trên tay nếu hợp class (xạ thủ không cầm kiếm bắn tên); không hợp thì cầm vũ khí gốc của class
const CLASS_W = { Warrior: ['sword', 'dagger'], Wizard: ['staff', 'holy'], Ranger: ['bow'] };
function equipVisual() {
  const id = S.eq.weapon?.m?.slice(2);
  G.hero.hold(CLASS_W[G.def.key]?.includes(id) ? id : G.def.weapon);
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
  const a = new Actor(def.av, def.scale || 1);
  // material riêng (texture vẫn dùng chung): nhuộm áo/tóc theo loại địch + flash khi trúng đòn
  const tint = new THREE.Color(def.tint);
  a.vrm.scene.traverse((m) => {
    if (!m.isMesh) return;
    // outline MToon clone ra bị vỡ (phủ đen màn hình) -> giữ outline gốc, chỉ clone bề mặt
    const one = (mt) => { if (mt.isOutline) return mt; const c = mt.clone(); if (/CLOTH|HAIR/.test(mt.name)) { c.color?.multiply(tint); c.shadeColorFactor?.multiply(tint); } return c; };
    m.material = Array.isArray(m.material) ? m.material.map(one) : one(m.material);
  });
  a.hold(def.weapon);
  a.root.position.set(x, 0, z);
  a.root.rotation.y = o.rot ?? rnd() * Math.PI * 2;
  const lvl = o.lvl || 1;
  const hp = Math.round(def.hp * (1 + (lvl - 1) * 0.15));
  const e = { a, root: a.root, def, type, hp, max: hp, lvl, alive: true, state: o.dormant ? 'dormant' : 'idle', atkReady: 0, room: o.room, slow: 0, bar: null };
  // giáo đồ "ngủ" nằm la liệt trên sàn, có người bước vào thì bật dậy
  if (o.dormant) { a.play(def.rise, { once: true }); a.cur.paused = true; }
  else a.play(def.idle);
  a.face('angry', def.boss ? 0.8 : 0.5, 1e9);
  G.enemies.push(e);
  return e;
}

// ---------- NPC ----------
function spawnNpc(key, x, z, rot, o) {
  const a = new Actor(key, o.scale || 1);
  a.root.position.set(x, 0, z);
  a.root.rotation.y = rot;
  a.play(o.anim || 'Idle_Loop');
  const n = { a, root: a.root, key, name: o.name, onTalk: o.onTalk, marker: null, idle: o.anim || 'Idle_Loop' };
  // diễn 1 động tác rồi về dáng đứng
  n.act = (clip, face) => { a.play(clip, { once: true, onDone: () => a.play(n.idle) }); if (face) a.face(face, 1, 1.5); };
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

// trúng đòn: MToon có emissive -> chớp trắng (material của địch là bản clone riêng)
function flash(a, v) {
  a.vrm.scene.traverse((m) => { if (m.isMesh) for (const mt of [m.material].flat()) mt.emissive?.setRGB(v, v, v); });
}

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
  flash(e.a, 0.9); e.flashUntil = G.now + 0.08;
  if (crit) { G.shake = Math.max(G.shake, 0.25); hitstop(0.05); }
  if (!e.def.boss) { const p = G.hero.root.position, ep = e.root.position; const dx = ep.x - p.x, dz = ep.z - p.z, l = Math.hypot(dx, dz) || 1; move(ep, dx / l * 0.45, dz / l * 0.45, 0.7); }
  if (ST.ls) S.hp = Math.min(ST.maxHp, S.hp + Math.max(1, Math.round(d * ST.ls / 100)));
  if (o.slow) e.slow = G.now + o.slow;
  if (e.hp <= 0) return killEnemy(e);
  if (!awake(e)) return;
  if (!e.def.boss && e.state !== 'attack') { e.state = 'hit'; e.a.play(e.def.hit, { once: true, speed: 1.6, onDone: () => { if (e.alive) e.state = 'chase'; } }); }
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
  e.a.play(e.def.death, { once: true, speed: 1.2 }); e.a.face('sorrow', 1, 1e9);
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
  if (e.def.boss) { UI.boss(null); G.shake = 0.6; UI.banner('Ma Nữ đã ngã', 'Chiến thắng'); G.hero.face('joy', 1, 4); }
  if (e.room === 'h' && S.quest === 1 && G.hallLeft() === 0) { S.quest = 2; UI.toast('Thánh Đường đã sạch! Quay lại gặp Tu Sĩ Elara.', '#7be38a'); }
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
  if (G.state === 'idle' || G.state === 'run') { G.state = 'hit'; G.hero.face('sorrow', 1, 0.5); G.hero.play('Hit_Chest', { once: true, speed: 1.8, onDone: () => { if (G.state === 'hit') G.state = 'idle'; } }); }
  UI.vitals(G.ST);
}

const SPAWN = new THREE.Vector3(8.5, 0, 12.5);
function heroDie() {
  G.state = 'dead'; S.hp = 0;
  G.hero.play('Death01', { once: true }); G.hero.face('sorrow', 1, 3);
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
  h.face('angry', 0.7, 0.8);
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
      slash(scene, tweens, p.clone().addScaledVector(fwd, 0.6), h.root.rotation.y, 0xfff0c8, 2.0);
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
  h.face('angry', 1, 1.4);
  G.state = 'skill';
  const end = () => { if (G.state === 'skill') G.state = 'idle'; };
  if (def.style === 'magic') {
    const dur = h.play(def.skill, { once: true, speed: 1.5, onDone: end });
    after(dur * 0.5, () => {
      const q = h.root.position;
      shock(scene, tweens, q, 0x8fd8ff, 6, 0.55); shock(scene, tweens, q, 0xffffff, 4, 0.35);
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
      shock(scene, tweens, q, 0xcfe6ff, 3.6, 0.35);
      slash(scene, tweens, q, h.root.rotation.y + k * 6, 0xcfe6ff, 3.2);
      glow.emit({ x: q.x, y: 1, z: q.z, count: 30, colors: [0xcfe6ff, 0xffffff], speed: [4, 8], life: 0.35, size: [0.3, 0], flat: true });
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
  h.play('Roll', { once: true, speed: 1.5, fade: 0.05, onDone: () => { if (G.state === 'dodge') G.state = 'idle'; } });
  const p = h.root.position;
  dust.emit({ x: p.x, y: 0.2, z: p.z, count: 12, colors: [0x5a5048, 0x766a5e], speed: [1, 2.5], life: 0.7, size: [0.8, 0.3], alpha: 0.5, up: 0.3 });
};

G.drink = () => {
  if (G.state === 'dead' || G.now < G.cd.r) return;
  const i = S.bag.findIndex((it) => it.kind === 'potion');
  if (i < 0) { UI.toast('Hết bình máu — mua thêm ở chỗ Shino', '#ff7a6b'); return; }
  S.bag.splice(i, 1); G.cd.r = G.now + 5;
  if (G.state === 'idle') { G.state = 'drink'; G.hero.play('Consume', { once: true, speed: 1.8, onDone: () => { if (G.state === 'drink') G.state = 'idle'; } }); }
  G.hero.face('joy', 1, 1.2);
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
    const c = inst('Coin_Pile');
    c.scale.setScalar(3.2);
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
  const elara = spawnNpc('victoria', 15.5, 11.4, -0.7, {
    name: 'Tu Sĩ Elara',
    onTalk: (n) => {
      if (S.quest === 0) UI.dialog(T().face_victoria, n.name, 'Đám giáo đồ hắc giáo đang nằm la liệt trong Thánh Đường, chỉ cần có bước chân là chúng bật dậy. Dọn sạch chúng giúp ta, phần thưởng sẽ xứng đáng.', [
        ['Nhận nhiệm vụ', () => { S.quest = 1; UI.quest(); UI.toast('Nhận nhiệm vụ: Dọn sạch Thánh Đường', '#9fd0ff'); n.act('Yes', 'joy'); }],
        ['Để sau', null, true],
      ]);
      else if (S.quest === 1) UI.dialog(T().face_victoria, n.name, `Vẫn còn ${G.hallLeft()} giáo đồ trong Thánh Đường. Cửa ở phía đông quán.`, [['Đi ngay', null]]);
      else if (S.quest === 2) UI.dialog(T().face_victoria, n.name, 'Tuyệt vời! Thánh Đường đã yên. Nhận lấy món này, nó từng thuộc về một hiệp sĩ huyền thoại.', [
        ['Nhận thưởng', () => {
          S.quest = 3; UI.quest();
          n.act('Interact', 'joy');
          const p = n.root.position.clone();
          dropItem(rollItem(S.lvl + 2, { kind: 'weapon', rarity: 3, legend: LEGEND[0] }), p.clone().setY(1), G.hero.root.position.clone().lerp(p, 0.5).setY(0));
          coinBurst(p, 10, 120); gainXp(60);
        }],
      ]);
      else UI.dialog(T().face_victoria, n.name, 'Ngai Ma Nữ ở phía nam Thánh Đường. Mua thêm bình máu chỗ Shino rồi hẵng xuống.', [['Hiểu rồi', null]]);
    },
  });
  // Shino bán bình máu (25 vàng)
  const shop = spawnNpc('shino', 17.2, 7.6, -0.9, {
    name: 'Shino Bán Thuốc', anim: 'Idle_Talking_Loop',
    onTalk: (n) => UI.dialog(T().face_shino, n.name, `Bình máu mới pha sáng nay! 25 vàng một bình. Cậu đang có ${S.gold} vàng.`, [
      ['Mua 1 bình (25)', () => {
        if (S.gold < 25) { UI.toast('Không đủ vàng', '#ff7a6b'); n.act('Idle_No_Loop', 'sorrow'); return; }
        if (S.bag.length >= 20) { UI.toast('Túi đầy', '#ff7a6b'); return; }
        S.gold -= 25; S.bag.push(potion()); UI.vitals(G.ST); UI.toast('Mua: Bình Hồi Máu', '#7be38a');
        n.act('Yes', 'joy');
      }],
      ['Thôi', null, true],
    ]),
  });
  const guide = spawnNpc('shibu', 9.6, 14.2, Math.PI * 0.9, { name: 'Chị Shibu', anim: 'Idle_FoldArms_Loop', onTalk: (n) => { n.a.face('fun', 1, 2); UI.dialog(T().face_shibu, n.name, [
    'Ma Nữ Azura vung trượng rất chậm, nhưng trúng là văng. Thấy vòng đỏ dưới chân thì lăn ngay.',
    'Pháp Sư Lam đứng xa bắn cầu phép xanh. Lao vào đánh nó trước, lũ cầm kiếm để sau.',
    'Xạ thủ bắn tên xuyên được nhiều đứa một lúc. Thử bấm phím 3 xem.',
  ][rint(0, 2)], [['Cảm ơn chị', null]]); } });
  for (const n of G.npcs) {
    const el = document.createElement('div'); el.className = 'marker'; el.textContent = '!';
    n.marker = UI.anchor(el, () => n.root.position, { dy: 2.9 });
    n.marker.el.hidden = n !== elara;
  }
  G.elara = elara; G.shop = shop; G.guide = guide;
  const quips = ['Bình máu đây! Bình máu mới pha đây!', 'Uống trước khi đánh trùm nha, đừng tiếc vàng.', 'Dưới Thánh Đường có tiếng hát lạ… chắc không phải ma đâu nhỉ?'];
  let qi = 0;
  setInterval(() => {
    if (document.hidden) return;
    const el = document.createElement('div'); el.className = 'bubble'; el.textContent = quips[qi++ % quips.length];
    UI.anchor(el, () => shop.root.position, { dy: 2.9, life: 4.5, hud: true });
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
  const p = e.root.position, sc = e.def.scale || 1;
  faceTo(e.root, G.hero.root.position);
  e.a.play(e.def.rise, { once: true, speed: 1.7, onDone: () => { if (e.alive) e.state = 'chase'; } });
  dust.emit({ x: p.x, y: 0.2, z: p.z, count: 16, colors: [0xcbbfa8, 0xe2d8c4], speed: [1, 3], life: 0.9, size: [0.9, 0.3], alpha: 0.45, up: 0.5 });
  glow.emit({ x: p.x, y: 0.1, z: p.z, count: 16, colors: [0xc04cff, 0xff6aa8], speed: [1, 3], life: 0.6, size: [0.35, 0], flat: true });
  shock(scene, tweens, p, 0xc04cff, 1.8 * sc, 0.5);
}

function updateEnemies(dt) {
  const hp = G.hero.root.position;
  for (const e of G.enemies) {
    // địch ngủ/xa camera: bỏ spring bone; xác đã chìm: khỏi update
    if (e.root.parent) e.a.update(dt * (e.slow > G.now ? 0.5 : 1), e.state !== 'dormant' && Math.abs(e.root.position.x - hp.x) < 16 && Math.abs(e.root.position.z - hp.z) < 12);
    if (e.flashUntil && G.now > e.flashUntil) { flash(e.a, 0); e.flashUntil = 0; }
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
        const dur = e.a.play(def.taunt, { once: true, speed: 0.9, onDone: () => { if (e.alive) e.state = 'chase'; } });
        if (def.boss) after(dur * 0.75, () => { shock(scene, tweens, p, 0xff6a3a, 5, 0.5); G.shake = 0.45; dust.emit({ x: p.x, y: 0.2, z: p.z, count: 30, colors: [0x5a5048, 0x766a5e], speed: [2, 5], life: 1, size: [1.2, 0.3], alpha: 0.5, flat: true }); });
      }
      continue;
    }
    if (e.state === 'awaken' || e.state === 'taunt' || e.state === 'hit') continue;
    if (def.boss && e.state === 'chase') {
      const hc = cellCh(hp.x, hp.z);
      if (hc !== 'c' && !(hc === '.' && hp.z > 20)) { e.state = 'idle'; e.a.play(def.idle); UI.boss(null); continue; }
    }
    if (e.state === 'attack') continue;
    if (G.state === 'dead') { if (e.a.curName !== def.idle) e.a.play(def.idle); continue; }
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
      if (e.a.curName !== def.idle) e.a.play(def.idle);
    }
  }
}

function updateWorld(dt, t) {
  const hp = G.hero.root.position;
  // fade tường/cột/cổng đứng giữa camera và nhân vật
  for (const w of G.walls) {
    const dz = w.position.z - hp.z, dx = Math.abs(w.position.x - hp.x);
    const hide = dz > 0.3 && dz < 7.5 && dx < 3.6;
    const target = hide ? 0.12 : 1;
    if (Math.abs(w.userData.op - target) > 0.01) {
      w.userData.op = damp(w.userData.op, target, 12, dt);
      if (Math.abs(w.userData.op - target) < 0.02) w.userData.op = target;
      for (const m of w.userData.mats) { m.transparent = w.userData.op < 1; m.opacity = w.userData.op; m.depthWrite = w.userData.op > 0.9; }
    }
  }
  // lửa chập chờn
  for (const T of G.torches) {
    const f = 0.82 + Math.sin(t * 9 + T.ph) * 0.08 + Math.sin(t * 23 + T.ph * 2) * 0.06 + rnd() * 0.05;
    T.L.intensity = T.base * f;
    const p = rnd() < (T.fire ? 0.9 : 0.55);
    if (p) glow.emit({ x: T.x, y: T.y, z: T.z, count: T.fire ? 2 : 1, colors: T.warm ? [0xffb347, 0xff7a1a, 0xffe08a] : [0xd890ff, 0xb04cff, 0xf0c8ff], speed: [0.2, 0.7], dir: new THREE.Vector3(0, 1.4, 0), life: 0.55, size: [T.fire ? 0.6 : 0.45, 0.05], spread: T.fire ? 0.4 : 0.18, drag: 0.5 });
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
  for (const n of G.npcs) { n.a.update(dt); if (n.root.position.distanceTo(hp) < 3.2) near = n; }
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
  if (G.camFree) return; // ?debug: tự đặt G.camera để soi cận (chụp test)
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
  G.hero.update(dt);
  updateHero(dt);
  updateEnemies(dt);
  updateBolts(dt);
  updateWorld(dt, t);
  tweens.update(dt);
  glow.update(dt); dust.update(dt);
  updateCamera(dt);
  cullActors();
  composer.render();
  UI.update(camera, innerWidth, innerHeight, dt);
  if ((uiT += dt) > 0.15) { uiT = 0; UI.vitals(G.ST); UI.cooldowns(G.cd, G.now, S.mp >= (G.ST.powers.freeSkill ? 0 : 20)); }
  if ((mmT += dt) > 0.25) { mmT = 0; UI.minimap(G); }
  // máy yếu: tắt bloom, hạ pixel ratio (vẫn giữ >= 1.25 cho đỡ mờ).
  // Vẫn render qua composer: render thẳng ra màn hình đổi tone mapping -> compile lại toàn bộ shader MToon
  // (vài giây đứng hình trên iGPU), và MSAA của rt vẫn còn thay cho antialias của canvas.
  if (!qualityChecked) {
    frames++; ftAcc += dt;
    if (frames === 150) {
      qualityChecked = true;
      if (ftAcc / frames > 1 / 35) { bloom.enabled = false; PR =Math.min(PR, 1.25); renderer.setPixelRatio(PR); onResize(); }
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
  joyHome();
}
addEventListener('resize', onResize);

// ---------- boot ----------
function showErr(m) { const e = document.createElement('div'); e.id = 'err'; e.textContent = m; document.body.appendChild(e); }
addEventListener('error', (e) => showErr(String(e.message || e)));
addEventListener('unhandledrejection', (e) => showErr(String(e.reason?.message || e.reason)));

// Compile trước mọi shader trong lúc còn màn tải: có KHR_parallel_shader_compile thì chạy nền, không đứng hình
// (trước đây frame đầu đứng ~13s trên iGPU). Phải compile vào render target của composer: tone mapping nằm ở
// OutputPass, compile thẳng ra màn hình sẽ ra biến thể shader khác, vô dụng.
async function warmShaders() {
  const extra = Object.keys(HEROES).filter((k) => !heroActors[k]).map((k) => {
    const a = (heroActors[k] = new Actor(HEROES[k].av));
    a.hold(HEROES[k].weapon);
    return a;
  });
  $('#ld-txt').textContent = 'Chuẩn bị shader…';
  renderer.setRenderTarget(composer.readBuffer);
  await renderer.compileAsync(scene, camera);
  renderer.setRenderTarget(null);
  for (const a of extra) scene.remove(a.root);
  composer.render(); // shader bóng đổ + bloom compile nốt ở đây, vẫn sau màn tải
}

async function boot() {
  await loadAll((k) => { const v = Math.round(k * 100); $('#ld-fill').style.width = `${v}%`; $('#ld-txt').textContent = `Đang tải mô hình 3D… ${v}%`; });
  $('#ld-txt').textContent = 'Dựng hầm ngục…';
  await new Promise((r) => requestAnimationFrame(r));
  await buildThumbs();
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
  onResize();
  await warmShaders();
  UI.vitals(G.ST); UI.quest();
  $('#loading').hidden = true;
  clock.start();
  frame();
}
boot().catch((e) => { console.error(e); showErr('Lỗi khởi động: ' + (e.message || e)); });
