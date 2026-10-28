// Lưới đường đi 16 unit dựng từ brush của map (không cần BSP): hull người chơi 32x32x72.
// Dùng cho selftest (tới được đâu) và sinh waypoint PODBot.
import type { Entity, V3 } from './brush.ts';

export const CELL = 16;
const HALF = 15;
const HULL = 72;
const BUCKET = 256;

export type Node = { i: number; j: number; h: number };
export const key = (n: Node) => `${n.i},${n.j},${n.h}`;

export interface Nav {
  X0: number;
  Y0: number;
  NX: number;
  NY: number;
  floors(i: number, j: number): number[];
  /** BFS/Dijkstra-xấp-xỉ trên lưới 8 hướng. maxUp: bậc cao nhất leo được (18 = đi bộ, 44 = có nhảy). */
  bfs(starts: Node[], maxUp: number, limit?: number): Map<string, number>;
  nodeAt(o: V3, feetOffset: number): Node | undefined;
  center(n: Node): V3;
}

export function buildNav(ents: Entity[], bounds: { x0: number; y0: number; x1: number; y1: number }): Nav {
  type Box = { min: V3; max: V3 };
  const boxes: Box[] = ents
    // Bỏ qua thứ đi xuyên được (tán cây) hoặc sẽ mở / vỡ khi chơi (cửa, kính vỡ): bot vẫn có đường qua
    .filter((e) => !['func_illusionary', 'func_door', 'func_door_rotating', 'func_breakable'].includes(e.props.classname))
    .flatMap((e) => e.brushes ?? [])
    .map((b) => {
      const v = b.flatMap((f) => f.pts);
      return {
        min: [0, 1, 2].map((i) => Math.min(...v.map((p) => p[i]))) as V3,
        max: [0, 1, 2].map((i) => Math.max(...v.map((p) => p[i]))) as V3,
      };
    })
    .filter((b) => b.max[2] - b.min[2] < 1000); // bỏ tường trời
  const grid = new Map<string, Box[]>();
  for (const b of boxes)
    for (let bx = Math.floor(b.min[0] / BUCKET); bx <= Math.floor(b.max[0] / BUCKET); bx++)
      for (let by = Math.floor(b.min[1] / BUCKET); by <= Math.floor(b.max[1] / BUCKET); by++) {
        const k = `${bx},${by}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k)!.push(b);
      }
  const near = (x: number, y: number) => grid.get(`${Math.floor(x / BUCKET)},${Math.floor(y / BUCKET)}`) ?? [];
  const X0 = bounds.x0;
  const Y0 = bounds.y0;
  const NX = Math.round((bounds.x1 - bounds.x0) / CELL);
  const NY = Math.round((bounds.y1 - bounds.y0) / CELL);

  // Độ cao đứng được tại ô: mặt trên của brush nằm dưới hull 32x32 (như engine: đứng trên mặt cao nhất chạm hull), đủ chỗ cao 72.
  const cache = new Map<number, number[]>();
  function floors(i: number, j: number): number[] {
    if (i < 0 || j < 0 || i >= NX || j >= NY) return [];
    const k = i * 10000 + j;
    const hit = cache.get(k);
    if (hit) return hit;
    const cx = X0 + i * CELL + CELL / 2;
    const cy = Y0 + j * CELL + CELL / 2;
    const list = [...new Set([...near(cx - HALF, cy - HALF), ...near(cx + HALF, cy + HALF), ...near(cx - HALF, cy + HALF), ...near(cx + HALF, cy - HALF)])];
    const under = (b: Box) => b.min[0] < cx + HALF && b.max[0] > cx - HALF && b.min[1] < cy + HALF && b.max[1] > cy - HALF;
    const cand = new Set(list.filter(under).map((b) => b.max[2]));
    const ok = [...cand].filter((h) => !list.some((b) => under(b) && b.min[2] < h + HULL && b.max[2] > h + 0.5));
    cache.set(k, ok);
    return ok;
  }

  function bfs(starts: Node[], maxUp: number, limit = Infinity): Map<string, number> {
    const dist = new Map<string, number>();
    const q: Node[] = [];
    for (const s of starts) {
      dist.set(key(s), 0);
      q.push(s);
    }
    for (let qi = 0; qi < q.length; qi++) {
      const n = q[qi];
      const d = dist.get(key(n))!;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const i = n.i + di;
        const j = n.j + dj;
        const nd = d + (di && dj ? 22.6 : 16);
        if (nd > limit) continue;
        for (const h of floors(i, j)) {
          if (h - n.h > maxUp || n.h - h > 400) continue;
          // Đi chéo: hai ô cạnh cũng phải đứng được, tránh lách qua góc tường
          if (di && dj && (!floors(n.i + di, n.j).length || !floors(n.i, n.j + dj).length)) continue;
          const m = { i, j, h };
          if (dist.has(key(m))) continue;
          dist.set(key(m), nd);
          q.push(m);
        }
      }
    }
    return dist;
  }

  function nodeAt(o: V3, feetOffset: number): Node | undefined {
    const i = Math.floor((o[0] - X0) / CELL);
    const j = Math.floor((o[1] - Y0) / CELL);
    const hs = floors(i, j).filter((h) => h <= o[2] - feetOffset + 2);
    return hs.length ? { i, j, h: Math.max(...hs) } : undefined;
  }

  const center = (n: Node): V3 => [X0 + n.i * CELL + CELL / 2, Y0 + n.j * CELL + CELL / 2, n.h];
  return { X0, Y0, NX, NY, floors, bfs, nodeAt, center };
}
