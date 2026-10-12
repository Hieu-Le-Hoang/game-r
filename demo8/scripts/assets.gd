extends Node
## Autoload "Assets": nạp model KayKit (glb/gltf đã import) và tạo instance theo key.

const CHARS := ["Knight", "Barbarian", "Mage", "Skeleton_Warrior", "Skeleton_Minion", "Skeleton_Mage"]
const DUNGEON := [
	"floor_tile_large", "floor_tile_large_rocks", "floor_tile_big_grate", "wall", "wall_cracked", "wall_arched", "wall_shelves", "wall_doorway",
	"pillar", "pillar_decorated", "column", "torch_mounted", "barrel_large", "barrel_small_stack", "box_stacked", "crates_stacked",
	"table_medium_decorated_A", "table_long_decorated_A", "chair", "stool", "chest", "chest_gold", "coin", "coin_stack_large", "coin_stack_small",
	"banner_red", "banner_patternA_blue", "banner_shield_red", "banner_triple_yellow", "shelf_large", "keg_decorated", "candle_triple",
	"rubble_large", "rubble_half", "sword_shield", "trunk_medium_A", "bottle_A_green", "plate_food_A", "shelves",
]
const ITEMS := [
	"sword_1handed", "axe_1handed", "axe_2handed", "sword_2handed", "staff", "wand", "dagger", "shield_round", "shield_spikes", "shield_badge",
	"spellbook_open", "mug_full", "Skeleton_Blade", "Skeleton_Axe", "Skeleton_Staff", "Skeleton_Shield_Small_A",
]

var _scenes := {}


func path_of(k: String) -> String:
	if k in CHARS:
		return "res://assets/models/chars/%s.glb" % k
	if k in ITEMS:
		return "res://assets/models/items/%s.gltf" % k
	return "res://assets/models/dungeon/%s.glb" % k


func all_keys() -> Array:
	return CHARS + DUNGEON + ITEMS


## Nạp 1 model, trả về true nếu thành công (dùng cho loading bar).
func preload_one(k: String) -> bool:
	if _scenes.has(k):
		return true
	var ps: PackedScene = load(path_of(k))
	if ps == null:
		push_error("Thiếu model: " + k)
		return false
	_scenes[k] = ps
	return true


func inst(k: String) -> Node3D:
	if not _scenes.has(k):
		preload_one(k)
	return _scenes[k].instantiate()
