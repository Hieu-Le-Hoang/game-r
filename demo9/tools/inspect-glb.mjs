// In thông số GLB: scene, bbox (đã áp transform node, bind pose), animation, skin/bone, mesh, material
//   node tools/inspect-glb.mjs <file.glb> [--bones] [--nodes]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const [file, ...flags] = process.argv.slice(2);
const doc = await io.read(file);
const root = doc.getRoot();
const f = (v) => v.map((x) => +x.toFixed(3));
for (const sc of root.listScenes()) {
  const b = getBounds(sc);
  console.log(`scene "${sc.getName()}" bbox min ${f(b.min)} max ${f(b.max)} size ${f(b.max.map((x, i) => x - b.min[i]))}`);
  if (flags.includes('--nodes')) {
    const walk = (n, d) => { const m = n.getMesh(); console.log(`${'  '.repeat(d)}${n.getName()} t=${f(n.getTranslation())} r=${f(n.getRotation())} s=${f(n.getScale())}${m ? ' mesh=' + m.getName() : ''}${n.getSkin() ? ' [skinned]' : ''}`); n.listChildren().forEach((c) => walk(c, d + 1)); };
    sc.listChildren().forEach((n) => walk(n, 1));
  }
}
console.log('animations:', root.listAnimations().map((a) => `${a.getName()}(${a.listSamplers().reduce((m, s) => Math.max(m, s.getInput()?.getMax([])[0] ?? 0), 0).toFixed(2)}s)`).join(', '));
for (const s of root.listSkins()) {
  console.log(`skin "${s.getName()}" ${s.listJoints().length} joints`);
  if (flags.includes('--bones')) console.log('  ' + s.listJoints().map((j) => j.getName()).join(', '));
}
let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
console.log(`meshes ${root.listMeshes().length}, tris ${tris}, materials: ${root.listMaterials().map((m) => `${m.getName()}#${m.getBaseColorFactor().slice(0, 3).map((x) => x.toFixed(2))}${m.getBaseColorTexture() ? '+tex' : ''}`).join(', ')}`);
console.log(`textures ${root.listTextures().length}: ${root.listTextures().map((t) => `${t.getName() || t.getURI()} ${t.getMimeType()} ${t.getSize()}`).join('; ')}`);
console.log('extensions:', root.listExtensionsUsed().map((e) => e.extensionName).join(', '));
