// Danh mục texture của map. Mỗi texture: tên trong WAD, kích thước 1 texel bằng bao nhiêu unit, và hàm sinh ảnh.
// Hai nguồn: ảnh vật liệu CC0 của ambientCG (resize + nhuộm màu) và hình vẽ bằng code (SVG -> sharp).
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp, { type Sharp } from 'sharp';
import { blank, fill, rng, tiles, type RGB } from './proc.ts';
import type { Rgba } from './wad.ts';

export interface TexDef {
  name: string;
  /** 1 texel = `scale` unit thế giới. Texture 128 px với scale 2 phủ 256 unit (~6,4 m). */
  scale: number;
  make: () => Promise<Rgba>;
}

/** Texture công cụ của SDHLT (không vẽ ra màn hình hoặc là bầu trời), nằm trong sdhlt.wad. */
export const TOOL_TEXTURES = ['sky', 'CLIP', 'NULL', 'AAATRIGGER', 'ORIGIN', 'HINT', 'SKIP'];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const AMBIENTCG = process.env.AMBIENTCG ?? join(ROOT, '..', '_inbox', 'ambientcg');

async function toRgba(img: Sharp): Promise<Rgba> {
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, data: new Uint8Array(data) };
}

/** Ảnh ambientCG: resize về `size`, nhuộm màu (giữ độ sáng) và chỉnh sáng nếu cần. */
export function photo(id: string, size: number, opts: { tint?: RGB; bright?: number; sat?: number } = {}) {
  return async () => {
    const file = join(AMBIENTCG, id, `${id}_1K-JPG_Color.jpg`);
    if (!existsSync(file)) throw new Error(`thiếu ảnh ${file} (tải ambientCG ${id} 1K-JPG)`);
    let img = sharp(file).resize(size, size, { kernel: 'lanczos3' });
    if (opts.bright || opts.sat !== undefined) img = img.modulate({ brightness: opts.bright ?? 1, saturation: opts.sat ?? 1 });
    if (opts.tint) img = img.tint({ r: opts.tint[0], g: opts.tint[1], b: opts.tint[2] });
    return toRgba(img);
  };
}

export function svg(w: number, h: number, body: string) {
  return async () => toRgba(sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`)));
}

export const FONT = `font-family="Arial" font-weight="bold"`;

/** Biển hiệu chữ: nền màu, viền, chữ giữa. */
export function sign(text: string, bg: string, fg: string, w = 256, h = 64, size = 30) {
  return svg(w, h, `<rect width="${w}" height="${h}" fill="#333"/><rect x="3" y="3" width="${w - 6}" height="${h - 6}" fill="${bg}"/>
    <text x="${w / 2}" y="${h / 2 + size * 0.36}" ${FONT} font-size="${size}" fill="${fg}" text-anchor="middle">${text}</text>`);
}

const clock = svg(128, 128, `<rect width="128" height="128" fill="#e8dcc0"/><circle cx="64" cy="64" r="58" fill="#f7f3e8" stroke="#2b2b2b" stroke-width="5"/>
  ${Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    const r0 = i % 3 ? 48 : 42;
    return `<line x1="${64 + Math.sin(a) * r0}" y1="${64 - Math.cos(a) * r0}" x2="${64 + Math.sin(a) * 54}" y2="${64 - Math.cos(a) * 54}" stroke="#2b2b2b" stroke-width="${i % 3 ? 3 : 6}"/>`;
  }).join('')}
  <line x1="64" y1="64" x2="${64 - 26}" y2="${64 - 15}" stroke="#111" stroke-width="6" stroke-linecap="round"/>
  <line x1="64" y1="64" x2="${64 + 30}" y2="${64 - 30}" stroke="#111" stroke-width="4" stroke-linecap="round"/>
  <circle cx="64" cy="64" r="5" fill="#111"/>`);

/** Gạch bông: ô 32 px có hoa văn 4 cánh, lặp 4x4 trên 128 px. */
const gachBong = svg(128, 128, `<defs><pattern id="p" width="32" height="32" patternUnits="userSpaceOnUse">
  <rect width="32" height="32" fill="#e9dfc9"/><circle cx="0" cy="0" r="13" fill="#8a2f2a"/><circle cx="32" cy="0" r="13" fill="#8a2f2a"/>
  <circle cx="0" cy="32" r="13" fill="#8a2f2a"/><circle cx="32" cy="32" r="13" fill="#8a2f2a"/>
  <circle cx="16" cy="16" r="7" fill="#2f5d6b"/><rect x="15" y="0" width="2" height="32" fill="#c9b994"/><rect x="0" y="15" width="32" height="2" fill="#c9b994"/>
  <circle cx="16" cy="16" r="3" fill="#e9dfc9"/></pattern></defs><rect width="128" height="128" fill="url(#p)"/>
  <rect width="128" height="128" fill="none" stroke="#6b6152" stroke-width="1"/>`);

/** Cửa cuốn: gân ngang xám, vết bẩn, chữ dán "CHO THUÊ". */
const shutter = svg(128, 128, `<rect width="128" height="128" fill="#8d9296"/>
  ${Array.from({ length: 16 }, (_, i) => `<rect y="${i * 8}" width="128" height="3" fill="#6d7175"/><rect y="${i * 8 + 3}" width="128" height="1" fill="#b4b8bb"/>`).join('')}
  <rect x="0" y="120" width="128" height="8" fill="#55595c"/><rect x="40" y="52" width="48" height="18" fill="#f3f0e6"/>
  <text x="64" y="66" ${FONT} font-size="11" fill="#c0201a" text-anchor="middle">CHO THUÊ</text>`);

/** Bạt sọc xanh - trắng - đỏ kiểu bạt che chợ. */
const tarp = svg(128, 128, `${[['#1f5fa8', 0], ['#e9e9e2', 32], ['#b8322b', 64], ['#e9e9e2', 96]].map(([c, x]) => `<rect x="${x}" width="32" height="128" fill="${c}"/>`).join('')}
  <rect width="128" height="128" fill="#000" opacity="0.08"/>`);

/** Cuộn vải đứng thành hàng (khu vải). */
const fabric = (() => {
  const r = rng(11);
  const cols = ['#c0392b', '#8e44ad', '#2471a3', '#17a589', '#d4ac0d', '#e67e22', '#f1948a', '#5d6d7e', '#1e8449', '#f5f5dc'];
  return svg(128, 128, Array.from({ length: 8 }, (_, i) => {
    const c = cols[Math.floor(r() * cols.length)];
    return `<rect x="${i * 16}" width="16" height="128" fill="${c}"/><rect x="${i * 16 + 11}" width="5" height="128" fill="#000" opacity="0.25"/><rect x="${i * 16 + 2}" width="3" height="128" fill="#fff" opacity="0.2"/>`;
  }).join(''));
})();

/** Rổ trái cây nhìn từ trên: cam, xoài, thanh long, chuối. */
const fruit = (() => {
  const r = rng(5);
  const kinds = ['#f39c12', '#f4d03f', '#e74c3c', '#c0392b', '#58d68d', '#f5b041'];
  let body = '<rect width="128" height="128" fill="#7a5a2e"/>';
  for (let i = 0; i < 70; i++) {
    const x = r() * 128;
    const y = r() * 128;
    const c = kinds[Math.floor(r() * kinds.length)];
    body += `<circle cx="${x}" cy="${y}" r="${7 + r() * 5}" fill="${c}" stroke="#000" stroke-opacity="0.25"/>`;
  }
  return svg(128, 128, body);
})();

const cardboard = svg(64, 64, `<rect width="64" height="64" fill="#a8804f"/><rect y="28" width="64" height="8" fill="#c9a875"/>
  <rect x="0" y="0" width="64" height="64" fill="none" stroke="#7d5c33" stroke-width="2"/>
  <text x="32" y="20" ${FONT} font-size="9" fill="#5a3d1d" text-anchor="middle">HÀNG VN</text>`);

/** Cửa sổ nhà phố: khung xanh, song sắt, cánh chớp mở. */
const winTex = svg(64, 96, `<rect width="64" height="96" fill="#e3d9c3"/><rect x="8" y="8" width="48" height="80" fill="#1d2b33"/>
  <rect x="2" y="8" width="8" height="80" fill="#2e7d5b"/><rect x="54" y="8" width="8" height="80" fill="#2e7d5b"/>
  ${Array.from({ length: 5 }, (_, i) => `<rect x="${14 + i * 9}" y="8" width="2" height="80" fill="#9aa3a7"/>`).join('')}
  <rect x="8" y="46" width="48" height="2" fill="#9aa3a7"/><rect x="4" y="88" width="56" height="6" fill="#bfb39a"/>`);

/** Cửa sắt xếp (cửa kéo) mặt tiền nhà phố. */
const gate = svg(128, 128, `<rect width="128" height="128" fill="#2a2f33"/>
  ${Array.from({ length: 16 }, (_, i) => `<rect x="${i * 8 + 2}" width="3" height="128" fill="#7e8a90"/>`).join('')}
  ${Array.from({ length: 8 }, (_, i) => `<line x1="${i * 16}" y1="0" x2="${i * 16 + 16}" y2="128" stroke="#5c666b" stroke-width="2"/><line x1="${i * 16 + 16}" y1="0" x2="${i * 16}" y2="128" stroke="#5c666b" stroke-width="2"/>`).join('')}
  <rect y="0" width="128" height="6" fill="#444b50"/><rect y="122" width="128" height="6" fill="#444b50"/>`);

/** Lan can sắt (trong suốt): song đứng + 2 thanh ngang. */
const rail = svg(64, 64, `<rect y="2" width="64" height="5" fill="#3b4246"/><rect y="56" width="64" height="5" fill="#3b4246"/>
  ${Array.from({ length: 8 }, (_, i) => `<rect x="${i * 8 + 3}" y="2" width="3" height="59" fill="#4a5357"/>`).join('')}`);

/** Dây điện chằng chịt (trong suốt), vắt ngang phố. */
const wires = (() => {
  const r = rng(21);
  let body = '';
  for (let i = 0; i < 9; i++) {
    const y0 = 10 + r() * 100;
    const y1 = 10 + r() * 100;
    const sag = 10 + r() * 20;
    body += `<path d="M0 ${y0} Q128 ${(y0 + y1) / 2 + sag} 256 ${y1}" stroke="#141414" stroke-width="${1.5 + r() * 2}" fill="none"/>`;
  }
  return svg(256, 128, body);
})();

/** Gạch vỉa hè Sài Gòn: ô vuông đỏ gạch xen xám. */
function sidewalk(): Promise<Rgba> {
  const img = fill(blank(128, 128), [150, 92, 76], 0.18, 9);
  const r = rng(4);
  for (let ty = 0; ty < 4; ty++)
    for (let tx = 0; tx < 4; tx++) {
      if (r() < 0.35) {
        for (let y = ty * 32; y < ty * 32 + 32; y++)
          for (let x = tx * 32; x < tx * 32 + 32; x++) {
            const o = (y * 128 + x) * 4;
            img.data.set([128 + ((x * 7 + y * 13) % 9), 126, 120], o);
          }
      }
    }
  tiles(img, 32, 32, 2, [90, 80, 74]);
  return Promise.resolve(img);
}

function grass(): Promise<Rgba> {
  const img = fill(blank(64, 64), [70, 120, 50], 0.45, 13);
  const r = rng(8);
  for (let i = 0; i < 30; i++) {
    const o = (Math.floor(r() * 64) * 64 + Math.floor(r() * 64)) * 4;
    img.data.set(r() < 0.5 ? [220, 60, 80] : [240, 200, 60], o);
  }
  return Promise.resolve(img);
}

/** Thân xe đẩy bán hàng: nền sơn, viền, chữ to + dòng nhỏ. */
function cartPanel(big: string, small: string, bg: string, fg: string, accent: string) {
  return svg(128, 64, `<rect width="128" height="64" fill="${bg}"/><rect x="3" y="3" width="122" height="58" fill="none" stroke="${accent}" stroke-width="3"/>
    <text x="64" y="32" ${FONT} font-size="21" fill="${fg}" text-anchor="middle">${big}</text>
    <text x="64" y="51" ${FONT} font-size="9" fill="${accent}" text-anchor="middle">${small}</text>`);
}

/** Tủ kính xe hàng (trong suốt): khung nhôm, kính trống, trong có món ăn treo. */
function glassCabinet(items: string) {
  return svg(64, 64, `<rect x="0" y="0" width="64" height="4" fill="#c9ced2"/><rect x="0" y="60" width="64" height="4" fill="#c9ced2"/>
    <rect x="0" y="0" width="4" height="64" fill="#c9ced2"/><rect x="60" y="0" width="4" height="64" fill="#c9ced2"/><rect x="30" y="0" width="4" height="64" fill="#c9ced2"/>${items}`);
}
const noodles = Array.from({ length: 6 }, (_, i) => `<path d="M${8 + i * 4} 8 q3 20 -2 44" stroke="#f3e2a0" stroke-width="2" fill="none"/>`).join('') +
  `<rect x="38" y="30" width="18" height="10" rx="4" fill="#d98a6a"/><rect x="40" y="44" width="14" height="10" rx="3" fill="#e8d7b0"/>`;
const breads = Array.from({ length: 4 }, (_, i) => `<ellipse cx="${16 + (i % 2) * 30}" cy="${20 + Math.floor(i / 2) * 22}" rx="12" ry="6" fill="#d9a35b" stroke="#a8702e"/>`).join('');

/** Rổ, thúng tre đan. */
const bamboo = svg(64, 64, `<rect width="64" height="64" fill="#b8925a"/>
  ${Array.from({ length: 8 }, (_, i) => `<rect y="${i * 8}" width="64" height="4" fill="#9c7642"/>`).join('')}
  ${Array.from({ length: 16 }, (_, i) => `<rect x="${i * 4}" y="${(i % 2) * 4}" width="2" height="64" fill="#d4b37a" opacity="0.6"/>`).join('')}`);

/** Lá nón: nền kem, gân chạy dọc theo sườn nón. */
const nonLa = svg(64, 64, `<rect width="64" height="64" fill="#e8dcb4"/>
  ${Array.from({ length: 8 }, (_, i) => `<rect x="${i * 8 + 3}" width="1" height="64" fill="#c8b98a"/>`).join('')}
  ${Array.from({ length: 4 }, (_, i) => `<rect y="${i * 16 + 7}" width="64" height="1" fill="#bba872"/>`).join('')}`);

const umbrella = svg(64, 64, `${Array.from({ length: 4 }, (_, i) => `<rect x="${i * 16}" width="8" height="64" fill="#c62828"/><rect x="${i * 16 + 8}" width="8" height="64" fill="#f5f0e1"/>`).join('')}`);

const veg = (() => {
  const r = rng(17);
  let body = '<rect width="64" height="64" fill="#3f7d2c"/>';
  for (let i = 0; i < 40; i++) {
    const c = ['#5fa83a', '#2e6b22', '#7cc04b', '#e67e22', '#c0392b'][Math.floor(r() * 5)];
    body += `<ellipse cx="${r() * 64}" cy="${r() * 64}" rx="${3 + r() * 6}" ry="${2 + r() * 4}" fill="${c}"/>`;
  }
  return svg(64, 64, body);
})();

/** Quảng cáo dán cột điện: 3 tờ chồng nhau, số điện thoại giả rõ ràng (0123.456.789). */
const poleAds = svg(64, 128, `<rect width="64" height="128" fill="#a7a49c"/>
  <rect x="2" y="4" width="60" height="44" fill="#fdfdf8" transform="rotate(-2 32 26)"/>
  <text x="32" y="20" ${FONT} font-size="10" fill="#c62828" text-anchor="middle">RÚT HẦM</text>
  <text x="32" y="33" ${FONT} font-size="10" fill="#c62828" text-anchor="middle">CẦU</text>
  <text x="32" y="44" ${FONT} font-size="7" fill="#1a237e" text-anchor="middle">0123.456.789</text>
  <rect x="4" y="54" width="56" height="36" fill="#fff176" transform="rotate(3 32 72)"/>
  <text x="32" y="68" ${FONT} font-size="8" fill="#0d47a1" text-anchor="middle">KHOAN CẮT</text>
  <text x="32" y="79" ${FONT} font-size="8" fill="#0d47a1" text-anchor="middle">BÊ TÔNG</text>
  <rect x="3" y="96" width="58" height="28" fill="#fdfdf8"/>
  <text x="32" y="108" ${FONT} font-size="7" fill="#2e7d32" text-anchor="middle">SỬA ỐNG NƯỚC</text>
  <text x="32" y="119" ${FONT} font-size="7" fill="#c62828" text-anchor="middle">0123.456.789</text>`);

/** Bảng số nhà xanh dương chữ trắng: atlas 4x2 ô 32x32, plate chọn ô bằng offset texture. */
export const HOUSE_NUMBERS = ['12', '34', '56', '78', '102', '45/3', '27', '9A'];
const houseNumbers = svg(128, 64, HOUSE_NUMBERS.map((n, i) => {
  const x = (i % 4) * 32;
  const y = Math.floor(i / 4) * 32;
  return `<rect x="${x}" y="${y}" width="32" height="32" fill="#f5f5f5"/><rect x="${x + 2}" y="${y + 2}" width="28" height="28" fill="#1565c0"/>
    <text x="${x + 16}" y="${y + 13}" ${FONT} font-size="6" fill="#fff" text-anchor="middle">SỐ NHÀ</text>
    <text x="${x + 16}" y="${y + 26}" ${FONT} font-size="${n.length > 3 ? 9 : 12}" fill="#fff" text-anchor="middle">${n}</text>`;
}).join(''));

const mailbox = svg(32, 32, `<rect width="32" height="32" fill="#c62828"/><rect x="4" y="6" width="24" height="4" fill="#3a0d0d"/>
  <text x="16" y="25" ${FONT} font-size="10" fill="#ffeb3b" text-anchor="middle">THƯ</text>`);

/** Biển cấm đậu xe: tròn xanh viền đỏ gạch chéo + chữ. */
const noParking = svg(64, 64, `<rect width="64" height="64" fill="#f5f5f5"/>
  <circle cx="32" cy="26" r="20" fill="#1565c0" stroke="#d32f2f" stroke-width="5"/><line x1="18" y1="12" x2="46" y2="40" stroke="#d32f2f" stroke-width="5"/>
  <text x="32" y="60" ${FONT} font-size="10" fill="#d32f2f" text-anchor="middle">CẤM ĐẬU XE</text>`);

/** Chữ "CẤM ĐẬU XE" xịt sơn lên cửa sắt (trong suốt). */
const noParkingPaint = svg(128, 32, `<text x="64" y="24" ${FONT} font-size="20" fill="#e53935" text-anchor="middle" transform="rotate(-3 64 16)">CẤM ĐẬU XE</text>`);

/** Hoa giấy rủ (trong suốt): chùm hoa hồng tím + lá xanh. */
const hoaGiay = (() => {
  const r = rng(29);
  let body = '';
  for (let i = 0; i < 60; i++) {
    const x = r() * 128;
    const y = Math.pow(r(), 1.6) * 60; // dày ở trên, thưa dần xuống dưới
    body += `<ellipse cx="${x}" cy="${y}" rx="${4 + r() * 4}" ry="${3 + r() * 3}" fill="${r() < 0.35 ? '#2e7d32' : ['#d81b60', '#c2185b', '#e91e63', '#ad1457'][Math.floor(r() * 4)]}"/>`;
  }
  return svg(128, 64, body);
})();

const sack = svg(32, 32, `<rect width="32" height="32" fill="#d8cfb2"/>
  ${Array.from({ length: 8 }, (_, i) => `<rect y="${i * 4}" width="32" height="1" fill="#bfb390"/><rect x="${i * 4}" width="1" height="32" fill="#c8bd9c"/>`).join('')}
  <rect x="6" y="10" width="20" height="10" fill="none" stroke="#2e7d32" stroke-width="1.5"/>`);

const cottonCandy = Array.from({ length: 6 }, (_, i) => `<ellipse cx="${12 + (i % 3) * 18}" cy="${18 + Math.floor(i / 3) * 24}" rx="8" ry="10" fill="${i % 2 ? '#f8bbd0' : '#b3e5fc'}"/>`).join('');
const coffeeCups = Array.from({ length: 6 }, (_, i) => `<rect x="${7 + (i % 3) * 18}" y="${14 + Math.floor(i / 3) * 24}" width="12" height="14" fill="#efe6d8" opacity="0.9"/><rect x="${7 + (i % 3) * 18}" y="${20 + Math.floor(i / 3) * 24}" width="12" height="8" fill="#4e342e"/>`).join('');

export const TEXTURES: TexDef[] = [
  // Ảnh CC0 ambientCG
  { name: 'bt_wall', scale: 1, make: photo('Plaster007', 256, { tint: [236, 214, 150], bright: 1.15 }) },
  { name: 'bt_trim', scale: 1, make: photo('Concrete034', 128, { tint: [240, 232, 214], bright: 1.2 }) },
  { name: 'bt_curb', scale: 1, make: photo('Concrete034', 128, { bright: 0.75 }) },
  { name: 'bt_house_pk', scale: 1, make: photo('PaintedPlaster017', 256, { tint: [236, 170, 160] }) },
  { name: 'bt_house_bl', scale: 1, make: photo('PaintedPlaster017', 256, { tint: [150, 196, 214] }) },
  { name: 'bt_house_gr', scale: 1, make: photo('PaintedPlaster017', 256, { tint: [178, 210, 150] }) },
  { name: 'bt_house_yl', scale: 1, make: photo('PaintedPlaster017', 256, { tint: [240, 210, 120] }) },
  { name: 'bt_terrazzo', scale: 1, make: photo('Terrazzo013', 256, { bright: 0.95 }) },
  { name: 'bt_road', scale: 1.5, make: photo('Road007', 256) },
  { name: 'bt_roof', scale: 1.5, make: photo('RoofingTiles014B', 256) },
  { name: 'bt_tin', scale: 2, make: photo('CorrugatedSteel006A', 128) },
  { name: 'bt_wood', scale: 0.75, make: photo('Planks037A', 128) },
  { name: 'bt_rust', scale: 0.5, make: photo('Metal053B', 128) },
  { name: 'bt_bronze', scale: 0.5, make: photo('Metal053B', 128, { tint: [90, 110, 80], bright: 0.8 }) },
  // Vẽ bằng code
  { name: 'bt_sidewalk', scale: 1, make: sidewalk },
  { name: 'bt_grass', scale: 1, make: grass },
  { name: 'bt_gachbong', scale: 0.5, make: gachBong },
  { name: 'bt_shutter', scale: 1, make: shutter },
  { name: 'bt_tarp', scale: 1, make: tarp },
  { name: 'bt_fabric', scale: 0.75, make: fabric },
  { name: 'bt_fruit', scale: 0.5, make: fruit },
  { name: 'bt_cardboard', scale: 0.5, make: cardboard },
  { name: 'bt_window', scale: 1, make: winTex },
  { name: 'bt_gate', scale: 1, make: gate },
  { name: 'bt_clock', scale: 1, make: clock },
  { name: 'bt_sign_main', scale: 1.5, make: sign('CHỢ BẾN THÀNH', '#f2e6c8', '#b3261e', 256, 64, 26) },
  { name: 'bt_sign_pho', scale: 0.75, make: sign('PHỞ BÒ', '#c0392b', '#fff4d6', 128, 32, 18) },
  { name: 'bt_sign_com', scale: 0.75, make: sign('CƠM TẤM', '#f1c40f', '#7b241c', 128, 32, 18) },
  { name: 'bt_sign_vai', scale: 0.75, make: sign('VẢI - LỤA', '#1f618d', '#fdfefe', 128, 32, 18) },
  { name: 'bt_sign_trai', scale: 0.75, make: sign('TRÁI CÂY', '#1e8449', '#fdfefe', 128, 32, 18) },
  { name: 'bt_sign_cafe', scale: 0.75, make: sign('CÀ PHÊ', '#4e342e', '#ffe0b2', 128, 32, 18) },
  { name: 'bt_sign_banhmi', scale: 0.75, make: sign('BÁNH MÌ', '#e67e22', '#ffffff', 128, 32, 18) },
  { name: 'bt_sign_suaxe', scale: 0.75, make: sign('SỬA XE', '#2c3e50', '#f4d03f', 128, 32, 18) },
  { name: 'bt_sign_taphoa', scale: 0.75, make: sign('TẠP HÓA', '#7d3c98', '#ffffff', 128, 32, 18) },
  // Đồ vật đường phố
  { name: 'bt_cart_ht', scale: 0.75, make: cartPanel('HỦ TIẾU', 'NAM VANG - HOÀNH THÁNH', '#1f4e8c', '#ffd54f', '#ffffff') },
  { name: 'bt_cart_bm', scale: 0.75, make: cartPanel('BÁNH MÌ', 'PATE - CHẢ LỤA', '#f1c40f', '#b71c1c', '#6d4c41') },
  { name: 'bt_cart_nm', scale: 0.75, make: cartPanel('NƯỚC MÍA', 'SIÊU SẠCH - 10K', '#2e7d32', '#ffffff', '#ffeb3b') },
  { name: '{bt_glass_ht', scale: 0.75, make: glassCabinet(noodles) },
  { name: '{bt_glass_bm', scale: 0.75, make: glassCabinet(breads) },
  { name: 'bt_steel', scale: 0.5, make: async () => fill(blank(32, 32), [196, 200, 204], 0.12, 31) },
  { name: 'bt_tire', scale: 0.5, make: async () => fill(blank(32, 32), [34, 34, 36], 0.25, 32) },
  { name: 'bt_plastic_r', scale: 0.5, make: async () => fill(blank(32, 32), [200, 40, 40], 0.08, 33) },
  { name: 'bt_plastic_b', scale: 0.5, make: async () => fill(blank(32, 32), [40, 90, 190], 0.08, 34) },
  { name: 'bt_bamboo', scale: 0.5, make: bamboo },
  { name: 'bt_nonla', scale: 0.5, make: nonLa },
  { name: 'bt_umbrella', scale: 1, make: umbrella },
  { name: 'bt_veg', scale: 0.5, make: veg },
  { name: 'bt_cart_kb', scale: 0.75, make: cartPanel('KẸO BÔNG', 'GÒN - 5K MỘT BỊCH', '#f48fb1', '#ffffff', '#6a1b9a') },
  { name: 'bt_cart_cf', scale: 0.75, make: cartPanel('CÀ PHÊ', 'SỮA ĐÁ - ĐEN ĐÁ', '#4e342e', '#ffe0b2', '#ffb74d') },
  { name: '{bt_glass_kb', scale: 0.75, make: glassCabinet(cottonCandy) },
  { name: '{bt_glass_cf', scale: 0.75, make: glassCabinet(coffeeCups) },
  { name: 'bt_sign_giuxe', scale: 0.5, make: sign('GIỮ XE 5K', '#ffeb3b', '#c62828', 128, 32, 18) },
  { name: 'bt_pole_ads', scale: 0.25, make: poleAds },
  { name: 'bt_sonha', scale: 0.5, make: houseNumbers },
  { name: 'bt_mailbox', scale: 0.5, make: mailbox },
  { name: 'bt_noparking', scale: 0.375, make: noParking },
  { name: '{bt_noparkpaint', scale: 0.75, make: noParkingPaint },
  { name: '{bt_hoagiay', scale: 0.75, make: hoaGiay },
  { name: 'bt_sack', scale: 0.5, make: sack },
  { name: '{bt_rail', scale: 0.75, make: rail },
  { name: '{bt_wires', scale: 1.5, make: wires },
];
