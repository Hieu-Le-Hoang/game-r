// Waypoint POD-Bot (.pwf, "PODWAY!" v7) sinh từ lưới đường đi. Format đọc ngược từ cs_italy.pwf:
// header 80 byte (magic 8, version, số waypoint, tên map 32, người tạo 32) + mỗi waypoint 204 byte.
import type { Entity, V2, V3 } from './brush.ts';
import { buildNav, key, type Node } from './nav.ts';

export const WF = { CROSSING: 1 << 3, GOAL: 1 << 4, RESCUE: 1 << 6, CAMP: 1 << 7, TERRORIST: 1 << 29, COUNTER: 1 << 30 };
const MAX_LINKS = 8;
const EYE = 36; // waypoint đặt ở tâm người chơi = sàn + 36

export interface Waypoint {
  p: V3;
  node: Node;
  flags: number;
  radius: number;
  camp: [number, number, number, number];
  links: { to: number; dist: number }[];
}

export interface WaypointHints {
  crossings: V3[];
  /** Điểm thường bắt buộc (chân cầu thang ở khe hẹp mà lưới đều bỏ sót). */
  points: V3[];
  camps: { at: V3; team: 'T' | 'CT'; look: [V2, V2] }[];
}

export function makeWaypoints(ents: Entity[], bounds: { x0: number; y0: number; x1: number; y1: number }, hints: WaypointHints, spacing = 112): Waypoint[] {
  const nav = buildNav(ents, bounds);
  const origins = (c: string) => ents.filter((e) => e.props.classname === c).map((e) => e.props.origin.split(' ').map(Number) as V3);
  const must = (o: V3, feet: number, what: string) => {
    const n = nav.nodeAt(o, feet);
    if (!n) throw new Error(`waypoint: ${what} ${o.join(',')} không đứng trên sàn`);
    return n;
  };
  const ct = origins('info_player_start').map((o) => must(o, 36, 'CT spawn'));
  const reach = nav.bfs(ct, 18); // bot chỉ đi bộ + rơi xuống, không nhảy

  const wps: Waypoint[] = [];
  const add = (node: Node, flags = 0, camp: [number, number, number, number] = [0, 0, 0, 0]) => {
    if (!reach.has(key(node))) throw new Error(`waypoint: điểm ${nav.center(node).join(',')} không đi bộ tới được từ CT spawn`);
    const c = nav.center(node);
    wps.push({ p: [c[0], c[1], c[2] + EYE], node, flags, radius: 32, camp, links: [] });
  };
  for (const o of origins('hostage_entity')) add(must(o, 8, 'con tin'), WF.GOAL);
  for (const o of origins('info_hostage_rescue')) add(must(o, 36, 'rescue'), WF.RESCUE);
  for (const o of [...origins('info_player_start'), ...origins('info_player_deathmatch')]) add(must(o, 36, 'spawn'));
  for (const o of hints.crossings) add(must(o, 0, 'crossing'), WF.CROSSING);
  for (const o of hints.points) add(must(o, 0, 'điểm'));
  for (const c of hints.camps) add(must(c.at, 0, 'camp'), WF.CAMP | (c.team === 'T' ? WF.TERRORIST : WF.COUNTER), [c.look[0][0], c.look[0][1], c.look[1][0], c.look[1][1]]);

  // Lưới đều trên mọi sàn đi bộ tới được, bỏ điểm quá gần điểm bắt buộc.
  const step = Math.round(spacing / 16);
  const forced = wps.length;
  for (let i = step >> 1; i < nav.NX; i += step)
    for (let j = step >> 1; j < nav.NY; j += step)
      for (const h of nav.floors(i, j)) {
        const node = { i, j, h };
        if (!reach.has(key(node))) continue;
        const c = nav.center(node);
        if (wps.slice(0, forced).some((w) => Math.hypot(w.p[0] - c[0], w.p[1] - c[1]) < 56 && Math.abs(w.p[2] - EYE - h) < 40)) continue;
        add(node);
      }

  // Bot đi thẳng giữa 2 waypoint: mỗi 8 unit trên đoạn thẳng phải có sàn đứng được, lệch độ cao nội suy <= 30 (bậc thang),
  // và không chui qua chỗ phải rơi (trừ đoạn cuối hạ xuống).
  const straight = (a: Waypoint, b: Waypoint) => {
    const n = Math.ceil(Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]) / 8);
    for (let s = 1; s < n; s++) {
      const t = s / n;
      const x = a.p[0] + (b.p[0] - a.p[0]) * t;
      const y = a.p[1] + (b.p[1] - a.p[1]) * t;
      const z = a.node.h + (b.node.h - a.node.h) * t;
      const hs = nav.floors(Math.floor((x - nav.X0) / 16), Math.floor((y - nav.Y0) / 16));
      if (!hs.some((h) => Math.abs(h - z) <= 30 || (b.node.h < a.node.h && h <= a.node.h + 2 && h >= b.node.h - 2))) return false;
    }
    return true;
  };

  // Nối: đường đi thật trên lưới gần như thẳng (<= 1.15 x khoảng cách + 24), không quá 300 unit, đi thẳng được.
  // Tối đa 8 link: ưu tiên điểm gần nhất ở mỗi hướng/tầng khác nhau, để cầu thang không bị điểm cùng sàn chiếm hết chỗ.
  const byKey = new Map(wps.map((w, idx) => [key(w.node), idx]));
  wps.forEach((w, idx) => {
    const dist = nav.bfs([w.node], 18, 300);
    const cand: { to: number; d2: number; d3: number; ang: number; dz: number }[] = [];
    for (const [k, d] of dist) {
      const to = byKey.get(k);
      if (to === undefined || to === idx) continue;
      const q = wps[to].p;
      const d2 = Math.hypot(q[0] - w.p[0], q[1] - w.p[1]);
      if (d <= 1.15 * d2 + 24 && straight(w, wps[to]))
        cand.push({ to, d2, d3: Math.hypot(d2, q[2] - w.p[2]), ang: Math.atan2(q[1] - w.p[1], q[0] - w.p[0]), dz: q[2] - w.p[2] });
    }
    cand.sort((a, b) => a.d2 - b.d2);
    const picked: typeof cand = [];
    const similar = (a: (typeof cand)[0], b: (typeof cand)[0]) => Math.abs(a.dz - b.dz) < 24 && Math.abs(((a.ang - b.ang + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) < Math.PI / 6;
    for (const c of cand) if (picked.length < MAX_LINKS && !picked.some((p) => similar(p, c))) picked.push(c);
    for (const c of cand) if (picked.length < MAX_LINKS && !picked.includes(c)) picked.push(c);
    w.links = picked.map((c) => ({ to: c.to, dist: Math.round(c.d3) }));
  });
  return wps;
}

export function writePwf(wps: Waypoint[], mapName: string, creator: string): Buffer {
  const head = Buffer.alloc(80);
  head.write('PODWAY!', 0, 'latin1');
  head.writeInt32LE(7, 8);
  head.writeInt32LE(wps.length, 12);
  head.write(mapName, 16, 31, 'latin1');
  head.write(creator, 48, 31, 'latin1');
  const body = Buffer.alloc(204 * wps.length);
  wps.forEach((w, i) => {
    const o = i * 204;
    body.writeInt32LE(i, o);
    body.writeInt32LE(w.flags, o + 4);
    w.p.forEach((v, c) => body.writeFloatLE(v, o + 8 + 4 * c));
    body.writeFloatLE(w.radius, o + 20);
    w.camp.forEach((v, c) => body.writeFloatLE(v, o + 24 + 4 * c));
    for (let k = 0; k < MAX_LINKS; k++) {
      const l = w.links[k];
      body.writeInt16LE(l ? l.to : -1, o + 40 + 2 * k);
      body.writeInt32LE(l ? l.dist : 0, o + 168 + 4 * k);
    }
    // connectflag (o+56), vận tốc nhảy (o+72), con trỏ next (o+200): để 0
  });
  return Buffer.concat([head, body]);
}

export function readPwf(b: Buffer) {
  if (b.toString('latin1', 0, 7) !== 'PODWAY!') throw new Error('không phải PODWAY');
  const n = b.readInt32LE(12);
  const wps = [];
  for (let i = 0; i < n; i++) {
    const o = 80 + i * 204;
    wps.push({
      num: b.readInt32LE(o),
      flags: b.readInt32LE(o + 4),
      p: [b.readFloatLE(o + 8), b.readFloatLE(o + 12), b.readFloatLE(o + 16)] as V3,
      links: [...Array(MAX_LINKS)].map((_, k) => b.readInt16LE(o + 40 + 2 * k)).filter((x) => x >= 0),
    });
  }
  return { version: b.readInt32LE(8), map: b.toString('latin1', 16, 48).split('\0')[0], size: b.length, wps };
}

/** Từ các waypoint `from`, tới được những waypoint nào theo link (có hướng). */
export function reachable(wps: { links: number[] }[], from: number[]): Set<number> {
  const seen = new Set(from);
  const q = [...from];
  while (q.length) for (const t of wps[q.pop()!].links) if (!seen.has(t)) (seen.add(t), q.push(t));
  return seen;
}
