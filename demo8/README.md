# demo8 — Hầm Mộ Vua Xương (Godot 4 + Godot MCP)

Port gameplay demo2 (Three.js) sang **Godot 4.7.2**, giữ nguyên art KayKit để so A/B chỉ khác engine. Toàn bộ project do AI agent dựng trên VM Linux không GPU, không màn hình, lái Godot qua **MCP** ở chế độ headless.

Live: https://wcg-game-r-demo8.vercel.app

## Gameplay

Giống demo2: Quán Rượu -> Đại Sảnh Xương Khô -> Hầm Mộ Vua Xương.

- 3 hero đổi bằng phím 1/2/3: Hiệp Sĩ, Chiến Binh, Pháp Sư. Có đánh thường, kỹ năng Q, lăn né, bình máu.
- 4 loại quái: lính xương, chiến binh xương, pháp sư xương, boss Vua Xương Morvak. Quái nằm ngủ dưới sàn và trồi dậy khi hero bước vào sảnh.
- Loot 4 độ hiếm kèm affix kiểu Diablo, rương, vàng, lên cấp, túi đồ 20 ô (trang bị, bán, so chỉ số).
- 2 NPC: Lyra giao quest dọn sảnh, Brann ngồi quán nói chuyện phiếm.

Phím: `WASD` hoặc click để chạy, click quái hoặc `J` để đánh, `Q` kỹ năng, `Space` lăn né, `R` bình máu, `F` nói chuyện, `I` túi đồ.

## Cấu trúc

```
demo8/
├── project.godot          # renderer Compatibility (bắt buộc cho Web), autoload Assets + S
├── scenes/main.tscn       # Main: WorldEnvironment, Sun, Camera3D, World, Fx, Hud
├── resources/env.tres     # Environment: ACES, glow, fog
├── scripts/
│   ├── main.gd            # map, combat, AI quái, loot, NPC, input, camera, selftest, chụp ảnh
│   ├── actor.gd           # nhân vật skeleton: crossfade animation, gắn vũ khí vào BoneAttachment3D
│   ├── fx.gd              # CPUParticles3D + shader vòng sóng / vệt chém / vùng cảnh báo / cột loot
│   ├── hud.gd             # toàn bộ UI dựng bằng Control
│   ├── game_state.gd      # autoload S: chỉ số, túi đồ, roll đồ
│   └── assets.gd          # autoload Assets: nạp model theo key
├── assets/models/         # KayKit (sinh từ demo2 bằng tools/), assets/fonts/
├── tools/build-assets.mjs # giải nén meshopt cho model nhân vật
└── export_presets.cfg     # preset Web (không thread, nên không cần header COOP/COEP)
```

## Chạy và kiểm thử (headless)

Cần Godot 4.7.2 trong PATH (`godot`).

```bash
cd demo8
godot --headless --import                                  # import asset lần đầu
DEMO8_SELFTEST=1 godot --headless --fixed-fps 30           # chơi tự động từ quán tới boss, in PASS/FAIL
DEMO8_SHOT=/tmp/d8 xvfb-run -a godot --rendering-driver opengl3 --resolution 1280x720   # chụp 7 cảnh ra PNG (render CPU)
mkdir -p export/web && godot --headless --export-release "Web"                          # build Web
cd export/web && npx vercel deploy --prod --scope wecare2                               # deploy
```

Selftest đi qua 21 bước: nhận quest, quái thức dậy, đánh, đổi hero, dùng kỹ năng, dọn sảnh, trả quest, nhặt đồ, mở rương, hạ boss, chết rồi hồi sinh, mở túi đồ.

## Godot MCP

Dùng [koltyakov/godot-mcp](https://github.com/koltyakov/godot-mcp), đăng ký ở scope local của Claude Code (không commit):

```bash
claude mcp add -s local godot -e GODOT_PATH=/opt/godot/Godot_v4.7.2-stable_linux.x86_64 -e GODOT_SILENCE_ROOT_WARNING=1 -- node /opt/godot-mcp/koltyakov/dist/index.js
```

Các tool MCP đã dùng: `init_project`, `set_autoload`, `set_project_setting`, `create_resource`, `update_resource`, `create_scene`, `apply_scene_changes`, `run_godot_script` (soi cấu trúc model), `check_script`, `run_project_diagnostics` (chạy headless + selftest), `list_export_presets`, `export_project`.

Hạn chế gặp phải (Godot 4.7.2, MCP bản commit `84b9c26`):

| Vấn đề | Cách xử lý |
|---|---|
| Thao tác sửa scene (`attach_script`, `modify_node`...) **âm thầm xoá** script nào tham chiếu autoload (`S`, `Assets`), vì context headless của MCP không nạp autoload | Gắn `script = ExtResource(...)` cho Main/Hud bằng tay trong `main.tscn`. Không sửa `main.tscn` qua MCP nữa |
| `check_script` chỉ báo "did not parse", không có dòng lỗi | Dùng `godot --headless --check-only --script res://...` để xem dòng lỗi |
| `set_project_setting` ghi số nguyên thành float (`1280.0`) | Vô hại, Godot vẫn đọc được |
| Coding-Solo/godot-mcp (bản 6k sao) cần màn hình mới `run_project` được | Chọn bản koltyakov vì chạy headless |
