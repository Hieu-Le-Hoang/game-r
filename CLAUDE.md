# game-r

## Mọi thứ nằm ở đâu
- **Code game**: `demoN/` — mỗi demo là project độc lập (Vite + npm, riêng `package.json`/lockfile). demo1 = 1 file HTML (CDN), demo7 = Unity, demo8 = Godot. Bảng tổng: `README.md`.
- **Plan từng demo**: file PLAN.md trong folder demo (khuôn: `docs/new-game-plan.md`, skill `new-game`).
- **Việc đang làm / bài học**: `tasks/todo.md` · `tasks/lessons.md`. Tiến độ ngắn cho SessionStart: `TODO.md` (phần trên vạch `---`).
- **Asset thô tải về**: `_inbox/` (gitignore, không commit).
- **Quyết định**: `decisions/NNNN-*.md` (ADR). Đọc trước khi đổi kiến trúc.
- **Luật riêng của dự án**: `linters/` — luật viết thành script chạy được.
- **Danh sách gate**: `scripts/gates.sh`; `scripts/verify.sh` chạy chúng. Gate đang tắt + lý do: `TODO.md`.

## Lệnh
- `sh scripts/verify.sh` — gate của root repo. **Không ai chạy hộ** — chạy trước khi báo xong.
- Trong `demoN/`: `npm run build` (và `npm run selftest` nếu có) — kiểm riêng demo vừa sửa.
- `node linters/<rule>.mjs <file>` — chạy một luật trên một file.

## Luật (hook cưỡng chế)
- **Không** đọc/sửa `.env*`, key, credential. (PreToolUse **DENY**.)
- **Không** sửa config lint/test/hook để dập lỗi. (PreToolUse **ASK** — chỉ xin khi chính người muốn đổi luật.)
- **Không** hardcode secret hay log PII. (`linters/security.mjs`; PostToolUse báo ngay sau mỗi lần sửa.)
- **Không** đẻ file mới khi đáng lẽ phải sửa file có sẵn.

<!-- init-workflow:start -->
## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a Staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management
1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles
- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
<!-- init-workflow:end -->
