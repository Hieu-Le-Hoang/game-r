// Auto train (kiểu AutoVLBS rút gọn): tìm & đánh quái trong bán kính quanh điểm bật, xoay skill, uống thuốc theo ngưỡng,
// tự bật buff, nhặt đồ theo bộ lọc. Hết thuốc hoặc túi đầy -> dừng + báo. Không tự về thành (MVP).
import { phaiOf, skillUnlocked } from './char.js';
import { CONSUMABLE } from './items.js';

const THINK = 0.2;

export class Auto {
  constructor(game) {
    this.g = game;
    this.on = false;
    this.anchor = null;
    this.t = 0;
    this.stuck = { id: 0, since: 0, hp: 0 };
    this.reason = '';
  }
  get w() { return this.g.world; }
  get cfg() { return this.g.ch.auto; }

  /** anchor: điểm neo (mặc định chỗ đang đứng). Auto tự đi tới điểm neo, bị đánh dọc đường thì đánh trả. */
  start(anchor) {
    const w = this.w;
    if (w.def.town) { w.msg('Không dùng auto trong thành', 'bad'); return false; }
    if (w.p.dead) return false;
    this.on = true;
    this.anchor = anchor ? { x: anchor[0], y: anchor[1] } : { x: w.p.x, y: w.p.y };
    this.reason = '';
    w.msg(`Bật auto · bán kính ${this.cfg.radius} ô`, 'good');
    return true;
  }
  stop(reason = '') {
    if (!this.on) return;
    this.on = false;
    this.reason = reason;
    this.w.cmdStop();
    this.w.msg(reason ? `Dừng auto: ${reason}` : 'Tắt auto', reason ? 'bad' : 'info');
    this.g.emit({ t: 'autostop', reason });
  }
  toggle() { return this.on ? (this.stop(), false) : this.start(); }

  update(dt) {
    if (!this.on) return;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = THINK;
    const w = this.w, p = w.p, ch = this.g.ch, cfg = this.cfg, st = w.st;
    if (p.dead) { this.stop('nhân vật trọng thương'); return; }
    if (w.def.town) { this.stop(); return; }

    // 1. thuốc
    if (p.hp / st.maxHp * 100 < cfg.hp) {
      if (!w.drink('hp') && p.hp / st.maxHp < 0.2) { this.stop('hết thuốc hồi sinh lực'); return; }
    }
    if (p.mp / st.maxMp * 100 < cfg.mp) w.drink('mp');
    if (p.act) return;

    // 2. buff tự bật lại
    if (cfg.buffs) {
      for (const s of phaiOf(ch).skills) {
        if ((s.type === 'buff' && !p.buffs[s.id]) || (s.type === 'heal' && p.hp / st.maxHp < 0.55)) {
          if (ch.skills[s.id] && skillUnlocked(ch, s) && !w.canUse(s) && w.castSelf(s.id)) return;
        }
      }
    }

    // 3. nhặt đồ
    const R = cfg.radius;
    const g = p.goal;
    if (g?.type === 'pick') return;
    const want = (d) => {
      if (d.bad && w.t - d.bad < 30) return false;
      if (d.money) return cfg.pick.money;
      const it = d.item;
      if (it.stack) return cfg.pick.potion && CONSUMABLE[it.id] && !!(CONSUMABLE[it.id].hp || CONSUMABLE[it.id].mp);
      return !!cfg.pick[it.rarity];
    };
    const loot = w.drops.filter((d) => want(d) && Math.hypot(d.x - this.anchor.x, d.y - this.anchor.y) <= R + 2)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    const fighting = g?.type === 'attack' && w.monById(g.id) && !w.monById(g.id).dead;
    if (loot && (!fighting || Math.hypot(loot.x - p.x, loot.y - p.y) < 1.5)) {
      if (!loot.money && w.invFull() && !(loot.item.stack && w.invCount(loot.item.id))) { this.stop('hành trang đầy'); return; }
      w.cmdPick(loot);
      return;
    }

    // 4. đánh quái
    if (fighting && w.monById(g.id).state === 'return') w.cmdStop();
    else if (fighting) {
      const m = w.monById(g.id);
      if (this.stuck.id !== m.id) this.stuck = { id: m.id, since: w.t, hp: m.hp };
      else if (m.hp < this.stuck.hp) { this.stuck.since = w.t; this.stuck.hp = m.hp; }
      else if (w.t - this.stuck.since > 10) { m.badUntil = w.t + 20; w.cmdStop(); return; }
      g.skill = this.pickSkill(m);
      return;
    }
    // tự vệ: quái đang đuổi đánh mình ở gần thì đánh trả trước, kể cả ngoài bán kính
    const attacker = w.mons.filter((m) => !m.dead && m.state === 'chase' && !(m.badUntil > w.t) && Math.hypot(m.x - p.x, m.y - p.y) <= 5)
      .sort((a, b) => this.score(a) - this.score(b))[0];
    if (attacker) { w.cmdAttack(attacker, this.pickSkill(attacker)); return; }
    const target = w.mons.filter((m) => !m.dead && m.state !== 'return' && !(m.badUntil > w.t) && Math.hypot(m.x - this.anchor.x, m.y - this.anchor.y) <= R)
      .sort((a, b) => this.score(a) - this.score(b))[0];
    if (target) { w.cmdAttack(target, this.pickSkill(target)); return; }

    // 5. không còn quái -> về điểm neo, lượn quanh chờ quái hồi sinh
    if (!g) {
      const d = Math.hypot(p.x - this.anchor.x, p.y - this.anchor.y);
      if (d > 2.5) w.cmdMove(this.anchor.x, this.anchor.y);
      else if (this.g.rng() < 0.05) {
        const a = this.g.rng() * Math.PI * 2, r = this.g.rng() * R * 0.6;
        const x = this.anchor.x + Math.cos(a) * r, y = this.anchor.y + Math.sin(a) * r;
        if (w.grid.ok(x, y)) w.cmdMove(x, y);
      }
    }
  }

  // quái gần mình nhất, ưu tiên con đang đánh mình
  score(m) {
    const p = this.w.p;
    return Math.hypot(m.x - p.x, m.y - p.y) - (m.state === 'chase' ? 3 : 0);
  }

  /** Skill tấn công: phím chuột phải nếu dùng được, không thì skill mạnh nhất đủ nội lực */
  pickSkill(m) {
    const w = this.w, ch = this.g.ch;
    const list = phaiOf(ch).skills.filter((s) => s.type === 'atk' && (s.id === 'basic' || ch.skills[s.id]) && skillUnlocked(ch, s));
    const right = list.find((s) => s.id === ch.keys.right);
    if (right && !w.canUse(right)) return right.id;
    // gom quái: nhiều quái quanh mục tiêu thì ưu tiên skill diện rộng
    const crowd = w.monsNear(m.x, m.y, 2.5).length;
    const ok = list.filter((s) => !w.canUse(s));
    ok.sort((a, b) => this.value(b, crowd) - this.value(a, crowd));
    return (ok[0] || list[0]).id;
  }
  value(s, crowd) {
    const lvl = s.id === 'basic' ? 1 : this.g.ch.skills[s.id] || 1;
    let v = s.mult[0] + s.mult[1] * (lvl - 1);
    if (s.shape === 'nova' || s.shape === 'area' || s.shape === 'cleave') v *= 0.55 + 0.45 * crowd;
    if (s.shape === 'proj' && s.count > 1) v *= Math.min(s.count, 0.6 + crowd * 0.8) * 0.75;
    if (s.cd) v *= 1.15;   // skill có hồi chiêu dùng ngay khi sẵn sàng
    return v;
  }
}
