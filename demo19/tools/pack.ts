// Đóng gói cho team: pack/data (map đã build + bảng giới thiệu + waypoint) + bundle src/cli.ts -> pack/cli.mjs
// (JS thuần, không thư viện native), rồi npm pack -> build/cs-benthanh-<version>.tgz. Không publish.
// Chạy `npm run build` trước để có build/cs_benthanh.bsp mới nhất.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { BOUNDS, TITLE, WAYPOINT_HINTS, benThanhMap } from '../src/benthanh.ts';
import { makeWaypoints, writePwf } from '../src/waypoints.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACK = join(ROOT, 'pack');
const DATA = join(PACK, 'data');
const BSP = join(ROOT, 'build', 'cs_benthanh.bsp');
mkdirSync(DATA, { recursive: true });

if (!existsSync(BSP)) throw new Error('chưa có build/cs_benthanh.bsp, chạy npm run build trước');
const newest = Math.max(...['src/benthanh.ts', 'src/props.ts', 'src/textures.ts'].map((f) => statSync(join(ROOT, f)).mtimeMs));
if (statSync(BSP).mtimeMs < newest) throw new Error('build/cs_benthanh.bsp cũ hơn source map, chạy npm run build trước');

copyFileSync(BSP, join(DATA, 'cs_benthanh.bsp'));
writeFileSync(join(DATA, 'cs_benthanh.txt'), TITLE, 'latin1');
const ents = benThanhMap('');
writeFileSync(join(DATA, 'cs_benthanh.pwf'), writePwf(makeWaypoints(ents, BOUNDS, WAYPOINT_HINTS), 'cs_benthanh', 'game-r demo19'));

await build({
  entryPoints: [join(ROOT, 'src', 'cli.ts')],
  outfile: join(PACK, 'cli.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  banner: { js: '#!/usr/bin/env node' },
  logLevel: 'warning',
});
const cli = readFileSync(join(PACK, 'cli.mjs'), 'utf8');
if (/from ["']sharp["']|require\(["']sharp["']\)/.test(cli)) throw new Error('cli.mjs còn phụ thuộc sharp');

const out = execSync(`npm pack --pack-destination "${join(ROOT, 'build')}"`, { cwd: PACK, encoding: 'utf8' });
console.log(`[pack] ${join(ROOT, 'build', out.trim().split(/\r?\n/).pop()!)}`);
