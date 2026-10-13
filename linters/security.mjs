#!/usr/bin/env node
// SECURITY LINTER — hardcoded secrets + PII in code.
//
//   node linters/security.mjs <file...>
//
// Exit 1 with a printed fix on violation. Exit 2 if invoked with NO files — a linter handed an
// empty list must not report success; that is the silent-no-op bug. Callers that legitimately have
// nothing to check must skip the gate explicitly, not pass an empty list.

import { readFileSync } from 'node:fs';

const files = process.argv.slice(2).filter(Boolean);
if (files.length === 0) {
  console.error('⛔ security.mjs: no files given — refusing to report success on an empty run.');
  process.exit(2);
}

// ---- Single-line rules -------------------------------------------------------------------------
const RULES = [
  {
    id: 'hardcoded-secret',
    // Assignment of a long opaque literal to a secret-ish name.
    //
    // `[:=]{1,2}` rather than `[:=]`: a single character misses the Go/Python walrus operator
    // entirely. Measured — a `password<colon-equals>"<20 chars>"` line exited 0, a live secret
    // through the one rule written to catch it. It also now matches `==`, i.e. comparing against a
    // literal credential, which is a finding too and not a false positive worth narrowing for.
    //
    // The example above is spelled out in words on purpose. Written literally it made THIS FILE
    // fail its own rule — `verify.sh` feeds linters/*.mjs to the linter like any other source, and
    // a comment is not exempt from the secret rules (only pii-in-log skips comments). Documenting a
    // credential shape by pasting one is the same mistake the rule exists to catch.
    re: /\b(api[_-]?key|secret|password|passwd|token|client[_-]?secret|private[_-]?key)\b\s*[:=]{1,2}\s*['"`][^'"`\n]{12,}['"`]/i,
    fix: 'Move it to an env var read via process.env.X and add the name to .env.example.',
  },
  {
    id: 'known-key-prefix',
    // Provider-specific key shapes: AWS, Google, GitHub PAT, Slack, Stripe, OpenAI/Anthropic.
    re: /\b(AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|gh[pousr]_[0-9A-Za-z]{36,}|xox[baprs]-[0-9A-Za-z-]{10,}|sk-(?:ant-)?[0-9A-Za-z_-]{20,})\b/,
    fix: 'This is a live credential shape. Remove it, rotate the key, and read it from env.',
  },
  {
    id: 'private-key-block',
    re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
    fix: 'Never commit key material. Store it in a secret manager.',
  },
  {
    id: 'gcp-service-account',
    // A Google service-account JSON key, by its two unmistakable fields. It carries no `sk-`-style
    // prefix and its private_key value is a PEM block that may sit lines away, so neither
    // known-key-prefix nor private-key-block reliably catches the file. It is also the single most
    // common credential to land in a repo by accident on a GCP stack — `gcloud iam
    // service-accounts keys create` writes it straight into the working directory.
    re: /"type"\s*:\s*"service_account"|"private_key_id"\s*:\s*"/,
    fix: 'This is a GCP service-account key. Delete it, rotate the key, and use Workload Identity or an env var.',
  },
  {
    id: 'connection-string',
    // user:password@host inside a URI — a live credential that no name-based rule above catches.
    re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:'"`/]+:[^\s@'"`/]{4,}@[^\s'"`/]+/i,
    fix: 'Credentials inside a connection URI. Build the URI from env vars at runtime.',
  },
];

// ---- Multi-line rule: PII reaching a log / telemetry sink ---------------------------------------
//
// WHY THIS IS NOT A PER-LINE RULE. `post_tool_use.sh` runs `biome format --write` on the edited
// file BEFORE calling this linter. Formatting wraps a long call across lines:
//
//     console.log('user', { phone: u.phone })   ->   console.log('user', {
//                                                      phone: u.phone,
//                                                    });
//
// A single-line regex sees the first form and misses the second — so the harness's own formatter
// blinded the harness's own linter, and the same file went red -> green with no code change.
// A 3-line window closes it wherever the formatter breaks the call.
//
// The sink list is deliberately wider than console.*: real projects log through a logger, an error
// reporter, or an event bus, and PII leaks through all of them equally.
// NOT JS-ONLY. `print(...)` and `logging.info(...)` are how a Python file leaks PII, and this linter
// is regex-based so it reads .py perfectly well — verify.sh feeds it .py for that reason. A sink
// list written in one language's idiom is a gate that quietly stops applying the moment the repo
// gains a second language. Measured before this line changed: `print(u.cccd)` exited 0.
// `\bprint` and not `print`: the boundary keeps `sprint(` / `pprint(` from matching by accident.
const LOG_SINK = String.raw`(?:console\.\w+|logger\.\w+|log\.\w+|logging\.\w+|\bprint|fmt\.Print\w*|Console\.Write\w*|Sentry\.capture\w*|\w+\.(?:emit|publish|track|report|info|warn|error|debug))`;
// Adjust the field list per project / jurisdiction.
const PII_FIELD = String.raw`(?:cccd|cmnd|passport|bank_?account|so_?tai_?khoan|salary|luong|phone|sdt|dob|ngay_?sinh)`;
const PII_IN_LOG = new RegExp(`${LOG_SINK}\\s*\\([^;]*?\\b${PII_FIELD}\\b`, 'i');
const PII_FIX =
  'Do not log PII. Log an opaque id instead and look the record up in a controlled tool.';

const WINDOW = 3;

// ---- Suppression: scoped to pii-in-log, and it must name the rule -------------------------------
//
// Two separate decisions, both deliberate.
//
// 1. WHICH RULES CAN BE MUTED AT ALL. `pii-in-log` is a heuristic over a field-name list: a variable
//    called `phone` that holds a support-desk extension is a genuine false positive, and a rule that
//    cannot be silenced on a genuine false positive is a rule people delete outright. The four rules
//    above match credential SHAPES, not names — a hit is either a live secret or a fixture that
//    should not be committed either. There is nothing for an author to vet, so there is nothing to
//    mute. An earlier version placed this check before the RULES loop, which silenced all five.
//
// 2. IT MUST NAME THE RULE. A bare marker is a blanket suppression; Ruff treats that as a violation
//    in its own right (PGH004, "Suppressing all diagnostics can hide issues in the code"). The
//    previous pattern accepted `\S+` as a "reason", so a single character disabled the line.
//
//    Usage:  console.log(ext.phone);  // security-lint-ignore: pii-in-log — desk extension, not PII
const ignoredRule = (line) => /security-lint-ignore:\s*([a-z][a-z-]*)/.exec(line ?? '')?.[1] ?? null;

// A commented-out log cannot leak at runtime, so pii-in-log skips comments. The secret rules above
// deliberately do NOT: a commented-out credential is still committed, still in the history, and
// still needs rotating. The distinction is the point — blanket "ignore comments" would hide the
// worse of the two findings.
// Found the honest way: this linter flagged the example inside its own explanatory comment.
const isComment = (line) => /^\s*(\/\/|\/\*|\*|#|<!--)/.test(line ?? '');

let violations = 0;
let suppressed = 0;
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // deleted between listing and reading — not this linter's business
  }
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    // No suppression branch here on purpose — see the note on ignoredRule above. Secret rules match
    // credential shapes, and a credential shape in the tree is a finding whatever the author meant.
    for (const r of RULES) {
      if (r.re.test(line)) {
        console.error(`${file}:${i + 1}  [${r.id}]  ${line.trim().slice(0, 120)}`);
        console.error(`   fix: ${r.fix}`);
        violations++;
      }
    }
  });

  // Sliding window. Anchor the report to the line the SINK starts on, and de-duplicate: three
  // overlapping windows would otherwise report the same call three times.
  const reported = new Set();
  for (let i = 0; i < lines.length; i++) {
    const winLines = lines.slice(i, i + WINDOW);
    const win = winLines.join('\n');
    const m = PII_IN_LOG.exec(win);
    if (!m) continue;
    const at = i + (win.slice(0, m.index).split('\n').length - 1);
    if (reported.has(at)) continue;
    if (isComment(lines[at])) continue;
    // The marker counts ANYWHERE in the window, not only on the anchor line. The finding is
    // anchored to the line the SINK starts on, but an author writes the marker next to the FIELD —
    // and `biome format --write`, which post_tool_use.sh runs BEFORE this linter, moves it there
    // anyway when it breaks a long call across lines. Requiring it on the anchor line makes the
    // hatch stop working the moment the formatter reflows the call: the same trap that forced the
    // 3-line window in the first place, mirrored onto the suppression.
    if (winLines.some((l) => ignoredRule(l) === 'pii-in-log')) {
      reported.add(at);
      suppressed++;
      console.error(`${file}:${at + 1}  [pii-in-log] SUPPRESSED  ${(lines[at] ?? '').trim().slice(0, 120)}`);
      continue;
    }
    reported.add(at);
    console.error(`${file}:${at + 1}  [pii-in-log]  ${(lines[at] ?? '').trim().slice(0, 120)}`);
    console.error(`   fix: ${PII_FIX}`);
    violations++;
  }
}

// Suppressions stay VISIBLE even on a clean run. A hatch nobody can count is a hatch nobody
// reviews — Semgrep keeps suppressed hits as an "Ignored" triage state for the same reason. The
// ⚠️ prefix is what scripts/verify.sh looks for to surface this on a PASSing gate.
if (suppressed) {
  console.error(
    `⚠️  security: ${suppressed} pii-in-log finding(s) suppressed by security-lint-ignore — review them periodically.`,
  );
}


if (violations) {
  console.error(`\n⛔ security: ${violations} violation(s).`);
  process.exit(1);
}
process.exit(0);
