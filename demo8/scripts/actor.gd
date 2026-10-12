class_name Actor
extends Node3D
## Nhân vật có skeleton KayKit: phát animation (crossfade), ẩn/hiện mesh phụ kiện, gắn vũ khí vào tay.

const LOOPS := ["Idle", "2H_Melee_Idle", "Idle_Combat", "Running_A", "Running_C", "Walking_A", "Walking_D_Skeletons", "Sit_Chair_Idle"]

var key := ""
var model: Node3D
var ap: AnimationPlayer
var skel: Skeleton3D
var cur_name := ""
var on_done: Callable
var slots := {}
var _hands := {}
var _meshes: Array[MeshInstance3D] = []


func setup(model_key: String, scale_k := 1.0) -> Actor:
	key = model_key
	model = Assets.inst(model_key)
	model.scale = Vector3.ONE * scale_k
	add_child(model)
	ap = model.find_child("AnimationPlayer", true, false)
	skel = model.find_child("Skeleton3D", true, false)
	for n in model.find_children("*", "MeshInstance3D", true, false):
		_meshes.append(n)
	for anim_name in LOOPS:
		if ap.has_animation(anim_name):
			ap.get_animation(anim_name).loop_mode = Animation.LOOP_LINEAR
	ap.animation_finished.connect(_on_finished)
	return self


func has_anim(n: String) -> bool:
	return ap.has_animation(n)


## Phát animation, trả về thời lượng thực (đã chia speed). opt: once, speed, fade, restart, on_done
func play(n: String, opt := {}) -> float:
	if not ap.has_animation(n):
		return 0.0
	var speed: float = opt.get("speed", 1.0)
	var length := ap.get_animation(n).length
	var once: bool = opt.get("once", false)
	if cur_name == n and not once and not opt.get("restart", false):
		ap.speed_scale = speed
		return length / speed
	if cur_name == n:
		ap.stop(true)
	ap.speed_scale = speed
	ap.play(n, opt.get("fade", 0.15))
	cur_name = n
	on_done = opt.get("on_done", Callable())
	return length / speed


func _on_finished(n: StringName) -> void:
	if String(n) == cur_name and on_done.is_valid():
		var f := on_done
		on_done = Callable()
		f.call()


func set_parts(names: Array, vis: bool) -> void:
	for n in names:
		var o := model.find_child(n, true, false)
		if o:
			o.visible = vis


func _hand(slot: String) -> Node3D:
	if _hands.has(slot):
		return _hands[slot]
	var h: Node3D = skel.get_node_or_null("handslot_" + slot)
	if h == null:
		var b := BoneAttachment3D.new()
		b.name = "handslot_" + slot
		b.bone_name = "handslot." + slot
		skel.add_child(b)
		h = b
	_hands[slot] = h
	return h


## Gắn model vũ khí vào tay "r" / "l". ref = tên mesh gốc trong model để mượn vị trí/góc/tỉ lệ.
func attach(slot: String, item_key, ref := "") -> void:
	var hand := _hand(slot)
	if slots.get(slot):
		slots[slot].queue_free()
		slots.erase(slot)
	if item_key == null or item_key == "":
		return
	var m := Assets.inst(item_key)
	var r: Node3D = model.find_child(ref, true, false) if ref != "" else null
	if r:
		m.transform = r.transform
	hand.add_child(m)
	slots[slot] = m
	_meshes.append_array(m.find_children("*", "MeshInstance3D", true, false))


func set_overlay(mat: Material) -> void:
	for m in _meshes:
		if is_instance_valid(m):
			m.material_overlay = mat
