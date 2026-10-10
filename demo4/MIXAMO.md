# Mixamo — list cần tải cho demo4

Vào https://www.mixamo.com (login Adobe free). Tải xong bỏ hết vào `game-r/_inbox/mixamo/`.
Em lo convert FBX -> GLB, file gốc **không commit** (license Mixamo cấm phát tán raw).

## Setting khi tải

| Loại | Format | Skin | FPS | Khác |
|---|---|---|---|---|
| Nhân vật (tab Characters) | FBX Binary (.fbx) | With Skin | — | Pose: T-pose |
| Animation (tab Animations) | FBX Binary (.fbx) | **Without Skin** | 30 | Có ô **In Place** thì tick |

- Animation Mixamo dùng chung một bộ xương, nên mỗi animation chỉ cần tải **1 lần** (đang chọn nhân vật nào cũng được), em gắn lại cho tất cả.
- Giữ nguyên tên file Mixamo đặt sẵn. Tên nhân vật dưới đây là gợi ý; không thấy hoặc không ưng thì search từ khóa trong ngoặc, chọn con nào nhìn hợp dark fantasy.

## 1. Nhân vật (With Skin) — 9 file

| Vai | Gợi ý | Search |
|---|---|---|
| [ ] Hero Chiến Binh | Paladin J Nordstrom (bản cầm kiếm khiên: Paladin WProp) | `paladin` |
| [ ] Hero Pháp Sư | Một nhân vật áo choàng/pháp sư | `wizard`, `mage`, `vampire` |
| [ ] Hero Xạ Thủ | Erika Archer | `archer` |
| [ ] NPC Tu Sĩ | Nhân vật nữ áo dài/thường dân | `maria`, `peasant` |
| [ ] NPC Thương Nhân | Nhân vật nam thường dân | `peasant`, `man` |
| [ ] Quái lính | Skeletonzombie T Avelange | `zombie` |
| [ ] Quái nhanh | Parasite L Starkie | `parasite` |
| [ ] Quái to | Mutant | `mutant` |
| [ ] Boss | Warrok W Kurniawan hoặc Maw J Laygo | `warrok`, `maw` |

Quái đánh xa (Quỷ Lam cũ): em dùng lại một model ở trên, đổi màu/glow, khỏi tải thêm.

## 2. Animation (Without Skin) — khoảng 30 file

**Hero cận chiến**
- [ ] Sword And Shield Idle
- [ ] Sword And Shield Run
- [ ] Sword And Shield Slash
- [ ] Sword And Shield Attack
- [ ] Sword And Shield Casting (skill Chém Lốc)
- [ ] Sword And Shield Impact (trúng đòn)
- [ ] Sword And Shield Death

**Pháp sư / xạ thủ**
- [ ] Standing Idle
- [ ] Running
- [ ] Standing 1H Magic Attack 01
- [ ] Standing 2H Magic Area Attack 01 (Nova)
- [ ] Standing Draw Arrow
- [ ] Standing Aim Recoil

**Chung cho hero**
- [ ] Stand To Roll (lăn né), không có thì search `roll`
- [ ] Hit Reaction
- [ ] Dying
- [ ] Drinking (uống bình máu, có thì tốt)

**Quái**
- [ ] Zombie Idle
- [ ] Zombie Running
- [ ] Zombie Attack
- [ ] Zombie Reaction Hit
- [ ] Zombie Death
- [ ] Zombie Stand Up (trồi lên từ sàn), không có thì `Getting Up`
- [ ] Mutant Idle
- [ ] Mutant Run
- [ ] Mutant Swiping
- [ ] Mutant Roaring (boss gầm khi xuất hiện)
- [ ] Mutant Dying

**NPC**
- [ ] Talking
- [ ] Idle (bản thường, không vũ khí)

Thiếu vài cái cũng không sao, em fallback sang animation gần nhất.
