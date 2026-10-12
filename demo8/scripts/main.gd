extends Node3D
## Hầm Mộ Vua Xương (Godot) — port gameplay demo2 (Three.js) sang Godot 4.
## Map lưới 4 đơn vị/ô, va chạm tự viết (lưới + hình tròn) giống demo2 để so A/B công bằng.

const C := 4.0
const MAP := [
	"#############",
	"#tttt#hhhhhh#",
	"#tttt.hhhhhh#",
	"#tttt#hhhhhh#",
	"######hhhhhh#",
	"#cccc.hhhhhh#",
	"#cccc########",
	"#cccc########",
	"#############",
]
const DOORS := [[24.0, 10.0, PI / 2], [20.0, 22.0, PI / 2]]
const AREAS := {
	"t": ["Quán Rượu Đầu Hầm", "Khu an toàn"],
	"h": ["Đại Sảnh Xương Khô", "Cẩn thận phía trước"],
	"c": ["Hầm Mộ Vua Xương", "Trùm cuối"],
}
const HEROES := {
	"Knight": {
		"key": "Knight", "name": "Hiệp Sĩ Aldric", "style": "melee", "idle": "Idle",
		"hide": ["1H_Sword_Offhand", "Badge_Shield", "Rectangle_Shield", "Spike_Shield", "1H_Sword", "2H_Sword", "Round_Shield"],
		"atk": ["1H_Melee_Attack_Slice_Diagonal", "1H_Melee_Attack_Chop"], "skill": "2H_Melee_Attack_Spin", "skillName": "Lốc Xoáy",
		"atkIcon": "sword_1handed", "skillIcon": "axe_2handed",
	},
	"Barbarian": {
		"key": "Barbarian", "name": "Chiến Binh Brann", "style": "melee", "idle": "2H_Melee_Idle",
		"hide": ["1H_Axe_Offhand", "Barbarian_Round_Shield", "1H_Axe", "2H_Axe", "Mug"],
		"atk": ["2H_Melee_Attack_Chop", "1H_Melee_Attack_Chop"], "skill": "2H_Melee_Attack_Spin", "skillName": "Lốc Xoáy",
		"atkIcon": "axe_2handed", "skillIcon": "axe_1handed",
	},
	"Mage": {
		"key": "Mage", "name": "Pháp Sư Lyra", "style": "magic", "idle": "Idle",
		"hide": ["Spellbook", "Spellbook_open", "1H_Wand", "2H_Staff"],
		"atk": ["Spellcast_Shoot"], "skill": "Spellcast_Long", "skillName": "Nova Băng",
		"atkIcon": "wand", "skillIcon": "staff",
	},
}
const ENEMIES := {
	"minion": {"key": "Skeleton_Minion", "name": "Lính Xương", "hp": 34, "dmg": [4, 7], "spd": 3.4, "range": 1.7, "atk": "Unarmed_Melee_Attack_Punch_A", "hitT": 0.4, "cd": 1.3, "xp": 9, "run": "Running_A"},
	"warrior": {"key": "Skeleton_Warrior", "name": "Chiến Binh Xương", "hp": 60, "dmg": [6, 10], "spd": 2.9, "range": 1.9, "atk": "1H_Melee_Attack_Chop", "hitT": 0.45, "cd": 1.6, "xp": 15, "weapon": "Skeleton_Blade", "shield": "Skeleton_Shield_Small_A", "run": "Walking_D_Skeletons"},
	"mage": {"key": "Skeleton_Mage", "name": "Pháp Sư Xương", "hp": 40, "dmg": [7, 11], "spd": 2.6, "range": 8.0, "atk": "Spellcast_Shoot", "hitT": 0.5, "cd": 2.2, "xp": 16, "weapon": "Skeleton_Staff", "ranged": true, "run": "Walking_D_Skeletons"},
	"boss": {"key": "Skeleton_Warrior", "name": "Vua Xương Morvak", "hp": 520, "dmg": [12, 18], "spd": 2.7, "range": 2.9, "atk": "2H_Melee_Attack_Chop", "hitT": 0.55, "cd": 2.0, "xp": 150, "weapon": "Skeleton_Axe", "scale": 1.65, "boss": true, "run": "Running_A"},
}
const TORCH := Color("ff8a3c")
const SPIRIT := Color("3cf0c0")

@onready var cam: Camera3D = $Camera3D
@onready var sun: DirectionalLight3D = $Sun
@onready var world: Node3D = $World
@onready var fx: Fx = $Fx
@onready var hud: Hud = $Hud

var ST := {}
var enemies: Array = []
var npcs: Array = []
var chests: Array = []
var loot: Array = []
var bolts: Array = []
var walls: Array = []
var colliders: Array = []
var torches: Array = []
var timers: Array = []
var seen := {}
var area_seen := {}
var cd := {"q": 0.0, "e": 0.0, "r": 0.0}
var now := 0.0
var shake := 0.0
var hall_total := 0
var area := ""
var hero: Actor
var def := {}
var state := "idle"
var target = null
var goal = null
var holding := false
var atk_ready := 0.0
var cancel_at := 0.0
var invuln := 0.0
var dash_v := Vector3.ZERO
var dash_end := 0.0
var combo := 0
var near_npc = null
var lyra: Dictionary
var brann: Dictionary
var started := false
var cam_look := Vector3.ZERO
var _ui_t := 0.0
var _mm_t := 0.0
var _motes: CPUParticles3D


# ---------- boot ----------
func _ready() -> void:
	hud.build(self)
	var keys := Assets.all_keys()
	for i in keys.size():
		Assets.preload_one(keys[i])
		if i % 6 == 0:
			hud.loading(float(i) / keys.size(), "Đang tải mô hình 3D… %d%%" % roundi(100.0 * i / keys.size()))
			await get_tree().process_frame
	hud.loading(1.0, "Dựng hầm ngục…")
	await get_tree().process_frame
	if DisplayServer.get_name() != "headless":
		await _make_icons()
	build_world()
	setup_npcs()
	for e in [["minion", 28.5, 8.0], ["warrior", 35.0, 9.5], ["minion", 45.0, 13.0], ["mage", 36.0, 14.5], ["warrior", 39.5, 21.0], ["minion", 27.5, 19.5], ["mage", 45.5, 18.0]]:
		spawn_enemy(e[0], e[1], e[2], {"dormant": true, "room": "h", "lvl": 2})
	hall_total = hall_left()
	spawn_enemy("boss", 12.5, 26.5, {"rot": 2.1, "room": "c", "lvl": 4})
	ST = S.stats()
	S.hp = ST.maxHp
	S.mp = ST.maxMp
	hud.hero_buttons(HEROES.values())
	spawn_hero("Knight", Vector3(8.5, 0, 13.5), PI * 0.85)
	for i in 4:
		var it := S.roll_item(2, {"rarity": i, "kind": "shield" if i == 0 else "weapon"})
		var to := Vector3(6.5 + i * 2.2, 0, 7)
		after(0.6 + i * 0.25, func(): drop_item(it, to + Vector3(0, 1.5, 0), to))
	cam_look = hero.position
	hud.vitals(ST)
	hud.quest()
	hud.loaded()
	started = true
	if OS.get_environment("DEMO8_SELFTEST") == "1":
		_selftest()
	elif OS.get_environment("DEMO8_SHOT") != "":
		_shots(OS.get_environment("DEMO8_SHOT"))


## Chụp vài cảnh cố định ra PNG (chạy dưới xvfb-run, render CPU) để soát hình khi không có màn hình.
func _shots(prefix: String) -> void:
	var wait := func(sec: float):
		var end := now + sec
		while now < end:
			await get_tree().process_frame
	var snap := func(name: String):
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s-%s.png" % [prefix, name])
		print("shot ", name)
	await wait.call(3.0)
	await snap.call("1-tavern")
	hero.position = Vector3(15.0, 0, 12.5)
	await wait.call(0.3)
	talk()
	await wait.call(0.3)
	await snap.call("1b-dialog")
	hud.dialog_confirm()
	hero.position = Vector3(30.0, 0, 13.0)
	await wait.call(2.5)
	attack()
	await wait.call(0.35)
	await snap.call("2-hall")
	switch_hero("Mage")
	S.mp = ST.maxMp
	skill()
	await wait.call(0.9)
	await snap.call("3-nova")
	hero.position = Vector3(12.5, 0, 22.5)
	invuln = now + 999
	await wait.call(2.2)
	await snap.call("4-boss")
	hud.toggle_inv()
	await wait.call(0.3)
	await snap.call("5-inventory")
	hud.toggle_inv()
	hero.position = Vector3(9.0, 0, 9.0)
	await wait.call(1.5)
	var q := hero.position
	fx.shock(q, Color("8fd8ff"), 5.0, 2.0)
	fx.slash(q + Vector3(-4, 0, 3.0), 0.0, Color("fff0c8"), 2.5)
	fx.telegraph(q + Vector3(3, 0, 0), 2.8, 2.0)
	fx.burst(q + Vector3(-3, 1, 0), {"count": 60, "colors": [Color("ffd36a"), Color("ff7a1a")], "speed": [2.0, 5.0], "life": 1.5, "size": [0.35, 0.0]})
	var orb := fx.orb(Color("7fc8ff"), 0.25)
	add_child(orb)
	orb.position = q + Vector3(-2, 1.4, 2)
	await wait.call(0.12)
	await snap.call("6-fx")
	get_tree().quit.call_deferred()


func after(sec: float, fn: Callable) -> void:
	timers.append({"t": now + sec, "fn": fn})


# ---------- helpers ----------
func cell_ch(x: float, z: float) -> String:
	var r := floori(z / C)
	var q := floori(x / C)
	if r < 0 or r >= MAP.size() or q < 0 or q >= MAP[0].length():
		return ""
	return MAP[r][q]


func floor_at(x: float, z: float) -> bool:
	var ch := cell_ch(x, z)
	return ch != "" and ch != "#"


func _fl(q: int, r: int) -> bool:
	if r < 0 or r >= MAP.size() or q < 0 or q >= MAP[0].length():
		return false
	return MAP[r][q] != "#"


func rint(a: int, b: int) -> int:
	return randi_range(a, b)


func face_to(n: Node3D, p: Vector3) -> void:
	n.rotation.y = atan2(p.x - n.position.x, p.z - n.position.z)


func ang_lerp(a: float, b: float, t: float) -> float:
	return a + wrapf(b - a, -PI, PI) * t


func damp(a: float, b: float, l: float, dt: float) -> float:
	return a + (b - a) * (1.0 - exp(-l * dt))


func fwd_of(n: Node3D) -> Vector3:
	return Vector3(sin(n.rotation.y), 0, cos(n.rotation.y))


func flat_dist(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()


func awake(e: Dictionary) -> bool:
	return e.alive and e.state != "dormant" and e.state != "awaken"


# ---------- world ----------
func place(key: String, x: float, z: float, rot := 0.0, y := 0.0, opt := {}) -> Node3D:
	var o := Assets.inst(key)
	o.position = Vector3(x, y, z)
	o.rotation.y = rot
	if opt.has("scale"):
		o.scale = Vector3.ONE * opt.scale
	world.add_child(o)
	if opt.has("r"):
		colliders.append({"x": x, "z": z, "r": opt.r})
	return o


func build_world() -> void:
	var rows := MAP.size()
	var cols: int = MAP[0].length()
	for r in rows:
		for q in cols:
			if not _fl(q, r):
				continue
			var ch: String = MAP[r][q]
			var v := randf()
			var key := "floor_tile_big_grate" if ch == "h" and v < 0.08 else "floor_tile_large_rocks" if v < 0.22 else "floor_tile_large"
			place(key, q * C + 2, r * C + 2, randi_range(0, 3) * PI / 2)
	var pick := func(ch: String) -> String:
		var v := randf()
		return "wall_cracked" if v < 0.12 else "wall_arched" if ch == "h" and v < 0.2 else "wall"
	for r in rows:
		for q in cols:
			if not _fl(q, r):
				continue
			var ch: String = MAP[r][q]
			var cx := q * C + 2
			var cz := r * C + 2
			if not _fl(q, r - 1):
				walls.append(place("wall_shelves" if ch == "t" and q == 1 else pick.call(ch), cx, r * C, 0))
			if not _fl(q, r + 1):
				walls.append(place(pick.call(ch), cx, r * C + C, PI))
			if not _fl(q - 1, r):
				walls.append(place(pick.call(ch), q * C, cz, PI / 2))
			if not _fl(q + 1, r):
				walls.append(place(pick.call(ch), q * C + C, cz, -PI / 2))
	for r in rows + 1:
		for q in cols + 1:
			var h := (_fl(q - 1, r) != _fl(q - 1, r - 1)) or (_fl(q, r) != _fl(q, r - 1))
			var v := (_fl(q, r - 1) != _fl(q - 1, r - 1)) or (_fl(q, r) != _fl(q - 1, r))
			if h and v:
				walls.append(place("pillar", q * C, r * C))
	for d in DOORS:
		walls.append(place("wall_doorway", d[0], d[1], d[2]))
		colliders.append({"x": d[0], "z": d[1] - 1.7, "r": 0.5})
		colliders.append({"x": d[0], "z": d[1] + 1.7, "r": 0.5})
	# vật liệu riêng mỗi bức tường để làm mờ khi che nhân vật
	for w in walls:
		var mats: Array = []
		for mi in w.find_children("*", "MeshInstance3D", true, false):
			for s in mi.mesh.get_surface_count():
				var m: BaseMaterial3D = mi.get_active_material(s).duplicate()
				mi.set_surface_override_material(s, m)
				mats.append(m)
		w.set_meta("mats", mats)
		w.set_meta("op", 1.0)

	# đuốc + đèn
	for t in [[7, 4, 0, 1], [15, 4, 0, 1], [30, 4, 0, 1], [42, 4, 0, 1], [24, 15, 1, 0], [48, 14, -1, 0]]:
		torch(t[0], t[1], t[2], t[3], TORCH, 12.0)
	torch(7, 20, 0, 1, SPIRIT, 9.5)
	torch(17, 20, 0, 1, SPIRIT, 9.5)

	# --- quán rượu ---
	place("banner_patternA_blue", 11, 4)
	place("banner_red", 3 * C + 2, 4)
	place("table_long_decorated_A", 10, 9.6)
	colliders.append({"x": 8.9, "z": 9.6, "r": 1.1})
	colliders.append({"x": 11.1, "z": 9.6, "r": 1.1})
	place("stool", 7.4, 11.4, 0, 0, {"r": 0.4})
	place("stool", 12.6, 7.7, 0, 0, {"r": 0.4})
	place("keg_decorated", 18.2, 5.8, 0, 0, {"r": 0.9})
	place("barrel_large", 18.6, 14.6, 0, 0, {"r": 1.0})
	place("barrel_small_stack", 5.6, 14.6, 0.4, 0, {"r": 0.9})
	place("crates_stacked", 14.5, 5.8, 0, 0, {"r": 1.1})
	place("shelf_large", 5.4, 8.5, PI / 2, 0, {"r": 0.8})
	place("candle_triple", 10.4, 9.4, 0, 1.0)
	place("plate_food_A", 9.4, 9.8, 0, 1.0)
	# --- đại sảnh ---
	for p in [[30, 10], [42, 10], [30, 18], [42, 18]]:
		place("pillar_decorated", p[0], p[1], 0, 0, {"r": 1.0})
	place("banner_shield_red", 36, 4)
	place("banner_red", 26, 4)
	place("banner_red", 46, 4)
	place("crates_stacked", 46.5, 6.2, 0.3, 0, {"r": 1.1})
	place("barrel_large", 26, 6.2, 0, 0, {"r": 1.0})
	place("box_stacked", 46.8, 10, 0, 0, {"r": 0.9})
	place("rubble_large", 45.5, 21.8, 0.6, 0, {"r": 1.2})
	place("rubble_half", 27, 22.4)
	place("sword_shield", 35.5, 22.6)
	place("barrel_small_stack", 25.8, 21.6, 0, 0, {"r": 0.9})
	# --- hầm mộ ---
	place("banner_triple_yellow", 12, 20)
	place("coin_stack_large", 5.8, 30.4, 0, 0, {"r": 0.5})
	place("coin_stack_small", 10.6, 30.8)
	place("candle_triple", 5.3, 21.2)
	place("candle_triple", 18.6, 30.6)
	place("trunk_medium_A", 18.2, 21.6, -PI / 2, 0, {"r": 0.9})
	place("rubble_half", 15.6, 30.6, 1.2)
	place("column", 6, 25, 0, 0, {"r": 0.5})
	place("column", 18, 25, 0, 0, {"r": 0.5})
	# rương
	for c in [["chest", 36.0, 6.2, 0.0, 10, 3], ["chest_gold", 8.5, 30.4, PI, 30, 4]]:
		var obj := place(c[0], c[1], c[2], c[3], 0, {"r": 1.0})
		chests.append({"obj": obj, "lid": obj.find_child("chest_lid", true, false), "opened": false, "boost": c[4], "n": c[5]})
	# bụi lơ lửng quanh nhân vật
	_motes = fx.emitter(self, {"count": 36, "color": Color("ffe2b0"), "speed": [0.05, 0.25], "life": 4.0, "size": [0.09, 0.04], "alpha": 0.5, "drag": 0.0, "box": Vector3(8, 1.5, 6)})


func torch(x: float, z: float, nx: float, nz: float, color: Color, dist: float) -> void:
	place("torch_mounted", x + nx * 0.5, z + nz * 0.5, atan2(nx, nz), 2.4)
	var f := Vector3(x + nx * 0.95, 3.15, z + nz * 0.95)
	var L := OmniLight3D.new()
	L.light_color = color
	L.omni_range = dist
	L.omni_attenuation = 1.4
	var base := 3.2 if color == TORCH else 1.8
	L.light_energy = base
	L.position = f + Vector3(nx, 0, nz) * 0.3
	world.add_child(L)
	var em := Node3D.new()
	world.add_child(em)
	em.position = f
	var cols := [Color("ffb347"), Color("ff7a1a"), Color("ffe08a")] if color == TORCH else [Color("5cf5d0"), Color("2ad8b0"), Color("c8fff0")]
	fx.emitter(em, {"count": 10, "colors": cols, "dir": Vector3(0, 1.4, 0), "life": 0.55, "size": [0.3, 0.04], "alpha": 0.75, "spread": 0.14, "drag": 0.5})
	torches.append({"L": L, "base": base, "ph": randf() * 10.0})


# ---------- icons (SubViewport chụp model 3D thành ảnh) ----------
func _make_icons() -> void:
	var vp := SubViewport.new()
	vp.size = Vector2i(128, 128)
	vp.own_world_3d = true
	vp.transparent_bg = true
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(vp)
	var c3 := Camera3D.new()
	c3.fov = 28
	vp.add_child(c3)
	var key := DirectionalLight3D.new()
	key.light_energy = 2.2
	key.rotation_degrees = Vector3(-40, 25, 0)
	vp.add_child(key)
	var rim := DirectionalLight3D.new()
	rim.light_color = Color("88aaff")
	rim.light_energy = 1.3
	rim.rotation_degrees = Vector3(-20, 200, 0)
	vp.add_child(rim)
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_CLEAR_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("fff4e0")
	env.ambient_light_energy = 0.9
	we.environment = env
	vp.add_child(we)
	var list := []
	for k in ["sword_1handed", "axe_1handed", "axe_2handed", "sword_2handed", "staff", "wand", "dagger", "shield_round", "shield_spikes", "shield_badge", "bottle_A_green"]:
		list.append({"id": k, "key": k, "face": false})
	for k in HEROES:
		list.append({"id": "face_" + k, "key": k, "face": true})
	for it in list:
		var o := Assets.inst(it.key)
		vp.add_child(o)
		if it.face:
			for n in HEROES[it.key].hide:
				var x := o.find_child(n, true, false)
				if x:
					x.visible = false
			var ap: AnimationPlayer = o.find_child("AnimationPlayer", true, false)
			ap.play("Idle")
			ap.seek(0.3, true)
		elif not it.key.begins_with("shield") and it.key != "bottle_A_green":
			o.rotation.z = -PI / 4
		await get_tree().process_frame
		var box := AABB()
		var first := true
		for mi in o.find_children("*", "MeshInstance3D", true, false):
			if not mi.is_visible_in_tree():
				continue
			var b: AABB = mi.global_transform * mi.get_aabb()
			box = b if first else box.merge(b)
			first = false
		var center := box.get_center()
		var span := maxf(box.size.x, maxf(box.size.y, box.size.z))
		var dir := Vector3(0.2, 0.2, 1)
		if it.face:
			center.y = box.end.y - box.size.y * 0.27
			span = box.size.y * 0.5
			dir = Vector3(0.35, 0.1, 1)
		elif it.key.begins_with("shield"):
			dir = Vector3(0.3, 0.2, 1)
		var d := (span / 2.0) / tan(deg_to_rad(14)) * 1.15
		c3.position = center + dir.normalized() * d
		c3.look_at(center)
		await RenderingServer.frame_post_draw
		var img := vp.get_texture().get_image()
		if img and not img.is_empty():
			hud.icons[it.id] = ImageTexture.create_from_image(img)
		o.queue_free()
	vp.queue_free()


# ---------- hero ----------
func spawn_hero(k: String, pos: Vector3, rot_y: float) -> void:
	if hero:
		hero.queue_free()
	def = HEROES[k]
	hero = Actor.new().setup(k)
	add_child(hero)
	hero.set_parts(def.hide, false)
	hero.position = pos
	hero.rotation.y = rot_y
	S.hero = k
	equip_visual()
	hero.play(def.idle)
	state = "idle"
	hud.hero(def)


func equip_visual() -> void:
	var w = S.eq.weapon
	var two: bool = w != null and w.m in ["sword_2handed", "axe_2handed", "staff"]
	var ref_r: String = {"Knight": "2H_Sword" if two else "1H_Sword", "Barbarian": "2H_Axe" if two else "1H_Axe", "Mage": "2H_Staff" if two else "1H_Wand"}[def.key]
	var ref_l: String = {"Knight": "Round_Shield", "Barbarian": "Barbarian_Round_Shield"}.get(def.key, "")
	hero.attach("r", w.m if w else null, ref_r)
	var sh = S.eq.shield
	hero.attach("l", sh.m if sh else null, ref_l)


func switch_hero(k: String) -> void:
	if k == S.hero or state == "dead":
		return
	var p := hero.position
	var r := hero.rotation.y
	spawn_hero(k, p, r)
	fx.burst(p + Vector3(0, 1, 0), {"count": 40, "color": Color("ffe08a"), "speed": [2.0, 6.0], "life": 0.8, "size": [0.4, 0.0], "up": 1.2})
	fx.shock(p, Color("ffd27a"), 3.2, 0.5)
	hud.toast("Đổi sang %s" % HEROES[k].name, Color("f5c451"))


func equip_changed(it: Dictionary) -> void:
	equip_visual()
	var p := hero.position
	fx.burst(p + Vector3(0, 1.2, 0), {"count": 26, "color": S.RAR[it.rarity].c, "speed": [1.5, 4.0], "life": 0.7, "size": [0.35, 0.0], "up": 1.0})
	hud.toast("Trang bị: %s" % it.name, S.RAR[it.rarity].c)


func refresh() -> void:
	ST = S.stats()
	S.hp = minf(S.hp, ST.maxHp)
	S.mp = minf(S.mp, ST.maxMp)
	hud.vitals(ST)


# ---------- enemies / NPC ----------
func spawn_enemy(type: String, x: float, z: float, o := {}) -> Dictionary:
	var d: Dictionary = ENEMIES[type]
	var a := Actor.new().setup(d.key, d.get("scale", 1.0))
	add_child(a)
	if d.has("weapon"):
		a.attach("r", d.weapon)
	if d.has("shield"):
		a.attach("l", d.shield)
	a.position = Vector3(x, 0, z)
	a.rotation.y = o.get("rot", randf() * TAU)
	var lvl: int = o.get("lvl", 1)
	var hp := roundi(d.hp * (1.0 + (lvl - 1) * 0.15))
	var e := {"a": a, "root": a, "def": d, "type": type, "hp": hp, "max": hp, "lvl": lvl, "alive": true,
		"state": "dormant" if o.get("dormant", false) else "idle", "atk_ready": 0.0, "room": o.get("room", ""), "slow": 0.0, "bar": null, "flash": 0.0}
	if o.get("dormant", false):
		a.play("Skeletons_Inactive_Floor_Pose", {"once": true})
	else:
		a.play("Idle")
	enemies.append(e)
	return e


func spawn_npc(k: String, x: float, z: float, rot: float, o: Dictionary) -> Dictionary:
	var a := Actor.new().setup(k)
	add_child(a)
	a.set_parts(HEROES[k].hide, false)
	if o.has("show"):
		a.set_parts(o.show, true)
	a.position = Vector3(x, 0, z)
	a.rotation.y = rot
	a.play(o.get("anim", "Idle"))
	var n := {"a": a, "root": a, "key": k, "name": o.name, "on_talk": o.on_talk, "marker": null, "seated": false}
	colliders.append({"x": x, "z": z, "r": 0.8})
	npcs.append(n)
	return n


func hall_left() -> int:
	return enemies.filter(func(e): return e.room == "h" and e.alive).size()


# ---------- movement & collision ----------
func is_free(x: float, z: float, r: float) -> bool:
	if not floor_at(x - r, z) or not floor_at(x + r, z) or not floor_at(x, z - r) or not floor_at(x, z + r):
		return false
	var d := r * 0.7
	if not floor_at(x - d, z - d) or not floor_at(x + d, z - d) or not floor_at(x - d, z + d) or not floor_at(x + d, z + d):
		return false
	for c in colliders:
		if (x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) < (r + c.r) * (r + c.r):
			return false
	return true


func move(n: Node3D, dx: float, dz: float, r := 0.95) -> void:
	if is_free(n.position.x + dx, n.position.z, r):
		n.position.x += dx
	if is_free(n.position.x, n.position.z + dz, r):
		n.position.z += dz


# ---------- combat ----------
func nearest_enemy(rng: float):
	var best = null
	var bd := rng
	for e in enemies:
		if not awake(e):
			continue
		var d = e.root.position.distance_to(hero.position)
		if d < bd:
			bd = d
			best = e
	return best


func dmg_text(pos: Vector3, txt: String, kind := "") -> void:
	var l := Label3D.new()
	l.text = txt
	l.font = hud.FONT_T
	l.font_size = 64 if kind in ["crit", "big"] else 46
	l.outline_size = 14
	l.pixel_size = 0.008
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.fixed_size = false
	l.modulate = {"crit": Color("ffd34d"), "fire": Color("ff9a4a"), "hurt": Color("ff5a5a"), "heal": Color("7be38a"), "gold": Color("ffd36a"), "big": Color("ffe9a8")}.get(kind, Color.WHITE)
	l.outline_modulate = Color(0, 0, 0, 0.85)
	add_child(l)
	l.global_position = pos + Vector3(randf_range(-0.3, 0.3), 2.3, 0)
	var life := 1.1 if kind in ["crit", "big"] else 0.8
	var tw := l.create_tween().set_parallel()
	tw.tween_property(l, "position:y", l.position.y + 1.2, life).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_QUAD)
	if kind in ["crit", "big"]:
		l.scale = Vector3.ONE * 1.8
		tw.tween_property(l, "scale", Vector3.ONE, 0.18).set_trans(Tween.TRANS_BACK)
	tw.tween_property(l, "modulate:a", 0.0, life * 0.4).set_delay(life * 0.6)
	tw.tween_property(l, "outline_modulate:a", 0.0, life * 0.4).set_delay(life * 0.6)
	tw.chain().tween_callback(l.queue_free)


func damage_enemy(e: Dictionary, base: float, o := {}) -> void:
	if not e.alive:
		return
	var crit = randf() * 100.0 < ST.crit
	var d := maxi(1, roundi(base * ST.mult * (1.0 + ST.critDmg / 100.0 if crit else 1.0)) + (0 if o.get("no_fire") else ST.fire))
	e.hp -= d
	var sc: float = e.def.get("scale", 1.0)
	var p: Vector3 = e.root.position
	dmg_text(p + Vector3(0, sc * 0.6, 0), "%d!" % d if crit else str(d), "crit" if crit else "fire" if o.get("fire") else "")
	var cols := [Color("ff9a3a"), Color("ffd36a")] if o.get("fire") else [Color("fff2c0"), Color.WHITE]
	fx.burst(p + Vector3(0, 1.2 * sc, 0), {"count": 22 if crit else 12, "colors": cols, "speed": [3.0, 7.0], "life": 0.35, "size": [0.28, 0.0], "up": 0.8})
	e.a.set_overlay(fx.flash_mat)
	e.flash = now + 0.08
	if crit:
		shake = maxf(shake, 0.25)
		hitstop(0.05)
	if not e.def.get("boss"):
		var dir := (p - hero.position)
		dir.y = 0
		dir = dir.normalized()
		move(e.root, dir.x * 0.45, dir.z * 0.45, 0.7)
	if ST.ls:
		S.hp = minf(ST.maxHp, S.hp + maxi(1, roundi(d * ST.ls / 100.0)))
	if o.has("slow"):
		e.slow = now + o.slow
	if e.hp <= 0:
		kill_enemy(e)
		return
	if e.state == "dormant" or e.state == "awaken":
		return
	if not e.def.get("boss") and e.state != "attack":
		e.state = "hit"
		e.a.play("Hit_A" if randf() < 0.5 else "Hit_B", {"once": true, "speed": 1.4, "on_done": func(): if e.alive: e.state = "chase"})
	if e.bar == null and not e.def.get("boss"):
		var r: Node3D = e.root # capture node, không capture dict e (tránh vòng tham chiếu e -> bar -> lambda -> e)
		e.bar = hud.anchor(hud.enemy_bar(), func(): return r.position, {"dy": 2.6 * sc})
	if e.bar:
		e.bar.c.value = maxf(0.0, float(e.hp) / e.max)
	if e.def.get("boss"):
		hud.boss(e)


func hitstop(t: float) -> void:
	Engine.time_scale = 0.08
	get_tree().create_timer(t, true, false, true).timeout.connect(func(): Engine.time_scale = 1.0)


func kill_enemy(e: Dictionary) -> void:
	e.alive = false
	e.state = "dead"
	if e.bar:
		hud.drop(e.bar)
		e.bar = null
	var p: Vector3 = e.root.position
	e.a.play("Death_C_Skeletons" if e.a.has_anim("Death_C_Skeletons") else "Death_A", {"once": true})
	var boss: bool = e.def.get("boss", false)
	fx.burst(p + Vector3(0, 0.4, 0), {"count": 60 if boss else 24, "colors": [Color("6b6478"), Color("4a4456"), Color("8a8296")], "speed": [0.5, 2.5], "life": 1.2, "size": [0.9, 0.2], "alpha": 0.55, "up": 0.4, "drag": 2.0, "dust": true})
	gain_xp(e.def.xp + e.lvl * 2)
	if ST.powers.get("boom"):
		explode(p, 3.0, 14.0, Color("ff7a2a"))
	var n := 4 if boss else (1 if randf() < 0.6 else 0)
	for i in n:
		var ang := randf() * TAU
		var to := Vector3(p.x + cos(ang) * 1.6, 0, p.z + sin(ang) * 1.6)
		var opt := {"boost": 30.0 if boss else ST.mf / 2.0}
		if boss and i == 0:
			opt.rarity = 3
		after(0.25 + i * 0.15, func(): drop_item(S.roll_item(e.lvl + 1, opt), p, to))
	var gold := rint(3, 9) * (8 if boss else 1)
	after(0.3, func(): coin_burst(p, mini(14, 3 + int(gold / 3.0)), gold))
	if boss:
		hud.boss(null)
		shake = 0.6
		hud.banner("Vua Xương đã ngã", "Chiến thắng")
	if e.room == "h" and S.quest == 1 and hall_left() == 0:
		S.quest = 2
		hud.toast("Đại Sảnh đã sạch! Quay lại gặp Pháp Sư Lyra.", Color("7be38a"))
	hud.quest()
	after(3.2, func():
		var tw = e.a.create_tween()
		tw.tween_property(e.a, "position:y", -1.4, 1.2)
		tw.tween_callback(e.a.queue_free)
	)


func explode(p: Vector3, rad: float, dmg: float, color: Color) -> void:
	fx.shock(p, color, rad, 0.4)
	fx.burst(p + Vector3(0, 0.8, 0), {"count": 40, "colors": [color, Color("ffd36a"), Color.WHITE], "speed": [3.0, 9.0], "life": 0.5, "size": [0.5, 0.0], "up": 0.9})
	for e in enemies:
		if e.alive and e.state != "dormant" and e.root.position.distance_to(p) < rad:
			damage_enemy(e, dmg, {"fire": true, "no_fire": true})


func hurt_hero(d: float) -> void:
	if state == "dead" or now < invuln:
		return
	var dd := maxi(1, roundi(d * (1.0 - minf(0.6, ST.armor / 70.0))))
	S.hp -= dd
	dmg_text(hero.position + Vector3(0, 0.3, 0), "-%d" % dd, "hurt")
	shake = maxf(shake, 0.2)
	hud.hurt_flash()
	if S.hp <= 0:
		hero_die()
		return
	if state == "idle" or state == "run":
		state = "hit"
		hero.play("Hit_A", {"once": true, "speed": 1.6, "on_done": func(): if state == "hit": state = "idle"})
	hud.vitals(ST)


func hero_die() -> void:
	state = "dead"
	S.hp = 0
	hero.play("Death_A", {"once": true})
	hud.banner("Bạn đã gục ngã", "Hồi sinh tại quán rượu")
	after(3.0, func():
		S.hp = ST.maxHp
		S.mp = ST.maxMp
		S.gold = floori(S.gold * 0.85)
		hero.position = Vector3(8.5, 0, 13.5)
		state = "idle"
		hero.play(def.idle)
		invuln = now + 2.0
		hud.vitals(ST)
	)


func gain_xp(n: int) -> void:
	S.xp += n
	while S.xp >= S.xp_need():
		S.xp -= S.xp_need()
		S.lvl += 1
		ST = S.stats()
		S.hp = ST.maxHp
		S.mp = ST.maxMp
		var p := hero.position
		fx.shock(p, Color("ffd27a"), 4.0, 0.6)
		after(0.15, func(): fx.shock(hero.position, Color("fff0b0"), 2.6, 0.5))
		for i in 6:
			after(i * 0.08, func(): fx.burst(hero.position + Vector3(0, 0.2, 0), {"count": 14, "colors": [Color("ffd27a"), Color("fff3c4")], "dir": Vector3(0, 3, 0), "life": 0.9, "size": [0.35, 0.0], "spread": 1.2}))
		dmg_text(p + Vector3(0, 0.6, 0), "LÊN CẤP %d!" % S.lvl, "big")
		hud.toast("Lên cấp %d: +12 máu, +8 mana" % S.lvl, Color("f5c451"))
	hud.vitals(ST)


# ---------- hero actions ----------
func busy() -> bool:
	return state in ["attack", "skill", "dodge", "dead"]


func attack(tgt = null) -> void:
	if busy() or now < atk_ready or hud.busy():
		return
	if tgt == null or not tgt.alive:
		tgt = nearest_enemy(14.0 if def.style == "magic" else 3.4)
	if tgt:
		face_to(hero, tgt.root.position)
	state = "attack"
	combo = (combo + 1) % def.atk.size()
	var anim: String = def.atk[combo]
	var sp: float = ST.speed * (1.25 if def.style == "magic" else 1.15)
	var dur := hero.play(anim, {"once": true, "speed": sp, "fade": 0.08, "on_done": func(): if state == "attack": state = "idle"})
	atk_ready = now + dur * 0.62
	cancel_at = now + dur * 0.6
	after(dur * (0.42 if def.style == "magic" else 0.36), func():
		if state == "dead":
			return
		var p := hero.position
		var fwd := fwd_of(hero)
		if def.style == "magic":
			var dir := fwd
			if tgt and tgt.alive:
				dir = tgt.root.position - p
				dir.y = 0
				dir = dir.normalized()
			fire_bolt(p + dir * 0.9 + Vector3(0, 1.4, 0), dir, "hero", rint(ST.dmg[0], ST.dmg[1]) + 3, Color("7fc8ff"))
		else:
			fx.slash(p + fwd * 0.6, hero.rotation.y, Color("fff0c8"), 2.0)
			var hit := false
			for e in enemies:
				if not awake(e):
					continue
				var v: Vector3 = e.root.position - p
				v.y = 0
				var reach := 2.9 + (1.0 if e.def.get("boss") else 0.0)
				if v.length() < reach and v.normalized().dot(fwd) > 0.2:
					damage_enemy(e, rint(ST.dmg[0], ST.dmg[1]))
					hit = true
			if hit:
				shake = maxf(shake, 0.12)
		if ST.powers.get("fireProc") and randf() < 0.25:
			fire_bolt(p + fwd * 0.8 + Vector3(0, 1.3, 0), fwd, "hero", 12, Color("ff8a2a"), true)
	)


func skill() -> void:
	if busy() or now < cd.q or hud.busy():
		return
	var cost := 0 if ST.powers.get("freeSkill") else 20
	if S.mp < cost:
		dmg_text(hero.position, "Hết mana", "heal")
		return
	S.mp -= cost
	cd.q = now + 4.0
	state = "skill"
	var done := func(): if state == "skill": state = "idle"
	if def.style == "magic":
		var dur := hero.play(def.skill, {"once": true, "speed": 1.6, "on_done": done})
		after(dur * 0.5, func():
			var q := hero.position
			fx.shock(q, Color("8fd8ff"), 6.0, 0.55)
			fx.shock(q, Color.WHITE, 4.0, 0.35)
			fx.burst(q + Vector3(0, 0.4, 0), {"count": 90, "colors": [Color("8fd8ff"), Color("d8f4ff"), Color("5aa2ff")], "speed": [6.0, 12.0], "life": 0.6, "size": [0.45, 0.0], "flat": true})
			shake = 0.3
			for e in enemies:
				if awake(e) and e.root.position.distance_to(q) < 6.0:
					damage_enemy(e, rint(ST.dmg[0], ST.dmg[1]) * 1.4 + 6, {"slow": 2.5})
		)
	else:
		var dur := hero.play(def.skill, {"once": true, "speed": 1.35, "on_done": done})
		for k in [0.3, 0.6]:
			after(dur * k, func():
				var q := hero.position
				fx.shock(q, Color("cfe6ff"), 3.6, 0.35)
				fx.burst(q + Vector3(0, 1, 0), {"count": 30, "colors": [Color("cfe6ff"), Color.WHITE], "speed": [4.0, 8.0], "life": 0.35, "size": [0.3, 0.0], "flat": true})
				fx.burst(q + Vector3(0, 0.2, 0), {"count": 14, "colors": [Color("5a5048"), Color("766a5e")], "speed": [2.0, 4.0], "life": 0.8, "size": [0.9, 0.3], "alpha": 0.45, "flat": true, "dust": true})
				shake = maxf(shake, 0.18)
				for e in enemies:
					if awake(e) and e.root.position.distance_to(q) < 3.6:
						damage_enemy(e, rint(ST.dmg[0], ST.dmg[1]) * 0.9 + 2)
			)
	hud.vitals(ST)


func dodge() -> void:
	if state == "dead" or state == "dodge" or now < cd.e or hud.busy():
		return
	var dir = input_dir()
	if dir == null:
		dir = fwd_of(hero)
	hero.rotation.y = atan2(dir.x, dir.z)
	state = "dodge"
	cd.e = now + 1.2
	invuln = now + 0.45
	dash_v = dir * 13.0
	dash_end = now + 0.32
	hero.play("Dodge_Forward", {"once": true, "speed": 1.5, "fade": 0.05, "on_done": func(): if state == "dodge": state = "idle"})
	fx.burst(hero.position + Vector3(0, 0.2, 0), {"count": 12, "colors": [Color("5a5048"), Color("766a5e")], "speed": [1.0, 2.5], "life": 0.7, "size": [0.8, 0.3], "alpha": 0.5, "up": 0.3, "dust": true})


func drink() -> void:
	if state == "dead" or now < cd.r:
		return
	var i := -1
	for j in S.bag.size():
		if S.bag[j].kind == "potion":
			i = j
			break
	if i < 0:
		hud.toast("Hết bình máu", Color("ff7a6b"))
		return
	S.bag.remove_at(i)
	cd.r = now + 5.0
	var heal := roundi(ST.maxHp * 0.45)
	S.hp = minf(ST.maxHp, S.hp + heal)
	dmg_text(hero.position + Vector3(0, 0.4, 0), "+%d" % heal, "heal")
	for k in 5:
		after(k * 0.07, func(): fx.burst(hero.position + Vector3(0, 0.3, 0), {"count": 10, "colors": [Color("7be38a"), Color("c8ffd0")], "dir": Vector3(0, 2.5, 0), "spread": 1.4, "life": 0.8, "size": [0.3, 0.0]}))
	hud.vitals(ST)
	if hud.inv_open():
		hud.inv()


# ---------- projectiles ----------
func fire_bolt(pos: Vector3, dir: Vector3, who: String, dmg: float, color: Color, fire := false) -> void:
	var m := fx.orb(color, 0.22 if who == "hero" else 0.26)
	add_child(m)
	m.global_position = pos
	var trail := fx.emitter(m, {"count": 24, "colors": [color, Color.WHITE], "speed": [0.2, 0.8], "life": 0.35, "size": [0.32, 0.0], "spread": 0.15})
	bolts.append({"m": m, "trail": trail, "v": dir * (17.0 if who == "hero" else 10.0), "owner": who, "dmg": dmg, "color": color, "life": 1.6, "fire": fire})


func update_bolts(dt: float) -> void:
	for i in range(bolts.size() - 1, -1, -1):
		var b: Dictionary = bolts[i]
		b.m.position += b.v * dt
		b.life -= dt
		var p: Vector3 = b.m.position
		var hit = null
		if b.owner == "hero":
			for e in enemies:
				if awake(e) and flat_dist(e.root.position, p) < 0.9 * e.def.get("scale", 1.0):
					hit = e
					break
		elif flat_dist(hero.position, p) < 0.8:
			hit = "hero"
		if hit != null or b.life <= 0 or not floor_at(p.x, p.z):
			fx.burst(p, {"count": 26, "colors": [b.color, Color.WHITE], "speed": [2.0, 6.0], "life": 0.4, "size": [0.35, 0.0]})
			fx.shock(p, b.color, 1.4, 0.25, 0.1)
			if hit is String:
				hurt_hero(b.dmg)
			elif hit != null:
				damage_enemy(hit, b.dmg, {"fire": b.fire})
			b.m.queue_free()
			bolts.remove_at(i)


# ---------- loot ----------
func drop_item(it: Dictionary, from: Vector3, to: Vector3) -> void:
	var col: Color = S.RAR[it.rarity].c
	var g := Node3D.new()
	add_child(g)
	var beam := fx.loot_beam(col, it.rarity)
	g.add_child(beam)
	var holder := Node3D.new()
	var m := Assets.inst(it.m)
	if it.kind == "potion":
		m.scale = Vector3.ONE * 1.6
	elif it.kind == "weapon":
		m.rotation.z = 0.5
	holder.add_child(m)
	holder.position.y = 0.75
	g.add_child(holder)
	g.position = from
	var o := {"it": it, "g": g, "holder": holder, "beam": beam, "ready": false, "label": null}
	loot.append(o)
	var tw := g.create_tween()
	tw.tween_method(func(k: float):
		g.position = Vector3(lerpf(from.x, to.x, k), sin(k * PI) * 2.6, lerpf(from.z, to.z, k))
		holder.rotation.x = k * PI * 4
	, 0.0, 1.0, 0.6)
	tw.tween_callback(func():
		holder.rotation.x = 0
		g.position.y = 0
		o.ready = true
		fx.burst(to + Vector3(0, 0.3, 0), {"count": 12 + it.rarity * 8, "color": col, "speed": [1.5, 4.0], "life": 0.5, "size": [0.3, 0.0], "up": 0.6})
		o.label = hud.anchor(hud.world_label(it.name, col), func(): return g.position, {"dy": 2.2 if it.rarity >= 2 else 1.6})
		if it.rarity == 3:
			shake = 0.3
			hud.toast("Rơi đồ HUYỀN THOẠI: %s!" % it.name, col)
	)


func pickup(o: Dictionary) -> void:
	loot.erase(o)
	if o.label:
		hud.drop(o.label)
	var g: Node3D = o.g
	var tw := g.create_tween().set_parallel()
	tw.tween_property(g, "position:y", g.position.y + 1.8, 0.3)
	tw.tween_property(g, "scale", Vector3.ONE * 0.3, 0.3)
	tw.chain().tween_callback(g.queue_free)
	if S.bag.size() >= S.BAG_SIZE:
		S.gold += 6 + o.it.rarity * 15
		hud.toast("Túi đầy, tự bán %s" % o.it.name, Color("a8a3b8"))
	else:
		S.bag.append(o.it)
		hud.toast("Nhặt: %s" % o.it.name, S.RAR[o.it.rarity].c)
	hud.vitals(ST)
	if hud.inv_open():
		hud.inv()


func coin_burst(p: Vector3, n: int, gold: int) -> void:
	for i in n:
		var c := Assets.inst("coin")
		c.scale = Vector3.ONE * 1.6
		add_child(c)
		var a := randf() * TAU
		var r := 0.8 + randf() * 1.6
		var to := Vector3(p.x + cos(a) * r, 0.1, p.z + sin(a) * r)
		var h := 1.5 + randf() * 1.5
		c.position = p
		var tw := c.create_tween()
		tw.tween_method(func(k: float):
			c.position = Vector3(lerpf(p.x, to.x, k), 0.1 + sin(k * PI) * h, lerpf(p.z, to.z, k))
			c.rotation.x += 0.4
		, 0.0, 1.0, 0.5 + randf() * 0.2)
		tw.tween_interval(0.35 + randf() * 0.3)
		tw.tween_method(func(k: float):
			var hp := hero.position
			c.position = Vector3(lerpf(to.x, hp.x, k), lerpf(0.1, 1.2, k) + sin(k * PI), lerpf(to.z, hp.z, k))
		, 0.0, 1.0, 0.35)
		tw.tween_callback(func():
			fx.burst(c.position, {"count": 3, "color": Color("ffd36a"), "speed": [1.0, 2.0], "life": 0.3, "size": [0.25, 0.0]})
			c.queue_free()
		)
	S.gold += gold
	dmg_text(p + Vector3(0, 0.2, 0), "+%d vàng" % gold, "gold")
	after(1.2, func(): hud.vitals(ST))


func open_chest(ch: Dictionary) -> void:
	ch.opened = true
	var p: Vector3 = ch.obj.position
	if ch.lid:
		ch.lid.create_tween().tween_property(ch.lid, "rotation:x", -1.9, 0.45).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	fx.burst(p + Vector3(0, 0.9, 0), {"count": 50, "colors": [Color("ffd36a"), Color("fff3c4"), Color("ffa83a")], "speed": [2.0, 6.0], "life": 0.9, "size": [0.35, 0.0], "up": 1.4, "gravity": 3.0})
	shake = 0.2
	coin_burst(p, 12, rint(25, 45) + ch.boost)
	var fwd := fwd_of(ch.obj)
	for i in ch.n:
		var a: float = (i - (ch.n - 1) / 2.0) * 0.55
		var dir := fwd.rotated(Vector3.UP, a)
		after(0.25 + i * 0.16, func(): drop_item(S.roll_item(S.lvl + 1, {"boost": float(ch.boost)}), p + Vector3(0, 0.6, 0), p + dir * 2.6))


# ---------- NPC ----------
func talk() -> void:
	var n = near_npc
	if n == null or hud.busy():
		return
	if not n.seated:
		face_to(n.root, hero.position)
	n.on_talk.call(n)


func setup_npcs() -> void:
	brann = spawn_npc("Barbarian", 10, 11.5, PI, {"name": "Brann Bụng Bia", "anim": "Sit_Chair_Idle", "show": ["Mug"], "on_talk": _brann_talk})
	brann.seated = true
	place("chair", 10, 11.5, PI)
	lyra = spawn_npc("Mage", 16.5, 11.6, -0.65, {"name": "Pháp Sư Lyra", "anim": "Idle", "show": ["Spellbook_open"], "on_talk": _lyra_talk})
	var mk := hud.world_label("!", Color("ffd34d"), 26)
	var lr: Node3D = lyra.root
	lyra.marker = hud.anchor(mk, func(): return lr.position, {"dy": 2.9})
	var quips := ["Ê nhóc! Uống một ly đã rồi hẵng xuống hầm.", "Nghe tiếng lạch cạch dưới kia chưa? Xương đấy.", "Rương vàng ở hầm mộ… ta thề là có thật!"]
	var t := Timer.new()
	t.wait_time = 9.0
	t.autostart = true
	add_child(t)
	var qi := [0]
	t.timeout.connect(func():
		var r: Node3D = brann.root
		hud.anchor(hud.bubble(quips[qi[0] % quips.size()]), func(): return r.position, {"dy": 2.6, "life": 4.5})
		qi[0] += 1
	)


func _brann_talk(n: Dictionary) -> void:
	var lines := [
		"Hầm dưới kia toàn xương khô biết đi. Ta xuống ba lần, cả ba lần đều quay lên… để uống thêm một ly.",
		"Nghe đồn Vua Xương Morvak canh rương vàng ở hầm mộ phía nam. Ai hạ được hắn thì ta bao rượu cả tháng!",
		"Lăn né đúng lúc là sống. Đứng đỡ đòn của Vua Xương là thành bột xương đấy, nhóc.",
	]
	hud.dialog(hud.icons.get("face_Barbarian"), n.name, lines.pick_random(), [["Cạn ly!", null]])


func _lyra_talk(n: Dictionary) -> void:
	var face: Texture2D = hud.icons.get("face_Mage")
	if S.quest == 0:
		var accept := func():
			S.quest = 1
			hud.quest()
			hud.toast("Nhận nhiệm vụ: Dọn sạch Đại Sảnh", Color("9fd0ff"))
			n.a.play("Interact", {"once": true, "on_done": func(): n.a.play("Idle")})
		hud.dialog(face, n.name, "Lũ xương trong Đại Sảnh đang ngủ, nhưng chỉ cần có người bước vào là chúng trồi dậy. Dọn sạch chúng giúp ta, phần thưởng sẽ xứng đáng.", [["Nhận nhiệm vụ", accept], ["Để sau", null, true]])
	elif S.quest == 1:
		hud.dialog(face, n.name, "Vẫn còn %d bộ xương trong Đại Sảnh. Cửa ở phía đông quán." % hall_left(), [["Đi ngay", null]])
	elif S.quest == 2:
		var reward := func():
			S.quest = 3
			hud.quest()
			n.a.play("Cheer", {"once": true, "on_done": func(): n.a.play("Idle")})
			var p: Vector3 = n.root.position
			drop_item(S.roll_item(S.lvl + 2, {"kind": "weapon", "rarity": 3, "legend": S.LEGEND[0]}), p + Vector3(0, 1, 0), hero.position.lerp(p, 0.5) * Vector3(1, 0, 1))
			coin_burst(p, 10, 120)
			gain_xp(60)
		hud.dialog(face, n.name, "Tuyệt vời! Đại Sảnh đã yên. Nhận lấy món này, nó từng thuộc về một hiệp sĩ huyền thoại.", [["Nhận thưởng", reward]])
	else:
		hud.dialog(face, n.name, "Hầm mộ phía nam là nơi Vua Xương Morvak ngự. Chuẩn bị kỹ rồi hẵng xuống.", [["Hiểu rồi", null]])


# ---------- input ----------
func _unhandled_input(ev: InputEvent) -> void:
	if not started:
		return
	if ev is InputEventKey and ev.pressed and not ev.echo:
		match ev.keycode:
			KEY_SPACE: dodge()
			KEY_J: attack()
			KEY_Q: skill()
			KEY_R: drink()
			KEY_F:
				if hud.dialog_open():
					hud.dialog_confirm()
				else:
					talk()
			KEY_I: hud.toggle_inv()
			KEY_ESCAPE: hud.close_all()
			KEY_1: switch_hero("Knight")
			KEY_2: switch_hero("Barbarian")
			KEY_3: switch_hero("Mage")
	elif ev is InputEventMouseButton and ev.button_index == MOUSE_BUTTON_LEFT:
		if ev.pressed:
			if hud.busy():
				return
			var hit := pick_at(ev.position)
			if hit.has("enemy"):
				target = hit.enemy
				goal = null
			elif hit.has("point"):
				target = null
				goal = hit.point
				holding = true
		else:
			holding = false
	elif ev is InputEventMouseMotion and holding and goal != null:
		var hit := pick_at(ev.position)
		if hit.has("point"):
			goal = hit.point


func input_dir():
	var x := float(Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT)) - float(Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT))
	var z := float(Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN)) - float(Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP))
	var v := Vector3(x, 0, z)
	if v.length() < 0.15:
		return null
	return v / maxf(1.0, v.length())


func pick_at(sp: Vector2) -> Dictionary:
	var best = null
	var bd := 60.0
	for e in enemies:
		if not e.alive or e.state == "dormant":
			continue
		var wp: Vector3 = e.root.position + Vector3(0, 1.1 * e.def.get("scale", 1.0), 0)
		if cam.is_position_behind(wp):
			continue
		var d := cam.unproject_position(wp).distance_to(sp)
		if d < bd:
			bd = d
			best = e
	if best:
		return {"enemy": best}
	var hit = Plane(Vector3.UP, 0).intersects_ray(cam.project_ray_origin(sp), cam.project_ray_normal(sp))
	return {"point": hit} if hit != null else {}


# ---------- update ----------
func _process(delta: float) -> void:
	if not started:
		return
	var dt := minf(delta, 1.0 / 20.0)
	now += dt
	for i in range(timers.size() - 1, -1, -1):
		if i < timers.size() and now >= timers[i].t:
			var f: Callable = timers[i].fn
			timers.remove_at(i)
			f.call()
	update_hero(dt)
	update_enemies(dt)
	update_bolts(dt)
	update_world(dt)
	update_camera(dt)
	hud.update_anchors(cam, dt)
	_ui_t += dt
	if _ui_t > 0.15:
		_ui_t = 0
		hud.vitals(ST)
		hud.cooldowns(cd, now, S.mp >= (0 if ST.powers.get("freeSkill") else 20))
	_mm_t += dt
	if _mm_t > 0.25:
		_mm_t = 0
		hud.minimap()


func update_hero(dt: float) -> void:
	var p := hero.position
	S.mp = minf(ST.maxMp, S.mp + dt * (4.0 + ST["int"] * 0.15))
	if state == "dead":
		return
	if state == "dodge":
		if now < dash_end:
			move(hero, dash_v.x * dt, dash_v.z * dt)
		return
	var dir = input_dir()
	if dir != null:
		goal = null
		target = null
	if state == "attack" or state == "skill":
		if dir != null and state == "attack" and now > cancel_at:
			state = "idle"
		else:
			return
	if dir == null and target != null:
		if not target.alive:
			target = null
		else:
			var tp: Vector3 = target.root.position
			var d := flat_dist(tp, p)
			var reach := 11.0 if def.style == "magic" else 2.4 + (1.0 if target.def.get("boss") else 0.0)
			if d <= reach:
				attack(target)
				return
			dir = Vector3(tp.x - p.x, 0, tp.z - p.z).normalized()
	elif dir == null and goal != null:
		var d := flat_dist(goal, p)
		if d < 0.35:
			goal = null
		else:
			dir = Vector3(goal.x - p.x, 0, goal.z - p.z).normalized()
	if dir != null:
		var sp := 6.4
		move(hero, dir.x * sp * dt, dir.z * sp * dt)
		if goal != null and flat_dist(hero.position, p) < sp * dt * 0.2:
			goal = null
		hero.rotation.y = ang_lerp(hero.rotation.y, atan2(dir.x, dir.z), 1.0 - exp(-14.0 * dt))
		if state != "hit":
			state = "run"
			hero.play("Running_A", {"speed": 1.05})
	elif state == "run":
		state = "idle"
		hero.play(def.idle)
	elif state == "idle" and hero.cur_name != def.idle:
		hero.play(def.idle)


func update_enemies(dt: float) -> void:
	var hp := hero.position
	for e in enemies:
		if e.flash > 0 and now > e.flash:
			e.a.set_overlay(null)
			e.flash = 0.0
		if not e.alive:
			continue
		var a: Actor = e.a
		var p: Vector3 = a.position
		var d := flat_dist(hp, p)
		var df: Dictionary = e.def
		var sc: float = df.get("scale", 1.0)
		var boss: bool = df.get("boss", false)
		var hc := cell_ch(hp.x, hp.z)
		if e.state == "dormant":
			if d < 9 and state != "dead" and (hc == "h" or hc == "."):
				e.state = "awaken"
				a.play("Skeletons_Awaken_Floor", {"once": true, "speed": 1.35, "on_done": func(): if e.alive: e.state = "chase"})
				fx.burst(p + Vector3(0, 0.2, 0), {"count": 18, "colors": [Color("5a5048"), Color("766a5e")], "speed": [1.0, 3.0], "life": 1.1, "size": [1.0, 0.3], "alpha": 0.5, "up": 0.5, "dust": true})
			continue
		if e.state == "idle":
			if d < 11 and state != "dead" and (hc == "c" or (hc == "." and hp.z > 20)):
				e.state = "taunt"
				face_to(a, hp)
				if boss:
					hud.boss(e)
					hud.banner(df.name, "Trùm xuất hiện")
					shake = 0.35
				a.play("Taunt", {"once": true, "speed": 1.2, "on_done": func(): if e.alive: e.state = "chase"})
			continue
		if e.state in ["awaken", "taunt", "hit"]:
			continue
		if boss and e.state == "chase" and hc != "c" and not (hc == "." and hp.z > 20):
			e.state = "idle"
			a.play("Idle")
			hud.boss(null)
			continue
		if e.state == "attack":
			continue
		if state == "dead":
			if a.cur_name != "Idle":
				a.play("Idle")
			continue
		var rng: float = df.range
		if d > rng:
			var spd: float = df.spd * (0.45 if e.slow > now else 1.0)
			var vx := (hp.x - p.x) / d
			var vz := (hp.z - p.z) / d
			for o in enemies:
				if o == e or not o.alive:
					continue
				var ox: float = p.x - o.root.position.x
				var oz: float = p.z - o.root.position.z
				var od := sqrt(ox * ox + oz * oz)
				if od < 1.4 * maxf(sc, o.def.get("scale", 1.0)) and od > 0.001:
					vx += ox / od * 0.8
					vz += oz / od * 0.8
			var l := maxf(sqrt(vx * vx + vz * vz), 0.0001)
			move(a, vx / l * spd * dt, vz / l * spd * dt, 0.6 * sc)
			a.rotation.y = ang_lerp(a.rotation.y, atan2(vx, vz), 1.0 - exp(-10.0 * dt))
			a.play(df.run, {"speed": 0.95 if df.run == "Running_A" else 1.25})
		elif now > e.atk_ready:
			e.state = "attack"
			face_to(a, hp)
			var dur := a.play(df.atk, {"once": true, "speed": 0.9 if boss else 1.1, "fade": 0.1, "on_done": func(): if e.alive: e.state = "chase"})
			e.atk_ready = now + df.cd
			if boss:
				fx.telegraph(p + fwd_of(a) * 1.8, 2.8, dur * df.hitT)
			after(dur * df.hitT, func(): _enemy_strike(e))
		else:
			face_to(a, hp)
			if a.has_anim("Idle_Combat"):
				a.play("Idle_Combat")
			else:
				a.play("Idle")


func _enemy_strike(e: Dictionary) -> void:
	if not e.alive or e.state != "attack":
		return
	var a: Actor = e.a
	var p := a.position
	var q := hero.position
	var df: Dictionary = e.def
	var fwd := fwd_of(a)
	if df.get("ranged"):
		var dir := Vector3(q.x - p.x, 0, q.z - p.z).normalized()
		fire_bolt(p + dir * 0.8 + Vector3(0, 1.5, 0), dir, "enemy", rint(df.dmg[0], df.dmg[1]), Color("b46bff"))
	else:
		var v := Vector3(q.x - p.x, 0, q.z - p.z)
		if df.get("boss"):
			fx.shock(p + fwd * 1.8, Color("ff6a3a"), 3.0, 0.35)
			shake = 0.35
			fx.burst(p + fwd * 1.8 + Vector3(0, 0.2, 0), {"count": 20, "colors": [Color("5a5048"), Color("766a5e")], "speed": [2.0, 4.0], "life": 0.9, "size": [1.0, 0.3], "alpha": 0.5, "flat": true, "dust": true})
		if v.length() < df.range + 0.9 and v.normalized().dot(fwd) > 0.1:
			hurt_hero(rint(df.dmg[0], df.dmg[1]) + e.lvl)


func update_world(dt: float) -> void:
	var hp := hero.position
	# làm mờ tường che nhân vật
	for w in walls:
		var dz: float = w.position.z - hp.z
		var dx := absf(w.position.x - hp.x)
		var tgt := 0.0 if (dz > 0.3 and dz < 7.5 and dx < 3.6) else 1.0
		var op: float = w.get_meta("op")
		if absf(op - tgt) > 0.01:
			op = damp(op, tgt, 12.0, dt)
			if absf(op - tgt) < 0.02:
				op = tgt
			w.set_meta("op", op)
			w.visible = op > 0.04
			for m in w.get_meta("mats"):
				m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA if op < 0.99 else BaseMaterial3D.TRANSPARENCY_DISABLED
				m.albedo_color.a = op
	# đuốc chập chờn
	var t := now
	for T in torches:
		var f: float = 0.82 + sin(t * 9.0 + T.ph) * 0.08 + sin(t * 23.0 + T.ph * 2.0) * 0.06 + randf() * 0.05
		T.L.light_energy = T.base * f
	_motes.position = hp + Vector3(0, 2.0, 0) # hộp phát 16x3x12 quanh nhân vật, thấp hơn camera
	# loot
	for o in loot.duplicate():
		o.holder.rotation.y += dt * 1.6
		o.holder.position.y = 0.75 + sin(t * 2.4 + o.it.id) * 0.12
		var bm: ShaderMaterial = o.beam.get_meta("beam_mat")
		bm.set_shader_parameter("alpha", 0.5 + o.it.rarity * 0.15 + sin(t * 3.0 + o.it.id) * 0.2)
		if o.ready and flat_dist(o.g.position, hp) < 1.4:
			pickup(o)
	for ch in chests:
		if not ch.opened and ch.obj.position.distance_to(hp) < 2.4:
			open_chest(ch)
	var near = null
	for n in npcs:
		if n.root.position.distance_to(hp) < 3.2:
			near = n
	near_npc = near
	hud.show_talk(near != null and not hud.busy() and state != "dead")
	lyra.marker.c.text = "?" if S.quest == 2 else "!"
	lyra.marker.off = not (S.quest == 0 or S.quest == 2)
	# khu vực
	var q := floori(hp.x / C)
	var r := floori(hp.z / C)
	var ch := cell_ch(hp.x, hp.z)
	if ch != "" and ch != "." and ch != "#" and ch != area:
		area = ch
		for rr in MAP.size():
			for qq in MAP[0].length():
				if MAP[rr][qq] == ch:
					seen[Vector2i(qq, rr)] = true
		if not area_seen.has(ch):
			area_seen[ch] = true
			hud.banner(AREAS[ch][0], AREAS[ch][1])
	if ch == ".":
		seen[Vector2i(q, r)] = true


func update_camera(dt: float) -> void:
	var hp := hero.position
	var vs := get_viewport().get_visible_rect().size
	var portrait := vs.x / vs.y < 0.8
	var off := Vector3(0, 21.0 if portrait else 15.0, 13.5 if portrait else 11.0)
	cam_look.x = damp(cam_look.x, hp.x, 7.0, dt)
	cam_look.z = damp(cam_look.z, hp.z, 7.0, dt)
	cam_look.y = 1.0
	cam.position = cam_look + off
	cam.look_at(cam_look)
	if shake > 0:
		var s := shake * 0.35
		cam.position += Vector3(randf() - 0.5, randf() - 0.5, randf() - 0.5) * s
		shake = maxf(0.0, shake - dt * 1.6)


# ---------- selftest (DEMO8_SELFTEST=1, chạy headless) ----------
func _selftest() -> void:
	var fails: Array = []
	var check := func(ok: bool, msg: String):
		print(("  ok   " if ok else "  FAIL ") + msg)
		if not ok:
			fails.append(msg)
	var wait := func(sec: float):
		var end := now + sec
		while now < end:
			await get_tree().process_frame
	print("SELFTEST bắt đầu")
	check.call(enemies.size() == 8, "8 quái (7 sảnh + boss): %d" % enemies.size())
	check.call(walls.size() > 40, "dựng tường: %d" % walls.size())
	check.call(hero != null and hero.has_anim("Running_A"), "hero có animation")
	await wait.call(2.0)
	check.call(loot.size() == 4, "4 món mẫu rơi trong quán: %d" % loot.size())
	# nhận quest
	hero.position = Vector3(15.0, 0, 12.5)
	await wait.call(0.2)
	check.call(near_npc == lyra, "đứng gần Lyra")
	talk()
	hud.dialog_confirm()
	check.call(S.quest == 1, "nhận nhiệm vụ (quest=%d)" % S.quest)
	# vào đại sảnh, quái thức dậy
	hero.position = Vector3(34.0, 0, 12.0)
	await wait.call(2.5)
	var woke := enemies.filter(func(e): return e.room == "h" and e.state != "dormant").size()
	check.call(woke >= 3, "quái sảnh thức dậy: %d" % woke)
	# đánh thật vài đòn
	var hp0 := 0
	for e in enemies:
		if e.room == "h":
			hp0 += e.hp
	for i in 12:
		var tg = nearest_enemy(20.0)
		if tg:
			hero.position = tg.root.position + Vector3(1.5, 0, 0)
			face_to(hero, tg.root.position)
		attack(tg)
		await wait.call(0.5)
	var hp1 := 0
	for e in enemies:
		if e.room == "h":
			hp1 += e.hp
	check.call(hp1 < hp0, "đòn đánh gây sát thương (%d -> %d)" % [hp0, hp1])
	S.hp = ST.maxHp
	# kỹ năng + đổi hero + bắn phép
	switch_hero("Mage")
	await wait.call(0.3)
	check.call(def.key == "Mage", "đổi sang Mage")
	S.mp = ST.maxMp
	skill()
	await wait.call(1.5)
	attack()
	await wait.call(0.8)
	switch_hero("Knight")
	# dọn sạch sảnh
	for e in enemies:
		if e.room == "h" and e.alive:
			if e.state == "dormant":
				e.state = "chase"
			damage_enemy(e, 9999)
	await wait.call(1.5)
	check.call(hall_left() == 0 and S.quest == 2, "dọn sạch sảnh -> quest=2 (%d)" % S.quest)
	check.call(S.lvl > 1, "lên cấp: %d" % S.lvl)
	# trả quest
	hero.position = Vector3(15.0, 0, 12.5)
	await wait.call(0.2)
	S.hp = ST.maxHp
	talk()
	hud.dialog_confirm()
	await wait.call(1.5)
	check.call(S.quest == 3, "trả quest (quest=%d)" % S.quest)
	# nhặt đồ
	var bag0: int = S.bag.size()
	for o in loot.duplicate():
		if o.ready:
			hero.position = o.g.position
			await wait.call(0.1)
	check.call(S.bag.size() > bag0 or S.gold > 0, "nhặt đồ: túi %d -> %d" % [bag0, S.bag.size()])
	# trang bị đồ huyền thoại nếu có
	for it in S.bag:
		if it.kind == "weapon" and it.rarity == 3:
			hud.act(it, "eq")
			break
	# mở rương sảnh
	hero.position = Vector3(36.0, 0, 8.4)
	await wait.call(0.3)
	check.call(chests[0].opened, "mở rương đại sảnh")
	# boss
	hero.position = Vector3(12.5, 0, 23.0)
	await wait.call(1.0)
	var boss: Dictionary = enemies.filter(func(e): return e.def.get("boss", false))[0]
	check.call(boss.state != "idle", "boss phát hiện hero (%s)" % boss.state)
	invuln = now + 999
	for i in 10:
		hero.position = boss.root.position + Vector3(2.2, 0, 0)
		face_to(hero, boss.root.position)
		attack(boss)
		await wait.call(0.5)
	check.call(boss.hp < boss.max, "boss mất máu %d/%d" % [boss.hp, boss.max])
	damage_enemy(boss, 99999)
	await wait.call(2.0)
	check.call(not boss.alive, "hạ boss")
	hero.position = Vector3(8.5, 0, 28.0)
	await wait.call(0.5)
	check.call(chests[1].opened, "mở rương vàng hầm mộ")
	# chết + hồi sinh
	invuln = 0
	hurt_hero(99999)
	check.call(state == "dead", "hero gục ngã")
	await wait.call(3.5)
	check.call(state == "idle" and S.hp > 0, "hồi sinh tại quán")
	hud.toggle_inv()
	check.call(hud.inv_open(), "mở túi đồ")
	print("SELFTEST %s · lvl %d · vàng %d · túi %d món · %d node" % ["PASS" if fails.is_empty() else "FAIL (%d)" % fails.size(), S.lvl, S.gold, S.bag.size(), get_tree().get_node_count()])
	get_tree().quit.call_deferred(0 if fails.is_empty() else 1)
