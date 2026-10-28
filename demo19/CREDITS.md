# Credits — demo19 (cs_benthanh)

## Texture ảnh: ambientCG (CC0 1.0)

Lấy bản `1K-JPG`, chỉ dùng ảnh Color. Script resize, nhuộm màu và giảm về 256 màu.

| Asset | Dùng cho | Link |
|---|---|---|
| Plaster007 | Tường vàng của chợ (`bt_wall`) | https://ambientcg.com/a/Plaster007 |
| Concrete034 | Gờ trắng, bó vỉa (`bt_trim`, `bt_curb`) | https://ambientcg.com/a/Concrete034 |
| PaintedPlaster017 | Tường nhà phố 4 màu (`bt_house_*`) | https://ambientcg.com/a/PaintedPlaster017 |
| Terrazzo013 | Sàn đá mài trong chợ (`bt_terrazzo`) | https://ambientcg.com/a/Terrazzo013 |
| Road007 | Mặt đường (`bt_road`) | https://ambientcg.com/a/Road007 |
| RoofingTiles014B | Mái ngói (`bt_roof`) | https://ambientcg.com/a/RoofingTiles014B |
| CorrugatedSteel006A | Mái tôn, trần (`bt_tin`) | https://ambientcg.com/a/CorrugatedSteel006A |
| Planks037A | Gỗ sạp, sàn gác (`bt_wood`) | https://ambientcg.com/a/Planks037A |
| Metal053B | Sắt rỉ, tượng đồng (`bt_rust`, `bt_bronze`) | https://ambientcg.com/a/Metal053B |

## Ảnh public domain (cs_wecare)

| Ảnh | Dùng cho | Nguồn |
|---|---|---|
| The Earth at night (NASA Earth Observatory, Suomi NPP VIIRS 2012), bản thu 1280px | Tranh treo phòng IT (`wc_poster_earth`) | https://commons.wikimedia.org/wiki/File:The_earth_at_night.jpg (public domain) |

## Texture vẽ bằng code

Biển hiệu tiếng Việt, mặt đồng hồ, gạch bông, cửa cuốn, cửa sắt xếp, cửa sổ, bạt sọc, cuộn vải, rổ trái cây,
thùng carton, gạch vỉa hè, cỏ, lan can, dây điện: vẽ bằng SVG/pixel trong `src/textures.ts` và `src/proc.ts`.
Không dùng ảnh AI gen.

## Tool

- **SDHLT v1.3.0** (seedee, dựa trên ZHLT v34 của Vluzacn và tool compile gốc của Valve): compile `.map` -> `.bsp`.
  https://github.com/seedee/SDHLT. File `sdhlt.wad` (texture công cụ như `sky`) được nhúng vào BSP lúc compile.
- Bầu trời `city1` là asset có sẵn trong Counter-Strike 1.3. Map chỉ gọi tên, không kèm file.
- Con tin `bt_bantrong.mdl` là bản sửa từ `scientist.mdl` của Half-Life (Valve). Tool đọc model từ `pak0.pak` của bản game trên máy, nhuộm lại texture và gắn thêm nón lá + búi tóc. Chỉ dùng chơi local, không phân phối, không commit vào repo.
