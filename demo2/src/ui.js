import * as THREE from 'three';
import { RAR, S, sellPrice } from './items.js';

const $ = (s) => document.querySelector(s);
const v3 = new THREE.Vector3();

export const UI = {
  G: null,
  thumbs: {},
  anchors: [],
  sel: null,

  init(G) {
    this.G = G;
    this.layer = $('#world-ui');
    $('#b-bag').onclick = () => this.toggleInv();
    document.querySelectorAll('.modal').forEach((m) => m.addEventListener('pointerdown', (e) => {
      if (e.target === m && m.id === 'inv') m.hidden = true;
      if (e.target.closest('[data-close]')) m.hidden = true;
    }));
    const bind = (id, fn) => { const b = $(id); b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }); };
    bind('#sk-atk', () => G.attack());
    bind('#sk-q', () => G.skill());
    bind('#sk-e', () => G.dodge());
    bind('#sk-r', () => G.drink());
    $('#talk').onclick = () => G.talk();
    setTimeout(() => { const h = $('#hint'); if (h) h.style.opacity = 0; }, 12000);
  },

  // ---------- HUD ----------
  vitals(ST) {
    $('#hp-fill').style.width = `${Math.max(0, Math.min(1, S.hp / ST.maxHp)) * 100}%`;
    $('#mp-fill').style.width = `${Math.max(0, Math.min(1, S.mp / ST.maxMp)) * 100}%`;
    $('#hp-txt').textContent = `${Math.max(0, Math.ceil(S.hp))}/${ST.maxHp}`;
    $('#mp-txt').textContent = `${Math.floor(S.mp)}/${ST.maxMp}`;
    $('#xp-fill').style.width = `${(S.xp / this.G.xpNeed()) * 100}%`;
    $('#lvl').textContent = S.lvl;
    $('#gold').textContent = S.gold;
    $('#pot-n').textContent = S.bag.filter((i) => i.kind === 'potion').length;
  },
  hero(def) {
    $('#hero-name').textContent = def.name;
    $('#portrait').src = this.thumbs['face_' + def.key] || '';
    $('#ico-atk').style.backgroundImage = `url(${this.thumbs[def.atkIcon]})`;
    $('#ico-q').style.backgroundImage = `url(${this.thumbs[def.skillIcon]})`;
    $('#ico-r').style.backgroundImage = `url(${this.thumbs.bottle_A_green})`;
    document.querySelectorAll('.hero-btn').forEach((b) => b.classList.toggle('on', b.dataset.k === def.key));
  },
  heroButtons(defs) {
    $('#heroes').innerHTML = defs.map((d) => `<button class="hero-btn" data-k="${d.key}" title="${d.name}" aria-label="Chơi ${d.name}"><img src="${this.thumbs['face_' + d.key]}" alt=""></button>`).join('');
    $('#heroes').querySelectorAll('.hero-btn').forEach((b) => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.G.switchHero(b.dataset.k); }));
  },
  cooldowns(cd, now, costOk) {
    for (const [k, id, total] of [['q', '#sk-q', 4], ['e', '#sk-e', 1.2], ['r', '#sk-r', 5]]) {
      const left = Math.max(0, cd[k] - now);
      const b = $(id);
      b.querySelector('.cd').style.setProperty('--p', `${(left / total) * 100}%`);
    }
    $('#sk-q').classList.toggle('off', !costOk);
  },
  toast(msg, color = '#f2ecdf') {
    const el = document.createElement('div');
    el.className = 'toast'; el.style.color = color; el.textContent = msg;
    const box = $('#toasts'); box.appendChild(el);
    while (box.children.length > 5) box.firstChild.remove();
    setTimeout(() => el.remove(), 3500);
  },
  banner(title, sub) {
    const b = $('#banner');
    b.innerHTML = `<small>${sub}</small>${title}`;
    b.classList.add('on');
    clearTimeout(this._bt);
    this._bt = setTimeout(() => b.classList.remove('on'), 2600);
  },
  boss(e) {
    const box = $('#boss');
    if (!e || !e.alive) { box.hidden = true; return; }
    box.hidden = false;
    $('#boss-name').textContent = e.def.name;
    $('#boss-fill').style.width = `${Math.max(0, e.hp / e.max) * 100}%`;
  },
  quest() {
    const q = $('#quest');
    if (S.quest === 0 || S.quest === 3) { q.hidden = true; return; }
    q.hidden = false;
    $('#q-title').textContent = 'Dọn sạch Đại Sảnh';
    const left = this.G.hallLeft();
    const st = $('#q-step');
    st.classList.toggle('done', S.quest === 2);
    st.textContent = S.quest === 2 ? 'Quay lại gặp Pháp Sư Lyra' : `Hạ bộ xương: ${this.G.hallTotal - left}/${this.G.hallTotal}`;
  },

  // ---------- world-anchored ----------
  anchor(el, pos, o = {}) {
    el.classList.add('wui');
    this.layer.appendChild(el);
    const a = { el, pos, dy: o.dy || 0, life: o.life || 0, t: 0, rise: o.rise || 0, fade: o.fade ?? !!o.life };
    this.anchors.push(a);
    return a;
  },
  drop(a) { const i = this.anchors.indexOf(a); if (i >= 0) this.anchors.splice(i, 1); a.el.remove(); },
  dmg(pos, txt, cls = '') {
    const el = document.createElement('div');
    el.className = `dmg ${cls}`; el.textContent = txt;
    const p = pos.clone(); p.x += (Math.random() - 0.5) * 0.6;
    this.anchor(el, p, { dy: 2.3, life: cls.includes('crit') || cls.includes('big') ? 1.1 : 0.8, rise: 46 });
    if (cls.includes('crit') || cls.includes('big')) el.animate([{ transform: 'scale(1.8)' }, { transform: 'scale(1)' }], { duration: 180, easing: 'cubic-bezier(.2,1.6,.4,1)', composite: 'add' });
  },
  update(camera, w, h, dt) {
    for (let i = this.anchors.length - 1; i >= 0; i--) {
      const a = this.anchors[i];
      a.t += dt;
      if (a.life && a.t >= a.life) { a.el.remove(); this.anchors.splice(i, 1); continue; }
      const p = typeof a.pos === 'function' ? a.pos() : a.pos;
      if (!p) continue;
      v3.copy(p); v3.y += a.dy; v3.project(camera);
      if (v3.z > 1 || v3.x < -1.2 || v3.x > 1.2 || v3.y < -1.2 || v3.y > 1.2) { a.el.style.visibility = 'hidden'; continue; }
      a.el.style.visibility = '';
      const k = a.life ? a.t / a.life : 0;
      const x = (v3.x * 0.5 + 0.5) * w, y = (-v3.y * 0.5 + 0.5) * h - a.rise * (1 - (1 - k) ** 2);
      a.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
      if (a.fade) a.el.style.opacity = k > 0.6 ? String(1 - (k - 0.6) / 0.4) : '1';
    }
  },

  // ---------- dialog ----------
  dialog(face, name, text, acts) {
    $('#dialog').hidden = false;
    $('#dlg-face').src = face || '';
    $('#dlg-name').textContent = name;
    $('#dlg-text').textContent = text;
    const box = $('#dlg-acts');
    box.innerHTML = '';
    for (const [label, fn, ghost] of acts) {
      const b = document.createElement('button');
      b.className = `btn${ghost ? ' ghost' : ''}`; b.textContent = label;
      b.onclick = () => { $('#dialog').hidden = true; fn && fn(); };
      box.appendChild(b);
    }
    box.querySelector('button')?.focus();
  },
  get busy() { return !$('#dialog').hidden || !$('#inv').hidden; },

  // ---------- inventory ----------
  toggleInv() { const m = $('#inv'); m.hidden = !m.hidden; if (!m.hidden) this.inv(); },
  inv() {
    const T = this.thumbs;
    const cell = (it, big) => it
      ? `<button class="cell${big ? ' big' : ''}${this.sel === it.id ? ' sel' : ''}" data-id="${it.id}" data-r="${it.rarity}" aria-label="${it.name}"><img src="${T[it.m] || ''}" alt=""></button>`
      : `<div class="cell empty${big ? ' big' : ''}"></div>`;
    $('#equip').innerHTML = cell(S.eq.weapon, true) + cell(S.eq.shield, true);
    $('#bag').innerHTML = Array.from({ length: 20 }, (_, i) => cell(S.bag[i])).join('');
    const ST = this.G.ST;
    $('#stats').innerHTML = [
      ['Sát thương', `${Math.round(ST.dmg[0] * ST.mult)}–${Math.round(ST.dmg[1] * ST.mult)}${ST.fire ? ` (+${ST.fire} lửa)` : ''}`],
      ['Giáp', ST.armor], ['Chí mạng', `${ST.crit.toFixed(1)}%`], ['Máu / Mana', `${ST.maxHp} / ${ST.maxMp}`], ['Vàng', S.gold],
    ].map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
    document.querySelectorAll('#inv .cell[data-id]').forEach((c) => {
      const it = this.find(+c.dataset.id);
      c.onmouseenter = () => this.detail(it);
      c.onclick = () => { this.sel = it.id; this.inv(); };
    });
    this.detail(this.find(this.sel) || S.eq.weapon);
  },
  find(id) { return [S.eq.weapon, S.eq.shield, ...S.bag].find((x) => x && x.id === id); },
  detail(it) {
    const d = $('#detail');
    if (!it) { d.innerHTML = '<span class="sub">Chọn một món để xem chỉ số.</span>'; return; }
    const R = RAR[it.rarity];
    const worn = S.eq.weapon === it || S.eq.shield === it;
    let cmp = '';
    if (!worn && it.kind !== 'potion') {
      const cur = S.eq[it.kind];
      const val = (x) => (x ? (x.dmg ? (x.dmg[0] + x.dmg[1]) / 2 : x.armor) : 0);
      const diff = Math.round((val(it) - val(cur)) * 10) / 10;
      cmp = `<div class="cmp ${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff)} ${it.dmg ? 'sát thương TB' : 'giáp'} so với đồ đang mặc</div>`;
    }
    d.innerHTML = `
      <div class="nm" style="color:${R.c}">${it.name}</div>
      <div class="sub">${R.n}${it.base && it.rarity >= 2 ? ` · ${it.base}` : ''} · cấp ${it.ilvl}${worn ? ' · đang mặc' : ''}</div>
      ${it.dmg ? `<div class="base">${it.dmg[0]}–${it.dmg[1]} sát thương</div>` : ''}
      ${it.armor ? `<div class="base">${it.armor} giáp</div>` : ''}
      ${it.kind === 'potion' ? '<div class="base">Hồi 45% máu (phím R)</div>' : ''}
      ${it.affixes.length ? `<ul>${it.affixes.map((a) => `<li>${a.t}</li>`).join('')}</ul>` : ''}
      ${it.power ? `<div class="pow">${it.power.p}</div>` : ''}
      ${cmp}
      ${worn ? '' : `<div class="acts">${it.kind === 'potion' ? '<button class="btn" data-a="use">Uống</button>' : '<button class="btn" data-a="eq">Trang bị</button>'}<button class="btn ghost" data-a="sell">Bán ${sellPrice(it)} vàng</button></div>`}`;
    d.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => this.act(it, b.dataset.a)));
  },
  act(it, a) {
    const i = S.bag.indexOf(it);
    if (i < 0) return;
    if (a === 'eq') {
      const old = S.eq[it.kind]; S.eq[it.kind] = it; S.bag.splice(i, 1); if (old) S.bag.splice(i, 0, old);
      this.G.equipChanged(it);
    }
    if (a === 'sell') { S.bag.splice(i, 1); S.gold += sellPrice(it); this.sel = null; }
    if (a === 'use') this.G.drink();
    this.G.refresh();
    this.inv();
  },

  // ---------- minimap ----------
  minimap(G) {
    const c = $('#minimap'), x = c.getContext('2d');
    const W = c.width, H = c.height, M = G.MAP, cols = M[0].length, rows = M.length;
    const s = Math.min(W / cols, H / rows), ox = (W - cols * s) / 2, oy = (H - rows * s) / 2;
    x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(4,5,10,.55)'; x.fillRect(0, 0, W, H);
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const ch = M[r][q];
      if (ch === '#') continue;
      if (!G.seen.has(`${q},${r}`)) continue;
      x.fillStyle = ch === 'c' ? '#3c3352' : ch === 't' ? '#4d3a26' : '#3a3f4f';
      x.fillRect(ox + q * s + 0.5, oy + r * s + 0.5, s - 1, s - 1);
    }
    const P = (p) => [ox + (p.x / G.C) * s, oy + (p.z / G.C) * s];
    for (const e of G.enemies) if (e.alive && e.state !== 'dormant') { const [a, b] = P(e.root.position); x.fillStyle = e.def.boss ? '#ff8a3a' : '#ff5a6a'; x.beginPath(); x.arc(a, b, e.def.boss ? 3.5 : 2.2, 0, 7); x.fill(); }
    for (const n of G.npcs) { const [a, b] = P(n.root.position); x.fillStyle = '#9fd0ff'; x.beginPath(); x.arc(a, b, 2.6, 0, 7); x.fill(); }
    for (const ch of G.chests) if (!ch.opened) { const [a, b] = P(ch.obj.position); x.fillStyle = '#f5c451'; x.fillRect(a - 2, b - 2, 4, 4); }
    const hp = G.hero.root.position, [a, b] = P(hp), ang = G.hero.root.rotation.y;
    x.save(); x.translate(a, b); x.rotate(-ang); x.fillStyle = '#fff';
    x.beginPath(); x.moveTo(0, 4.5); x.lineTo(3.2, -3); x.lineTo(-3.2, -3); x.closePath(); x.fill(); x.restore();
  },
};
