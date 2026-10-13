# Credits

## Art — Flare: Empyrean Campaign

Toàn bộ sprite nhân vật, quái, NPC, tileset, map, icon, hiệu ứng phép trong demo10 lấy từ
[Flare: Empyrean Campaign](https://github.com/flareteam/flare-game) (flareteam), phát hành theo
**Creative Commons Attribution-ShareAlike 3.0 (CC-BY-SA 3.0)** — https://creativecommons.org/licenses/by-sa/3.0/

Danh sách họa sĩ gốc: `public/a/CREDITS-flare.txt` (Clint Bellanger, Justin Nichol, Blarumyrran, … — xem file).

**Thay đổi so với bản gốc** (`tools/build_assets.py`):
- Ghép sẵn các lớp paper-doll (đầu, áo, quần, giày, tay, vũ khí) thành 1 sprite cho mỗi bộ đồ môn phái
- Cắt bớt animation không dùng, chỉ lấy 1/2 số frame với animation từ 8 frame trở lên, scale 0.75, đóng lại atlas và chuyển sang WebP
- Map Flare (perdition_harbor, black_oak_city, salted_field, nazia_highlands, lake_kuuma, the_breach) dùng lại làm Ba Lăng Huyện, Tương Dương và 4 bãi luyện công

Các file art đã chỉnh sửa trong `public/a/` tiếp tục phát hành theo **CC-BY-SA 3.0** (share-alike).

## Gameplay

Gameplay phỏng theo Võ Lâm Truyền Kỳ 1 (Kingsoft / VNG) cho mục đích học tập, phi thương mại. Không dùng tài nguyên gốc của game.
Tên môn phái, skill, thành trấn lấy theo bản gốc. Số liệu và hiệu ứng skill do team game-r tự đặt (xem `gameplay.md`).

## Code

Code game (`src/`, `tools/`) do team game-r viết.
