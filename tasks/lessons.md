# Lessons

## 2026-10-10 · Đọc lệnh tiếng Việt không dấu
- Sai: anh gõ "dung het cac subagent" (ý là **dừng** hết), em hiểu thành **dùng** hết rồi chạy lại teammate.
- Rule: lệnh tiếng Việt không dấu mà đọc được 2 nghĩa ngược nhau (dừng/dùng, bỏ/bổ, xóa/xoá-giữ...) -> ưu tiên nghĩa **an toàn hơn** (dừng, không chạy thêm) hoặc hỏi lại 1 câu trước khi spawn agent hay chạy tool tốn tài nguyên.
- Session nào anh đã dặn "không Playwright / không test Chrome / không teammate" thì giữ suốt session đó, kể cả khi prompt gốc có prefix `<<`.

## 2026-10-10 · Tự chạy Playwright để verify demo7
- Sai: plan có dòng "chạy trên Chrome" nên em coi như đã duyệt, rồi tự mở Playwright chụp màn hình liên tục (còn treo browser vì bug vòng lặp). Anh phải chặn: "k chạy chrome, playwright".
- Rule: một dòng "verify trên Chrome" trong plan KHÔNG phải là giấy phép mở browser. Muốn dùng Playwright / chrome-dev thì hỏi riêng đúng lúc đó; mặc định verify bằng `npm run build` + đọc source, phần nhìn bằng mắt để anh tự test.
- Khi debug render (shader, lighting), đọc source shader trong `node_modules` trước: lỗi ô trống của TilemapGPULayer tìm ra nhờ đọc `TilemapGPULayer-frag.js`, không phải nhờ chụp màn hình.
