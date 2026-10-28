// Brush GoldSrc + ghi file .map (format Valve 220).
// Mọi brush là lăng trụ: đa giác lồi 2D (toạ độ nguyên) đùn theo một trục. Hộp, mái dốc, bậc thang, cột bát giác
// đều quy về đây, nên đỉnh luôn là số nguyên và CSG không bị lệch mặt.

export type V3 = [number, number, number];
export type V2 = [number, number];
export type Axis = 'x' | 'y' | 'z';

/** Texture của từng nhóm mặt. `side` là mặc định cho mọi mặt chưa chỉ định. */
export type TexSel = string | { side: string; top?: string; bottom?: string };

export interface Face {
  pts: [V3, V3, V3];
  normal: V3;
  tex: string;
  /** Điểm đặt góc trên-trái texture (biển hiệu, cửa sổ). Không có thì texture neo theo gốc toạ độ thế giới. */
  origin?: V3;
}
export type Brush = Face[];

/** Neo texture của mọi mặt brush vào `origin` (góc trên-trái nhìn từ phía trước). */
export function aligned(b: Brush, origin: V3): Brush {
  for (const f of b) f.origin = origin;
  return b;
}

export interface Entity {
  props: Record<string, string>;
  brushes?: Brush[];
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Điểm 2D trên mặt cắt + toạ độ dọc trục -> điểm 3D. Trục z: (x,y); trục x: (y,z); trục y: (x,z). */
function lift(p: V2, t: number, axis: Axis): V3 {
  if (axis === 'z') return [p[0], p[1], t];
  if (axis === 'x') return [t, p[0], p[1]];
  return [p[0], t, p[1]];
}

function pickTex(sel: TexSel, n: V3): string {
  if (typeof sel === 'string') return sel;
  if (n[2] > 0.7) return sel.top ?? sel.side;
  if (n[2] < -0.7) return sel.bottom ?? sel.side;
  return sel.side;
}

/** Quy ước .map: pháp tuyến hướng ra ngoài = (p3 - p1) x (p2 - p1). Tự đảo p2/p3 nếu pháp tuyến quay vào trong. */
function face(a: V3, b: V3, c: V3, center: V3, sel: TexSel): Face {
  let n = cross(sub(c, a), sub(b, a));
  let pts: [V3, V3, V3] = [a, b, c];
  if (dot(n, sub(a, center)) < 0) {
    pts = [a, c, b];
    n = [-n[0], -n[1], -n[2]];
  }
  const nn = norm(n);
  return { pts, normal: nn, tex: pickTex(sel, nn) };
}

export function prism(poly: V2[], axis: Axis, t0: number, t1: number, tex: TexSel): Brush {
  if (poly.length < 3) throw new Error('prism: polygon cần >= 3 đỉnh');
  if (t1 <= t0) throw new Error(`prism: độ dày <= 0 (${t0}..${t1})`);
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  const center = lift([cx, cy], (t0 + t1) / 2, axis);
  const faces: Brush = [
    face(lift(poly[0], t0, axis), lift(poly[1], t0, axis), lift(poly[2], t0, axis), center, tex),
    face(lift(poly[0], t1, axis), lift(poly[1], t1, axis), lift(poly[2], t1, axis), center, tex),
  ];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    faces.push(face(lift(p, t0, axis), lift(q, t0, axis), lift(p, t1, axis), center, tex));
  }
  return faces;
}

/**
 * Tấm mỏng dán trên mặt đứng hướng `normal` (biển hiệu, cửa sổ): texture neo vào góc trên-trái nhìn từ phía trước.
 * `cell` chọn ô trong texture dạng atlas (ô có kích thước bằng đúng tấm).
 */
export function alignedPlate(min: V3, max: V3, tex: string, normal: V3, cell: [number, number] = [0, 0]): Brush {
  const u: V3 = [-normal[1], normal[0], 0];
  let best: V3 = min;
  let bu = Infinity;
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]]) {
      const d = x * u[0] + y * u[1];
      if (d < bu) (bu = d), (best = [x, y, max[2]]);
    }
  const width = Math.abs((max[0] - min[0]) * u[0]) + Math.abs((max[1] - min[1]) * u[1]);
  const height = max[2] - min[2];
  const origin: V3 = [best[0] - u[0] * cell[0] * width, best[1] - u[1] * cell[0] * width, best[2] + cell[1] * height];
  return aligned(box(min, max, tex), origin);
}

/** Chóp: đáy là đa giác lồi ở độ cao z0, đỉnh `apex` (nón lá, ô dù). */
export function pyramid(poly: V2[], z0: number, apex: V3, tex: TexSel): Brush {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  const center: V3 = [(cx * 3 + apex[0]) / 4, (cy * 3 + apex[1]) / 4, (z0 * 3 + apex[2]) / 4];
  const at = (p: V2): V3 => [p[0], p[1], z0];
  const faces: Brush = [face(at(poly[0]), at(poly[1]), at(poly[2]), center, tex)];
  for (let i = 0; i < poly.length; i++) faces.push(face(at(poly[i]), at(poly[(i + 1) % poly.length]), apex, center, tex));
  return faces;
}

/** Bát giác đều toạ độ nguyên quanh (cx, cy). */
export function octagon(cx: number, cy: number, r: number): V2[] {
  return Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    return [Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)] as V2;
  });
}

export function box(min: V3, max: V3, tex: TexSel): Brush {
  for (let i = 0; i < 3; i++) if (max[i] <= min[i]) throw new Error(`box: kích thước <= 0 trên trục ${i}: ${min} -> ${max}`);
  return prism(
    [
      [min[0], min[1]],
      [max[0], min[1]],
      [max[0], max[1]],
      [min[0], max[1]],
    ],
    'z',
    min[2],
    max[2],
    tex,
  );
}

/** Kích thước texture tính bằng unit thế giới: 1 texel = `scale` unit. */
export type TexScale = (tex: string) => number;

function texAxes(n: V3): [V3, V3] {
  if (Math.abs(n[2]) > 0.7) return [[1, 0, 0], [0, -1, 0]];
  const u = norm([-n[1], n[0], 0]);
  let v = cross(n, u);
  if (v[2] > 0) v = [-v[0], -v[1], -v[2]];
  return [u, norm(v)];
}

const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(6).replace(/0+$/, '').replace(/\.$/, ''));
const v3 = (p: V3) => `( ${p.map(fmt).join(' ')} )`;

export function writeMap(entities: Entity[], scaleOf: TexScale): string {
  const out: string[] = [];
  for (const e of entities) {
    out.push('{');
    for (const [k, v] of Object.entries(e.props)) out.push(`"${k}" "${v}"`);
    for (const b of e.brushes ?? []) {
      out.push('{');
      for (const f of b) {
        const [u, v] = texAxes(f.normal);
        const s = scaleOf(f.tex);
        const uo = f.origin ? -dot(f.origin, u) / s : 0;
        const vo = f.origin ? -dot(f.origin, v) / s : 0;
        out.push(`${v3(f.pts[0])} ${v3(f.pts[1])} ${v3(f.pts[2])} ${f.tex} [ ${u.map(fmt).join(' ')} ${fmt(uo)} ] [ ${v.map(fmt).join(' ')} ${fmt(vo)} ] 0 ${fmt(s)} ${fmt(s)}`);
      }
      out.push('}');
    }
    out.push('}');
  }
  return out.join('\n') + '\n';
}
