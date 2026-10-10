# demo5 -> Phaser 4 (2026-10-10) · XONG CODE, CHỜ ANH TEST TAY

Anh duyệt: port + filter v4, sửa thẳng demo5.

Mục tiêu: chuyển demo5 từ `phaser@3.90.0` lên `phaser@4.2.1`, giữ nguyên gameplay/art Flare. Bản Phaser 3 vẫn còn trong git (`be6de2e`) để so.

## Điểm vỡ đã soi trong `src/main.js`
| Chỗ | Phaser 3 | Phaser 4 |
|---|---|---|
| Ánh sáng giả (`updateLight`) | RenderTexture `clear/fill/erase` vẽ ngay | Lệnh DynamicTexture được dồn lại, phải gọi `render()` sau khi vẽ. Rủi ro chính |
| Hit flash (`hitEnemy`) | `setTintFill(0xffffff)` | Bỏ `setTintFill` -> `setTint(...)` + tint mode `FILL` |
| Config game | `roundPixels: false` | Mặc định đổi -> ghi rõ, kiểm tra sprite iso có bị rung không |
| Còn lại (texture canvas, text, tween, camera flash, input) | | Giữ nguyên API, chỉ cần verify |

## Việc
- [x] Bump `phaser` -> 4.2.1 (`--save-exact`), đọc skill `v3-to-v4-migration`, `render-textures`, `filters-and-postfx`
- [x] Sửa điểm vỡ: ánh sáng giả đổi `erase(lstamp)` -> `stamp(..., { blendMode: ERASE })` + `render()`; hit flash -> `setTintMode(FILL)`. Các API còn lại (createCanvas, Text.setResolution, camera.flash, input) đã kiểm còn trong v4
- [x] Filter: bloom camera (`AddEffectBloom`, internal, threshold 0.6), glow loot Hiếm/Độc nhất + boss, vignette đỏ khi trúng đòn (thay `camera.flash`) + nhịp khi máu < 30%, grayscale tween khi chết. `?nofx` hoặc Canvas renderer -> bỏ hết filter
- [x] `npm run build` sạch
- [x] README/glossary: demo5 -> Phaser 4
- [ ] Anh test tay trên browser (không Playwright)
- [x] Deploy Vercel prod (anh yêu cầu) -> https://wcg-game-r-demo5.vercel.app/ (curl: bundle `index-h8AckWl2.js` có `4.2.1`, asset 200)

## Lighting v4 (option C, anh "ok" 2026-10-10)
Anh báo chưa thấy khác biệt -> thêm Lighting thật của v4. Đổi so với C: bật lighting cả tile vì map chỉ ~1.175 tile (296 obj + 879 nền), không phải hàng nghìn.
- [x] `lights.enable()`, ambient lạnh `0x9ca0b4`, đèn bám hero ấm (r 520)
- [x] 11 đuốc tường (tile 102/103, lửa ở gốc ±5, -119) + 2 chậu than (151): đèn cam nhấp nháy, khoét lớp tối quanh đuốc để thấy từ xa
- [x] Cầu lửa / băng mang đèn màu theo đạn; `lightAt` (nổ, lên cấp, mở rương, động đất) thêm chớp sáng màu tắt dần
- [x] Tile, nhân vật, quái, NPC, loot, bóng: `setLighting(true)`; nhân vật thêm `setSelfShadow`. FX/chữ/lớp tối không lit
- [x] `maxLights: 16`, `?nofx` tắt cả lighting lẫn filter (= look bản 3.90)
- [x] Deploy prod (anh yêu cầu), bundle `index-i-b-hn5w.js` có `maxLights:16`
- [ ] Anh xem và chỉnh độ sáng (ambient, cường độ đuốc chọn mò, chưa nhìn bằng mắt)

## Review
- Bundle: 3.90 = 1,519 KB min / 356 KB gzip -> 4.2.1 = 1,726 KB / 398 KB (+14% / +12%). Nâng `chunkSizeWarningLimit` 1600 -> 1800.
- Bẫy v4 tìm được nhờ đọc `DynamicTexture.js`: `erase(obj)` chỉ lưu tham chiếu object vào command buffer. Code cũ dùng lại 1 sprite `lstamp` rồi đổi vị trí giữa các lần erase -> sang v4 mọi vùng sáng sẽ dồn về vị trí cuối. `stamp()` lưu x/y/scale/blendMode theo giá trị nên đúng.
- Vignette v4: ngoài `radius` là phủ kín màu -> radius 0.75 (trùm góc 0.71), strength đỉnh 0.16.
- Chưa kiểm chứng bằng mắt: vùng sáng quanh hero, glow loot dưới lớp tối 94%, mức bloom. Cần đo FPS `?nofx` so với bản thường.

---

# demo7 — ARPG 2D trên Phaser 4 với art mới (2026-10-10) · ĐÃ BỎ

> Anh chê art pixel 0x72 xấu -> bỏ demo7: đã xóa folder `demo7/`, `_inbox/0x72/`, project Vercel `wcg-game-r-demo7`, gỡ khỏi README. Giữ lại plan + Review dưới đây làm ghi chép về Phaser 4.

Mục tiêu:
- Thử Phaser 4.2.1 viết từ đầu theo API mới (không port demo5), cùng vertical slice: 3 phòng hầm -> sảnh -> boss, 3 class, loot.
- Khai thác tính năng mới của Phaser 4: lighting, filters (glow, bloom, vignette...), renderer mới.
- So với demo5 (Phaser 3.90) về FPS, bundle size, số dòng code, chỗ khó khi viết bằng AI.

## 0. Art
- [x] **0x72 DungeonTileset II v1.7** (CC0, xác nhận trên trang itch), tải vào `_inbox/0x72/`.

## 1. Khung
- [x] `demo7/`: Vite 5.4.10 + `phaser@4.2.1` + sharp (tool).
- [x] Đọc skill/docs đi kèm package Phaser 4 (`node_modules/phaser/skills`, `docs/`) thay cho NOTES.md riêng.
- [x] `tools/build-assets.mjs`: atlas từ tile_list (giữ PNG, 17 KB, nhỏ hơn WebP không đáng), tileset GPU bake đục, normal map Sobel, fx SVG, favicon. Map sinh bằng code (`src/map.js`).

## 2. Gameplay
- [x] 3 class: Hiệp Sĩ (Xoáy Kiếm, Khiên Thánh), Pháp Sư (Cầu Lửa, Băng Giá), Cung Thủ (Mưa Tên, Lướt Gió). Lăn né, bình máu.
- [x] 3 phòng: Tiền Sảnh (NPC Lão Doc + 1 đợt) -> Sảnh Xương Orc (2 đợt, mini-boss Ogre, bẫy chông) -> Ngai Chúa Quỷ (Azgor 3 phase: slam, nova, charge, gọi quân).
- [x] AI: flow field BFS + line of sight; quái cận chiến, pháp sư bắn, tử linh sư gọi xương.
- [x] Loot vũ khí 4 độ hiếm (glow theo màu), vàng, bình máu/mana, lên cấp. HUD DOM, joystick cảm ứng.

## 3. Tính năng Phaser 4
- [x] TilemapGPULayer (sàn + tường) có lighting, normal map.
- [x] Lighting: đài phun lava/nước nhấp nháy, đèn bám hero, đạn phép phát sáng, flash khi nổ/lên cấp.
- [x] Filters: Bloom (`AddEffectBloom`), Vignette (đỏ khi trúng đòn), ColorMatrix (grayscale khi chết, đậm khi boss phase 3), Glow (loot hiếm, elite, boss, khiên), Wipe mở màn.
- [x] Tint mode `FILL` cho hit flash / bóng lăn né, `smoothPixelArt`.

## 4. Verify
- [x] `npm run build` sạch (bundle 1,73 MB min / 401 KB gzip, dist 1,9 MB).
- [ ] Chơi tới boss trên browser thật: **anh test tay** (em không chạy Playwright/Chrome theo yêu cầu).
- [ ] Đo FPS so với demo5 (cần máy thật, `?fps` và `?nofx`).
- [x] README + CREDITS.
- [x] Deploy Vercel -> https://wcg-game-r-demo7.vercel.app/ (anh yêu cầu deploy; smoke test bằng curl: index + asset trả 200).

## Review
- Lỗi đã sửa nhờ đọc source Phaser: (1) ô trống `-1` của TilemapGPULayer lấy mẫu pixel (0,0) của tileset nên phủ màu lên cả sàn -> tile 0 phải trong suốt; (2) Vignette v4 trộn theo `sin(g·π·strength)`, strength 0.6 làm tối gần hết màn -> dùng 0.16; (3) tile animated trên GPU layer hiện trắng -> đài phun dùng sprite.
- Lỗi logic: flow field BFS trọng số chéo 1.4 làm node bị push lại, tràn queue, treo tab -> BFS trọng số đều.
- Chưa kiểm chứng bằng mắt sau 2 bản sửa cuối (tile 0 trong suốt, vignette): chờ anh test.
- Ảnh chụp headless (software GL) trước khi bị dừng: bật filter camera ~30 fps, tắt ~60 fps -> filter là chi phí chính, cần đo trên GPU thật.

---

# demo4 + demo6 — bỏ low-poly, chỉ dùng asset có sẵn (2026-10-09) · ĐÃ DUYỆT, demo4 làm trước

Mục tiêu: giữ nguyên vertical slice của demo3 (3 phòng quán -> sảnh -> ngai, 3 class, loot, boss) để so A/B, chỉ thay art + render pipeline.
- **demo4: Dark fantasy kiểu Diablo 4.** Nhân vật/quái/animation lấy từ Mixamo, môi trường dùng texture PBR CC0 (Poly Haven / ambientCG) + Dungeon Building Kit (CC0), post-processing nặng.
- **demo6: Anime kiểu Genshin.** Nhân vật là VRoid sample avatar (bản CC0), animation Mixamo retarget sang VRM, shader MToon toon + outline.
- Không dùng art vẽ tay, không gen AI.

## 0. Chuẩn bị (anh làm)
- [ ] Tải tay từ Mixamo theo list em gửi (cần login Adobe):
  - Nhân vật: FBX Binary, With Skin
  - Animation: Without Skin, 30 FPS, tick In Place
- [ ] Chép vào `_inbox/mixamo/` (gitignore, không commit file gốc vì license Mixamo cấm phát tán raw)

## 1. Khung chung
- [ ] Copy demo3 -> demo4, demo6 (gameplay, UI, items, fx giữ nguyên)
- [ ] Viết lại `assets.js` theo nguồn asset mới
- [ ] Script convert FBX -> GLB + nén meshopt/webp, chạy được lại khi thêm asset

## 2. demo4 — Dark fantasy
**Phase A — môi trường + render (XONG 2026-10-10, nhân vật Quaternius làm placeholder)**
- [x] Copy demo3 -> demo4; list Mixamo cho anh ở `demo4/MIXAMO.md`; `_inbox/` vào gitignore
- [x] `tools/build-env.mjs`: Poly Haven API -> 26 props (simplify 2-12k tris, texture webp 512) gom `props.glb` 4.8 MB + 7 bộ PBR tường/sàn 1024 (4.3 MB)
- [x] `env.js`: tường/sàn/cột box + world-UV PBR, giá đuốc, đống vàng instanced
- [x] Mỗi phòng 1 tông: quán (gỗ + gạch ấm), sảnh (đá tu viện + đá phiến + 2 chậu lửa), ngai (đá đen nứt + gạch tối, đuốc tím)
- [x] Render: ACES, env map nhẹ, N8AO half-res, bloom, color grade (split-tone lạnh/ấm, vignette, grain), FXAA
- [x] Review demo3: đèn bám hero + rim, tường cắt có gờ đá sáng, cột sảnh fade, VFX skill shader gradient màu theo class, hit flash dịu, bong bóng thoại né HUD
- [x] Perf (iGPU Intel UHD, 1366x768): 77 -> 47 ms/frame nhờ light pool 5 đèn, shadow cách frame, SMAA -> FXAA. Máy yếu tự tắt AO; `?hq` ép chất lượng cao
**Phase B — chờ Mixamo**
- [ ] Hero: Paladin (melee), Mage (magic), Archer (ranged). Tên model chốt khi anh mở Mixamo
- [ ] Quái: skeleton zombie, mutant, parasite; boss: Warrok / Maw
- [ ] Item rơi đồ/icon -> vũ khí Poly Haven (estoc, dao găm, chùy, búa chiến, rìu, khiên diều), bỏ `dungeon.glb`
- [ ] Ngân sách: >= 45 FPS desktop (hiện 47 ms trên iGPU, cần đo máy có GPU rời), tải <= 25 MB (hiện ~15 MB)

## 3. demo6 — Anime (ĐANG LÀM, anh duyệt "build demo6" 2026-10-09)
Đổi so với plan gốc: **animation lấy Quaternius Universal Animation Library 1+2 (CC0) thay Mixamo** -> khỏi chờ tải tay, file được commit. Mixamo về sau cắm thêm vào cùng bộ retarget.
- [x] Nguồn: 7 VRoid CC0 từ OpenGameArt (D, D_Darkness, E, F, G, Sakurada, Shino), license nhúng trong `.vrm`: CC0 / redistribution allow / violent allow / credit unnecessary
- [x] `tools/build-assets.mjs`: VRM 14-21MB -> 2-3MB (texture webp theo loại, bỏ Thumbnail + normal map, morph chỉ giữ blink/joy/angry/sorrow/fun/A); UAL 2 file -> 1.9MB (chỉ xương + 34 clip, chỉ rotation + hông)
- [x] `retarget.js`: UAL (T-pose, +Z) -> VRM normalized rig, theo world-delta; lấy mẫu 1 lần dùng chung cho mọi avatar cùng cấu trúc rig
- [x] `assets.js`: pool VRM (parse 1 lần/instance, dùng chung texture), weapon gắn tay theo rest pose
- [x] `main.js`: hero Fumiya (kiếm) / Bibi (pháp) / Vita (cung); NPC Victoria, Shino, Shibu; địch = D_Darkness đổi màu + vũ khí; boss = D_Darkness x1.8 + aura
- [x] Look: MToon + outline, spring bone tóc/váy, chớp mắt, NeutralToneMapping, nắng ấm + trời xanh, môi trường toon (MeshToonMaterial), mặt đá ngoài phòng -> cỏ
- [x] Quái nằm dưới sàn -> đứng dậy (LayToIdle) thay cho trồi từ đất
- [x] Build sạch + deploy Vercel prod (2026-10-10) -> https://wcg-game-r-demo6.vercel.app/
- [ ] Verify lại trên máy thật: FPS sảnh + boss, gộp mesh tóc có lỗi hình không, chơi tới boss (anh dặn không chạy Playwright/Chrome ở session 10/10)
- Điểm yếu đã biết: không có anim bắn cung (dùng Pistol_Shoot), môi trường vẫn là dungeon Quaternius tô toon

### Review demo6 (2026-10-10)
Đo trên Playwright headless, GPU Intel UHD (D3D11):
- **Load 45s -> ~20s** (dev): retarget 6s -> 0.5s (lấy mẫu dùng chung), thumbnail 5.8s -> 2.4s + frame đầu 13s -> 0.7s (`compileAsync` qua KHR_parallel_shader_compile, compile vào RT của composer cho đúng biến thể shader), parse VRM chạy song song.
- **FPS 4.7 trước khi sửa**: 2263 draw call, ~2M tris/frame. Lý do: VRM tắt `frustumCulled` nên 13 nhân vật luôn được vẽ (thêm cả bóng + outline), tóc VRoid ~50-80 primitive/nhân vật. Đã sửa: cull theo actor (1 hình cầu quanh root, ngoài khung hình thì bỏ spring bone), gộp SkinnedMesh anh em cùng material (`mergeSiblings`). **Chưa đo lại FPS sau khi sửa.**
- Máy yếu tự tắt bloom: giờ tắt pass bloom nhưng vẫn render qua composer. Trước đây render thẳng ra màn hình thì phải compile lại toàn bộ shader MToon (vài giây đứng hình).
- Vũ khí đen thui: mesh Quaternius mất normal -> `computeVertexNormals` trong `prep`. Gốc vũ khí chuẩn hóa về đầu cán (`grip`). Gậy và cung đổi hướng cầm theo pose idle/bắn đo được, cung chuyển sang tay phải.
- Bong bóng thoại bị minimap che: port bản sửa `hud: true` từ demo4.
- Debug: `?debug` có thêm `G.camFree`, `G.renderer/composer/bloom`.

## 4. Verify & deploy
- [ ] `npm run build` sạch cho cả 2
- [ ] Playwright: chụp 3 phòng + combat + mobile, đo frame time, so với demo3
- [ ] Review đồ họa từng bản (như review demo2/3)
- [ ] Deploy Vercel (hỏi anh trước khi deploy)

---

# demo3 — ARPG 3D với asset Quaternius (2026-10-09)

Mục tiêu: dựng lại vertical slice của demo2 bằng asset **Quaternius (CC0)**, sửa luôn các lỗi trong `review-do-hoa-2026-10-09.md`, deploy Vercel.

## Asset
- [x] RPG Characters (Warrior, Wizard, Ranger, Rogue, Cleric, Monk), có animation
- [x] Ultimate Monsters "Big" (Orc, Orc_Skull, Demon, BlueDemon, Yeti, MushroomKing, Ninja, Tribal)
- [x] Modular Dungeon + Medieval Dungeon (OBJ -> GLB, gom 1 file `dungeon.glb`)
- [x] Nén meshopt + texture webp 512 (22MB -> 4.4MB nhân vật)

## Code
- [x] `assets.js`: load ít file, chuẩn hóa scale/pivot, tách vũ khí từ hero làm item
- [x] `main.js`: map grid 2 đơn vị, hero 3 class (melee/magic/ranged), quái Quaternius, boss Quỷ Vương
- [x] Sửa review: tường phía nam cắt thấp (cutaway), pixelRatio <= 2, label không đè HUD + ẩn label xa, nền ngoài phòng không đen tuyền, loading bar khớp %
- [x] `index.html`, `CREDITS.md`

## Verify & deploy
- [x] `npm run build` sạch
- [x] Chạy thử trên Chrome (console 0 lỗi, chơi tới boss)
- [x] Deploy Vercel -> https://wcg-game-r-demo3.vercel.app/

## Review
- Test qua Chrome DevTools MCP: desktop 1366x768 + mobile 390x844 @3x. 0 lỗi console. Đã test combat 3 class, quái trồi lên, boss chết ra banner chiến thắng.
- Request model: 72 -> 13 (prod tải khoảng 1.5 MB). Mobile canvas 780x1688 (2x), trước đó là 1x.
- FPS trong Chrome của MCP khoảng 27 (avg 37 ms), chưa đo trên máy thật. Bản demo2 đo cùng môi trường được khoảng 32. Nếu máy thật cũng chậm: gộp mesh props (giống tường) + giảm point light.
- `?debug` + phím T: dịch chuyển giữa 3 phòng để test.
