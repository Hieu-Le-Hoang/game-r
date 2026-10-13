# linters/ — luật riêng của dự án này, viết thành script chạy được

Linter tiêu chuẩn (Biome, oxlint, ESLint) bắt lỗi ở tầng ngôn ngữ. Mấy cái ở đây bắt **luật đặc thù
của codebase này** — thứ không công cụ mua sẵn nào biết.

| Linter | Cưỡng chế điều gì | Xuất xứ |
|---|---|---|
| `security.mjs` | Không hardcode secret, không log PII | Loại rò rỉ chỉ lộ ra sau khi đã công khai |
| `doc-paths.mjs` | Doc không được trỏ vào path không tồn tại | Văn xuôi cũ trông y hệt văn xuôi còn đúng |

---

## Hợp đồng mà mọi linter ở đây tuân theo

```bash
node linters/<name>.mjs <file...>     # exit 0 = sạch · 1 = có vi phạm · 2 = không chạy được
```

1. **Nhận danh sách file tường minh.** Không tự glob bên trong — caller quyết định phạm vi.
2. **Danh sách file rỗng là exit 2, không phải exit 0.** Linter được đưa cho không có gì thì tuyệt
   đối không được báo thành công; đó chính là cách một cửa kiểm âm thầm ngừng kiểm mà vẫn xanh.
3. **In ra cách sửa, không chỉ lời than.** Message vi phạm mà không nói phải làm gì thay thế thì chỉ
   dạy người ta cách dập nó.
4. **Viết bằng `.mjs`, không có bước build.** Một gate phải sống sót qua chính thứ nó canh bị hỏng —
   build của app gãy thì linter vẫn phải chạy được.

---

## Thêm luật mới

Thêm một linter khi một loại lỗi đã xuất hiện **tới lần thứ hai**. Viết xong thì thử một lần trên
file có lỗi đó cho chắc nó bắt được, rồi nối vào `scripts/gates.sh`.
