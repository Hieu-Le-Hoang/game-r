// Dao -> dép tổ ong (hàm thuần, không dùng sharp): ẩn mesh lưỡi dao, gắn chiếc dép vào xương của dao, theo trục lưỡi
// cũ, gót ở phía cán. Tự dò mesh lưỡi + xương nên chạy được với skin dao bất kỳ (dùng cho gói cài của team).
import type { V3 } from './brush.ts';
import { appendBodypart, appendTexture, boneMatrices, hideMeshes, rawVertsOfBone, readSkins, readTextures, toBoneSpace, type StudioTexture } from './mdl.ts';
import { quantize } from './wad.ts';

/** File dao của CS 1.3 sẽ được vá (file nào máy không có thì bỏ qua). */
export const KNIFE_FILES = ['v_knife.mdl', 'v_knife_r.mdl', 'p_knife.mdl'];

// ---- Texture dép 128x64: nửa trái (96 px) đế vân tổ ong, dải phải (32 px) màu quai / viền
export function sandalTexture(): StudioTexture {
  const W = 128;
  const H = 64;
  const data = new Uint8Array(W * H * 4);
  const r = 5;
  const base = [169, 216, 227];
  const hole = [79, 138, 154];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let c = base;
      if (x >= 96) c = y >= 28 && y < 36 ? [95, 163, 182] : [127, 191, 208];
      else {
        // ô lục giác gần nhất trong lưới so le
        const row = Math.round(y / (r * 1.5));
        let best = Infinity;
        for (const rr of [row - 1, row, row + 1]) {
          const ox = (((rr % 2) + 2) % 2) * r * 0.87;
          const col = Math.round((x - ox) / (r * 1.75));
          for (const cc of [col - 1, col, col + 1]) {
            const dx = x - (cc * r * 1.75 + ox);
            const dy = y - rr * r * 1.5;
            // khoảng cách "lục giác" (đỉnh nhọn theo trục y)
            const d = Math.max(Math.abs(dx) * 0.866 + Math.abs(dy) * 0.5, Math.abs(dy));
            best = Math.min(best, d);
          }
        }
        if (best < r * 0.62) c = hole;
      }
      data.set([c[0], c[1], c[2], 255], (y * W + x) * 4);
    }
  return { name: 'dep_toong.bmp', flags: 0, w: W, h: H, ...quantize({ w: W, h: H, data }) };
}

// Texture tay/găng của view model. "handle" (cán dao) và "knifeskin" không tính là tay.
const HAND_LIKE = /hand(?!le)|glove|finger|knuckle|wrist|thumb|sleeve|arm|(^|[_ ])skin/i;

/** Dò lưỡi dao: mesh có texture không giống tay; xương dao = xương chứa nhiều đỉnh của các mesh đó nhất. */
export function detectKnife(m: Buffer) {
  const texs = readTextures(m);
  const skin = readSkins(m).families[0];
  const nbp = m.readInt32LE(204);
  const bpi = m.readInt32LE(208);
  const knifeMeshes: string[] = [];
  const count = new Map<number, number>();
  for (let b = 0; b < nbp; b++) {
    const o = bpi + b * 76;
    for (let k = 0; k < m.readInt32LE(o + 64); k++) {
      const p = m.readInt32LE(o + 72) + k * 112;
      const vinfo = m.readInt32LE(p + 84);
      for (let q = 0; q < m.readInt32LE(p + 72); q++) {
        const mesh = m.readInt32LE(p + 76) + q * 20;
        const tex = texs[skin[m.readInt32LE(mesh + 8)]];
        if (!tex || HAND_LIKE.test(tex.name)) continue;
        knifeMeshes.push(`${b}/${k}/${q}`);
        let c = m.readInt32LE(mesh + 4);
        for (;;) {
          const n = Math.abs(m.readInt16LE(c));
          c += 2;
          if (!n) break;
          for (let i = 0; i < n; i++, c += 8) {
            const bone = m[vinfo + m.readInt16LE(c)];
            count.set(bone, (count.get(bone) ?? 0) + 1);
          }
        }
      }
    }
  }
  if (!knifeMeshes.length) throw new Error('không tìm thấy mesh lưỡi dao (mọi texture đều giống tay)');
  const knifeBone = [...count.entries()].sort((x, y) => y[1] - x[1])[0][0];
  const bones = boneMatrices(m);
  let handBone = bones[knifeBone].parent;
  for (let b = bones[knifeBone].parent; b >= 0; b = bones[b].parent)
    if (/hand/i.test(bones[b].name)) {
      handBone = b;
      break;
    }
  return { knifeBone, handBone: Math.max(0, handBone), meshes: knifeMeshes };
}

/** Dép trong không gian xương dao: trục dài lưỡi dao = dọc dép, trục giữa = ngang dép, trục mỏng nhất = độ dày. */
export function sandal(m: Buffer, knifeBone: number, handBone: number) {
  const K = rawVertsOfBone(m, knifeBone);
  const lo = [0, 1, 2].map((c) => Math.min(...K.map((v) => v[c])));
  const hi = [0, 1, 2].map((c) => Math.max(...K.map((v) => v[c])));
  const ext = [0, 1, 2].map((c) => hi[c] - lo[c]);
  const [aL, aW, aT] = [0, 1, 2].sort((a, b) => ext[b] - ext[a]);
  const center = [0, 1, 2].map((c) => (lo[c] + hi[c]) / 2);
  const bones = boneMatrices(m);
  const hb = bones[handBone].mat;
  const hand = toBoneSpace(bones[knifeBone].mat, [hb[0][3], hb[1][3], hb[2][3]]);
  const dirL = hand[aL] < center[aL] ? 1 : -1; // gót ở đầu gần bàn tay
  const len = ext[aL] * 1.05;
  const heelAt = dirL === 1 ? lo[aL] - len * 0.05 : hi[aL] + len * 0.05;
  const P = (l: number, w: number, t: number): V3 => {
    const p = [...center] as V3;
    p[aL] = heelAt + dirL * l;
    p[aW] = center[aW] + w;
    p[aT] = center[aT] + t;
    return p;
  };
  const unit = (axis: number, s: number): V3 => {
    const v: V3 = [0, 0, 0];
    v[axis] = s;
    return v;
  };
  const th = Math.max(0.6, len * 0.05);
  const st = [0, 0.05, 0.16, 0.34, 0.52, 0.68, 0.82, 0.93, 1];
  const hw = [0.1, 0.15, 0.16, 0.13, 0.16, 0.19, 0.19, 0.15, 0.05].map((x) => x * len);
  const verts: V3[] = [];
  const normals: V3[] = [unit(aT, 1), unit(aT, -1), unit(aW, -1), unit(aW, 1), unit(aL, -dirL), unit(aL, dirL)];
  const tris: [number, number, number, number][][] = [];
  const quad = (a: number, b: number, c: number, d: number, n: number, uv: [number, number][]) => {
    const t1: [number, number, number, number][] = [[a, n, ...uv[0]], [b, n, ...uv[1]], [c, n, ...uv[2]]];
    const t2: [number, number, number, number][] = [[a, n, ...uv[0]], [c, n, ...uv[2]], [d, n, ...uv[3]]];
    tris.push(t1, [t1[0], t1[2], t1[1]], t2, [t2[0], t2[2], t2[1]]);
  };
  // Mỗi trạm: 4 đỉnh (trái-trên, phải-trên, trái-dưới, phải-dưới)
  st.forEach((s, i) => verts.push(P(s * len, -hw[i], th / 2), P(s * len, hw[i], th / 2), P(s * len, -hw[i], -th / 2), P(s * len, hw[i], -th / 2)));
  const su = (s: number) => Math.round(s * 95);
  const tv = (w: number) => Math.round((0.5 + w / (2 * len * 0.2)) * 63);
  for (let i = 0; i + 1 < st.length; i++) {
    const a = i * 4;
    const b = a + 4;
    quad(a, a + 1, b + 1, b, 0, [[su(st[i]), tv(-hw[i])], [su(st[i]), tv(hw[i])], [su(st[i + 1]), tv(hw[i + 1])], [su(st[i + 1]), tv(-hw[i + 1])]]);
    quad(a + 2, a + 3, b + 3, b + 2, 1, [[su(st[i]), tv(-hw[i])], [su(st[i]), tv(hw[i])], [su(st[i + 1]), tv(hw[i + 1])], [su(st[i + 1]), tv(-hw[i + 1])]]);
    quad(a, b, b + 2, a + 2, 2, [[100, 20], [124, 20], [124, 26], [100, 26]]);
    quad(a + 1, b + 1, b + 3, a + 3, 3, [[100, 20], [124, 20], [124, 26], [100, 26]]);
  }
  quad(0, 1, 3, 2, 4, [[100, 20], [124, 20], [124, 26], [100, 26]]);
  const e = (st.length - 1) * 4;
  quad(e, e + 1, e + 3, e + 2, 5, [[100, 20], [124, 20], [124, 26], [100, 26]]);
  // Quai ngang: dải cong qua mu bàn chân ở 70% chiều dài
  const ql = 0.7 * len;
  const qw = 0.1 * len;
  const qh = 0.13 * len;
  const qr = 0.19 * len;
  const arc = [...Array(7)].map((_, i) => Math.PI - (Math.PI * i) / 6);
  const base = verts.length;
  for (const a of arc) {
    verts.push(P(ql - qw / 2, Math.cos(a) * qr, th / 2 + Math.sin(a) * qh), P(ql + qw / 2, Math.cos(a) * qr, th / 2 + Math.sin(a) * qh));
    const nv = unit(aT, 1);
    normals.push(nv);
  }
  for (let i = 0; i + 1 < arc.length; i++) {
    const a = base + i * 2;
    quad(a, a + 1, a + 3, a + 2, 6 + i, [[100, i * 9], [127, i * 9], [127, i * 9 + 9], [100, i * 9 + 9]]);
  }
  return { verts, normals, tris, len };
}

/** Vá 1 file dao gốc thành dép. Trả về model mới + thông tin dò được. */
export function makeSandalKnife(m: Buffer, texture: StudioTexture = sandalTexture()) {
  const d = detectKnife(m);
  const before = readTextures(m).length;
  const { out, skinref } = appendTexture(hideMeshesById(m, new Set(d.meshes)), texture);
  const s = sandal(out, d.knifeBone, d.handBone);
  const res = appendBodypart(out, 'dep_toong', { bone: d.knifeBone, verts: s.verts, normals: s.normals, tris: s.tris, skinref, space: 'bone' });
  const texs = readTextures(res);
  if (res.readInt32LE(72) !== res.length || texs.length !== before + 1 || texs[readSkins(res).families[0][skinref]].name !== 'dep_toong.bmp') throw new Error('model vá hỏng');
  return { mdl: res, knifeBone: d.knifeBone, handBone: d.handBone, meshes: d.meshes, len: s.len };
}

function hideMeshesById(m: Buffer, ids: Set<string>): Buffer {
  return hideMeshes(m, (_, model, mesh, b) => ids.has(b + '/' + model + '/' + mesh));
}
