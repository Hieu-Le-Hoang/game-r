// Nạp model glTF (nhân vật + súng). Thiếu file thì rơi về model dựng bằng khối để game vẫn chạy.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const BASE = import.meta.env.BASE_URL;

// Texture Poly Haven theo vai trò (tên file: textures/<id>_diff|nor|arm.webp)
export const TEX = {
  wall: 'sandstone_blocks_08', plaster: 'sandstone_cracks', pillar: 'sandstone_blocks_08', crate: 'weathered_brown_planks',
  roof: 'weathered_brown_planks', door: 'wooden_garage_door', metal: 'rusty_metal_02',
  sand: 'gravelly_sand', tile: 'red_sandstone_pavement', stone: 'red_sandstone_pavement',
};

export const MODELS = {
  chars: {}, // team -> { scene, animations }
  guns: {}, // id -> Object3D
};

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

async function tryLoad(url) {
  try { return await loader.loadAsync(url); } catch { return null; }
}

export async function loadModels(manifest, gunNodes, onProgress) {
  const jobs = Object.entries(manifest.chars).map(([team, file]) => ['char', team, file]);
  jobs.push(['guns', null, manifest.gunsFile]);
  let done = 0;
  await Promise.all(jobs.map(async ([kind, key, file]) => {
    const g = await tryLoad(`${BASE}models/${file}`);
    if (g) {
      g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      if (kind === 'char') MODELS.chars[key] = g;
      else {
        for (const [id, node] of Object.entries(gunNodes)) {
          const n = g.scene.getObjectByName(node);
          if (!n) continue;
          const src = n.clone(true);
          src.position.set(0, 0, 0);
          src.rotation.set(0, 0, 0);
          const mz = src.getObjectByName(`${node}_muzzle`);
          src.userData.muzzle = mz ? mz.position.clone() : new THREE.Vector3();
          MODELS.guns[id] = src;
        }
      }
    }
    onProgress?.(++done / jobs.length);
  }));
}

// ---------- Model dự phòng ----------
const mat = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
const GUN_SHAPES = {
  // [dài thân, cao, dài nòng, có báng, băng đạn cong]
  glock: [0.18, 0.11, 0.0, false, false], usp: [0.2, 0.11, 0.0, false, false], deagle: [0.25, 0.13, 0.0, false, false],
  mp5: [0.35, 0.1, 0.12, true, true], ak47: [0.45, 0.09, 0.3, true, true], m4a1: [0.42, 0.1, 0.32, true, false],
  awp: [0.55, 0.1, 0.5, true, false], knife: [0.12, 0.03, 0.18, false, false], he: [0.07, 0.07, 0, false, false], c4: [0.25, 0.08, 0, false, false],
};

// Súng hướng nòng -Z, gốc toạ độ ở tay cầm
export function fallbackGun(id) {
  const g = new THREE.Group();
  const [body, h, barrel, stock, curved] = GUN_SHAPES[id] ?? GUN_SHAPES.glock;
  const dark = mat(0x26272b, 0.6), wood = mat(id === 'ak47' ? 0x7a4a24 : 0x2d2e33, 0.7);
  if (id === 'he') {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mat(0x3d4a2a));
    g.add(m);
    return g;
  }
  if (id === 'c4') {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.14), mat(0x8a7350));
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.01, 0.06), mat(0x112211));
    pad.position.y = 0.04;
    g.add(m, pad);
    return g;
  }
  if (id === 'knife') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.035, 0.2), mat(0xb8bcc4, 0.25));
    blade.position.z = -0.12;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.03, 0.1), dark);
    g.add(blade, grip);
    return g;
  }
  const rec = new THREE.Mesh(new THREE.BoxGeometry(0.045, h, body), id === 'ak47' ? dark : dark);
  rec.position.set(0, 0.05, -body / 2 + 0.06);
  g.add(rec);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.1, 0.045), wood);
  grip.position.set(0, -0.02, 0.02);
  grip.rotation.x = -0.25;
  g.add(grip);
  if (barrel) {
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, barrel, 8), dark);
    br.rotation.x = Math.PI / 2;
    br.position.set(0, 0.07, -body + 0.06 - barrel / 2);
    g.add(br);
  }
  if (stock) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.22), wood);
    st.position.set(0, 0.03, 0.17);
    g.add(st);
  }
  if (curved || stock) {
    const mg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.15, 0.05), dark);
    mg.position.set(0, -0.04, -body * 0.35);
    mg.rotation.x = curved ? 0.35 : 0.1;
    g.add(mg);
  }
  if (id === 'awp') {
    const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 10), mat(0x14151a, 0.4));
    sc.rotation.x = Math.PI / 2;
    sc.position.set(0, 0.13, -0.12);
    g.add(sc);
    rec.material = mat(0x3c5a35, 0.7);
  }
  g.userData.muzzle = new THREE.Vector3(0, 0.07, -body + 0.06 - barrel);
  return g;
}

// Lính dựng bằng khối, có khớp để tự animate. Hướng mặt -Z, chân ở y=0, cao ~1.8m.
export function fallbackSoldier(team) {
  const T = team === 'T';
  const cloth = mat(T ? 0x8a7a5a : 0x2f3f5c), vest = mat(T ? 0x5a4f3a : 0x1f2a3a), skin = mat(0xd9a77f), dark = mat(0x1c1c1e);
  const head = mat(T ? 0x222222 : 0x2c3a2c);
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.95;
  root.add(hips);
  const torso = new THREE.Group();
  hips.add(torso);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.55, 0.26), vest);
  chest.position.y = 0.3;
  torso.add(chest);
  const neck = new THREE.Group();
  neck.position.y = 0.62;
  torso.add(neck);
  const hd = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.25, 0.24), T ? head : skin);
  hd.position.y = 0.1;
  neck.add(hd);
  if (T) {
    const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.02), skin);
    eyes.position.set(0, 0.13, -0.12);
    neck.add(eyes);
  } else {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), head);
    helm.position.y = 0.17;
    helm.scale.set(1, 0.85, 1.05);
    neck.add(helm);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 0.02), dark);
    visor.position.set(0, 0.13, -0.125);
    neck.add(visor);
  }
  const mkLimb = (w, l, m, x, y, parent) => {
    const j = new THREE.Group();
    j.position.set(x, y, 0);
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, l, w), m);
    s.position.y = -l / 2;
    j.add(s);
    parent.add(j);
    return j;
  };
  const legL = mkLimb(0.17, 0.48, cloth, -0.12, 0, hips), legR = mkLimb(0.17, 0.48, cloth, 0.12, 0, hips);
  const shinL = mkLimb(0.15, 0.47, cloth, 0, -0.48, legL), shinR = mkLimb(0.15, 0.47, cloth, 0, -0.48, legR);
  const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.26), dark); bootL.position.set(0, -0.47, -0.04); shinL.add(bootL);
  const bootR = bootL.clone(); shinR.add(bootR);
  const armL = mkLimb(0.13, 0.32, cloth, -0.3, 0.55, torso), armR = mkLimb(0.13, 0.32, cloth, 0.3, 0.55, torso);
  const foreL = mkLimb(0.12, 0.3, skin, 0, -0.32, armL), foreR = mkLimb(0.12, 0.3, skin, 0, -0.32, armR);
  const hand = new THREE.Group();
  hand.position.set(0, -0.3, 0);
  foreR.add(hand);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.userData.rig = { hips, torso, neck, legL, legR, shinL, shinR, armL, armR, foreL, foreR, hand };
  return root;
}
