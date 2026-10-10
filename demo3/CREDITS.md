# Credits

Toàn bộ asset 3D trong demo3 là của **Quaternius**, license **CC0** (free cả thương mại, không bắt buộc ghi công).

| Pack | Dùng cho | Nguồn | License |
|---|---|---|---|
| RPG Characters | Hero (Warrior, Wizard, Ranger), NPC (Cleric, Monk), vũ khí rơi đồ (tách từ tay nhân vật) | https://quaternius.com/packs/rpgcharacters.html | CC0 |
| Ultimate Monsters | Orc, Orc_Skull, Ninja, BlueDemon, Demon (boss), MushroomKing (NPC bán thuốc) | https://quaternius.com/packs/ultimatemonsters.html | CC0 |
| Modular Dungeon | Sàn, tường, cột, cổng, đuốc, rương, đồ trang trí | https://quaternius.com/packs/modulardungeon.html | CC0 |
| Medieval Dungeon | Bình thuốc, sách, xương, chân nến, thảm, cột gãy | https://quaternius.com/packs/medievaldungeon.html | CC0 |

File license gốc: `public/models/licenses/`.

Xử lý asset:
- OBJ (2 pack dungeon) -> GLB bằng `obj2gltf`, gom 41 props vào **1 file** `dungeon.glb` (mỗi prop = 1 scene) bằng `gltf-transform`, nén meshopt (3 MB -> 0.8 MB).
- Nhân vật/quái: nén meshopt + texture WebP 512px (22 MB -> 4.4 MB cho 14 model, ship 12).
