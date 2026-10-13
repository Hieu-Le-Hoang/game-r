// Dựng map 3D từ dữ liệu sim: gộp hộp theo vật liệu, UV theo toạ độ thế giới (texture không giãn), trời + nắng sa mạc.
import * as THREE from 'three';
import { TEX } from './assets.js';

const BASE = import.meta.env.BASE_URL;

// Vai trò vật liệu -> texture + số mét mỗi lần lặp
const MATS = {
  wall: { tex: TEX.wall, rep: 3, color: 0xffffff, rough: 1 },
  plaster: { tex: TEX.plaster, rep: 4, color: 0xfff1d6, rough: 1 },
  pillar: { tex: TEX.pillar, rep: 2, color: 0xf2e6d0, rough: 1 },
  crate: { tex: TEX.crate, rep: 0, color: 0xffffff, rough: 0.9 }, // rep 0 = phủ 1 texture lên mỗi mặt
  roof: { tex: TEX.roof, rep: 2, color: 0xb8a890, rough: 1 },
  sand: { tex: TEX.sand, rep: 4, color: 0xffffff, rough: 1 },
  tile: { tex: TEX.tile, rep: 2.5, color: 0xffffff, rough: 0.95 },
  stone: { tex: TEX.stone, rep: 4, color: 0xd9cbb4, rough: 1 },
};

const loader = new THREE.TextureLoader();
const texCache = new Map();
function loadTex(file, srgb) {
  if (texCache.has(file)) return texCache.get(file);
  const t = loader.load(`${BASE}textures/${file}`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(file, t);
  return t;
}

function makeMaterial(role) {
  const m = MATS[role];
  const p = { color: m.color, roughness: m.rough, metalness: 0, vertexColors: true };
  if (m.tex) {
    p.map = loadTex(`${m.tex}_diff.webp`, true);
    p.normalMap = loadTex(`${m.tex}_nor.webp`, false);
    p.normalScale = new THREE.Vector2(0.8, 0.8);
    const arm = loadTex(`${m.tex}_arm.webp`, false);
    p.aoMap = arm; p.roughnessMap = arm; p.metalnessMap = arm;
  } else p.color = new THREE.Color(m.color);
  return new THREE.MeshStandardMaterial(p);
}

// 6 mặt hộp (bỏ đáy), UV theo mét
const FACES = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] }, { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];

class GeoBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; }
  quad(corners, n, uvs, cols) {
    const b = this.pos.length / 3;
    for (let i = 0; i < 4; i++) { this.pos.push(...corners[i]); this.nor.push(...n); this.uv.push(...uvs[i]); this.col.push(cols[i], cols[i], cols[i]); }
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  box(min, max, rep, skipBottom = true) {
    const c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const h = [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2];
    const faces = skipBottom ? FACES : [...FACES, { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] }];
    for (const f of faces) {
      const corners = [];
      const uvs = [];
      const cols = [];
      for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const p = [0, 1, 2].map((k) => c[k] + (f.n[k] + f.u[k] * su + f.v[k] * sv) * h[k]);
        corners.push(p);
        if (rep) {
          const U = f.u[0] * p[0] + f.u[1] * p[1] + f.u[2] * p[2];
          const V = f.v[0] * p[0] + f.v[1] * p[1] + f.v[2] * p[2];
          uvs.push([U / rep, V / rep]);
        } else uvs.push([(su + 1) / 2, (sv + 1) / 2]);
        // AO giả: chân tường tối hơn
        cols.push(f.n[1] === 0 ? (p[1] < 0.01 ? 0.62 : Math.min(1, 0.85 + p[1] * 0.05)) : 1);
      }
      this.quad(corners, f.n, uvs, cols);
    }
  }
  plane(x0, z0, x1, z1, y, rep) {
    const corners = [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]];
    this.quad(corners, [0, 1, 0], corners.map((p) => [p[0] / rep, -p[2] / rep]), [1, 1, 1, 1]);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('uv1', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

export function buildWorld(scene, map) {
  const builders = {};
  const B = (role) => (builders[role] ??= new GeoBuilder());
  for (const b of map.boxes) B(b.mat).box(b.min, b.max, MATS[b.mat].rep, b.mat !== 'roof');
  for (const f of map.floors) B(f.mat).plane(f.x0, f.z0, f.x1, f.z1, 0, MATS[f.mat].rep);
  const meshes = [];
  for (const [role, gb] of Object.entries(builders)) {
    const mesh = new THREE.Mesh(gb.build(), makeMaterial(role));
    mesh.castShadow = role !== 'sand' && role !== 'tile' && role !== 'stone';
    mesh.receiveShadow = true;
    mesh.name = `map_${role}`;
    scene.add(mesh);
    meshes.push(mesh);
  }

  // Chữ A / B sơn trên tường site
  for (const [k, z] of Object.entries(map.zones)) {
    if (k !== 'A' && k !== 'B') continue;
    const tex = letterTexture(k);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((z.x0 + z.x1) / 2, 0.02, (z.z0 + z.z1) / 2);
    scene.add(m);
  }

  // Trời + sương bụi
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x4f86c6) }, mid: { value: new THREE.Color(0xbcd3e6) }, bot: { value: new THREE.Color(0xe8d7b5) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP;
        void main(){ float h = clamp(vP.y, -1.0, 1.0);
          vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h, 0.0, 1.0), 0.6)) : mix(mid, bot, clamp(-h * 4.0, 0.0, 1.0));
          gl_FragColor = vec4(c, 1.0); }`,
    }),
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(0xd9cfb8, 45, 160);

  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0xb59a70, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.6);
  const [sx, sz] = map.size;
  sun.position.set(sx / 2 + 40, 70, sz / 2 + 25);
  sun.target.position.set(sx / 2, 0, sz / 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const ext = Math.max(sx, sz) * 0.62;
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 10, far: 200 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  return { meshes, sky, sun };
}

function letterTexture(ch) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(160,30,20,0.75)';
  g.font = 'bold 110px Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
