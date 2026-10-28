// Texture vẽ bằng code (không ảnh): nền màu + nhiễu, kẻ ô gạch, sọc. Dùng cho map test và chi tiết nhỏ.
import type { Rgba } from './wad.ts';

export type RGB = [number, number, number];

/** PRNG cố định để texture sinh ra giống nhau mỗi lần build. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export function blank(w: number, h: number): Rgba {
  return { w, h, data: new Uint8Array(w * h * 4) };
}

export function fill(img: Rgba, c: RGB, noise = 0, seed = 1): Rgba {
  const r = rng(seed);
  for (let i = 0; i < img.w * img.h; i++) {
    const k = 1 + (r() - 0.5) * noise;
    for (let ch = 0; ch < 3; ch++) img.data[i * 4 + ch] = Math.max(0, Math.min(255, Math.round(c[ch] * k)));
    img.data[i * 4 + 3] = 255;
  }
  return img;
}

export function rect(img: Rgba, x0: number, y0: number, x1: number, y1: number, c: RGB, a = 255) {
  for (let y = Math.max(0, y0); y < Math.min(img.h, y1); y++)
    for (let x = Math.max(0, x0); x < Math.min(img.w, x1); x++) {
      const o = (y * img.w + x) * 4;
      img.data.set(c, o);
      img.data[o + 3] = a;
    }
}

/** Lưới ô gạch: vẽ đường vữa màu `grout` dày `t` px, ô `cw` x `ch`, hàng lẻ lệch nửa ô nếu `stagger`. */
export function tiles(img: Rgba, cw: number, ch: number, t: number, grout: RGB, stagger = false) {
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const row = Math.floor(y / ch);
      const xx = (x + (stagger && row % 2 ? cw / 2 : 0)) % cw;
      if (y % ch < t || xx < t) {
        const o = (y * img.w + x) * 4;
        img.data.set(grout, o);
        img.data[o + 3] = 255;
      }
    }
}
