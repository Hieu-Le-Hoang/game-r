# Credits — demo9 (FPS chiến thuật kiểu Counter-Strike 1.3)

| Nguồn | Dùng cho | License |
|---|---|---|
| [Quaternius](https://quaternius.com) — Ultimate Animated Character Pack (GLB qua [poly.pizza](https://poly.pizza/u/Quaternius)) | Nhân vật: `chars/ct.glb` = **SWAT** (Chống khủng bố), `chars/t.glb` = **Adventurer** (Khủng bố) — skeletal animation 18 clip | CC0 |
| [Quaternius](https://quaternius.com) — Ultimate Gun Pack (qua poly.pizza) | Súng trong `guns/guns.glb`: glock, usp, deagle, mp5, ak47, m4a1, awp, m3, knife | CC0 |
| [Quaternius](https://quaternius.com/packs/toonshootergamekit.html) — Toon Shooter Game Kit (qua poly.pizza) | Lựu đạn `grenade` trong `guns.glb` | CC0 |
| [Poly Haven](https://polyhaven.com) — textures | `gravelly_sand`, `sandstone_blocks_08`, `sandstone_cracks`, `red_sandstone_pavement`, `weathered_brown_planks`, `wooden_garage_door`, `rusty_metal_02` | CC0 |
| [Kenney](https://kenney.nl) — Impact Sounds, Interface Sounds | Bước chân, vỏ đạn rơi, lựu đạn nảy, trúng người/mũ, dao, đặt bom, bấm nút bom | CC0 |
| [OpenGameArt](https://opengameart.org/content/gunshot-sounds) — "Gunshot Sounds", Tabasco / **Vincent Sevedge** | Tiếng súng lục, AK, M4, AWP (+ kéo khóa nòng), shotgun | **CC-BY 3.0** (bắt buộc ghi công) |
| [OpenGameArt](https://opengameart.org/content/gunshots) — "Gunshots", kurt | Tiếng Deagle | CC0 |
| [OpenGameArt](https://opengameart.org/content/random-gunfire-sfx) — "Random gunfire SFX", iamoneabe | Tiếng SMG | CC0 |
| [OpenGameArt](https://opengameart.org/content/gun-reload-sounds) — "Gun reload sounds", SpringySpringo | Nạp đạn súng trường / súng lục, lên đạn shotgun | CC0 |
| [OpenGameArt](https://opengameart.org/content/2-gun-reloads) — "2 Gun Reloads", StarNinjas | Rút súng (deploy) | CC0 |
| [OpenGameArt](https://opengameart.org/content/gun-reload-lock-or-click-sound) — pauliuw | Bóp cò hết đạn (dryfire) | CC0 |
| [OpenGameArt](https://opengameart.org/content/chunky-explosion) — "Chunky Explosion", Joth | Nổ lựu đạn / bom | CC0 |
| Tự tổng hợp (ffmpeg sine 2.4 kHz) | Tiếng bíp bom `c4_beep` | — |

Ghi công bắt buộc (CC-BY 3.0): *"Gunshot sounds by Vincent Sevedge (Tabasco), CC-BY 3.0 — https://creativecommons.org/licenses/by/3.0/"*. Trang OpenGameArt ghi CC0 nhưng file `creativecommons.txt` trong gói ghi CC-BY 3.0, nên xử lý theo license chặt hơn.

File license + link nguồn từng asset: `public/models/licenses/`.

## Xử lý asset

```bash
node tools/build-assets.mjs              # tất cả (chars, guns, tex, sfx, lic)
node tools/build-assets.mjs chars        # hoặc guns | tex | sfx | lic
node tools/measure-assets.mjs            # đo lại thông số (load bằng three.js như trong game)
node tools/render-preview.mjs public/models/chars/ct.glb out.png --clip Idle_Gun_Pointing --gun ak47 --views side,top
```

- File gốc cache ở `game-r/_inbox/demo9/` (poly.pizza GLB, Poly Haven JPG, zip Kenney/OGA); chạy lại không tải lại.
- Nhân vật: lọc còn 18 clip (bỏ tiền tố `CharacterArmature|`), resample, quantize + nén meshopt; thêm node `GunSocket_R` dưới xương `Wrist.R` (tính theo pose `Idle_Gun_Pointing`) để gắn súng.
- Súng: xoay về chuẩn **nòng -Z, trên +Y, gốc ở tay cầm**, scale theo chiều dài thật (m), thêm node `<id>_muzzle` ở đầu nòng; gom 1 file `guns.glb` (nén meshopt).
- Texture: diff / nor_gl / arm -> webp 1024 (gỗ thùng + kim loại 512).
- Âm thanh: cắt đoạn, chuẩn hóa đỉnh về -1 dBFS (+ gain riêng), mono 44.1 kHz, mp3 VBR (ffmpeg).
- Quaternius Google Drive báo "Quota exceeded" khi tải từ VM, nên lấy bản GLB mirror của chính tác giả trên poly.pizza (cùng license CC0).
