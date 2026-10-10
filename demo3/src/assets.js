import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Asset Quaternius (CC0): 14 nhân vật/quái + 1 file dungeon.glb gom 54 props (mỗi prop = 1 scene)
const BASE = import.meta.env.BASE_URL + 'models/';

const HEROES = ['Warrior', 'Wizard', 'Ranger', 'Rogue', 'Cleric', 'Monk'];
const MONSTERS = ['Orc', 'Orc_Skull', 'Demon', 'BlueDemon', 'MushroomKing', 'Ninja'];
// chiều cao chuẩn hóa (đơn vị thế giới)
const HEIGHT = { hero: 2.35, monster: 2.25 };
// vũ khí tách từ tay hero -> dùng làm item rơi đồ + trang bị
export const WEAPON_NODES = { sword: ['Warrior', 'Warrior_Sword'], staff: ['Wizard', 'Wizard_Staff'], holy: ['Cleric', 'Cleric_Staff'], bow: ['Ranger', 'Ranger_Bow'], dagger: ['Rogue', 'Rogue_Dagger'] };

const manager = new THREE.LoadingManager();
const loader = new GLTFLoader(manager);
loader.setMeshoptDecoder(MeshoptDecoder);
const chars = new Map(); // key -> { scene, animations, scale }
const props = new Map(); // key -> Object3D đã chuẩn hóa (tâm XZ = 0, đáy = 0)
const weapons = new Map(); // id -> { mesh, parent, pos, quat, scl }

function prep(root, shadow = true) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = shadow; o.receiveShadow = true;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) {
      // OBJ -> glTF ra vật liệu bóng như nhựa; ép về mờ cho hợp low-poly
      if (m.isMeshStandardMaterial) { m.roughness = Math.max(m.roughness, 0.82); m.metalness = Math.min(m.metalness, 0.05); }
      if (m.map) m.map.anisotropy = 4;
    }
  });
}

function measure(root) {
  root.updateMatrixWorld(true);
  root.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.update(); });
  return new THREE.Box3().setFromObject(root);
}

export async function loadAll(onProgress) {
  const jobs = [
    ...HEROES.map((k) => [k, `${BASE}chars/${k}.glb`, 'hero']),
    ...MONSTERS.map((k) => [k, `${BASE}chars/${k}.glb`, 'monster']),
    ['__dungeon', `${BASE}dungeon.glb`, 'props'],
  ];
  // tiến độ theo byte thật, không theo số file -> thanh và số % luôn khớp
  const got = new Map(), tot = new Map();
  const report = () => {
    let a = 0, b = 0;
    for (const [k] of jobs) { a += got.get(k) || 0; b += tot.get(k) || 400000; }
    onProgress(Math.min(1, a / b));
  };
  await Promise.all(jobs.map(async ([k, url, kind]) => {
    const g = await loader.loadAsync(url, (e) => { if (e.total) tot.set(k, e.total); got.set(k, e.loaded); report(); });
    got.set(k, tot.get(k) || got.get(k) || 0); report();
    if (kind === 'props') {
      for (const sc of g.scenes) {
        prep(sc);
        const box = measure(sc), c = box.getCenter(new THREE.Vector3());
        const wrap = new THREE.Group();
        sc.position.set(-c.x, -box.min.y, -c.z);
        wrap.add(sc);
        wrap.userData.size = box.getSize(new THREE.Vector3());
        props.set(sc.name, wrap);
      }
      return;
    }
    prep(g.scene);
    const h = measure(g.scene).getSize(new THREE.Vector3()).y || 1;
    chars.set(k, { scene: g.scene, animations: g.animations, scale: HEIGHT[kind] / h });
  }));
  // tách vũ khí khỏi tay hero
  for (const [id, [ck, node]] of Object.entries(WEAPON_NODES)) {
    const m = chars.get(ck)?.scene.getObjectByName(node);
    if (m) weapons.set(id, { mesh: m, parent: m.parent.name, pos: m.position.clone(), quat: m.quaternion.clone(), scl: m.scale.clone() });
  }
}

export const anims = (k) => chars.get(k).animations;
export const charScale = (k) => chars.get(k).scale;
export const size = (k) => props.get(k)?.userData.size;

// nhân vật có skeleton -> SkeletonUtils.clone; scale chuẩn hóa nằm ở node con để root giữ scale 1
export function inst(k) {
  const c = chars.get(k);
  if (c) {
    const m = SkeletonUtils.clone(c.scene);
    m.scale.multiplyScalar(c.scale);
    return m;
  }
  if (k.startsWith('w:')) return weaponItem(k.slice(2));
  const p = props.get(k);
  if (!p) throw new Error(`Thiếu model: ${k}`);
  return p.clone(true);
}

// vũ khí để hiển thị (rơi đồ/thumbnail): căn giữa, dựng đứng
function weaponItem(id) {
  const w = weapons.get(id);
  const m = w.mesh.clone();
  m.position.set(0, 0, 0); m.quaternion.identity(); m.scale.set(1, 1, 1);
  const g = new THREE.Group();
  g.add(m);
  const s = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
  // trục dài nhất -> trục Y
  if (s.x >= s.y && s.x >= s.z) m.rotation.z = Math.PI / 2;
  else if (s.z >= s.y && s.z >= s.x) m.rotation.x = Math.PI / 2;
  m.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(m), s2 = b.getSize(new THREE.Vector3());
  m.position.sub(b.getCenter(new THREE.Vector3()));
  g.scale.setScalar(1.5 / Math.max(s2.x, s2.y, s2.z));
  return g;
}

// gắn vũ khí vào đúng bone của hero (cùng rig RPG Characters nên dùng lại transform gốc)
export function weaponForHand(id) {
  const w = weapons.get(id);
  if (!w) return null;
  const m = w.mesh.clone();
  m.position.copy(w.pos); m.quaternion.copy(w.quat); m.scale.copy(w.scl);
  return { mesh: m, bone: w.parent };
}

// Chụp thumbnail 3D -> dataURL (portrait + icon item)
export function makeThumbs(list, size = 160) {
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(size, size);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xfff4e0, 0x403040, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(2, 4, 5); sc.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 1.6); rim.position.set(-4, 2, -3); sc.add(rim);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
  const out = {};
  const box = new THREE.Box3(), c = new THREE.Vector3(), sz = new THREE.Vector3();
  for (const { id, obj, face, dir } of list) {
    sc.add(obj);
    obj.updateMatrixWorld(true);
    obj.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.update(); });
    box.setFromObject(obj);
    box.getCenter(c); box.getSize(sz);
    let span = Math.max(sz.x, sz.y, sz.z);
    if (face) { c.y = box.max.y - sz.y * 0.3; span = sz.y * 0.62; }
    const d = (span / 2) / Math.tan(THREE.MathUtils.degToRad(14)) * 1.15;
    const v = (dir || new THREE.Vector3(0.6, 0.35, 1)).clone().normalize();
    cam.position.copy(c).addScaledVector(v, d);
    cam.lookAt(c);
    r.render(sc, cam);
    out[id] = r.domElement.toDataURL('image/png');
    sc.remove(obj);
  }
  r.dispose();
  r.forceContextLoss();
  return out;
}
