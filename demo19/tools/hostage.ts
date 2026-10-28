// Con tin "bà bán rong": lấy scientist.mdl + scientistT.mdl từ valve/pak0.pak, vá bằng src/patch-hostage.ts.
//   tsx tools/hostage.ts            -> build/model/bt_bantrong.mdl + bt_bantrongT.mdl + ảnh xem trước
//   tsx tools/hostage.ts --install  -> copy 2 file vào cstrike/models (file mới, không đụng scientist.mdl)
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { V3 } from '../src/brush.ts';
import { boneMatrices, fromBoneSpace } from '../src/mdl.ts';
import { readFromPak } from '../src/pak.ts';
import { makeHostage } from '../src/patch-hostage.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'build', 'model');
const PAK = process.env.HL_PAK ?? 'E:\\Game\\HL\\valve\\pak0.pak';
const CS_MODELS = process.env.CS_MODELS ?? 'E:\\Game\\HL\\cstrike\\models';
mkdirSync(OUT, { recursive: true });
const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x)));

const h = makeHostage(readFromPak(PAK, 'models/scientist.mdl'), readFromPak(PAK, 'models/scientistt.mdl'));
const { FWD, SIDE } = h;
const finalMdl = h.mdl;
const newTexs = h.texs;
const newSkins = h.skins;
writeFileSync(join(OUT, 'bt_bantrong.mdl'), h.mdl);
writeFileSync(join(OUT, 'bt_bantrongT.mdl'), h.tex);
console.log(`[model] đầu: rộng ${h.info.headW.toFixed(1)}, đỉnh z ${h.info.top.toFixed(1)} -> nón R ${h.info.R.toFixed(1)} cao ${h.info.H.toFixed(1)}`);
console.log(`[model] bt_bantrong.mdl ${h.mdl.length} B, bt_bantrongT.mdl ${h.tex.length} B (${newTexs.length} texture, ${newSkins[0].length} skinref)`);


// ---- 4. Ảnh xem trước: rasterize mesh tư thế reference (thân + đầu số `headNo` + nón), nhìn trước và nghiêng
function meshes(m: Buffer, headNo: number) {
  const bones = boneMatrices(m);
  const nbp = m.readInt32LE(204);
  const bpi = m.readInt32LE(208);
  const out: { p: V3[]; st: [number, number][]; tex: number; n: V3 }[] = [];
  for (let b = 0; b < nbp; b++) {
    const o = bpi + b * 76;
    const name = m.toString('latin1', o, o + 64).split('\0')[0];
    const pick = name === 'heads' ? headNo : name === 'needle' ? 0 : 0;
    const p = m.readInt32LE(o + 72) + pick * 112;
    const nv = m.readInt32LE(p + 80);
    const vinfo = m.readInt32LE(p + 84);
    const vidx = m.readInt32LE(p + 88);
    const vs: V3[] = [...Array(nv)].map((_, i) => fromBoneSpace(bones[m[vinfo + i]].mat, [0, 1, 2].map((k) => m.readFloatLE(vidx + 12 * i + 4 * k)) as V3));
    for (let k = 0; k < m.readInt32LE(p + 72); k++) {
      const q = m.readInt32LE(p + 76) + k * 20;
      const texi = newSkins[0][m.readInt32LE(q + 8)];
      let c = m.readInt32LE(q + 4);
      for (;;) {
        let n = m.readInt16LE(c);
        c += 2;
        if (!n) break;
        const fan = n < 0;
        n = Math.abs(n);
        const vv: { v: number; s: number; t: number }[] = [];
        for (let i = 0; i < n; i++, c += 8) vv.push({ v: m.readInt16LE(c), s: m.readInt16LE(c + 4), t: m.readInt16LE(c + 6) });
        for (let i = 2; i < n; i++) {
          const tri = fan ? [vv[0], vv[i - 1], vv[i]] : [vv[i - 2], vv[i - 1], vv[i]];
          const [a, b2, c2] = tri.map((x) => vs[x.v]);
          const u = [b2[0] - a[0], b2[1] - a[1], b2[2] - a[2]];
          const w = [c2[0] - a[0], c2[1] - a[1], c2[2] - a[2]];
          const nn: V3 = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
          out.push({ p: [a, b2, c2], st: tri.map((x) => [x.s, x.t] as [number, number]), tex: texi, n: nn });
        }
      }
    }
  }
  return out;
}
async function render(headNo: number, view: 'front' | 'side') {
  const W = 220;
  const Hh = 360;
  const k = 4.2;
  const img = Buffer.alloc(W * Hh * 3, 48);
  const zb = new Float32Array(W * Hh).fill(-Infinity);
  // Nhìn trước: camera đặt phía mặt (theo FWD); nhìn nghiêng: camera đặt bên hông (theo SIDE)
  const dot2 = (p: V3, d: V3) => p[0] * d[0] + p[1] * d[1];
  const proj = (p: V3): [number, number, number] => (view === 'front' ? [W / 2 - dot2(p, SIDE) * k, Hh - 12 - p[2] * k, dot2(p, FWD)] : [W / 2 + dot2(p, FWD) * k, Hh - 12 - p[2] * k, -dot2(p, SIDE)]);
  const light: V3 = view === 'front' ? [FWD[0] * 0.8 + SIDE[0] * 0.3, FWD[1] * 0.8 + SIDE[1] * 0.3, 0.5] : [SIDE[0] * -0.8 + FWD[0] * 0.3, SIDE[1] * -0.8 + FWD[1] * 0.3, 0.5];
  for (const tri of meshes(finalMdl, headNo)) {
    const tx = newTexs[tri.tex];
    const P = tri.p.map(proj);
    const nl = Math.hypot(...tri.n) || 1;
    const shade = 0.45 + 0.55 * Math.abs((tri.n[0] * light[0] + tri.n[1] * light[1] + tri.n[2] * light[2]) / nl);
    const [x0, x1] = [Math.floor(Math.min(...P.map((p) => p[0]))), Math.ceil(Math.max(...P.map((p) => p[0])))];
    const [y0, y1] = [Math.floor(Math.min(...P.map((p) => p[1]))), Math.ceil(Math.max(...P.map((p) => p[1])))];
    const area = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]);
    if (!area) continue;
    for (let y = Math.max(0, y0); y <= Math.min(Hh - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
        const w1 = ((P[2][0] - P[0][0]) * (y - P[0][1]) - (x - P[0][0]) * (P[2][1] - P[0][1])) / -area;
        const w2 = ((x - P[0][0]) * (P[1][1] - P[0][1]) - (P[1][0] - P[0][0]) * (y - P[0][1])) / -area;
        const w0 = 1 - w1 - w2;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * P[0][2] + w1 * P[1][2] + w2 * P[2][2];
        if (z <= zb[y * W + x]) continue;
        zb[y * W + x] = z;
        const s = Math.min(tx.w - 1, Math.max(0, Math.floor(w0 * tri.st[0][0] + w1 * tri.st[1][0] + w2 * tri.st[2][0])));
        const t = Math.min(tx.h - 1, Math.max(0, Math.floor(w0 * tri.st[0][1] + w1 * tri.st[1][1] + w2 * tri.st[2][1])));
        const pi = tx.pixels[t * tx.w + s];
        for (let ch = 0; ch < 3; ch++) img[(y * W + x) * 3 + ch] = clamp(tx.palette[pi * 3 + ch] * shade);
      }
  }
  return sharp(img, { raw: { width: W, height: Hh, channels: 3 } }).png().toBuffer();
}
const tiles = [];
for (let h = 0; h < 4; h++) tiles.push({ input: await render(h, 'front'), left: h * 220, top: 0 }, { input: await render(h, 'side'), left: h * 220, top: 360 });
await sharp({ create: { width: 880, height: 720, channels: 3, background: '#303030' } }).composite(tiles).png().toFile(join(OUT, 'preview.png'));
console.log(`[model] ảnh xem trước 4 kiểu đầu -> ${join(OUT, 'preview.png')}`);

if (process.argv.includes('--install')) {
  if (!existsSync(CS_MODELS)) throw new Error(`không thấy ${CS_MODELS}`);
  copyFileSync(join(OUT, 'bt_bantrong.mdl'), join(CS_MODELS, 'bt_bantrong.mdl'));
  copyFileSync(join(OUT, 'bt_bantrongT.mdl'), join(CS_MODELS, 'bt_bantrongT.mdl'));
  console.log(`[install] bt_bantrong.mdl + bt_bantrongT.mdl -> ${CS_MODELS}`);
}
