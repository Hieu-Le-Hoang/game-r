// Đọc / vá model GoldSrc (IDST v10). Không decompile: dữ liệu mới được nối vào CUỐI file và chỉ sửa con trỏ trong
// header, nên mọi offset cũ vẫn đúng. Dùng cho con tin bà bán rong: thêm bodypart nón lá + đổi texture.
import type { V3 } from './brush.ts';

export interface StudioTexture {
  name: string;
  flags: number;
  w: number;
  h: number;
  pixels: Uint8Array; // index màu
  palette: Uint8Array; // 256 * 3
}

const H = {
  length: 72, numbones: 140, boneindex: 144, numtextures: 180, textureindex: 184, texturedataindex: 188,
  numskinref: 192, numskinfamilies: 196, skinindex: 200, numbodyparts: 204, bodypartindex: 208,
};

export function readTextures(t: Buffer): StudioTexture[] {
  const n = t.readInt32LE(H.numtextures);
  const at = t.readInt32LE(H.textureindex);
  return [...Array(n)].map((_, i) => {
    const o = at + i * 80;
    const w = t.readInt32LE(o + 68);
    const h = t.readInt32LE(o + 72);
    const idx = t.readInt32LE(o + 76);
    return {
      name: t.toString('latin1', o, o + 64).split('\0')[0],
      flags: t.readInt32LE(o + 64),
      w,
      h,
      pixels: new Uint8Array(t.subarray(idx, idx + w * h)),
      palette: new Uint8Array(t.subarray(idx + w * h, idx + w * h + 768)),
    };
  });
}

export function readSkins(t: Buffer): { numskinref: number; families: number[][] } {
  const ref = t.readInt32LE(H.numskinref);
  const fam = t.readInt32LE(H.numskinfamilies);
  const at = t.readInt32LE(H.skinindex);
  return { numskinref: ref, families: [...Array(fam)].map((_, f) => [...Array(ref)].map((_, r) => t.readInt16LE(at + 2 * (f * ref + r)))) };
}

/** Ghi lại file texture (T.mdl) từ đầu: header 244 byte + bảng texture + bảng skin + dữ liệu ảnh. */
export function writeTextureFile(base: Buffer, texs: StudioTexture[], skins: number[][]): Buffer {
  const head = Buffer.from(base.subarray(0, 244));
  const texTable = Buffer.alloc(80 * texs.length);
  const ref = skins[0].length;
  const skinTable = Buffer.alloc(2 * ref * skins.length);
  skins.forEach((row, f) => row.forEach((v, r) => skinTable.writeInt16LE(v, 2 * (f * ref + r))));
  let pos = 244 + texTable.length + skinTable.length;
  pos += (4 - (pos % 4)) % 4;
  const dataStart = pos;
  const blobs: Buffer[] = [];
  texs.forEach((tx, i) => {
    const o = i * 80;
    texTable.write(tx.name, o, 63, 'latin1');
    texTable.writeInt32LE(tx.flags, o + 64);
    texTable.writeInt32LE(tx.w, o + 68);
    texTable.writeInt32LE(tx.h, o + 72);
    texTable.writeInt32LE(pos, o + 76);
    blobs.push(Buffer.from(tx.pixels), Buffer.from(tx.palette));
    pos += tx.w * tx.h + 768;
  });
  const pad = Buffer.alloc(dataStart - (244 + texTable.length + skinTable.length));
  const out = Buffer.concat([head, texTable, skinTable, pad, ...blobs]);
  out.writeInt32LE(out.length, H.length);
  out.writeInt32LE(texs.length, H.numtextures);
  out.writeInt32LE(244, H.textureindex);
  out.writeInt32LE(dataStart, H.texturedataindex);
  out.writeInt32LE(ref, H.numskinref);
  out.writeInt32LE(skins.length, H.numskinfamilies);
  out.writeInt32LE(244 + texTable.length, H.skinindex);
  return out;
}

// ---- Xương: tư thế mặc định (giá trị value[] của bone = tư thế reference khi compile)
type M34 = number[][]; // 3x4
function angleMatrix(x: number, y: number, z: number): number[][] {
  // AngleQuaternion + QuaternionMatrix của studio: góc (roll, pitch, yaw) theo trục X, Y, Z
  const [sr, cr] = [Math.sin(x), Math.cos(x)];
  const [sp, cp] = [Math.sin(y), Math.cos(y)];
  const [sy, cy] = [Math.sin(z), Math.cos(z)];
  return [
    [cp * cy, sr * sp * cy - cr * sy, cr * sp * cy + sr * sy],
    [cp * sy, sr * sp * sy + cr * cy, cr * sp * sy - sr * cy],
    [-sp, sr * cp, cr * cp],
  ];
}
const mul = (a: M34, b: M34): M34 =>
  [0, 1, 2].map((i) => [0, 1, 2, 3].map((j) => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j] + (j === 3 ? a[i][3] : 0)));

export function boneMatrices(m: Buffer): { name: string; parent: number; mat: M34 }[] {
  const n = m.readInt32LE(H.numbones);
  const at = m.readInt32LE(H.boneindex);
  const out: { name: string; parent: number; mat: M34 }[] = [];
  for (let i = 0; i < n; i++) {
    const o = at + i * 112;
    const v = [0, 1, 2, 3, 4, 5].map((k) => m.readFloatLE(o + 64 + 4 * k));
    const r = angleMatrix(v[3], v[4], v[5]);
    const local: M34 = r.map((row, k) => [...row, v[k]]);
    const parent = m.readInt32LE(o + 32);
    out.push({ name: m.toString('latin1', o, o + 32).split('\0')[0], parent, mat: parent < 0 ? local : mul(out[parent].mat, local) });
  }
  return out;
}

/** Điểm trong không gian model -> không gian xương (nghịch đảo ma trận cứng). */
export function toBoneSpace(mat: M34, p: V3): V3 {
  const d = [p[0] - mat[0][3], p[1] - mat[1][3], p[2] - mat[2][3]];
  return [0, 1, 2].map((j) => mat[0][j] * d[0] + mat[1][j] * d[1] + mat[2][j] * d[2]) as V3;
}
export function dirToBoneSpace(mat: M34, d: V3): V3 {
  return [0, 1, 2].map((j) => mat[0][j] * d[0] + mat[1][j] * d[1] + mat[2][j] * d[2]) as V3;
}
export function fromBoneSpace(mat: M34, p: V3): V3 {
  return [0, 1, 2].map((i) => mat[i][0] * p[0] + mat[i][1] * p[1] + mat[i][2] * p[2] + mat[i][3]) as V3;
}

/** Đỉnh (đã ở không gian model, tư thế reference) của các submodel gắn với xương `bone`. */
export function modelVertsOfBone(m: Buffer, bone: number): V3[] {
  const bones = boneMatrices(m);
  const out: V3[] = [];
  const nbp = m.readInt32LE(H.numbodyparts);
  const bpi = m.readInt32LE(H.bodypartindex);
  for (let b = 0; b < nbp; b++) {
    const o = bpi + b * 76;
    const nm = m.readInt32LE(o + 64);
    const mi = m.readInt32LE(o + 72);
    for (let k = 0; k < nm; k++) {
      const p = mi + k * 112;
      const nv = m.readInt32LE(p + 80);
      const vinfo = m.readInt32LE(p + 84);
      const vidx = m.readInt32LE(p + 88);
      for (let i = 0; i < nv; i++) {
        if (m[vinfo + i] !== bone) continue;
        const v: V3 = [m.readFloatLE(vidx + 12 * i), m.readFloatLE(vidx + 12 * i + 4), m.readFloatLE(vidx + 12 * i + 8)];
        out.push(fromBoneSpace(bones[bone].mat, v));
      }
    }
  }
  return out;
}

export interface NewMesh {
  bone: number;
  verts: V3[]; // không gian model (tư thế reference)
  normals: V3[]; // không gian model
  /** Tam giác: [đỉnh, pháp tuyến, s, t] x 3 (s, t tính bằng texel). */
  tris: [number, number, number, number][][];
  skinref: number;
}

/**
 * Chỗ chèn dữ liệu mới. Model có texture nhúng (numtextures > 0): engine chỉ giữ phần TRƯỚC texturedataindex sau khi
 * nạp texture, nên dữ liệu mới phải chèn trước vùng ảnh, rồi dời con trỏ ảnh đi `delta`. Model texture ngoài: nối cuối.
 */
function insertionPoint(m: Buffer): number {
  return m.readInt32LE(H.numtextures) > 0 ? m.readInt32LE(H.texturedataindex) : m.length;
}
function spliceAt(m: Buffer, P: number, block: Buffer): Buffer {
  const out = Buffer.concat([m.subarray(0, P), block, m.subarray(P)]);
  if (m.readInt32LE(H.numtextures) > 0) {
    const n = out.readInt32LE(H.numtextures);
    const ti = out.readInt32LE(H.textureindex);
    for (let i = 0; i < n; i++) {
      const o = ti + i * 80 + 76;
      const idx = out.readInt32LE(o);
      if (idx >= P) out.writeInt32LE(idx + block.length, o);
    }
    out.writeInt32LE(out.readInt32LE(H.texturedataindex) + block.length, H.texturedataindex);
  }
  out.writeInt32LE(out.length, H.length);
  return out;
}

/** Ẩn mesh: ghi lệnh kết thúc (0) vào đầu danh sách tam giác. Engine vẽ theo lệnh nên mesh không còn hiện. */
export function hideMeshes(m: Buffer, pick: (bodypart: string, model: number, mesh: number, bodypartIndex: number) => boolean): Buffer {
  const out = Buffer.from(m);
  const nbp = out.readInt32LE(H.numbodyparts);
  const bpi = out.readInt32LE(H.bodypartindex);
  for (let b = 0; b < nbp; b++) {
    const o = bpi + b * 76;
    const name = out.toString('latin1', o, o + 64).split('\0')[0];
    for (let k = 0; k < out.readInt32LE(o + 64); k++) {
      const p = out.readInt32LE(o + 72) + k * 112;
      for (let q = 0; q < out.readInt32LE(p + 72); q++) {
        const mesh = out.readInt32LE(p + 76) + q * 20;
        if (pick(name, k, q, b)) out.writeInt16LE(0, out.readInt32LE(mesh + 4));
      }
    }
  }
  return out;
}

/** Đỉnh thô (không gian xương) của mọi submodel gắn với xương `bone`. */
export function rawVertsOfBone(m: Buffer, bone: number): V3[] {
  const out: V3[] = [];
  const nbp = m.readInt32LE(H.numbodyparts);
  const bpi = m.readInt32LE(H.bodypartindex);
  for (let b = 0; b < nbp; b++) {
    const o = bpi + b * 76;
    for (let k = 0; k < m.readInt32LE(o + 64); k++) {
      const p = m.readInt32LE(o + 72) + k * 112;
      const vinfo = m.readInt32LE(p + 84);
      const vidx = m.readInt32LE(p + 88);
      for (let i = 0; i < m.readInt32LE(p + 80); i++)
        if (m[vinfo + i] === bone) out.push([0, 1, 2].map((c) => m.readFloatLE(vidx + 12 * i + 4 * c)) as V3);
    }
  }
  return out;
}

/** Thêm 1 texture vào model có texture nhúng (vũ khí). Trả về file mới + skinref trỏ tới texture đó. */
export function appendTexture(m: Buffer, tx: StudioTexture): { out: Buffer; skinref: number } {
  const n = m.readInt32LE(H.numtextures);
  if (!n) throw new Error('appendTexture chỉ dành cho model có texture nhúng');
  const P = m.readInt32LE(H.texturedataindex);
  const ref = m.readInt32LE(H.numskinref);
  const fam = m.readInt32LE(H.numskinfamilies);
  const pad0 = (4 - (P % 4)) % 4;
  const tableAt = P + pad0;
  const skinAt = tableAt + 80 * (n + 1);
  const skinBytes = 2 * fam * (ref + 1);
  const block = Buffer.alloc(pad0 + 80 * (n + 1) + skinBytes + ((4 - (skinBytes % 4)) % 4));
  const delta = block.length;
  m.copy(block, pad0, m.readInt32LE(H.textureindex), m.readInt32LE(H.textureindex) + 80 * n);
  for (let i = 0; i < n; i++) {
    const o = pad0 + i * 80 + 76;
    block.writeInt32LE(block.readInt32LE(o) + delta, o);
  }
  const no = pad0 + 80 * n;
  block.write(tx.name, no, 63, 'latin1');
  block.writeInt32LE(tx.flags, no + 64);
  block.writeInt32LE(tx.w, no + 68);
  block.writeInt32LE(tx.h, no + 72);
  block.writeInt32LE(m.length + delta, no + 76); // ảnh mới nằm cuối file
  const si = m.readInt32LE(H.skinindex);
  for (let f = 0; f < fam; f++) {
    for (let r = 0; r < ref; r++) block.writeInt16LE(m.readInt16LE(si + 2 * (f * ref + r)), skinAt - P + 2 * (f * (ref + 1) + r));
    block.writeInt16LE(n, skinAt - P + 2 * (f * (ref + 1) + ref));
  }
  const out = Buffer.concat([m.subarray(0, P), block, m.subarray(P), Buffer.from(tx.pixels), Buffer.from(tx.palette)]);
  out.writeInt32LE(n + 1, H.numtextures);
  out.writeInt32LE(tableAt, H.textureindex);
  out.writeInt32LE(P + delta, H.texturedataindex);
  out.writeInt32LE(ref + 1, H.numskinref);
  out.writeInt32LE(skinAt, H.skinindex);
  out.writeInt32LE(out.length, H.length);
  return { out, skinref: ref };
}

/** Thêm 1 bodypart (1 submodel, 1 mesh). Đỉnh cho ở không gian model (tư thế reference) hoặc không gian xương. */
export function appendBodypart(m: Buffer, name: string, mesh: NewMesh & { space?: 'model' | 'bone' }): Buffer {
  const bones = boneMatrices(m);
  const mat = bones[mesh.bone].mat;
  const inBone = mesh.space === 'bone';
  const nbp = m.readInt32LE(H.numbodyparts);
  const bpi = m.readInt32LE(H.bodypartindex);
  let base = 1;
  for (let b = 0; b < nbp; b++) base *= m.readInt32LE(bpi + b * 76 + 64);

  const P = insertionPoint(m);
  const chunks: Buffer[] = [];
  let pos = P + ((4 - (P % 4)) % 4);
  const pad = Buffer.alloc(pos - P);
  const put = (buf: Buffer) => {
    const at = pos;
    const aligned = Buffer.concat([buf, Buffer.alloc((4 - (buf.length % 4)) % 4)]);
    chunks.push(aligned);
    pos += aligned.length;
    return at;
  };
  const f32 = (vs: V3[]) => {
    const b = Buffer.alloc(12 * vs.length);
    vs.forEach((v, i) => v.forEach((x, c) => b.writeFloatLE(x, 12 * i + 4 * c)));
    return b;
  };
  const vinfo = put(Buffer.alloc(mesh.verts.length, mesh.bone));
  const ninfo = put(Buffer.alloc(mesh.normals.length, mesh.bone));
  const vidx = put(f32(inBone ? mesh.verts : mesh.verts.map((v) => toBoneSpace(mat, v))));
  const nidx = put(f32(inBone ? mesh.normals : mesh.normals.map((n) => dirToBoneSpace(mat, n))));
  // Lệnh tam giác: mỗi tam giác là 1 "strip" 3 đỉnh, kết thúc bằng 0
  const cmds = Buffer.alloc(2 * (mesh.tris.length * 13 + 1));
  let c = 0;
  for (const tri of mesh.tris) {
    cmds.writeInt16LE(3, c);
    c += 2;
    for (const [vi, ni, s, t] of tri) for (const x of [vi, ni, s, t]) (cmds.writeInt16LE(x, c), (c += 2));
  }
  const triidx = put(cmds);
  const meshBuf = Buffer.alloc(20);
  meshBuf.writeInt32LE(mesh.tris.length, 0);
  meshBuf.writeInt32LE(triidx, 4);
  meshBuf.writeInt32LE(mesh.skinref, 8);
  meshBuf.writeInt32LE(mesh.normals.length, 12);
  meshBuf.writeInt32LE(0, 16);
  const meshidx = put(meshBuf);
  const model = Buffer.alloc(112);
  model.write(name, 0, 63, 'latin1');
  model.writeInt32LE(1, 72);
  model.writeInt32LE(meshidx, 76);
  model.writeInt32LE(mesh.verts.length, 80);
  model.writeInt32LE(vinfo, 84);
  model.writeInt32LE(vidx, 88);
  model.writeInt32LE(mesh.normals.length, 92);
  model.writeInt32LE(ninfo, 96);
  model.writeInt32LE(nidx, 100);
  const modelidx = put(model);
  // Bảng bodypart mới = bảng cũ + 1 dòng
  const table = Buffer.alloc(76 * (nbp + 1));
  m.copy(table, 0, bpi, bpi + 76 * nbp);
  table.write(name, 76 * nbp, 63, 'latin1');
  table.writeInt32LE(1, 76 * nbp + 64);
  table.writeInt32LE(base, 76 * nbp + 68);
  table.writeInt32LE(modelidx, 76 * nbp + 72);
  const tableidx = put(table);

  const out = spliceAt(m, P, Buffer.concat([pad, ...chunks]));
  out.writeInt32LE(nbp + 1, H.numbodyparts);
  out.writeInt32LE(tableidx, H.bodypartindex);
  return out;
}

/** Đổi tên model trong header (engine dùng tên file để tìm <tên>T.mdl, trường này chỉ để nhận diện). */
export function setName(m: Buffer, name: string): Buffer {
  const out = Buffer.from(m);
  out.fill(0, 8, 72);
  out.write(name, 8, 63, 'latin1');
  return out;
}
