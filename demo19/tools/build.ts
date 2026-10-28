// Build map: texture -> WAD -> .map -> SDHLT (csg/bsp/vis/rad) -> kiểm BSP -> (tuỳ chọn) cài vào cstrike/maps.
//   tsx tools/build.ts           map Bến Thành, chất lượng đầy đủ
//   tsx tools/build.ts --map=wecare  map khu xưởng Wecare (PLAN-cs_wecare.md); mặc định --map=benthanh
//   tsx tools/build.ts --fast    compile nhanh (vis/rad nhẹ) để lặp
//   tsx tools/build.ts --box     map hộp test chuỗi compile
//   tsx tools/build.ts --install compile đầy đủ rồi copy vào game (chỉ file của map này)
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeMap } from '../src/brush.ts';
import { ENGINE_LIMITS, readBsp } from '../src/bsp.ts';
import { BOX_TEXTURES, boxMap } from '../src/boxmap.ts';
import { TOOL_TEXTURES, type TexDef } from '../src/textures.ts';
import { toMipTex, writeWad } from '../src/wad.ts';
import { makeWaypoints, writePwf, type WaypointHints } from '../src/waypoints.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SDHLT = process.env.SDHLT ?? 'E:\\game-r-tools\\sdhlt\\tools';
const GAME_MAPS = process.env.CS_MAPS ?? 'E:\\Game\\HL\\cstrike\\maps';
const PODBOT_WPT = process.env.PODBOT_WPT ?? 'E:\\Game\\HL\\cstrike\\PODBot\\WPTDefault';
const args = new Set(process.argv.slice(2));
const fast = args.has('--fast');
const boxMode = args.has('--box');
const install = args.has('--install');
const mapId = [...args].find((a) => a.startsWith('--map='))?.slice('--map='.length) ?? 'benthanh';

const OUT = join(ROOT, 'build');
mkdirSync(OUT, { recursive: true });

async function loadMap(): Promise<{ name: string; textures: TexDef[]; entities: (wads: string) => ReturnType<typeof boxMap>; title?: string; bot?: { hints: WaypointHints; bounds: { x0: number; y0: number; x1: number; y1: number } } }> {
  if (boxMode) return { name: 'cs_bt_box', textures: BOX_TEXTURES, entities: boxMap };
  if (mapId === 'wecare') {
    const w = await import('../src/wecare.ts');
    return { name: 'cs_wecare', textures: w.TEXTURES, entities: w.wecareMap, title: w.TITLE, bot: { hints: w.WAYPOINT_HINTS, bounds: w.BOUNDS } };
  }
  if (mapId !== 'benthanh') throw new Error(`--map=${mapId} không có (benthanh | wecare)`);
  const m = await import('../src/benthanh.ts');
  return { name: 'cs_benthanh', textures: m.TEXTURES, entities: m.benThanhMap, title: m.TITLE, bot: { hints: m.WAYPOINT_HINTS, bounds: m.BOUNDS } };
}

const map = await loadMap();

// 1. Texture -> WAD
const t0 = Date.now();
const mips = [];
for (const t of map.textures) mips.push(toMipTex(t.name, await t.make()));
const wadPath = join(OUT, `${map.name}.wad`);
writeFileSync(wadPath, writeWad(mips));
console.log(`[wad] ${mips.length} texture -> ${wadPath} (${Date.now() - t0} ms)`);

// 2. .map
const scale = new Map(map.textures.map((t) => [t.name, t.scale]));
const wads = [wadPath, join(SDHLT, 'sdhlt.wad')].join(';');
const entities = map.entities(wads);
const used = new Set(entities.flatMap((e) => (e.brushes ?? []).flatMap((b) => b.map((f) => f.tex))));
const unknown = [...used].filter((t) => !scale.has(t) && !TOOL_TEXTURES.includes(t));
if (unknown.length) throw new Error(`texture chưa khai báo: ${unknown.join(', ')}`);
const mapPath = join(OUT, `${map.name}.map`);
writeFileSync(mapPath, writeMap(entities, (t) => scale.get(t) ?? 1));
const brushCount = entities.reduce((s, e) => s + (e.brushes?.length ?? 0), 0);
console.log(`[map] ${entities.length} entity, ${brushCount} brush -> ${mapPath}`);

// 3. Compile
const tool = (n: string) => join(SDHLT, 'Win64', `sd${n}_x64.exe`);
const steps: [string, string[]][] = [
  ['HLCSG', ['-nowadtextures']],
  ['HLBSP', []],
  ['HLVIS', fast ? ['-fast'] : ['-full']],
  ['HLRAD', [...(fast ? ['-fast', '-bounce', '1'] : ['-extra', '-bounce', '8', '-ao']), '-pre25', '-smooth', '50']],
];
const base = join(OUT, map.name);
for (const [name, extra] of steps) {
  const s = Date.now();
  const r = spawnSync(tool(name), [...extra, '-chart', base], { cwd: OUT, encoding: 'latin1', maxBuffer: 64 << 20 });
  const log = (r.stdout ?? '') + (r.stderr ?? '');
  writeFileSync(join(OUT, `${map.name}.${name.toLowerCase()}.log`), log);
  const bad = log.split(/\r?\n/).filter((l) => /error|leak|exceeded|warning: .*(outside|invalid)/i.test(l));
  console.log(`[${name}] exit ${r.status} (${((Date.now() - s) / 1000).toFixed(1)} s)${bad.length ? `\n  ${bad.slice(0, 12).join('\n  ')}` : ''}`);
  if (r.status !== 0 || /LEAK/i.test(log) || existsSync(`${base}.lin`)) {
    throw new Error(`${name} lỗi, xem ${map.name}.${name.toLowerCase()}.log${existsSync(`${base}.lin`) ? ' (có leak: file .lin)' : ''}`);
  }
}

// 4. Kiểm BSP
const bspPath = `${base}.bsp`;
const info = readBsp(readFileSync(bspPath));
const problems: string[] = [];
if (info.version !== 30) problems.push(`BSP version ${info.version} (cần 30)`);
const notEmbedded = info.textures.filter((t) => !t.embedded && t.name.toLowerCase() !== 'sky');
if (notEmbedded.length) problems.push(`texture chưa nhúng: ${notEmbedded.map((t) => t.name).join(', ')}`);
const world = info.entities.find((e) => e.classname === 'worldspawn');
if (world?.wad) problems.push(`worldspawn còn key wad: ${world.wad}`);
for (const [k, lim] of Object.entries(ENGINE_LIMITS)) if (info.counts[k] > lim) problems.push(`${k} ${info.counts[k]} > limit ${lim}`);
const count = (c: string) => info.entities.filter((e) => e.classname === c).length;
const need: [string, number][] = [['info_player_start', 1], ['info_player_deathmatch', 1], ['hostage_entity', 1], ['info_hostage_rescue', 1]];
for (const [c, n] of need) if (count(c) < n) problems.push(`thiếu ${c}`);
console.log(
  `[bsp] ${(readFileSync(bspPath).length / 1024).toFixed(0)} KB, ${info.textures.length} texture, ` +
    `CT ${count('info_player_start')} / T ${count('info_player_deathmatch')} / con tin ${count('hostage_entity')}, ` +
    ['faces', 'clipnodes', 'leafs', 'models', 'lighting'].map((k) => `${k} ${info.counts[k]}/${ENGINE_LIMITS[k]}`).join(', '),
);
// Engine GL cấp tối đa 64 khối lightmap 128x128 ("AllocBlock: full" sẽ crash khi load map) -> giữ dư địa 25%.
const alloc = /AllocBlock\s+(\d+)\/(\d+)/.exec(readFileSync(join(OUT, `${map.name}.hlrad.log`), 'latin1'));
if (alloc) {
  console.log(`[bsp] lightmap AllocBlock ${alloc[1]}/${alloc[2]}`);
  if (+alloc[1] > 0.75 * +alloc[2]) problems.push(`lightmap AllocBlock ${alloc[1]}/${alloc[2]} quá 75%`);
}
if (problems.length) throw new Error(`BSP không đạt:\n  ${problems.join('\n  ')}`);

// 5. Cài vào game: chỉ ghi file của chính map này.
if (install) {
  if (!existsSync(GAME_MAPS)) throw new Error(`không thấy ${GAME_MAPS}`);
  // Map gọi model riêng cho con tin: thiếu file thì engine báo lỗi khi load map
  for (const mdl of new Set(entities.map((e) => e.props.model).filter((m): m is string => !!m && !m.startsWith('*'))))
    if (!existsSync(join(GAME_MAPS, '..', mdl))) throw new Error(`map cần ${mdl} nhưng game chưa có (chạy tools/hostage.ts --install)`);
  copyFileSync(bspPath, join(GAME_MAPS, `${map.name}.bsp`));
  if (map.title) writeFileSync(join(GAME_MAPS, `${map.name}.txt`), map.title, 'latin1');
  console.log(`[install] ${map.name}.bsp${map.title ? ` + ${map.name}.txt` : ''} -> ${GAME_MAPS}`);
  if (map.bot && existsSync(PODBOT_WPT)) {
    const wps = makeWaypoints(entities, map.bot.bounds, map.bot.hints);
    writeFileSync(join(PODBOT_WPT, `${map.name}.pwf`), writePwf(wps, map.name, 'game-r demo19'));
    console.log(`[install] ${map.name}.pwf (${wps.length} waypoint POD-Bot) -> ${PODBOT_WPT}`);
  }
}
console.log('OK');
