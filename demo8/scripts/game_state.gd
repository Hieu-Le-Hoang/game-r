extends Node
## Autoload "S": trạng thái nhân vật (sống qua đổi hero) + roll đồ kiểu Diablo.
## Port từ demo2/src/items.js.

const RAR := [
	{"n": "Thường", "c": Color("e6e1d6")},
	{"n": "Ma thuật", "c": Color("5aa2ff")},
	{"n": "Hiếm", "c": Color("ffd34d")},
	{"n": "Huyền thoại", "c": Color("ff8a2a")},
]

const BASES := {
	"weapon": [
		{"n": "Kiếm Hiệp Sĩ", "m": "sword_1handed", "d": [4, 7]},
		{"n": "Đại Kiếm", "m": "sword_2handed", "d": [7, 12]},
		{"n": "Rìu Chiến", "m": "axe_1handed", "d": [5, 9]},
		{"n": "Rìu Khổng Lồ", "m": "axe_2handed", "d": [8, 13]},
		{"n": "Dao Găm", "m": "dagger", "d": [3, 6]},
		{"n": "Trượng Pháp Sư", "m": "staff", "d": [4, 8]},
		{"n": "Đũa Phép", "m": "wand", "d": [3, 7]},
	],
	"shield": [
		{"n": "Khiên Tròn", "m": "shield_round", "a": [3, 6]},
		{"n": "Khiên Gai", "m": "shield_spikes", "a": [5, 9]},
		{"n": "Khiên Huy Hiệu", "m": "shield_badge", "a": [4, 8]},
	],
}

const PREFIX := [
	{"k": "dmgPct", "n": "Sắc Bén", "r": [10, 40], "t": "+%d%% sát thương"},
	{"k": "fire", "n": "Rực Lửa", "r": [2, 9], "t": "+%d sát thương lửa"},
	{"k": "atkSpd", "n": "Thần Tốc", "r": [6, 20], "t": "+%d%% tốc độ đánh"},
	{"k": "ls", "n": "Khát Máu", "r": [2, 6], "t": "Hút %d%% máu mỗi đòn"},
	{"k": "crit", "n": "Chí Mạng", "r": [3, 10], "t": "+%d%% tỉ lệ chí mạng"},
]
const SUFFIX := [
	{"k": "vit", "n": "của Gấu", "r": [3, 14], "t": "+%d Thể lực"},
	{"k": "str", "n": "của Hổ", "r": [3, 14], "t": "+%d Sức mạnh"},
	{"k": "dex", "n": "của Cáo", "r": [3, 14], "t": "+%d Nhanh nhẹn"},
	{"k": "int", "n": "của Cú", "r": [3, 14], "t": "+%d Trí tuệ"},
	{"k": "critDmg", "n": "của Đại Bàng", "r": [10, 45], "t": "+%d%% sát thương chí mạng"},
	{"k": "mf", "n": "của Thợ Săn", "r": [5, 25], "t": "+%d%% tỉ lệ rơi đồ hiếm"},
]
const RARE_A := ["Nanh", "Bóng", "Lời Nguyền", "Vết Cắt", "Tiếng Gầm", "Móng"]
const RARE_B := ["Bão Tố", "Huyết Nguyệt", "Hư Không", "Sấm Sét", "Tro Tàn", "Quạ Đen"]
const LEGEND := [
	{"n": "Nanh Phượng Hoàng", "p": "Mỗi đòn đánh có 25% bắn ra cầu lửa", "k": "fireProc"},
	{"n": "Lưỡi Hái Tháng Bảy", "p": "Quái bị hạ phát nổ, gây sát thương xung quanh", "k": "boom"},
	{"n": "Gió Lốc Vĩnh Cửu", "p": "Kỹ năng Q không tốn mana", "k": "freeSkill"},
]
const BAG_SIZE := 20

var hero := "Knight"
var lvl := 1
var xp := 0
var gold := 40
var hp := 1.0
var mp := 1.0
var bag: Array = []
var eq := {"weapon": null, "shield": null}
var quest := 0 # 0 chưa nhận, 1 đang làm, 2 xong chờ trả, 3 đã trả
var _uid := 1


func _ready() -> void:
	reset()


func reset() -> void:
	hero = "Knight"
	lvl = 1
	xp = 0
	gold = 40
	quest = 0
	bag = []
	eq = {
		"weapon": roll_item(1, {"kind": "weapon", "base": BASES.weapon[0], "rarity": 0}),
		"shield": roll_item(1, {"kind": "shield", "base": BASES.shield[0], "rarity": 0}),
	}
	bag.append(roll_item(3, {"kind": "weapon", "base": BASES.weapon[3], "rarity": 2}))
	bag.append(roll_item(2, {"kind": "weapon", "base": BASES.weapon[5], "rarity": 1}))
	for i in 3:
		bag.append(potion())
	var st := stats()
	hp = st.maxHp
	mp = st.maxMp


func rint(a: int, b: int) -> int:
	return randi_range(a, b)


func roll_rarity(boost := 0.0) -> int:
	var x := randf() * 100.0 - boost
	return 3 if x < 2.5 else 2 if x < 13.0 else 1 if x < 42.0 else 0


func potion() -> Dictionary:
	_uid += 1
	return {"id": _uid, "kind": "potion", "m": "bottle_A_green", "rarity": 0, "name": "Bình Hồi Máu", "ilvl": 1, "affixes": []}


func roll_item(ilvl: int, opt := {}) -> Dictionary:
	var r: int = opt.get("rarity", roll_rarity(opt.get("boost", 0.0)))
	if not opt.has("kind") and randf() < 0.15:
		return potion()
	var kind: String = opt.get("kind", "shield" if randf() < 0.28 else "weapon")
	var base: Dictionary = opt.get("base", BASES[kind].pick_random())
	var sc := 1.0 + ilvl * 0.12 + r * 0.15
	_uid += 1
	var it := {"id": _uid, "kind": kind, "m": base.m, "base": base.n, "rarity": r, "ilvl": ilvl, "affixes": []}
	if kind == "weapon":
		it.dmg = [roundi(base.d[0] * sc), roundi(base.d[1] * sc)]
	else:
		it.armor = roundi(rint(base.a[0], base.a[1]) * sc)
	var n: int = [0, rint(1, 2), rint(3, 4), 4][r]
	var pool: Array = []
	for a in PREFIX:
		var c: Dictionary = a.duplicate()
		c.pre = true
		pool.append(c)
	for a in SUFFIX:
		pool.append(a.duplicate())
	for i in n:
		if pool.is_empty():
			break
		var a: Dictionary = pool.pop_at(randi() % pool.size())
		var v := roundi((a.r[0] + randf() * (a.r[1] - a.r[0])) * (1.0 + ilvl * 0.05))
		it.affixes.append({"k": a.k, "v": v, "t": a.t % v, "n": a.n, "pre": a.get("pre", false)})
	if r == 3:
		var L: Dictionary = opt.get("legend", LEGEND.pick_random())
		it.name = L.n
		it.power = L
	elif r == 2:
		it.name = "%s %s" % [RARE_A.pick_random(), RARE_B.pick_random()]
	else:
		var parts: Array = [base.n]
		for a in it.affixes:
			if a.pre:
				parts.append(a.n)
				break
		for a in it.affixes:
			if not a.pre:
				parts.append(a.n)
				break
		it.name = " ".join(parts)
	return it


func sell_price(it: Dictionary) -> int:
	return 4 + it.rarity * 14 + it.ilvl


func stats() -> Dictionary:
	var s := {"dmg": [1, 3], "armor": 0, "dmgPct": 0, "fire": 0, "atkSpd": 0, "ls": 0, "crit": 5.0, "critDmg": 50,
		"vit": 0, "str": 0, "dex": 0, "int": 0, "mf": 0, "powers": {}}
	for it in [eq.weapon, eq.shield]:
		if it == null:
			continue
		if it.has("dmg"):
			s.dmg = it.dmg.duplicate()
		if it.has("armor"):
			s.armor += it.armor
		for a in it.affixes:
			s[a.k] += a.v
		if it.has("power"):
			s.powers[it.power.k] = true
	s.maxHp = 80 + lvl * 12 + s.vit * 5
	s.maxMp = 50 + lvl * 8 + s["int"] * 3
	s.crit += s.dex * 0.3
	s.mult = 1.0 + (s.dmgPct + s["str"]) / 100.0
	s.speed = 1.15 * (1.0 + s.atkSpd / 100.0)
	return s


func xp_need() -> int:
	return 30 + lvl * 25


func potions() -> int:
	return bag.filter(func(i): return i.kind == "potion").size()
