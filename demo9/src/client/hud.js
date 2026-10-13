// HUD kiểu CS 1.3: máu/giáp/giờ/tiền/đạn, radar, kill feed, menu mua, bảng điểm, thông báo giữa màn hình.
import { WEAPONS, EQUIP, BUY_MENU, RULES } from '../sim/constants.js';
import { placeName } from '../sim/map.js';

const $ = (id) => document.getElementById(id);
const WNAME = { ...Object.fromEntries(Object.entries(WEAPONS).map(([k, w]) => [k, w.name])), c4: 'C4', world: 'rơi', he: 'HE' };
const REASON = {
  elim: (w) => (w === 'T' ? 'Terrorists Win!' : 'Counter-Terrorists Win!'),
  bomb: () => 'Target Bombed! — Terrorists Win!',
  defuse: () => 'Bomb Defused! — Counter-Terrorists Win!',
  time: () => 'Hết giờ — Counter-Terrorists Win!',
};

export class Hud {
  constructor(game) {
    this.g = game;
    this.el = {};
    for (const id of ['hud', 'hp', 'armor', 'bl', 'time', 'timer', 'bombicon', 'money', 'moneydelta', 'mag', 'reserve', 'wname', 'ammo', 'scoreT', 'scoreCT', 'round', 'cross', 'scope', 'hurt', 'dmgdir', 'radar', 'place', 'killfeed', 'center', 'hint', 'progress', 'spec', 'buymenu', 'scoreboard', 'fps', 'moneybox'])
      this.el[id] = $(id);
    this.radar = this.el.radar.getContext('2d');
    this.radarBg = this.drawRadarBg();
    this.buyCat = null; // null = đóng, -1 = menu gốc, n = danh mục
    this.centerUntil = 0;
    this.lastMoney = null;
    this.moneyT = 0;
    this.hintText = '';
    this.feed = [];
  }

  show(v) { this.el.hud.classList.toggle('hidden', !v); }

  center(html, dur = 3) {
    this.el.center.innerHTML = html;
    this.centerUntil = performance.now() + dur * 1000;
  }

  onEvents(events, me) {
    for (const e of events) {
      if (e.type === 'kill') {
        const k = e.a ? `<span class="${e.a.team}">${esc(e.a.name)}</span>` : '';
        const div = document.createElement('div');
        if (me && (e.a === me || e.victim === me)) div.className = 'me';
        div.innerHTML = `${k}<span class="w">${e.headshot ? '<span class="hs">⌖HS</span>' : ''}${WNAME[e.weapon] ?? e.weapon}</span><span class="${e.victim.team}">${esc(e.victim.name)}</span>`;
        this.el.killfeed.prepend(div);
        this.feed.push({ div, t: performance.now() });
        while (this.el.killfeed.children.length > 6) this.el.killfeed.lastChild.remove();
      } else if (e.type === 'roundEnd') {
        const sub = e.over ? `<small>KẾT THÚC TRẬN — ${this.g.score.T} : ${this.g.score.CT}. Bấm Esc để chơi lại</small>` : `<small>${this.g.score.T} : ${this.g.score.CT}</small>`;
        this.center(`<span style="color:${e.winner === 'T' ? 'var(--t)' : 'var(--ct)'}">${REASON[e.reason](e.winner)}</span>${sub}`, e.over ? 999 : 4.5);
      } else if (e.type === 'plant') this.center('<span style="color:var(--red)">Bomb has been planted!</span><small>Site ' + e.site + '</small>', 3);
      else if (e.type === 'go') this.center('', 0);
      else if (e.type === 'roundStart') { this.center(`Round ${e.round}<small>Bấm B để mua đồ</small>`, 3); this.closeBuy(); }
      else if (e.type === 'buyFail' && e.a === me) this.flashHint(e.msg);
      else if (e.type === 'hurt' && e.a === me) this.hurt(e, me);
      else if (e.type === 'bombPick' && e.a === me) this.flashHint('Bạn đã nhặt bom C4 — mang tới site A hoặc B, bấm 5 rồi giữ chuột trái để đặt');
    }
  }

  flashHint(msg) { this.hintText = msg; this.hintUntil = performance.now() + 2500; }

  hurt(e, me) {
    const h = this.el.hurt;
    h.classList.add('on');
    clearTimeout(this.hurtT);
    this.hurtT = setTimeout(() => h.classList.remove('on'), 80);
    if (e.by && e.by !== me) {
      const ang = Math.atan2(-(e.by.pos.x - me.pos.x), -(e.by.pos.z - me.pos.z)) - me.yaw;
      const i = document.createElement('i');
      i.style.transform = `rotate(${-ang}rad)`;
      this.el.dmgdir.append(i);
      setTimeout(() => { i.style.opacity = '0'; }, 400);
      setTimeout(() => i.remove(), 1500);
    }
  }

  // ---------- Menu mua ----------
  get buyOpen() { return this.buyCat !== null; }
  toggleBuy(me) {
    if (this.buyOpen) return this.closeBuy();
    if (!me?.alive) return;
    if (!this.g.canBuy(me)) { this.flashHint(this.g.now - this.g.roundStart > RULES.buyTime ? 'Hết thời gian mua đồ' : 'Phải ở trong khu spawn mới mua được'); return; }
    this.buyCat = -1;
    this.renderBuy(me);
  }
  closeBuy() { this.buyCat = null; this.el.buymenu.classList.add('hidden'); }
  buyKey(n, me) {
    if (!this.buyOpen) return false;
    if (n === 0) { this.buyCat === -1 ? this.closeBuy() : (this.buyCat = -1, this.renderBuy(me)); return true; }
    if (this.buyCat === -1) {
      const cat = BUY_MENU.find((c) => c.key === n);
      if (!cat) return true;
      if (cat.item) { this.g.buy(me, cat.item); this.renderBuy(me); return true; }
      this.buyCat = n;
    } else {
      const cat = BUY_MENU.find((c) => c.key === this.buyCat);
      const items = cat.items.filter((id) => !(WEAPONS[id] ?? EQUIP[id]).team || (WEAPONS[id] ?? EQUIP[id]).team === me.team);
      const id = items[n - 1];
      if (id && this.g.buy(me, id)) { this.closeBuy(); return true; }
    }
    this.renderBuy(me);
    return true;
  }
  renderBuy(me) {
    const m = this.el.buymenu, g = this.g;
    m.classList.remove('hidden');
    let html;
    if (this.buyCat === -1) {
      html = '<h3>Mua đồ</h3>' + BUY_MENU.map((c) => {
        const price = c.item ? `<span class="price">$${EQUIP[c.item].price}</span>` : '';
        return `<div class="it" data-k="${c.key}"><span><span class="k">${c.key}.</span>${c.name}</span>${price}</div>`;
      }).join('');
    } else {
      const cat = BUY_MENU.find((c) => c.key === this.buyCat);
      const items = cat.items.filter((id) => !(WEAPONS[id] ?? EQUIP[id]).team || (WEAPONS[id] ?? EQUIP[id]).team === me.team);
      html = `<h3>${cat.name}</h3>` + items.map((id, i) => {
        const def = WEAPONS[id] ?? EQUIP[id];
        const no = g.buyError(me, id) ? ' no' : '';
        return `<div class="it${no}" data-k="${i + 1}"><span><span class="k">${i + 1}.</span>${def.name}</span><span class="price">$${g.priceOf(me, id)}</span></div>`;
      }).join('');
    }
    m.innerHTML = html + `<div class="it" data-k="0"><span><span class="k">0.</span>${this.buyCat === -1 ? 'Thoát' : 'Quay lại'}</span></div><div class="foot">Tiền: $${me.money} · bấm số hoặc click</div>`;
    m.querySelectorAll('.it').forEach((d) => d.addEventListener('mousedown', (ev) => { ev.stopPropagation(); this.buyKey(+d.dataset.k, me); }));
  }

  // ---------- Bảng điểm ----------
  scoreboard(show, me) {
    const sb = this.el.scoreboard;
    sb.classList.toggle('hidden', !show);
    if (!show) return;
    const g = this.g;
    const table = (team) => {
      const rows = g.team(team).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths).map((a) => {
        const st = a.alive ? (g.bomb.carrier === a && team === me?.team ? 'Bom' : '') : 'Chết';
        return `<tr class="${team}${a.alive ? '' : ' dead'}${a === me ? ' me' : ''}"><td>${esc(a.name)}${a.bot ? ' <small style="color:#777">BOT</small>' : ''}</td><td>${st}</td><td class="num">${team === me?.team || !me ? '$' + a.money : ''}</td><td class="num">${a.kills}</td><td class="num">${a.deaths}</td></tr>`;
      }).join('');
      return `<table><tr><th>${team === 'T' ? 'Terrorists' : 'Counter-Terrorists'} — ${g.score[team]}</th><th></th><th class="num">Tiền</th><th class="num">Kill</th><th class="num">Chết</th></tr>${rows}</table>`;
    };
    sb.innerHTML = `<h2><span>Bụi Sa Mạc · Round ${g.round}</span><span>Thắng ${RULES.winRounds} round trước</span></h2>${table('T')}${table('CT')}`;
  }

  // ---------- Radar ----------
  drawRadarBg() {
    const g = this.g, map = g.map;
    const c = document.createElement('canvas');
    c.width = map.W * 8; c.height = map.H * 8;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,0)';
    for (let z = 0; z < map.H; z++)
      for (let i = 0; i < map.W; i++) {
        if (map.solid[z * map.W + i]) continue;
        x.fillStyle = 'rgba(210,190,140,0.45)';
        x.fillRect(i * 8, z * 8, 8, 8);
      }
    x.fillStyle = 'rgba(120,90,50,0.6)';
    for (const b of map.boxes) if (b.mat === 'crate' || b.mat === 'pillar') x.fillRect(b.min[0] * 4, b.min[2] * 4, (b.max[0] - b.min[0]) * 4, (b.max[2] - b.min[2]) * 4);
    x.font = 'bold 40px sans-serif';
    x.fillStyle = 'rgba(255,80,60,0.8)';
    for (const k of ['A', 'B']) { const r = map.zones[k]; x.fillText(k, (r.x0 + r.x1) * 2 - 12, (r.z0 + r.z1) * 2 + 14); }
    return c;
  }

  drawRadar(viewer, me) {
    const ctx = this.radar, g = this.g, S = 200, scale = 4 * 0.55; // px trên canvas nền / mét
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.clip();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(viewer.yaw);
    const k = 0.55;
    ctx.scale(k, k);
    ctx.translate(-viewer.pos.x * 4, -viewer.pos.z * 4);
    ctx.drawImage(this.radarBg, 0, 0);
    const team = me?.team ?? viewer.team;
    for (const a of g.agents) {
      if (!a.alive || a === viewer) continue;
      if (a.team !== team) continue;
      ctx.fillStyle = a.team === 'T' ? '#e8b04a' : '#6fa8ff';
      ctx.beginPath(); ctx.arc(a.pos.x * 4, a.pos.z * 4, 9, 0, Math.PI * 2); ctx.fill();
    }
    const b = g.bomb;
    if ((b.state === 'dropped' && team === 'T') || b.state === 'planted') {
      ctx.fillStyle = b.state === 'planted' ? '#ff3030' : '#ffcc33';
      ctx.fillRect(b.pos.x * 4 - 9, b.pos.z * 4 - 9, 18, 18);
    }
    ctx.restore();
    // người xem ở giữa
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(S / 2, S / 2 - 9); ctx.lineTo(S / 2 - 6, S / 2 + 6); ctx.lineTo(S / 2 + 6, S / 2 + 6); ctx.fill();
    void scale;
  }

  // ---------- Mỗi frame ----------
  update(viewer, me, spread, fps) {
    const g = this.g, el = this.el, now = performance.now();
    if (!viewer) return;
    el.hp.textContent = viewer.hp;
    el.armor.textContent = viewer.armor;
    el.bl.classList.toggle('low', viewer.hp <= 25);
    const planted = g.phase === 'planted';
    el.timer.classList.toggle('hidden', planted);
    el.bombicon.classList.toggle('hidden', !planted);
    const tl = g.phase === 'freeze' ? g.phaseEnd - g.now : g.phase === 'live' ? g.timeLeft() : 0;
    const s = Math.ceil(Math.max(0, tl));
    el.time.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    el.timer.classList.toggle('low', g.phase === 'live' && s <= 15);
    el.money.textContent = viewer.money;
    if (this.lastMoney !== null && viewer === me && viewer.money !== this.lastMoney) {
      const d = viewer.money - this.lastMoney;
      el.moneydelta.textContent = (d > 0 ? '+' : '') + d;
      el.moneydelta.className = 'show ' + (d > 0 ? 'plus' : 'minus');
      clearTimeout(this.mdT);
      this.mdT = setTimeout(() => { el.moneydelta.className = d > 0 ? 'plus' : 'minus'; }, 1200);
    }
    this.lastMoney = viewer === me ? viewer.money : null;
    const gun = viewer.gun;
    el.ammo.classList.toggle('hidden', !gun && viewer.slot !== 4);
    if (gun) { el.mag.textContent = gun.mag; el.reserve.textContent = gun.reserve; }
    else if (viewer.slot === 4) { el.mag.textContent = viewer.inv[4]; el.reserve.textContent = ''; }
    el.wname.textContent = WNAME[viewer.weaponId] ?? '';
    el.scoreT.textContent = g.score.T;
    el.scoreCT.textContent = g.score.CT;
    el.round.textContent = `Round ${g.round}`;
    el.place.textContent = placeName(viewer.pos.x, viewer.pos.z);

    // Tâm ngắm co giãn theo độ lệch
    const gap = Math.min(60, 4 + spread * 900);
    const c = el.cross.children;
    c[0].style.top = `${-gap - 8}px`; c[1].style.top = `${gap}px`; c[2].style.left = `${-gap - 8}px`; c[3].style.left = `${gap}px`;
    el.cross.classList.toggle('hidden', !!viewer.scoped || !viewer.alive || viewer.weapon.sniper);
    el.scope.classList.toggle('hidden', !viewer.scoped);

    // Tiến trình đặt / gỡ bom
    let prog = null;
    if (viewer.plantStart >= 0) prog = ['Đang đặt bom…', (g.now - viewer.plantStart) / RULES.plantTime];
    else if (viewer.defuseStart >= 0) prog = [viewer.defuser ? 'Đang gỡ bom (có bộ gỡ)…' : 'Đang gỡ bom…', (g.now - viewer.defuseStart) / (viewer.defuser ? RULES.defuseKitTime : RULES.defuseTime)];
    el.progress.classList.toggle('hidden', !prog);
    if (prog) { el.progress.firstChild.textContent = prog[0]; el.progress.querySelector('i').style.width = `${Math.min(100, prog[1] * 100)}%`; }

    // Gợi ý
    let hint = '';
    if (this.hintUntil > now) hint = this.hintText;
    else if (me?.alive) {
      if (g.canBuy(me) && !this.buyOpen && g.round <= 2) hint = 'Bấm B để mua súng';
      else if (me.inv[5] && g.siteAt(me.pos) && me.slot !== 5) hint = 'Bạn đang ở site — bấm 5 rồi giữ chuột trái để đặt bom';
      else if (me.inv[5] && me.slot === 5 && g.siteAt(me.pos)) hint = 'Giữ chuột trái để đặt bom';
      else if (me.team === 'CT' && g.bomb.state === 'planted' && Math.hypot(me.pos.x - g.bomb.pos.x, me.pos.z - g.bomb.pos.z) < 1.5 && me.defuseStart < 0) hint = 'Giữ E để gỡ bom';
    }
    el.hint.textContent = hint;
    if (this.centerUntil && now > this.centerUntil) { el.center.innerHTML = ''; this.centerUntil = 0; }
    for (const f of this.feed) if (now - f.t > 7000) f.div.remove();
    this.feed = this.feed.filter((f) => now - f.t <= 7000);
    if (this.buyOpen && me && !g.canBuy(me)) this.closeBuy();

    // Đang xem người khác
    const spec = viewer !== me;
    el.spec.classList.toggle('hidden', !spec);
    if (spec) el.spec.innerHTML = `Đang xem: <span style="color:${viewer.team === 'T' ? 'var(--t)' : 'var(--ct)'};margin:0 6px">${esc(viewer.name)}</span> · click để đổi người`;
    this.drawRadar(viewer, me);
    el.fps.textContent = fps ? `${fps} fps` : '';
  }
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
