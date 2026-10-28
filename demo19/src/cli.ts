// Gói cài cs_benthanh cho team (Counter-Strike 1.3 bản WON). Gói chỉ chứa map + waypoint + code vá, KHÔNG chứa model
// của Valve: con tin bà bán rong và dép tổ ong được tạo ngay trên máy từ file game có sẵn.
//   cs-benthanh install [--game <thư mục HL>]   map + waypoint bot + con tin bà bán rong
//   cs-benthanh dep on | dep off                 bật / tắt dép tổ ong thay dao (mặc định: tắt)
//   cs-benthanh status
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFromPak } from './pak.ts';
import { KNIFE_FILES, makeSandalKnife } from './patch-dep.ts';
import { makeHostage } from './patch-hostage.ts';

const MAP = 'cs_benthanh';
const DATA = fileURLToPath(new URL('./data/', import.meta.url));
const BACKUP_DIR = '_goc_dao';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

function findGame(): string {
  const given = flag('--game') ?? process.env.CS13_DIR;
  const candidates = given
    ? [given]
    : [
        process.cwd(),
        join(process.cwd(), '..'),
        'C:\\Sierra\\Half-Life',
        'C:\\Program Files\\Sierra\\Half-Life',
        'C:\\Program Files (x86)\\Sierra\\Half-Life',
        'C:\\Games\\Half-Life',
        'D:\\Games\\Half-Life',
        'C:\\Game\\HL',
        'D:\\Game\\HL',
        'E:\\Game\\HL',
      ];
  for (const dir of candidates) if (existsSync(join(dir, 'hl.exe')) && existsSync(join(dir, 'cstrike', 'liblist.gam'))) return dir;
  throw new Error(
    given
      ? `"${given}" không phải thư mục Half-Life (cần có hl.exe và cstrike\\liblist.gam)`
      : 'không tự tìm thấy thư mục Half-Life. Chạy lại kèm: --game "D:\\duong\\dan\\Half-Life"',
  );
}

function checkVersion(game: string) {
  const lib = readFileSync(join(game, 'cstrike', 'liblist.gam'), 'latin1');
  const v = /version\s+"([^"]+)"/i.exec(lib)?.[1];
  if (v !== '1.3') console.log(`! cstrike/liblist.gam ghi version "${v ?? '?'}" (map làm cho CS 1.3, bản khác có thể lỗi)`);
}

function install(game: string) {
  const cs = join(game, 'cstrike');
  mkdirSync(join(cs, 'maps'), { recursive: true });
  copyFileSync(join(DATA, `${MAP}.bsp`), join(cs, 'maps', `${MAP}.bsp`));
  copyFileSync(join(DATA, `${MAP}.txt`), join(cs, 'maps', `${MAP}.txt`));
  console.log(`+ map        cstrike\\maps\\${MAP}.bsp`);

  // Waypoint POD-Bot: ghi vào thư mục waypoint đang dùng (PodBot.cfg: wptfolder), mặc định WPTDefault
  const pod = join(cs, 'PODBot');
  if (existsSync(pod)) {
    const cfg = existsSync(join(pod, 'PodBot.cfg')) ? readFileSync(join(pod, 'PodBot.cfg'), 'latin1') : '';
    // Windows không phân biệt hoa thường: gộp "wptdefault" với "WPTDefault"
    const byLower = new Map(['WPTDefault', ...[...cfg.matchAll(/^\s*wptfolder\s+(\S+)/gim)].map((m) => m[1])].map((f) => [f.toLowerCase(), f]));
    const folders = new Set(byLower.values());
    for (const f of folders) {
      mkdirSync(join(pod, f), { recursive: true });
      copyFileSync(join(DATA, `${MAP}.pwf`), join(pod, f, `${MAP}.pwf`));
    }
    console.log(`+ waypoint   cstrike\\PODBot\\{${[...folders].join(', ')}}\\${MAP}.pwf`);
  } else console.log('- waypoint   bỏ qua (máy không có POD-Bot)');

  // Con tin bà bán rong: vá từ scientist.mdl trong pak0.pak của chính máy này
  const pak = join(game, 'valve', 'pak0.pak');
  const h = makeHostage(readFromPak(pak, 'models/scientist.mdl'), readFromPak(pak, 'models/scientistt.mdl'));
  mkdirSync(join(cs, 'models'), { recursive: true });
  writeFileSync(join(cs, 'models', 'bt_bantrong.mdl'), h.mdl);
  writeFileSync(join(cs, 'models', 'bt_bantrongT.mdl'), h.tex);
  console.log('+ con tin    cstrike\\models\\bt_bantrong.mdl (+T) - chỉ map này dùng');
}

/** Bật dép: backup dao gốc 1 lần vào models\_goc_dao, rồi ghi bản dép (luôn vá từ bản gốc). Tắt: chép bản gốc về. */
function dep(game: string, on: boolean) {
  const models = join(game, 'cstrike', 'models');
  const backup = join(models, BACKUP_DIR);
  const files = KNIFE_FILES.filter((f) => existsSync(join(models, f)) || existsSync(join(backup, f)));
  if (!on) {
    if (!files.some((f) => existsSync(join(backup, f)))) return console.log('Dép chưa bật (không có backup), không cần tắt.');
    for (const f of files) if (existsSync(join(backup, f))) copyFileSync(join(backup, f), join(models, f));
    return console.log(`Đã TẮT dép: trả dao gốc (${files.join(', ')}).`);
  }
  mkdirSync(backup, { recursive: true });
  for (const f of files) {
    if (!existsSync(join(backup, f))) copyFileSync(join(models, f), join(backup, f));
    writeFileSync(join(models, f), makeSandalKnife(readFileSync(join(backup, f))).mdl);
  }
  console.log(`Đã BẬT dép tổ ong (${files.join(', ')}). Dao gốc ở cstrike\\models\\${BACKUP_DIR}\\.`);
  console.log('Chơi xong map nhớ chạy: cs-benthanh dep off');
}

function status(game: string) {
  const cs = join(game, 'cstrike');
  const models = join(cs, 'models');
  const same = (a: string, b: string) => existsSync(a) && existsSync(b) && readFileSync(a).equals(readFileSync(b));
  const depOn = KNIFE_FILES.some((f) => existsSync(join(models, BACKUP_DIR, f)) && !same(join(models, f), join(models, BACKUP_DIR, f)));
  console.log(`Thư mục game: ${game}`);
  console.log(`map ${MAP}:   ${existsSync(join(cs, 'maps', `${MAP}.bsp`)) ? 'đã cài' : 'chưa cài'}`);
  console.log(`con tin:          ${existsSync(join(models, 'bt_bantrong.mdl')) ? 'đã cài' : 'chưa cài'}`);
  console.log(`dép tổ ong:       ${depOn ? 'ĐANG BẬT (mọi map cầm dép)' : 'tắt (dao gốc)'}`);
}

function main() {
  const [cmd, sub] = args;
  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log('cs-benthanh install [--game "D:\\...\\Half-Life"]   cài map + waypoint bot + con tin bà bán rong');
    console.log('cs-benthanh dep on | dep off                        bật / tắt dép tổ ong thay dao');
    console.log('cs-benthanh status                                  xem đã cài gì');
    return;
  }
  const game = findGame();
  checkVersion(game);
  if (cmd === 'install') {
    install(game);
    console.log(`Xong. Vào CS 1.3 chọn map ${MAP}. Muốn cầm dép tổ ong: cs-benthanh dep on`);
  } else if (cmd === 'dep' && (sub === 'on' || sub === 'off')) dep(game, sub === 'on');
  else if (cmd === 'status') status(game);
  else throw new Error(`lệnh không hợp lệ: ${args.join(' ')} (xem: cs-benthanh help)`);
}

try {
  main();
} catch (e) {
  console.error(`Lỗi: ${(e as Error).message}`);
  process.exit(1);
}
