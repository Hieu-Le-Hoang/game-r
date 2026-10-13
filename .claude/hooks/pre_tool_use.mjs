#!/usr/bin/env node
// PreToolUse hook — runs BEFORE an Edit/Write/Bash executes. Three verdicts, by how reversible the
// action is:
//   DENY  (exit 2, reason on stderr)          — secrets, destructive / pipe-to-shell. No undo exists.
//   ASK   (exit 0, permissionDecision "ask")  — harness config. The human beside the agent approves.
//   ALLOW (exit 0, no output)                 — everything else.
//
// Plain node, no jq: node is already required by the linters, so the hook has no extra dependency.
import { readFileSync } from 'node:fs';

const deny = (msg) => {
  process.stderr.write(`⛔ BLOCKED by harness PreToolUse: ${msg}\n`);
  process.exit(2);
};
const ask = (msg) => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: `harness: ${msg}`,
      },
    }),
  );
  process.exit(0);
};

let payload = {};
try {
  const raw = readFileSync(0, 'utf8');
  if (raw.trim()) payload = JSON.parse(raw);
} catch {
  deny('could not parse the tool-call payload — refusing rather than guessing.');
}

// Windows sends absolute, backslash paths (d:\proj\x). Every pattern below uses `/`, so normalise
// first — otherwise the config gate silently matches nothing.
const slash = (s) => String(s ?? '').replace(/\\/g, '/');
const file = slash(payload?.tool_input?.file_path);
const cmd = slash(payload?.tool_input?.command);
const ROOT = slash(process.env.CLAUDE_PROJECT_DIR || process.cwd()).replace(/\/+$/, '');
const HOME = slash(process.env.HOME || process.env.USERPROFILE || '/nonexistent');
const lc = (s) => s.toLowerCase(); // Windows paths are case-insensitive: D:/x and d:/x are one dir.

const isAbs = (p) => /^(\/|[A-Za-z]:\/)/.test(p);
// Path relative to the repo, or null when it points outside. `/../` is resolved conservatively:
// anything that climbs is treated as in-repo, so it cannot be used to hide a write.
function repoRel(p) {
  if (!p) return null;
  if (p.startsWith('~/')) p = HOME + p.slice(1);
  if (!isAbs(p)) return p.replace(/^\.\//, '');
  if (p.includes('/../')) return p;
  if (lc(p).startsWith(`${lc(ROOT)}/`)) return p.slice(ROOT.length + 1);
  return null;
}

// ---- 1. Secrets — DENY. Not scoped to the repo: a secret is a secret wherever it lives. ----------
const SECRET_FILE = /(^|\/)(\.env(\.[^/]*)?|[^/]*\.(pem|p12|pfx|key)|[^/]*id_rsa[^/]*|[^/]*id_ed25519[^/]*|credentials\.json|secrets\.[^/]+)$/i;
const SECRET_TEMPLATE = /\.env\.(example|template|sample)$/i;
if (file && SECRET_FILE.test(file) && !SECRET_TEMPLATE.test(file)) {
  deny(`secret/credential file (${file}). Secrets live in a secret manager — never in the repo.`);
}

// ---- 2. Harness config — ASK. The rule an agent must not quietly loosen to make a gate go quiet. --
function isConfig(rel) {
  if (rel == null) return false;
  const base = rel.split('/').pop();
  return (
    /^(biome\.json|\.oxlintrc\.json|tsconfig[^/]*\.json|eslint\.config\.[cm]?js|vitest\.config\.[^/]+)$/.test(base) ||
    /(^|\/)\.claude\//.test(rel) ||
    /(^|\/)linters\//.test(rel) ||
    /(^|\/)scripts\/(verify|gates)\.sh$/.test(rel)
  );
}
const ASK_MSG = 'edit to harness config. Approve only if YOU want this rule changed — not to make a gate go quiet.';
if (file && isConfig(repoRel(file))) ask(`${ASK_MSG} (${file})`);

// ---- 3. Bash -------------------------------------------------------------------------------------
if (cmd) {
  // 3a. Destructive / unsafe — DENY.
  if (/rm -(rf|fr) (\/\*?|~\/?|\.\/?|\*)(\s|$)|:\(\)\{ :\|:& \};:/.test(cmd)) deny('destructive command.');
  if (/chmod -R 777|(curl|wget) [^|]*\|\s*(ba)?sh\b/.test(cmd)) deny('unsafe shell (world-writable / pipe-to-shell).');

  // 3b. Secrets on a command line — DENY. `.env` is matched as a FILE NAME with path boundaries, so
  //     `.env`, `./.env.local`, `cfg/.env.prod` match while `process.env.X`, `.envrc` do not.
  //     No template exemption here: `diff .env.example .env` contains the allowed name too.
  if (/(^|[^A-Za-z0-9_$])\.env(\.[A-Za-z0-9_-]+)*($|[^A-Za-z0-9_-])/.test(cmd)) {
    deny('Bash command references a .env file. Never read or move secrets (edit .env.example with Edit/Write instead).');
  }
  if (/id_rsa|id_ed25519|credentials\.json|secrets\.|\.pem\b|\.p12\b/.test(cmd)) {
    deny('Bash command references a secret/credential file. Never read or move secrets.');
  }

  // 3c. A Bash write into harness config — ASK. Checked AFTER 3b: ask exits 0, and
  //     `cp .env linters/x` must still be a deny.
  //     String matching on a command line; `sh ./tools/x.sh` writing a config passes through.
  const scan = cmd.replace(/2>&1|2>\/dev\/null/g, '');
  const toks = scan.split(/\s+/).filter(Boolean);
  const clean = (t) => t.replace(/^[<>|&;("'=]+/, '').replace(/["');]+$/, '');
  const writesTo = (i) => {
    const before = toks.slice(0, i).join(' ');
    if (/>/.test(before) || /^[>]/.test(toks[i])) return true; // redirect before the path
    if (/\bsed\s+(-[a-z]*i|--in-place)|\btee\b/.test(before)) return true;
    if (/(^|\s|;|&&)(cp|mv|ln|install)\s/.test(before) && i === toks.length - 1) return true;
    return false;
  };
  for (let i = 0; i < toks.length; i++) {
    const rel = repoRel(clean(toks[i]));
    if (isConfig(rel) && writesTo(i)) ask(`Bash write to harness config (${clean(toks[i])}). Approve only if YOU want this rule changed.`);
  }
}

process.exit(0);
