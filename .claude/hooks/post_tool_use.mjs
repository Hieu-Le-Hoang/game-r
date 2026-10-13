#!/usr/bin/env node
// PostToolUse hook — runs AFTER an Edit/Write succeeds, on the edited file. Never blocks.
//   1. Formats JS/TS/JSON with the repo's own biome, if it is installed.
//   2. Runs linters/security.mjs on the file; findings go back to the agent as additionalContext so
//      it fixes them on the next turn.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

let file = '';
try {
  file = JSON.parse(readFileSync(0, 'utf8') || '{}')?.tool_input?.file_path ?? '';
} catch {
  process.exit(0);
}
if (!file || !existsSync(file)) process.exit(0);
if (!/\.(ts|tsx|js|jsx|mjs|cjs|json|py)$/.test(file)) process.exit(0);

// Call the binary directly, not `pnpm exec`: pnpm's own startup costs seconds on Windows, paid on
// every single edit. No local biome -> no formatting, silently (it is a convenience, not a gate).
// .py reaches this hook only for the security scan; biome cannot parse it.
const bin = process.platform === 'win32' ? 'node_modules/.bin/biome.cmd' : 'node_modules/.bin/biome';
if (/\.(ts|tsx|js|jsx|mjs|cjs|json)$/.test(file) && existsSync(bin)) {
  spawnSync(bin, ['format', '--write', file], { stdio: 'ignore', shell: process.platform === 'win32' });
}

if (existsSync('linters/security.mjs')) {
  const r = spawnSync(process.execPath, ['linters/security.mjs', file], { encoding: 'utf8' });
  if (r.status === 1) {
    const msg = `Harness PostToolUse found issues in ${file} — fix them before continuing:\n${r.stdout}${r.stderr}`;
    process.stdout.write(
      JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: msg } }),
    );
  }
}
process.exit(0);
