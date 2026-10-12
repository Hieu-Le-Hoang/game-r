class_name Hud
extends CanvasLayer
## HUD dựng bằng code (Control): máu/mana/xp, skill + hồi chiêu, boss bar, banner, toast,
## quest, minimap, hội thoại, túi đồ, nhãn bám theo vật thể 3D. Port từ demo2/src/ui.js + index.html.

const FONT := preload("res://assets/fonts/BeVietnamPro-Medium.ttf")
const FONT_B := preload("res://assets/fonts/BeVietnamPro-Bold.ttf")
const FONT_T := preload("res://assets/fonts/Baloo2.ttf")
const GOLD := Color("f5c451")
const INK := Color("f2ecdf")

var G: Node # main.gd
var icons := {}
var root: Control
var anchors: Array = []
var sel_id := -1

var _hp: ProgressBar
var _mp: ProgressBar
var _xp: ProgressBar
var _hp_txt: Label
var _mp_txt: Label
var _lvl: Label
var _name: Label
var _portrait: TextureRect
var _gold: Label
var _boss: Control
var _boss_name: Label
var _boss_bar: ProgressBar
var _banner: VBoxContainer
var _banner_t: Label
var _banner_s: Label
var _banner_tw: Tween
var _toasts: VBoxContainer
var _quest: PanelContainer
var _q_title: Label
var _q_step: Label
var _minimap: Control
var _heroes: HBoxContainer
var _sk := {}
var _talk: Button
var _hint: Label
var _hurt: ColorRect
var _dialog: Control
var _dlg_face: TextureRect
var _dlg_name: Label
var _dlg_text: Label
var _dlg_acts: HBoxContainer
var _inv: Control
var _equip: HBoxContainer
var _bag: GridContainer
var _stats: GridContainer
var _detail: VBoxContainer
var _anchor_layer: Control
var _loading: ColorRect
var _ld_bar: ProgressBar
var _ld_txt: Label


# ---------- style helpers ----------
func _box(bg: Color, radius := 10, border := Color(1, 1, 1, 0.08), bw := 1, pad := 10) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_corner_radius_all(radius)
	s.border_color = border
	s.set_border_width_all(bw)
	s.set_content_margin_all(pad)
	return s


func _glass() -> StyleBoxFlat:
	return _box(Color(0.03, 0.035, 0.07, 0.74), 12, Color(1, 1, 1, 0.09), 1, 10)


func _label(txt := "", size := 15, color := INK, font: Font = FONT) -> Label:
	var l := Label.new()
	l.text = txt
	l.add_theme_font_override("font", font)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	l.add_theme_constant_override("outline_size", 4)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


func _bar(fill: Color, h := 14.0) -> ProgressBar:
	var b := ProgressBar.new()
	b.show_percentage = false
	b.custom_minimum_size = Vector2(0, h)
	b.max_value = 1.0
	b.step = 0.0
	b.add_theme_stylebox_override("background", _box(Color(0, 0, 0, 0.55), 6, Color(1, 1, 1, 0.1), 1, 0))
	b.add_theme_stylebox_override("fill", _box(fill, 6, Color(1, 1, 1, 0.18), 1, 0))
	b.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return b


func _button(txt: String, primary := true) -> Button:
	var b := Button.new()
	b.text = txt
	b.add_theme_font_override("font", FONT_B)
	b.add_theme_font_size_override("font_size", 15)
	var base := Color("3a2a12") if primary else Color(1, 1, 1, 0.06)
	var bd := GOLD if primary else Color(1, 1, 1, 0.25)
	b.add_theme_stylebox_override("normal", _box(base, 8, bd, 1, 8))
	b.add_theme_stylebox_override("hover", _box(base.lightened(0.15), 8, bd, 1, 8))
	b.add_theme_stylebox_override("pressed", _box(base.darkened(0.2), 8, bd, 1, 8))
	b.add_theme_stylebox_override("focus", _box(Color(0, 0, 0, 0), 8, GOLD, 2, 8))
	b.add_theme_color_override("font_color", GOLD if primary else INK)
	return b


## Gỡ con ngay lập tức (queue_free để con cũ nằm lại tới cuối frame -> bấm nhầm nút cũ, layout lệch).
func _clear(n: Node) -> void:
	for c in n.get_children():
		n.remove_child(c)
		c.queue_free()


## Canh giữa theo chiều ngang, rộng cố định (min size của container chưa tính lúc dựng nên không dùng preset).
func _top_center(c: Control, w: float, y: float) -> void:
	root.add_child(c)
	c.anchor_left = 0.5
	c.anchor_right = 0.5
	c.offset_left = -w / 2
	c.offset_right = w / 2
	c.offset_top = y
	c.grow_horizontal = Control.GROW_DIRECTION_BOTH


func _place(c: Control, preset: int, off := Vector2.ZERO) -> void:
	root.add_child(c)
	c.set_anchors_and_offsets_preset(preset, Control.PRESET_MODE_MINSIZE, 16)
	c.position += off


# ---------- build ----------
func build(game: Node) -> void:
	G = game
	root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	_hurt = ColorRect.new()
	_hurt.color = Color(0.8, 0.05, 0.05, 0.0)
	_hurt.set_anchors_preset(Control.PRESET_FULL_RECT)
	_hurt.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_hurt)

	_anchor_layer = Control.new()
	_anchor_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	_anchor_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_anchor_layer)

	_build_vitals()
	_build_right()
	_build_top()
	_build_bottom()
	_build_dialog()
	_build_inv()
	_build_loading()


func _build_vitals() -> void:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _glass())
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 10)
	p.add_child(h)
	var face := Control.new()
	face.custom_minimum_size = Vector2(64, 64)
	_portrait = TextureRect.new()
	_portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_portrait.set_anchors_preset(Control.PRESET_FULL_RECT)
	var fbg := Panel.new()
	fbg.add_theme_stylebox_override("panel", _box(Color("1c1626"), 32, GOLD, 2, 0))
	fbg.set_anchors_preset(Control.PRESET_FULL_RECT)
	face.add_child(fbg)
	face.add_child(_portrait)
	_lvl = _label("1", 14, Color("1a1206"), FONT_B)
	_lvl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var lv := PanelContainer.new()
	lv.add_theme_stylebox_override("panel", _box(GOLD, 10, Color(0, 0, 0, 0.4), 1, 1))
	lv.add_child(_lvl)
	lv.position = Vector2(42, 44)
	lv.custom_minimum_size = Vector2(24, 20)
	face.add_child(lv)
	h.add_child(face)
	var v := VBoxContainer.new()
	v.custom_minimum_size = Vector2(220, 0)
	v.add_theme_constant_override("separation", 4)
	_name = _label("Hiệp Sĩ", 17, INK, FONT_T)
	v.add_child(_name)
	_hp = _bar(Color("c8323c"), 16)
	_hp_txt = _label("", 11)
	_hp_txt.set_anchors_preset(Control.PRESET_FULL_RECT)
	_hp_txt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hp.add_child(_hp_txt)
	v.add_child(_hp)
	_mp = _bar(Color("2f6fd6"), 12)
	_mp_txt = _label("", 10)
	_mp_txt.set_anchors_preset(Control.PRESET_FULL_RECT)
	_mp_txt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_mp.add_child(_mp_txt)
	v.add_child(_mp)
	_xp = _bar(GOLD, 5)
	v.add_child(_xp)
	h.add_child(v)
	_place(p, Control.PRESET_TOP_LEFT)


func _build_right() -> void:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	v.alignment = BoxContainer.ALIGNMENT_BEGIN
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var mp := PanelContainer.new()
	mp.add_theme_stylebox_override("panel", _box(Color(0.02, 0.025, 0.05, 0.6), 10, Color(1, 1, 1, 0.08), 1, 4))
	mp.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_minimap = Control.new()
	_minimap.custom_minimum_size = Vector2(170, 118)
	_minimap.draw.connect(_draw_minimap)
	_minimap.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mp.add_child(_minimap)
	v.add_child(mp)
	_quest = PanelContainer.new()
	_quest.add_theme_stylebox_override("panel", _glass())
	_quest.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var qv := VBoxContainer.new()
	_q_title = _label("", 14, GOLD, FONT_B)
	_q_step = _label("", 13)
	qv.add_child(_q_title)
	qv.add_child(_q_step)
	_quest.add_child(qv)
	_quest.visible = false
	v.add_child(_quest)
	_heroes = HBoxContainer.new()
	_heroes.alignment = BoxContainer.ALIGNMENT_END
	_heroes.add_theme_constant_override("separation", 6)
	v.add_child(_heroes)
	_place(v, Control.PRESET_TOP_RIGHT)


func _build_top() -> void:
	var v := VBoxContainer.new()
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.alignment = BoxContainer.ALIGNMENT_BEGIN
	v.custom_minimum_size = Vector2(460, 0)
	_boss = VBoxContainer.new()
	_boss_name = _label("Vua Xương", 18, Color("ffb07a"), FONT_T)
	_boss_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_boss_bar = _bar(Color("b8261e"), 14)
	_boss.add_child(_boss_name)
	_boss.add_child(_boss_bar)
	_boss.visible = false
	v.add_child(_boss)
	_top_center(v, 460, 18)

	_banner = VBoxContainer.new()
	_banner.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_banner_s = _label("", 15, Color(0.85, 0.8, 0.7))
	_banner_s.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner_t = _label("", 40, GOLD, FONT_T)
	_banner_t.add_theme_constant_override("outline_size", 8)
	_banner_t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner.add_child(_banner_s)
	_banner.add_child(_banner_t)
	_banner.modulate.a = 0.0
	_top_center(_banner, 900, 110)

	_toasts = VBoxContainer.new()
	_toasts.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_toasts.add_theme_constant_override("separation", 4)
	_toasts.custom_minimum_size = Vector2(380, 0)
	_place(_toasts, Control.PRESET_CENTER_LEFT, Vector2(0, -20))


func _build_bottom() -> void:
	var bag := _button("", false)
	bag.custom_minimum_size = Vector2(0, 40)
	bag.pressed.connect(toggle_inv)
	_gold = _label("0", 15, GOLD, FONT_B)
	var bh := HBoxContainer.new()
	bh.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bh.add_theme_constant_override("separation", 8)
	bh.add_child(_label("●", 14, GOLD))
	bh.add_child(_gold)
	bh.add_child(_label("Túi đồ [I]", 14))
	bh.set_anchors_preset(Control.PRESET_FULL_RECT)
	bh.offset_left = 12
	bag.custom_minimum_size = Vector2(170, 40)
	bag.add_child(bh)
	_place(bag, Control.PRESET_BOTTOM_LEFT)

	var sk := HBoxContainer.new()
	sk.add_theme_constant_override("separation", 10)
	sk.alignment = BoxContainer.ALIGNMENT_END
	for def in [["atk", "J", 76], ["q", "Q", 60], ["e", "Space", 60], ["r", "R", 60]]:
		sk.add_child(_skill_btn(def[0], def[1], def[2]))
	_place(sk, Control.PRESET_BOTTOM_RIGHT)

	_talk = _button("Nói chuyện [F]")
	_talk.visible = false
	_talk.pressed.connect(func(): G.talk())
	_place(_talk, Control.PRESET_CENTER_BOTTOM, Vector2(0, -120))

	_hint = _label("WASD / click để chạy · click quái hoặc J để đánh · Q kỹ năng · Space lăn né · R bình máu · F nói chuyện · 1-2-3 đổi hero", 13, Color(1, 1, 1, 0.75))
	_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_place(_hint, Control.PRESET_CENTER_BOTTOM, Vector2(0, -8))
	get_tree().create_timer(12.0).timeout.connect(func(): create_tween().tween_property(_hint, "modulate:a", 0.0, 1.0))


func _skill_btn(id: String, kbd: String, size: float) -> Control:
	var b := Button.new()
	b.custom_minimum_size = Vector2(size, size)
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_stylebox_override("normal", _box(Color(0.05, 0.05, 0.09, 0.82), int(size / 2), Color(GOLD, 0.6), 2, 0))
	b.add_theme_stylebox_override("hover", _box(Color(0.1, 0.09, 0.14, 0.9), int(size / 2), GOLD, 2, 0))
	b.add_theme_stylebox_override("pressed", _box(Color(0.2, 0.15, 0.05, 0.9), int(size / 2), GOLD, 2, 0))
	var ico := TextureRect.new()
	ico.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ico.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ico.set_anchors_preset(Control.PRESET_FULL_RECT)
	ico.offset_left = 8; ico.offset_top = 8; ico.offset_right = -8; ico.offset_bottom = -8
	ico.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(ico)
	var glyph := _label({"atk": "⚔", "q": "✦", "e": "»", "r": "✚"}[id], int(size * 0.38), Color(1, 1, 1, 0.85))
	glyph.set_anchors_preset(Control.PRESET_FULL_RECT)
	glyph.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	glyph.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	b.add_child(glyph)
	var cd := ColorRect.new()
	cd.color = Color(0, 0, 0, 0.62)
	cd.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cd.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	cd.anchor_top = 1.0
	b.add_child(cd)
	var k := _label(kbd, 11, Color(1, 1, 1, 0.8), FONT_B)
	k.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	k.position.y += 14
	b.add_child(k)
	var extra := _label("", 12, Color("9fd0ff"), FONT_B)
	extra.position = Vector2(size - 18, -4)
	b.add_child(extra)
	b.button_down.connect(func():
		match id:
			"atk": G.attack()
			"q": G.skill()
			"e": G.dodge()
			"r": G.drink()
	)
	_sk[id] = {"btn": b, "cd": cd, "ico": ico, "glyph": glyph, "extra": extra}
	if id == "q":
		extra.text = "20"
	return b


func _build_dialog() -> void:
	_dialog = Control.new()
	_dialog.set_anchors_preset(Control.PRESET_FULL_RECT)
	_dialog.mouse_filter = Control.MOUSE_FILTER_STOP
	_dialog.visible = false
	root.add_child(_dialog)
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _box(Color(0.04, 0.035, 0.07, 0.92), 14, Color(GOLD, 0.45), 1, 16))
	p.custom_minimum_size = Vector2(640, 0)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 14)
	_dlg_face = TextureRect.new()
	_dlg_face.custom_minimum_size = Vector2(96, 96)
	_dlg_face.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_dlg_face.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	h.add_child(_dlg_face)
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_dlg_name = _label("", 20, GOLD, FONT_T)
	_dlg_text = _label("", 16)
	_dlg_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_dlg_text.custom_minimum_size = Vector2(480, 0)
	_dlg_acts = HBoxContainer.new()
	_dlg_acts.add_theme_constant_override("separation", 10)
	v.add_child(_dlg_name)
	v.add_child(_dlg_text)
	v.add_child(_dlg_acts)
	h.add_child(v)
	p.add_child(h)
	var col := VBoxContainer.new()
	col.set_anchors_preset(Control.PRESET_FULL_RECT)
	col.offset_bottom = -110
	col.alignment = BoxContainer.ALIGNMENT_END
	col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var row := CenterContainer.new()
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(p)
	col.add_child(row)
	_dialog.add_child(col)


func _build_inv() -> void:
	_inv = Control.new()
	_inv.set_anchors_preset(Control.PRESET_FULL_RECT)
	_inv.mouse_filter = Control.MOUSE_FILTER_STOP
	_inv.visible = false
	root.add_child(_inv)
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.45)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.gui_input.connect(func(e): if e is InputEventMouseButton and e.pressed: _inv.visible = false)
	_inv.add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_inv.add_child(center)
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _box(Color(0.04, 0.035, 0.07, 0.95), 14, Color(GOLD, 0.4), 1, 14))
	center.add_child(p)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	p.add_child(v)
	var head := HBoxContainer.new()
	var t := _label("Túi đồ", 24, GOLD, FONT_T)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(t)
	var x := _button("✕", false)
	x.pressed.connect(func(): _inv.visible = false)
	head.add_child(x)
	v.add_child(head)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 18)
	v.add_child(h)
	var left := VBoxContainer.new()
	left.add_theme_constant_override("separation", 8)
	left.add_child(_label("Đang trang bị", 13, Color(1, 1, 1, 0.6)))
	_equip = HBoxContainer.new()
	_equip.add_theme_constant_override("separation", 8)
	left.add_child(_equip)
	left.add_child(_label("Hành trang", 13, Color(1, 1, 1, 0.6)))
	_bag = GridContainer.new()
	_bag.columns = 5
	_bag.add_theme_constant_override("h_separation", 5)
	_bag.add_theme_constant_override("v_separation", 5)
	left.add_child(_bag)
	_stats = GridContainer.new()
	_stats.columns = 2
	_stats.add_theme_constant_override("h_separation", 18)
	left.add_child(_stats)
	h.add_child(left)
	_detail = VBoxContainer.new()
	_detail.custom_minimum_size = Vector2(300, 0)
	_detail.add_theme_constant_override("separation", 6)
	h.add_child(_detail)


func _build_loading() -> void:
	_loading = ColorRect.new()
	_loading.color = Color("07080d")
	_loading.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(_loading)
	var v := VBoxContainer.new()
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 14)
	v.custom_minimum_size = Vector2(420, 0)
	var t := _label("Hầm Mộ Vua Xương", 46, GOLD, FONT_T)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(t)
	_ld_bar = _bar(GOLD, 8)
	v.add_child(_ld_bar)
	_ld_txt = _label("Đang tải mô hình 3D…", 14, Color(1, 1, 1, 0.7))
	_ld_txt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(_ld_txt)
	var c := _label("Godot 4.7 · Asset: KayKit by Kay Lousberg · CC0", 12, Color(1, 1, 1, 0.4))
	c.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(c)
	_loading.add_child(v)
	v.set_anchors_and_offsets_preset(Control.PRESET_CENTER, Control.PRESET_MODE_MINSIZE)


func loading(k: float, txt: String) -> void:
	_ld_bar.value = k
	_ld_txt.text = txt


func loaded() -> void:
	var tw := create_tween()
	tw.tween_property(_loading, "modulate:a", 0.0, 0.5)
	tw.tween_callback(_loading.queue_free)


# ---------- HUD updates ----------
func vitals(ST: Dictionary) -> void:
	_hp.value = clampf(S.hp / ST.maxHp, 0, 1)
	_mp.value = clampf(S.mp / ST.maxMp, 0, 1)
	_hp_txt.text = "%d/%d" % [maxi(0, ceili(S.hp)), ST.maxHp]
	_mp_txt.text = "%d/%d" % [floori(S.mp), ST.maxMp]
	_xp.value = float(S.xp) / S.xp_need()
	_lvl.text = str(S.lvl)
	_gold.text = str(S.gold)
	_sk.r.extra.text = str(S.potions())


func hero(def: Dictionary) -> void:
	_name.text = def.name
	_portrait.texture = icons.get("face_" + def.key)
	_set_ico("atk", def.atkIcon)
	_set_ico("q", def.skillIcon)
	_set_ico("r", "bottle_A_green")
	for b in _heroes.get_children():
		b.modulate = Color.WHITE if b.get_meta("k") == def.key else Color(1, 1, 1, 0.45)


func _set_ico(id: String, key: String) -> void:
	var tex: Texture2D = icons.get(key)
	_sk[id].ico.texture = tex
	_sk[id].glyph.visible = tex == null


func hero_buttons(defs: Array) -> void:
	for d in defs:
		var b := Button.new()
		b.custom_minimum_size = Vector2(44, 44)
		b.focus_mode = Control.FOCUS_NONE
		b.tooltip_text = d.name
		b.add_theme_stylebox_override("normal", _box(Color(0.05, 0.05, 0.09, 0.8), 22, Color(GOLD, 0.5), 2, 0))
		b.add_theme_stylebox_override("hover", _box(Color(0.12, 0.1, 0.15, 0.9), 22, GOLD, 2, 0))
		b.set_meta("k", d.key)
		var tex: Texture2D = icons.get("face_" + d.key)
		if tex:
			b.icon = tex
			b.expand_icon = true
		else:
			b.text = d.name.substr(0, 1)
		b.button_down.connect(func(): G.switch_hero(d.key))
		_heroes.add_child(b)


func cooldowns(cd: Dictionary, now: float, cost_ok: bool) -> void:
	for x in [["q", 4.0], ["e", 1.2], ["r", 5.0]]:
		var left := maxf(0.0, cd[x[0]] - now)
		_sk[x[0]].cd.anchor_top = 1.0 - left / x[1]
	_sk.q.btn.modulate = Color.WHITE if cost_ok else Color(0.6, 0.6, 0.8)


func toast(msg: String, color := INK) -> void:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _box(Color(0.03, 0.03, 0.06, 0.7), 8, Color(color, 0.35), 1, 7))
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	p.add_child(_label(msg, 14, color))
	_toasts.add_child(p)
	while _toasts.get_child_count() > 5:
		_toasts.get_child(0).free()
	var tw := p.create_tween()
	tw.tween_interval(3.0)
	tw.tween_property(p, "modulate:a", 0.0, 0.5)
	tw.tween_callback(p.queue_free)


func banner(title: String, sub: String) -> void:
	_banner_t.text = title
	_banner_s.text = sub
	if _banner_tw:
		_banner_tw.kill()
	_banner_tw = create_tween()
	_banner_tw.tween_property(_banner, "modulate:a", 1.0, 0.25)
	_banner_tw.tween_interval(2.3)
	_banner_tw.tween_property(_banner, "modulate:a", 0.0, 0.6)


func boss(e) -> void:
	if e == null or not e.alive:
		_boss.visible = false
		return
	_boss.visible = true
	_boss_name.text = e.def.name
	_boss_bar.value = maxf(0.0, float(e.hp) / e.max)


func quest() -> void:
	if S.quest == 0 or S.quest == 3:
		_quest.visible = false
		return
	_quest.visible = true
	_q_title.text = "Dọn sạch Đại Sảnh"
	var left: int = G.hall_left()
	if S.quest == 2:
		_q_step.text = "✔ Quay lại gặp Pháp Sư Lyra"
		_q_step.add_theme_color_override("font_color", Color("7be38a"))
	else:
		_q_step.text = "Hạ bộ xương: %d/%d" % [G.hall_total - left, G.hall_total]
		_q_step.add_theme_color_override("font_color", INK)


func hurt_flash() -> void:
	_hurt.color.a = 0.28
	create_tween().tween_property(_hurt, "color:a", 0.0, 0.35)


func show_talk(v: bool) -> void:
	_talk.visible = v


# ---------- world-anchored ----------
func anchor(c: Control, target: Callable, o := {}) -> Dictionary:
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_anchor_layer.add_child(c)
	var a := {"c": c, "pos": target, "dy": o.get("dy", 0.0), "life": o.get("life", 0.0), "t": 0.0, "rise": o.get("rise", 0.0), "off": false}
	anchors.append(a)
	return a


func drop(a: Dictionary) -> void:
	anchors.erase(a)
	if is_instance_valid(a.c):
		a.c.queue_free()


func update_anchors(cam: Camera3D, dt: float) -> void:
	for i in range(anchors.size() - 1, -1, -1):
		var a: Dictionary = anchors[i]
		a.t += dt
		if a.life > 0 and a.t >= a.life:
			a.c.queue_free()
			anchors.remove_at(i)
			continue
		var p: Vector3 = a.pos.call()
		p.y += a.dy
		if a.off or cam.is_position_behind(p):
			a.c.visible = false
			continue
		a.c.visible = true
		var s := cam.unproject_position(p)
		var k: float = a.t / a.life if a.life > 0 else 0.0
		s.y -= a.rise * (1.0 - pow(1.0 - k, 2.0))
		a.c.position = s - Vector2(a.c.size.x * 0.5, a.c.size.y)
		if a.life > 0:
			a.c.modulate.a = 1.0 - (k - 0.6) / 0.4 if k > 0.6 else 1.0


func enemy_bar() -> ProgressBar:
	var b := _bar(Color("d8463a"), 6)
	b.custom_minimum_size = Vector2(56, 6)
	b.size = Vector2(56, 6)
	b.value = 1.0
	return b


func world_label(txt: String, color: Color, size := 13) -> Label:
	var l := _label(txt, size, color, FONT_B)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return l


func bubble(txt: String) -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _box(Color(0.96, 0.93, 0.85, 0.93), 10, Color(0, 0, 0, 0.3), 1, 8))
	var l := _label(txt, 13, Color("2a2018"))
	l.remove_theme_constant_override("outline_size")
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(220, 0)
	p.add_child(l)
	return p


# ---------- dialog ----------
func dialog(face: Texture2D, who: String, text: String, acts: Array) -> void:
	_dialog.visible = true
	_dlg_face.texture = face
	_dlg_name.text = who
	_dlg_text.text = text
	_clear(_dlg_acts)
	var first: Button = null
	for a in acts:
		var b := _button(a[0], not (a.size() > 2 and a[2]))
		var fn = a[1]
		b.pressed.connect(func():
			_dialog.visible = false
			if fn is Callable and fn.is_valid():
				fn.call()
		)
		_dlg_acts.add_child(b)
		if first == null:
			first = b
	if first:
		first.grab_focus.call_deferred()


func dialog_confirm() -> void:
	if _dlg_acts.get_child_count() > 0:
		(_dlg_acts.get_child(0) as Button).pressed.emit()


func busy() -> bool:
	return _dialog.visible or _inv.visible


func dialog_open() -> bool:
	return _dialog.visible


func close_all() -> void:
	_dialog.visible = false
	_inv.visible = false


# ---------- inventory ----------
func toggle_inv() -> void:
	_inv.visible = not _inv.visible
	if _inv.visible:
		inv()


func inv_open() -> bool:
	return _inv.visible


func _cell(it, big := false) -> Control:
	var sz := Vector2(58, 58) if big else Vector2(46, 46)
	if it == null:
		var e := Panel.new()
		e.custom_minimum_size = sz
		e.add_theme_stylebox_override("panel", _box(Color(1, 1, 1, 0.03), 8, Color(1, 1, 1, 0.08), 1, 0))
		return e
	var col: Color = S.RAR[it.rarity].c
	var b := Button.new()
	b.custom_minimum_size = sz
	b.focus_mode = Control.FOCUS_NONE
	var bw := 3 if sel_id == it.id else 1
	b.add_theme_stylebox_override("normal", _box(Color(col, 0.12), 8, Color(col, 0.75), bw, 2))
	b.add_theme_stylebox_override("hover", _box(Color(col, 0.22), 8, col, 2, 2))
	b.add_theme_stylebox_override("pressed", _box(Color(col, 0.3), 8, col, 2, 2))
	var tex: Texture2D = icons.get(it.m)
	if tex:
		b.icon = tex
		b.expand_icon = true
		b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	else:
		b.text = it.name.substr(0, 2)
	b.tooltip_text = it.name
	b.mouse_entered.connect(func(): detail(it))
	b.pressed.connect(func():
		sel_id = it.id
		inv()
	)
	return b


func inv() -> void:
	for box in [_equip, _bag, _stats]:
		_clear(box)
	_equip.add_child(_cell(S.eq.weapon, true))
	_equip.add_child(_cell(S.eq.shield, true))
	for i in S.BAG_SIZE:
		_bag.add_child(_cell(S.bag[i] if i < S.bag.size() else null))
	var ST: Dictionary = G.ST
	var fire := " (+%d lửa)" % ST.fire if ST.fire else ""
	for row in [
		["Sát thương", "%d–%d%s" % [roundi(ST.dmg[0] * ST.mult), roundi(ST.dmg[1] * ST.mult), fire]],
		["Giáp", str(ST.armor)], ["Chí mạng", "%.1f%%" % ST.crit], ["Máu / Mana", "%d / %d" % [ST.maxHp, ST.maxMp]], ["Vàng", str(S.gold)],
	]:
		_stats.add_child(_label(row[0], 13, Color(1, 1, 1, 0.55)))
		_stats.add_child(_label(row[1], 13))
	var it = find(sel_id)
	detail(it if it else S.eq.weapon)


func find(id: int):
	for x in [S.eq.weapon, S.eq.shield] + S.bag:
		if x and x.id == id:
			return x
	return null


func detail(it) -> void:
	_clear(_detail)
	if it == null:
		_detail.add_child(_label("Chọn một món để xem chỉ số.", 13, Color(1, 1, 1, 0.5)))
		return
	var R: Dictionary = S.RAR[it.rarity]
	var worn: bool = S.eq.weapon == it or S.eq.shield == it
	var nm := _label(it.name, 20, R.c, FONT_T)
	_detail.add_child(nm)
	var sub: String = R.n
	if it.has("base") and it.rarity >= 2:
		sub += " · " + it.base
	sub += " · cấp %d%s" % [it.ilvl, " · đang mặc" if worn else ""]
	_detail.add_child(_label(sub, 12, Color(1, 1, 1, 0.55)))
	if it.has("dmg"):
		_detail.add_child(_label("%d–%d sát thương" % [it.dmg[0], it.dmg[1]], 16, INK, FONT_B))
	if it.has("armor"):
		_detail.add_child(_label("%d giáp" % it.armor, 16, INK, FONT_B))
	if it.kind == "potion":
		_detail.add_child(_label("Hồi 45% máu (phím R)", 15, INK, FONT_B))
	for a in it.affixes:
		_detail.add_child(_label("• " + a.t, 14, Color("9fd0ff")))
	if it.has("power"):
		var pw := _label(it.power.p, 14, Color("ff9a4a"))
		pw.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		pw.custom_minimum_size = Vector2(280, 0)
		_detail.add_child(pw)
	if not worn and it.kind != "potion":
		var cur = S.eq[it.kind]
		var val := func(x): return 0.0 if x == null else ((x.dmg[0] + x.dmg[1]) / 2.0 if x.has("dmg") else float(x.armor))
		var diff := snappedf(val.call(it) - val.call(cur), 0.1)
		var txt := "%s %s %s so với đồ đang mặc" % ["▲" if diff >= 0 else "▼", str(absf(diff)), "sát thương TB" if it.has("dmg") else "giáp"]
		_detail.add_child(_label(txt, 13, Color("7be38a") if diff >= 0 else Color("ff7a6b")))
	if not worn:
		var acts := HBoxContainer.new()
		acts.add_theme_constant_override("separation", 8)
		var a1 := _button("Uống" if it.kind == "potion" else "Trang bị")
		a1.pressed.connect(func(): act(it, "use" if it.kind == "potion" else "eq"))
		var a2 := _button("Bán %d vàng" % S.sell_price(it), false)
		a2.pressed.connect(func(): act(it, "sell"))
		acts.add_child(a1)
		acts.add_child(a2)
		_detail.add_child(acts)


func act(it: Dictionary, a: String) -> void:
	var i: int = S.bag.find(it)
	if i < 0:
		return
	if a == "eq":
		var old = S.eq[it.kind]
		S.eq[it.kind] = it
		S.bag.remove_at(i)
		if old:
			S.bag.insert(i, old)
		G.equip_changed(it)
	elif a == "sell":
		S.bag.remove_at(i)
		S.gold += S.sell_price(it)
		sel_id = -1
	elif a == "use":
		G.drink()
	G.refresh()
	inv()


# ---------- minimap ----------
func minimap() -> void:
	_minimap.queue_redraw()


func _draw_minimap() -> void:
	if G == null or G.hero == null:
		return
	var M: Array = G.MAP
	var W := _minimap.size.x
	var H := _minimap.size.y
	var cols: int = M[0].length()
	var rows: int = M.size()
	var s := minf(W / cols, H / rows)
	var o := Vector2((W - cols * s) / 2, (H - rows * s) / 2)
	for r in rows:
		for q in cols:
			var ch: String = M[r][q]
			if ch == "#" or not G.seen.has(Vector2i(q, r)):
				continue
			var col := Color("3c3352") if ch == "c" else Color("4d3a26") if ch == "t" else Color("3a3f4f")
			_minimap.draw_rect(Rect2(o + Vector2(q, r) * s + Vector2(0.5, 0.5), Vector2(s - 1, s - 1)), col)
	var P := func(p: Vector3) -> Vector2: return o + Vector2(p.x, p.z) / G.C * s
	for e in G.enemies:
		if e.alive and e.state != "dormant":
			_minimap.draw_circle(P.call(e.root.position), 3.5 if e.def.get("boss") else 2.2, Color("ff8a3a") if e.def.get("boss") else Color("ff5a6a"))
	for n in G.npcs:
		_minimap.draw_circle(P.call(n.root.position), 2.6, Color("9fd0ff"))
	for ch in G.chests:
		if not ch.opened:
			_minimap.draw_rect(Rect2(P.call(ch.obj.position) - Vector2(2, 2), Vector2(4, 4)), GOLD)
	var hp: Vector2 = P.call(G.hero.position)
	var ang: float = G.hero.rotation.y
	var tri := PackedVector2Array([Vector2(0, 4.5), Vector2(3.2, -3), Vector2(-3.2, -3)])
	var xf := Transform2D(-ang, hp)
	_minimap.draw_colored_polygon(xf * tri, Color.WHITE)
