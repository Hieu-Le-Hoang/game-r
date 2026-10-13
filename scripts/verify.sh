#!/bin/sh
# THE GATE — one command for "is this repo in a good state?". Run it before claiming a task done.
#
#   sh scripts/verify.sh            # full run
#   sh scripts/verify.sh --quiet    # only failures
#
# WHICH gates run lives in scripts/gates.sh (sourced below). This file is the plumbing: file lists,
# the gate/skip helpers and the report. POSIX sh — Git's sh on Windows, dash on Linux.
#
# Two rules:
#   1. A gate whose tool is missing is SKIPPED and listed — never silently passed.
#   2. Zero gates run is NOT a pass: exit 1.
set -u

QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1
log() { [ "$QUIET" = "1" ] || echo "$@"; }

PASS=0; FAIL=0; SKIP=0
FAILED=""; SKIPPED=""

# gate <name> <command...>
gate() {
  name="$1"; shift
  if out="$("$@" 2>&1)"; then
    PASS=$((PASS+1)); log "  ✓ PASS $name"
    echo "$out" | grep '^⚠️' >&2 || true   # a passing gate can still have something to say
  else
    # Only a tool that could not START is a skip; a real failure that mentions ENOENT is a failure.
    head3="$(echo "$out" | head -3)"
    if echo "$head3" | grep -qiE 'command not found|is not recognized as an internal|could not determine executable|not found$|spawn .* ENOENT|^node: bad option'; then
      SKIP=$((SKIP+1)); SKIPPED="$SKIPPED $name"; log "  ○ SKIP $name — tool not installed"
    else
      FAIL=$((FAIL+1)); FAILED="$FAILED $name"
      echo "  ✗ FAIL $name" >&2
      echo "$out" | head -20 >&2
    fi
  fi
}
skip() { SKIP=$((SKIP+1)); SKIPPED="$SKIPPED $1"; log "  ○ SKIP $1 — not configured"; }
has_script() { [ -f package.json ] && grep -q "\"$1\"[[:space:]]*:" package.json; }
# Package manager by lockfile (pnpm when there is none). Tool binaries are called straight from
# node_modules/.bin: skipping the package manager's own startup saves seconds per gate on Windows.
if [ -f package-lock.json ]; then PM=npm; elif [ -f yarn.lock ]; then PM=yarn; elif [ -f bun.lockb ]; then PM=bun; else PM=pnpm; fi
BIN=./node_modules/.bin

log ""
log "▶ verify"
log ""

# File lists come from git (tracked + new untracked files, ignoring .gitignore'd ones), so build
# output and node_modules never get scanned.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  ls_files() { git ls-files --cached --others --exclude-standard "$@" 2>/dev/null | tr '\n' ' '; }
  CODE_FILES="$(ls_files '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs' '*.py')"
  MD_FILES="$(ls_files '*.md')"
else
  log "  ⚠️  not a git repository — run \`git init\`; the custom linters need a file list from git."
  CODE_FILES=""; MD_FILES=""
fi

if [ -f scripts/gates.sh ]; then
  . ./scripts/gates.sh
else
  echo "  ✗ FAIL: scripts/gates.sh not found — no gate list, nothing was verified." >&2
  exit 1
fi

# ---- Report ------------------------------------------------------------------------------------
if [ "$FAIL" -gt 0 ]; then BANNER="⛔"; elif [ "$PASS" -eq 0 ]; then BANNER="⚠️"; else BANNER="✅"; fi
echo ""
echo "$BANNER verify: $PASS passed · $FAIL failed · $SKIP skipped"
[ -n "$SKIPPED" ] && echo "   skipped:$SKIPPED"
if [ "$FAIL" -gt 0 ]; then
  echo "   failed:$FAILED" >&2
  exit 1
fi
if [ "$PASS" -eq 0 ]; then
  echo "   ⛔ NOTHING RAN — not a pass. Wire at least one gate in scripts/gates.sh." >&2
  exit 1
fi
exit 0
