# cs-benthanh: map Chợ Bến Thành cho Counter-Strike 1.3

Map `cs_benthanh` (giải cứu con tin) dựng chợ Bến Thành:
- Nhà lồng chợ, tháp đồng hồ, vòng xoay.
- Hàng rong, xe máy, cột điện dán quảng cáo "RÚT HẦM CẦU", hoa giấy.
- Con tin là các bà bán rong đội nón lá. Dao có thể đổi thành dép tổ ong.

## Cần có

- Half-Life 1.1.0.6 + Counter-Strike 1.3 (bản WON 2001), cùng bản với người tạo phòng.
- [Node.js](https://nodejs.org) 18 trở lên. Chỉ cần lúc cài, chơi thì không cần.

## Cài

Mở cmd ngay tại thư mục chứa file `.tgz`, rồi chạy:

```
npx ./cs-benthanh-1.0.0.tgz install
```

Gói tự tìm thư mục game (`E:\Game\HL`, `C:\Sierra\Half-Life`...). Nếu không tìm thấy thì chỉ đường dẫn cho nó:

```
npx ./cs-benthanh-1.0.0.tgz install --game "D:\Games\Half-Life"
```

Lệnh này cài:

| Thứ | Ghi vào | Ghi chú |
|---|---|---|
| Map + bảng giới thiệu | `cstrike\maps\cs_benthanh.bsp`, `.txt` | File mới |
| Waypoint bot POD-Bot | `cstrike\PODBot\WPTDefault\cs_benthanh.pwf` | Chỉ máy tạo phòng mới cần |
| Con tin bà bán rong | `cstrike\models\bt_bantrong.mdl` (+ `T.mdl`) | Tạo từ `scientist.mdl` có sẵn trong game. Chỉ map này dùng |

## Dép tổ ong (tuỳ chọn)

CS 1.3 không cho đổi vũ khí riêng theo map, nên dép phải tự bật trước khi chơi và tắt sau khi chơi:

```
npx ./cs-benthanh-1.0.0.tgz dep on
npx ./cs-benthanh-1.0.0.tgz dep off
```

- Khi bật, **mọi map** đều cầm dép. Dao gốc được backup vào `cstrike\models\_goc_dao\`, `dep off` chép lại về.
- Mỗi người tự bật trên máy mình. Ai không bật thì vẫn thấy dao.

Xem trạng thái hiện tại:

```
npx ./cs-benthanh-1.0.0.tgz status
```

## Bản quyền

Gói chỉ chứa map, waypoint và code. Texture của map là ảnh CC0 (ambientCG) và hình vẽ bằng code. Gói **không** kèm
file model nào của Valve: con tin và dép được vá ngay trên máy, từ file game mà bạn đã có. Dùng chơi vui, phi thương mại.
