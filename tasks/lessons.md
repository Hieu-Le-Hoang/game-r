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

## 2026-10-13 · Plan game mới thiếu bước Gameplay
- Sai: anh hỏi "bắt đầu game mới cần plan gì", em liệt kê mục tiêu -> scope -> engine -> art -> budget -> verify -> deploy, gameplay chỉ lướt qua 1 dòng "core loop". Do các demo trước chủ yếu A/B engine/art trên cùng gameplay demo2.
- Rule: plan game mới luôn có bước **Gameplay** riêng (core loop 3 tầng, verbs/controls/camera, game feel, enemy/boss, progression, tiêu chí "vui"), đặt NGAY SAU mục tiêu và TRƯỚC engine/art — vì gameplay quyết định engine cần gì. Chỉ đi tắt khi demo là bản port giữ nguyên gameplay.
- Không gray-box, không ghi scope: lần build đầu mặc định là MVP (vừa đủ chơi hết 1 vòng core loop).
- Template `docs/new-game-plan.md` không có mục Budget/Verify: anh để agent tự quyết hiệu năng và cách verify khi làm, plan chỉ giữ những gì anh cần duyệt (mục tiêu, gameplay, engine, asset, deploy).

## 2026-10-13 · Phaser 4: smoke test headless thay cho mở browser (demo11)
- Cách làm: `demo11/tools/smoke.mjs`. jsdom + `Phaser.HEADLESS` + `game.loop.sleep()` rồi tự gọi `game.headlessStep(t, dt)`. Bot giả lập người chơi đi hết core loop, mọi exception đều làm test fail. Bắt được 3 bug runtime mà `vite build` không thấy.
- Các chỗ phải vá để chạy được: (1) loader gắn method `json/image/audio` lên **từng instance** (FileTypesManager), nên phải vá trong `preload` chứ không vá prototype; ảnh thì tạo canvas đúng kích thước đọc từ header WebP. (2) `TextureSource.update` vẫn đọc `renderer.gl` dù đang HEADLESS -> bỏ qua khi renderer null. (3) Canvas 2D giả phải trả `measureText().width` là số và `getImageData().data` là mảng thật, proxy no-op làm Text crash. (4) Globals cần thêm: `screen`, `XMLHttpRequest`, `matchMedia`; ảnh base64 mặc định của Phaser phải tự gọi `onload`.
- Bẫy: có `process.on('uncaughtException')` mà không in ra thì lỗi ở top-level await bị nuốt, Node thoát **mã 0 không in gì**. Handler luôn phải log lỗi.
- Code game: dùng `this.renderer?.gl` và chỉ tạo RenderTexture khi có renderer, để cùng một code chạy được cả browser lẫn headless.

## 2026-10-13 · Phaser `scene.restart()` dùng lại instance cũ (demo11)
- Sai: đổi map bằng `scene.restart({ map })`, cờ `this.leaving` của lần qua cổng trước vẫn còn, nên chết trong Dungeon thì lệnh về Lorencia bị bỏ qua và hero kẹt mãi ở trạng thái chết. `create()` chỉ gán lại field nào nó đụng tới.
- Rule: field nào của scene sống qua một lần map (`leaving`, `boss`, `dark`, `bench`, `fx`, `hover`...) thì reset hết trong `init()`. Keyboard và listener input thì Phaser 4 tự dọn khi shutdown (`removeAllKeys(true)`), không cần lo.
- Kiểm đường thẳng cho nhân vật có thân: `lineFree` chỉ xét đường tâm, nên nhân vật đi sượt góc tường là kẹt (đứng chạy tại chỗ). Dùng 3 đường song song cách nhau bằng bán kính thân (`lineFreeR`), và khi trượt không nhích được nữa thì tìm lại đường / chuyển sang flow field.

## 2026-10-28 · Đọc ngược góp ý "bé ngang ra" (demo19 cs_wecare)
- Sai: anh gõ không dấu "cho be ngang ra xiu" (= bè ngang ra, nới rộng), em đọc thành "bé" (nhỏ lại) và thu 2 cánh cửa kho từ 128 xuống 96. Anh phải nhắc lại "chưa điều chỉnh cho rộng ra".
- Rule: góp ý không dấu mà một từ đọc được 2 nghĩa ngược nhau (be/bè/bé, to/tò, cao/cạo...) thì dựa vào từ đi kèm: "... ra" (ngang ra, rộng ra, dài ra) là nới thêm; "... lại" (nhỏ lại, thấp lại) là thu bớt. Vẫn không chắc thì ghi rõ cách hiểu ("em hiểu là nới rộng") trong bảng góp ý trước khi sửa.
- Tương tự với "rộng / dài / cao" của một vật: anh nói theo **góc nhìn trong ảnh chụp màn hình**, không theo trục của model. Xe nâng nhìn ngang hông mà anh bảo "rộng ra" thì là chiều đầu - đuôi (em đã nới nhầm bề ngang, anh phải nhắc "chưa sửa cho dài ra"). Đọc hướng camera trong ảnh trước khi chọn trục.

## 2026-10-28 · Build vẫn cài bản lỗi vì grep nằm giữa chuỗi && (demo19 cs_wecare)
- Sai: chạy `selftest | grep FAIL... && build --install`. Selftest FAIL (bot không vào được phòng họp), nhưng grep khớp dòng FAIL nên trả mã 0, build vẫn chạy và cài bản lỗi vào game.
- Rule: lấy mã thoát của chính selftest (`selftest > log; r=$?; [ $r -eq 0 ] && build`), không để grep nằm giữa chuỗi `&&` trước một bước ghi/cài đặt.
