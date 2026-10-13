// Lưới va chạm + A* 8 hướng (heap nhị phân), không cắt góc tường; đường đi được nắn thẳng bằng lineFree.
// Va chạm Flare: 0 đi được, 1 tường, 2 vực/nước (chặn người, không chặn đạn), 3 ngoài map, 4 vực ẩn.

export class Grid {
  constructor(map) {
    this.w = map.w;
    this.h = map.h;
    this.walk = new Uint8Array(map.w * map.h);
    this.fly = new Uint8Array(map.w * map.h);
    map.col.forEach((c, i) => { this.walk[i] = c === 0 ? 1 : 0; this.fly[i] = c === 0 || c === 2 || c === 4 ? 1 : 0; });
    this.g = new Float32Array(map.w * map.h);
    this.from = new Int32Array(map.w * map.h);
    this.stamp = new Uint32Array(map.w * map.h);
    this.closed = new Uint32Array(map.w * map.h);
    this.run = 0;
  }
  ok(x, y) {
    const i = Math.floor(x), j = Math.floor(y);
    return i >= 0 && j >= 0 && i < this.w && j < this.h && this.walk[j * this.w + i] === 1;
  }
  okFly(x, y) {
    const i = Math.floor(x), j = Math.floor(y);
    return i >= 0 && j >= 0 && i < this.w && j < this.h && this.fly[j * this.w + i] === 1;
  }
  lineFree(ax, ay, bx, by, fly = false) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d * 6);
    const f = fly ? this.okFly.bind(this) : this.ok.bind(this);
    for (let k = 1; k <= n; k++) { const t = k / n; if (!f(ax + (bx - ax) * t, ay + (by - ay) * t)) return false; }
    return true;
  }
  // thân to r: 4 góc phải đi được
  okBody(x, y, r = 0.25) {
    return this.ok(x - r, y - r) && this.ok(x + r, y - r) && this.ok(x - r, y + r) && this.ok(x + r, y + r);
  }
  /** Loang từ (x,y): đánh dấu mọi ô đi bộ tới được (map Flare có nhiều đảo/khu kín) */
  flood(x, y) {
    const W = this.w, m = new Uint8Array(W * this.h);
    const s = Math.floor(y) * W + Math.floor(x);
    if (!this.walk[s]) return m;
    const q = [s];
    m[s] = 1;
    while (q.length) {
      const c = q.pop(), ci = c % W, cj = (c / W) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= this.h) continue;
        const n = nj * W + ni;
        if (this.walk[n] && !m[n]) { m[n] = 1; q.push(n); }
      }
    }
    this.reach = m;
    return m;
  }
  reachable(x, y) {
    if (!this.reach) return this.ok(x, y);
    const i = Math.floor(x), j = Math.floor(y);
    return i >= 0 && j >= 0 && i < this.w && j < this.h && this.reach[j * this.w + i] === 1;
  }

  nearestWalkable(x, y, maxR = 4) {
    const ci = Math.floor(x), cj = Math.floor(y);
    for (let r = 0; r <= maxR; r++) {
      let best = null, bd = 1e9;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        if (this.reachable(ci + di + 0.5, cj + dj + 0.5)) { const d = di * di + dj * dj; if (d < bd) { bd = d; best = [ci + di + 0.5, cj + dj + 0.5]; } }
      }
      if (best) return best;
    }
    return null;
  }

  /** A* -> mảng điểm [[x,y],...] (không gồm điểm đầu) hoặc null */
  path(sx, sy, tx, ty, maxN = 40000, smooth = true) {
    const W = this.w;
    const t0 = this.reachable(tx, ty) ? [tx, ty] : this.nearestWalkable(tx, ty, 3);
    if (!t0) return null;
    const si = Math.floor(sx), sj = Math.floor(sy), ti = Math.floor(t0[0]), tj = Math.floor(t0[1]);
    if (si === ti && sj === tj) return [[t0[0], t0[1]]];
    if (smooth && this.lineFree(sx, sy, t0[0], t0[1])) return [[t0[0], t0[1]]];
    const run = ++this.run;
    const s = sj * W + si, t = tj * W + ti;
    const heap = [], hf = [];
    const push = (n, f) => {
      heap.push(n); hf.push(f);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (hf[p] <= hf[i]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]]; [hf[p], hf[i]] = [hf[i], hf[p]]; i = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop(), lf = hf.pop();
      if (heap.length) {
        heap[0] = last; hf[0] = lf;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && hf[l] < hf[m]) m = l;
          if (r < heap.length && hf[r] < hf[m]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]]; [hf[m], hf[i]] = [hf[i], hf[m]]; i = m;
        }
      }
      return top;
    };
    const H = (n) => { const dx = Math.abs(n % W - ti), dy = Math.abs(((n / W) | 0) - tj); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    this.g[s] = 0; this.stamp[s] = run; this.from[s] = -1;
    push(s, H(s));
    let n = 0, found = false;
    while (heap.length && n++ < maxN) {
      const c = pop();
      if (this.closed[c] === run) continue;
      this.closed[c] = run;
      if (c === t) { found = true; break; }
      const ci = c % W, cj = (c / W) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= this.h) continue;
        const nk = nj * W + ni;
        if (!this.walk[nk] || this.closed[nk] === run) continue;
        if (di && dj && (!this.walk[cj * W + ni] || !this.walk[nj * W + ci])) continue;
        const ng = this.g[c] + (di && dj ? 1.414 : 1);
        if (this.stamp[nk] !== run || ng < this.g[nk]) {
          this.stamp[nk] = run; this.g[nk] = ng; this.from[nk] = c;
          push(nk, ng + H(nk));
        }
      }
    }
    if (!found) return null;
    const raw = [];
    for (let k = t; k !== -1 && k !== s; k = this.from[k]) raw.push([k % W + 0.5, ((k / W) | 0) + 0.5]);
    raw.reverse();
    raw[raw.length - 1] = [t0[0], t0[1]];
    if (!smooth) return raw;
    // nắn thẳng: bỏ điểm giữa nếu nhìn thấy điểm xa hơn
    const out = [];
    let cx = sx, cy = sy, i = 0;
    while (i < raw.length) {
      let j = raw.length - 1;
      while (j > i && !this.lineFree(cx, cy, raw[j][0], raw[j][1])) j--;
      out.push(raw[j]);
      [cx, cy] = raw[j];
      i = j + 1;
    }
    return out;
  }
}
