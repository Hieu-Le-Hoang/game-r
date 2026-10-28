// Render phần mềm model GoldSrc ở tư thế reference (rasterize tam giác + z-buffer), để tự kiểm model đã vá mà không mở game.
import sharp from 'sharp';
import type { V3 } from './brush.ts';
import { boneMatrices, fromBoneSpace, readSkins, readTextures, type StudioTexture } from './mdl.ts';

interface Tri {
  p: [V3, V3, V3];
  st: [number, number][];
  tex: number;
  n: V3;
}

/** Tam giác của model 0 mọi bodypart (hoặc model chọn theo tên bodypart). */
export function trianglesOf(m: Buffer, skins: number[], pick: (bodypart: string) => number = () => 0): Tri[] {
  const bones = boneMatrices(m);
  const nbp = m.readInt32LE(204);
  const bpi = m.readInt32LE(208);
  const out: Tri[] = [];
  for (let b = 0; b < nbp; b++) {
    const o = bpi + b * 76;
    const p = m.readInt32LE(o + 72) + pick(m.toString('latin1', o, o + 64).split('\0')[0]) * 112;
    const vinfo = m.readInt32LE(p + 84);
    const vidx = m.readInt32LE(p + 88);
    const vs: V3[] = [...Array(m.readInt32LE(p + 80))].map((_, i) => fromBoneSpace(bones[m[vinfo + i]].mat, [0, 1, 2].map((k) => m.readFloatLE(vidx + 12 * i + 4 * k)) as V3));
    for (let k = 0; k < m.readInt32LE(p + 72); k++) {
      const q = m.readInt32LE(p + 76) + k * 20;
      const tex = skins[m.readInt32LE(q + 8)];
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
          out.push({ p: [a, b2, c2], st: tri.map((x) => [x.s, x.t] as [number, number]), tex, n: [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]] });
        }
      }
    }
  }
  return out;
}

/** Render nhìn theo trục `view` ('x' | 'y' | 'z', dấu - để nhìn ngược lại), tự căn khung theo bbox. */
export async function renderTris(tris: Tri[], texs: StudioTexture[], view: '+x' | '-x' | '+y' | '-y' | '+z' | '-z', size = 300): Promise<Buffer> {
  const axis = { x: 0, y: 1, z: 2 }[view[1] as 'x' | 'y' | 'z'];
  const sign = view[0] === '+' ? 1 : -1;
  const [ua, va] = axis === 2 ? [0, 1] : axis === 0 ? [1, 2] : [0, 2];
  const all = tris.flatMap((t) => t.p);
  const lo = [0, 1, 2].map((k) => Math.min(...all.map((p) => p[k])));
  const hi = [0, 1, 2].map((k) => Math.max(...all.map((p) => p[k])));
  const k = (size * 0.9) / Math.max(hi[ua] - lo[ua], hi[va] - lo[va]);
  const proj = (p: V3): [number, number, number] => [size / 2 + (p[ua] - (lo[ua] + hi[ua]) / 2) * k * sign * (axis === 1 ? -1 : 1), size / 2 - (p[va] - (lo[va] + hi[va]) / 2) * k, p[axis] * sign];
  const img = Buffer.alloc(size * size * 3, 48);
  const zb = new Float32Array(size * size).fill(-Infinity);
  for (const tri of tris) {
    const tx = texs[tri.tex];
    const P = tri.p.map(proj);
    const area = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]);
    if (!area || !tx) continue;
    const nl = Math.hypot(...tri.n) || 1;
    const shade = 0.5 + 0.5 * Math.abs(tri.n[axis] / nl);
    for (let y = Math.max(0, Math.floor(Math.min(...P.map((p) => p[1])))); y <= Math.min(size - 1, Math.ceil(Math.max(...P.map((p) => p[1])))); y++)
      for (let x = Math.max(0, Math.floor(Math.min(...P.map((p) => p[0])))); x <= Math.min(size - 1, Math.ceil(Math.max(...P.map((p) => p[0])))); x++) {
        const w1 = ((P[2][0] - P[0][0]) * (y - P[0][1]) - (x - P[0][0]) * (P[2][1] - P[0][1])) / -area;
        const w2 = ((x - P[0][0]) * (P[1][1] - P[0][1]) - (P[1][0] - P[0][0]) * (y - P[0][1])) / -area;
        const w0 = 1 - w1 - w2;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * P[0][2] + w1 * P[1][2] + w2 * P[2][2];
        if (z <= zb[y * size + x]) continue;
        zb[y * size + x] = z;
        const s = Math.min(tx.w - 1, Math.max(0, Math.floor(w0 * tri.st[0][0] + w1 * tri.st[1][0] + w2 * tri.st[2][0])));
        const t = Math.min(tx.h - 1, Math.max(0, Math.floor(w0 * tri.st[0][1] + w1 * tri.st[1][1] + w2 * tri.st[2][1])));
        const pi = tx.pixels[t * tx.w + s];
        for (let ch = 0; ch < 3; ch++) img[(y * size + x) * 3 + ch] = Math.min(255, Math.round(tx.palette[pi * 3 + ch] * shade));
      }
  }
  return sharp(img, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
}

/** Model texture nhúng: render 3 hướng thành 1 dải ảnh. */
export async function previewEmbedded(m: Buffer, file: string, views: ('+x' | '-x' | '+y' | '-y' | '+z' | '-z')[] = ['+x', '-y', '+z']) {
  const texs = readTextures(m);
  const tris = trianglesOf(m, readSkins(m).families[0]);
  const tiles = await Promise.all(views.map((v) => renderTris(tris, texs, v)));
  await sharp({ create: { width: 300 * views.length, height: 300, channels: 3, background: '#303030' } })
    .composite(tiles.map((input, i) => ({ input, left: i * 300, top: 0 })))
    .png()
    .toFile(file);
}
