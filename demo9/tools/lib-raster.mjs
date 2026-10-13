// Software rasterizer tối giản (flat shading + z-buffer) để soát asset bằng mắt mà không cần GPU/browser.
// tris: [{ t: [[x,y,z]x3] (world), col: [r,g,b] linear 0..1 }], marks: [{ p: [x,y,z], col: [r,g,b] }]
import sharp from 'sharp';

// view -> chiếu world (x,y,z) sang (u: phải, v: lên, d: độ gần camera)
export const VIEWS = {
  front: { f: ([x, y, z]) => [x, y, z], label: 'cam +Z nhìn -Z | phải=+X lên=+Y' },
  back: { f: ([x, y, z]) => [-x, y, -z], label: 'cam -Z nhìn +Z | phải=-X lên=+Y' },
  side: { f: ([x, y, z]) => [-z, y, x], label: 'cam +X nhìn -X | phải=-Z lên=+Y' },
  left: { f: ([x, y, z]) => [z, y, -x], label: 'cam -X nhìn +X | phải=+Z lên=+Y' },
  top: { f: ([x, y, z]) => [x, -z, y], label: 'cam +Y nhìn xuống | phải=+X lên=-Z' },
};

export async function rasterize(tris, marks, viewName, title, W = 900, H = 600) {
  const P = VIEWS[viewName].f;
  const pt = tris.map(({ t, col }) => ({ t: t.map(P), col }));
  const mk = marks.map((m) => ({ ...m, q: P(m.p) }));
  let mn = [1e9, 1e9], mx = [-1e9, -1e9];
  for (const { t } of pt) for (const q of t) for (let k = 0; k < 2; k++) { mn[k] = Math.min(mn[k], q[k]); mx[k] = Math.max(mx[k], q[k]); }
  for (const { q } of mk) for (let k = 0; k < 2; k++) { mn[k] = Math.min(mn[k], q[k]); mx[k] = Math.max(mx[k], q[k]); }
  const s = Math.min((W - 40) / (mx[0] - mn[0] || 1), (H - 60) / (mx[1] - mn[1] || 1));
  const toPx = (q) => [20 + (q[0] - mn[0]) * s, H - 20 - (q[1] - mn[1]) * s];
  const img = Buffer.alloc(W * H * 3, 40), zb = new Float32Array(W * H).fill(-1e9);
  for (const { t, col } of pt) {
    const a = toPx(t[0]), b = toPx(t[1]), c = toPx(t[2]);
    const e1 = [t[1][0] - t[0][0], t[1][1] - t[0][1], t[1][2] - t[0][2]], e2 = [t[2][0] - t[0][0], t[2][1] - t[0][1], t[2][2] - t[0][2]];
    const nz = e1[0] * e2[1] - e1[1] * e2[0], nl = Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], nz) || 1;
    const shade = 0.35 + 0.65 * Math.abs(nz / nl);
    const rgb = col.slice(0, 3).map((x) => Math.min(255, Math.pow(Math.max(0, x), 1 / 2.2) * 255 * shade + 25));
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    const d = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (Math.abs(d) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const w1 = ((x - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (y - a[1])) / d, w2 = ((b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1])) / d, w0 = 1 - w1 - w2;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * t[0][2] + w1 * t[1][2] + w2 * t[2][2], o = y * W + x;
      if (z > zb[o]) { zb[o] = z; img[o * 3] = rgb[0]; img[o * 3 + 1] = rgb[1]; img[o * 3 + 2] = rgb[2]; }
    }
  }
  for (const { q, col } of mk) {
    const [px, py] = toPx(q);
    for (let k = -6; k <= 6; k++) for (const [dx, dy] of [[k, 0], [0, k]]) {
      const x = Math.round(px + dx), y = Math.round(py + dy);
      if (x >= 0 && y >= 0 && x < W && y < H) img.set(col, (y * W + x) * 3);
    }
  }
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const label = Buffer.from(`<svg width="${W}" height="24"><text x="6" y="17" font-size="15" fill="#ff0">${esc(title)} — ${VIEWS[viewName].label} — khung ${(mx[0] - mn[0]).toFixed(3)} x ${(mx[1] - mn[1]).toFixed(3)} m</text></svg>`);
  return sharp(img, { raw: { width: W, height: H, channels: 3 } }).composite([{ input: label, left: 0, top: 0 }]).png().toBuffer();
}

export async function grid(panels, out, cols = 2, PW = 600, PH = 400) {
  const rows = Math.ceil(panels.length / cols);
  const comps = await Promise.all(panels.map(async (p, i) => ({ input: await sharp(p).resize(PW, PH).toBuffer(), left: (i % cols) * PW, top: Math.floor(i / cols) * PH })));
  await sharp({ create: { width: PW * cols, height: PH * rows, channels: 3, background: '#111' } }).composite(comps).png().toFile(out);
}
