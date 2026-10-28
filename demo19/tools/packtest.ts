// Test gói cài: dựng thư mục game giả (pak0.pak nhỏ chỉ có scientist, dao gốc, PODBot), chạy chính file .tgz bằng npx
// như máy các bạn sẽ chạy: install -> dep on -> status -> dep off. Không đụng thư mục game thật.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFromPak, writePak } from '../src/pak.ts';
import { KNIFE_FILES, makeSandalKnife } from '../src/patch-dep.ts';
import { makeHostage } from '../src/patch-hostage.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REAL = process.env.HL_DIR ?? 'E:\\Game\\HL';
const FAKE = join(ROOT, 'build', 'fakegame');
let failed = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`);
  if (!ok) failed++;
};

// Dao gốc lấy từ backup nếu máy thật đang bật dép
const knifeSrc = (f: string) => (existsSync(join(REAL, 'cstrike', 'models', '_goc_dao', f)) ? join(REAL, 'cstrike', 'models', '_goc_dao', f) : join(REAL, 'cstrike', 'models', f));

rmSync(FAKE, { recursive: true, force: true });
for (const d of ['valve', 'cstrike/models', 'cstrike/PODBot']) mkdirSync(join(FAKE, d), { recursive: true });
writeFileSync(join(FAKE, 'hl.exe'), '');
copyFileSync(join(REAL, 'cstrike', 'liblist.gam'), join(FAKE, 'cstrike', 'liblist.gam'));
copyFileSync(join(REAL, 'cstrike', 'PODBot', 'PodBot.cfg'), join(FAKE, 'cstrike', 'PODBot', 'PodBot.cfg'));
const realPak = join(REAL, 'valve', 'pak0.pak');
const sci = { 'models/scientist.mdl': readFromPak(realPak, 'models/scientist.mdl'), 'models/scientistt.mdl': readFromPak(realPak, 'models/scientistt.mdl') };
writeFileSync(join(FAKE, 'valve', 'pak0.pak'), writePak(sci));
for (const f of KNIFE_FILES) if (existsSync(knifeSrc(f))) copyFileSync(knifeSrc(f), join(FAKE, 'cstrike', 'models', f));
const orig = Object.fromEntries(KNIFE_FILES.map((f) => [f, readFileSync(join(FAKE, 'cstrike', 'models', f))]));

// Gọi bằng đường dẫn tương đối "./...tgz" như README (npx không nhận đường dẫn tuyệt đối D:...)
const run = (cmd: string) => execSync(`npx --yes ./build/cs-benthanh-1.0.0.tgz ${cmd} --game "${FAKE}"`, { cwd: ROOT, encoding: 'utf8' });
const cs = (...p: string[]) => join(FAKE, 'cstrike', ...p);

console.log(run('install').trim());
check(readFileSync(cs('maps', 'cs_benthanh.bsp')).equals(readFileSync(join(ROOT, 'build', 'cs_benthanh.bsp'))), 'map đúng bản build');
check(existsSync(cs('maps', 'cs_benthanh.txt')) && existsSync(cs('PODBot', 'WPTDefault', 'cs_benthanh.pwf')), 'có bảng giới thiệu + waypoint');
const h = makeHostage(sci['models/scientist.mdl'], sci['models/scientistt.mdl']);
check(readFileSync(cs('models', 'bt_bantrong.mdl')).equals(h.mdl) && readFileSync(cs('models', 'bt_bantrongT.mdl')).equals(h.tex), 'con tin vá đúng (giống hệt bản build)');
check(KNIFE_FILES.every((f) => readFileSync(cs('models', f)).equals(orig[f])), 'install KHÔNG đụng dao');

console.log(run('dep on').trim());
check(KNIFE_FILES.every((f) => readFileSync(cs('models', f)).equals(makeSandalKnife(orig[f]).mdl)), 'dep on: 3 file dao thành dép');
check(KNIFE_FILES.every((f) => readFileSync(cs('models', '_goc_dao', f)).equals(orig[f])), 'dep on: backup đúng dao gốc');
run('dep on');
check(KNIFE_FILES.every((f) => readFileSync(cs('models', f)).equals(makeSandalKnife(orig[f]).mdl)), 'dep on lần 2: không vá chồng (vẫn vá từ bản gốc)');
check(/ĐANG BẬT/.test(run('status')), 'status báo dép đang bật');

console.log(run('dep off').trim());
check(KNIFE_FILES.every((f) => readFileSync(cs('models', f)).equals(orig[f])), 'dep off: trả đúng dao gốc từng byte');
check(/tắt \(dao gốc\)/.test(run('status')), 'status báo dép đã tắt');

if (failed) {
  console.log(`${failed} kiểm tra FAIL`);
  process.exit(1);
}
console.log('packtest OK');
