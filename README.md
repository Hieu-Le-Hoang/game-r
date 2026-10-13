# game-r — Thử nghiệm làm game ARPG trên web bằng AI

Sandbox build cùng một vertical slice ARPG (hầm ngục -> sảnh -> boss) qua nhiều bộ art và engine khác nhau, để so sánh A/B về đồ họa, hiệu năng và quy trình xử lý asset. Toàn bộ code do AI agent viết, art lấy từ các pack free (CC0 / CC-BY-SA).

## Các demo

| Demo | Tên game | Thể loại | Engine | Art | Trạng thái | Live |
|---|---|---|---|---|---|---|
| [demo1](demo1/) | Hầm Ngục Pixel | Roguelike top-down 2D | Phaser 3 (CDN, 1 file HTML) | Kenney Tiny Dungeon | Preview | [wcg-game-r-demo1.vercel.app](https://wcg-game-r-demo1.vercel.app/) |
| [demo2](demo2/) | Hầm Mộ Vua Xương | ARPG 3D | Three.js | KayKit (CC0) | Xong | [wcg-game-r-demo2.vercel.app](https://wcg-game-r-demo2.vercel.app/) |
| [demo3](demo3/) | Ngai Quỷ Vương | ARPG 3D, đổi art từ demo2 | Three.js | Quaternius (CC0) | Xong | [wcg-game-r-demo3.vercel.app](https://wcg-game-r-demo3.vercel.app/) |
| [demo4](demo4/) | Ngai Quỷ Vương | Dark fantasy kiểu Diablo 4 | Three.js + N8AO | Poly Haven PBR + Quaternius (Mixamo dự kiến) | Phase A xong, Phase B chờ Mixamo | [wcg-game-r-demo4.vercel.app](https://wcg-game-r-demo4.vercel.app/) |
| [demo5](demo5/) | Hầm Mộ Ardwen | ARPG isometric 2D | Phaser 4 (npm) | Flare (CC-BY-SA 3.0) | Xong | [wcg-game-r-demo5.vercel.app](https://wcg-game-r-demo5.vercel.app/) |
| [demo6](demo6/) | Ngai Ma Nữ | Anime kiểu Genshin | Three.js + three-vrm | VRoid + Quaternius UAL | Đang làm | [wcg-game-r-demo6.vercel.app](https://wcg-game-r-demo6.vercel.app/) |
| [demo7](demo7/) | Hầm Mộ Vua Xương (Unity) | ARPG 3D, port demo2 sang Unity | Unity 6.0 LTS (URP, export WebGL) + Unity MCP | KayKit (CC0) | Xong, chờ test tay | [wcg-game-r-demo7.vercel.app](https://wcg-game-r-demo7.vercel.app/) |
| [demo8](demo8/) | Hầm Mộ Vua Xương (Godot) | ARPG 3D, port demo2 sang Godot | Godot 4.7.2 (export Web) + Godot MCP | KayKit (CC0) | Xong, chờ test tay | [wcg-game-r-demo8.vercel.app](https://wcg-game-r-demo8.vercel.app/) |
| [demo9](demo9/) | Bụi Sa Mạc | FPS chiến thuật kiểu Counter-Strike 1.3, 5v5 với bot | Three.js + Rapier | Quaternius + Poly Haven (CC0) | Xong, chờ test tay | [wcg-game-r-demo9.vercel.app](https://wcg-game-r-demo9.vercel.app/) |
| [demo11](demo11/) | Lục Địa MU | ARPG isometric 2D nhái MU Online: farm đông quái, ép đồ +9, Golden Invasion | Phaser 4 (npm) | Flare (CC-BY-SA 3.0) | Xong MVP, chờ test tay | [wcg-game-r-demo11.vercel.app](https://wcg-game-r-demo11.vercel.app/) |

Deploy: Vercel team `wecare2`, project `wcg-game-r-demoN`. demo2–6, demo9 và demo11 chạy `vercel deploy --prod` trong folder demo (Vercel tự build Vite). demo1 deploy riêng: bọc `demo1/preview/index.html` vào skeleton HTML rồi deploy như static. demo8 export Web bằng Godot headless rồi deploy folder `export/web` như static. demo7 build WebGL bằng Unity batchmode rồi deploy folder `Builds/WebGL` như static.

```mermaid
flowchart LR
    A[Lấy asset<br/>pack CC0 / CC-BY-SA]:::h --> B[Tối ưu bằng tools/<br/>nén meshopt, texture webp]:::n
    B --> C[Load vào engine<br/>Phaser / Three.js]:::n
    C --> D[Render + gameplay<br/>combat, AI, loot]:::n
    D --> E[Build bằng Vite<br/>deploy Vercel]:::g
    classDef h fill:#1e3a4a,stroke:#3492AB,color:#fff
    classDef n fill:#1a2a3a,stroke:#3492AB,color:#aacfdf
    classDef g fill:#1a3a1a,stroke:#4caf50,color:#81c784
```

Mọi demo (trừ demo1, demo7 và demo8) đi chung pipeline trên. demo8 thay bước Vite bằng Godot: import glTF -> chạy headless kiểm lỗi -> export Web (WASM). demo7 thay bằng Unity: import FBX -> test PlayMode cho bot tự chơi -> build WebGL (IL2CPP -> WASM).

## Engine & art từng demo

Version lấy theo `package.json` (demo1: link CDN). Chi tiết nguồn art và license nằm trong `CREDITS.md` của từng demo.

### demo1 — Hầm Ngục Pixel
- **Engine:** Phaser 3.90.0, nạp qua CDN (jsDelivr), cả game nằm trong 1 file HTML, không cần build.
- **Art:** Kenney Tiny Dungeon + Kenney UI RPG (CC0), sprite 2D pixel.

### demo2 — Hầm Mộ Vua Xương
- **Engine:** Three.js 0.169.0 · Vite 5.4.10.
- **Art:** KayKit Adventurers, Skeletons, Dungeon Remastered (CC0, Kay Lousberg), model glTF low-poly đã nén meshopt.

### demo3 — Ngai Quỷ Vương
- **Engine:** Three.js 0.169.0 · Vite 5.4.10.
- **Art:** Quaternius RPG Characters, Ultimate Monsters, Modular Dungeon, Medieval Dungeon (CC0). Dungeon được chuyển OBJ sang GLB rồi gom vào 1 file `dungeon.glb`; nhân vật dùng texture WebP 512px.

### demo4 — Ngai Quỷ Vương (dark fantasy)
- **Engine:** Three.js 0.169.0 + N8AO 1.10 (ambient occlusion) · Vite 5.4.10. Script build dùng gltf-transform, meshoptimizer, sharp.
- **Art:** Poly Haven, gồm 26 props và 7 bộ texture PBR (CC0). Nhân vật và quái tạm dùng Quaternius (CC0), phase B dự kiến thay bằng Mixamo.

### demo5 — Hầm Mộ Ardwen
- **Engine:** Phaser 4.2.1 cài qua npm (nâng từ 3.90.0 ngày 2026-10-10) · Vite 5.4.10. Filter v4: bloom, glow loot hiếm/boss, vignette đỏ khi trúng đòn, grayscale khi chết; thêm `?nofx` để tắt filter khi so FPS.
- **Art:** Flare: Empyrean Campaign (CC-BY-SA 3.0), sprite isometric 2D. Đã cắt bớt animation, scale 0.75 và đóng atlas WebP.

### demo6 — Ngai Ma Nữ
- **Engine:** Three.js 0.169.0 + @pixiv/three-vrm 3.5 · Vite 5.4.10.
- **Art:** 7 avatar mẫu VRoid (license VRoid Hub, riêng `dark.vrm` là CC0) cho nhân vật. Animation lấy từ Quaternius Universal Animation Library 1 + 2 (CC0), retarget sang rig VRM lúc chạy. Môi trường và vũ khí dùng lại Quaternius từ demo3, tô bằng toon material.

### demo7 — Hầm Mộ Vua Xương (Unity)
- **Engine:** Unity 6000.0.84f1 (6.0 LTS), URP 17.0.4, build WebGL (IL2CPP, nén Gzip + decompression fallback). Scene chỉ có 1 GameObject, toàn bộ level, HUD (uGUI) và FX dựng bằng C#. Agent chạy Unity ở batchmode: script setup, build, và test PlayMode cho bot tự chơi từ quán tới boss rồi chụp ảnh. Có cài MCP for Unity (CoplayDev, HTTP `localhost:8080/mcp`) để lái Editor khi mở.
- **Art:** KayKit giống demo2, nhưng lấy bản FBX gốc. Nhân vật import dạng Legacy Animation và chỉ giữ các clip game dùng tới. Font Be Vietnam Pro (OFL).

### demo8 — Hầm Mộ Vua Xương (Godot)
- **Engine:** Godot 4.7.2, renderer Compatibility (WebGL2), export Web không thread. Agent lái Godot qua MCP (koltyakov/godot-mcp) ở chế độ headless trên VM không GPU. Có selftest tự chơi từ quán tới boss và chế độ chụp ảnh render CPU qua Xvfb.
- **Art:** KayKit giống demo2. Model nhân vật được giải nén meshopt vì Godot không đọc `EXT_meshopt_compression`.

### demo9 — Bụi Sa Mạc (FPS kiểu CS 1.3)
- **Engine:** Three.js 0.169.0 + Rapier 0.21 (character controller, raycast đạn, lựu đạn nảy) · Vite 5.4.10. Logic game (`src/sim`) tách khỏi render nên selftest 10 bot đánh nhau chạy được trên Node. Có thêm smoke test client bằng jsdom + renderer giả, và tool chụp góc nhìn FPS bằng rasterizer CPU (không cần browser).
- **Art:** Quaternius Ultimate Animated Character (SWAT cho CT, Adventurer cho T) + Ultimate Gun Pack (CC0). Texture sa thạch / cát của Poly Haven (CC0). Âm thanh lấy từ Kenney + OpenGameArt; tiếng súng của Vincent Sevedge theo CC-BY 3.0.

### demo11 — Lục Địa MU (nhái MU Online)
- **Câu hỏi A/B:** Phaser 4 có giữ 60fps với cảnh kiểu MU không (150+ quái, skill AoE, đồ +7..+9 phát sáng, Golden Invasion)? So với demo5. Đo bằng HUD FPS góc phải, `?bench=N&auto` (N quái quanh hero, tự xả skill, đo 20 giây rồi in kết quả) và `?nofx` (tắt bloom/glow).
- **Engine:** Phaser 4.2.1 · Vite 5.4.10. Nền map vẽ bằng 1 `Blitter` chia chunk, ẩn chunk ngoài camera. Quái dùng chung 1 flow field (BFS từ hero) thay cho A* từng con, tìm hàng xóm bằng spatial hash, quái ngoài màn hình không vẽ và AI nghĩ thưa hơn. Số damage dùng `BitmapText` (RetroFont) có pool. Đồ +7..+9 phát sáng bằng Glow filter đặt trên từng layer paperdoll.
- **Art:** Flare: Empyrean Campaign (CC-BY-SA 3.0). Map Lorencia lấy từ map Black Oak City, Dungeon lấy map Family Crypt (giống demo5). Thêm giáp pháp sư 3 màu cho Dark Wizard. Quái mang tên MU (Spider, Budge Dragon, Bull Fighter, Lich, Gorgon…), dùng sprite Flare tô lại màu bằng tint lúc chạy.

## Engine web-native (ghi chú 2026)

Repo ưu tiên engine **web-native**: viết bằng JS/TS, browser chạy thẳng, build bằng Vite. Lý do: build nhẹ, debug bằng DevTools, và AI agent đọc/sửa code trực tiếp được. Ngoại lệ là demo7 (Unity) và demo8 (Godot), cùng export WebAssembly, làm để thử AI lái engine có editor qua MCP. Hai bản này nặng hơn hẳn: Godot ~14.5MB tải về (wasm 9.5MB + pck 4.9MB, đã nén brotli), Unity ~15MB (wasm 9MB + data 5.9MB, nén gzip); bản Three.js demo2 khoảng 7.9MB gzip.

| Engine | Loại | Vị thế 2026 | Repo |
|---|---|---|---|
| **Phaser 4** | Framework 2D | Mặc định cho 2D web. v4.0 "Caladan" ra 10/4/2026 với renderer WebGL viết lại, filters, lighting; bản mới nhất 4.2.1 (7/2026) | demo5, demo11 (4.2.1); demo1 vẫn ở 3.90 |
| **PixiJS v8** | Renderer 2D | Renderer 2D nhanh nhất, ưu tiên WebGPU, nhưng không phải game framework | Chưa dùng |
| **Three.js** | Library 3D | Phổ biến nhất cho 3D web, AI tool hiểu rõ nhất. Có WebGPURenderer + TSL | demo2/3/4/6/9 |
| **Babylon.js** | Engine 3D trọn bộ | Có sẵn physics (Havok), GUI, inspector, WebXR. Game tiêu biểu: Shell Shockers | Chưa dùng |
| **PlayCanvas** | Engine 3D + editor cloud | Tối ưu mobile web, hợp team cần editor cộng tác. Game tiêu biểu: Venge.io | Chưa dùng |

Thư viện hay đi kèm: Rapier / cannon-es (physics, demo9 dùng Rapier), bitECS / Koota (ECS), glTF + meshopt / KTX2 (asset).

Xu hướng: các engine đang chuyển dần sang **WebGPU**, cho phép dùng compute shader cho particle, crowd và culling.

## Chạy thử

Yêu cầu: Node.js 18+.

```bash
cd demo3          # hoặc demo2, demo4, demo5, demo6, demo9, demo11
npm install
npm run dev       # Vite dev server (--host, mở được từ điện thoại cùng mạng LAN)
npm run build     # build ra dist/
```

**demo9** có thêm selftest chạy trên Node, không cần browser (lệnh smoke test / chụp ảnh CPU xem `demo9/README.md`):

```bash
cd demo9
npm run selftest                 # 10 bot đánh 6 round: luật, kinh tế, bom, NaN, xuyên tường
node tools/map-ascii.mjs         # in map ASCII + kiểm nav nối mọi spawn tới 2 site
```

**demo11** có selftest logic + smoke test chạy scene Phaser thật ở chế độ HEADLESS (jsdom), không cần browser:

```bash
cd demo11
npm run selftest                                         # ép ngọc, rơi đồ, chỉ số, A*, flow field, spatial hash, dữ liệu atlas
JSDOM_PATH=<node_modules/jsdom> node tools/smoke.mjs dk  # bot chơi hết vòng: Lorencia -> Golden Invasion -> Dungeon -> Gorgon (dk | dw)
JSDOM_PATH=<node_modules/jsdom> node tools/smoke.mjs dk bench 300   # đo thời gian logic JS mỗi frame với 300 quái (chưa tính render)
```

**demo7** (Unity 6000.0.84f1, cài qua Unity Hub; script mặc định trỏ `D:\Unity\Editors\6000.0.84f1`): mở folder `demo7/` bằng Unity Hub để chơi trong Editor (scene `Assets/Scenes/Main.unity`), hoặc chạy headless:

```powershell
cd demo7
./tools/unity.ps1 -Method ProjectSetup.Run   # dựng lại material FX, scene, PlayerSettings
./tools/unity.ps1 -Tests PlayMode            # bot tự chơi hết màn, ảnh chụp ở Logs/shots/
./tools/unity.ps1 -Method BuildScript.WebGL  # build ra Builds/WebGL
```

**demo1** không cần build: mở thẳng `demo1/preview/index.html` (ảnh đã inline). Sửa `index.src.html` xong thì chạy `python3 demo1/preview/build.py` để sinh lại.

**Script xử lý asset** (chỉ cần khi đổi/thêm asset, kết quả đã commit sẵn trong `public/`):

| Demo | Lệnh | Việc làm |
|---|---|---|
| demo4 | `node tools/build-env.mjs` | Tải props + texture từ Poly Haven API, simplify, gom `props.glb` |
| demo5 | `python tools/build_assets.py` | Cắt animation Flare, scale, đóng atlas WebP |
| demo6 | `npm run assets` | Nén VRM, lọc clip animation Quaternius UAL |
| demo11 | `py -3 -E -P tools/build_assets.py <flare-game repo>` | Như demo5 + tileset nhiều ảnh, atlas tile chia trang ≤4096px, 2 map, giáp pháp sư, âm thanh |
| demo9 | `node tools/build-assets.mjs` | Tải + xử lý nhân vật / súng Quaternius (gom `guns.glb`), texture Poly Haven -> WebP, cắt âm thanh -> mp3 |

Tham số URL hữu ích: `?debug` (phím T dịch chuyển giữa các phòng, demo3/4/6), `?hq` (ép chất lượng cao, demo4).

## Cấu trúc

```
game-r/
├── demo1 … demo6/     # mỗi demo độc lập: package.json, src/, public/, tools/, CREDITS.md
├── demo7/             # project Unity: Assets/Scripts (C#), Assets/Editor (setup/build), Assets/Tests, tools/unity.ps1
├── demo8/             # project Godot: project.godot, scenes/, scripts/, assets/, tools/
├── demo9/             # FPS Three.js + Rapier: src/sim (logic, chạy được trên Node), src/ (render), tools/ (selftest, render CPU)
├── demo11/            # MU Online Phaser 4: src/ (data, items, state, grid chạy được trên Node; game.js scene; ui.js DOM), tools/ (build asset, selftest, smoke headless)
├── docs/
│   ├── research-ai-game.md   # research xu hướng làm game bằng AI 2026
│   └── new-game-plan.md      # template plan khi bắt đầu demo mới
├── tasks/
│   ├── todo.md        # plan + tiến độ từng demo
│   └── lessons.md     # bài học rút ra khi làm với agent
├── glossary.md        # sổ tay thuật ngữ (engine, asset, animation, render…), danh sách demo xem README
└── _inbox/            # asset tải về chưa xử lý (gitignore)
```

## License asset

Mỗi demo có `CREDITS.md` ghi nguồn, tác giả, license; file license gốc nằm trong `public/` của demo đó.

- **CC0**: KayKit, Quaternius, Kenney, Poly Haven — free cả thương mại, không bắt buộc ghi công.
- **CC-BY-SA 3.0**: Flare (demo5, demo11) — phải ghi công và phát hành bản sửa đổi cùng license.
- **VRoid sample** (demo6): license nhúng trong metadata từng file `.vrm`, xem `demo6/CREDITS.md`.
- **Mixamo** (demo4 phase B): license cấm phát tán file gốc -> chỉ để trong `_inbox/`, không commit.
- **CC-BY 3.0**: tiếng súng Vincent Sevedge (demo9) — phải ghi công.
- **OFL**: font Be Vietnam Pro (demo7).

## Tài liệu liên quan

- [docs/research-ai-game.md](docs/research-ai-game.md) — tool, workflow, thị trường game làm bằng AI
- [docs/new-game-plan.md](docs/new-game-plan.md) — template plan khi bắt đầu demo mới
- [glossary.md](glossary.md) — giải thích thuật ngữ, gắn với demo dùng tới
- [tasks/todo.md](tasks/todo.md) — plan, checklist và review từng demo
