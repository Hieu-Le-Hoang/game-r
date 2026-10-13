#!/bin/sh
# THE GATE LIST — sourced by scripts/verify.sh (do not run directly).
# Uses gate() / skip() / has_script() and CODE_FILES / MD_FILES / PM / BIN from verify.sh.
#
# Edit THIS file to fit the project:
#   · a gate that does not apply, or is red only from old debt -> delete its line, and note it in
#     PROGRESS.md ("gate X off: reason, re-enable when ...")
#   · a non-JS project -> add its own gates, e.g.
#       gate "pytest" pytest -q
#       gate "ruff"   ruff check .
#       gate "godot"  godot --headless --check-only --path .

# ---- 1. Format & lint --------------------------------------------------------------------------
if [ -f biome.json ]; then gate "format-check" $BIN/biome check .; else skip "format-check"; fi
if has_script lint; then gate "lint" $PM run lint; else skip "lint"; fi

# ---- 2. Project rules (linters/) ---------------------------------------------------------------
if [ -n "$CODE_FILES" ]; then gate "security" node linters/security.mjs $CODE_FILES; else skip "security"; fi

# ---- 3. Types & tests --------------------------------------------------------------------------
if [ -f tsconfig.json ]; then gate "typecheck" $BIN/tsc --noEmit; else skip "typecheck"; fi
if has_script test; then gate "test" $PM run test; else skip "test"; fi
