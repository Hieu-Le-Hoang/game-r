# demo9 — Bụi Sa Mạc

FPS chiến thuật kiểu **Counter-Strike 1.3**, chơi offline 5v5 với bot ngay trên trình duyệt. Engine: Three.js 0.169 + Rapier 0.21 (wasm), build bằng Vite. Bản live: https://wcg-game-r-demo9.vercel.app

## Có gì

- **Luật CS:** round 1:55, freeze 5s, mua đồ trong 20s đầu và chỉ trong khu spawn. Bom C4 đặt mất 3s, nổ sau 35s. Gỡ bom mất 10s, có bộ gỡ thì 5s. Đội nào thắng 16 round trước thì thắng trận.
- **Kinh tế:** khởi đầu $800, tối đa $16.000.
  - Kill: +$300.
  - Thắng: diệt hết hoặc hết giờ +$3250; bom nổ hoặc gỡ được +$3500.
  - Thua: $1400, mỗi trận thua liên tiếp cộng thêm $500, tối đa $3400.
  - T thua nhưng đã đặt được bom: +$800.
- **Súng:** Glock, USP, Desert Eagle, MP5, AK-47 (chỉ T), M4A1 (chỉ CT), AWP (2 mức zoom), lựu đạn HE, dao (đâm sau lưng x3). Giáp Kevlar, mũ, bộ gỡ bom.
  - Spread và recoil lấy theo số của CS 1.6: KickBack của AK/M4/MP5, độ chính xác súng lục giảm khi bắn dồn, spread tăng khi chạy hoặc nhảy.
  - Hitbox gồm đầu x4, ngực, bụng x1.25, chân x0.75. Giáp giảm sát thương theo armor ratio từng súng.
- **Di chuyển kiểu GoldSrc:** friction + accelerate + air strafe, crouch-jump, đi rón rén (Shift) để không phát ra tiếng bước chân, bị bắn trúng thì khựng lại.
- **Bot (3 mức khó):**
  - Phe T chọn site A hoặc B rồi rush, thỉnh thoảng có bot lurk. Bom rơi thì bot T gần nhất nhặt lên.
  - Phe CT chia nhau giữ A, B và mid, xoay site khi đồng đội báo có địch, khi bom đã đặt thì bot gần nhất đi gỡ.
  - Lúc bắn bot dừng hẳn (counter-strafe), xa thì bắn từng loạt, gần thì xả, có bù giật, thỉnh thoảng ném HE. Có thời gian phản xạ và sai số ngắm.
- **Map:** bản thu nhỏ kiểu de_dust2, gồm Long A, Catwalk, Mid (có cửa mid), hầm B trên/dưới, 2 site, spawn T và spawn CT.
- **HUD kiểu CS 1.3:** máu, giáp, đồng hồ, tiền (có hiệu ứng +/-), đạn, tâm ngắm co giãn theo spread, radar, kill feed (có headshot), bảng điểm (Tab), menu mua bằng phím số, scope AWP, hướng bị bắn, giọng radio đọc bằng speechSynthesis.
- **Chế độ xem bot:** chọn phím 6 ở menu để xem 10 bot tự đánh nhau.

Điều khiển: WASD đi · chuột ngắm/bắn · chuột phải zoom AWP / đâm dao · Space nhảy · Ctrl ngồi · Shift đi rón rén · R nạp đạn · 1-5 / lăn chuột / Q đổi súng · B mua đồ · E gỡ bom · G vứt súng · Tab bảng điểm · Esc menu. Thêm `?fps` vào URL để hiện FPS.

## Cấu trúc

```
src/sim/      logic thuần, không đụng Three.js -> chạy được trên Node
  constants   thông số súng / luật / kinh tế / độ khó bot
  map         map dạng lưới ô 2m (khoét lối đi), thùng, cột, site, spawn
  nav         lưới 0.5m + A* + làm mượt đường cho bot
  physics     Rapier: collider map, character controller, raycast đạn, lựu đạn nảy
  agent       người chơi/bot: túi đồ + di chuyển GoldSrc
  combat      bắn, spread, recoil, hitbox, dao, lựu đạn, C4
  bot         AI: mua đồ, nhận biết, giao tranh, mục tiêu theo phe
  game        vòng đời round, kinh tế, mua đồ, bom, nhặt súng
src/client/   render + HUD + âm thanh
  session     một trận phía client (chạy được trong Node với renderer giả)
tools/        selftest, smoke test, render CPU, build asset
```

## Verify (không cần browser)

```bash
npm run selftest                       # 10 bot đánh 6 round: luật, kinh tế, bom, NaN, xuyên tường
SEED=11 ROUNDS=8 HUMAN=CT npm run selftest
node tools/map-ascii.mjs               # in map ASCII + kiểm nav nối mọi spawn tới 2 site
JSDOM_PATH=<jsdom> npx vite-node tools/smoke-client.mjs 400 spec   # client chạy với DOM/renderer giả, bắt lỗi JS
npx vite-node tools/render-scene.mjs out.png --t 20 --agent 3 --vm ak47   # chụp góc nhìn FPS bằng rasterizer CPU
```

## Thỏa hiệp / chưa làm

- **Model:** model Quaternius không có clip ngồi, nên lúc ngồi model bị nén theo chiều cao. Súng trường cầm một tay theo animation gốc. Góc nhìn thứ nhất không vẽ tay.
- **Đạn:** không xuyên tường, bắn đồng đội không mất máu (đạn đi xuyên qua đồng đội).
- **Nhân vật:** người chơi và bot không va chạm nhau.
- **Phạm vi:** không có shotgun, flashbang, smoke, không đổi phe giữa trận, không chơi mạng.
- **Thiết bị:** chưa hỗ trợ cảm ứng, cần chuột + bàn phím.
- **Bundle:** khoảng 5MB JS (gzip 1.8MB), chủ yếu là wasm Rapier nhúng base64.
