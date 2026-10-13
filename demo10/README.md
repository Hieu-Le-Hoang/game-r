# demo10 — Võ Lâm Truyền Kỳ 1 (clone 2D, offline)

Live: https://wcg-game-r-demo10.vercel.app

Bản clone gameplay VLTK1 (2009) chạy web desktop. Engine Phaser 4.2.1 + Vite, art Flare (CC-BY-SA 3.0). Spec và các quyết định đã chốt: [gameplay.md](gameplay.md).

## Có gì
- Tạo nhân vật: giới tính + ngũ hành (Kim chỉ nam, Thủy chỉ nữ), 3 ô lưu (localStorage)
- 5 phái: Thiếu Lâm (Kim, côn), Đường Môn (Mộc, phi đao), Nga My (Thủy, kiếm), Cái Bang (Hỏa, chưởng), Võ Đang (Thổ, kiếm). Mỗi phái 6 skill + đánh thường
- Ngũ hành tương khắc + 5 loại kháng + hiệu ứng theo hệ (độc, chậm, choáng, thiêu đốt, chí mạng)
- Đồ trắng / xanh / Hoàng Kim, 10 ô trang bị, **kích dòng ẩn theo vòng tương sinh 5 cặp**
- Ba Lăng Huyện + Tương Dương (Xa phu, Dược điếm, Tạp hóa, Thợ rèn, Thủ khố, sứ giả 5 phái) + 4 bãi luyện công cấp 1-60
- Nhiệm vụ tân thủ, chuỗi môn phái 20/30/40/50, Xuất sư (hạ boss Ngưu Ma Vương)
- **Auto train** (phím Z): đánh quái trong bán kính, xoay skill, uống thuốc theo ngưỡng, tự bật buff, nhặt đồ theo bộ lọc

## Điều khiển
| Phím | Việc |
|---|---|
| Chuột trái | Đi / đánh / nói chuyện / nhặt đồ / qua cổng |
| Chuột phải | Skill chuột phải |
| Z | Bật/tắt auto |
| 1 · 2 · 3 | Thuốc sinh lực · nội lực · Thổ Địa Phù |
| F3/C · F4/I · F5/K · Q | Nhân vật · Hành trang · Võ công · Nhiệm vụ |
| Tab · V · Alt · Space · Esc | Bản đồ · Ngồi · Hiện tên đồ · Nhặt đồ gần · Hệ thống |

## Lệnh
```bash
npm install
npm run dev                       # chạy local
npm run build                     # build ra dist/
node tools/selftest.mjs all       # bot auto train 1 -> 60 cho 5 phái, đạt khi 105-135 phút giả lập
node tools/uitest.mjs             # smoke test HUD + bảng bằng DOM giả (không cần browser)
python3 -I tools/build_assets.py  # đóng lại art (cần _raw/flare-game, xem tasks/todo.md M0)
```

## Cấu trúc
- `src/core/` — luật chơi thuần JS (không Phaser): `world.js` mô phỏng map, `auto.js`, `char.js`, `items.js`, `quests.js`, `data/`
- `src/render/scene.js` — Phaser scene vẽ state core
- `src/ui/` — HUD + các bảng (DOM)
- `tools/` — build asset, selftest
