# Credits

## Art + âm thanh — Flare: Empyrean Campaign

Toàn bộ sprite nhân vật, quái, NPC, tileset, 2 map (Black Oak City làm Lorencia, Family Crypt làm Dungeon), icon, loot,
hiệu ứng phép và âm thanh trong demo11 lấy từ [Flare: Empyrean Campaign](https://github.com/flareteam/flare-game) (flareteam),
phát hành theo **Creative Commons Attribution-ShareAlike 3.0 (CC-BY-SA 3.0)** — https://creativecommons.org/licenses/by-sa/3.0/

Danh sách họa sĩ và tác giả âm thanh gốc: `public/a/CREDITS-flare.txt` (Clint Bellanger, Justin Nichol, Blarumyrran, Brandon Morris, … — xem file).

**Thay đổi so với bản gốc** (`tools/build_assets.py`):
- Cắt bớt animation không dùng, scale 0.75 (riêng wyvern 0.5), đóng lại atlas và chuyển sang WebP.
- Tile map gom lại thành atlas mới. Map Family Crypt mở sẵn 2 cửa giống demo5.
- Quái đổi tên theo MU Online và tô lại màu bằng tint lúc chạy (Golden Goblin, Lich, Ghost, Gorgon…). Ngọc và Hộp Kundun cũng được tô lại màu từ sprite gem/book.

Các file art đã chỉnh sửa trong `public/a/` tiếp tục phát hành theo **CC-BY-SA 3.0** (share-alike).

## Font

Be Vietnam Pro và Cormorant Garamond (SIL Open Font License), tải qua Google Fonts.

## Code + thiết kế

Code game (`src/`, `tools/`) do team game-r viết. Tên quái, tên skill và cơ chế (ép ngọc, Golden Invasion, cộng điểm) mô phỏng MU Online
của Webzen chỉ cho mục đích thử nghiệm nội bộ. Không dùng asset gốc của MU Online.
