// Xuất bảng xem trước mọi texture SAU khi lượng tử về 256 màu (đúng như engine sẽ vẽ) -> build/textures.png
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp, { type OverlayOptions } from 'sharp';
import { TEXTURES } from '../src/textures.ts';
import { toMipTex } from '../src/wad.ts';

const OUT = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'build');
mkdirSync(OUT, { recursive: true });
const CELL = 160;
const COLS = 8;
const rows = Math.ceil(TEXTURES.length / COLS);
const composites: OverlayOptions[] = [];
for (const [i, t] of TEXTURES.entries()) {
  const m = toMipTex(t.name, await t.make());
  const rgb = Buffer.alloc(m.w * m.h * 4);
  m.mips[0].forEach((idx, p) => {
    const masked = t.name.startsWith('{') && idx === 255;
    rgb.set(masked ? [255, 0, 255, 255] : [m.palette[idx * 3], m.palette[idx * 3 + 1], m.palette[idx * 3 + 2], 255], p * 4);
  });
  const k = Math.min(1, (CELL - 24) / Math.max(m.w, m.h));
  const tile = await sharp(rgb, { raw: { width: m.w, height: m.h, channels: 4 } }).resize(Math.round(m.w * k), Math.round(m.h * k), { kernel: 'nearest' }).png().toBuffer();
  const x = (i % COLS) * CELL;
  const y = Math.floor(i / COLS) * CELL;
  composites.push({ input: tile, left: x + 4, top: y + 4 });
  const label = `<svg xmlns="http://www.w3.org/2000/svg" width="${CELL}" height="18"><text x="4" y="13" font-family="Arial" font-size="12" fill="#fff">${t.name.replace('{', '&#123;')} ${m.w}x${m.h}</text></svg>`;
  composites.push({ input: Buffer.from(label), left: x, top: y + CELL - 18 });
}
await sharp({ create: { width: COLS * CELL, height: rows * CELL, channels: 4, background: '#202428' } }).composite(composites).png().toFile(join(OUT, 'textures.png'));
console.log(`${TEXTURES.length} texture -> ${join(OUT, 'textures.png')}`);
