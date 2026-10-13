// DOM UI kiểu MU: quả cầu máu/mana, thanh skill, bảng nhân vật (C), túi đồ (V) kéo thả ngọc để ép, NPC, panel benchmark.
import { CLASSES, SKILLS, MAPS } from './data.js';
import { S, stats, addPoint, need, reqOk } from './state.js';
import { SLOTS, SLOT_NAME, base, itemName, itemColor, itemStats, applyJewel, sellPrice, canEquip, JEWELS, BOX, EXC_WEAPON, EXC_ARMOR, soulRate, glowLevel } from './items.js';

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const A = './a/';
const fmt = (n) => Math.floor(n).toLocaleString('vi-VN');
const EXC_TEXT = Object.fromEntries([...EXC_WEAPON, ...EXC_ARMOR].map((o) => [o.k, o.t]));
const POT_PRICE = 20;

export const UI = {
  G: null, tgt: null, sel: null, open: null,

  // ---------- màn chọn class ----------
  chooseClass(cb) {
    const box = $('#select');
    box.hidden = false;
    $('#loading').hidden = true;
    box.querySelectorAll('[data-cls]').forEach((b) => (b.onclick = () => { box.hidden = true; $('#loading').hidden = false; cb(b.dataset.cls); }));
  },
  loading(k, msg) {
    const L = $('#loading');
    if (this.G) { L.hidden = false; L.classList.add('soft'); }
    $('#ld-fill').style.width = `${Math.round(k * 100)}%`;
    $('#ld-txt').textContent = `${msg} ${Math.round(k * 100)}%`;
  },
  loaded() { $('#loading').hidden = true; },

  attach(G) {
    const first = !this.G;
    this.G = G;
    this.tgt = null;
    if (first) this.bind();
    this.skills(); this.vitals(); this.target(null); this.refresh();
  },
  bind() {
    const ICONS = this.G.ICONS;
    this.icon = (iid, size = 46) => {
      const p = ICONS.pos[iid]; if (!p) return '';
      const s = ICONS.size, k = size / s, rows = Math.ceil(Object.keys(ICONS.pos).length / ICONS.cols);
      return `background-image:url(${A}icons.webp);background-size:${ICONS.cols * s * k}px ${rows * s * k}px;background-position:-${p[0] * k}px -${p[1] * k}px;width:${size}px;height:${size}px`;
    };
    $('#b-char').onclick = () => this.toggle('char');
    $('#b-inv').onclick = () => this.toggle('inv');
    document.querySelectorAll('.modal').forEach((m) => m.addEventListener('pointerdown', (e) => {
      if (e.target === m && m.classList.contains('center')) this.closeAll();
      if (e.target.closest('[data-close]')) this.closeAll();
    }));
    $('#pot-hp').onclick = () => this.G.drink('hp');
    $('#pot-mp').onclick = () => this.G.drink('mp');
    setTimeout(() => { const h = $('#hint'); if (h) h.style.opacity = 0; }, 16000);
  },
  blocking() { return !!this.open; },
  toggle(which) { if (this.open === which) return this.closeAll(); this.closeAll(); this.open = which; $('#' + which).hidden = false; this.sel = null; this.refresh(); },
  closeAll() { for (const id of ['char', 'inv', 'dialog', 'result']) $('#' + id).hidden = true; this.open = null; this.sel = null; $('#tip').hidden = true; },
  refresh() { if (this.open === 'inv') this.inv(); if (this.open === 'char') this.char(); this.vitals(); },

  // ---------- HUD ----------
  vitals() {
    const G = this.G; if (!G) return;
    const ST = G.ST;
    $('#hp-fill').style.height = `${clamp(S.hp / ST.maxHp, 0, 1) * 100}%`;
    $('#mp-fill').style.height = `${clamp(S.mp / ST.maxMp, 0, 1) * 100}%`;
    $('#hp-txt').textContent = `${Math.ceil(S.hp)}/${ST.maxHp}`;
    $('#mp-txt').textContent = `${Math.floor(S.mp)}/${ST.maxMp}`;
    $('#xp-fill').style.width = `${S.xp / need() * 100}%`;
    $('#xp-txt').textContent = `EXP ${fmt(S.xp)} / ${fmt(need())}`;
    $('#lvl').textContent = S.lvl; $('#zen').textContent = fmt(S.zen);
    $('#cls').textContent = CLASSES[S.cls].name;
    $('#pot-hp em').textContent = S.hpPot; $('#pot-mp em').textContent = S.mpPot;
    $('#b-char').classList.toggle('glow', S.pts > 0);
    $('#b-char b').textContent = S.pts ? `+${S.pts}` : '';
  },
  where() {
    const G = this.G, h = G.hero;
    $('#map').textContent = `${G.M.name} (${Math.floor(h.x)}, ${Math.floor(h.y)})${G.inTown(h.x, h.y) ? ' · an toàn' : ''}`;
    const q = $('#quest');
    const g = G.golden;
    let html;
    if (S.boss) html = '<b>Chiến thắng</b>Đã diệt Gorgon. Ép đồ +9 hoặc săn tiếp tuỳ ý.';
    else if (G.mapKey === 'dungeon') html = '<b>Gorgon</b>Tìm phòng của Gorgon ở cuối Dungeon (phía bắc).';
    else if (S.lvl < MAPS.lorencia.portal.lvl) html = `<b>Luyện cấp</b>Lên cấp ${MAPS.lorencia.portal.lvl} (hiện ${S.lvl}). Bãi càng xa thị trấn quái càng mạnh.`;
    else html = '<b>Dungeon</b>Đi tới cổng Dungeon ở phía tây Lorencia.';
    if (g && g.until) { const s = Math.max(0, Math.ceil(g.until - G.now)); html += `<b class="gold">Golden Invasion</b>Còn ${g.left} quái vàng · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
    if (q.innerHTML !== html) q.innerHTML = html;
  },
  skills() {
    const C = CLASSES[S.cls], bar = $('#skills');
    const basic = `<div class="sk basic" title="${C.basic.name}: click trái vào quái"><span class="ic" style="${this.icon(C.basic.icon, 44)}"></span><kbd>Chuột trái</kbd></div>`;
    bar.innerHTML = basic + C.skills.map((k, i) => {
      const sk = SKILLS[k], lock = sk.lvl > S.lvl;
      return `<button class="sk${S.skill === k ? ' on' : ''}${lock ? ' lock' : ''}" data-k="${k}" title="${sk.vn} (${sk.name}) · ${sk.mp} mana${lock ? ` · mở ở cấp ${sk.lvl}` : ''}"><span class="ic" style="${this.icon(sk.icon, 44)}"></span><span class="cd"></span><kbd>${i + 1}</kbd>${lock ? `<em class="lv">Lv${sk.lvl}</em>` : `<em>${sk.mp}</em>`}</button>`;
    }).join('');
    bar.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const G = this.G;
      G.selectSkill(b.dataset.k);
      // màn cảm ứng không có chuột phải: chạm nút skill là tung luôn vào quái gần nhất
      if (e.pointerType === 'touch') { const t = G.nearestMob(8); G.castSelected(t ? { x: t.x, y: t.y } : { x: G.hero.x + 1, y: G.hero.y + 1 }); }
    }));
    $('#rmb').textContent = SKILLS[S.skill]?.vn || '';
  },
  cooldowns() {
    const G = this.G;
    document.querySelectorAll('#skills [data-k]').forEach((b) => {
      const k = b.dataset.k, sk = SKILLS[k], left = Math.max(0, (G.cd[k] || 0) - G.now);
      b.querySelector('.cd').style.setProperty('--p', `${left / sk.cd * 100}%`);
      b.classList.toggle('off', S.mp < sk.mp);
    });
  },
  toast(msg, color = '#e8e2d2') {
    const el = document.createElement('div'); el.className = 'toast'; el.style.color = color; el.textContent = msg;
    const box = $('#toasts'); box.appendChild(el); while (box.children.length > 6) box.firstChild.remove();
    setTimeout(() => el.remove(), 3700);
  },
  banner(t, sub) { const b = $('#banner'); b.innerHTML = `<small>${sub}</small>${t}`; b.classList.add('on'); clearTimeout(this._b); this._b = setTimeout(() => b.classList.remove('on'), 2800); },
  target(u) {
    this.tgt = u;
    const box = $('#target');
    if (!u || !u.alive) { box.hidden = true; return; }
    box.hidden = false;
    box.classList.toggle('boss', !!u.d.boss); box.classList.toggle('gold', !!u.d.gold);
    $('#tg-name').textContent = `${u.d.name} · Lv ${u.d.lvl}`;
    $('#tg-fill').style.width = `${Math.max(0, u.hp / u.max) * 100}%`;
  },
  perf(P, alive, gold) {
    const fx = !this.G.fx ? 'tắt' : 'bật';
    $('#perf').innerHTML = `<b class="${P.fps < 45 ? 'bad' : P.fps < 57 ? 'mid' : ''}">${P.fps.toFixed(0)}</b> fps · 1% <b>${P.low.toFixed(0)}</b> · quái <b>${alive}</b>${gold ? ` (vàng ${gold})` : ''} · obj <b>${P.obj}</b> · FX ${fx}`;
    this.fpsLog = this.fpsLog || []; this.fpsLog.push(P.fps); if (this.fpsLog.length > 2400) this.fpsLog.shift();
  },

  // ---------- bảng nhân vật ----------
  char() {
    const ST = stats(), C = CLASSES[S.cls];
    const row = (k, n, hint) => `<div class="st"><span>${n}<small>${hint}</small></span><b>${S.stat[k]}</b>${S.pts ? `<button class="plus" data-k="${k}" title="Click +1 · Shift+click +10">+</button>` : '<i></i>'}</div>`;
    $('#char-body').innerHTML = `
      <div class="who"><img src="${A}portraits/${C.portrait}.webp" alt=""><div><div class="nm">${C.name}</div><div class="sub">Cấp ${S.lvl} · EXP ${fmt(S.xp)}/${fmt(need())}</div><div class="pts">${S.pts ? `Còn <b>${S.pts}</b> điểm để cộng` : 'Lên cấp được 5 điểm'}</div></div></div>
      ${row('str', 'Sức mạnh', S.cls === 'dk' ? 'sát thương vật lý' : 'sát thương đánh thường')}
      ${row('agi', 'Nhanh nhẹn', 'phòng thủ, tốc độ đánh')}
      ${row('vit', 'Thể lực', 'máu tối đa')}
      ${row('ene', 'Năng lượng', S.cls === 'dw' ? 'sát thương phép, mana' : 'mana')}
      <dl class="derived">
        <dt>${S.cls === 'dk' ? 'Sát thương' : 'Sát thương phép'}</dt><dd>${S.cls === 'dk' ? `${ST.dmg[0]}–${ST.dmg[1]}` : `${ST.mag[0]}–${ST.mag[1]}`}</dd>
        <dt>Phòng thủ</dt><dd>${ST.def}</dd>
        <dt>Máu / Mana</dt><dd>${ST.maxHp} / ${ST.maxMp}</dd>
        <dt>Tốc độ đánh</dt><dd>${Math.round(ST.speed * 100)}%</dd>
        <dt>Chí mạng / Hoàn hảo</dt><dd>${ST.crit}% / ${ST.exc}%</dd>
        <dt>Quái đã hạ</dt><dd>${fmt(S.kills)}</dd>
      </dl>`;
    document.querySelectorAll('#char .plus').forEach((b) => (b.onclick = (e) => { if (addPoint(b.dataset.k, e.shiftKey ? 10 : 1)) { this.G.equipChanged(); this.char(); } }));
  },

  // ---------- túi đồ ----------
  find(id) { return [...SLOTS.map((s) => S.eq[s]), ...S.bag].find((x) => x && x.id === id); },
  nearShop() { const G = this.G; return G.npcs.some((n) => Math.hypot(n.x - G.hero.x, n.y - G.hero.y) < 3.2); },
  inv() {
    const cell = (it, slot) => {
      if (!it) return `<div class="cell empty" ${slot ? `style="grid-area:${slot}" data-slot="${slot}"` : ''}>${slot ? `<span class="lbl">${SLOT_NAME[slot]}</span>` : ''}</div>`;
      const ic = it.jewel ? JEWELS[it.jewel].icon : it.box ? BOX.icon : base(it).icon;
      const g = glowLevel(it);
      return `<button class="cell${this.sel === it.id ? ' sel' : ''}${g ? ` g${g}` : ''}${it.exc?.length ? ' exc' : ''}" data-id="${it.id}" ${slot ? `style="grid-area:${slot}"` : ''} draggable="${!!it.jewel}" aria-label="${itemName(it)}"><span class="ic" style="${this.icon(ic, slot ? 50 : 40)}"></span>${it.lvl ? `<i class="plus">+${it.lvl}</i>` : ''}</button>`;
    };
    $('#doll').innerHTML = SLOTS.filter((s) => S.cls === 'dk' || s !== 'off').map((s) => cell(S.eq[s], s)).join('');
    $('#bag').innerHTML = Array.from({ length: 64 }, (_, i) => cell(S.bag[i])).join('');
    $('#inv-foot').innerHTML = `<span>${S.bag.length}/64 ô</span><span>Zen <b>${fmt(S.zen)}</b></span><span>${this.nearShop() ? 'Đang ở cạnh NPC: bán được đồ' : 'Đến gần NPC ở thị trấn để bán đồ'}</span>`;
    const jewelSel = this.find(this.sel)?.jewel;
    document.querySelectorAll('#inv .cell[data-id]').forEach((c) => {
      const it = this.find(+c.dataset.id);
      c.onmouseenter = () => { if (!jewelSel) this.detail(it); };
      c.onclick = () => {
        const sel = this.find(this.sel);
        if (sel?.jewel && !it.jewel && !it.box) return this.useJewel(sel, it);
        this.sel = it.id; this.inv();
      };
      c.ondblclick = () => { if (it.jewel || it.box) return; this.act(it, Object.values(S.eq).includes(it) ? 'off' : 'eq'); };
      c.ondragstart = (e) => { e.dataTransfer.setData('text/plain', String(it.id)); e.dataTransfer.effectAllowed = 'move'; c.classList.add('drag'); };
      c.ondragend = () => c.classList.remove('drag');
      c.ondragover = (e) => { if (!it.jewel && !it.box) { e.preventDefault(); c.classList.add('drop'); } };
      c.ondragleave = () => c.classList.remove('drop');
      c.ondrop = (e) => { e.preventDefault(); c.classList.remove('drop'); const j = this.find(+e.dataTransfer.getData('text/plain')); if (j?.jewel) this.useJewel(j, it); };
    });
    this.detail(this.find(this.sel) || S.eq.main);
  },
  itemHtml(it) {
    if (it.jewel) { const J = JEWELS[it.jewel]; return `<div class="nm" style="color:${itemColor(it)}">${J.n}</div><div class="desc">${J.desc}</div>`; }
    if (it.box) return `<div class="nm" style="color:${itemColor(it)}">${BOX.n}</div><div class="desc">${BOX.desc}</div>`;
    const b = base(it), st = itemStats(it), ok = canEquip(it, S.cls, S.lvl);
    return `<div class="nm" style="color:${itemColor(it)}">${itemName(it)}</div>
      <div class="sub">${SLOT_NAME[b.slot]} · ${CLASSES[b.cls].name}</div>
      ${st.dmg ? `<div class="base">Sát thương: ${st.dmg[0]}–${st.dmg[1]}</div>` : ''}${st.mag ? `<div class="base">Sát thương phép: +${st.mag[0]}–${st.mag[1]}</div>` : ''}${st.def ? `<div class="base">Phòng thủ: ${st.def}</div>` : ''}
      <div class="${reqOk(it) ? 'sub' : 'down'}">Yêu cầu cấp ${b.req}</div>${b.cls !== S.cls ? `<div class="down">Chỉ ${CLASSES[b.cls].name} dùng được</div>` : ''}
      ${it.luck ? '<div class="luck">May Mắn (+5% chí mạng, +25% tỉ lệ ép Ngọc Tâm Linh)</div>' : ''}
      ${it.exc.length ? `<ul>${it.exc.map((k) => `<li>${EXC_TEXT[k]}</li>`).join('')}</ul>` : ''}
      ${it.lvl >= 6 && it.lvl < 9 ? `<div class="sub">Ép Ngọc Tâm Linh: ${Math.round(soulRate(it) * 100)}% thành công</div>` : ''}${ok ? '' : ''}`;
  },
  detail(it) {
    const d = $('#detail');
    if (!it) { d.innerHTML = '<span class="sub">Chọn một món đồ.</span>'; return; }
    const worn = Object.values(S.eq).includes(it), shop = this.nearShop();
    let acts = '';
    if (it.jewel) acts = `<div class="sub hint2">${this.sel === it.id ? 'Đã chọn ngọc → click món đồ cần ép (hoặc kéo thả)' : 'Click để chọn rồi click món đồ, hoặc kéo thả lên đồ'}</div>`;
    else if (!it.box) acts = worn ? '<button class="btn" data-a="off">Tháo ra</button>' : `${canEquip(it, S.cls, S.lvl) ? '<button class="btn" data-a="eq">Mặc vào</button>' : ''}`;
    if (!worn && shop) acts += `<button class="btn alt" data-a="sell">Bán ${fmt(sellPrice(it))} Zen</button>`;
    d.innerHTML = this.itemHtml(it) + `<div class="acts">${acts}</div>`;
    d.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => this.act(it, b.dataset.a)));
  },
  act(it, a) {
    const G = this.G, i = S.bag.indexOf(it);
    if (a === 'eq' && i >= 0 && canEquip(it, S.cls, S.lvl)) {
      const slot = base(it).slot, old = S.eq[slot];
      S.eq[slot] = it; S.bag.splice(i, 1); if (old) S.bag.splice(i, 0, old);
      G.sfx('cloth', 0.5); G.equipChanged();
    }
    if (a === 'off') {
      if (S.bag.length >= 64) return this.toast('Túi đồ đầy', '#ff9a7a');
      const slot = base(it).slot; S.eq[slot] = null; S.bag.push(it); G.equipChanged();
    }
    if (a === 'sell' && i >= 0) { S.bag.splice(i, 1); S.zen += sellPrice(it); this.sel = null; G.sfx('coins', 0.5); }
    this.refresh();
  },
  useJewel(j, it) {
    const G = this.G, r = applyJewel(j.jewel, it);
    if (!r.ok) { this.toast(r.msg, '#ff9a7a'); return; }
    S.bag.splice(S.bag.indexOf(j), 1);
    this.sel = it.id;
    const h = G.hero;
    if (r.result === 'up') {
      G.sfx('gem', 0.7); G.power('sparkle:power', h.x, h.y, 0, { add: true, scale: 1.1 });
      this.toast(r.msg, itemColor(it));
      if (it.lvl >= 7) this.banner(itemName(it), 'Ép thành công · đồ bắt đầu phát sáng');
    } else {
      G.sfx('nomana', 0.8); G.power('spark_red:power', h.x, h.y, 0, { add: true, scale: 1.3 }); G.shake = 0.3;
      this.toast(r.msg, '#ff6a5a');
    }
    if (Object.values(S.eq).includes(it)) G.equipChanged();
    this.refresh();
    const c = document.querySelector(`#inv .cell[data-id="${it.id}"]`);
    if (c) { c.classList.add(r.result === 'up' ? 'flash-up' : 'flash-fail'); }
  },

  // ---------- NPC ----------
  npc(n) {
    const G = this.G;
    this.closeAll(); this.open = 'dialog';
    const D = $('#dialog'); D.hidden = false;
    $('#dlg-face').src = `${A}portraits/${n.face}.webp`; $('#dlg-name').textContent = `${n.name} · ${n.role}`;
    const acts = [];
    if (n.key === 'amy') {
      $('#dlg-text').textContent = `Bình máu và bình mana, ${POT_PRICE} Zen một bình. Ra bãi nhớ mang đủ nhé! (Q uống máu, W uống mana)`;
      const buy = (k, q) => { const c = q * POT_PRICE; if (S.zen < c) return this.toast('Không đủ Zen', '#ff9a7a'); S.zen -= c; S[k] += q; G.sfx('coins', 0.5); this.vitals(); this.toast(`Mua ${q} ${k === 'hpPot' ? 'bình máu' : 'bình mana'}`, '#6fd36f'); };
      acts.push(['Bình máu x10', () => buy('hpPot', 10)], ['Bình mana x10', () => buy('mpPot', 10)], ['Bình máu x1', () => buy('hpPot', 1)], ['Bình mana x1', () => buy('mpPot', 1)]);
    } else {
      $('#dlg-text').textContent = 'Đồ cũ đem bán cho ta. Ngọc Ước Nguyện và Ngọc Tâm Linh thì giữ lại mà ép đồ, đừng bán!';
      acts.push(['Bán hết đồ thường (+0..+2)', () => {
        let n = 0, z = 0;
        S.bag = S.bag.filter((it) => { if (it.jewel || it.box || it.exc.length || it.lvl > 2 || it.luck) return true; n++; z += sellPrice(it); return false; });
        S.zen += z; G.sfx('coins', 0.6); this.toast(`Bán ${n} món, nhận ${fmt(z)} Zen`, '#f0d898'); this.vitals();
      }], ['Mở túi đồ để bán', () => this.toggle('inv')]);
    }
    acts.push(['Đóng', () => this.closeAll(), true]);
    const box = $('#dlg-acts'); box.innerHTML = '';
    for (const [label, fn, alt] of acts) { const b = document.createElement('button'); b.className = `btn${alt ? ' alt' : ''}`; b.textContent = label; b.onclick = fn; box.appendChild(b); }
  },

  // ---------- kết quả ----------
  result(title, html) {
    this.closeAll(); this.open = 'result';
    $('#result').hidden = false; $('#res-title').textContent = title; $('#res-body').innerHTML = html;
  },
  victory() {
    const mins = (performance.now() - S.t0) / 60000;
    const best = [...Object.values(S.eq), ...S.bag].filter((x) => x && x.b).sort((a, b) => b.lvl - a.lvl || b.exc.length - a.exc.length)[0];
    const f = this.fpsLog || [], avg = f.length ? f.reduce((s, v) => s + v, 0) / f.length : 0, low = f.length ? Math.min(...f) : 0;
    this.result('Chiến Thắng', `<dl class="derived">
      <dt>Thời gian</dt><dd>${mins.toFixed(1)} phút</dd><dt>Class</dt><dd>${CLASSES[S.cls].name}</dd><dt>Cấp</dt><dd>${S.lvl}</dd><dt>Quái đã hạ</dt><dd>${fmt(S.kills)}</dd>
      <dt>Đồ tốt nhất</dt><dd style="color:${best ? itemColor(best) : ''}">${best ? itemName(best) : '-'}</dd><dt>FPS TB / thấp nhất (0,5s)</dt><dd>${avg.toFixed(0)} / ${low.toFixed(0)}</dd></dl>
      <div class="acts"><button class="btn" data-close>Chơi tiếp</button></div>`);
  },
  benchResult(r) {
    const txt = JSON.stringify(r);
    this.result('Kết quả benchmark', `<dl class="derived">
      <dt>Số quái</dt><dd>${r.n}</dd><dt>FX (bloom, glow)</dt><dd>${r.fx ? 'bật' : 'tắt'}</dd><dt>Tự xả skill</dt><dd>${r.auto ? `có (${r.cls.toUpperCase()})` : 'không'}</dd>
      <dt>FPS trung bình</dt><dd>${r.fps}</dd><dt>1% low</dt><dd>${r.low1}</dd><dt>Frame p95</dt><dd>${r.p95ms} ms</dd><dt>Số frame đo</dt><dd>${r.frames}</dd></dl>
      <textarea readonly rows="3">${txt}</textarea>
      <div class="acts"><button class="btn" id="copy-bench">Copy JSON</button><button class="btn alt" data-close>Đóng</button></div>`);
    $('#copy-bench').onclick = () => navigator.clipboard?.writeText(txt).then(() => this.toast('Đã copy', '#6fd36f'));
  },
};
