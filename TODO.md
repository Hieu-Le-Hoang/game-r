# TODO — việc đang làm và kế tiếp

> Hook SessionStart in phần **trên vạch `---` đầu tiên** ở mỗi phiên. Không gì tự ghi file này —
> xong việc nào thì tick rồi xoá nó; lịch sử nằm ở `git log`. Chi tiết từng demo: `tasks/todo.md`.

## Đang làm
- [ ] demo7 (Hầm Mộ Vua Xương): đã sửa đen màn hình bản WebGL, chờ anh test lại https://wcg-game-r-demo7.vercel.app
- [ ] demo11 (Lục Địa MU): xong MVP, chờ anh test tay.
- [ ] demo12 (Đảo Pet Tiếng Anh, game học tiếng Anh lớp 3): plan đã duyệt 2026-10-14 ở `demo12/PLAN.md`, chưa build. Session sau: build MVP theo checklist trong `tasks/todo.md`.

## Tiếp theo
- [ ] demo8, demo9: chờ test tay · demo4 Phase B: chờ Mixamo · demo6: đang làm.
- [ ] Harness: root chỉ có gate `security`. Cân nhắc thêm gate `build`/`selftest` theo từng demo vào `scripts/gates.sh`.

---

## Gate đang tắt

- **doc-paths** — tắt 2026-10-13: 20 lỗi nợ cũ, phần lớn là path tương đối tính từ folder demo
  (`tasks/todo.md` trỏ `core/*.js`, `tools/*`; `demo9/CREDITS.md` trỏ `chars/*.glb`) hoặc placeholder
  (PLAN.md của demo mới), linter lại resolve từ root. Bật lại khi các path trong doc đã viết từ root repo.
  `install.sh --upgrade` sẽ cắm lại gate này — gỡ lại sau mỗi lần upgrade.
- **format-check · lint · typecheck · test** — SKIP: root không có `package.json`/`biome.json`/`tsconfig.json`;
  mỗi demo là project Vite độc lập, không có script `test`/`lint`.

## Review

- 2026-10-13 — upgrade harness lên bundle mới (`install.sh --upgrade`): thay hook/linter/verify, `PROGRESS.md` -> `TODO.md`.
  `verify`: 1 pass (security) · 0 fail · 4 skip; `doc-paths` gỡ lại vì nợ cũ.
