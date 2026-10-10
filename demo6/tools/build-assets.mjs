// Build asset cho demo6 — chạy lại được khi đổi/thêm asset:
//   node tools/build-assets.mjs
// Input : ../_inbox/oga (VRoid CC0 .vrm + Quaternius Universal Animation Library 1/2, CC0)
// Output: public/models/vrm/*.vrm, public/models/anims_ual{1,2}.glb
//
// Không dùng gltf-transform (bỏ extension VRM + kéo sharp bản lỗi native). Sửa thẳng JSON + đóng gói lại binary,
// giữ nguyên thứ tự node/mesh/material/texture nên mọi index trong extension VRM vẫn đúng.
//   - texture: thu nhỏ theo loại + webp; Thumbnail/normal map -> ảnh 4px (top-down không cần)
//   - morph: chỉ giữ blink/joy/angry/sorrow/fun/A, bỏ morph normal
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const IN = path.resolve(ROOT, '../_inbox/oga');
const OUT = path.join(ROOT, 'public/models');

const AVATARS = {
  sakura: 'x_sakurada_fumiriya/Sakurada Fumiriya.vrm', // hero kiếm
  bibi: 'x_avatarsample_e/AvatarSample_E.vrm', // hero pháp sư
  vita: 'x_avatarsample_f/AvatarSample_F.vrm', // hero cung
  victoria: 'x_avatarsample_g/AvatarSample_G.vrm', // NPC tu sĩ
  shino: 'x_sendagaya_shino/Sendagaya Shino.vrm', // NPC bán thuốc
  shibu: 'x_avatarsample_d_0/AvatarSample_D.vrm', // NPC chỉ đường
  dark: 'x_avatarsample_d_darkness/AvatarSample_D_Darkness.vrm', // kẻ địch + boss
};
const KEEP_MORPH = new Set(['blink', 'blink_l', 'blink_r', 'joy', 'angry', 'sorrow', 'fun', 'a']);

const UAL = {
  ual1: {
    src: 'x_universal_animation_librarystandard/Animation Library[Standard]/Godot/AnimationLibrary_Godot_Standard.glb',
    clips: ['Idle_Loop', 'Idle_Talking_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Walk_Loop', 'Sword_Idle', 'Sword_Attack', 'Spell_Simple_Enter', 'Spell_Simple_Shoot', 'Spell_Simple_Idle_Loop', 'Pistol_Idle_Loop', 'Pistol_Shoot', 'Roll', 'Hit_Chest', 'Hit_Head', 'Death01', 'Punch_Jab', 'Punch_Cross', 'Interact', 'Jump_Start'],
  },
  ual2: {
    src: 'x_universal_animation_library_2standard/Universal Animation Library 2 [Standard]/Unreal-Godot/UAL2_Standard.glb',
    clips: ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Sword_Regular_Combo', 'Consume', 'Yes', 'Idle_No_Loop', 'Idle_FoldArms_Loop', 'LayToIdle', 'Hit_Knockback', 'Melee_Hook', 'OverhandThrow', 'Zombie_Scratch', 'Idle_Shield_Break'],
  },
};

// ---------- GLB io ----------
function readGlb(file) {
  const b = fs.readFileSync(file);
  const jl = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jl).toString('utf8'));
  const bo = 20 + jl;
  const bin = b.subarray(bo + 8, bo + 8 + b.readUInt32LE(bo));
  return { json, bin };
}
function writeGlb(file, json, bin) {
  const pad = (buf, c) => (buf.length % 4 ? Buffer.concat([buf, Buffer.alloc(4 - (buf.length % 4), c)]) : buf);
  const jb = pad(Buffer.from(JSON.stringify(json)), 0x20), bb = pad(bin, 0);
  const h = Buffer.alloc(12);
  h.writeUInt32LE(0x46546c67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + jb.length + 8 + bb.length, 8);
  const ch = (len, type) => { const c = Buffer.alloc(8); c.writeUInt32LE(len, 0); c.writeUInt32LE(type, 4); return c; };
  fs.writeFileSync(file, Buffer.concat([h, ch(jb.length, 0x4e4f534a), jb, ch(bb.length, 0x004e4942), bb]));
}

// ---------- VRM ----------
function texSize(name) {
  if (/Body|Tops|Onepiece|Bottoms/.test(name)) return 1024;
  if (/Face_00$|Hair/.test(name)) return 512;
  if (/Eye|Mouth|Brow/.test(name)) return 256;
  return 256;
}

async function buildVrm(key, rel) {
  const { json: j, bin } = readGlb(path.join(IN, rel));
  const view = (i) => { const v = j.bufferViews[i]; return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); };

  // 1) morph: giữ target được blendshape cần, bỏ NORMAL; remap index trong VRM blendShapeMaster
  const groups = j.extensions.VRM.blendShapeMaster.blendShapeGroups;
  const keepGroups = groups.filter((g) => g.presetName === 'neutral' || KEEP_MORPH.has(g.presetName));
  const need = new Map(); // mesh -> Set(index cũ)
  for (const g of keepGroups) for (const bd of g.binds) (need.get(bd.mesh) || need.set(bd.mesh, new Set()).get(bd.mesh)).add(bd.index);
  const remap = new Map();
  j.meshes.forEach((m, mi) => {
    if (!m.primitives[0].targets) return;
    const keep = [...(need.get(mi) || [])].sort((a, b) => a - b);
    const map = new Map(keep.map((o, n) => [o, n]));
    remap.set(mi, map);
    for (const p of m.primitives) {
      p.targets = keep.map((i) => ({ POSITION: p.targets[i].POSITION }));
      if (!p.targets.length) delete p.targets;
      if (p.extras?.targetNames) p.extras.targetNames = keep.map((i) => p.extras.targetNames[i]);
    }
    if (m.extras?.targetNames) m.extras.targetNames = keep.map((i) => m.extras.targetNames[i]);
    if (m.weights) m.weights = keep.map((i) => m.weights[i]);
  });
  for (const g of keepGroups) for (const bd of g.binds) bd.index = remap.get(bd.mesh).get(bd.index);
  j.extensions.VRM.blendShapeMaster.blendShapeGroups = keepGroups;

  // 2) accessor còn dùng -> đánh lại index
  const usedAcc = new Set();
  for (const m of j.meshes) for (const p of m.primitives) {
    Object.values(p.attributes).forEach((a) => usedAcc.add(a));
    if (p.indices !== undefined) usedAcc.add(p.indices);
    for (const t of p.targets || []) Object.values(t).forEach((a) => usedAcc.add(a));
  }
  for (const s of j.skins || []) if (s.inverseBindMatrices !== undefined) usedAcc.add(s.inverseBindMatrices);
  const accMap = new Map();
  const accessors = [];
  j.accessors.forEach((a, i) => { if (usedAcc.has(i)) { accMap.set(i, accessors.length); accessors.push(a); } });
  const ra = (i) => accMap.get(i);
  for (const m of j.meshes) for (const p of m.primitives) {
    for (const k in p.attributes) p.attributes[k] = ra(p.attributes[k]);
    if (p.indices !== undefined) p.indices = ra(p.indices);
    for (const t of p.targets || []) for (const k in t) t[k] = ra(t[k]);
  }
  for (const s of j.skins || []) if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = ra(s.inverseBindMatrices);
  j.accessors = accessors;

  // 3) ảnh: thu nhỏ + webp
  const imgData = new Map();
  let before = 0, after = 0;
  for (const [i, im] of j.images.entries()) {
    const src = view(im.bufferView);
    before += src.length;
    let out;
    if (im.name === 'Thumbnail' || /_nml$/.test(im.name)) {
      const c = im.name === 'Thumbnail' ? { r: 200, g: 200, b: 210 } : { r: 128, g: 128, b: 255 };
      out = await sharp({ create: { width: 4, height: 4, channels: 3, background: c } }).png().toBuffer();
      im.mimeType = 'image/png';
    } else {
      const s = texSize(im.name);
      out = await sharp(src).resize({ width: s, height: s, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84, alphaQuality: 90, effort: 5 }).toBuffer();
      im.mimeType = 'image/webp';
    }
    after += out.length;
    imgData.set(i, out);
  }
  for (const t of j.textures) {
    if (j.images[t.source].mimeType === 'image/webp') t.extensions = { ...t.extensions, EXT_texture_webp: { source: t.source } };
  }
  j.extensionsUsed = [...new Set([...(j.extensionsUsed || []), 'EXT_texture_webp'])];

  const file = path.join(OUT, 'vrm', `${key}.vrm`);
  writeGlb(file, j, repack(j, bin, imgData));
  console.log(`${key.padEnd(9)} ${(fs.statSync(path.join(IN, rel)).size / 1e6).toFixed(1)}MB -> ${(fs.statSync(file).size / 1e6).toFixed(2)}MB  (ảnh ${(before / 1e6).toFixed(1)} -> ${(after / 1e6).toFixed(2)}MB)`);
}

// đóng gói lại binary: chỉ giữ bufferView mà accessor còn dùng + ảnh (imgData: index ảnh -> bytes mới)
function repack(j, bin, imgData = new Map()) {
  const view = (i) => { const v = j.bufferViews[i]; return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); };
  const chunks = [], bvs = [], bvMap = new Map();
  let off = 0;
  const push = (buf, extra) => {
    const pad = (4 - (off % 4)) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; }
    bvs.push({ buffer: 0, byteOffset: off, byteLength: buf.length, ...extra });
    chunks.push(buf); off += buf.length;
    return bvs.length - 1;
  };
  for (const a of j.accessors || []) {
    if (a.bufferView === undefined) continue;
    if (!bvMap.has(a.bufferView)) {
      const old = j.bufferViews[a.bufferView], extra = {};
      if (old.byteStride) extra.byteStride = old.byteStride;
      if (old.target) extra.target = old.target;
      bvMap.set(a.bufferView, push(view(a.bufferView), extra));
    }
    a.bufferView = bvMap.get(a.bufferView);
  }
  for (const [i, im] of (j.images || []).entries()) im.bufferView = push(imgData.get(i) || view(im.bufferView));
  j.bufferViews = bvs;
  const out = Buffer.concat(chunks);
  j.buffers = [{ byteLength: out.length }];
  return out;
}

// ---------- animation: chỉ giữ cây xương (rest pose để retarget) + clip cần dùng ----------
function buildAnims(key, { src, clips }) {
  const { json: j, bin } = readGlb(path.join(IN, src));
  const want = new Set(clips);
  j.animations = j.animations.filter((a) => want.has(a.name));
  const miss = clips.filter((c) => !j.animations.some((a) => a.name === c));
  if (miss.length) throw new Error(`${key}: thiếu clip ${miss.join(', ')}`);
  // retarget chỉ đọc rotation (+ translation của hông) -> bỏ scale/translation các xương khác
  const HIPS = new Set(['pelvis', 'DEF-hips']);
  for (const a of j.animations) {
    a.channels = a.channels.filter((c) => c.target.path === 'rotation' || (c.target.path === 'translation' && HIPS.has(j.nodes[c.target.node].name)));
    const used = [...new Set(a.channels.map((c) => c.sampler))];
    a.samplers = used.map((i) => a.samplers[i]);
    for (const c of a.channels) c.sampler = used.indexOf(c.sampler);
  }
  for (const n of j.nodes) { delete n.mesh; delete n.skin; }
  for (const k of ['meshes', 'skins', 'materials', 'textures', 'images', 'samplers']) delete j[k];
  const accMap = new Map(), accessors = [];
  for (const a of j.animations) for (const s of a.samplers) for (const k of ['input', 'output']) {
    if (!accMap.has(s[k])) { accMap.set(s[k], accessors.length); accessors.push(j.accessors[s[k]]); }
    s[k] = accMap.get(s[k]);
  }
  j.accessors = accessors;
  const file = path.join(OUT, `anims_${key}.glb`);
  writeGlb(file, j, repack(j, bin));
  console.log(`anims_${key} ${clips.length} clip -> ${(fs.statSync(file).size / 1e6).toFixed(2)}MB`);
}

fs.mkdirSync(path.join(OUT, 'vrm'), { recursive: true });
for (const [k, rel] of Object.entries(AVATARS)) await buildVrm(k, rel);
for (const [k, cfg] of Object.entries(UAL)) buildAnims(k, cfg);
