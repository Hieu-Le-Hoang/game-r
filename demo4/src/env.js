import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Môi trường PBR: texture Poly Haven (CC0) dán theo toạ độ thế giới -> tường/sàn/cột dựng bằng box,
// không cần UV unwrap, ghép liền mạch giữa các ô.
const TEX = import.meta.env.BASE_URL + 'textures/';
const loader = new THREE.TextureLoader();
const cache = new Map();

function tex(id, map, srgb) {
  const k = `${id}_${map}`;
  if (!cache.has(k)) {
    const t = loader.load(`${TEX}${k}.webp`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    cache.set(k, t);
  }
  return cache.get(k);
}

// tile = số đơn vị thế giới cho 1 lần lặp texture
export function pbr(id, o = {}) {
  const arm = tex(id, 'arm');
  const m = new THREE.MeshStandardMaterial({
    map: tex(id, 'diff', true), normalMap: tex(id, 'nor'),
    aoMap: arm, roughnessMap: arm, metalnessMap: arm,
    roughness: o.rough ?? 1, metalness: o.metal ?? 0,
    color: o.color ?? 0xffffff, aoMapIntensity: 1,
    normalScale: new THREE.Vector2(o.normal ?? 1.2, o.normal ?? 1.2),
  });
  m.userData.tile = o.tile ?? 4;
  return m;
}

// UV theo toạ độ thế giới, chọn mặt phẳng chiếu theo pháp tuyến (box mapping)
export function worldUV(g, tile, ox = 0, oz = 0) {
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + ox, y = p.getY(i), z = p.getZ(i) + oz;
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = z; }
    else if (ax >= az) { u = z * Math.sign(n.getX(i) || 1); v = y; }
    else { u = -x * Math.sign(n.getZ(i) || 1); v = y; }
    uv[i * 2] = u / tile; uv[i * 2 + 1] = v / tile;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// box theo toạ độ thế giới (min/max) -> geometry đã có world UV
export function box(x0, y0, z0, x1, y1, z1, tile) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return worldUV(g, tile);
}

export function plane(x0, z0, x1, z1, y, tile, seg = 1) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, seg, seg);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  return worldUV(g, tile);
}

// cột tròn: thân trụ + đế + đầu cột vuông
export function column(x, z, r, h, tile) {
  const parts = [];
  const shaft = new THREE.CylinderGeometry(r, r * 1.08, h - 0.9, 14, 1, false);
  shaft.translate(x, 0.45 + (h - 0.9) / 2, z);
  parts.push(worldUV(shaft, tile));
  parts.push(box(x - r * 1.45, 0, z - r * 1.45, x + r * 1.45, 0.45, z + r * 1.45, tile));
  parts.push(box(x - r * 1.35, h - 0.45, z - r * 1.35, x + r * 1.35, h, z + r * 1.35, tile));
  return merge(parts);
}

export function merge(geos) {
  const clean = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of clean) for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  return mergeGeometries(clean);
}

export function mesh(geo, mat, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = true;
  return m;
}

// giá đuốc gắn tường: tay cầm gỗ + vòng sắt (procedural, lửa là particle + point light)
const iron = new THREE.MeshStandardMaterial({ color: 0x2a2724, metalness: 0.9, roughness: 0.45 });
const wood = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.85 });
export function sconce() {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.75, 8), wood);
  stick.position.set(0, 0.1, 0.32); stick.rotation.x = 0.35;
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.09, 0.2, 10, 1, true), iron);
  cup.position.set(0, 0.45, 0.45); cup.rotation.x = 0.35;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.42), iron);
  arm.position.set(0, -0.12, 0.2);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.06), iron);
  plate.position.set(0, -0.1, 0.02);
  g.add(stick, cup, arm, plate);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// đống vàng: đồng xu cylinder rải ngẫu nhiên, 1 InstancedMesh
const goldMat = new THREE.MeshStandardMaterial({ color: 0xffc35a, metalness: 1, roughness: 0.28, emissive: 0x3a2200 });
export function coinPile(n, r) {
  const m = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 12), goldMat, n);
  const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
    const h = Math.max(0, (1 - d / r)) * r * 0.45;
    o.position.set(Math.cos(a) * d, 0.02 + Math.random() * h, Math.sin(a) * d);
    o.rotation.set((Math.random() - 0.5) * 1.2, Math.random() * 6, (Math.random() - 0.5) * 1.2);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  }
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
export const coinGeo = () => new THREE.CylinderGeometry(0.16, 0.16, 0.04, 12);
export { goldMat };
