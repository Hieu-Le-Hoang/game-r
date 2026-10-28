# demo19 — cs_benthanh (map Chợ Bến Thành cho CS 1.3)

Map `cs_` (giải cứu con tin) cho Counter-Strike 1.3 bản WON 2001. Toàn bộ map được **sinh bằng script**: không
dùng editor, không dùng ảnh AI. Plan: [PLAN.md](PLAN.md).

```
src/textures.ts --> WAD (256 màu + mipmap) --+
src/benthanh.ts --> cs_benthanh.map ---------+--> SDHLT csg/bsp/vis/rad --> cs_benthanh.bsp --> cstrike/maps
```

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run build` | Typecheck + compile chất lượng đầy đủ (~1,5 phút, phần lớn là RAD) |
| `npm run build:fast` | Compile nhanh (~25 giây) để lặp |
| `npm run smoke` | Map hộp nhỏ, kiểm chuỗi compile |
| `npm run selftest` | WAD round-trip, brush lồi, đường đi CT/T/con tin, ảnh `build/layout.png` |
| `npm run install-map` | Compile đầy đủ rồi copy `cs_benthanh.bsp` + `.txt` vào `E:\Game\HL\cstrike\maps` |
| `npx tsx tools/sheet.ts` | Bảng xem trước texture sau khi giảm màu -> `build/textures.png` |

Cần: Node 22+, SDHLT ở `E:\game-r-tools\sdhlt` (đổi bằng env `SDHLT`), ảnh ambientCG ở `../_inbox/ambientcg`
(đổi bằng env `AMBIENTCG`, danh sách trong `CREDITS.md`).

## Chơi thử

Trong CS 1.3: **New Game / Create Server** chọn `cs_benthanh`, hoặc mở console gõ `map cs_benthanh`.
`npm run install-map` ghi thêm `cs_benthanh.pwf` vào `PODBot/WPTDefault`, để add được bot POD-Bot (đổi chỗ bằng env `PODBOT_WPT`).

## Waypoint POD-Bot (`src/waypoints.ts`)

Format "PODWAY!" v7 được đọc ngược từ `cs_italy.pwf` (mỗi waypoint 204 byte). Script sinh waypoint từ lưới đường đi:
- Rải điểm đều cách nhau 112 unit trên mọi sàn mà bot đi bộ tới được.
- Thêm các điểm bắt buộc: con tin (GOAL), rescue (RESCUE), spawn, 4 cửa chợ (CROSSING), chỗ canh của T/CT (CAMP), chân cầu thang.
- Nối hai điểm khi bot đi thẳng được giữa chúng: dọc đoạn thẳng có sàn liên tục, độ cao lệch <= 30.

Selftest kiểm theo link: CT spawn tới được con tin, con tin về được rescue, không có waypoint lẻ hay cụt.

## Con tin bà bán rong (`tools/hostage.ts`, `src/mdl.ts`)

`npm run hostage` lấy `scientist.mdl` + `scientistT.mdl` từ `valve/pak0.pak` của game, rồi **vá trực tiếp file .mdl**
(không decompile/recompile). Dữ liệu mới được nối vào cuối file, chỉ sửa con trỏ trong header:
- Thêm bodypart `nonla`: nón 16 cạnh, mặt trong và mặt ngoài riêng. Thêm bodypart `toc`: búi tóc sau gáy. Cả hai gắn vào xương đầu (bone 20) nên đi theo animation.
- Nhuộm lại texture: blouse trắng thành áo bà ba hoa tím (giữ nếp vải theo độ sáng gốc), quần đen, tóc bạc thành tóc đen, ria mép thành màu da.
- Kết quả là `models/bt_bantrong.mdl` + `bt_bantrongT.mdl` (file mới). Map gắn key `model` cho `hostage_entity`, nên chỉ map này dùng model mới. Soi `mp.dll` thấy CS 1.3 đọc `pev->model` trước khi rơi về scientist.
- Ảnh tự render để kiểm (4 kiểu đầu, nhìn trước + nghiêng): `build/model/preview.png`.

Model gốc thuộc Valve, script chỉ đọc từ bản game có sẵn trên máy. File kết quả nằm trong `build/` (không commit) và trong thư mục game.

## Đồ vật đường phố (`src/props.ts`)

Dựng bằng brush: xe hủ tiếu / bánh mì / nước mía (tủ kính trong suốt, mái tôn, 2 bánh), xe đẩy trái cây, gánh hàng
rong (2 thúng + đòn gánh + nón lá), ô dù, quán cóc ghế nhựa. 23 món rải dọc vỉa hè 4 con đường và quanh chợ.
Đợt 2: hàng xe máy đậu (7 hàng x 6 xe, biển GIỮ XE), cột điện bê tông dán quảng cáo "RÚT HẦM CẦU" (số điện thoại giả
0123.456.789), xe ba gác chở bao tải, xe kẹo bông, xe cà phê cóc. Mặt tiền nhà phố có thêm bảng số nhà, hộp thư,
chữ "CẤM ĐẬU XE" xịt sơn hoặc biển đứng, ban công nhỏ với hoa giấy rủ. Đồ vật đường phố gom vào 1 `func_wall`
riêng để không cắt leaf của world (worldleaves 1.275/8.192).

## Gói cài cho team (`pack/`, `src/cli.ts`)

`npm run build && npm run pack` tạo ra `build/cs-benthanh-1.0.0.tgz` (khoảng 1,5 MB, không publish), gửi cho các bạn cùng bản HL + CS 1.3.
Gói chỉ có map, waypoint, bảng giới thiệu và `cli.mjs` (bundle bằng esbuild, JS thuần, không thư viện native).
**Không kèm model nào của Valve**: con tin và dép được vá ngay trên máy từng bạn, từ file game có sẵn.

```
npx ./cs-benthanh-1.0.0.tgz install      # map + waypoint + con tin bà bán rong (tự dò thư mục game, hoặc --game)
npx ./cs-benthanh-1.0.0.tgz dep on|off   # bật / tắt dép tổ ong (mặc định tắt, backup dao vào _goc_dao)
npx ./cs-benthanh-1.0.0.tgz status
```

`npm run packtest` dựng một thư mục game giả (pak0.pak nhỏ chỉ có scientist), rồi chạy chính file `.tgz` qua npx:
install, dep on (hai lần), status, dep off. Test kiểm từng byte: map, con tin, dép, và dao gốc sau khi trả lại.
Hướng dẫn cho các bạn: `pack/README.md`.

## Dép tổ ong thay dao (`tools/dep.ts`)

`npm run dep` vá `v_knife.mdl`, `v_knife_r.mdl`, `p_knife.mdl`:
- Ẩn mesh lưỡi dao (ghi lệnh kết thúc vào đầu danh sách tam giác).
- Gắn chiếc dép (đế vân tổ ong + quai ngang) vào xương của dao, theo trục lưỡi cũ, gót ở phía cán.
- Model có texture nhúng, nên dữ liệu mới phải chèn **trước** vùng ảnh (engine bỏ phần sau `texturedataindex`).
- Tự dò mesh lưỡi dao (texture không giống tay; "handle" và "knifeskin" không tính là tay) và xương dao (xương chứa nhiều đỉnh nhất), nên chạy được với skin dao khác.
- Vũ khí không đổi riêng theo map được, nên dép bật/tắt bằng `dep on` / `dep off` của gói cài. `tools/dep.ts` chỉ build bản xem trước vào `build/weapon/`.

## Bố cục

- **T + 4 con tin:** T xuất phát ở khu vải phía Bắc trong nhà lồng. Con tin ở trên gác lửng góc Đông Bắc, lên bằng cầu thang sắt.
- **CT:** xuất phát ở vòng xoay trước tháp đồng hồ. Điểm rescue nằm ở vòng xoay (3 điểm).
- **3 đường vào chợ:**
  - **Cửa Nam:** đi thẳng lối giữa.
  - **Cửa Đông:** theo đường Phan Chu Trinh, có quầy và mái bạt.
  - **Cửa Tây:** theo đường Phan Bội Châu. Có thể đi xuyên nhà phố "SỬA XE" lên ban công tầng 2.
- **Đường xoay của T:** ra Cửa Bắc, đi vòng theo đường Lê Thánh Tôn.
- **Khoảng cách (selftest đo):**
  - CT tới con tin: khoảng 2560 unit, tức ~10 giây chạy.
  - T tới con tin: khoảng 1520 unit, tức ~6 giây.
