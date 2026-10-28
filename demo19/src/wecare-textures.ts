// Texture riêng của cs_wecare (tiền tố wc_): vật liệu khu xưởng lấy từ ảnh ambientCG đã có + hình vẽ bằng code.
// Không lấy pixel từ ảnh chụp/Street View, chỉ dùng chúng để chọn màu. Các texture bt_* dùng chung lấy từ textures.ts.
// Ngoại lệ: tranh phòng IT dùng ảnh NASA public domain (CREDITS.md), tải sẵn vào _inbox/nasa-earth-night.
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { blank, fill, rng, type RGB } from './proc.ts';
import { FONT, photo, sign, svg, type TexDef } from './textures.ts';
import type { Rgba } from './wad.ts';

const INBOX = process.env.INBOX ?? join(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'), '_inbox');

/** Tranh Trái Đất ban đêm (NASA Earth Observatory, public domain): ảnh 2:1 thu về 256 x 128, sáng lên chút cho khỏi chìm trong phòng. */
async function earthNight(): Promise<Rgba> {
  const file = join(INBOX, 'nasa-earth-night', '1280px-The_earth_at_night.jpg');
  if (!existsSync(file)) throw new Error(`thiếu ảnh ${file} (Wikimedia Commons: The_earth_at_night.jpg, bản 1280px)`);
  const { data, info } = await sharp(file).resize(256, 128, { fit: 'fill', kernel: 'lanczos3' }).modulate({ brightness: 1.25 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, data: new Uint8Array(data) };
}

/** Nền đất/đá có hạt: nền màu + nhiễu + chấm sáng tối rải ngẫu nhiên. */
function grainy(size: number, base: RGB, dots: RGB[], n: number, seed: number) {
  return async (): Promise<Rgba> => {
    const img = fill(blank(size, size), base, 0.35, seed);
    const r = rng(seed + 1);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(r() * size);
      const y = Math.floor(r() * size);
      const c = dots[Math.floor(r() * dots.length)];
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) img.data.set(c, (((y + dy) % size) * size + ((x + dx) % size)) * 4);
    }
    return img;
  };
}

/** Bạt nhựa có nếp gấp chéo (bạt cam cuộn, bạt xanh dương trùm đồ). */
function tarpFold(base: string, dark: string, light: string, seed: number) {
  const r = rng(seed);
  let body = `<rect width="64" height="64" fill="${base}"/>`;
  for (let i = 0; i < 7; i++) {
    const x = r() * 64;
    body += `<path d="M${x} 0 Q${x + 10 - r() * 20} 32 ${x + 6 - r() * 12} 64" stroke="${r() < 0.5 ? dark : light}" stroke-width="${2 + r() * 3}" fill="none" opacity="0.6"/>`;
  }
  return svg(64, 64, body);
}

/** Cuộn ống nhựa nhìn ngang: các vòng ống xếp chồng + dây đai vàng. */
function hoseCoil(c: string, dark: string) {
  return svg(64, 64, `<rect width="64" height="64" fill="${dark}"/>
    ${Array.from({ length: 8 }, (_, i) => `<rect y="${i * 8 + 1}" width="64" height="6" rx="3" fill="${c}"/><rect y="${i * 8 + 2}" width="64" height="1" fill="#fff" opacity="0.25"/>`).join('')}
    <rect x="18" width="5" height="64" fill="#e3c13b"/><rect x="44" width="5" height="64" fill="#e3c13b"/>`);
}

/** Logo Wecare vẽ lại bằng hình học: lục giác teal, chữ trắng, chấm tròn trắng (theo ảnh logo anh gửi). */
const logo = svg(128, 128, `<rect width="128" height="128" fill="#ffffff"/>
  <defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#2a7f93"/><stop offset="1" stop-color="#46b6cf"/></linearGradient></defs>
  <polygon points="4,64 34,10 94,10 124,64 94,118 34,118" fill="url(#g)"/>
  <text x="64" y="50" ${FONT} font-size="24" fill="#ffffff" text-anchor="middle">wecare</text>
  <circle cx="64" cy="82" r="15" fill="#ffffff"/>`);

/** Bảng hiệu trên tường rào cạnh cổng. */
const mainSign = svg(256, 128, `<rect width="256" height="128" fill="#1f4f9c"/><rect x="4" y="4" width="248" height="120" fill="#f7f7f4"/>
  <text x="104" y="30" ${FONT} font-size="15" fill="#1f4f9c" text-anchor="middle">CÔNG TY CP PHƯỚC HƯNG</text>
  <text x="104" y="74" ${FONT} font-size="40" fill="#1f4f9c" text-anchor="middle">WECARE</text>
  <text x="104" y="104" ${FONT} font-size="12" fill="#1f4f9c" text-anchor="middle">ĐỒNG HÀNH CÙNG SẢN XUẤT</text>
  <polygon points="200,64 214,40 242,40 256,64 242,88 214,88" transform="translate(-8 0)" fill="#2f97b1"/>
  <circle cx="220" cy="70" r="7" fill="#ffffff"/>`);

/** Lưới che nắng xanh lá (trong suốt ~40%): sợi đan + dải đậm ở mép trên như tấm lưới thật. */
const net = (() => {
  let body = '';
  for (let y = 0; y < 64; y += 4)
    for (let x = 0; x < 64; x += 4) {
      const hole = (x / 4 + y / 4) % 2 === 0 && y >= 12;
      if (!hole) body += `<rect x="${x}" y="${y}" width="4" height="4" fill="${y < 12 ? '#1e5e3c' : '#2f8f5b'}"/>`;
    }
  return svg(64, 64, body);
})();

/** Lưới rào B40 (trong suốt): mắt cáo xám. */
const meshFence = svg(64, 64, `${Array.from({ length: 5 }, (_, i) => `<line x1="${i * 16 - 32}" y1="0" x2="${i * 16 + 32}" y2="64" stroke="#7d8488" stroke-width="2"/><line x1="${i * 16 + 32}" y1="0" x2="${i * 16 - 32}" y2="64" stroke="#7d8488" stroke-width="2"/>`).join('')}
  <rect width="64" height="3" fill="#5b6266"/>`);

/** Tán cây (trong suốt, không va chạm): lá xanh dày ở giữa. */
const leaves = (() => {
  const r = rng(41);
  let body = '';
  for (let i = 0; i < 110; i++) body += `<ellipse cx="${r() * 128}" cy="${r() * 128}" rx="${5 + r() * 7}" ry="${3 + r() * 5}" fill="${['#2f6b2a', '#3d8a34', '#25561f', '#4f9a3c'][Math.floor(r() * 4)]}"/>`;
  return svg(128, 128, body);
})();

/** Cổng xếp inox gấp gọn nhìn từ hông: thanh inox đứng sát nhau, khe tối, ray trên + bánh xe dưới. */
const gateFold = svg(64, 64, `<rect width="64" height="64" fill="#3a3f43"/>
  ${Array.from({ length: 16 }, (_, i) => `<rect x="${i * 4}" y="3" width="3" height="56" fill="#cfd4d8"/><rect x="${i * 4}" y="3" width="1" height="56" fill="#f2f4f5"/>`).join('')}
  <rect width="64" height="4" fill="#9aa1a6"/><rect y="28" width="64" height="2" fill="#8a9196"/>
  ${Array.from({ length: 4 }, (_, i) => `<circle cx="${8 + i * 16}" cy="60" r="3.5" fill="#1c1f22"/>`).join('')}`);

/** Cửa nhôm kính trắng (mặt cửa giả của nhà làm cảnh). */
const aluDoor = svg(64, 128, `<rect width="64" height="128" fill="#e9ecee"/><rect x="6" y="8" width="52" height="62" fill="#7c97a6"/>
  <rect x="31" y="8" width="2" height="112" fill="#c9ced2"/><rect x="6" y="76" width="52" height="44" fill="#f4f6f7"/>
  ${Array.from({ length: 6 }, (_, i) => `<rect x="6" y="${80 + i * 7}" width="52" height="2" fill="#cfd5d9"/>`).join('')}
  <rect x="38" y="70" width="8" height="3" fill="#8a8f93"/>`);

/** Cửa sổ kính lá sách của dãy xưởng. */
const louvre = svg(64, 64, `<rect width="64" height="64" fill="#d9d4c4"/><rect x="4" y="4" width="56" height="56" fill="#38464e"/>
  ${Array.from({ length: 7 }, (_, i) => `<rect x="4" y="${6 + i * 8}" width="56" height="4" fill="#8fa4ae"/>`).join('')}
  <rect x="30" y="4" width="4" height="56" fill="#d9d4c4"/>`);

/** Cục nóng máy lạnh: vỏ xám + lưới quạt tròn. */
const acUnit = svg(64, 64, `<rect width="64" height="64" fill="#d2d4d2"/><circle cx="26" cy="32" r="22" fill="#5e6366"/>
  ${Array.from({ length: 5 }, (_, i) => `<circle cx="26" cy="32" r="${4 + i * 4}" fill="none" stroke="#a9adaf" stroke-width="1.5"/>`).join('')}
  <rect x="52" y="8" width="8" height="48" fill="#b9bcba"/>`);

/** Thùng phuy nhựa xanh: thân xanh + 2 gân ngang. */
const drum = svg(64, 64, `<rect width="64" height="64" fill="#1d4f9a"/><rect y="18" width="64" height="4" fill="#163c76"/><rect y="42" width="64" height="4" fill="#163c76"/>
  <rect x="6" width="6" height="64" fill="#ffffff" opacity="0.12"/>`);

/** Bình nước 20L xếp hàng: xanh nhạt trong, nắp xanh đậm (đục cho dễ nhìn). */
const jug = svg(32, 32, `<rect width="32" height="32" fill="#6fa8dc"/><rect x="11" y="0" width="10" height="5" fill="#1f4e9c"/>
  <rect x="3" y="10" width="26" height="3" fill="#9cc4ea"/><rect x="3" y="22" width="26" height="3" fill="#9cc4ea"/>`);

const paper = svg(64, 96, `<rect width="64" height="96" fill="#f3f1ea"/><text x="32" y="16" ${FONT} font-size="9" fill="#b3261e" text-anchor="middle">NỘI QUY</text>
  ${Array.from({ length: 9 }, (_, i) => `<rect x="8" y="${24 + i * 7}" width="${40 + ((i * 13) % 9)}" height="2" fill="#8a8a8a"/>`).join('')}`);

/** Tủ rack server: khung đen, các tầng thiết bị có đèn LED xanh/cam. */
const rack = svg(64, 128, `<rect width="64" height="128" fill="#1b1d20"/>
  ${Array.from({ length: 10 }, (_, i) => `<rect x="6" y="${8 + i * 12}" width="52" height="9" fill="#2c3036"/><rect x="48" y="${11 + i * 12}" width="3" height="3" fill="${i % 3 ? '#3ddc84' : '#ff9800'}"/><rect x="40" y="${11 + i * 12}" width="3" height="3" fill="#3ddc84"/>`).join('')}`);

/** Mặt màn hình máy tính: viền đen, nền xanh có vài dòng chữ giả. */
const screen = svg(64, 32, `<rect width="64" height="32" fill="#111"/><rect x="3" y="3" width="58" height="26" fill="#1d3f6e"/>
  ${Array.from({ length: 4 }, (_, i) => `<rect x="7" y="${7 + i * 5}" width="${20 + ((i * 17) % 30)}" height="2" fill="#9cc4ea"/>`).join('')}`);

/** Kệ khay linh kiện: hàng khay nhựa xanh / đỏ / vàng, mỗi khay có nhãn trắng. */
const binRack = svg(64, 64, `<rect width="64" height="64" fill="#5b6266"/>
  ${Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => {
    const col = ['#1f5fbf', '#c62828', '#e0a800', '#1f5fbf'][(r + c) % 4];
    return `<rect x="${c * 16 + 1}" y="${r * 16 + 3}" width="14" height="12" fill="${col}"/><rect x="${c * 16 + 4}" y="${r * 16 + 6}" width="8" height="3" fill="#f2f2f2"/>`;
  }).join('')).join('')}`);

/** Bu lông ốc vít đổ đầy hộp nhìn từ trên: đầu lục giác xám + thân ren. */
const bolts = (() => {
  const r = rng(71);
  let body = '<rect width="32" height="32" fill="#4a4f53"/>';
  for (let i = 0; i < 22; i++) {
    const x = r() * 32;
    const y = r() * 32;
    body += r() < 0.5
      ? `<polygon points="${x - 3},${y} ${x - 1.5},${y - 2.6} ${x + 1.5},${y - 2.6} ${x + 3},${y} ${x + 1.5},${y + 2.6} ${x - 1.5},${y + 2.6}" fill="#b9bec2"/>`
      : `<rect x="${x}" y="${y}" width="7" height="2" fill="#9aa0a4" transform="rotate(${Math.floor(r() * 180)} ${x} ${y})"/>`;
  }
  return svg(32, 32, body);
})();

/** Thùng carton in chữ loại hàng. */
const labelBox = (text: string) => svg(64, 64, `<rect width="64" height="64" fill="#a8804f"/><rect y="28" width="64" height="8" fill="#c9a875"/>
  <rect x="0" y="0" width="64" height="64" fill="none" stroke="#7d5c33" stroke-width="2"/>
  <rect x="8" y="40" width="48" height="16" fill="#f3ead8"/>
  <text x="32" y="52" ${FONT} font-size="9" fill="#1f4f9c" text-anchor="middle">${text}</text>`);

/** Cánh cửa kho tôn xám đậm: tấm phẳng, đường ghép dọc, vệt bẩn chân cửa. */
const doorGray = svg(128, 128, `<rect width="128" height="128" fill="#5c6166"/>
  ${Array.from({ length: 4 }, (_, i) => `<rect x="${i * 32}" width="2" height="128" fill="#43474b"/><rect x="${i * 32 + 2}" width="1" height="128" fill="#767b80"/>`).join('')}
  <rect y="60" width="128" height="3" fill="#4a4e52"/><rect y="104" width="128" height="24" fill="#4d4f50" opacity="0.6"/>`);

/** Tivi treo tường: viền đen mỏng, màn hình tối có vệt phản chiếu. */
const tv = svg(64, 48, `<rect width="64" height="48" fill="#111214"/><rect x="2" y="2" width="60" height="40" fill="#1d2630"/>
  <path d="M8 36 L30 6 L36 6 L14 36 Z" fill="#3a4a58" opacity="0.6"/><rect x="28" y="43" width="8" height="2" fill="#3ddc84"/>`);

/** Bảng điện (tủ điện âm tường): vỏ xám, hàng CB đen, nhãn vàng cảnh báo. */
const elecPanel = svg(32, 48, `<rect width="32" height="48" fill="#b9bec2"/><rect x="3" y="3" width="26" height="42" fill="#d4d8da"/>
  ${Array.from({ length: 6 }, (_, i) => `<rect x="${6 + (i % 3) * 7}" y="${10 + Math.floor(i / 3) * 12}" width="5" height="9" fill="#222"/>`).join('')}
  <polygon points="16,34 22,44 10,44" fill="#f2c200"/>`);

/** Kính mờ: trắng sữa hơi xanh, sọc dọc mờ. */
const frostedGlass = svg(64, 64, `<rect width="64" height="64" fill="#dfe8ec"/>${Array.from({ length: 8 }, (_, i) => `<rect x="${i * 8}" width="3" height="64" fill="#eef3f5"/>`).join('')}`);

/** Cửa sổ kính khung nhôm trắng 2 cánh. */
const glassWin = svg(64, 64, `<rect width="64" height="64" fill="#eceeef"/><rect x="5" y="5" width="25" height="54" fill="#8fb0c2"/>
  <rect x="34" y="5" width="25" height="54" fill="#8fb0c2"/><path d="M9 40 L24 10 L27 10 L12 40 Z" fill="#c4d8e3" opacity="0.6"/>
  <path d="M38 44 L53 14 L56 14 L41 44 Z" fill="#c4d8e3" opacity="0.5"/>`);

/** Bảng trắng ghi chú: khung nhôm, vài dòng chữ bút lông xanh/đỏ, khay bút dưới. */
const whiteboard = svg(128, 64, `<rect width="128" height="64" fill="#c9ced2"/><rect x="3" y="3" width="122" height="54" fill="#f7f8f6"/>
  ${Array.from({ length: 5 }, (_, i) => `<rect x="${10 + (i % 2) * 6}" y="${10 + i * 9}" width="${40 + ((i * 23) % 50)}" height="2" fill="${i === 2 ? '#c62828' : '#1f4f9c'}"/>`).join('')}
  <rect x="90" y="12" width="24" height="16" fill="none" stroke="#1f4f9c" stroke-width="2"/><rect y="57" width="128" height="7" fill="#9aa0a4"/>`);

/** Mặt máy lạnh treo tường: vỏ trắng, khe gió dưới, đèn báo xanh. */
const acIndoor = svg(64, 32, `<rect width="64" height="32" fill="#f1f2f0"/><rect y="18" width="64" height="5" fill="#9ea3a6"/>
  <rect y="23" width="64" height="2" fill="#d5d8d9"/><rect x="54" y="8" width="4" height="2" fill="#3ddc84"/>`);

/** Cây nước nóng lạnh: thân trắng, 2 vòi đỏ / xanh, khay hứng nước. */
const dispenser = svg(32, 64, `<rect width="32" height="64" fill="#eef0f0"/><rect x="4" y="14" width="24" height="14" fill="#d4d8da"/>
  <rect x="8" y="18" width="5" height="6" fill="#d32f2f"/><rect x="19" y="18" width="5" height="6" fill="#1976d2"/>
  <rect x="6" y="30" width="20" height="3" fill="#9aa0a4"/><rect x="2" y="58" width="28" height="6" fill="#c9ced2"/>`);

/** Tủ lạnh 2 cánh trên/dưới: thân bạc, tay nắm dọc, logo nhỏ. */
const fridge = svg(32, 80, `<rect width="32" height="80" fill="#dfe3e5"/><rect y="28" width="32" height="2" fill="#9aa0a4"/>
  <rect x="25" y="8" width="3" height="14" fill="#8a9095"/><rect x="25" y="36" width="3" height="22" fill="#8a9095"/>
  <rect x="6" y="70" width="20" height="2" fill="#b5babd"/>`);

/** Máy chấm công treo tường: vỏ xám, màn hình xanh, bàn phím số, ô quẹt thẻ. */
const timeClock = svg(32, 32, `<rect width="32" height="32" fill="#3a3f44"/><rect x="4" y="4" width="24" height="9" fill="#5fc9e8"/>
  ${Array.from({ length: 9 }, (_, i) => `<rect x="${5 + (i % 3) * 6}" y="${16 + Math.floor(i / 3) * 5}" width="4" height="3" fill="#c9ced2"/>`).join('')}
  <rect x="23" y="16" width="5" height="13" fill="#1d2023"/>`);

/** Thân thùng sơn WIN: nhựa trắng, dải đỏ, chữ WIN xanh. */
const paintWin = svg(64, 32, `<rect width="64" height="32" fill="#f2f2ee"/><rect y="6" width="64" height="5" fill="#c62828"/>
  <text x="32" y="25" ${FONT} font-size="12" fill="#1f4f9c" text-anchor="middle">WIN</text><rect y="29" width="64" height="3" fill="#c9c9c4"/>`);

/** Gương soi treo trên bồn rửa mặt: khung nhựa trắng, mặt gương xanh bạc có vệt phản chiếu. */
const mirror = svg(32, 48, `<rect width="32" height="48" fill="#e9ecee"/><rect x="3" y="3" width="26" height="42" fill="#9fb4c0"/>
  <path d="M6 30 L20 6 L24 6 L10 30 Z" fill="#d6e2e8" opacity="0.7"/><path d="M12 42 L26 18 L27 22 L15 42 Z" fill="#d6e2e8" opacity="0.5"/>`);

const wcSign = svg(64, 32, `<rect width="64" height="32" fill="#f5f5f5"/><rect x="2" y="2" width="60" height="28" fill="#1f4f9c"/>
  <text x="32" y="23" ${FONT} font-size="18" fill="#ffffff" text-anchor="middle">WC</text>`);

export const WC_TEXTURES: TexDef[] = [
  // Ảnh CC0 ambientCG (đã có trong _inbox/ambientcg của cs_benthanh)
  { name: 'wc_wall_yl', scale: 1, make: photo('Plaster007', 256, { tint: [236, 204, 128], bright: 1.1 }) },
  { name: 'wc_wall_wh', scale: 1, make: photo('PaintedPlaster017', 256, { tint: [238, 238, 230], bright: 1.15 }) },
  { name: 'wc_wall_gy', scale: 1, make: photo('Plaster007', 256, { tint: [186, 188, 184] }) },
  { name: 'wc_wall_old', scale: 1, make: photo('Concrete034', 128, { tint: [200, 196, 176], bright: 0.95 }) },
  { name: 'wc_tin_wh', scale: 2, make: photo('CorrugatedSteel006A', 128, { tint: [222, 222, 212], bright: 1.15 }) },
  { name: 'wc_tin_rust', scale: 2, make: photo('CorrugatedSteel006A', 128, { tint: [186, 128, 86], bright: 0.9 }) },
  { name: 'wc_tin_green', scale: 2, make: photo('CorrugatedSteel006A', 128, { tint: [104, 140, 112], bright: 0.85 }) },
  { name: 'wc_concrete', scale: 2, make: photo('Concrete034', 128, { bright: 0.9 }) },
  { name: 'wc_floor_kho', scale: 2, make: photo('Concrete034', 128, { bright: 0.62 }) },
  { name: 'wc_steel_rust', scale: 0.5, make: photo('Metal053B', 128, { bright: 0.8 }) },
  // Vẽ bằng code
  { name: 'wc_gravel', scale: 1, make: grainy(64, [92, 86, 80], [[150, 146, 138], [60, 56, 52], [176, 170, 158]], 260, 51) },
  { name: 'wc_dirt', scale: 1, make: grainy(64, [140, 104, 72], [[110, 80, 56], [170, 132, 96]], 160, 52) },
  { name: 'wc_bark', scale: 0.5, make: async () => fill(blank(32, 32), [86, 70, 56], 0.4, 53) },
  { name: 'wc_dark', scale: 1, make: async () => fill(blank(32, 32), [14, 14, 16], 0.2, 54) },
  { name: 'wc_alu', scale: 0.5, make: async () => fill(blank(32, 32), [222, 225, 228], 0.05, 55) },
  { name: 'wc_glass', scale: 1, make: async () => fill(blank(32, 32), [150, 184, 200], 0.06, 56) },
  { name: 'wc_bottle', scale: 0.25, make: async () => fill(blank(16, 16), [54, 118, 70], 0.08, 66) },
  { name: 'wc_bottle_am', scale: 0.25, make: async () => fill(blank(16, 16), [128, 66, 22], 0.08, 67) },
  // Công tắc đèn: đế nhựa trắng, phím bập bênh
  { name: 'wc_switch', scale: 0.25, make: svg(32, 48, `<rect width="32" height="48" fill="#f2f2ee"/><rect x="1" y="1" width="30" height="46" fill="none" stroke="#c9c9c2" stroke-width="2"/><rect x="10" y="12" width="12" height="24" rx="2" fill="#dedcd4"/><rect x="10" y="12" width="12" height="11" rx="2" fill="#ffffff"/>`) },
  { name: 'wc_pvc', scale: 0.5, make: async () => fill(blank(32, 32), [36, 92, 196], 0.05, 63) },
  { name: 'wc_plastic_wh', scale: 0.5, make: async () => fill(blank(32, 32), [240, 240, 234], 0.04, 64) },
  // Màn hình 24 x 16 unit: viền đen, nền desktop xanh, vài cửa sổ + thanh taskbar
  { name: 'wc_poster_earth', scale: 0.5, make: earthNight }, // 128 x 64 unit, 0,5 unit/texel
  { name: 'wc_monitor', scale: 0.5, make: svg(48, 32, `<rect width="48" height="32" fill="#0c0c0e"/><rect x="2" y="2" width="44" height="26" fill="#2a6db3"/>
    <rect x="5" y="5" width="22" height="15" fill="#f2f4f6"/><rect x="5" y="5" width="22" height="3" fill="#1f4f9c"/>
    <rect x="7" y="10" width="16" height="1.5" fill="#8a96a3"/><rect x="7" y="13" width="12" height="1.5" fill="#8a96a3"/><rect x="7" y="16" width="14" height="1.5" fill="#8a96a3"/>
    <rect x="30" y="8" width="13" height="10" fill="#e6eef6"/><rect x="2" y="25" width="44" height="3" fill="#1b2430"/><rect x="22" y="29.5" width="4" height="1" fill="#3a8ee6"/>`) },
  // Mặt nước hồ cá: xanh rêu, gợn sóng sáng, vài con cá cam
  { name: 'wc_water', scale: 0.5, make: svg(64, 64, `<rect width="64" height="64" fill="#2f5a4e"/>
    <path d="M4 14 q8 -4 16 0 M36 30 q8 -4 16 0 M10 48 q8 -4 16 0 M42 56 q6 -3 12 0" stroke="#6f9c8c" stroke-width="1.5" fill="none"/>
    <ellipse cx="22" cy="28" rx="6" ry="2.5" fill="#e8742a"/><path d="M16 28 l-4 -3 v6 z" fill="#e8742a"/>
    <ellipse cx="46" cy="44" rx="5" ry="2" fill="#f2a03c" transform="rotate(-30 46 44)"/>
    <ellipse cx="44" cy="12" rx="4.5" ry="2" fill="#f4f0e8" transform="rotate(20 44 12)"/>`) },
  { name: 'wc_truck', scale: 0.5, make: async () => fill(blank(32, 32), [32, 84, 172], 0.06, 57) },
  { name: 'wc_orange', scale: 0.5, make: async () => fill(blank(32, 32), [214, 92, 46], 0.1, 58) },
  { name: 'wc_yellow', scale: 0.5, make: async () => fill(blank(32, 32), [236, 182, 28], 0.08, 60) },
  { name: 'wc_bin', scale: 0.5, make: async () => fill(blank(32, 32), [40, 140, 110], 0.08, 59) },
  { name: 'wc_bat_cam', scale: 0.5, make: tarpFold('#d65c2e', '#9c3d1c', '#ef8a5a', 61) },
  { name: 'wc_bat_xanh', scale: 0.75, make: tarpFold('#1e3f82', '#122a5a', '#3a62b0', 62) },
  { name: 'wc_bat_toi', scale: 0.75, make: tarpFold('#5b636e', '#444b55', '#747d88', 65) }, // bạt 2 mái nhà xe xám tối
  { name: 'wc_hose_bl', scale: 0.5, make: hoseCoil('#2348c4', '#14286e') },
  { name: 'wc_hose_gr', scale: 0.5, make: hoseCoil('#3fbf4a', '#1f6b26') },
  { name: 'wc_logo', scale: 0.75, make: logo },
  { name: 'wc_sign_main', scale: 0.5, make: mainSign },
  { name: 'wc_sign_vpsmv', scale: 0.5, make: sign('VÔ PHẬN SỰ MIỄN VÀO', '#c62828', '#ffffff', 256, 64, 20) },
  { name: 'wc_sign_xh', scale: 0.5, make: sign('CỔNG XUẤT HÀNG', '#1f4f9c', '#ffffff', 256, 64, 22) },
  { name: 'wc_sign_wc', scale: 0.5, make: wcSign },
  { name: 'wc_sign_hop', scale: 0.5, make: sign('PHÒNG HỌP', '#1f4f9c', '#ffffff', 128, 32, 16) },
  { name: 'wc_sign_it', scale: 0.5, make: sign('PHÒNG IT', '#1f4f9c', '#ffffff', 128, 32, 16) },
  { name: 'wc_sign_kt', scale: 0.5, make: sign('PHÒNG KẾ TOÁN', '#1f4f9c', '#ffffff', 128, 32, 13) },
  { name: 'wc_door_gy', scale: 1, make: doorGray },
  { name: 'wc_mirror', scale: 1, make: mirror },
  { name: 'wc_paint_win', scale: 0.5, make: paintWin },
  { name: 'wc_timeclock', scale: 0.75, make: timeClock },
  { name: 'wc_whiteboard', scale: 0.75, make: whiteboard },
  { name: 'wc_glasswin', scale: 1, make: glassWin },
  { name: 'wc_tv', scale: 1.25, make: tv },
  { name: 'wc_elecpanel', scale: 1, make: elecPanel },
  { name: 'wc_frosted', scale: 1, make: frostedGlass },
  { name: 'wc_sign_nh', scale: 0.5, make: sign('CỔNG NHẬP HÀNG', '#1f4f9c', '#ffffff', 256, 64, 22) },
  { name: 'wc_hill', scale: 6, make: grainy(64, [88, 112, 62], [[112, 132, 72], [68, 88, 48], [124, 112, 82]], 420, 81) }, // đồi cỏ xa, texel to cho nhẹ lightmap
  { name: 'wc_ac_in', scale: 1.5, make: acIndoor },
  { name: 'wc_dispenser', scale: 0.75, make: dispenser },
  { name: 'wc_fridge', scale: 1, make: fridge },
  { name: 'wc_sign_bv', scale: 0.375, make: sign('PHÒNG BẢO VỆ', '#e6e1d3', '#4a5560', 128, 32, 13) }, // nhỏ + màu dịu
  { name: 'wc_paint_lid', scale: 0.5, make: async () => fill(blank(32, 32), [214, 52, 46], 0.06, 63) },
  { name: 'wc_rack', scale: 1.5, make: rack },
  { name: 'wc_binrack', scale: 0.75, make: binRack },
  { name: 'wc_bolts', scale: 0.5, make: bolts },
  { name: 'wc_box_bulong', scale: 0.4375, make: labelBox('BU LÔNG') },
  { name: 'wc_box_ocvit', scale: 0.4375, make: labelBox('ỐC VÍT') },
  { name: 'wc_screen', scale: 0.625, make: screen },
  { name: 'wc_paper', scale: 0.5, make: paper },
  { name: 'wc_gate_fold', scale: 0.5, make: gateFold },
  { name: 'wc_door', scale: 0.75, make: aluDoor },
  { name: 'wc_louvre', scale: 1, make: louvre },
  { name: 'wc_ac', scale: 0.5, make: acUnit },
  { name: 'wc_drum', scale: 0.75, make: drum },
  { name: 'wc_jug', scale: 0.5, make: jug },
  { name: '{wc_net', scale: 1, make: net },
  { name: '{wc_mesh', scale: 0.75, make: meshFence },
  { name: '{wc_leaves', scale: 1.5, make: leaves },
];
