---
name: new-game
description: Bắt đầu một game/demo mới trong repo game-r — rà request theo template `docs/new-game-plan.md` (Mục tiêu A/B, Gameplay, Engine, Art + asset), hỏi anh những mục còn thiếu trong 1 lượt, ghi `demoN/PLAN.md`, rồi build MVP và tự deploy Vercel. Trigger: "game mới", "làm game", "làm game mới", "demo mới", "tạo demo10", "thử engine X", "port demoX sang Y", "làm 1 game kiểu ...", "bắt đầu game". Áp dụng khi: anh muốn mở một demo mới (demoN) trong game-r. KHÔNG áp dụng khi: sửa/nâng cấp demo đã có.
---

# new-game — Mở demo mới trong game-r

Template gốc: [`docs/new-game-plan.md`](../../../docs/new-game-plan.md). Skill này là quy trình dùng template đó, không chép lại nội dung.

```
Request -> 1. Đọc template + lessons -> 2. Rà mục 1-4 -> 3. Hỏi phần thiếu (1 lượt)
        -> 4. Ghi demoN/PLAN.md, chờ anh duyệt -> 5. Build MVP -> 6. Tự làm deploy + docs
```

## 1. Đọc trước
- `docs/new-game-plan.md` — 4 mục cần chốt + checklist "Agent tự làm".
- `tasks/lessons.md` — lỗi cũ theo engine (Godot MCP, Unity batchmode, shader NaN, không tự mở Chrome).
- `ls -d demo*` để lấy số `N` kế tiếp. README có bảng demo để biết demo nào làm gì.

## 2. Rà mục 1-4 so với request
Với từng mục, phân loại: **đã rõ** / **suy ra được hợp lý** / **thiếu**.

| Mục | Được tự suy ra? |
|---|---|
| 1. Mục tiêu A/B | **Không.** Thiếu là phải hỏi. |
| 2. Gameplay | **Không** với thể loại, core loop, tiêu chí "vui". Controls/camera/game feel suy theo thể loại được, ghi rõ là đề xuất. |
| 3. Engine | Được đề xuất (mặc định Three.js/Phaser + Vite nếu không có lý do khác), kèm lý do theo gameplay. |
| 4. Art + asset | Được đề xuất nguồn CC0 hợp thể loại. Nếu A/B là về art thì nguồn phải lấy từ mục 1. |

Ca đặc biệt:
- **Port** (giữ gameplay demoX sang engine khác): mục 2 = "giữ nguyên demoX", chỉ cần chốt engine.
- Mục tiêu A/B là art -> nguồn art chốt ở mục 1, đảo Art lên trước Engine.

## 3. Hỏi phần thiếu
- Gom **tất cả** câu hỏi vào **1 lần** `AskUserQuestion` (tối đa 4 câu). Ưu tiên: Mục tiêu > Gameplay > Engine > Art.
- Mục suy ra được: đưa đề xuất làm option đầu, gắn "(Recommended)", không hỏi riêng.
- Không hỏi về: scope (mặc định MVP), budget hiệu năng, cách verify, deploy, docs.

## 4. Ghi plan, chờ duyệt
- Tạo `demoN/PLAN.md` theo khung template, điền đủ mục 1-4 (bảng verbs, bảng kẻ địch, bảng asset).
- Tóm tắt plan trong session (sơ đồ ASCII), **chờ anh duyệt** rồi mới code.

## 5. Build MVP
- MVP = vừa đủ chơi hết **1 vòng core loop**. Không làm thêm content khi chưa được yêu cầu.
- Budget hiệu năng + cách verify: tự quyết. Verify bằng build/selftest/đọc source; phần nhìn và game feel để anh test tay. **Không** tự mở Playwright/Chrome.
- Áp các rule trong `tasks/lessons.md` theo engine đang dùng.

## 6. Tự làm, không hỏi
Chạy checklist "Agent tự làm" cuối `docs/new-game-plan.md`:
- Deploy Vercel team `wecare2`, project `wcg-game-r-demoN`.
- README (bảng demo + mục "Engine & art"), `tasks/todo.md`, `glossary.md`, `CREDITS.md`, `tasks/lessons.md` nếu có lỗi đáng nhớ.
- Commit vẫn chờ anh bảo.
