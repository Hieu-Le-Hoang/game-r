# Credits — demo4 (dark fantasy)

| Nguồn | Dùng cho | License |
|---|---|---|
| [Poly Haven](https://polyhaven.com) — models | 26 props: thùng rượu, rương, bàn ghế, giá sách, tủ gothic, chân nến, cốc, chai, tượng gothic, cổng sắt, cửa lâu đài, bếp lửa đá, đầu bò, khiên, vũ khí cổ | CC0 |
| [Poly Haven](https://polyhaven.com) — textures | `wood_floor_worn`, `castle_brick_01`, `monastery_stone_floor`, `castle_wall_slates`, `slab_tiles`, `dark_brick_wall`, `rock_wall_08` | CC0 |
| [Quaternius](https://quaternius.com) | Nhân vật/quái + icon item (**tạm thời**, thay bằng Mixamo ở phase B) | CC0 |

Xử lý asset: `node tools/build-env.mjs` tải từ Poly Haven API (cache ở `game-r/_inbox/polyhaven`), simplify bằng meshoptimizer, texture -> webp, gom 1 file `props.glb` (nén meshopt).
