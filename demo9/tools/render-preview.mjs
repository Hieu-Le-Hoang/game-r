// Render ảnh soát asset bằng three.js chạy trong Node (không GPU): load GLB y như game, đặt pose, gắn súng, rồi rasterize.
//   node tools/render-preview.mjs <file.glb> <out.png> [--clip Idle_Gun_Pointing] [--t 0.1] [--gun ak47] [--views side,top]
// Dấu đỏ = gốc (0,0,0) của model; xanh lá = node *muzzle*; xanh dương = node GunSocket_*.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { rasterize, grid } from './lib-raster.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
export async function loadGlb(file) {
  const buf = fs.readFileSync(file);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return new Promise((res, rej) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej));
}

export function collect(root) {
  root.updateMatrixWorld(true);
  const tris = [], marks = [], v = new THREE.Vector3();
  root.traverse((o) => {
    if (/muzzle/i.test(o.name)) marks.push({ p: o.getWorldPosition(new THREE.Vector3()).toArray(), col: [40, 255, 80] });
    if (/^GunSocket/.test(o.name)) marks.push({ p: o.getWorldPosition(new THREE.Vector3()).toArray(), col: [60, 140, 255] });
    if (!o.isMesh || !o.visible) return;
    const g = o.geometry, idx = g.index, n = idx ? idx.count : g.attributes.position.count;
    const cols = Array.isArray(o.material) ? o.material : [o.material];
    const groups = g.groups.length ? g.groups : [{ start: 0, count: n, materialIndex: 0 }];
    for (const gr of groups) {
      const c = cols[gr.materialIndex ?? 0]?.color ?? new THREE.Color(0.7, 0.7, 0.7);
      for (let i = gr.start; i < gr.start + gr.count; i += 3) {
        const t = [0, 1, 2].map((k) => {
          const vi = idx ? idx.getX(i + k) : i + k;
          o.getVertexPosition(vi, v); // SkinnedMesh: đã áp skinning theo pose hiện tại
          return v.applyMatrix4(o.matrixWorld).toArray();
        });
        tris.push({ t, col: [c.r, c.g, c.b] });
      }
    }
  });
  marks.push({ p: [0, 0, 0], col: [255, 40, 40] });
  return { tris, marks };
}

export async function poseScene(file, { clip, t = 0.1, gun } = {}) {
  const gltf = await loadGlb(file);
  const root = gltf.scene;
  if (clip) {
    const c = gltf.animations.find((a) => a.name === clip);
    if (!c) throw new Error(`không có clip ${clip}; có: ${gltf.animations.map((a) => a.name).join(', ')}`);
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(c).play();
    mixer.setTime(t);
  }
  if (gun) {
    const guns = await loadGlb(path.join(ROOT, 'public/models/guns/guns.glb'));
    const g = guns.scene.getObjectByName(gun);
    if (!g) throw new Error(`không có súng ${gun}`);
    root.getObjectByName('GunSocket_R').add(g.clone());
  }
  return { gltf, root };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, out, ...rest] = process.argv.slice(2);
  const opt = {};
  for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];
  const { root } = await poseScene(file, { clip: opt.clip, t: +(opt.t ?? 0.1), gun: opt.gun });
  const { tris, marks } = collect(root);
  const views = (opt.views ?? 'side,top').split(',');
  const title = `${path.basename(file)}${opt.clip ? ' ' + opt.clip : ''}${opt.gun ? ' +' + opt.gun : ''}`;
  const panels = [];
  for (const v of views) panels.push(await rasterize(tris, marks, v, title));
  await grid(panels, out, Math.min(2, panels.length));
  console.log('wrote', out);
}
