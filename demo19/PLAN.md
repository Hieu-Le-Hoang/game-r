# demo19 — cs_benthanh: map Chợ Bến Thành cho Counter-Strike 1.3

> Map CS 1.3 (bản WON 2001, `E:\Game\HL`) dựng từ đầu bằng script. Không phải game web: đầu ra là
> `cs_benthanh.bsp` thả vào `cstrike/maps`. Trạng thái: **plan đã duyệt 2026-10-27, MVP đã build + cài, chờ anh test tay**.

## 1. Mục tiêu thử nghiệm

- **Câu hỏi A/B:** Agent có tự dựng được một map GoldSrc chơi được hoàn toàn bằng code (sinh `.map` -> compile -> BSP),
  không cần mở editor không?
- **So với:** cs_italy (map gốc cùng chế độ, cùng cỡ).
- **Kết quả mong đợi:** compile sạch (không leak, không vượt limit), load được trong CS 1.3, chơi hết 1 round cứu con tin.

## 2. Gameplay

- **Thể loại:** map `cs_` (giải cứu con tin) 5v5, cỡ tương đương cs_italy (~3500 x 3000 unit). Tỉ lệ 1 m ≈ 40 unit,
  khu chợ thu nhỏ ~0,4 lần so với thật để đi bộ hết map trong ~20 giây.
- **Bố cục** (Bắc ở trên):

  ```
                Lê Thánh Tôn (đường + dãy nhà phố)
     +--------------[Cửa Bắc]---------------+
   P | T spawn  | khu vải   | CON TIN (gác lửng)| P
   h |--------- lối giữa chợ (dài, thẳng) ----| h
   B | sạp ăn uống         | sạp trái cây     | C
   C +------[Cửa Nam + tháp đồng hồ]----------+ T
            Vòng xoay Quách Thị Trang
            CT spawn + điểm rescue
  ```

- **3 đường tấn công cho CT:**

  | Đường | Mô tả | Tính chất |
  |---|---|---|
  | Giữa | Cửa Nam -> lối giữa chợ thẳng tới khu T | Dài, thoáng, hợp AWP, nguy hiểm |
  | Đông | Đường Phan Chu Trinh có mái bạt, quầy hàng ngoài -> Cửa Đông | Hẹp, nhiều chỗ nấp, đánh gần |
  | Tây | Đường Phan Bội Châu -> xuyên qua 1 nhà phố 2 tầng, nhảy từ ban công -> Cửa Tây | Có độ cao, đánh lén |

- **Con tin:** 4 người ở gác lửng góc Đông Bắc trong chợ (lên bằng cầu thang sắt). Rescue zone tại vòng xoay.
- **Thắng / thua:** luật CS 1.3 mặc định (cứu hết con tin / giết hết đội kia / hết giờ).
- **Tiêu chí "vui":** mỗi đường đều có ít nhất 2 góc nấp; không đường nào thắng tuyệt đối; T từ spawn ra tới
  góc giữ chợ trước khi CT tới cửa.

## 3. Engine + version + đường build

- **Engine:** GoldSrc WON 1.1.0.6 + CS 1.3 có sẵn trên máy. Không đụng engine.
- **Sinh map:** script Node (TypeScript qua `tsx`) sinh file `cs_benthanh.map` (format Valve 220, mở được trong
  J.A.C.K / TrenchBroom nếu muốn chỉnh tay). Helper: hộp, tường có lỗ cửa, cầu thang, mái dốc, cột, sạp hàng.
- **Compile:** SDHLT v1.3.0 (`hlcsg` -> `hlbsp` -> `hlvis` -> `hlrad`), để ở `E:\game-r-tools\sdhlt`. Texture nhúng
  vào BSP (`-wadinclude`) để không phải kèm WAD. Dự phòng: build tool compile gốc trong `halflife-src/utils` bằng w64devkit.
- **Lý do:** viết map bằng code giúp lặp nhanh và diff được; compile tool là đường duy nhất ra BSP30 cho engine 2001.

## 4. Art + danh sách asset

Không dùng ảnh AI gen. Texture nằm trong giới hạn GoldSrc: tối đa 256 x 256, cạnh chia hết cho 16, 256 màu.
Texture trong suốt (tên bắt đầu `{`) dùng màu xanh index 255.

| Hạng mục | Cần gì (MVP) | Nguồn | License |
|---|---|---|---|
| Tường chợ | Vữa vàng, đá rửa, viền trắng | ambientCG (nhuộm màu bằng code) | CC0 |
| Sàn | Gạch lát sàn chợ, nhựa đường, vỉa hè gạch | ambientCG | CC0 |
| Mái | Ngói, tôn, khung sắt | ambientCG | CC0 |
| Sạp hàng | Gỗ, bạt che, thùng carton | ambientCG | CC0 |
| Chữ + dấu hiệu | Biển "CHỢ BẾN THÀNH", mặt đồng hồ, bảng hiệu sạp, vạch kẻ đường, cửa cuốn | Vẽ bằng code (canvas) | Tự làm |
| Trong suốt | Lan can sắt, dây điện, song cửa | Vẽ bằng code | Tự làm |
| Trời | Dùng skybox có sẵn của CS 1.3 | Game gốc | Có sẵn |
| Âm thanh | Dùng sound có sẵn trong game (MVP chưa thêm tiếng chợ) | Game gốc | Có sẵn |

- **Rủi ro:** (1) SDHLT viết cho Sven Co-op, phải chỉnh limit để BSP load được trên engine 2001 -> compile một
  map hộp nhỏ test trước. (2) Map mới chưa có waypoint PODBot nên bot đi lạc -> phase 2 (anh tự đi waypoint
  trong game hoặc em sinh `.pwf` từ layout).

## Đầu ra + an toàn

- Source (script, texture đã xử lý, CREDITS) ở `demo19/`. File tải về để ở `_inbox/` và `E:\game-r-tools`.
- Cài vào game **chỉ thêm file mới**: `cstrike/maps/cs_benthanh.bsp` + `cs_benthanh.txt`. Không sửa file gốc nào.
- Verify: log compile (không leak, không lỗi limit), đọc lại BSP (entity, texture), ảnh layout nhìn từ trên xuống.
  Em không tự mở game, anh chơi thử tay.
