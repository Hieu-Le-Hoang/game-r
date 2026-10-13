// Map "Bụi Sa Mạc" — bản thu nhỏ kiểu de_dust2. Lưới ô 2m: mặc định là khối đặc, "carve" khoét ra lối đi.
// Toạ độ thế giới: x = cột * CELL, z = hàng * CELL (z tăng về phía Nam). Phía Bắc (-z) là CT, Nam là T.
export const CELL = 2;
export const W = 44;
export const H = 46;

// [x0, z0, x1, z1, vật liệu sàn] — ô, bao cả 2 đầu
const CARVES = [
  [2, 2, 13, 13, 'tile'], // Site B
  [14, 5, 16, 8, 'stone'], // Cửa B -> CT
  [17, 2, 27, 9, 'stone'], // CT spawn
  [28, 4, 30, 8, 'stone'], // CT -> A
  [31, 2, 42, 13, 'tile'], // Site A
  [20, 10, 23, 26, 'sand'], // Mid
  [17, 27, 26, 32, 'sand'], // Mid dưới
  [20, 33, 23, 37, 'sand'], // Mid -> T spawn
  [24, 14, 33, 16, 'stone'], // Catwalk (short A)
  [39, 14, 42, 37, 'sand'], // Long A
  [31, 34, 38, 37, 'sand'], // Cửa long
  [26, 34, 30, 38, 'sand'], // Ngoài long
  [12, 38, 30, 44, 'sand'], // T spawn
  [3, 14, 6, 30, 'stone'], // Hầm trên (upper tunnel)
  [3, 31, 14, 34, 'stone'], // Hầm dưới
  [11, 35, 14, 37, 'stone'], // Hầm -> T spawn
  [15, 31, 16, 32, 'stone'], // Hầm dưới -> mid
];

// Khối đặc đắp lại sau khi khoét (cột cửa, chỗ hẹp)
const FILLS = [
  [20, 18, 20, 19], [23, 18, 23, 19], // cửa mid
  [39, 26, 39, 27], // khúc gãy long
  [5, 22, 6, 23], // góc hầm trên
];

// Cột / tường thấp chắn tầm nhìn dọc mid (m): [cx, cz, w, d, h]
const PILLARS = [
  [44, 21, 3, 1.2, 3.6], // đầu mid phía CT
  [44, 69, 2.4, 1.2, 3.6], // cửa mid phía T
  [80.5, 53, 3, 1, 3.2], // giữa Long
];

// Mái che hầm (m): chặn lựu đạn bay ra ngoài, nhìn cho ra hầm
const ROOFS = [
  [3, 14, 6, 30], [3, 31, 14, 34], [11, 35, 14, 37], [15, 31, 16, 32],
];
export const ROOF_Y = 3.4;

// Thùng gỗ (m): [cx, cz, w, d, h]
const CRATES = [
  // Site B
  [9, 9, 1.6, 1.6, 1.8], [9, 11.2, 1.6, 1.6, 0.9], [19, 17, 3.2, 1.6, 1.8], [21, 20, 1.6, 1.6, 0.9],
  [11, 22, 1.6, 1.6, 1.8], [11, 22, 1.6, 1.6, 1.8], [24, 8, 1.6, 1.6, 0.9],
  // CT spawn
  [36, 16, 1.6, 1.6, 0.9], [52, 6, 3.2, 1.6, 1.8],
  // Site A
  [72, 12, 3.2, 3.2, 1.8], [79, 19, 1.6, 1.6, 0.9], [67, 21, 1.6, 1.6, 1.8], [82, 8, 1.6, 1.6, 0.9], [76, 24, 1.6, 1.6, 0.9],
  // Mid
  [43, 49, 1.6, 1.6, 0.9],
  // Mid dưới
  [37, 59, 1.6, 1.6, 0.9], [51, 57, 1.6, 1.6, 1.8],
  // Long
  [81, 45, 1.6, 1.6, 0.9], [79, 57, 1.6, 1.6, 1.8], [77, 71, 1.6, 1.6, 0.9],
  // T spawn
  [27, 80, 1.6, 1.6, 0.9], [55, 79, 1.6, 1.6, 1.8], [27, 88, 3.2, 1.6, 0.9],
  // Hầm
  [9, 40, 1.6, 1.6, 0.9], [20, 64, 1.6, 1.6, 0.9],
];

const rectM = (x0, z0, x1, z1) => ({ x0: x0 * CELL, z0: z0 * CELL, x1: (x1 + 1) * CELL, z1: (z1 + 1) * CELL });

export const ZONES = {
  A: { ...rectM(33, 3, 40, 11), name: 'A' },
  B: { ...rectM(4, 3, 11, 11), name: 'B' },
  buyT: rectM(12, 38, 30, 44),
  buyCT: rectM(17, 2, 27, 9),
};

// Tên khu vực (hiện trên radar / kill feed kiểu CS: "Tèo @ Long A")
export const PLACES = [
  ['Site B', 2, 2, 13, 13], ['Cửa B', 14, 5, 16, 8], ['CT Spawn', 17, 2, 27, 9], ['Lối CT', 28, 4, 30, 8],
  ['Site A', 31, 2, 42, 13], ['Mid', 20, 10, 23, 26], ['Mid dưới', 17, 27, 26, 32], ['Mid', 20, 33, 23, 37],
  ['Catwalk', 24, 14, 33, 16], ['Long A', 39, 14, 42, 37], ['Cửa Long', 26, 34, 38, 38], ['T Spawn', 12, 38, 30, 44],
  ['Hầm trên', 3, 14, 6, 30], ['Hầm dưới', 3, 31, 16, 37],
];

const spawnRow = (cx0, cz, n, step) => Array.from({ length: n }, (_, i) => ({ x: (cx0 + i * step) * CELL + 1, z: cz * CELL + 1 }));
export const SPAWNS = {
  T: [...spawnRow(16, 41, 5, 3), ...spawnRow(17, 43, 5, 3)].slice(0, 8),
  CT: [...spawnRow(18, 4, 5, 2), ...spawnRow(19, 6, 4, 2)].slice(0, 8),
};
export const SPAWN_YAW = { T: 0, CT: Math.PI }; // T nhìn Bắc, CT nhìn Nam

// Hướng nhìn khi giữ site: các cửa vào site
export const WATCH = {
  A: [{ x: 64, z: 30 }, { x: 82, z: 30 }, { x: 58, z: 12 }],
  B: [{ x: 10, z: 28 }, { x: 30, z: 13 }],
};

// Điểm chờ / phục kích theo phe (m)
export const HOLDS = {
  CT_A: [{ x: 70, z: 6 }, { x: 64, z: 18 }, { x: 84, z: 16 }],
  CT_B: [{ x: 6, z: 6 }, { x: 22, z: 8 }, { x: 16, z: 22 }],
  CT_MID: [{ x: 43, z: 22 }, { x: 44, z: 14 }],
};

export function buildMap() {
  const solid = new Uint8Array(W * H).fill(1);
  const floorMat = new Array(W * H).fill(null);
  for (const [x0, z0, x1, z1, mat] of CARVES)
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { solid[z * W + x] = 0; floorMat[z * W + x] = mat; }
  for (const [x0, z0, x1, z1] of FILLS)
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { solid[z * W + x] = 1; floorMat[z * W + x] = null; }

  const boxes = [];
  // Gộp ô đặc thành hình chữ nhật lớn (greedy) -> ít collider/mesh
  const used = new Uint8Array(W * H);
  for (let z = 0; z < H; z++)
    for (let x = 0; x < W; x++) {
      const i = z * W + x;
      if (!solid[i] || used[i]) continue;
      let w = 1;
      while (x + w < W && solid[i + w] && !used[i + w]) w++;
      let h = 1;
      outer: while (z + h < H) {
        for (let k = 0; k < w; k++) if (!solid[(z + h) * W + x + k] || used[(z + h) * W + x + k]) break outer;
        h++;
      }
      for (let dz = 0; dz < h; dz++) for (let k = 0; k < w; k++) used[(z + dz) * W + x + k] = 1;
      const height = 5 + ((x * 7 + z * 13) % 4) * 0.8;
      boxes.push({ min: [x * CELL, 0, z * CELL], max: [(x + w) * CELL, height, (z + h) * CELL], mat: (x * 5 + z * 3) % 3 === 0 ? 'plaster' : 'wall' });
    }

  for (const [cx, cz, w, d, h] of PILLARS)
    boxes.push({ min: [cx - w / 2, 0, cz - d / 2], max: [cx + w / 2, h, cz + d / 2], mat: 'pillar' });
  for (const [cx, cz, w, d, h] of CRATES)
    boxes.push({ min: [cx - w / 2, 0, cz - d / 2], max: [cx + w / 2, h, cz + d / 2], mat: 'crate' });
  // Thùng thứ 2 trùng toạ độ = chồng lên nhau
  dedupeStacks(boxes);

  for (const [x0, z0, x1, z1] of ROOFS) {
    const r = rectM(x0, z0, x1, z1);
    boxes.push({ min: [r.x0, ROOF_Y, r.z0], max: [r.x1, ROOF_Y + 0.4, r.z1], mat: 'roof' });
  }

  // Sàn: gộp theo vật liệu để render; collider sàn là 1 khối lớn
  const floors = [];
  const usedF = new Uint8Array(W * H);
  for (let z = 0; z < H; z++)
    for (let x = 0; x < W; x++) {
      const i = z * W + x;
      const m = floorMat[i];
      if (!m || usedF[i]) continue;
      let w = 1;
      while (x + w < W && floorMat[i + w] === m && !usedF[i + w]) w++;
      let h = 1;
      outer: while (z + h < H) {
        for (let k = 0; k < w; k++) { const j = (z + h) * W + x + k; if (floorMat[j] !== m || usedF[j]) break outer; }
        h++;
      }
      for (let dz = 0; dz < h; dz++) for (let k = 0; k < w; k++) usedF[(z + dz) * W + x + k] = 1;
      floors.push({ x0: x * CELL, z0: z * CELL, x1: (x + w) * CELL, z1: (z + h) * CELL, mat: m });
    }

  return { W, H, CELL, solid, boxes, floors, zones: ZONES, spawns: SPAWNS, size: [W * CELL, H * CELL] };
}

function dedupeStacks(boxes) {
  const seen = new Map();
  for (const b of boxes) {
    if (b.mat !== 'crate') continue;
    const k = `${b.min[0]},${b.min[2]},${b.max[0]},${b.max[2]}`;
    const below = seen.get(k);
    if (below) { const h = b.max[1] - b.min[1]; b.min[1] = below.max[1]; b.max[1] = b.min[1] + h; }
    seen.set(k, b);
  }
}

export const inRect = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

export function placeName(x, z) {
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  for (const [n, x0, z0, x1, z1] of PLACES) if (cx >= x0 && cx <= x1 && cz >= z0 && cz <= z1) return n;
  return '';
}
