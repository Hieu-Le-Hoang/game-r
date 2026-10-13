// Chụp ảnh góc nhìn thứ nhất từ sim bằng rasterizer CPU (không GPU, không browser): map màu phẳng + nhân vật GLB đúng pose.
//   npx vite-node tools/render-scene.mjs out.png [--t 20] [--seed 7] [--agent 0] [--cam x,y,z,yawDeg,pitchDeg]
// Dùng để soát bố cục map, hướng model, súng trên tay, ngồi / chết — không thay cho test trên browser (không có texture/đổ bóng).
import path from 'node:path';
import * as THREE from 'three';
import sharp from 'sharp';
import { Game, DT } from '../src/sim/game.js';
import { loadGlb } from './render-preview.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const out = args[0] ?? 'scene.png';
const opt = {};
for (let i = 1; i < args.length; i += 2) opt[args[i].replace(/^--/, '')] = args[i + 1];
const W = 960, H = 540;

const COL = { wall: [0.78, 0.64, 0.42], plaster: [0.86, 0.76, 0.56], pillar: [0.7, 0.58, 0.4], crate: [0.5, 0.33, 0.18], roof: [0.42, 0.32, 0.22], sand: [0.8, 0.7, 0.5], tile: [0.62, 0.42, 0.33], stone: [0.66, 0.56, 0.45] };

const g = await Game.create({ seed: +(opt.seed ?? 7) });
const T = +(opt.t ?? 20);
while (g.now < T) { g.step(DT); g.drain(); }

const tris = [];
const box = (min, max, col) => {
  const [x0, y0, z0] = min, [x1, y1, z1] = max;
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  for (const [a, b, c, d] of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7]]) {
    tris.push({ t: [v[a], v[b], v[c]], col }); tris.push({ t: [v[a], v[c], v[d]], col });
  }
};
for (const b of g.map.boxes) box(b.min, b.max, COL[b.mat]);
for (const f of g.map.floors) {
  const c = COL[f.mat];
  tris.push({ t: [[f.x0, 0, f.z0], [f.x1, 0, f.z0], [f.x1, 0, f.z1]], col: c }, { t: [[f.x0, 0, f.z0], [f.x1, 0, f.z1], [f.x0, 0, f.z1]], col: c });
}

// Nhân vật: pose theo trạng thái, giống client/actors.js
const chars = { T: await loadGlb(path.join(ROOT, 'public/models/chars/t.glb')), CT: await loadGlb(path.join(ROOT, 'public/models/chars/ct.glb')) };
const guns = await loadGlb(path.join(ROOT, 'public/models/guns/guns.glb'));
const SkeletonUtils = await import('three/examples/jsm/utils/SkeletonUtils.js');
const viewer = opt.cam ? null : g.agents[+(opt.agent ?? 0)];
for (const a of g.agents) {
  if (a === viewer) continue;
  const src = chars[a.team];
  const m = SkeletonUtils.clone(src.scene);
  const clipName = !a.alive ? 'Death' : a.speed > 0.5 ? 'Run' : 'Idle_Gun_Pointing';
  const mixer = new THREE.AnimationMixer(m);
  const clip = src.animations.find((c) => c.name === clipName);
  const act = mixer.clipAction(clip);
  if (!a.alive) { act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; }
  act.play();
  mixer.setTime(a.alive ? 0.3 : 5);
  const root = new THREE.Group();
  m.rotation.y = Math.PI;
  if (a.alive && a.ducking) m.scale.set(1, 0.72, 1);
  root.add(m);
  root.position.set(a.pos.x, a.pos.y + (a.alive ? 0 : a.team === 'T' ? 0.21 : 0.05), a.pos.z);
  root.rotation.y = a.yaw;
  root.updateMatrixWorld(true);
  const chest = m.getObjectByName('Chest');
  if (chest && a.alive) { chest.rotateX(-a.pitch * 0.8); }
  const node = { glock: 'glock', usp: 'usp', deagle: 'deagle', mp5: 'mp5', ak47: 'ak47', m4a1: 'm4a1', awp: 'awp', knife: 'knife', he: 'grenade' }[a.weaponId];
  if (a.alive && node) m.getObjectByName('GunSocket_R').add(guns.scene.getObjectByName(node).clone());
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  m.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry, idx = geo.index, n = idx ? idx.count : geo.attributes.position.count;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const groups = geo.groups.length ? geo.groups : [{ start: 0, count: n, materialIndex: 0 }];
    for (const gr of groups) {
      const c = mats[gr.materialIndex ?? 0]?.color ?? new THREE.Color(0.6, 0.6, 0.6);
      for (let i = gr.start; i < gr.start + gr.count; i += 3) {
        tris.push({ t: [0, 1, 2].map((k) => { o.getVertexPosition(idx ? idx.getX(i + k) : i + k, v); return v.applyMatrix4(o.matrixWorld).toArray(); }), col: [c.r, c.g, c.b] });
      }
    }
  });
}

// Camera
const cam = new THREE.PerspectiveCamera(74, W / H, 0.05, 300);
if (viewer) {
  cam.position.set(viewer.pos.x, viewer.pos.y + viewer.eyeH, viewer.pos.z);
  cam.rotation.order = 'YXZ';
  cam.rotation.set(viewer.pitch, viewer.yaw, 0);
} else {
  const [x, y, z, yaw, pitch] = opt.cam.split(',').map(Number);
  cam.position.set(x, y, z);
  cam.rotation.order = 'YXZ';
  cam.rotation.set((pitch * Math.PI) / 180, (yaw * Math.PI) / 180, 0);
}
const sun = new THREE.Vector3(0.5, 1, 0.3).normalize();
const NEAR = 0.05;

const img = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = y / H; img.set([Math.round(110 + 80 * k), Math.round(150 + 60 * k), Math.round(210 - 10 * k)], (y * W + x) * 3); }
const zb = new Float32Array(W * H).fill(0);
const p4 = new THREE.Vector4();

function clipNear(vs) {
  const outv = [];
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i], b = vs[(i + 1) % vs.length];
    const ina = a[2] <= -NEAR, inb = b[2] <= -NEAR;
    if (ina) outv.push(a);
    if (ina !== inb) { const t = (-NEAR - a[2]) / (b[2] - a[2]); outv.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, -NEAR]); }
  }
  return outv;
}
function raster(tris, cam) {
  cam.updateMatrixWorld(true);
  const view = cam.matrixWorldInverse, proj = cam.projectionMatrix;
  zb.fill(0);
  for (const { t, col } of tris) {
    const e1 = new THREE.Vector3(...t[1]).sub(new THREE.Vector3(...t[0])), e2 = new THREE.Vector3(...t[2]).sub(new THREE.Vector3(...t[0]));
    const nrm = e1.cross(e2).normalize();
    const shade = 0.55 + 0.45 * Math.abs(nrm.dot(sun));
    const vsp = t.map((p) => { p4.set(p[0], p[1], p[2], 1).applyMatrix4(view); return [p4.x, p4.y, p4.z]; });
    const poly = clipNear(vsp);
    if (poly.length < 3) continue;
    const scr = poly.map(([x, y, z]) => { p4.set(x, y, z, 1).applyMatrix4(proj); return [(p4.x / p4.w * 0.5 + 0.5) * W, (1 - (p4.y / p4.w * 0.5 + 0.5)) * H, 1 / -z, -z]; });
    for (let k = 1; k + 1 < scr.length; k++) {
      const [a, b, c] = [scr[0], scr[k], scr[k + 1]];
      const d = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
      if (Math.abs(d) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w1 = ((px - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (py - a[1])) / d, w2 = ((b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1])) / d, w0 = 1 - w1 - w2;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const iz = w0 * a[2] + w1 * b[2] + w2 * c[2], o = y * W + x;
        if (iz <= zb[o]) continue;
        zb[o] = iz;
        const dist = 1 / iz, fog = Math.min(1, Math.max(0, (dist - 45) / 115));
        const rgb = col.map((v, i) => { const lin = Math.pow(Math.max(0, v), 1 / 2.2) * 255 * shade; return Math.round(lin * (1 - fog) + [217, 207, 184][i] * fog); });
        img[o * 3] = rgb[0]; img[o * 3 + 1] = rgb[1]; img[o * 3 + 2] = rgb[2];
      }
    }
  }
}
raster(tris, cam);

// Súng góc nhìn thứ nhất (giống client/viewmodel.js: camera FOV 54 riêng, vẽ đè lên)
if (opt.vm) {
  // dùng đúng ViewModel của client (cần chạy qua vite-node vì assets.js dùng import.meta.env)
  const { MODELS } = await import('../src/client/assets.js');
  const { GUN_NODE } = await import('../src/client/models-config.js');
  const { ViewModel } = await import('../src/client/viewmodel.js');
  for (const [id, node] of Object.entries(GUN_NODE)) {
    const n = guns.scene.getObjectByName(node).clone(true);
    n.position.set(0, 0, 0);
    n.userData.muzzle = n.getObjectByName(`${node}_muzzle`)?.position.clone() ?? new THREE.Vector3();
    MODELS.guns[id] = n;
  }
  const vm = new ViewModel();
  vm.set(opt.vm);
  vm.flash.visible = false;
  const holder = vm.holder;
  holder.position.copy(vm.base);
  holder.updateMatrixWorld(true);
  const vt = [], v = new THREE.Vector3();
  holder.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry, idx = geo.index, n = idx ? idx.count : geo.attributes.position.count;
    if (!o.visible) return;
    const c = (Array.isArray(o.material) ? o.material[0] : o.material).color;
    for (let i = 0; i < n; i += 3) vt.push({ t: [0, 1, 2].map((k) => { v.fromBufferAttribute(geo.attributes.position, idx ? idx.getX(i + k) : i + k); return v.applyMatrix4(o.matrixWorld).toArray(); }), col: [c.r, c.g, c.b] });
  });
  const vcam = new THREE.PerspectiveCamera(54, W / H, 0.01, 10);
  raster(vt, vcam);
}
// tâm ngắm
for (let k = -6; k <= 6; k++) { img.set([0, 255, 0], ((H / 2) * W + W / 2 + k) * 3); img.set([0, 255, 0], ((H / 2 + k) * W + W / 2) * 3); }
const label = viewer ? `${viewer.team} ${viewer.name} t=${g.now.toFixed(1)}s round ${g.round} ${g.phase}` : `cam ${opt.cam}`;
const svg = Buffer.from(`<svg width="${W}" height="24"><text x="6" y="17" font-size="15" fill="#ff0">${label}</text></svg>`);
await sharp(img, { raw: { width: W, height: H, channels: 3 } }).composite([{ input: svg, left: 0, top: 0 }]).png().toFile(out);
console.log('wrote', out, tris.length, 'tris');
