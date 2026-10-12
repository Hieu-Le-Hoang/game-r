// Dựng assets/models từ model KayKit của demo2:
// - file nén meshopt + quantization (nhân vật) -> giải nén về glTF thường vì Godot không đọc EXT_meshopt_compression
// - file thường (dungeon, item) + license -> copy nguyên
// Chạy: cd tools && npm i && npm run assets
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('../../demo2/public/models/', import.meta.url).pathname;
const OUT = new URL('../assets/models/', import.meta.url).pathname;
const DROP = ['EXT_meshopt_compression', 'KHR_mesh_quantization'];

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

for (const dir of ['chars', 'dungeon', 'items', 'licenses']) {
  mkdirSync(join(OUT, dir), { recursive: true });
  for (const f of readdirSync(join(SRC, dir))) {
    const src = join(SRC, dir, f), dst = join(OUT, dir, f);
    if (!/\.(glb|gltf)$/.test(f)) { copyFileSync(src, dst); continue; } // .bin, texture, license
    const doc = await io.read(src);
    const used = doc.getRoot().listExtensionsUsed().map((e) => e.extensionName);
    if (!used.some((n) => DROP.includes(n))) { copyFileSync(src, dst); continue; }
    await doc.transform(dequantize());
    for (const e of doc.getRoot().listExtensionsUsed()) if (DROP.includes(e.extensionName)) e.dispose();
    await io.write(dst, doc);
    console.log(`${dir}/${f}: bỏ ${used.filter((n) => DROP.includes(n)).join(', ')}`);
  }
}
