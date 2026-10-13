// Điều phối: giữ nhân vật, world của map hiện tại, auto; xử lý chuyển map (cổng, xa phu, Thổ Địa Phù, hồi sinh),
// giao dịch NPC (mua/bán/rương), nhiệm vụ, nhập phái. Dùng chung cho game thật và selftest.
import { World } from './world.js';
import { Auto } from './auto.js';
import { MAPS, travelCost } from './data/world.js';
import { PHAI } from './data/phai.js';
import { gainXp, starterWeapon, INV_SIZE, STASH_SIZE, autoAlloc, autoLearn } from './char.js';
import { CONSUMABLE, makeStack, makeItem, sellPrice, canEquip } from './items.js';
import * as Q from './quests.js';

export class Game {
  /** getMap(id) -> JSON map (đồng bộ, đã tải sẵn) */
  constructor({ ch, getMap, rng }) {
    this.ch = ch;
    this.getMap = getMap;
    this.rng = rng;
    this.ev = [];
    this.auto = new Auto(this);
    this.world = null;
  }
  emit(e) { this.ev.push(e); }
  msg(text, kind = 'info') { this.emit({ t: 'msg', text, kind }); }

  enter(mapId, pos) {
    if (this.world) this.world.snapshot();
    const ch = this.ch;
    if (MAPS[mapId].town) ch.town = mapId;
    this.world = new World({ mapId, map: this.getMap(mapId), ch, rng: this.rng, pos });
    ch.map = mapId;
    this.emit({ t: 'enter', map: mapId });
    return this.world;
  }

  update(dt) {
    const w = this.world;
    w.update(dt);
    this.auto.update(dt);
    this.ch.played += dt;
    // sự kiện cần điều phối ở tầng game
    for (const e of w.ev) {
      if (e.t === 'portal') { this.auto.stop(); this.go(e.to, e.via); }
      else if (e.t === 'respawn') { this.auto.stop(); this.ch.hp = null; this.ch.mp = null; this.enter(e.to); }
      this.ev.push(e);
    }
    w.ev.length = 0;
  }

  /** Chuyển map: về thành thì đứng ở điểm vào thành, ra map luyện công thì đứng ở cổng */
  go(to, via) {
    this.enter(to);
    this.msg(`${via === 'tdp' ? 'Thổ Địa Phù đưa bạn về' : 'Đến'} ${MAPS[to].name}`, 'info');
  }

  // ---------- xa phu ----------
  travelList() {
    const from = this.world.id, out = [];
    for (const id of ['balang', 'tuongduong', 'm1', 'm2', 'm3', 'm4']) {
      if (id === from) continue;
      out.push({ id, name: MAPS[id].name, lv: MAPS[id].lv, cost: travelCost(from, id) });
    }
    const r = this.ch.ret;
    if (r && r.map !== from) out.unshift({ id: r.map, name: `Quay lại chỗ cũ (${MAPS[r.map].name})`, cost: travelCost(from, r.map), ret: true });
    return out;
  }
  travel(id, ret) {
    const cost = travelCost(this.world.id, id);
    if (this.ch.money < cost) { this.msg('Không đủ tiền đi xe', 'bad'); return false; }
    this.ch.money -= cost;
    const pos = ret && this.ch.ret ? [this.ch.ret.x, this.ch.ret.y] : null;
    if (ret) this.ch.ret = null;
    this.enter(id, pos);
    this.msg(`Xa phu đưa bạn đến ${MAPS[id].name}`, 'info');
    return true;
  }

  // ---------- cửa hàng ----------
  shopList(shop) {
    const lv = this.ch.lv;
    if (shop === 'duoc') return ['hp1', 'hp2', 'hp3', 'mp1', 'mp2', 'mp3'].filter((id) => !CONSUMABLE[id].lv || lv >= CONSUMABLE[id].lv - 5)
      .map((id) => ({ id, ...CONSUMABLE[id] }));
    if (shop === 'taphoa') return [{ id: 'tdp', ...CONSUMABLE.tdp }];
    return this.smithStock();
  }
  smithStock() {
    // thợ rèn: đồ trắng cấp hiện tại, đổi hàng mỗi lần vào thành
    if (!this._smith || this._smith.lv !== this.ch.lv || this._smith.map !== this.world.id) {
      const items = [];
      const phai = this.ch.phai;
      if (phai) items.push(starterWeapon(this.rng, phai, this.ch.lv));
      for (const b of ['armor', 'helm', 'gloves', 'boots', 'belt']) items.push(makeItem(this.rng, b, this.ch.lv, { rarity: 'white' }));
      this._smith = { lv: this.ch.lv, map: this.world.id, items };
    }
    return this._smith.items.map((it) => ({ ...it, price: Math.round(it.price * 1.5), item: it }));
  }
  buy(entry, qty = 1) {
    const ch = this.ch, w = this.world;
    const cost = entry.price * qty;
    if (ch.money < cost) { this.msg('Không đủ tiền', 'bad'); return false; }
    const it = entry.item ? entry.item : makeStack(entry.id, qty);
    if (!w.addItem(it)) { this.msg('Hành trang đầy', 'bad'); return false; }
    ch.money -= cost;
    if (entry.item) this._smith.items = this._smith.items.filter((x) => x !== entry.item);
    return true;
  }
  sell(uid) {
    const ch = this.ch, i = ch.inv.findIndex((x) => x.uid === uid);
    if (i < 0) return false;
    const it = ch.inv[i];
    ch.money += sellPrice(it);
    ch.inv.splice(i, 1);
    return true;
  }

  // ---------- trang bị ----------
  equip(uid, slot) {
    const ch = this.ch, i = ch.inv.findIndex((x) => x.uid === uid);
    if (i < 0) return false;
    const it = ch.inv[i];
    const why = canEquip(it, ch);
    if (why) { this.msg(why, 'bad'); return false; }
    let s = slot || it.slot;
    if (it.base === 'ring' && !slot) s = !ch.eq.ring1 ? 'ring1' : !ch.eq.ring2 ? 'ring2' : 'ring1';
    if (it.base === 'ring' && s !== 'ring1' && s !== 'ring2') s = 'ring1';
    if (it.base !== 'ring' && s !== it.slot) s = it.slot;
    const old = ch.eq[s];
    ch.eq[s] = it;
    ch.inv.splice(i, 1);
    if (old) ch.inv.push(old);
    this.world.recalc();
    this.emit({ t: 'equip' });
    return true;
  }
  unequip(slot) {
    const ch = this.ch;
    if (!ch.eq[slot]) return false;
    if (ch.inv.length >= INV_SIZE) { this.msg('Hành trang đầy', 'bad'); return false; }
    ch.inv.push(ch.eq[slot]);
    ch.eq[slot] = null;
    this.world.recalc();
    this.emit({ t: 'equip' });
    return true;
  }

  // ---------- rương ----------
  toStash(uid) {
    const ch = this.ch, i = ch.inv.findIndex((x) => x.uid === uid);
    if (i < 0 || ch.stash.length >= STASH_SIZE) return false;
    ch.stash.push(ch.inv.splice(i, 1)[0]);
    return true;
  }
  fromStash(uid) {
    const ch = this.ch, i = ch.stash.findIndex((x) => x.uid === uid);
    if (i < 0 || ch.inv.length >= INV_SIZE) return false;
    ch.inv.push(ch.stash.splice(i, 1)[0]);
    return true;
  }

  // ---------- môn phái + nhiệm vụ ----------
  canJoin(phai) {
    const ch = this.ch, P = PHAI[phai];
    if (ch.phai) return 'Đã có môn phái';
    if (ch.lv < 10) return 'Cần đạt cấp 10';
    if (P.elem !== ch.elem) return `${P.name} chỉ nhận đệ tử hệ ${P.elem === 'kim' ? 'Kim' : P.elem === 'moc' ? 'Mộc' : P.elem === 'thuy' ? 'Thủy' : P.elem === 'hoa' ? 'Hỏa' : 'Thổ'}`;
    if (!P.genders.includes(ch.gender)) return `${P.name} không nhận đệ tử ${ch.gender === 'm' ? 'nam' : 'nữ'}`;
    return null;
  }
  join(phai) {
    const why = this.canJoin(phai);
    if (why) { this.msg(why, 'bad'); return false; }
    const ch = this.ch, P = PHAI[phai];
    ch.phai = phai;
    ch.skills = { basic: 1 };
    const first = P.skills[1];
    ch.skills[first.id] = 1;
    ch.keys = { left: 'basic', right: first.id };
    const w = starterWeapon(this.rng, phai, ch.lv);
    if (!this.world.addItem(w)) ch.stash.push(w);
    if (ch.auto.alloc) { autoAlloc(ch); autoLearn(ch); }
    this.world.recalc();
    this.emit({ t: 'join', phai });
    this.msg(`Bái sư ${P.name} thành công! Học được ${first.name}.`, 'good');
    return true;
  }
  acceptQuest(id) { Q.accept(this.ch, id); this.msg(`Nhận nhiệm vụ: ${Q.QUESTS[id].name}`, 'quest'); }
  completeQuest(id) {
    if (!Q.ready(this.ch, id)) return false;
    const r = Q.complete(this.ch, id), ch = this.ch;
    ch.money += r.money;
    for (const [sid, n] of r.give) this.world.addItem(makeStack(sid, n));
    const ups = gainXp(ch, r.xp);
    for (const lv of ups) this.world.onLevel(lv);
    if (ch.auto.alloc) autoLearn(ch);
    this.world.recalc();
    this.msg(`Hoàn thành "${Q.QUESTS[id].name}": +${r.xp} kinh nghiệm, +${r.money} lượng`, 'quest');
    this.emit({ t: 'quest', id });
    return true;
  }
}
