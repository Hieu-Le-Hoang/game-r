// Xem trước dép tổ ong: vá bản dao gốc (từ backup _goc_dao/ nếu có) bằng src/patch-dep.ts -> build/weapon/*.mdl + ảnh.
// Không đụng game. Bật / tắt dép trong game: lệnh `dep on` / `dep off` của gói cài (src/cli.ts).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { previewEmbedded } from '../src/mdlview.ts';
import { KNIFE_FILES, makeSandalKnife } from '../src/patch-dep.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'build', 'weapon');
const CS_MODELS = process.env.CS_MODELS ?? 'E:\\Game\\HL\\cstrike\\models';
mkdirSync(OUT, { recursive: true });

for (const file of KNIFE_FILES) {
  const src = existsSync(join(CS_MODELS, '_goc_dao', file)) ? join(CS_MODELS, '_goc_dao', file) : join(CS_MODELS, file);
  if (!existsSync(src)) continue;
  const r = makeSandalKnife(readFileSync(src));
  writeFileSync(join(OUT, file), r.mdl);
  await previewEmbedded(r.mdl, join(OUT, file.replace('.mdl', '.png')));
  console.log(`[dep] ${file}: xương dao ${r.knifeBone}, xương tay ${r.handBone}, ẩn mesh ${r.meshes.join(' ')}, dép dài ${r.len.toFixed(1)} unit`);
}
