// Tiện ích dùng chung cho logic game (không phụ thuộc Phaser / DOM)

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// RNG có seed (mulberry32) — selftest chạy lặp lại được; game thật seed theo thời gian
export function makeRng(seed = Date.now() >>> 0) {
  let s = seed >>> 0;
  const r = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.chance = (p) => r() < p;
  return r;
}

// hướng Flare: dir0 = SW, quay theo chiều kim đồng hồ (W, NW, N, NE, E, SE, S). dx, dy theo trục map.
export const dirOf = (dx, dy) => {
  const a = Math.atan2(dy, dx) * 180 / Math.PI;
  return Math.round((((a - 135) % 360) + 360) % 360 / 45) % 8;
};

export const fmt = (n) => Math.round(n).toLocaleString('vi-VN');
