// Đo thông số asset đã build, load bằng three.js y như trong game (GLTFLoader + MeshoptDecoder).
//   node tools/measure-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { loadGlb } from './render-preview.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUB = path.join(ROOT, 'public');
const f3 = (v) => v.toArray().map((x) => +x.toFixed(3));

function skinnedBox(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3(), v = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) box.expandByPoint(o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld));
  });
  return box;
}

for (const id of ['ct', 't']) {
  const file = path.join(PUB, `models/chars/${id}.glb`);
  const gltf = await loadGlb(file);
  const root = gltf.scene;
  const mixer = new THREE.AnimationMixer(root);
  const pose = (clip, t) => { mixer.stopAllAction(); mixer.clipAction(gltf.animations.find((a) => a.name === clip)).play(); mixer.setTime(t); root.updateMatrixWorld(true); };
  const W = (n) => root.getObjectByName(n).getWorldPosition(new THREE.Vector3());
  pose('Idle', 0);
  const box = skinnedBox(root);
  const head = W('Head'), hips = W('Hips'), footL = W('FootL'), toeL = W('FootL_end');
  pose('Idle_Gun_Pointing', 0.1);
  const sock = W('GunSocket_R'), wristR = W('WristR');
  const bones = [];
  root.traverse((o) => { if (o.isBone) bones.push(o.name); });
  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(`${o.name}${o.isSkinnedMesh ? '(skinned)' : ''}`); });
  console.log(`\n== chars/${id}.glb ${(fs.statSync(file).size / 1e3).toFixed(0)}KB`);
  console.log(`  Idle t=0 skinned bbox min ${f3(box.min)} max ${f3(box.max)} -> cao ${(box.max.y - box.min.y).toFixed(3)} m`);
  console.log(`  forward: mũi chân trái FootL_end z=${toeL.z.toFixed(3)} > gót FootL z=${footL.z.toFixed(3)}; tay ngắm Idle_Gun_Pointing WristR z=${wristR.z.toFixed(3)} => ${wristR.z > 0.3 ? '+Z' : '??'}; FootL x=${footL.x.toFixed(3)} (bên trái nhân vật = +X)`);
  console.log(`  head bone y=${head.y.toFixed(3)} hips y=${hips.y.toFixed(3)}; GunSocket_R (pose ngắm) world ${f3(sock)}`);
  console.log(`  clips: ${gltf.animations.map((a) => `${a.name}(${a.duration.toFixed(2)}s)`).join(', ')}`);
  console.log(`  meshes: ${meshes.join(', ')}`);
  console.log(`  bones(${bones.length}, tên sau sanitize của three): ${bones.filter((b) => /Wrist|Hand|Arm|Head|Neck|Spine|Chest|Torso|Hips/.test(b)).join(', ')}`);
  console.log(`  materials: ${[...new Set(meshes.length ? (() => { const m = []; root.traverse((o) => { if (o.isMesh) m.push(o.material.name); }); return m; })() : [])].join(', ')}`);
}

const guns = await loadGlb(path.join(PUB, 'models/guns/guns.glb'));
console.log(`\n== guns/guns.glb ${(fs.statSync(path.join(PUB, 'models/guns/guns.glb')).size / 1e3).toFixed(0)}KB — scenes: ${guns.scenes.map((s) => s.name).join(', ')}; node gốc: ${guns.scene.children.map((c) => c.name).join(', ')}`);
guns.scene.updateMatrixWorld(true);
for (const g of guns.scene.children) {
  const s = { name: g.name };
  const b = new THREE.Box3().setFromObject(g);
  const mz = g.getObjectByName(`${s.name}_muzzle`);
  let tris = 0;
  g.traverse((o) => { if (o.isMesh) tris += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; });
  console.log(`  ${s.name.padEnd(8)} root="${g.name}" size ${f3(b.getSize(new THREE.Vector3()))} min ${f3(b.min)} max ${f3(b.max)} muzzle ${mz ? f3(mz.getWorldPosition(new THREE.Vector3())) : '-'} tris ${tris}`);
}

let total = 0;
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else total += fs.statSync(p).size; } };
walk(PUB);
console.log(`\npublic/ tổng: ${(total / 1e6).toFixed(2)} MB`);
