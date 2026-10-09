import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const BASE = import.meta.env.BASE_URL + 'models/';

const CHARS = ['Knight', 'Barbarian', 'Mage', 'Skeleton_Warrior', 'Skeleton_Minion', 'Skeleton_Mage'];
const DUNGEON = [
  'floor_tile_large', 'floor_tile_large_rocks', 'floor_tile_big_grate', 'wall', 'wall_cracked', 'wall_arched', 'wall_shelves', 'wall_doorway',
  'pillar', 'pillar_decorated', 'column', 'torch_mounted', 'barrel_large', 'barrel_small_stack', 'box_stacked', 'crates_stacked',
  'table_medium_decorated_A', 'table_long_decorated_A', 'chair', 'stool', 'chest', 'chest_gold', 'coin', 'coin_stack_large', 'coin_stack_small',
  'banner_red', 'banner_patternA_blue', 'banner_shield_red', 'banner_triple_yellow', 'shelf_large', 'keg_decorated', 'candle_triple',
  'rubble_large', 'rubble_half', 'sword_shield', 'trunk_medium_A', 'bottle_A_green', 'plate_food_A', 'shelves',
];
const ITEMS = [
  'sword_1handed', 'axe_1handed', 'axe_2handed', 'sword_2handed', 'staff', 'wand', 'dagger', 'shield_round', 'shield_spikes', 'shield_badge',
  'spellbook_open', 'mug_full', 'Skeleton_Blade', 'Skeleton_Axe', 'Skeleton_Staff', 'Skeleton_Shield_Small_A',
];

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();

function prep(g) {
  g.scene.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
}

export async function loadAll(onProgress) {
  const jobs = [
    ...CHARS.map((k) => [k, `${BASE}chars/${k}.glb`]),
    ...DUNGEON.map((k) => [k, `${BASE}dungeon/${k}.glb`]),
    ...ITEMS.map((k) => [k, `${BASE}items/${k}.gltf`]),
  ];
  let done = 0;
  await Promise.all(jobs.map(async ([k, url]) => {
    const g = await loader.loadAsync(url);
    prep(g);
    cache.set(k, g);
    onProgress(++done / jobs.length);
  }));
}

export const get = (k) => cache.get(k);
export function inst(k) {
  const g = cache.get(k);
  if (!g) throw new Error(`Thiếu model: ${k}`);
  return SkeletonUtils.clone(g.scene);
}

// Chụp thumbnail 3D -> dataURL (dùng cho portrait + icon item)
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
    box.setFromObject(obj);
    box.getCenter(c); box.getSize(sz);
    let span = Math.max(sz.x, sz.y, sz.z);
    if (face) { c.y = box.max.y - sz.y * 0.27; span = sz.y * 0.5; }
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
