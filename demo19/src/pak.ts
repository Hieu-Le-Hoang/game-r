// Đọc file trong gói PACK của Quake/Half-Life (valve/pak0.pak): thư mục 64 byte/file (tên 56, vị trí, độ dài).
import { readFileSync } from 'node:fs';

export function readFromPak(pakPath: string, name: string): Buffer {
  const b = readFileSync(pakPath);
  if (b.toString('latin1', 0, 4) !== 'PACK') throw new Error(`${pakPath} không phải file PACK`);
  const off = b.readInt32LE(4);
  const len = b.readInt32LE(8);
  for (let i = 0; i < len / 64; i++) {
    const o = off + i * 64;
    if (b.toString('latin1', o, o + 56).split('\0')[0].toLowerCase() === name.toLowerCase()) {
      const p = b.readInt32LE(o + 56);
      return Buffer.from(b.subarray(p, p + b.readInt32LE(o + 60)));
    }
  }
  throw new Error(`không thấy ${name} trong ${pakPath}`);
}

/** Tạo gói PACK nhỏ (dùng cho test). */
export function writePak(files: Record<string, Buffer>): Buffer {
  const names = Object.keys(files);
  let pos = 12;
  const blobs = names.map((n) => {
    const at = pos;
    pos += files[n].length;
    return at;
  });
  const dir = Buffer.alloc(64 * names.length);
  names.forEach((n, i) => {
    dir.write(n, i * 64, 55, 'latin1');
    dir.writeInt32LE(blobs[i], i * 64 + 56);
    dir.writeInt32LE(files[n].length, i * 64 + 60);
  });
  const head = Buffer.alloc(12);
  head.write('PACK', 0, 'latin1');
  head.writeInt32LE(pos, 4);
  head.writeInt32LE(dir.length, 8);
  return Buffer.concat([head, ...names.map((n) => files[n]), dir]);
}
