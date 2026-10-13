// Build asset cho demo9 (FPS chiến thuật kiểu CS 1.3) — chạy lại được, file gốc cache ở game-r/_inbox/demo9 (không tải lại):
//   node tools/build-assets.mjs            # tất cả
//   node tools/build-assets.mjs chars|guns|tex|sfx|lic
// Nguồn (xem CREDITS.md):
//   chars: Quaternius (CC0) qua poly.pizza — SWAT (CT), Adventurer (T); giữ skeleton + clip cần dùng, thêm node GunSocket_R
//   guns : Quaternius Ultimate Gun Pack + Toon Shooter (CC0) qua poly.pizza — chuẩn hóa trục/kích thước, gom 1 file guns.glb
//   tex  : Poly Haven (CC0) — diff / nor_gl / arm -> webp
//   sfx  : Kenney (CC0) + OpenGameArt (CC0 / CC-BY 3.0) — cắt, chuẩn hóa âm lượng -> mp3 mono
// Không chạy bất kỳ script/binary nào trong asset tải về; zip giải nén bằng python zipfile (python3 -I).
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import * as THREE from 'three';
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, quantize, reorder, resample, mergeDocuments, unpartition, transformMesh, getBounds } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { loadGlb } from './render-preview.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.resolve(ROOT, '../_inbox/demo9');
const PUB = path.join(ROOT, 'public');
const UA = { 'User-Agent': 'game-r-demo9 (asset pipeline)' };
const PP = 'https://static.poly.pizza';

async function get(url, out) {
  try { await fs.access(out); return out; } catch {}
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const b = Buffer.from(await r.arrayBuffer());
  if (b.subarray(0, 15).toString().includes('<!DOCTYPE')) throw new Error(`HTML thay vì file: ${url}`);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, b);
  return out;
}
function unzip(zip, dir) {
  if (fss.existsSync(dir)) return dir;
  fss.mkdirSync(dir, { recursive: true });
  execFileSync('python3', ['-I', '-c', 'import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', zip, dir]);
  return dir;
}
const mb = (n) => (n / 1e6).toFixed(2) + 'MB';
const kb = (n) => (n / 1e3).toFixed(0) + 'KB';

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

async function compress(doc) {
  await doc.transform(dedup(), prune({ keepLeaves: true }), reorder({ encoder: MeshoptEncoder }), quantize());
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
}

// ---------------------------------------------------------------- nhân vật
// Cả 2 model cùng rig "CharacterArmature" 62 xương + cùng bộ 24 clip (Quaternius Ultimate Animated Character Pack).
const CHARS = {
  ct: { name: 'SWAT', page: 'https://poly.pizza/m/Btfn3G5Xv4', uuid: '713f6535-f4f3-4367-a4c6-ced126ae0936' },
  t: { name: 'Adventurer', page: 'https://poly.pizza/m/5EGWBMpuXq', uuid: 'bbe369ee-a686-42c7-adad-14356f5f2f15' },
};
const CLIP_PREFIX = 'CharacterArmature|';
const KEEP_CLIPS = ['Idle', 'Idle_Neutral', 'Idle_Gun', 'Idle_Gun_Pointing', 'Idle_Gun_Shoot', 'Gun_Shoot', 'Walk', 'Run', 'Run_Back', 'Run_Left', 'Run_Right', 'Run_Shoot', 'Death', 'HitRecieve', 'HitRecieve_2', 'Interact', 'Idle_Sword', 'Sword_Slash'];
// Socket súng: đặt theo pose Idle_Gun_Pointing (tay phải duỗi ngắm thẳng). Trong socket: nòng -Z, trên +Y, đơn vị mét
// => khi pose ngắm, súng chĩa đúng hướng nhìn của nhân vật (+Z) và nằm ngang.
const SOCKET = { clip: 'Idle_Gun_Pointing', t: 0.1, lerp: 0.5, palm: 0.025, up: 0.0 };

async function socketTRS(file) {
  const gltf = await loadGlb(file);
  const root = gltf.scene;
  const mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(gltf.animations.find((a) => a.name === CLIP_PREFIX + SOCKET.clip)).play();
  mixer.setTime(SOCKET.t);
  root.updateMatrixWorld(true);
  const P = (n) => root.getObjectByName(n).getWorldPosition(new THREE.Vector3());
  const wrist = P('WristR'), mid = P('Middle2R'), idx = P('Index2R'), pinky = P('Pinky2R');
  const fwd = mid.clone().sub(wrist).normalize();
  // pháp tuyến lòng bàn tay: vuông góc với hướng ngón và trục ngón trỏ->ngón út, chọn chiều hướng xuống (tay cầm súng úp)
  let palm = new THREE.Vector3().crossVectors(fwd, idx.clone().sub(pinky)).normalize();
  if (palm.y > 0) palm.negate();
  const grip = wrist.clone().lerp(mid, SOCKET.lerp).addScaledVector(palm, SOCKET.palm).add(new THREE.Vector3(0, SOCKET.up, 0));
  const desired = new THREE.Matrix4().compose(grip, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI), new THREE.Vector3(1, 1, 1));
  const local = root.getObjectByName('WristR').matrixWorld.clone().invert().multiply(desired);
  const t = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  local.decompose(t, q, s);
  return { t: t.toArray(), q: q.toArray(), s: s.toArray(), grip: grip.toArray() };
}

async function buildChars() {
  const dir = path.join(PUB, 'models/chars');
  await fs.mkdir(dir, { recursive: true });
  for (const [id, c] of Object.entries(CHARS)) {
    const src = await get(`${PP}/${c.uuid}.glb`, path.join(CACHE, 'polypizza', `${c.name}.glb`));
    const doc = await io.read(src);
    const root = doc.getRoot();
    for (const a of root.listAnimations()) {
      const n = a.getName().replace(CLIP_PREFIX, '');
      if (KEEP_CLIPS.includes(n)) a.setName(n); else a.dispose();
    }
    const miss = KEEP_CLIPS.filter((n) => !root.listAnimations().some((a) => a.getName() === n));
    if (miss.length) throw new Error(`${id}: thiếu clip ${miss}`);
    const sk = await socketTRS(src);
    const wrist = root.listNodes().find((n) => n.getName() === 'Wrist.R');
    wrist.addChild(doc.createNode('GunSocket_R').setTranslation(sk.t).setRotation(sk.q).setScale(sk.s));
    root.listScenes()[0].setName(id);
    await doc.transform(resample());
    await compress(doc);
    const out = path.join(dir, `${id}.glb`);
    await io.write(out, doc);
    console.log(`  char ${id} (${c.name}): ${mb(fss.statSync(src).size)} -> ${kb(fss.statSync(out).size)}, ${root.listAnimations().length} clip, socket grip ${sk.grip.map((x) => x.toFixed(3))}`);
  }
}

// ---------------------------------------------------------------- súng
// Model gốc: nòng +X, trên +Y, gốc ở tay cầm (đã soát bằng render-preview). Chuẩn hóa: nòng -Z, trên +Y, gốc giữ ở tay cầm,
// scale theo chiều dài thật (m). axis = trục dài gốc dùng để đo; rot = ma trận xoay (cột = ảnh của X,Y,Z gốc).
const ROT_GUN = [0, 0, -1, 0, 1, 0, 1, 0, 0]; // X->-Z, Y->Y, Z->X  (xoay +90° quanh Y)
const ROT_KNIFE = [0, -1, 0, 0, 0, -1, 1, 0, 0]; // lưỡi +Y -> -Z, mặt phẳng lưỡi đứng (dày theo X), sống dao +Y
const ROT_ID = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const GUNS = {
  glock: { page: 'J3i9KDQ3kt', uuid: 'f5a88c73-af97-49ca-8650-4bde579d2f80', title: 'Pistol (Ultimate Gun Pack)', len: 0.19, axis: 0, rot: ROT_GUN },
  usp: { page: 'Jyn9qex4ba', uuid: '3b53f0fe-f86e-451c-816d-6ab9bd265cdc', title: 'Pistol (Ultimate Gun Pack)', len: 0.2, axis: 0, rot: ROT_GUN },
  deagle: { page: '52kQzphmeF', uuid: '7a31b522-5632-41d9-8274-031795af5d8d', title: 'Pistol (Ultimate Gun Pack)', len: 0.27, axis: 0, rot: ROT_GUN },
  mp5: { page: '7ehatxr7FY', uuid: 'fb8ae707-d5b9-4eb8-ab8c-1c78d3c1f710', title: 'Submachine Gun (Ultimate Gun Pack)', len: 0.6, axis: 0, rot: ROT_GUN },
  ak47: { page: 'K2lXTYFSLC', uuid: 'b3e6be61-0299-4866-a227-58f5f3fe610b', title: 'Assault Rifle (Ultimate Gun Pack)', len: 0.88, axis: 0, rot: ROT_GUN },
  m4a1: { page: 'Bgvuu4CUMV', uuid: '9a0e478c-de82-4773-9b70-a0219bb0057c', title: 'Assault Rifle (Ultimate Gun Pack)', len: 0.84, axis: 0, rot: ROT_GUN },
  awp: { page: 'TKaBjAEofL', uuid: 'd9962f20-fdce-42a5-81c8-2847a4487447', title: 'Sniper Rifle (Ultimate Gun Pack)', len: 1.18, axis: 0, rot: ROT_GUN },
  m3: { page: 'DcNE0HVdW8', uuid: '032e6589-3188-41bc-b92b-e25528344275', title: 'Shotgun (Ultimate Gun Pack)', len: 1.0, axis: 0, rot: ROT_GUN },
  knife: { page: 'NNzzvlGXzO', uuid: '6196245f-ecfc-44d9-b3fc-cad9565d76bc', title: 'Knife (Ultimate Gun Pack)', len: 0.3, axis: 1, rot: ROT_KNIFE },
  grenade: { page: 'xnuUzBTsUg', uuid: 'd3a086a7-e545-4cc0-a279-7cd2da2020b8', title: 'Grenade (Toon Shooter Game Kit)', len: 0.12, axis: 1, rot: ROT_ID },
};

function mat4(rot, s) { // column-major 4x4 từ 3x3 (cột) * scale
  const [a, b, c, d, e, f, g, h, i] = rot;
  return [a * s, b * s, c * s, 0, d * s, e * s, f * s, 0, g * s, h * s, i * s, 0, 0, 0, 0, 1];
}
function mul4(A, B) { // A*B column-major
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += A[k * 4 + r] * B[c * 4 + k];
  return o;
}

async function buildGuns() {
  const out = new Document();
  out.createBuffer();
  const info = {};
  for (const [id, g] of Object.entries(GUNS)) {
    const src = await get(`${PP}/${g.uuid}.glb`, path.join(CACHE, 'polypizza/guns', `${id}.glb`));
    const doc = await io.read(src);
    const scene = doc.getRoot().listScenes()[0];
    const raw = getBounds(scene);
    const s = g.len / (raw.max[g.axis] - raw.min[g.axis]);
    const fix = mat4(g.rot, s);
    const meshNodes = [];
    scene.traverse((n) => { if (n.getMesh()) meshNodes.push(n); });
    if (meshNodes.length !== 1) throw new Error(`${id}: ${meshNodes.length} mesh node`);
    const [mn] = meshNodes;
    transformMesh(mn.getMesh(), mul4(fix, mn.getWorldMatrix()));
    for (const n of scene.listChildren()) scene.removeChild(n);
    const gunRoot = doc.createNode(id);
    const meshNode = doc.createNode(`${id}_mesh`).setMesh(mn.getMesh());
    gunRoot.addChild(meshNode);
    scene.addChild(gunRoot);
    // đầu nòng: trung bình các đỉnh nằm trong 1.5% chiều dài phía trước nhất (-Z)
    const b = getBounds(scene);
    if (id !== 'grenade') {
      let sx = 0, sy = 0, n = 0;
      for (const p of mn.getMesh().listPrimitives()) {
        const pos = p.getAttribute('POSITION'), v = [0, 0, 0];
        for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); if (v[2] < b.min[2] + 0.015 * g.len) { sx += v[0]; sy += v[1]; n++; } }
      }
      gunRoot.addChild(doc.createNode(`${id}_muzzle`).setTranslation([sx / n, sy / n, b.min[2]]));
      info[id] = { muzzle: [sx / n, sy / n, b.min[2]] };
    } else info[id] = {};
    info[id].bbox = { min: b.min, max: b.max };
    mergeDocuments(out, doc);
  }
  // gom về 1 scene "guns": mỗi súng = 1 node gốc tên = id (đặt chồng tại gốc tọa độ, game tự clone).
  // (không để scene trùng tên node: GLTFLoader sẽ đổi tên node thành "<id>_1")
  const [main, ...rest] = out.getRoot().listScenes();
  main.setName('guns');
  for (const sc of rest) { for (const n of sc.listChildren()) main.addChild(n); sc.dispose(); }
  out.getRoot().setDefaultScene(main);
  await out.transform(unpartition());
  await compress(out);
  const dir = path.join(PUB, 'models/guns');
  await fs.mkdir(dir, { recursive: true });
  const dst = path.join(dir, 'guns.glb');
  await io.write(dst, out);
  console.log(`  guns.glb: ${kb(fss.statSync(dst).size)}, nodes: ${main.listChildren().map((n) => n.getName()).join(' ')}`);
  return info;
}

// ---------------------------------------------------------------- texture Poly Haven
const TEXTURES = {
  gravelly_sand: 1024, // nền cát/đất ngoài trời
  sandstone_blocks_08: 1024, // tường gạch sa thạch (khối lớn màu kem)
  sandstone_cracks: 1024, // tường thạch cao/vữa vàng nứt (nhà, tường bao)
  red_sandstone_pavement: 1024, // đá lát (sân, lối đi, bậc thềm)
  weathered_brown_planks: 512, // gỗ thùng crate
  wooden_garage_door: 1024, // cửa gỗ lớn (cổng kiểu de_dust)
  rusty_metal_02: 512, // kim loại gỉ (cửa sắt, mái tôn, thùng phuy)
};
const TEX_MAPS = { diff: 'Diffuse', nor: 'nor_gl', arm: 'arm' };
async function buildTextures() {
  const dst = path.join(PUB, 'textures');
  await fs.mkdir(dst, { recursive: true });
  let total = 0;
  for (const [id, size] of Object.entries(TEXTURES)) {
    const files = await (await fetch(`https://api.polyhaven.com/files/${id}`, { headers: UA })).json();
    let sum = 0;
    for (const [k, key] of Object.entries(TEX_MAPS)) {
      const src = await get(files[key]['1k'].jpg.url, path.join(CACHE, 'polyhaven', id, `${k}.jpg`));
      const out = path.join(dst, `${id}_${k}.webp`);
      await sharp(src).resize(size, size).webp({ quality: k === 'nor' ? 88 : 80 }).toFile(out);
      sum += fss.statSync(out).size;
    }
    total += sum;
    console.log(`  tex ${id} ${size}: ${kb(sum)}`);
  }
  console.log(`  textures: ${mb(total)}`);
}

// ---------------------------------------------------------------- âm thanh
const KENNEY = {
  impact: 'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip',
  interface: 'https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip',
};
const OGA = 'https://opengameart.org/sites/default/files';
const SRC = {
  tabasco: async () => path.join(unzip(await get(`${OGA}/sounds.zip`, path.join(CACHE, 'oga/gunshot-sounds/sounds.zip')), path.join(CACHE, 'oga/gunshot-sounds/x')), 'sounds'),
  kurt: async (f) => get(`${OGA}/${encodeURIComponent(f)}`, path.join(CACHE, 'oga/gunshots', f.replace(/ /g, '_'))),
  springy: async (f) => get(`${OGA}/${f}`, path.join(CACHE, 'oga/gun-reload-sounds', f)),
  starninjas: async () => unzip(await get(`${OGA}/gun_reload_-_starninjas.zip`, path.join(CACHE, 'oga/2-gun-reloads/gun_reload_-_starninjas.zip')), path.join(CACHE, 'oga/2-gun-reloads/x')),
  kenney: async (pack) => unzip(await get(KENNEY[pack], path.join(CACHE, `kenney/${pack}.zip`)), path.join(CACHE, `kenney/x_${pack}`)),
};
const kfile = async (pack, name) => {
  const d = await SRC.kenney(pack);
  const hit = execFileSync('find', [d, '-name', name]).toString().trim().split('\n')[0];
  if (!hit) throw new Error(`kenney ${pack}: không thấy ${name}`);
  return hit;
};
// out: [nguồn, start(s), dur(s)|null, opts]; opts.pitch = hệ số cao độ, opts.fade = fade-out cuối (s), opts.gain = dB so với chuẩn
const SFX = {
  pistol: [async () => path.join(await SRC.tabasco(), 'cz.wav'), 0.2, 0.75, { fade: 0.35 }],
  deagle: [() => SRC.kurt('22 Magnum.wav'), 0.2, 0.6, { fade: 0.3, pitch: 0.9 }],
  smg: [() => get(`${OGA}/gunfire_sfx.wav`, path.join(CACHE, 'oga/random-gunfire-sfx/gunfire_sfx.wav')), 0, 0.45, { fade: 0.25 }],
  ak47: [async () => path.join(await SRC.tabasco(), 'sks.wav'), 0.3, 0.75, { fade: 0.4 }],
  m4a1: [async () => path.join(await SRC.tabasco(), 'sks.wav'), 5.96, 0.65, { fade: 0.35, pitch: 1.12 }],
  awp: [async () => path.join(await SRC.tabasco(), 'mosin.wav'), 0.4, 1.2, { fade: 0.6 }],
  awp_bolt: [async () => path.join(await SRC.tabasco(), 'mosin.wav'), 1.62, 1.8, { fade: 0.2, gain: -4 }],
  shotgun: [async () => path.join(await SRC.tabasco(), 'shotty.wav'), 0, null, { fade: 0.2 }],
  reload_rifle: [() => SRC.springy('assaultriflereload1_0.wav'), 0, null, { gain: -3 }],
  reload_pistol: [() => SRC.springy('gunreload1.wav'), 0, null, { gain: -3 }],
  pump: [() => SRC.springy('shotguncock_0.wav'), 0, null, { gain: -3 }],
  deploy: [async () => path.join(await SRC.starninjas(), 'gun_reload.1.ogg'), 0, null, { gain: -5 }],
  dryfire: [() => get(`${OGA}/gun_reload_lock_or_click_sound.mp3`, path.join(CACHE, 'oga/gun-reload-lock-or-click-sound/gun_reload_lock_or_click_sound.mp3')), 0, null, { gain: -6 }],
  step_1: [() => kfile('impact', 'footstep_concrete_000.ogg'), 0, null, { gain: -8 }],
  step_2: [() => kfile('impact', 'footstep_concrete_001.ogg'), 0, null, { gain: -8 }],
  step_3: [() => kfile('impact', 'footstep_concrete_002.ogg'), 0, null, { gain: -8 }],
  step_4: [() => kfile('impact', 'footstep_concrete_003.ogg'), 0, null, { gain: -8 }],
  shell_1: [() => kfile('impact', 'impactMetal_light_000.ogg'), 0, null, { pitch: 1.7, gain: -12 }],
  shell_2: [() => kfile('impact', 'impactMetal_light_001.ogg'), 0, null, { pitch: 1.8, gain: -12 }],
  shell_3: [() => kfile('impact', 'impactMetal_light_002.ogg'), 0, null, { pitch: 1.6, gain: -12 }],
  explode: [() => get(`${OGA}/Chunky%20Explosion.mp3`, path.join(CACHE, 'oga/chunky-explosion/Chunky_Explosion.mp3')), 0, 2.8, { fade: 1.2 }],
  grenade_bounce: [() => kfile('impact', 'impactMetal_medium_000.ogg'), 0, null, { pitch: 1.3, gain: -6 }],
  hit_body: [() => kfile('impact', 'impactPunch_medium_000.ogg'), 0, null, { gain: -3 }],
  hit_helmet: [() => kfile('impact', 'impactMetal_light_003.ogg'), 0, null, { pitch: 1.3, gain: -3 }],
  knife_hit: [() => kfile('impact', 'impactPunch_heavy_000.ogg'), 0, null, { gain: -3 }],
  c4_plant: [() => kfile('impact', 'impactPlate_light_000.ogg'), 0, null, { gain: -4 }],
  c4_press: [() => kfile('interface', 'click_002.ogg'), 0, null, { gain: -6 }],
  c4_beep: ['synth:beep', 0, 0.12, { gain: -8 }], // tự tổng hợp bằng ffmpeg (sine 2.4kHz), không có nguồn ngoài
};

// ffmpeg ghi log volumedetect ra stderr -> dùng spawnSync để lấy stderr kể cả khi exit 0
const ffStderr = (args) => spawnSync('ffmpeg', args, { encoding: 'utf8' }).stderr;

async function buildSfx() {
  const dir = path.join(PUB, 'sounds');
  await fs.mkdir(dir, { recursive: true });
  let total = 0;
  for (const [id, [src, start, dur, opt]] of Object.entries(SFX)) {
    const input = src === 'synth:beep' ? ['-f', 'lavfi', '-i', 'sine=frequency=2400:sample_rate=44100:duration=0.12'] : ['-i', await src()];
    const af = [];
    if (src !== 'synth:beep') af.push(`atrim=start=${start}${dur ? `:duration=${dur}` : ''}`, 'asetpts=PTS-STARTPTS');
    af.push('aformat=channel_layouts=mono', 'aresample=44100');
    if (opt.pitch) af.push(`asetrate=${Math.round(44100 * opt.pitch)}`, 'aresample=44100');
    af.push('afade=t=in:d=0.003');
    const len = dur ? dur / (opt.pitch || 1) : null;
    if (opt.fade && len) af.push(`afade=t=out:st=${Math.max(0, len - opt.fade).toFixed(3)}:d=${opt.fade}`);
    if (src === 'synth:beep') af.push('afade=t=out:st=0.08:d=0.04');
    // chuẩn hóa đỉnh về -1 dBFS (+ gain riêng), đo bằng volumedetect
    const m = /max_volume: (-?[\d.]+) dB/.exec(ffStderr(['-hide_banner', '-nostats', ...input, '-af', [...af, 'volumedetect'].join(','), '-f', 'null', '-']));
    const peak = m ? +m[1] : 0;
    af.push(`volume=${(-1 - peak + (opt.gain || 0)).toFixed(2)}dB`, 'alimiter=limit=0.95');
    const out = path.join(dir, `${id}.mp3`);
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...input, '-af', af.join(','), '-c:a', 'libmp3lame', '-q:a', '5', out]);
    total += fss.statSync(out).size;
  }
  console.log(`  sounds: ${Object.keys(SFX).length} file, ${mb(total)}`);
}

// ---------------------------------------------------------------- license
async function writeLicenses() {
  const dir = path.join(PUB, 'models/licenses');
  await fs.mkdir(dir, { recursive: true });
  const cc0 = 'Creative Commons Zero v1.0 Universal (CC0 1.0) — https://creativecommons.org/publicdomain/zero/1.0/\nPublic domain: dùng tự do (cả thương mại), không bắt buộc ghi công.\n';
  await fs.writeFile(path.join(dir, 'quaternius.txt'), `Quaternius — https://quaternius.com (mirror tải GLB: https://poly.pizza/u/Quaternius)\n${cc0}\nNhân vật (Ultimate Animated Character Pack):\n${Object.entries(CHARS).map(([id, c]) => `  chars/${id}.glb <- "${c.name}" ${c.page}`).join('\n')}\n\nSúng (Ultimate Gun Pack; grenade từ Toon Shooter Game Kit):\n${Object.entries(GUNS).map(([id, g]) => `  guns.glb#${id} <- "${g.title}" https://poly.pizza/m/${g.page}`).join('\n')}\n`);
  await fs.writeFile(path.join(dir, 'polyhaven.txt'), `Poly Haven — https://polyhaven.com (texture)\n${cc0}\n${Object.keys(TEXTURES).map((id) => `  textures/${id}_{diff,nor,arm}.webp <- https://polyhaven.com/a/${id}`).join('\n')}\n`);
  const kl = path.join(await SRC.kenney('impact'), 'License.txt');
  await fs.writeFile(path.join(dir, 'kenney.txt'), `Kenney — https://kenney.nl (Impact Sounds, Interface Sounds)\n${cc0}\nFile license gốc (Impact Sounds):\n${fss.readFileSync(kl, 'utf8')}`);
  const tab = path.join(await SRC.tabasco(), 'creativecommons.txt');
  await fs.writeFile(path.join(dir, 'opengameart-sounds.txt'), [
    'Âm thanh từ OpenGameArt.org:',
    '',
    '  pistol, ak47, m4a1, awp, awp_bolt, shotgun <- "Gunshot Sounds" by Tabasco — https://opengameart.org/content/gunshot-sounds',
    '    OGA ghi CC0, nhưng file creativecommons.txt trong gói ghi CC-BY 3.0 (Vincent Sevedge, 2009) -> xử lý như CC-BY 3.0, GHI CÔNG:',
    '    "Gunshot sounds by Vincent Sevedge (Tabasco), CC-BY 3.0 — https://creativecommons.org/licenses/by/3.0/"',
    `    Nội dung file gốc: ${fss.readFileSync(tab, 'utf8').trim().replace(/\s+/g, ' ')}`,
    '  deagle <- "Gunshots" by kurt — https://opengameart.org/content/gunshots (CC0)',
    '  smg <- "Random gunfire SFX" by iamoneabe — https://opengameart.org/content/random-gunfire-sfx (CC0)',
    '  reload_rifle, reload_pistol, pump <- "Gun reload sounds" by SpringySpringo — https://opengameart.org/content/gun-reload-sounds (CC0)',
    '  deploy <- "2 Gun Reloads" by StarNinjas — https://opengameart.org/content/2-gun-reloads (CC0)',
    '  dryfire <- "Gun reload, lock or click sound" by pauliuw — https://opengameart.org/content/gun-reload-lock-or-click-sound (CC0)',
    '  explode <- "Chunky Explosion" by Joth — https://opengameart.org/content/chunky-explosion (CC0)',
    '  c4_beep <- tự tổng hợp (sine 2.4 kHz) trong build-assets.mjs',
    '',
  ].join('\n'));
  console.log('  licenses ok');
}

const only = process.argv[2];
const run = async (k, f) => { if (!only || only === k) { console.log(`[${k}]`); await f(); } };
await run('chars', buildChars);
await run('guns', async () => { const info = await buildGuns(); await fs.writeFile(path.join(CACHE, 'guns-info.json'), JSON.stringify(info, null, 1)); });
await run('tex', buildTextures);
await run('sfx', buildSfx);
await run('lic', writeLicenses);
