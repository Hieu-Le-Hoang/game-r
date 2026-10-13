# Lessons

## 2026-10-10 · Đọc lệnh tiếng Việt không dấu
- Sai: anh gõ "dung het cac subagent" (ý là **dừng** hết), em hiểu thành **dùng** hết rồi chạy lại teammate.
- Rule: lệnh tiếng Việt không dấu mà đọc được 2 nghĩa ngược nhau (dừng/dùng, bỏ/bổ, xóa/xoá-giữ...) -> ưu tiên nghĩa **an toàn hơn** (dừng, không chạy thêm) hoặc hỏi lại 1 câu trước khi spawn agent hay chạy tool tốn tài nguyên.
- Session nào anh đã dặn "không Playwright / không test Chrome / không teammate" thì giữ suốt session đó, kể cả khi prompt gốc có prefix `<<`.

## 2026-10-10 · Tự chạy Playwright để verify demo7
- Sai: plan có dòng "chạy trên Chrome" nên em coi như đã duyệt, rồi tự mở Playwright chụp màn hình liên tục (còn treo browser vì bug vòng lặp). Anh phải chặn: "k chạy chrome, playwright".
- Rule: một dòng "verify trên Chrome" trong plan KHÔNG phải là giấy phép mở browser. Muốn dùng Playwright / chrome-dev thì hỏi riêng đúng lúc đó; mặc định verify bằng `npm run build` + đọc source, phần nhìn bằng mắt để anh tự test.
- Khi debug render (shader, lighting), đọc source shader trong `node_modules` trước: lỗi ô trống của TilemapGPULayer tìm ra nhờ đọc `TilemapGPULayer-frag.js`, không phải nhờ chụp màn hình.

## 2026-10-10 · Mảng đen màn hình do NaN trong shader (demo2, demo6)
- Sai: `fx.js` loot beam viết `pow(1.0 - vUv.y, 1.6)`. vUv.y nội suy vượt 1 chút -> cơ số âm -> NaN trên ANGLE/D3D -> bloom HalfFloat downsample lan NaN thành khối đen chữ nhật.
- Rule: shader tự viết luôn kẹp đầu vào của `pow` / `sqrt` / `log` (`clamp(x, 0.0, 1.0)` hoặc `max(x, 0.0)`), tránh `normalize` vector 0 và chia cho 0. Copy `fx.js` sang demo mới -> soát lại các chỗ này.
- Nhận diện: mảng đen cạnh thẳng theo khung hình + có bloom/HalfFloat -> nghi NaN trước. Clamp rồi vẫn đen -> thêm pass lọc `isnan` trước bloom.

## 2026-10-12 · Godot 4 headless + MCP (demo8)
- **MCP sửa scene xoá mất script:** `attach_script` / `modify_node` / `apply_scene_changes` của koltyakov/godot-mcp chạy trong context không nạp autoload. Script nào tham chiếu autoload (`S`, `Assets`) không compile được và bị bỏ khỏi `.tscn` mà vẫn báo success. Rule: sau mỗi lần MCP sửa scene, `grep script` file `.tscn`. Scene gốc gắn script autoload thì sửa tay.
- **Import hỏng bị cache:** glb nén meshopt import fail, sau khi thay file thường Godot vẫn đánh dấu `valid=false`. Rule: thay file nguồn sau một lần import lỗi thì xoá `.import` + `.godot/imported/<tên>*` rồi `--import` lại.
- **Hạt billboard to bất thường:** `BILLBOARD_PARTICLES` bỏ qua scale nếu thiếu `billboard_keep_scale = true`.
- **Renderer Compatibility (Web):** `blend_add` không nhân ALPHA. Shader cộng sáng phải tự nhân `ALBEDO *= a`; ramp màu của hạt phải fade về đen chứ không chỉ alpha 0.
- **GDScript:** `var x := dict.key` lỗi "Cannot infer type" vì Variant. Dùng `=` hoặc khai kiểu rõ. Lambda nhiều dòng nằm trong array/dict hay vỡ indent, nên tách ra biến local trước. `queue_free` con cũ rồi `get_child(0)` vẫn trả con cũ trong cùng frame, phải `remove_child` trước.
- **Verify hình khi không có GPU:** `xvfb-run godot --rendering-driver opengl3` + `get_viewport().get_texture().get_image().save_png()` chụp được ảnh thật bằng llvmpipe. Cách này không phải browser, và bắt được 6 lỗi hình mà selftest headless không thấy.

## 2026-10-13 · Clone game 2D mà đề xuất 3D (demo10 VLTK1)
- Sai: anh muốn "clone như VLTK1", em lấy gu 3D stylized trong memory đè lên, đề xuất Three.js + model 3D. Anh sửa: "game VLTK1 2009, k phai 3d".
- Rule: yêu cầu clone game cụ thể thì giữ đúng **dạng hình của bản gốc** (2D / 2.5D sprite / 3D). Gu art chung chỉ dùng để chọn asset **trong** dạng hình đó. 2.5D sprite render sẵn (như Flare demo5) không tính là pixel hay vẽ tay.
