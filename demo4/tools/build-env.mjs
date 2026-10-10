// Tải asset Poly Haven (CC0) -> giảm poly, nén texture webp -> public/
//   props: gom mọi model vào 1 file public/models/props.glb (mỗi model = 1 scene, tên = id)
//   textures: bộ PBR (diff / nor_gl / arm) cho tường + sàn -> public/textures/<id>_<map>.webp
// Chạy: node tools/build-env.mjs   (file gốc cache ở game-r/_inbox/polyhaven, chạy lại không tải lại)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, weld, simplify, prune, textureCompress, quantize, reorder, mergeDocuments, unpartition } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CACHE = path.resolve(ROOT, '../_inbox/polyhaven');
const API = 'https://api.polyhaven.com';
const UA = { 'User-Agent': 'game-r-demo4 (asset pipeline)' };

// id -> số tam giác tối đa sau khi simplify (camera nhìn từ trên cao, không cần chi tiết)
const MODELS = {
  wine_barrel_01: 4000, treasure_chest: 12000, wooden_crate_01: 3000, WoodenTable_01: 2000, wooden_table_02: 2000,
  wooden_stool_01: 3000, WoodenChair_01: 5000, wooden_bucket_01: 2500, wooden_lantern_01: 3000, wooden_candlestick: 2000,
  brass_candleholders: 8000, brass_goblets: 4000, wine_bottles_01: 6000, wooden_bookshelf_worn: 5000, GothicCabinet_01: 6000,
  gothic_statue: 12000, large_iron_gate: 12000, large_castle_door: 5000, stone_fire_pit: 3000, bull_head: 6000,
  kite_shield: 3000, ornate_medieval_dagger: 3000, ornate_medieval_mace: 4000, ornate_war_hammer: 3000, antique_estoc: 3000, wooden_axe: 2000,
};
const PROP_TEX = 512;

// bộ texture môi trường: quán trọ (gỗ + gạch ấm), đại sảnh (đá tu viện + đá phiến), ngai quỷ (đá đen nứt + gạch tối)
const TEXTURES = ['wood_floor_worn', 'castle_brick_01', 'monastery_stone_floor', 'castle_wall_slates', 'slab_tiles', 'dark_brick_wall', 'rock_wall_08'];
const TEX_MAPS = { diff: 'Diffuse', nor: 'nor_gl', arm: 'arm' };
const ENV_TEX = 1024;

async function get(url, out) {
  try { await fs.access(out); return; } catch {}
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, Buffer.from(await r.arrayBuffer()));
}
const json = async (url) => (await fetch(url, { headers: UA })).json();

async function fetchModel(id) {
  const dir = path.join(CACHE, 'models', id);
  const f = (await json(`${API}/files/${id}`)).gltf['1k'].gltf;
  const main = path.join(dir, `${id}.gltf`);
  await get(f.url, main);
  for (const [rel, inc] of Object.entries(f.include)) await get(inc.url, path.join(dir, rel));
  return main;
}

async function buildProps(io) {
  const out = new Document();
  out.createBuffer();
  for (const [id, maxTris] of Object.entries(MODELS)) {
    const file = await fetchModel(id);
    const doc = await io.read(file);
    let tris = 0;
    for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
    await doc.transform(dedup(), weld());
    if (tris > maxTris) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: maxTris / tris, error: 0.01 }));
    await doc.transform(
      prune(),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [PROP_TEX, PROP_TEX], quality: 80 }),
    );
    const sc = doc.getRoot().listScenes()[0];
    sc.setName(id);
    let after = 0;
    for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) after += (p.getIndices()?.getCount() ?? 0) / 3;
    console.log(`  ${id}: ${Math.round(tris)} -> ${Math.round(after)} tris`);
    mergeDocuments(out, doc);
  }
  await out.transform(unpartition(), dedup(), prune(), reorder({ encoder: MeshoptEncoder }), quantize());
  out.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const dst = path.join(ROOT, 'public/models/props.glb');
  await io.write(dst, out);
  console.log(`props.glb: ${(await fs.stat(dst)).size / 1e6} MB, ${out.getRoot().listScenes().length} scenes`);
}

async function buildTextures() {
  const dstDir = path.join(ROOT, 'public/textures');
  await fs.mkdir(dstDir, { recursive: true });
  let total = 0;
  for (const id of TEXTURES) {
    const files = await json(`${API}/files/${id}`);
    for (const [k, key] of Object.entries(TEX_MAPS)) {
      const src = path.join(CACHE, 'textures', id, `${k}.jpg`);
      await get(files[key]['1k'].jpg.url, src);
      const dst = path.join(dstDir, `${id}_${k}.webp`);
      await sharp(src).resize(ENV_TEX, ENV_TEX).webp({ quality: k === 'nor' ? 90 : 82 }).toFile(dst);
      total += (await fs.stat(dst)).size;
    }
    console.log(`  tex ${id}`);
  }
  console.log(`textures: ${(total / 1e6).toFixed(2)} MB`);
}

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const only = process.argv[2];
if (!only || only === 'tex') await buildTextures();
if (!only || only === 'props') await buildProps(io);
