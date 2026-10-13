// Lưới dẫn đường 0.5m cho bot: A* 8 hướng + làm mượt đường bằng kiểm tra tầm nhìn trên lưới.
const RES = 0.5;

export class Nav {
  constructor(map) {
    this.w = Math.round(map.size[0] / RES);
    this.h = Math.round(map.size[1] / RES);
    const raw = new Uint8Array(this.w * this.h);
    for (let z = 0; z < this.h; z++)
      for (let x = 0; x < this.w; x++) {
        const cx = Math.floor((x * RES) / map.CELL), cz = Math.floor((z * RES) / map.CELL);
        if (map.solid[cz * map.W + cx]) raw[z * this.w + x] = 1;
      }
    for (const b of map.boxes) {
      if (b.mat === 'roof' || b.mat === 'wall' || b.mat === 'plaster') continue;
      for (let z = Math.floor(b.min[2] / RES); z < Math.ceil(b.max[2] / RES); z++)
        for (let x = Math.floor(b.min[0] / RES); x < Math.ceil(b.max[0] / RES); x++) raw[z * this.w + x] = 1;
    }
    // Nở vật cản 1 ô (0.5m) để chừa bán kính người
    this.blocked = new Uint8Array(raw);
    for (let z = 0; z < this.h; z++)
      for (let x = 0; x < this.w; x++) {
        if (!raw[z * this.w + x]) continue;
        for (let dz = -1; dz <= 1; dz++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, nz = z + dz;
            if (nx >= 0 && nz >= 0 && nx < this.w && nz < this.h) this.blocked[nz * this.w + nx] = 1;
          }
      }
    this.g = new Float32Array(this.w * this.h);
    this.parent = new Int32Array(this.w * this.h);
    this.stamp = new Uint32Array(this.w * this.h);
    this.closed = new Uint32Array(this.w * this.h);
    this.run = 0;
  }

  cell(x, z) {
    return [Math.min(this.w - 1, Math.max(0, Math.floor(x / RES))), Math.min(this.h - 1, Math.max(0, Math.floor(z / RES)))];
  }
  free(cx, cz) { return cx >= 0 && cz >= 0 && cx < this.w && cz < this.h && !this.blocked[cz * this.w + cx]; }
  walkable(x, z) { const [cx, cz] = this.cell(x, z); return this.free(cx, cz); }

  // Ô trống gần nhất (khi bot/đích lỡ nằm sát tường)
  nearestFree(cx, cz) {
    if (this.free(cx, cz)) return [cx, cz];
    for (let r = 1; r < 10; r++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) if (this.free(cx + dx, cz + dz)) return [cx + dx, cz + dz];
    return [cx, cz];
  }

  path(from, to) {
    const [sx, sz] = this.nearestFree(...this.cell(from.x, from.z));
    const [tx, tz] = this.nearestFree(...this.cell(to.x, to.z));
    const W = this.w, start = sz * W + sx, goal = tz * W + tx;
    const run = ++this.run;
    const heap = new Heap();
    const h = (i) => { const dx = Math.abs((i % W) - tx), dz = Math.abs(((i / W) | 0) - tz); return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    this.g[start] = 0; this.stamp[start] = run; this.parent[start] = -1;
    heap.push(start, h(start));
    let found = false;
    while (heap.size) {
      const i = heap.pop();
      if (i === goal) { found = true; break; }
      if (this.closed[i] === run) continue;
      this.closed[i] = run;
      const x = i % W, z = (i / W) | 0;
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = x + dx, nz = z + dz;
          if (!this.free(nx, nz)) continue;
          if (dx && dz && (!this.free(x + dx, z) || !this.free(x, z + dz))) continue;
          const j = nz * W + nx;
          if (this.closed[j] === run) continue;
          const ng = this.g[i] + (dx && dz ? Math.SQRT2 : 1);
          if (this.stamp[j] !== run || ng < this.g[j]) {
            this.stamp[j] = run; this.g[j] = ng; this.parent[j] = i;
            heap.push(j, ng + h(j));
          }
        }
    }
    if (!found) return null;
    const cells = [];
    for (let i = goal; i !== -1; i = this.parent[i]) cells.push(i);
    cells.reverse();
    const pts = cells.map((i) => ({ x: ((i % W) + 0.5) * RES, z: (((i / W) | 0) + 0.5) * RES }));
    return this.smooth(pts, to);
  }

  smooth(pts, to) {
    if (pts.length <= 2) return [{ x: to.x, z: to.z }];
    const out = [];
    let a = pts[0];
    let i = 1;
    while (i < pts.length) {
      let j = i;
      while (j + 1 < pts.length && this.clear(a, pts[j + 1])) j++;
      out.push(pts[j]);
      a = pts[j];
      i = j + 1;
    }
    const last = out[out.length - 1];
    if (this.walkable(to.x, to.z) && this.clear(last, to)) out[out.length - 1] = { x: to.x, z: to.z };
    return out;
  }

  clear(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const n = Math.ceil(Math.hypot(dx, dz) / (RES * 0.25));
    for (let k = 1; k <= n; k++) if (!this.walkable(a.x + (dx * k) / n, a.z + (dz * k) / n)) return false;
    return true;
  }

  randomIn(rect, rnd) {
    for (let t = 0; t < 60; t++) {
      const x = rect.x0 + 1 + rnd() * (rect.x1 - rect.x0 - 2), z = rect.z0 + 1 + rnd() * (rect.z1 - rect.z0 - 2);
      if (this.walkable(x, z)) return { x, z };
    }
    return { x: (rect.x0 + rect.x1) / 2, z: (rect.z0 + rect.z1) / 2 };
  }
}

class Heap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(k, p) {
    const K = this.k, P = this.p;
    let i = K.length;
    K.push(k); P.push(p);
    while (i > 0) {
      const u = (i - 1) >> 1;
      if (P[u] <= p) break;
      K[i] = K[u]; P[i] = P[u]; i = u;
    }
    K[i] = k; P[i] = p;
  }
  pop() {
    const K = this.k, P = this.p, top = K[0];
    const k = K.pop(), p = P.pop();
    if (K.length) {
      let i = 0;
      const n = K.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && P[c + 1] < P[c]) c++;
        if (P[c] >= p) break;
        K[i] = K[c]; P[i] = P[c]; i = c;
      }
      K[i] = k; P[i] = p;
    }
    return top;
  }
}
