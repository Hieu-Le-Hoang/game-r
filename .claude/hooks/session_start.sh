#!/bin/sh
# SessionStart hook — STANDARDIZED STARTUP ROUTINE.
# Gives the agent oriented context at session start: where it is, what happened last, what's next.
# Git log is the single most trustworthy "what happened" record — unlike a status document, it
# cannot be edited by wishful thinking.
#
# POSIX sh only (Git's sh on Windows, dash on Linux). No `pipefail`.
set -u

echo "── harness session ──────────────────────────────────"
echo "cwd: $(pwd)"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "branch: $(git branch --show-current 2>/dev/null)"
  echo "last 5 commits:"
  git log -5 --format='  %h %s' 2>/dev/null || echo "  (no commits yet)"
  dirty="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
  echo "uncommitted files: $dirty"
else
  echo "git: not a repository yet — run \`git init\`. Until then the custom linters are SKIPPED"
  echo "     (they take their file list from git)."
fi
# TODO.md: everything above its first `---` line (title and > notes skipped).
[ -f TODO.md ] && { echo "todo (TODO.md):"; awk 'NR>1 && /^---$/ {exit} NR>1 && !/^>/ && NF' TODO.md | head -20; }
echo "gate: run \`sh scripts/verify.sh\` before claiming done — nothing runs it for you."
echo "      Harness-config edits ask the human for approval; secrets are denied."
echo "─────────────────────────────────────────────────────"
exit 0
