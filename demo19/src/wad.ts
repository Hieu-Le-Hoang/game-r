// WAD3 (texture GoldSrc): ảnh RGBA -> 256 màu (median cut) + 4 mức mipmap.
// Texture trong suốt (tên bắt đầu '{'): pixel alpha < 128 -> index 255 = xanh (0,0,255), engine bỏ qua khi vẽ.

export interface Rgba {
  w: number;
  h: number;
  data: Uint8Array; // RGBA
}

export interface MipTex {
  name: string;
  w: number;
  h: number;
  palette: Uint8Array; // 256 * 3
  mips: Uint8Array[]; // 4 mức, index màu
}

const MAX_SIDE = 256;

/** Median cut trên các pixel đặc. Trả về palette tối đa `n` màu. */
function medianCut(px: Uint8Array, count: number, n: number): number[][] {
  type Box = { idx: Uint32Array };
  const all = new Uint32Array(count);
  for (let i = 0; i < count; i++) all[i] = i;
  let boxes: Box[] = [{ idx: all }];
  const range = (b: Box) => {
    let best = -1;
    let ch = 0;
    for (let c = 0; c < 3; c++) {
      let lo = 255;
      let hi = 0;
      for (const i of b.idx) {
        const v = px[i * 3 + c];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      if (hi - lo > best) {
        best = hi - lo;
        ch = c;
      }
    }
    return { best, ch };
  };
  while (boxes.length < n) {
    let pick = -1;
    let pickScore = 0;
    let pickCh = 0;
    for (let k = 0; k < boxes.length; k++) {
      if (boxes[k].idx.length < 2) continue;
      const { best, ch } = range(boxes[k]);
      const score = best * Math.sqrt(boxes[k].idx.length);
      if (score > pickScore) {
        pickScore = score;
        pick = k;
        pickCh = ch;
      }
    }
    if (pick < 0) break;
    const b = boxes[pick];
    const sorted = Array.from(b.idx).sort((a, c) => px[a * 3 + pickCh] - px[c * 3 + pickCh]);
    const mid = sorted.length >> 1;
    boxes.splice(pick, 1, { idx: Uint32Array.from(sorted.slice(0, mid)) }, { idx: Uint32Array.from(sorted.slice(mid)) });
  }
  return boxes.map((b) => {
    const s = [0, 0, 0];
    for (const i of b.idx) for (let c = 0; c < 3; c++) s[c] += px[i * 3 + c];
    return s.map((v) => Math.round(v / Math.max(1, b.idx.length)));
  });
}

/** Thu nhỏ 1/2 bằng trung bình 2x2. Với texture trong suốt: ô con trong suốt nếu >= 2 pixel trong suốt. */
function half(img: Rgba): Rgba {
  const w = img.w >> 1;
  const h = img.h >> 1;
  const d = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const acc = [0, 0, 0];
      let solid = 0;
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const o = ((y * 2 + dy) * img.w + x * 2 + dx) * 4;
          if (img.data[o + 3] < 128) continue;
          solid++;
          for (let c = 0; c < 3; c++) acc[c] += img.data[o + c];
        }
      const o = (y * w + x) * 4;
      if (solid >= 2) {
        for (let c = 0; c < 3; c++) d[o + c] = Math.round(acc[c] / solid);
        d[o + 3] = 255;
      }
    }
  return { w, h, data: d };
}

/** Ảnh RGB(A) bất kỳ kích thước -> 256 màu (texture model studio, không cần mipmap). */
export function quantize(img: Rgba): { palette: Uint8Array; pixels: Uint8Array } {
  const px = new Uint8Array(img.w * img.h * 3);
  for (let i = 0; i < img.w * img.h; i++) px.set(img.data.subarray(i * 4, i * 4 + 3), i * 3);
  const colors = medianCut(px, img.w * img.h, 256);
  const palette = new Uint8Array(768);
  colors.forEach((c, i) => palette.set(c, i * 3));
  const cache = new Map<number, number>();
  const pixels = new Uint8Array(img.w * img.h);
  for (let i = 0; i < pixels.length; i++) {
    const [r, g, b] = [px[i * 3], px[i * 3 + 1], px[i * 3 + 2]];
    const key = (r << 16) | (g << 8) | b;
    let best = cache.get(key);
    if (best === undefined) {
      let bd = Infinity;
      best = 0;
      for (let k = 0; k < colors.length; k++) {
        const d = (colors[k][0] - r) ** 2 + (colors[k][1] - g) ** 2 + (colors[k][2] - b) ** 2;
        if (d < bd) (bd = d), (best = k);
      }
      cache.set(key, best);
    }
    pixels[i] = best;
  }
  return { palette, pixels };
}

export function toMipTex(name: string, img: Rgba): MipTex {
  if (name.length > 15) throw new Error(`tên texture quá 15 ký tự: ${name}`);
  if (img.w % 16 || img.h % 16 || img.w > MAX_SIDE || img.h > MAX_SIDE)
    throw new Error(`${name}: kích thước ${img.w}x${img.h} phải chia hết 16 và <= ${MAX_SIDE}`);
  const masked = name.startsWith('{');
  const levels = [img];
  for (let i = 1; i < 4; i++) levels.push(half(levels[i - 1]));

  // Palette tính trên ảnh gốc, chỉ pixel đặc.
  const solid: number[] = [];
  for (let i = 0; i < img.w * img.h; i++) if (!masked || img.data[i * 4 + 3] >= 128) solid.push(img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]);
  const colors = solid.length ? medianCut(Uint8Array.from(solid), solid.length / 3, masked ? 255 : 256) : [[0, 0, 0]];
  const palette = new Uint8Array(768);
  colors.forEach((c, i) => palette.set(c, i * 3));
  if (masked) palette.set([0, 0, 255], 255 * 3);

  const cache = new Map<number, number>();
  const nearest = (r: number, g: number, b: number) => {
    const key = (r << 16) | (g << 8) | b;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < colors.length; i++) {
      const c = colors[i];
      const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    cache.set(key, best);
    return best;
  };
  const mips = levels.map((lv) => {
    const out = new Uint8Array(lv.w * lv.h);
    for (let i = 0; i < out.length; i++) {
      const o = i * 4;
      out[i] = masked && lv.data[o + 3] < 128 ? 255 : nearest(lv.data[o], lv.data[o + 1], lv.data[o + 2]);
    }
    return out;
  });
  return { name, w: img.w, h: img.h, palette, mips };
}

export function writeWad(texs: MipTex[]): Buffer {
  const lumps: Buffer[] = [];
  for (const t of texs) {
    const mipBytes = t.mips.reduce((s, m) => s + m.length, 0);
    const size = 40 + mipBytes + 2 + 768 + 2;
    const b = Buffer.alloc(size);
    b.write(t.name, 0, 16, 'latin1');
    b.writeUInt32LE(t.w, 16);
    b.writeUInt32LE(t.h, 20);
    let off = 40;
    t.mips.forEach((m, i) => {
      b.writeUInt32LE(off, 24 + i * 4);
      b.set(m, off);
      off += m.length;
    });
    b.writeUInt16LE(256, off);
    b.set(t.palette, off + 2);
    lumps.push(b);
  }
  const header = 12;
  let pos = header;
  const dir = Buffer.alloc(32 * texs.length);
  texs.forEach((t, i) => {
    const o = i * 32;
    dir.writeInt32LE(pos, o);
    dir.writeInt32LE(lumps[i].length, o + 4);
    dir.writeInt32LE(lumps[i].length, o + 8);
    dir.writeUInt8(0x43, o + 12); // miptex
    dir.write(t.name, o + 16, 16, 'latin1');
    pos += lumps[i].length;
  });
  const head = Buffer.alloc(header);
  head.write('WAD3', 0, 'latin1');
  head.writeInt32LE(texs.length, 4);
  head.writeInt32LE(pos, 8);
  return Buffer.concat([head, ...lumps, dir]);
}

/** Đọc lại WAD3 (cho selftest): tên + kích thước + mip0. */
export function readWad(buf: Buffer): { name: string; w: number; h: number; mip0: Uint8Array; palette: Uint8Array }[] {
  if (buf.toString('latin1', 0, 4) !== 'WAD3') throw new Error('không phải WAD3');
  const n = buf.readInt32LE(4);
  const dir = buf.readInt32LE(8);
  const out = [];
  for (let i = 0; i < n; i++) {
    const o = dir + i * 32;
    const pos = buf.readInt32LE(o);
    const w = buf.readUInt32LE(pos + 16);
    const h = buf.readUInt32LE(pos + 20);
    const m0 = buf.readUInt32LE(pos + 24);
    const m3 = buf.readUInt32LE(pos + 36);
    const palAt = pos + m3 + (w >> 3) * (h >> 3) + 2;
    out.push({
      name: buf.toString('latin1', o + 16, o + 32).split('\0')[0],
      w,
      h,
      mip0: new Uint8Array(buf.subarray(pos + m0, pos + m0 + w * h)),
      palette: new Uint8Array(buf.subarray(palAt, palAt + 768)),
    });
  }
  return out;
}
