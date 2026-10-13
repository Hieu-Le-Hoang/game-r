// Tiện ích DOM dùng chung cho UI
import { ELEM } from '../core/data/elements.js';
import { AFFIX, RARITY, SLOT_NAME, WEAPON_KIND, CONSUMABLE, sellPrice, activeHidden, KICH_SRC, canEquip } from '../core/items.js';
import { fmt } from '../core/util.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let ICON = { size: 40, cols: 8 };
export const setIconMeta = (m) => { ICON = m; };
export function iconStyle(id, size = 40) {
  const k = size / ICON.size;
  const x = (id % ICON.cols) * size, y = Math.floor(id / ICON.cols) * size;
  return `background-image:url(./a/icons.webp);background-size:${ICON.cols * size}px auto;background-position:-${x}px -${y}px;width:${size}px;height:${size}px`;
}
export const iconHtml = (id, size = 40, extra = '') => `<span class="ic" style="${iconStyle(id, size)}${extra}"></span>`;

/** Ô chứa 1 món (túi / trang bị / rương / cửa hàng) */
export function cellHtml(it, o = {}) {
  if (!it) return `<div class="cell"${o.attrs || ''}>${o.label ? `<span class="slot-name">${o.label}</span>` : ''}</div>`;
  const cls = ['cell'];
  if (!it.stack && it.rarity !== 'white') cls.push('it-' + it.rarity);
  if (o.kich) cls.push('kich');
  if (o.bad) cls.push('bad');
  return `<div class="${cls.join(' ')}" data-uid="${it.uid}"${o.attrs || ''}>${iconHtml(it.icon, o.size || 40)}${it.stack ? `<em>${it.qty}</em>` : `<i class="elem" style="background:${ELEM[it.elem].color}"></i>`}</div>`;
}

/** Tooltip trang bị: dòng ẩn xám khi chưa kích, xanh khi kích (theo đồ đang mặc) */
export function itemTip(it, ch, o = {}) {
  if (it.stack) {
    const C = CONSUMABLE[it.id];
    return `<div class="t-name">${esc(it.name)}</div><div class="t-sub">${C.hp ? `Hồi ${C.hp} sinh lực` : C.mp ? `Hồi ${C.mp} nội lực` : esc(C.desc || '')}</div>${o.price != null ? `<div class="t-price">Giá: ${fmt(o.price)} lượng</div>` : ''}<div class="t-price">${o.sell ? `Bán: ${fmt(sellPrice(it))} lượng` : ''}</div>`;
  }
  const on = o.slot ? activeHidden(ch.eq).has(o.slot) : false;
  const R = RARITY[it.rarity];
  let h = `<div class="t-name" style="color:${R.color}">${esc(it.name)}</div>`;
  const kind = it.base === 'weapon' ? WEAPON_KIND[it.kind].name : SLOT_NAME[it.slot];
  h += `<div class="t-sub">${kind} · ${R.name} · Ngũ hành <b style="color:${ELEM[it.elem].color}">${ELEM[it.elem].name}</b></div>`;
  if (it.atk) h += `<div class="t-line">Sát thương: ${it.atk[0]} - ${it.atk[1]}</div>`;
  if (it.def) h += `<div class="t-line">Phòng thủ: ${it.def}</div>`;
  for (const l of it.lines) {
    const A = AFFIX[l.k];
    const txt = `${A.name} +${l.v}${A.pct ? '%' : ''}`;
    if (!l.hidden) h += `<div class="t-line">${txt}</div>`;
    else h += `<div class="t-line ${on ? 'on' : 'hid'}">${on ? '◆' : '◇'} ${txt}${on ? '' : ' (ẩn)'}</div>`;
  }
  if (it.lines.some((l) => l.hidden) && !on) {
    const src = o.slot ? KICH_SRC[o.slot] : KICH_SRC[it.slot];
    h += `<div class="t-sub" style="margin-top:4px">Kích ẩn: ${SLOT_NAME[src]} phải có ngũ hành sinh ra ${ELEM[it.elem].name}</div>`;
  }
  if (it.set) h += `<div class="t-sub" style="color:var(--r-gold)">Bộ Hoàng Kim — mặc 2/3/4 món nhận thêm thuộc tính</div>`;
  const why = canEquip(it, ch);
  h += `<div class="t-req ${why ? 'bad' : ''}">Yêu cầu cấp ${it.lvReq}${why ? ` · ${esc(why)}` : ''}</div>`;
  if (o.price != null) h += `<div class="t-price">Giá: ${fmt(o.price)} lượng</div>`;
  if (o.sell) h += `<div class="t-price">Bán: ${fmt(sellPrice(it))} lượng</div>`;
  return h;
}

const tipEl = () => $('#tip');
export function showTip(html, x, y) {
  const t = tipEl();
  t.innerHTML = html;
  t.className = 'frame';
  t.hidden = false;
  const r = t.getBoundingClientRect();
  t.style.left = Math.min(innerWidth - r.width - 8, x + 16) + 'px';
  t.style.top = Math.min(innerHeight - r.height - 8, y + 12) + 'px';
}
export const hideTip = () => { tipEl().hidden = true; };
