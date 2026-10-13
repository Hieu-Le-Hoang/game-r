# PROGRESS — việc kế tiếp (SessionStart đọc 5 dòng đầu)

1. demo11 (Lục Địa MU) xong MVP — chờ anh test tay. Chi tiết: `tasks/todo.md`.
2. demo7, demo8, demo9 — chờ test tay; demo4 Phase B chờ Mixamo; demo6 đang làm.
3. Harness: root chỉ có gate `security`. Cân nhắc thêm gate `build`/`selftest` theo từng demo vào `scripts/gates.sh`.

---

## Gate đang tắt

- **doc-paths** — tắt 2026-10-13: 20 lỗi nợ cũ, phần lớn là path tương đối tính từ folder demo
  (`tasks/todo.md` trỏ `core/*.js`, `tools/*`; `demo9/CREDITS.md` trỏ `chars/*.glb`) hoặc placeholder
  (PLAN.md của demo mới), linter lại resolve từ root. Bật lại khi các path trong doc đã viết từ root repo.
- **format-check · lint · typecheck · test** — SKIP: root không có `package.json`/`biome.json`/`tsconfig.json`;
  mỗi demo là project Vite độc lập, không có script `test`/`lint`.

---

**File này hoạt động thế nào.** Hook SessionStart in 5 dòng đầu ở mỗi phiên, để agent tiếp tục từ chỗ
phiên trước dừng. Không gì tự ghi file này — làm xong một phần việc thì cập nhật lại 5 dòng đầu.
