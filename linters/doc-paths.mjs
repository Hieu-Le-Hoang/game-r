#!/usr/bin/env node
// DOC-PATHS LINTER — a document must not point at a path that does not exist.
//
//   node linters/doc-paths.mjs <file.md...>
//
// Why this rule earns its keep: prose rots silently. A README that references `src/contexts/` six
// months after the folder became `src/modules/` reads exactly like a correct README — nobody can
// tell stale from current by looking. This turns that class of rot into a red gate.
//
// Only in-repo paths are checked (relative links and backticked paths that look like files).
// URLs, anchors, and prose are left alone.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const files = process.argv.slice(2).filter(Boolean);
if (files.length === 0) {
  console.error('⛔ doc-paths.mjs: no files given — refusing to report success on an empty run.');
  process.exit(2);
}

// Markdown link target: [text](./path/to/file.ts)  — skip http(s), mailto, and pure anchors.
const MD_LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;
// Backticked path that clearly names a repo file: `src/foo/bar.ts`, `scripts/verify.mjs`
const CODE_PATH = /`([a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)+\.[a-zA-Z0-9]{1,5})`/g;

let violations = 0;
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = text.split('\n');

  // A path in prose may be written two equally normal ways, and the file cannot tell you which:
  //   [text](./sibling.ts)     → relative to the document
  //   `src/modules/x.ts`       → relative to the repo root
  // Resolving against only one of them produces false positives, which is worse than no rule at
  // all: people learn to ignore the linter, and then it stops catching the real thing too.
  // So: a path counts as alive if EITHER interpretation exists.
  const check = (raw, lineNo) => {
    const target = raw.split('#')[0].trim();
    if (!target) return;
    if (/^(https?:|mailto:|tel:|#)/i.test(target)) return;
    if (target.includes('<') || target.includes('*')) return; // placeholder <name> or a glob
    if (/doc-paths-ignore/.test(lines[lineNo - 1])) return; // explicit, per-line, with the reason visible

    const candidates = target.startsWith('/')
      ? [resolve(process.cwd(), `.${target}`)]
      : [resolve(dirname(file), target), resolve(process.cwd(), target)];

    if (!candidates.some(existsSync)) {
      console.error(`${file}:${lineNo}  path does not exist → ${target}`);
      violations++;
    }
  };

  lines.forEach((line, i) => {
    for (const m of line.matchAll(MD_LINK)) check(m[1], i + 1);
    for (const m of line.matchAll(CODE_PATH)) check(m[1], i + 1);
  });
}


if (violations) {
  console.error(
    `\n⛔ doc-paths: ${violations} dead path(s). Fix the doc, or the path — do not leave prose pointing at nothing.`,
  );
  process.exit(1);
}
process.exit(0);
