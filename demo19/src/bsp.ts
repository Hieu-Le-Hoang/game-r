// Đọc BSP v30 sau compile để verify: entity, texture có nhúng đủ không, kích thước lump so với limit engine.

const LUMPS = ['entities', 'planes', 'textures', 'vertexes', 'visibility', 'nodes', 'texinfo', 'faces', 'lighting', 'clipnodes', 'leafs', 'marksurfaces', 'edges', 'surfedges', 'models'] as const;
const ITEM_SIZE: Partial<Record<(typeof LUMPS)[number], number>> = {
  planes: 20, vertexes: 12, nodes: 24, texinfo: 40, faces: 20, clipnodes: 8, leafs: 28, marksurfaces: 2, edges: 4, surfedges: 4, models: 64,
};
// Limit của engine GoldSrc gốc (bản 2001 dùng cùng bộ số này).
export const ENGINE_LIMITS: Record<string, number> = {
  planes: 32767, vertexes: 65535, nodes: 32767, texinfo: 8192, faces: 65535, clipnodes: 32767, leafs: 8192,
  marksurfaces: 65535, edges: 256000, surfedges: 512000, models: 400, lighting: 0x200000, entities: 0x20000,
};

export interface BspInfo {
  version: number;
  entities: Record<string, string>[];
  textures: { name: string; w: number; h: number; embedded: boolean }[];
  counts: Record<string, number>;
}

export function readBsp(f: Buffer): BspInfo {
  const version = f.readInt32LE(0);
  const lump = (i: number) => [f.readInt32LE(4 + 8 * i), f.readInt32LE(8 + 8 * i)] as const;
  const counts: Record<string, number> = {};
  LUMPS.forEach((name, i) => {
    const [, len] = lump(i);
    counts[name] = ITEM_SIZE[name] ? len / ITEM_SIZE[name]! : len;
  });

  const [eo, el] = lump(0);
  const text = f.toString('latin1', eo, eo + el);
  const entities = [...text.matchAll(/\{([^}]*)\}/g)].map((m) => Object.fromEntries([...m[1].matchAll(/"([^"]*)"\s+"([^"]*)"/g)].map((kv) => [kv[1], kv[2]])));

  const [to] = lump(2);
  const n = f.readInt32LE(to);
  const textures = [];
  for (let i = 0; i < n; i++) {
    const o = f.readInt32LE(to + 4 + 4 * i);
    if (o < 0) continue;
    const b = to + o;
    textures.push({
      name: f.toString('latin1', b, b + 16).split('\0')[0],
      w: f.readUInt32LE(b + 16),
      h: f.readUInt32LE(b + 20),
      embedded: f.readUInt32LE(b + 24) !== 0,
    });
  }
  return { version, entities, textures, counts };
}
