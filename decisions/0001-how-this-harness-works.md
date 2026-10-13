# ADR 0001 — Harness của repo: luật cho agent, không chứng minh

- **Status**: Decided (2026-10-13)
- **Ngày**: 2026-10-13
- **Người quyết**: chủ repo

---

## Bối cảnh

Repo được làm theo kiểu **người ngồi cùng agent**, duyệt từng lượt. Mục tiêu của harness là để agent
**làm ra kết quả và tuân luật** — không phải để chứng minh chính harness hoạt động. Các bản trước có hook
Stop chạy verify mỗi lượt, git hook, loop tự động và một bộ prover; tất cả tốn thời gian mà không bắt
thêm được gì người ngồi cạnh không thấy.

## Quyết định

1. **Hook PreToolUse** (node, không phụ thuộc gì thêm) có ba phán quyết:
   - **DENY**: secret (`.env*`, key, credential), lệnh hủy diệt, pipe-to-shell — không undo được.
   - **ASK**: sửa luật/config (`linters/`, `scripts/verify.sh`, `scripts/gates.sh`, `.claude/*`,
     config của tsc/biome/eslint/vitest) — người duyệt tại chỗ.
   - **ALLOW**: còn lại.
2. **Hook PostToolUse** format file vừa sửa và quét secret; chỉ góp ý, không chặn.
3. **`scripts/verify.sh`** là lệnh kiểm duy nhất, chạy tay trước khi báo xong. Gate nằm ở
   `scripts/gates.sh`.
4. **Không** hook Stop, **không** git hook, **không** CI, **không** prover.

## Hệ quả

- Được: không chặn giữa chừng, sửa config chỉ cần một cú bấm, cài trong vài giây.
- Mất: không có chốt lúc commit; không gì tự chạy `verify.sh`; ASK phụ thuộc người đọc prompt.
- Giảm thiểu: `CLAUDE.md` và SessionStart nhắc chạy `verify.sh`; PostToolUse quét secret mỗi lần agent
  sửa file. Khi repo có người thứ hai thì thêm CI chạy `sh scripts/verify.sh`.
