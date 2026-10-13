// Lưới va chạm, A* cho hero, flow field dùng chung cho mọi quái, spatial hash. Không phụ thuộc Phaser.
// Collision Flare: 0 đi được, 1 tường, 2 nước/vực (đạn bay qua được), 3 tường ẩn, 4 vực ẩn.

export class Grid {
  constructor(map) {
    this.w = map.w; this.h = map.h;
    this.col = Uint8Array.from(map.col);
    this.flow = new Int32Array(this.w * this.h).fill(-1); // khoảng cách (x10) tới hero, -1 = chưa tới
    this.flowOrigin = -1;
    this.queue = new Int32Array(this.w * this.h);
  }
  idx(i, j) { return j * this.w + i; }
  walk(x, y) {
    const i = Math.floor(x), j = Math.floor(y);
    return i >= 0 && j >= 0 && i < this.w && j < this.h && this.col[j * this.w + i] === 0;
  }
  /** đạn bay qua được nước/vực */
  fly(x, y) {
    const i = Math.floor(x), j = Math.floor(y);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return false;
    const c = this.col[j * this.w + i];
    return c === 0 || c === 2 || c === 4;
  }
  lineFree(ax, ay, bx, by, fly = false) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d * 3);
    const ok = fly ? this.fly.bind(this) : this.walk.bind(this);
    for (let k = 1; k <= n; k++) { const t = k / n; if (!ok(ax + (bx - ax) * t, ay + (by - ay) * t)) return false; }
    return true;
  }
  /** như lineFree nhưng tính cả bề ngang thân (3 đường song song cách nhau r), tránh đi thẳng sượt góc tường rồi kẹt */
  lineFreeR(ax, ay, bx, by, r = 0.3) {
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l * r, ny = dx / l * r;
    return this.lineFree(ax, ay, bx, by) && this.lineFree(ax + nx, ay + ny, bx + nx, by + ny) && this.lineFree(ax - nx, ay - ny, bx - nx, by - ny);
  }
  /** trượt dọc tường, r = bán kính thân */
  slide(u, dx, dy, r = 0.26) {
    const ok = (x, y) => this.walk(x - r, y - r) && this.walk(x + r, y - r) && this.walk(x - r, y + r) && this.walk(x + r, y + r);
    let moved = false;
    if (ok(u.x + dx, u.y)) { u.x += dx; moved = true; }
    if (ok(u.x, u.y + dy)) { u.y += dy; moved = true; }
    return moved;
  }
  nearestWalk(x, y, R = 4) {
    if (this.walk(x, y)) return { x, y };
    let best = null, bd = 1e9;
    const i0 = Math.floor(x), j0 = Math.floor(y);
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      const i = i0 + di, j = j0 + dj;
      if (!this.walk(i + 0.5, j + 0.5)) continue;
      const d = di * di + dj * dj;
      if (d < bd) { bd = d; best = { x: i + 0.5, y: j + 0.5 }; }
    }
    return best;
  }

  /** A* 8 hướng, không cắt góc, open list bằng binary heap. */
  path(sx, sy, tx, ty, maxN = 4000) {
    const W = this.w;
    const t = this.nearestWalk(tx, ty, 3);
    if (!t) return null;
    const si = Math.floor(sx), sj = Math.floor(sy), ti = Math.floor(t.x), tj = Math.floor(t.y);
    const start = si + sj * W, goal = ti + tj * W;
    if (start === goal) return [[t.x, t.y]];
    const g = new Map([[start, 0]]), from = new Map();
    const heap = new Heap();
    const h = (i, j) => { const dx = Math.abs(ti - i), dy = Math.abs(tj - j); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    heap.push(start, h(si, sj));
    const closed = new Set();
    let n = 0;
    while (heap.size && n++ < maxN) {
      const c = heap.pop();
      if (c === goal) {
        const out = [[t.x, t.y]];
        let k = from.get(goal);
        while (k !== undefined && k !== start) { out.unshift([k % W + 0.5, Math.floor(k / W) + 0.5]); k = from.get(k); }
        return out;
      }
      if (closed.has(c)) continue;
      closed.add(c);
      const ci = c % W, cj = (c - ci) / W, gc = g.get(c);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (!this.walk(ni + 0.5, nj + 0.5)) continue;
        if (di && dj && (!this.walk(ci + di + 0.5, cj + 0.5) || !this.walk(ci + 0.5, cj + dj + 0.5))) continue;
        const nk = ni + nj * W, ng = gc + (di && dj ? 1.414 : 1);
        if (ng < (g.get(nk) ?? 1e9)) { g.set(nk, ng); from.set(nk, c); heap.push(nk, ng + h(ni, nj)); }
      }
    }
    return null;
  }

  /** Flow field: BFS 8 hướng từ ô (x,y) ra tối đa R ô. Mọi quái đuổi theo dùng chung 1 lần tính. */
  buildFlow(x, y, R = 30) {
    const W = this.w, H = this.h, f = this.flow, q = this.queue;
    const oi = Math.floor(x), oj = Math.floor(y), o = oi + oj * W;
    if (o === this.flowOrigin) return false;
    this.flowOrigin = o;
    f.fill(-1);
    if (oi < 0 || oj < 0 || oi >= W || oj >= H) return true;
    let head = 0, tail = 0;
    f[o] = 0; q[tail++] = o;
    const lim = R * 10;
    while (head < tail) {
      const c = q[head++], ci = c % W, cj = (c - ci) / W, fc = f[c];
      if (fc >= lim) continue;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const nk = ni + nj * W;
        if (f[nk] !== -1 || this.col[nk] !== 0) continue;
        if (di && dj && (this.col[ci + di + cj * W] !== 0 || this.col[ci + nj * W] !== 0)) continue;
        f[nk] = fc + (di && dj ? 14 : 10);
        q[tail++] = nk;
      }
    }
    return true;
  }
  /** hướng đi xuống dốc flow field tại (x,y); null nếu ngoài vùng */
  flowDir(x, y) {
    const W = this.w, i = Math.floor(x), j = Math.floor(y);
    if (i < 0 || j < 0 || i >= W || j >= this.h) return null;
    const f = this.flow, here = f[i + j * W];
    if (here < 0) return null;
    let best = here, bx = 0, by = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= this.h) continue;
      const v = f[ni + nj * W];
      if (v >= 0 && v < best) { best = v; bx = ni + 0.5 - x; by = nj + 0.5 - y; }
    }
    if (best === here) return null;
    const l = Math.hypot(bx, by) || 1;
    return { x: bx / l, y: by / l };
  }
  /** khoảng cách đi bộ (ô) từ 1 điểm tới mọi ô, dùng để xếp hạng nhóm spawn */
  distances(x, y) {
    this.flowOrigin = -1;
    this.buildFlow(x, y, 1000);
    const out = Float32Array.from(this.flow, (v) => (v < 0 ? -1 : v / 10));
    this.flowOrigin = -1;
    return out;
  }
}

class Heap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(k, p) {
    const K = this.k, P = this.p;
    let i = K.length; K.push(k); P.push(p);
    while (i > 0) { const pi = (i - 1) >> 1; if (P[pi] <= p) break; K[i] = K[pi]; P[i] = P[pi]; i = pi; }
    K[i] = k; P[i] = p;
  }
  pop() {
    const K = this.k, P = this.p, top = K[0], lk = K.pop(), lp = P.pop();
    if (K.length) {
      let i = 0; const n = K.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && P[c + 1] < P[c]) c++;
        if (P[c] >= lp) break;
        K[i] = K[c]; P[i] = P[c]; i = c;
      }
      K[i] = lk; P[i] = lp;
    }
    return top;
  }
}

/** Spatial hash ô vuông cạnh CELL (đơn vị tile). Dựng lại mỗi frame cho quái còn sống. */
export class Hash {
  constructor(w, h, cell = 2) {
    this.cell = cell; this.cw = Math.ceil(w / cell); this.ch = Math.ceil(h / cell);
    this.b = Array.from({ length: this.cw * this.ch }, () => []);
  }
  clear() { for (const a of this.b) a.length = 0; }
  key(x, y) {
    const i = Math.min(this.cw - 1, Math.max(0, Math.floor(x / this.cell)));
    const j = Math.min(this.ch - 1, Math.max(0, Math.floor(y / this.cell)));
    return i + j * this.cw;
  }
  add(u) { this.b[this.key(u.x, u.y)].push(u); }
  /** gọi fn(u, d) cho mọi u trong bán kính r */
  each(x, y, r, fn) {
    const c = this.cell;
    const i0 = Math.max(0, Math.floor((x - r) / c)), i1 = Math.min(this.cw - 1, Math.floor((x + r) / c));
    const j0 = Math.max(0, Math.floor((y - r) / c)), j1 = Math.min(this.ch - 1, Math.floor((y + r) / c));
    const r2 = r * r;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      for (const u of this.b[i + j * this.cw]) {
        const dx = u.x - x, dy = u.y - y, d2 = dx * dx + dy * dy;
        if (d2 <= r2) fn(u, Math.sqrt(d2));
      }
    }
  }
}
