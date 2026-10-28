// Con tin "bà bán rong": vá scientist.mdl + scientistT.mdl (nhuộm áo bà ba hoa, quần đen, tóc đen, bỏ ria; gắn nón lá
// + búi tóc vào xương đầu). Hàm thuần, không dùng sharp: dùng chung cho tools/hostage.ts và gói cài cho team (src/cli.ts).
import type { V3 } from './brush.ts';
import { appendBodypart, boneMatrices, modelVertsOfBone, readSkins, readTextures, setName, writeTextureFile, type StudioTexture } from './mdl.ts';
import { quantize, type Rgba } from './wad.ts';

/** Map gắn key model này cho hostage_entity. CS 1.3 đọc pev->model nên chỉ map này dùng, map khác vẫn là scientist. */
export const HOSTAGE_MODEL = 'models/bt_bantrong.mdl';
const HEAD_BONE = 20;

export function makeHostage(mdl: Buffer, tex: Buffer) {
  // ---- 2. Nhuộm texture
  type RGB = [number, number, number];
  const toRgba = (t: StudioTexture): Rgba => {
    const data = new Uint8Array(t.w * t.h * 4);
    t.pixels.forEach((p, i) => (data.set(t.palette.subarray(p * 3, p * 3 + 3), i * 4), (data[i * 4 + 3] = 255)));
    return { w: t.w, h: t.h, data };
  };
  const lum = (c: ArrayLike<number>, o = 0) => 0.3 * c[o] + 0.59 * c[o + 1] + 0.11 * c[o + 2];
  const sat = (c: ArrayLike<number>, o = 0) => {
    const mx = Math.max(c[o], c[o + 1], c[o + 2]);
    return mx ? (mx - Math.min(c[o], c[o + 1], c[o + 2])) / mx : 0;
  };
  const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x)));

  /** Giữ nếp vải: độ sáng gốc chia cho mức sáng phổ biến (phân vị 75) của texture. */
  function shading(img: Rgba) {
    const ls = [...Array(img.w * img.h)].map((_, i) => lum(img.data, i * 4)).sort((a, b) => a - b);
    const ref = ls[Math.floor(ls.length * 0.75)] || 1;
    return (i: number) => Math.max(0.45, Math.min(1.15, lum(img.data, i * 4) / ref));
  }

  /** Vải hoa áo bà ba: nền tím hoa cà, hoa 5 cánh trắng nhụy vàng, lặp mỗi 14 texel. */
  function floral(x: number, y: number): RGB {
    const cell = 14;
    const row = Math.floor(y / cell);
    const cx = ((x + (row % 2) * 7) % cell) - cell / 2;
    const cy = (y % cell) - cell / 2;
    const r = Math.hypot(cx, cy);
    const petal = 3.2 + 1.3 * Math.cos(5 * Math.atan2(cy, cx));
    if (r < 1.3) return [240, 200, 60];
    if (r < petal) return [246, 236, 244];
    return [150, 104, 176];
  }

  function recolor(t: StudioTexture, fn: (rgb: RGB, x: number, y: number, s: number) => RGB): StudioTexture {
    const img = toRgba(t);
    const sh = shading(img);
    const out = new Uint8Array(img.data);
    for (let y = 0; y < t.h; y++)
      for (let x = 0; x < t.w; x++) {
        const i = y * t.w + x;
        const c = fn([img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]], x, y, sh(i));
        out.set(c.map(clamp), i * 4);
      }
    const q = quantize({ w: t.w, h: t.h, data: out });
    return { ...t, ...q };
  }

  const shirt = (_: RGB, x: number, y: number, s: number): RGB => floral(x, y).map((v) => v * Math.max(0.72, s)) as RGB;
  const pants = (_: RGB, __: number, ___: number, s: number): RGB => [36 * s + 6, 34 * s + 6, 40 * s + 6];
  const isGreyHair = (c: RGB) => sat(c) < 0.2 && lum(c) > 70;
  const darkHair = (c: RGB): RGB => {
    const k = Math.max(0.5, lum(c) / 200);
    return [34 * k, 26 * k, 22 * k];
  };

  const texs = readTextures(tex);
  const faceSkin = (t: StudioTexture): RGB => {
    const img = toRgba(t);
    const skin: RGB[] = [];
    for (let i = 0; i < t.w * t.h; i++) {
      const c: RGB = [img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]];
      if (c[0] > c[1] && c[1] > c[2] && sat(c) > 0.2 && sat(c) < 0.6 && lum(c) > 90) skin.push(c);
    }
    skin.sort((a, b) => lum(a) - lum(b));
    return skin[Math.floor(skin.length / 2)] ?? [200, 160, 130];
  };
  /** Mặt: tóc + lông mày bạc -> đen; ria / râu bạc -> màu da; chừa vùng mắt. */
  function face(t: StudioTexture): StudioTexture {
    const skin = faceSkin(t);
    return recolor(t, (c, x, y) => {
      if (!isGreyHair(c)) return c;
      const fy = y / t.h;
      const fx = x / t.w;
      if (fy > 0.4 && fy < 0.56 && fx > 0.15 && fx < 0.85) return c; // lòng trắng mắt
      if (fy >= 0.56 && fx > 0.12 && fx < 0.88) return skin.map((v) => v * (0.85 + lum(c) / 1500)) as RGB;
      return darkHair(c);
    });
  }
  const sideHair = (t: StudioTexture) => recolor(t, (c) => (isGreyHair(c) ? darkHair(c) : c));

  const RULES: Record<number, (t: StudioTexture) => StudioTexture> = {
    0: (t) => recolor(t, shirt), 3: (t) => recolor(t, shirt), 5: (t) => recolor(t, shirt), 7: (t) => recolor(t, shirt),
    9: (t) => recolor(t, shirt), 12: (t) => recolor(t, shirt),
    1: (t) => recolor(t, pants), 4: (t) => recolor(t, pants), 6: (t) => recolor(t, pants), 8: (t) => recolor(t, pants),
    13: sideHair, 19: sideHair, 21: sideHair, 23: sideHair, 25: sideHair,
    14: face, 20: face, 24: face, 26: face,
    22: (t) => recolor(t, (c) => faceSkin(texs[20]).map((v) => v * (0.8 + lum(c) / 1200)) as RGB),
  };
  const newTexs = texs.map((t, i) => (RULES[i] ? RULES[i](t) : t));

  // Texture nón lá 64x64: nửa trên = mặt ngoài (gân dọc + vòng ngang), nửa dưới = mặt trong tối hơn
  {
    const W = 64;
    const data = new Uint8Array(W * W * 4);
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++) {
        const inner = y >= 32;
        const ty = y % 32;
        let c: RGB = inner ? [168, 150, 104] : [232, 220, 178];
        if (x % 4 === 0) c = c.map((v) => v * 0.86) as RGB; // gân lá
        if (ty % 6 === 5) c = c.map((v) => v * 0.8) as RGB; // vòng nan
        const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        c = c.map((v) => v * (0.95 + 0.1 * (n - Math.floor(n)))) as RGB;
        data.set([...c.map(clamp), 255], (y * W + x) * 4);
      }
    newTexs.push({ name: 'nonla.bmp', flags: 0, w: W, h: W, ...quantize({ w: W, h: W, data }) });
  }
  // Tóc búi: 16x16 đen nâu có sợi
  {
    const data = new Uint8Array(16 * 16 * 4);
    for (let i = 0; i < 256; i++) data.set([...([28, 22, 20] as RGB).map((v) => clamp(v * (i % 3 ? 1 : 1.6))), 255], i * 4);
    newTexs.push({ name: 'toc.bmp', flags: 0, w: 16, h: 16, ...quantize({ w: 16, h: 16, data }) });
  }
  const skins = readSkins(tex);
  const NONLA_SKINREF = skins.numskinref;
  const TOC_SKINREF = skins.numskinref + 1;
  const newSkins = skins.families.map((row) => [...row, newTexs.length - 2, newTexs.length - 1]);

  // ---- 3. Nón lá gắn vào xương đầu
  const head = modelVertsOfBone(mdl, HEAD_BONE);
  const bb = [0, 1, 2].map((k) => [Math.min(...head.map((v) => v[k])), Math.max(...head.map((v) => v[k]))]);
  const top = bb[2][1];
  const headH = bb[2][1] - bb[2][0];
  const cx = (bb[0][0] + bb[0][1]) / 2;
  const cy = (bb[1][0] + bb[1][1]) / 2;
  const headW = Math.max(bb[0][1] - bb[0][0], bb[1][1] - bb[1][0]);
  const R = headW * 1.25; // bán kính vành nón
  const rimZ = top - headH * 0.32;
  const H = R * 0.8; // nón lá khá nhọn: cao ~ 0,8 bán kính
  const SEG = 16;
  const verts: V3[] = [];
  const normals: V3[] = [];
  const ring = (r: number, z: number) => [...Array(SEG)].map((_, i) => [cx + r * Math.cos((2 * Math.PI * i) / SEG), cy + r * Math.sin((2 * Math.PI * i) / SEG), z] as V3);
  const slant = Math.hypot(R, H);
  // 0..15 vành ngoài, 16 đỉnh ngoài, 17..32 vành trong, 33 đỉnh trong (lùi 0,4 unit để không đè hình)
  verts.push(...ring(R, rimZ), [cx, cy, rimZ + H], ...ring(R - 0.4, rimZ - 0.15), [cx, cy, rimZ + H - 0.5]);
  for (let i = 0; i < SEG; i++) {
    const a = (2 * Math.PI * i) / SEG;
    normals.push([(Math.cos(a) * H) / slant, (Math.sin(a) * H) / slant, R / slant]);
  }
  normals.push([0, 0, 1]);
  for (let i = 0; i < SEG; i++) normals.push(normals[i].map((v) => -v) as V3);
  normals.push([0, 0, -1]);
  const tris: [number, number, number, number][][] = [];
  for (let i = 0; i < SEG; i++) {
    const j = (i + 1) % SEG;
    const s0 = i * 4;
    const s1 = (i + 1) * 4;
    const outer: [number, number, number, number][] = [[i, i, s0, 31], [j, j, s1, 31], [16, 16, (s0 + s1) >> 1, 0]];
    const inner: [number, number, number, number][] = [[17 + i, 17 + i, s0, 63], [17 + j, 17 + j, s1, 63], [33, 33, (s0 + s1) >> 1, 32]];
    // Vẽ cả 2 chiều để khỏi lo mặt bị cull
    tris.push(outer, [outer[0], outer[2], outer[1]], inner, [inner[0], inner[2], inner[1]]);
  }
  // Hướng mặt ở tư thế reference = trục X của xương gốc (xương gốc đang xoay -90 độ nên mặt nhìn về -Y)
  const root = boneMatrices(mdl)[0].mat;
  const FWD: V3 = (() => { const f = [root[0][0], root[1][0]]; const l = Math.hypot(f[0], f[1]); return [f[0] / l, f[1] / l, 0]; })();
  const SIDE: V3 = [-FWD[1], FWD[0], 0];
  // Búi tóc sau gáy: khối 8 cạnh dẹt, 2 đỉnh nhọn theo hướng trước/sau
  const bun = (() => {
    const depth = Math.max(...head.map((p) => -(p[0] * FWD[0] + p[1] * FWD[1]))) - -(cx * FWD[0] + cy * FWD[1]);
    const back = depth - 0.6;
    const c: V3 = [cx - FWD[0] * back, cy - FWD[1] * back, rimZ - headH * 0.12];
    const r = headW * 0.24;
    const v: V3[] = [...Array(8)].map((_, i) => { const a = (i * Math.PI) / 4; return [c[0] + SIDE[0] * r * Math.cos(a), c[1] + SIDE[1] * r * Math.cos(a), c[2] + r * Math.sin(a)] as V3; });
    v.push([c[0] - FWD[0] * r * 0.9, c[1] - FWD[1] * r * 0.9, c[2]], [c[0] + FWD[0] * r * 0.6, c[1] + FWD[1] * r * 0.6, c[2]]);
    const n: V3[] = v.map((p) => { const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]; const l = Math.hypot(...d) || 1; return d.map((x) => x / l) as V3; });
    const t: [number, number, number, number][][] = [];
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      for (const apex of [8, 9]) { const tri: [number, number, number, number][] = [[i, i, i * 2, 0], [j, j, j * 2, 0], [apex, apex, 8, 15]]; t.push(tri, [tri[0], tri[2], tri[1]]); }
    }
    return { bone: HEAD_BONE, verts: v, normals: n, tris: t, skinref: TOC_SKINREF };
  })();
  const finalMdl = setName(appendBodypart(appendBodypart(mdl, 'nonla', { bone: HEAD_BONE, verts, normals, tris, skinref: NONLA_SKINREF }), 'toc', bun), HOSTAGE_MODEL);
  const finalTex = writeTextureFile(tex, newTexs, newSkins);
  // Kiểm lại file vừa vá: độ dài khai báo khớp, đủ bodypart, skinref của nón/tóc trỏ đúng texture mới
  {
    const ok = (c: boolean, msg: string) => {
      if (!c) throw new Error(`model hỏng: ${msg}`);
    };
    ok(finalMdl.readInt32LE(72) === finalMdl.length && finalTex.readInt32LE(72) === finalTex.length, 'trường length lệch kích thước file');
    ok(finalMdl.readInt32LE(204) === mdl.readInt32LE(204) + 2, 'số bodypart');
    const sk = readSkins(finalTex);
    ok(sk.numskinref === skins.numskinref + 2 && sk.families.every((r) => readTextures(finalTex)[r[NONLA_SKINREF]].name === 'nonla.bmp' && readTextures(finalTex)[r[TOC_SKINREF]].name === 'toc.bmp'), 'bảng skin');
    ok(readTextures(finalTex).every((t, i) => i >= texs.length || (t.w === texs[i].w && t.h === texs[i].h && t.name === texs[i].name)), 'texture gốc đổi kích thước/tên');
  }
  return { mdl: finalMdl, tex: finalTex, texs: newTexs, skins: newSkins, FWD, SIDE, info: { headW, top, R, H } };
}
