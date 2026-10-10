import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { makeSource, retargetClip } from './retarget.js';

// Nhân vật: VRoid sample (CC0, .vrm) + animation Quaternius UAL (CC0) retarget sang VRM.
// Props: dungeon.glb của demo3 (Quaternius) tô lại toon. Vũ khí: tách từ tay hero Quaternius.
const BASE = import.meta.env.BASE_URL + 'models/';

// số instance cần cho cả màn chơi (mỗi instance là 1 lần parse, texture/material dùng chung)
const POOL = { sakura: 1, bibi: 1, vita: 1, victoria: 1, shino: 1, shibu: 1, dark: 9 };
export const VRM_SCALE = 1.5; // mét VRoid -> đơn vị game (hero cao ~2.3 như demo3)
export const WEAPON_NODES = { sword: ['Warrior', 'Warrior_Sword'], staff: ['Wizard', 'Wizard_Staff'], holy: ['Cleric', 'Cleric_Staff'], bow: ['Ranger', 'Ranger_Bow'], dagger: ['Rogue', 'Rogue_Dagger'] };
const WEAPON_LEN = { sword: 0.95, dagger: 0.45, staff: 1.5, holy: 1.5, bow: 1.05 }; // mét VRM

const manager = new THREE.LoadingManager();
const loader = new GLTFLoader(manager);
loader.setMeshoptDecoder(MeshoptDecoder);
const vrmLoader = new GLTFLoader(manager);
vrmLoader.register((p) => new VRMLoaderPlugin(p));

const pool = new Map(); // key -> [vrm]
const clipsOf = new Map(); // key -> AnimationClip[] (đã retarget)
const props = new Map(); // key -> Object3D đã chuẩn hóa (tâm XZ = 0, đáy = 0)
const weapons = new Map(); // id -> mesh gốc

// toon ramp 3 bậc cho mọi vật không phải VRM
export const ramp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
})();
export function toon(m) {
  const o = new THREE.MeshToonMaterial({ gradientMap: ramp });
  // chỉ chép thuộc tính có giá trị (undefined lọt vào opacity/side -> render đen)
  for (const k of ['color', 'map', 'vertexColors', 'transparent', 'opacity', 'side']) if (m[k] !== undefined) o[k] = k === 'color' ? m.color.clone() : m[k];
  if (o.map) o.map.anisotropy = 4;
  return o;
}

function prep(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    // vũ khí Quaternius nén xong mất normal -> toon tính sáng = 0, render đen thui
    if (!o.geometry.getAttribute('normal')) o.geometry.computeVertexNormals();
    o.material = Array.isArray(o.material) ? o.material.map(toon) : toon(o.material);
  });
}

function measure(root) {
  root.updateMatrixWorld(true);
  root.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.update(); });
  return new THREE.Box3().setFromObject(root);
}

// VRoid xuất mỗi lọn tóc thành 1 primitive: 50-100 mesh/nhân vật, x3 draw call (outline + bóng đổ).
// Gộp các SkinnedMesh anh em cùng material, cùng skeleton, không morph -> 1 mesh (tóc 83 -> vài mesh).
function mergeSiblings(root) {
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isSkinnedMesh || o.geometry.morphAttributes.position || !o.matrix.equals(IDENTITY)) return;
    const g = o.geometry;
    const key = [o.parent.uuid, o.skeleton.uuid, ...[o.material].flat().map((m) => m.uuid), ...Object.keys(g.attributes).sort(), !!g.index].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  for (const list of groups.values()) {
    const [first] = list;
    if (list.length < 2 || list.some((m) => !m.bindMatrix.equals(first.bindMatrix))) continue;
    const geo = mergeGeometries(list.map((m) => m.geometry));
    if (!geo) continue;
    // outline MToon = cùng geometry vẽ 2 lần qua group (materialIndex 0 = mặt, 1 = viền)
    if (Array.isArray(first.material)) first.material.forEach((_, i) => geo.addGroup(0, Infinity, i));
    for (const m of list.slice(1)) { m.parent.remove(m); m.geometry.dispose(); }
    first.geometry.dispose();
    first.geometry = geo;
  }
}
const IDENTITY = new THREE.Matrix4();

async function parseVrm(buf) {
  const g = await vrmLoader.parseAsync(buf, '');
  const vrm = g.userData.vrm;
  VRMUtils.removeUnnecessaryVertices(vrm.scene);
  VRMUtils.combineSkeletons(vrm.scene);
  mergeSiblings(vrm.scene);
  VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  // vị trí/hướng bàn tay lúc rest (T-pose, hệ quy chiếu mặt +Z) để gắn vũ khí
  vrm.scene.updateMatrixWorld(true);
  vrm.restHand = {};
  for (const s of ['left', 'right']) vrm.restHand[s] = vrm.humanoid.getRawBoneNode(`${s}Hand`).matrixWorld.clone();
  return vrm;
}

// instance sau dùng lại material của instance đầu -> texture chỉ upload GPU 1 lần
function shareMaterials(tpl, vrm) {
  const a = [], b = [];
  tpl.scene.traverse((o) => o.isMesh && a.push(o));
  vrm.scene.traverse((o) => o.isMesh && b.push(o));
  if (a.length !== b.length) return;
  const old = new Set();
  b.forEach((m, i) => {
    for (const mt of [m.material].flat()) for (const v of [...Object.values(mt), ...Object.values(mt.uniforms || {}).map((u) => u.value)]) if (v?.isTexture) old.add(v);
    m.material = a[i].material;
  });
  for (const t of old) { t.image?.close?.(); t.dispose(); }
}

export async function loadAll(onProgress) {
  const jobs = [
    ...Object.keys(POOL).map((k) => ['vrm:' + k, `${BASE}vrm/${k}.vrm`]),
    ['ual1', `${BASE}anims_ual1.glb`], ['ual2', `${BASE}anims_ual2.glb`],
    ['__dungeon', `${BASE}dungeon.glb`],
    ...[...new Set(Object.values(WEAPON_NODES).map(([c]) => c))].map((c) => ['w:' + c, `${BASE}chars/${c}.glb`]),
  ];
  // tải: 0-85% theo byte thật; dựng nhân vật: 85-100%
  const got = new Map(), tot = new Map();
  const report = (extra = 0) => {
    let a = 0, b = 0;
    for (const [k] of jobs) { a += got.get(k) || 0; b += tot.get(k) || 1500000; }
    onProgress(Math.min(1, (a / b) * 0.85 + extra * 0.15));
  };
  const fl = new THREE.FileLoader(manager); fl.setResponseType('arraybuffer');
  const res = new Map();
  await Promise.all(jobs.map(async ([k, url]) => {
    const prog = (e) => { if (e.total) tot.set(k, e.total); got.set(k, e.loaded); report(); };
    res.set(k, k.startsWith('vrm:') ? await fl.loadAsync(url, prog) : await loader.loadAsync(url, prog));
    got.set(k, tot.get(k) || got.get(k) || 0); report();
  }));

  // props
  for (const sc of res.get('__dungeon').scenes) {
    prep(sc);
    const box = measure(sc), c = box.getCenter(new THREE.Vector3());
    const wrap = new THREE.Group();
    sc.position.set(-c.x, -box.min.y, -c.z);
    wrap.add(sc);
    wrap.userData.size = box.getSize(new THREE.Vector3());
    props.set(sc.name, wrap);
  }
  // vũ khí
  for (const [id, [ck, node]] of Object.entries(WEAPON_NODES)) {
    const m = res.get('w:' + ck).scene.getObjectByName(node);
    if (m) { prep(m); weapons.set(id, m); }
  }
  // nhân vật: parse đủ pool (các avatar chạy song song cho giải mã texture chồng lên nhau),
  // retarget clip 1 lần cho mỗi avatar
  const srcs = [makeSource(res.get('ual1')), makeSource(res.get('ual2'))];
  const total = Object.values(POOL).reduce((a, b) => a + b, 0);
  let done = 0;
  await Promise.all(Object.entries(POOL).map(async ([k, n]) => {
    const buf = res.get('vrm:' + k), list = [];
    for (let i = 0; i < n; i++) {
      const vrm = await parseVrm(buf);
      if (i === 0) clipsOf.set(k, srcs.flatMap((s) => s.clips.map((c) => retargetClip(s, c, vrm))));
      else shareMaterials(list[0], vrm);
      list.push(vrm);
      report(++done / total);
      await new Promise((r) => setTimeout(r, 0)); // nhả main thread cho thanh tải kịp vẽ
    }
    pool.set(k, list);
  }));
}

export const anims = (k) => clipsOf.get(k);
export const size = (k) => props.get(k)?.userData.size;
export const peekVrm = (k) => pool.get(k)[0];
export function takeVrm(k) {
  const v = pool.get(k)?.pop();
  if (!v) throw new Error(`Hết instance VRM: ${k} (tăng POOL)`);
  return v;
}

export function inst(k) {
  if (k.startsWith('w:')) return weaponItem(k.slice(2));
  const p = props.get(k);
  if (!p) throw new Error(`Thiếu model: ${k}`);
  return p.clone(true);
}

// vũ khí: trục dài nhất -> +Y (lưỡi/đầu gậy), gốc = đầu cán trên trục giữa.
// Pivot gốc mỗi mesh Quaternius đặt một kiểu (kiếm ở giữa lưỡi, gậy ở đáy) -> chuẩn hóa để HOLD.grip có nghĩa.
function weaponGrip(id) {
  const m = weapons.get(id).clone();
  m.position.set(0, 0, 0); m.quaternion.identity(); m.scale.set(1, 1, 1);
  const b = new THREE.Box3().setFromObject(m), s = b.getSize(new THREE.Vector3());
  const a = s.x >= s.y && s.x >= s.z ? 'x' : s.y >= s.z ? 'y' : 'z';
  const from = new THREE.Vector3(); from[a] = Math.abs(b.max[a]) >= Math.abs(b.min[a]) ? 1 : -1;
  m.quaternion.setFromUnitVectors(from, new THREE.Vector3(0, 1, 0));
  m.scale.setScalar(WEAPON_LEN[id] / s[a]);
  const g = new THREE.Group(); g.add(m);
  const r = new THREE.Box3().setFromObject(m), c = r.getCenter(new THREE.Vector3());
  m.position.set(-c.x, -r.min.y, -c.z);
  return g;
}

// vũ khí rơi đồ/thumbnail: căn giữa, dựng đứng
function weaponItem(id) {
  const g = weaponGrip(id), m = g.children[0];
  g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g), s = b.getSize(new THREE.Vector3());
  m.position.sub(b.getCenter(new THREE.Vector3()));
  const w = new THREE.Group(); w.add(g);
  w.scale.setScalar(1.5 / Math.max(s.x, s.y, s.z));
  return w;
}

// Gắn vũ khí vào xương tay VRM. Tính trong hệ T-pose (mặt +Z): lưỡi theo hướng dir,
// grip = chỗ nắm tính từ đầu cán (tỉ lệ chiều dài).
// Gậy/cung: dir đo ngược từ pose thật (hướng lên trong Idle_Loop và Pistol_Shoot quy về T-pose ~ [0.9, 0.15, 0.2..0.5])
// -> dựng đứng cạnh người lúc đứng, cung thẳng đứng trên tay đang giương lúc bắn.
const UPRIGHT = [1, 0.15, 0.35];
const HOLD = {
  sword: { hand: 'right', dir: [0, 0.25, 1], grip: 0.1 }, dagger: { hand: 'right', dir: [0, 0.25, 1], grip: 0.2 },
  staff: { hand: 'right', dir: UPRIGHT, grip: 0.45 }, holy: { hand: 'right', dir: UPRIGHT, grip: 0.45 },
  bow: { hand: 'right', dir: UPRIGHT, grip: 0.5 },
};
export function weaponForHand(id, vrm) {
  const h = HOLD[id];
  if (!h || !weapons.has(id)) return null;
  const g = weaponGrip(id);
  const bone = vrm.humanoid.getRawBoneNode(`${h.hand}Hand`);
  const rest = vrm.restHand[h.hand];
  const hp = new THREE.Vector3().setFromMatrixPosition(rest);
  const side = h.hand === 'right' ? -1 : 1;
  const dir = new THREE.Vector3(...h.dir).normalize();
  // lòng bàn tay: lệch về phía ngón tay + hơi xuống; đầu cán lùi ngược trục 1 đoạn grip
  const pos = hp.add(new THREE.Vector3(side * 0.075, -0.025, 0)).addScaledVector(dir, -h.grip * WEAPON_LEN[id]);
  const want = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), new THREE.Vector3(1, 1, 1));
  const local = rest.clone().invert().multiply(want);
  local.decompose(g.position, g.quaternion, g.scale);
  bone.add(g);
  return g;
}

// Chụp thumbnail 3D -> dataURL (portrait + icon item)
export async function makeThumbs(list, size = 160) {
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(size, size);
  r.toneMapping = THREE.NeutralToneMapping;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xfff4e0, 0x6a7090, 2.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(2, 4, 5); sc.add(key);
  const rim = new THREE.DirectionalLight(0x9ac4ff, 1.4); rim.position.set(-4, 2, -3); sc.add(rim);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
  const out = {};
  const box = new THREE.Box3(), c = new THREE.Vector3(), sz = new THREE.Vector3();
  // compile shader song song cho cả list trước (context riêng nên không dùng lại được program của game)
  const parents = list.map(({ obj }) => obj.parent);
  for (const { obj } of list) sc.add(obj);
  await r.compileAsync(sc, cam);
  list.forEach(({ obj }, i) => { sc.remove(obj); parents[i]?.add(obj); });
  for (const { id, obj, face, dir } of list) {
    const parent = obj.parent;
    sc.add(obj);
    obj.updateMatrixWorld(true);
    obj.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.update(); });
    box.setFromObject(obj);
    box.getCenter(c); box.getSize(sz);
    let span = Math.max(sz.x, sz.y, sz.z);
    // face = [phần từ đỉnh xuống tới tâm khung, độ cao khung] theo tỉ lệ chiều cao
    if (face) { c.y = box.max.y - sz.y * face[0]; span = sz.y * face[1]; }
    const d = (span / 2) / Math.tan(THREE.MathUtils.degToRad(14)) * 1.15;
    const v = (dir || new THREE.Vector3(0.6, 0.35, 1)).clone().normalize();
    cam.position.copy(c).addScaledVector(v, d);
    cam.lookAt(c);
    r.render(sc, cam);
    out[id] = r.domElement.toDataURL('image/png');
    sc.remove(obj);
    if (parent) parent.add(obj);
  }
  r.dispose();
  r.forceContextLoss();
  return out;
}
