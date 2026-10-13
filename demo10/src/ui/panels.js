// Các bảng: Nhân vật (F3), Hành trang (F4), Võ công (F5), Nhiệm vụ, NPC (hội thoại / cửa hàng / rương / xa phu), Auto, Hệ thống.
import { $, $$, esc, iconHtml, cellHtml, itemTip, showTip, hideTip } from './common.js';
import { ELEM, ELEMS } from '../core/data/elements.js';
import { PHAI } from '../core/data/phai.js';
import { MAPS } from '../core/data/world.js';
import { SLOTS, SLOT_NAME, activeHidden, countGold, GOLD_SETS, CONSUMABLE } from '../core/items.js';
import { phaiOf, skillUnlocked, xpNeed, INV_SIZE, STASH_SIZE } from '../core/char.js';
import { SKILL_MAX, lvVal } from '../core/data/phai.js';
import * as Q from '../core/quests.js';
import { fmt } from '../core/util.js';

const POS = {
  char: { left: '12px', top: '96px', width: '330px' },
  inv: { right: '12px', top: '170px', width: '400px' },
  skills: { left: '12px', top: '96px', width: '420px' },
  quests: { left: '50%', top: '96px', width: '420px', transform: 'translateX(-50%)' },
  npc: { left: '50%', top: '120px', width: '440px', transform: 'translateX(-50%)' },
  shop: { left: '12px', top: '96px', width: '420px' },
  stash: { left: '12px', top: '96px', width: '400px' },
  auto: { left: '50%', top: '120px', width: '380px', transform: 'translateX(-50%)' },
  menu: { left: '50%', top: '120px', width: '420px', transform: 'translateX(-50%)' },
};
const TITLE = { char: 'Nhân Vật', inv: 'Hành Trang', skills: 'Võ Công', quests: 'Nhiệm Vụ', npc: '', shop: 'Cửa Hàng', stash: 'Rương Chứa Đồ', auto: 'Cài Đặt Auto', menu: 'Hệ Thống' };

export class Panels {
  constructor(app) {
    this.app = app;
    this.open = {};     // kind -> { el, data }
    this.root = $('#panels');
  }
  get g() { return this.app.game; }
  get ch() { return this.app.game.ch; }
  isOpen(k) { return !!this.open[k]; }
  anyOpen() { return Object.keys(this.open).length > 0; }

  toggle(kind, data) { if (this.open[kind]) this.close(kind); else this.show(kind, data); }
  show(kind, data) {
    if (!this.open[kind]) {
      const el = document.createElement('div');
      el.className = 'panel frame';
      Object.assign(el.style, POS[kind]);
      el.innerHTML = `<div class="panel-head"><h2></h2><button class="x" title="Đóng (Esc)">✕</button></div><div class="panel-body"></div>`;
      el.querySelector('.x').onclick = () => this.close(kind);
      this.drag(el);
      this.root.appendChild(el);
      this.open[kind] = { el, data };
    } else this.open[kind].data = data;
    this.render(kind);
  }
  close(kind) {
    const p = this.open[kind];
    if (!p) return;
    p.el.remove();
    delete this.open[kind];
    hideTip();
    if (kind === 'npc') { this.close('shop'); this.close('stash'); }
    if ((kind === 'shop' || kind === 'stash') && this.open.inv) this.render('inv');
  }
  closeAll() { for (const k of Object.keys(this.open)) this.close(k); }
  closeTop() {
    const ks = Object.keys(this.open);
    if (!ks.length) return false;
    this.close(ks[ks.length - 1]);
    return true;
  }
  refresh() { for (const k of Object.keys(this.open)) this.render(k); }
  drag(el) {
    const h = el.querySelector('.panel-head');
    h.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      const r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
      const mv = (ev) => { Object.assign(el.style, { left: ev.clientX - ox + 'px', top: ev.clientY - oy + 'px', right: 'auto', transform: 'none' }); };
      const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
      addEventListener('mousemove', mv); addEventListener('mouseup', up);
    });
  }
  render(kind) {
    const p = this.open[kind];
    if (!p) return;
    p.el.querySelector('h2').textContent = p.data?.title || TITLE[kind];
    const body = p.el.querySelector('.panel-body');
    const st = body.scrollTop;
    body.innerHTML = this['r_' + kind](p.data || {});
    body.scrollTop = st;
    this['b_' + kind]?.(body, p.data || {});
    this.bindTips(body);
  }

  bindTips(body) {
    for (const c of $$('[data-uid]', body)) {
      c.addEventListener('mousemove', (e) => {
        const it = this.findItem(c.dataset.uid);
        if (!it) return;
        showTip(itemTip(it.it, this.ch, { slot: it.slot, price: c.dataset.price ? +c.dataset.price : null, sell: !!this.open.shop && it.where === 'inv' }), e.clientX, e.clientY);
      });
      c.addEventListener('mouseleave', hideTip);
    }
  }
  findItem(uid) {
    const ch = this.ch;
    for (const s of SLOTS) if (ch.eq[s]?.uid === uid) return { it: ch.eq[s], slot: s, where: 'eq' };
    let it = ch.inv.find((x) => x.uid === uid);
    if (it) return { it, where: 'inv' };
    it = ch.stash.find((x) => x.uid === uid);
    if (it) return { it, where: 'stash' };
    const shop = this.open.shop?.data?.list?.find((x) => x.item?.uid === uid);
    if (shop) return { it: shop.item, where: 'shop' };
    return null;
  }

  // ---------- Nhân vật ----------
  r_char() {
    const ch = this.ch, st = this.g.world.st, P = phaiOf(ch);
    const statRow = (k, name, tip) => `<span class="k" title="${tip}">${name}</span><b>${ch.base[k]}${st[k] !== ch.base[k] ? ` <span class="muted">(${st[k]})</span>` : ''}</b><button class="btn small" data-add="${k}" ${ch.free ? '' : 'disabled'}>+</button>`;
    const on = activeHidden(ch.eq), gold = countGold(ch.eq);
    const doll = SLOTS.map((s) => cellHtml(ch.eq[s], { label: SLOT_NAME[s], kich: on.has(s), attrs: ` data-slot="${s}"` })).join('');
    return `
      <div class="kv" style="margin-bottom:8px">
        <span>Tên</span><span><b style="color:var(--gold)">${esc(ch.name)}</b></span>
        <span>Môn phái</span><span>${ch.phai ? PHAI[ch.phai].name : 'Chưa nhập phái'}</span>
        <span>Ngũ hành</span><span style="color:${ELEM[ch.elem].color}">${ELEM[ch.elem].name}</span>
        <span>Cấp · kinh nghiệm</span><span>${ch.lv} · ${ch.lv >= 60 ? 'tối đa' : `${fmt(ch.xp)}/${fmt(xpNeed(ch.lv))}`}</span>
      </div>
      <h3>Trang bị ${gold.n >= 2 ? `<span style="color:var(--r-gold);font-size:11px">· Bộ ${GOLD_SETS[gold.set]} ${gold.n}/4</span>` : ''}</h3>
      <div class="doll">${doll}</div>
      <p class="muted" style="margin:0 0 6px;font-size:11px">Viền xanh lá = dòng ẩn đang được kích (đồ ô trước có ngũ hành sinh ra đồ ô này). Bấm vào đồ để tháo.</p>
      <h3>Tiềm năng <span class="muted" style="font-size:11px">· còn ${ch.free} điểm</span></h3>
      <div class="stats-grid">
        ${statRow('str', 'Sức mạnh', 'Tăng sát thương ngoại công cận chiến')}
        ${statRow('dex', 'Thân pháp', 'Tăng chính xác, né tránh, sát thương tầm xa')}
        ${statRow('vit', 'Sinh khí', 'Tăng sinh lực tối đa')}
        ${statRow('ene', 'Nội công', 'Tăng nội lực, sát thương nội công')}
      </div>
      <h3>Chỉ số</h3>
      <div class="kv">
        <span>Sinh lực</span><span>${fmt(st.maxHp)}</span>
        <span>Nội lực</span><span>${fmt(st.maxMp)}</span>
        <span>Sát thương</span><span>${Math.round(st.atk[0])} - ${Math.round(st.atk[1])}</span>
        <span>Chính xác · Né tránh</span><span>${Math.round(st.acc)} · ${Math.round(st.dodge)}</span>
        <span>Phòng thủ</span><span>${Math.round(st.def)}</span>
        <span>Chí mạng · Hút sinh lực</span><span>${st.crit}% · ${st.leech}%</span>
        <span>Tốc độ chạy · xuất chiêu</span><span>${Math.round(st.spd / 4.2 * 100)}% · ${Math.round(st.aspd * 100)}%</span>
        ${ELEMS.map((e) => `<span>${ELEM[e].res}</span><span style="color:${ELEM[e].color}">${st.res[e]}%</span>`).join('')}
      </div>
      <p class="muted" style="font-size:11px">Hệ ${ELEM[ch.elem].name} · ${P.desc || 'Đạt cấp 10 lên Tương Dương gặp sứ giả môn phái để bái sư.'}</p>`;
  }
  b_char(body) {
    for (const b of $$('[data-add]', body)) b.onclick = (e) => {
      const k = b.dataset.add, n = e.shiftKey ? this.ch.free : 1;
      for (let i = 0; i < n && this.ch.free > 0; i++) { this.ch.base[k]++; this.ch.free--; }
      this.g.world.recalc();
      this.app.ui.refreshAll();
    };
    for (const c of $$('[data-slot] [data-uid], .doll [data-uid]', body)) c.onclick = () => { this.g.unequip(c.closest('[data-slot]').dataset.slot); this.app.ui.refreshAll(); };
  }

  // ---------- Hành trang ----------
  r_inv() {
    const ch = this.ch, shop = !!this.open.shop, stash = !!this.open.stash;
    const cells = [];
    for (let i = 0; i < INV_SIZE; i++) cells.push(cellHtml(ch.inv[i], { size: 38 }));
    const hint = shop ? 'Chuột phải: bán · Chuột trái: dùng / mặc' : stash ? 'Chuột phải: cất vào rương · Chuột trái: dùng / mặc' : 'Chuột trái: dùng / mặc · Chuột phải: vứt bỏ (giữ Shift)';
    return `<div class="bag">${cells.join('')}</div>
      <div class="money"><span>${ch.inv.length}/${INV_SIZE} ô</span><span>${fmt(ch.money)} lượng</span></div>
      <p class="muted" style="font-size:11px;margin:6px 0 0">${hint}</p>`;
  }
  b_inv(body) {
    for (const c of $$('.bag [data-uid]', body)) {
      const uid = c.dataset.uid;
      c.onclick = () => {
        const it = this.ch.inv.find((x) => x.uid === uid);
        if (!it) return;
        if (it.stack) this.g.world.useItem(uid); else this.g.equip(uid);
        hideTip();
        this.app.ui.refreshAll();
      };
      c.oncontextmenu = (e) => {
        e.preventDefault();
        if (this.open.shop) this.g.sell(uid);
        else if (this.open.stash) this.g.toStash(uid);
        else if (e.shiftKey) { const i = this.ch.inv.findIndex((x) => x.uid === uid); if (i >= 0) this.ch.inv.splice(i, 1); }
        hideTip();
        this.app.ui.refreshAll();
      };
    }
  }

  // ---------- Võ công ----------
  r_skills() {
    const ch = this.ch, P = phaiOf(ch);
    const rows = P.skills.map((s) => {
      const lvl = s.id === 'basic' ? 1 : ch.skills[s.id] || 0;
      const unlocked = skillUnlocked(ch, s);
      const need = !ch.phai ? 'Cần nhập môn phái' : ch.lv < s.lv ? `Cần cấp ${s.lv}` : s.q && !ch.quests[s.q]?.done ? `Cần xong nhiệm vụ "${Q.QUESTS[s.q].name}"` : '';
      const d = s.type === 'buff' ? `Hỗ trợ · ${s.dur}s · ` + Object.entries(s.buff).map(([k, v]) => `${k} +${Math.round(lvVal(v, Math.max(1, lvl)))}`).join(', ')
        : s.type === 'heal' ? `Hồi ${Math.round(lvVal(s.heal, Math.max(1, lvl)) * 100)}% sinh lực`
        : `${{ melee: 'Cận chiến', cleave: 'Đánh lan', proj: 'Tầm xa', area: 'Diện rộng', nova: 'Quanh thân' }[s.shape]} · ${Math.round(lvVal(s.mult, Math.max(1, lvl)) * 100)}% sát thương${s.count > 1 ? ` · ${s.count} đạn` : ''}`;
      const mp = s.mp ? ` · ${Math.round(lvVal(s.mp, Math.max(1, lvl)))} nội lực` : '';
      const atk = s.type === 'atk';
      return `<div class="sk-row ${unlocked && (lvl || s.id === 'basic') ? '' : 'lock'}">
        ${iconHtml(s.icon)}
        <div><b>${esc(s.name)}</b> <span class="muted">${s.id === 'basic' ? '' : `${lvl}/${SKILL_MAX}`}</span>
          <div class="d">${d}${mp}${s.cd ? ` · hồi ${s.cd}s` : ''}</div>${need ? `<div class="d" style="color:var(--bad)">${need}</div>` : ''}</div>
        <div class="sk-acts">
          ${s.id !== 'basic' ? `<button class="btn small" data-learn="${s.id}" ${unlocked && ch.skillPts > 0 && lvl < SKILL_MAX ? '' : 'disabled'} title="Cộng 1 điểm kỹ năng">+</button>` : ''}
          ${atk && (lvl || s.id === 'basic') ? `<button class="btn small" data-key="left" data-sk="${s.id}" ${ch.keys.left === s.id ? 'style="border-color:var(--edge-hi)"' : ''}>Trái</button>` : ''}
          ${(lvl || s.id === 'basic') ? `<button class="btn small" data-key="right" data-sk="${s.id}" ${ch.keys.right === s.id ? 'style="border-color:var(--edge-hi)"' : ''}>Phải</button>` : ''}
        </div></div>`;
    }).join('');
    return `<p class="muted" style="margin:0 0 6px">Điểm kỹ năng còn: <b style="color:var(--gold)">${ch.skillPts}</b> · ${ch.phai ? PHAI[ch.phai].name : 'Tân thủ'}</p>${rows}
      <p class="muted" style="font-size:11px">Gán skill vào chuột trái/phải. Skill hỗ trợ gán vào chuột phải rồi bấm chuột phải để tự thi triển; auto tự bật lại khi hết.</p>`;
  }
  b_skills(body) {
    for (const b of $$('[data-learn]', body)) b.onclick = () => {
      const s = phaiOf(this.ch).skills.find((x) => x.id === b.dataset.learn);
      const cur = this.ch.skills[s.id] || 0;
      if (this.ch.skillPts > 0 && cur < SKILL_MAX) { this.ch.skills[s.id] = cur + 1; this.ch.skillPts--; }
      this.app.ui.refreshAll();
    };
    for (const b of $$('[data-key]', body)) b.onclick = () => { this.ch.keys[b.dataset.key] = b.dataset.sk; this.app.ui.refreshAll(); };
  }

  // ---------- Nhiệm vụ ----------
  r_quests() {
    const ch = this.ch;
    const act = Q.active(ch), done = Q.QUEST_IDS.filter((id) => ch.quests[id]?.done);
    const row = (id) => {
      const q = Q.QUESTS[id];
      return `<div style="margin-bottom:10px"><b style="color:var(--quest)">${esc(q.name)}</b>${Q.ready(ch, id) ? ' <span style="color:var(--good)">· xong, về trả</span>' : ''}<div>${esc(q.text)}</div><div class="muted">${Q.progressText(ch, id)} · Người giao: ${q.giver === 'quest' ? 'Lý Bộ Đầu (Ba Lăng Huyện)' : 'Sứ giả môn phái (Tương Dương)'}</div></div>`;
    };
    return `<h3>Đang làm</h3>${act.length ? act.map(row).join('') : '<p class="muted">Không có. Gặp Lý Bộ Đầu ở Ba Lăng Huyện hoặc sứ giả môn phái ở Tương Dương.</p>'}
      <h3>Đã xong</h3><p class="muted">${done.map((id) => Q.QUESTS[id].name).join(' · ') || '—'}</p>`;
  }

  // ---------- NPC ----------
  r_npc({ npc }) {
    const ch = this.ch;
    const face = `<img src="./a/portraits/${npc.face || 'male01'}.webp" alt="">`;
    let text = '', acts = [];
    if (npc.role === 'travel') {
      text = 'Khách quan muốn đi đâu? Xe ngựa của ta chạy khắp các thành trấn và bãi luyện công.';
      acts = this.g.travelList().map((t) => [`${t.name}${t.lv ? ` <span class="muted">(cấp ${t.lv[0]}-${t.lv[1]})</span>` : ''} — ${t.cost} lượng`, `travel:${t.id}:${t.ret ? 1 : 0}`]);
    } else if (npc.role === 'shop') {
      text = { duoc: 'Kim Sáng Dược, Thanh Tâm Tán — thuốc tốt giá phải chăng!', taphoa: 'Thổ Địa Phù đưa khách quan về thành trong chớp mắt.', thoren: 'Binh khí, giáp trụ mới rèn đây. Đồ cũ ta cũng thu mua.' }[npc.shop];
      acts = [['Mua bán', 'shop'], ['Thôi', 'close']];
    } else if (npc.role === 'stash') {
      text = 'Đồ gửi ở chỗ ta, thành nào cũng lấy ra được.';
      acts = [['Mở rương', 'stash'], ['Thôi', 'close']];
    } else if (npc.role === 'quest') {
      text = 'Ba Lăng Huyện dạo này không yên. Ngươi giúp được gì thì giúp.';
      for (const id of Q.QUEST_IDS) if (Q.QUESTS[id].giver === 'quest' && Q.ready(ch, id)) acts.push([`Trả nhiệm vụ: ${Q.QUESTS[id].name}`, `done:${id}`]);
      for (const id of Q.available(ch, 'quest')) acts.push([`Nhận nhiệm vụ: ${Q.QUESTS[id].name}`, `take:${id}`]);
      const act = Q.active(ch).filter((id) => Q.QUESTS[id].giver === 'quest' && !Q.ready(ch, id));
      if (act.length) text = esc(Q.QUESTS[act[0]].text) + `<br><span class="muted">${Q.progressText(ch, act[0])}</span>`;
      acts.push(['Tạm biệt', 'close']);
    } else if (npc.role === 'envoy') {
      const P = PHAI[npc.phai];
      text = `${P.name} — hệ ${ELEM[P.elem].name}. ${P.desc}`;
      if (!ch.phai) {
        const why = this.g.canJoin(npc.phai);
        acts.push([why ? `Bái sư (${why})` : `Bái sư ${P.name}`, why ? 'noop' : `join:${npc.phai}`]);
      } else if (ch.phai === npc.phai) {
        for (const id of Q.QUEST_IDS) if (Q.QUESTS[id].giver === 'envoy' && Q.ready(ch, id)) acts.push([`Trả nhiệm vụ: ${Q.QUESTS[id].name}`, `done:${id}`]);
        for (const id of Q.available(ch, 'envoy')) acts.push([`Nhận nhiệm vụ: ${Q.QUESTS[id].name}`, `take:${id}`]);
        const act = Q.active(ch).filter((id) => Q.QUESTS[id].giver === 'envoy' && !Q.ready(ch, id));
        if (act.length) text = esc(Q.QUESTS[act[0]].text) + `<br><span class="muted">${Q.progressText(ch, act[0])}</span>`;
        else if (!acts.length) {
          const next = Q.QUEST_IDS.find((id) => Q.QUESTS[id].giver === 'envoy' && !ch.quests[id]);
          text += next ? `<br><span class="muted">Đạt cấp ${Q.QUESTS[next].lv} hãy quay lại tìm ta.</span>` : '<br>Ngươi đã xuất sư, võ công đại thành!';
        }
      } else text += '<br><span class="muted">Ngươi đã có sư môn.</span>';
      acts.push(['Tạm biệt', 'close']);
    }
    return `<div class="dlg">${face}<div><p><b style="color:var(--gold)">${esc(npc.name)}</b><br>${text}</p><div class="dlg-acts">${acts.map(([l, a]) => `<button class="btn" data-act="${a}">${l}</button>`).join('')}</div></div></div>`;
  }
  b_npc(body, { npc }) {
    for (const b of $$('[data-act]', body)) b.onclick = () => {
      const [a, x, y] = b.dataset.act.split(':');
      if (a === 'close') this.close('npc');
      else if (a === 'travel') { this.closeAll(); this.g.travel(x, y === '1'); }
      else if (a === 'shop') { this.show('shop', { shop: npc.shop, title: npc.name }); this.show('inv'); }
      else if (a === 'stash') { this.show('stash'); this.show('inv'); }
      else if (a === 'take') { this.g.acceptQuest(x); this.render('npc'); }
      else if (a === 'done') { this.g.completeQuest(x); this.render('npc'); }
      else if (a === 'join') { this.g.join(x); this.app.scene.ensureOutfit(this.ch); this.render('npc'); }
      this.app.ui.refreshAll();
    };
  }

  // ---------- Cửa hàng ----------
  r_shop(d) {
    d.list = this.g.shopList(d.shop);
    const rows = d.list.map((e, i) => {
      if (e.item) return `<div class="row">${cellHtml(e.item, { attrs: ` data-price="${e.price}"` })}<span style="color:var(--r-white)">${esc(e.item.name)} <span class="muted">cấp ${e.item.lvReq}</span></span><span class="price">${fmt(e.price)}</span><button class="btn small" data-buy="${i}">Mua</button></div>`;
      return `<div class="row">${iconHtml(e.icon)}<span>${esc(e.name)}${e.hp ? ` <span class="muted">+${e.hp} SL</span>` : e.mp ? ` <span class="muted">+${e.mp} NL</span>` : ''}</span><span class="price">${fmt(e.price)}</span><span><input class="qty" type="number" min="1" max="50" value="${e.id === 'tdp' ? 3 : 20}" data-q="${i}"> <button class="btn small" data-buy="${i}">Mua</button></span></div>`;
    }).join('');
    return `<div class="list">${rows}</div><p class="muted" style="font-size:11px">Bán đồ: chuột phải vào đồ trong Hành Trang. Bạn có <b style="color:var(--gold)">${fmt(this.ch.money)}</b> lượng.</p>`;
  }
  b_shop(body, d) {
    for (const b of $$('[data-buy]', body)) b.onclick = () => {
      const e = d.list[+b.dataset.buy];
      const q = $(`[data-q="${b.dataset.buy}"]`, body);
      this.g.buy(e, e.item ? 1 : Math.max(1, Math.min(50, +(q?.value || 1))));
      this.app.ui.refreshAll();
    };
  }

  // ---------- Rương ----------
  r_stash() {
    const cells = [];
    for (let i = 0; i < STASH_SIZE; i++) cells.push(cellHtml(this.ch.stash[i], { size: 38 }));
    return `<div class="bag">${cells.join('')}</div><p class="muted" style="font-size:11px">Chuột trái vào đồ trong rương để lấy ra. Chuột phải vào đồ trong Hành Trang để cất.</p>`;
  }
  b_stash(body) {
    for (const c of $$('[data-uid]', body)) c.onclick = () => { this.g.fromStash(c.dataset.uid); hideTip(); this.app.ui.refreshAll(); };
  }

  // ---------- Auto ----------
  r_auto() {
    const a = this.ch.auto;
    const chk = (k, l) => `<label><input type="checkbox" data-pick="${k}" ${a.pick[k] ? 'checked' : ''}> ${l}</label>`;
    return `<div class="cfg">
        <span>Bán kính đánh quái</span><span><input type="range" min="4" max="20" value="${a.radius}" data-cfg="radius"> <b class="val">${a.radius} ô</b></span>
        <span>Uống thuốc sinh lực khi dưới</span><span><input type="range" min="10" max="90" step="5" value="${a.hp}" data-cfg="hp"> <b class="val">${a.hp}%</b></span>
        <span>Uống thuốc nội lực khi dưới</span><span><input type="range" min="0" max="90" step="5" value="${a.mp}" data-cfg="mp"> <b class="val">${a.mp}%</b></span>
      </div>
      <h3>Nhặt đồ</h3>
      <div class="checks">${chk('money', 'Tiền')}${chk('potion', 'Thuốc')}${chk('white', 'Đồ trắng')}${chk('blue', 'Đồ xanh')}${chk('gold', 'Hoàng Kim')}</div>
      <h3>Khác</h3>
      <div class="checks">
        <label><input type="checkbox" data-flag="buffs" ${a.buffs ? 'checked' : ''}> Tự bật skill hỗ trợ</label>
        <label><input type="checkbox" data-flag="alloc" ${a.alloc ? 'checked' : ''}> Tự cộng điểm khi lên cấp</label>
      </div>
      <p class="muted" style="font-size:11px">Auto đánh quái trong bán kính quanh chỗ bật, dùng skill chuột phải (hoặc skill mạnh nhất đủ nội lực). Hết thuốc sinh lực hoặc hành trang đầy thì tự dừng.</p>`;
  }
  b_auto(body) {
    const a = this.ch.auto;
    for (const r of $$('[data-cfg]', body)) r.oninput = () => { a[r.dataset.cfg] = +r.value; r.nextElementSibling.textContent = r.value + (r.dataset.cfg === 'radius' ? ' ô' : '%'); };
    for (const c of $$('[data-pick]', body)) c.onchange = () => { a.pick[c.dataset.pick] = c.checked; };
    for (const c of $$('[data-flag]', body)) c.onchange = () => { a[c.dataset.flag] = c.checked; };
  }

  // ---------- Hệ thống ----------
  r_menu() {
    return `<div class="dlg-acts">
        <button class="btn" data-m="save">Lưu game</button>
        <button class="btn" data-m="title">Lưu và về màn chọn nhân vật</button>
      </div>
      <h3>Điều khiển</h3>
      <div class="kv" style="font-size:12px">
        <span>Chuột trái</span><span>Đi / đánh / nói chuyện / nhặt đồ</span>
        <span>Chuột phải</span><span>Thi triển skill chuột phải</span>
        <span>Z</span><span>Bật / tắt auto</span>
        <span>1 · 2 · 3</span><span>Thuốc sinh lực · nội lực · Thổ Địa Phù</span>
        <span>F3/C · F4/I · F5/K · Q</span><span>Nhân vật · Hành trang · Võ công · Nhiệm vụ</span>
        <span>Tab · V · Alt · Space</span><span>Bản đồ · Ngồi · Hiện tên đồ · Nhặt đồ gần</span>
      </div>
      <h3>Ghi công</h3>
      <p class="muted" style="font-size:12px">Toàn bộ art lấy từ Flare: Empyrean Campaign (flareteam, CC-BY-SA 3.0) — Clint Bellanger, Justin Nichol và cộng đồng. Bản demo học tập, gameplay phỏng theo Võ Lâm Truyền Kỳ 1, không dùng tài nguyên gốc của Kingsoft/VNG.</p>`;
  }
  b_menu(body) {
    for (const b of $$('[data-m]', body)) b.onclick = () => {
      if (b.dataset.m === 'save') { this.app.save(); this.app.ui.toast('Đã lưu'); }
      else { this.app.save(); location.reload(); }
    };
  }
}
export { MAPS, CONSUMABLE };
