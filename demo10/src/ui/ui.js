// HUD (khung nhân vật, mục tiêu, bản đồ nhỏ, log, dock skill/thuốc/auto), màn chọn nhân vật, phím tắt.
import { $, $$, esc, iconStyle, hideTip } from './common.js';
import { Panels } from './panels.js';
import { ELEM, ELEMS } from '../core/data/elements.js';
import { PHAI } from '../core/data/phai.js';
import { MAPS } from '../core/data/world.js';
import { MONSTERS } from '../core/data/monsters.js';
import { phaiOf, xpNeed, skillLv } from '../core/char.js';
import { CONSUMABLE } from '../core/items.js';
import * as Q from '../core/quests.js';
import { fmt } from '../core/util.js';

export class UI {
  constructor(app) {
    this.app = app;
    this.panels = new Panels(app);
    this.altDown = false;
    this.hudT = 0;
    this.miniT = 0;
    this.logN = 0;
    this.hovered = null;
    this.keys();
  }
  get g() { return this.app.game; }

  loading(text, k) {
    const el = $('#loading');
    if (text == null) { el.hidden = true; return; }
    el.hidden = false;
    $('#ld-txt').textContent = text;
    if (k != null) $('#ld-fill').style.width = Math.round(k * 100) + '%';
  }

  // ---------- màn chọn / tạo nhân vật ----------
  title(slots, onPlay, onCreate, onDelete) {
    $('#title').hidden = false;
    $('#hud').hidden = true;
    const box = $('#slots');
    box.hidden = false;
    $('#create').hidden = true;
    box.innerHTML = slots.map((c, i) => c ? `
      <div class="slotcard frame">
        <img src="./a/portraits/${c.gender === 'f' ? 'female02' : 'male03'}.webp" alt="">
        <b>${esc(c.name)}</b>
        <span>Cấp ${c.lv} · ${c.phai ? PHAI[c.phai].name : 'Tân thủ'} · <span style="color:${ELEM[c.elem].color}">${ELEM[c.elem].name}</span></span>
        <span class="muted">${MAPS[c.map]?.name || ''} · ${Math.round((c.played || 0) / 60)} phút</span>
        <div class="row"><button class="btn" data-play="${i}">Vào game</button><button class="btn small danger" data-del="${i}" title="Xóa nhân vật">✕</button></div>
      </div>` : `<div class="slotcard frame"><span class="muted">Ô trống</span><button class="btn" data-new="${i}">Tạo nhân vật</button></div>`).join('');
    for (const b of $$('[data-play]', box)) b.onclick = () => onPlay(+b.dataset.play);
    for (const b of $$('[data-del]', box)) b.onclick = () => { if (confirm(`Xóa nhân vật "${slots[+b.dataset.del].name}"? Không khôi phục được.`)) onDelete(+b.dataset.del); };
    for (const b of $$('[data-new]', box)) b.onclick = () => this.createForm(+b.dataset.new, onCreate);
  }
  createForm(slot, onCreate) {
    $('#slots').hidden = true;
    const el = $('#create');
    el.hidden = false;
    el.className = 'frame';
    const st = { gender: 'm', elem: 'kim', name: '' };
    const draw = () => {
      const phai = Object.entries(PHAI).find(([, P]) => P.elem === st.elem);
      const genderOk = (e) => !((e === 'kim' && st.gender === 'f') || (e === 'thuy' && st.gender === 'm'));
      el.innerHTML = `<h2>Tạo nhân vật</h2>
        <label>Tên nhân vật</label><input id="cn" maxlength="14" value="${esc(st.name)}" placeholder="VD: Tiêu Phong">
        <label>Giới tính</label><div class="pick">${[['m', 'Nam'], ['f', 'Nữ']].map(([k, l]) => `<button data-g="${k}" class="${st.gender === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <label>Ngũ hành (Kim chỉ cho nam, Thủy chỉ cho nữ)</label>
        <div class="pick">${ELEMS.map((e) => `<button data-e="${e}" class="${st.elem === e ? 'on' : ''}" ${genderOk(e) ? '' : 'disabled'} style="color:${ELEM[e].color}">${ELEM[e].name}</button>`).join('')}</div>
        <div class="phai-desc">Cấp 10 bái sư <b style="color:var(--gold)">${phai[1].name}</b> — ${phai[1].desc}<br><span class="muted">Khởi đầu ở Ba Lăng Huyện. Gặp Lý Bộ Đầu nhận nhiệm vụ tân thủ.</span></div>
        <div class="create-acts"><button class="btn" id="c-back">Quay lại</button><button class="btn" id="c-ok">Vào giang hồ</button></div>`;
      $('#cn', el).oninput = (e) => { st.name = e.target.value; };
      for (const b of $$('[data-g]', el)) b.onclick = () => { st.gender = b.dataset.g; if (!genderOk(st.elem)) st.elem = st.gender === 'm' ? 'kim' : 'thuy'; draw(); };
      for (const b of $$('[data-e]', el)) b.onclick = () => { st.elem = b.dataset.e; draw(); };
      $('#c-back', el).onclick = () => { el.hidden = true; $('#slots').hidden = false; };
      $('#c-ok', el).onclick = () => {
        const name = st.name.trim() || (st.gender === 'm' ? 'Thiếu Hiệp' : 'Nữ Hiệp');
        onCreate(slot, { name, gender: st.gender, elem: st.elem });
      };
    };
    draw();
  }

  startGame() {
    $('#title').hidden = true;
    $('#hud').hidden = false;
    this.refreshAll();
  }

  // ---------- HUD ----------
  refreshAll() { this.hud(true); this.panels.refresh(); }
  hud(force) {
    const g = this.g, w = g.world, ch = g.ch, p = w.p, st = w.st;
    $('#hp-fill').style.width = (p.hp / st.maxHp * 100) + '%';
    $('#hp-txt').textContent = `${fmt(Math.max(0, p.hp))} / ${fmt(st.maxHp)}`;
    $('#mp-fill').style.width = (p.mp / st.maxMp * 100) + '%';
    $('#mp-txt').textContent = `${fmt(p.mp)} / ${fmt(st.maxMp)}`;
    const xpPct = ch.lv >= 60 ? 100 : ch.xp / xpNeed(ch.lv) * 100;
    $('#xp-fill').style.width = xpPct + '%';
    $('#xp-txt').textContent = ch.lv >= 60 ? 'Cấp tối đa' : `${xpPct.toFixed(1)}%`;
    const pos = `${Math.floor(p.x)},${Math.floor(p.y)}`;
    if ($('#map-pos').textContent !== pos) $('#map-pos').textContent = pos;
    // dock
    const P = phaiOf(ch);
    const skL = P.skills.find((s) => s.id === ch.keys.left) || P.skills[0];
    const skR = P.skills.find((s) => s.id === ch.keys.right) || P.skills[0];
    const setSk = (el, s) => {
      const ic = el.querySelector('.ic');
      const style = iconStyle(s.icon);
      if (ic.dataset.s !== style) { ic.setAttribute('style', style); ic.dataset.s = style; }
      el.title = `${s.name} (cấp ${skillLv(ch, s.id)})`;
      el.classList.toggle('off', !!w.canUse(s) && w.canUse(s) !== 'Đang hồi');
      const cd = el.querySelector('.cd');
      if (cd) { const left = (p.cds[s.id] || 0) - w.t; cd.style.setProperty('--p', left > 0 ? (left / (s.cd || 1) * 100) + '%' : '0%'); }
    };
    setSk($('#sk-left'), skL);
    setSk($('#sk-right'), skR);
    const pot = (el, ids) => {
      const id = ids.find((x) => w.invCount(x) > 0) || ids[ids.length - 1];
      const ic = el.querySelector('.ic'), style = iconStyle(CONSUMABLE[id].icon);
      if (ic.dataset.s !== style) { ic.setAttribute('style', style); ic.dataset.s = style; }
      const n = ids.reduce((a, x) => a + w.invCount(x), 0);
      el.querySelector('em').textContent = n;
      el.classList.toggle('off', n === 0);
    };
    pot($('#pot-1'), ['hp3', 'hp2', 'hp1']);
    pot($('#pot-2'), ['mp3', 'mp2', 'mp1']);
    pot($('#pot-3'), ['tdp']);
    $('#b-auto').classList.toggle('on', g.auto.on);
    $('#skill-dot').hidden = !(ch.skillPts > 0 && ch.phai) && !(ch.free > 0 && !ch.auto.alloc);
    // buff
    const bf = Object.entries(p.buffs).map(([id, b]) => `<div class="bf" title="${esc(b.name)}" style="${iconStyle(b.icon, 26)}"><em>${Math.ceil(b.until - w.t)}</em></div>`).join('');
    if ($('#buffs').innerHTML !== bf) $('#buffs').innerHTML = bf;
    // mục tiêu
    const tg = this.hovered || (p.goal?.type === 'attack' ? w.monById(p.goal.id) : null);
    const tEl = $('#target');
    if (tg && !tg.dead) {
      tEl.hidden = false;
      const D = MONSTERS[tg.type];
      $('#tg-name').innerHTML = `<span style="color:${D.boss ? 'var(--r-gold)' : ELEM[D.elem].color}">${esc(D.name)}</span> <span class="muted">cấp ${tg.lv} · ${ELEM[D.elem].name}</span>`;
      $('#tg-fill').style.width = (tg.hp / tg.st.maxHp * 100) + '%';
      $('#tg-txt').textContent = `${fmt(tg.hp)} / ${fmt(tg.st.maxHp)}`;
    } else tEl.hidden = true;
    // theo dõi nhiệm vụ
    if (force || this.hudT++ % 10 === 0) {
      const tr = Q.active(ch).map((id) => `<p><b>${esc(Q.QUESTS[id].name)}</b>${Q.ready(ch, id) ? '<span style="color:var(--good)">Đã xong — về trả nhiệm vụ</span>' : esc(Q.progressText(ch, id))}</p>`).join('');
      const hint = !Q.active(ch).length && !ch.phai && ch.lv < 10 && !ch.quests.t1 ? '<p><b>Gợi ý</b>Gặp Lý Bộ Đầu ở Ba Lăng Huyện</p>' : '';
      const html = tr + hint;
      if ($('#track').innerHTML !== html) $('#track').innerHTML = html;
    }
  }
  me() {
    const ch = this.g.ch;
    $('#me-face').src = `./a/portraits/${ch.gender === 'f' ? 'female02' : 'male03'}.webp`;
    $('#me-name').textContent = ch.name;
    $('#me-lv').textContent = `Cấp ${ch.lv}`;
    $('#me-sub').innerHTML = `${ch.phai ? PHAI[ch.phai].name : 'Tân thủ'} · <span style="color:${ELEM[ch.elem].color}">${ELEM[ch.elem].name}</span> · ${fmt(ch.money)} lượng`;
  }
  hoverMon(m) { this.hovered = m; }

  log(text, kind = '') {
    const el = $('#log-list');
    const p = document.createElement('p');
    if (kind) p.className = kind;
    p.textContent = text;
    el.appendChild(p);
    while (el.children.length > 40) el.firstChild.remove();
  }
  toast(text) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 2700);
  }
  banner(text, sub = '') {
    const b = $('#banner');
    b.innerHTML = `${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
    b.classList.add('on');
    clearTimeout(this._bn);
    this._bn = setTimeout(() => b.classList.remove('on'), 2400);
  }

  // ---------- bản đồ nhỏ ----------
  mapCanvas(w) {
    // nền: ô đi được, vẽ 1 lần mỗi map (xoay isometric cho giống góc nhìn)
    const M = w.map, c = document.createElement('canvas');
    const s = 3;
    c.width = (M.w + M.h) * s; c.height = (M.w + M.h) * s / 2;
    const x = c.getContext('2d');
    x.fillStyle = MAPS[w.id].town ? '#5a4a2a' : '#3a4a2a';
    for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) {
      if (!w.grid.reach?.[j * M.w + i]) continue;
      const px = (i - j + M.h) * s, py = (i + j) * s / 2;
      x.fillRect(px - s / 2, py, s * 1.4, s * 0.8);
    }
    this.mapBg = { c, s, w };
    $('#map-name').textContent = MAPS[w.id].name;
  }
  drawMini(full = false) {
    const g = this.g, w = g.world;
    if (!this.mapBg || this.mapBg.w !== w) this.mapCanvas(w);
    const { c, s } = this.mapBg, M = w.map;
    const cv = full ? $('#bm-c') : $('#mini-c');
    if (full) { cv.width = Math.min(innerWidth - 80, c.width); cv.height = Math.min(innerHeight - 120, c.height); }
    const x = cv.getContext('2d');
    const P = (o) => [(o.x - o.y + M.h) * s, (o.x + o.y) * s / 2];
    const [px, py] = P(w.p);
    const ox = full ? (cv.width - c.width) / 2 : cv.width / 2 - px, oy = full ? (cv.height - c.height) / 2 : cv.height / 2 - py;
    x.fillStyle = '#050403'; x.fillRect(0, 0, cv.width, cv.height);
    x.drawImage(c, ox, oy);
    const dot = (o, col, r) => { const [a, b] = P(o); x.fillStyle = col; x.fillRect(a + ox - r, b + oy - r, r * 2, r * 2); };
    for (const m of w.mons) if (!m.dead) dot(m, m.def.boss ? '#ffb020' : '#e04030', m.def.boss ? 3 : 1.5);
    for (const n of w.npcs) dot(n, '#f2d64b', 2.5);
    for (const e of w.exits) dot(e, '#7cc8ff', 3);
    if (g.auto.on && g.auto.anchor) {
      const [a, b] = P(g.auto.anchor);
      x.strokeStyle = 'rgba(123,224,123,.6)'; x.beginPath();
      x.ellipse(a + ox, b + oy, g.ch.auto.radius * s * 1.41, g.ch.auto.radius * s * 0.71, 0, 0, Math.PI * 2); x.stroke();
    }
    dot(w.p, '#ffffff', 2.5);
  }

  frame(dt) {
    this.miniT -= dt;
    if (this.miniT <= 0) {
      this.miniT = 0.25;
      this.drawMini();
      if (!$('#bigmap').hidden) this.drawMini(true);
      this.me();
      if (this.panels.isOpen('char') || this.panels.isOpen('inv')) { /* bảng tĩnh — chỉ dựng lại khi có thay đổi */ }
    }
    this.hud();
  }

  // ---------- phím ----------
  keys() {
    const map = { F3: 'char', KeyC: 'char', F4: 'inv', KeyI: 'inv', F5: 'skills', KeyK: 'skills', KeyQ: 'quests', F11: 'quests' };
    addEventListener('keydown', (e) => {
      if (!this.app.game || $('#hud').hidden || e.target.tagName === 'INPUT') return;
      if (e.key === 'Alt') { this.altDown = true; e.preventDefault(); return; }
      if (map[e.code]) { e.preventDefault(); this.panels.toggle(map[e.code]); return; }
      if (e.code === 'Escape') { e.preventDefault(); if (!$('#bigmap').hidden) $('#bigmap').hidden = true; else if (!this.panels.closeTop()) this.panels.toggle('menu'); return; }
      if (e.code === 'Tab') { e.preventDefault(); $('#bigmap').hidden = !$('#bigmap').hidden; $('#bm-name').textContent = MAPS[this.g.world.id].name; this.drawMini(true); return; }
      if (e.code === 'KeyZ') { this.app.toggleAuto(); return; }
      if (e.code === 'KeyV') { this.g.world.toggleSit(); return; }
      if (e.code === 'Digit1') { this.g.world.drink('hp'); return; }
      if (e.code === 'Digit2') { this.g.world.drink('mp'); return; }
      if (e.code === 'Digit3') { this.app.useTdp(); return; }
      if (e.code === 'Space') { e.preventDefault(); this.app.pickNearest(); return; }
      if (e.code === 'F1') { e.preventDefault(); this.panels.toggle('menu'); }
    });
    addEventListener('keyup', (e) => { if (e.key === 'Alt') this.altDown = false; });
    addEventListener('blur', () => { this.altDown = false; });
    for (const b of $$('[data-panel]')) b.onclick = () => this.panels.toggle(b.dataset.panel);
    $('#b-auto').onclick = () => this.app.toggleAuto();
    $('#b-auto-cfg').onclick = () => this.panels.toggle('auto');
    $('#pot-1').onclick = () => this.g.world.drink('hp');
    $('#pot-2').onclick = () => this.g.world.drink('mp');
    $('#pot-3').onclick = () => this.app.useTdp();
    $('#sk-left').onclick = () => this.panels.toggle('skills');
    $('#sk-right').onclick = () => this.panels.toggle('skills');
    $('#bigmap').onclick = () => { $('#bigmap').hidden = true; };
    document.addEventListener('mousedown', (e) => { if (!e.target.closest('#tip')) hideTip(); });
  }
}
