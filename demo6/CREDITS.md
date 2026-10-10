# Credits

Demo6 dùng nhân vật **VRoid Project** (sample avatar `.vrm`) và animation + môi trường của **Quaternius** (CC0).

## Nhân vật — VRoid sample avatar

Tác giả: **VRoid Project (pixiv)**, tải từ OpenGameArt. License ghi trong metadata của từng file `.vrm` (trường `meta`).

| File | Avatar gốc | Vai trong game | License nhúng trong VRM |
|---|---|---|---|
| `sakura.vrm` | Sakurada Fumiriya (桜田 史利矢) | Hero Kiếm Sĩ | VRoid Hub license (*) |
| `bibi.vrm` | AvatarSample_E — Bibi (ビビ) | Hero Pháp Sư | VRoid Hub license (*) |
| `vita.vrm` | AvatarSample_F — Vita (ヴィータ) | Hero Xạ Thủ | VRoid Hub license (*) |
| `victoria.vrm` | AvatarSample_G — Victoria Rubin (ヴィクトリア・ルービン) | NPC tu sĩ (giao quest) | VRoid Hub license (*) |
| `shino.vrm` | Sendagaya Shino (千駄ヶ谷篠) | NPC bán thuốc | VRoid Hub license (*) |
| `shibu.vrm` | AvatarSample_D — Sendagaya Shibu (千駄ヶ谷渋) | NPC chỉ đường | VRoid Hub license (*) |
| `dark.vrm` | AvatarSample_D_Darkness | Kẻ địch + boss | **CC0** + điều kiện VRoid Hub như (*) |

(*) VRoid Hub license (`licenseName: Other`), điều kiện ghi trong `otherPermissionUrl`:
ai cũng được dùng · cho phép thương mại (cá nhân + doanh nghiệp) · **cho phép phân phối lại** · cho phép chỉnh sửa · **không bắt buộc ghi công** · cho phép nội dung bạo lực.
Chi tiết: https://hub.vroid.com/license

## Animation — Quaternius Universal Animation Library

| Pack | Dùng cho | Nguồn | License |
|---|---|---|---|
| Universal Animation Library [Standard] (UAL1) | Idle, chạy, kiếm, phép, cung, lăn, trúng đòn, chết... (20 clip) -> `anims_ual1.glb` | https://quaternius.com | CC0 |
| Universal Animation Library 2 [Standard] (UAL2) | Combo kiếm, uống thuốc, khoanh tay, đứng dậy từ nằm (`LayToIdle`), knockback... (14 clip) -> `anims_ual2.glb` | https://quaternius.com | CC0 |

Animation được **retarget** từ rig Quaternius sang rig VRM lúc chạy (`src/retarget.js`).

## Môi trường + vũ khí — Quaternius (dùng lại từ demo3)

| Pack | Dùng cho | Nguồn | License |
|---|---|---|---|
| Modular Dungeon + Medieval Dungeon | `dungeon.glb` (41 props: sàn, tường, cột, đuốc, rương...), tô lại bằng toon material | https://quaternius.com/packs/modulardungeon.html · https://quaternius.com/packs/medievaldungeon.html | CC0 |
| RPG Characters | Chỉ lấy **vũ khí** tách từ tay nhân vật (`chars/*.glb`: kiếm, gậy, cung, dao găm) | https://quaternius.com/packs/rpgcharacters.html | CC0 |

File license Quaternius gốc: `public/models/licenses/`.

## Xử lý asset (`tools/build-assets.mjs`)

- Input: `../_inbox/oga` (file `.vrm` + UAL gốc, không commit).
- VRM: sửa thẳng JSON/binary của GLB (gltf-transform sẽ làm mất extension VRM). Texture chuyển sang WebP và thu nhỏ, thumbnail và normal map thay bằng ảnh tí hon, chỉ giữ morph target `blink / joy / angry / sorrow / fun / a`.
- UAL: chỉ giữ các clip game dùng.
