class_name Fx
extends Node3D
## Hiệu ứng: hạt (CPUParticles3D), vòng sóng, vệt chém, vùng cảnh báo, cầu phép, cột sáng loot.
## Shader tự viết: luôn kẹp đầu vào pow/sqrt để tránh NaN (bài học demo2/demo6).

const RING_SHADER := """
shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;
uniform vec4 color : source_color = vec4(1.0);
uniform float alpha = 1.0;
uniform float inner = 0.8;
uniform float arc = 6.3;
uniform float soft = 0.1;
varying vec2 lp;
void vertex() {
	lp = VERTEX.xz; // PlaneMesh 2x2 -> [-1, 1], +Z cục bộ = hướng mặt nhân vật
}
void fragment() {
	vec2 p = lp;
	float r = length(p);
	float ring = smoothstep(inner - soft, inner, r) * (1.0 - smoothstep(1.0 - soft, 1.0, r));
	float ang = abs(atan(p.x, p.y + 1e-5));
	float m = 1.0 - smoothstep(arc * 0.5 - 0.25, arc * 0.5, ang);
	float a = clamp(ring * m * alpha * color.a, 0.0, 1.0);
	ALBEDO = color.rgb * a; // Compatibility: blend_add không nhân ALPHA -> tự nhân
	ALPHA = a;
}
"""

const DISC_SHADER := """
shader_type spatial;
render_mode unshaded, blend_mix, cull_disabled, depth_draw_never, shadows_disabled;
uniform vec4 color : source_color = vec4(1.0, 0.25, 0.15, 1.0);
uniform float progress = 0.0;
varying vec2 lp;
void vertex() {
	lp = VERTEX.xz;
}
void fragment() {
	float r = length(lp);
	float edge = smoothstep(0.9, 0.95, r) * (1.0 - smoothstep(0.98, 1.0, r));
	float fill = (1.0 - smoothstep(progress - 0.03, progress, r)) * 0.35 * step(r, 1.0);
	ALBEDO = color.rgb;
	ALPHA = clamp((edge * 0.9 + fill) * color.a, 0.0, 1.0);
}
"""

const BEAM_SHADER := """
shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;
uniform vec4 color : source_color = vec4(1.0);
uniform float alpha = 0.8;
uniform float height = 3.0;
varying float h;
void vertex() {
	h = clamp(VERTEX.y / height + 0.5, 0.0, 1.0);
}
void fragment() {
	float side = clamp(abs(dot(NORMAL, VIEW)), 0.0, 1.0);
	float fade = pow(clamp(1.0 - h, 0.0, 1.0), 1.6);
	float a = clamp(fade * side * side * alpha, 0.0, 1.0);
	ALBEDO = color.rgb * a;
	ALPHA = a;
}
"""

var _ring_sh: Shader
var _disc_sh: Shader
var _beam_sh: Shader
var _dot_tex: GradientTexture2D
var _mat_add: StandardMaterial3D
var _mat_mix: StandardMaterial3D
var flash_mat: StandardMaterial3D


func _ready() -> void:
	_ring_sh = Shader.new()
	_ring_sh.code = RING_SHADER
	_disc_sh = Shader.new()
	_disc_sh.code = DISC_SHADER
	_beam_sh = Shader.new()
	_beam_sh.code = BEAM_SHADER
	var g := Gradient.new()
	g.set_color(0, Color(1, 1, 1, 1))
	g.set_color(1, Color(1, 1, 1, 0))
	g.add_point(0.35, Color(1, 1, 1, 0.75))
	_dot_tex = GradientTexture2D.new()
	_dot_tex.gradient = g
	_dot_tex.fill = GradientTexture2D.FILL_RADIAL
	_dot_tex.fill_from = Vector2(0.5, 0.5)
	_dot_tex.fill_to = Vector2(1.0, 0.5)
	_dot_tex.width = 64
	_dot_tex.height = 64
	_mat_add = _particle_mat(BaseMaterial3D.BLEND_MODE_ADD)
	_mat_mix = _particle_mat(BaseMaterial3D.BLEND_MODE_MIX)
	flash_mat = StandardMaterial3D.new()
	flash_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	flash_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	flash_mat.albedo_color = Color(1, 1, 1, 0.8)


func _particle_mat(blend: BaseMaterial3D.BlendMode) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = blend
	m.vertex_color_use_as_albedo = true
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.billboard_keep_scale = true # thiếu cờ này billboard bỏ qua scale -> mọi hạt to 1m
	m.albedo_texture = _dot_tex
	m.no_depth_test = false
	m.disable_receive_shadows = true
	return m


func _colors(o: Dictionary) -> Array:
	if o.has("colors"):
		return o.colors
	return [o.get("color", Color.WHITE)]


func _make_particles(o: Dictionary) -> CPUParticles3D:
	var p := CPUParticles3D.new()
	var q := QuadMesh.new()
	q.size = Vector2.ONE
	q.material = _mat_mix if o.get("dust", false) else _mat_add
	p.mesh = q
	p.local_coords = false
	p.lifetime = o.get("life", 0.6)
	var sp: Array = o.get("speed", [1.0, 3.0])
	p.initial_velocity_min = sp[0]
	p.initial_velocity_max = sp[1]
	if o.get("flat", false):
		p.direction = Vector3(1, 0, 0)
		p.spread = 180.0
		p.flatness = 1.0
	elif o.has("dir"):
		var d: Vector3 = o.dir
		p.direction = d.normalized()
		p.spread = 25.0
		p.initial_velocity_min = d.length() * 0.6
		p.initial_velocity_max = d.length()
	else:
		p.direction = Vector3(0, 1, 0)
		p.spread = 180.0 - clampf(o.get("up", 0.0), 0.0, 1.5) * 60.0
	p.gravity = Vector3(0, -o.get("gravity", 0.0), 0)
	p.damping_min = o.get("drag", 1.5)
	p.damping_max = o.get("drag", 1.5) * 1.5
	var sz: Array = o.get("size", [0.35, 0.0])
	p.scale_amount_min = sz[0]
	p.scale_amount_max = sz[0]
	var curve := Curve.new()
	curve.add_point(Vector2(0, 1))
	curve.add_point(Vector2(1, clampf(sz[1] / maxf(sz[0], 0.001), 0.0, 1.0)))
	p.scale_amount_curve = curve
	var cols := _colors(o)
	var g := Gradient.new()
	if cols.size() == 1:
		g.set_color(0, cols[0])
		g.set_color(1, cols[0])
	else:
		g.offsets = PackedFloat32Array(range(cols.size()).map(func(i): return float(i) / (cols.size() - 1)))
		g.colors = PackedColorArray(cols)
	p.color_initial_ramp = g
	var a: float = o.get("alpha", 1.0)
	var fade := Gradient.new()
	if o.get("dust", false):
		fade.set_color(0, Color(1, 1, 1, a))
		fade.set_color(1, Color(1, 1, 1, 0))
	else:
		# hạt cộng sáng: fade cả rgb về đen vì Compatibility bỏ qua alpha khi blend add
		fade.set_color(0, Color(a, a, a, a))
		fade.set_color(1, Color(0, 0, 0, 0))
	p.color_ramp = fade
	if o.has("box"):
		p.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
		p.emission_box_extents = o.box
	else:
		p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
		p.emission_sphere_radius = maxf(o.get("spread", 0.2), 0.01)
	return p


## Nổ một chùm hạt tại pos rồi tự huỷ.
func burst(pos: Vector3, o: Dictionary) -> void:
	var p := _make_particles(o)
	p.amount = maxi(1, int(o.get("count", 10)))
	p.one_shot = true
	p.explosiveness = 0.95
	add_child(p)
	p.global_position = pos
	p.emitting = true
	get_tree().create_timer(p.lifetime + 0.3).timeout.connect(p.queue_free)


## Nguồn hạt liên tục (lửa đuốc, đuôi cầu phép, bụi lơ lửng), gắn vào parent.
func emitter(parent: Node3D, o: Dictionary) -> CPUParticles3D:
	var p := _make_particles(o)
	p.amount = int(o.get("count", 16))
	p.local_coords = false
	parent.add_child(p)
	p.position = o.get("offset", Vector3.ZERO)
	p.emitting = true
	return p


func _quad(sh: Shader, size: float) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(2, 2)
	var mat := ShaderMaterial.new()
	mat.shader = sh
	pm.material = mat
	m.mesh = pm
	m.scale = Vector3.ONE * size
	m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(m)
	return m


func shock(pos: Vector3, color: Color, radius: float, dur: float, y := 0.06) -> void:
	var m := _quad(_ring_sh, 0.2)
	m.global_position = Vector3(pos.x, y, pos.z)
	var mat: ShaderMaterial = m.mesh.material
	mat.set_shader_parameter("color", color)
	var tw := create_tween().set_parallel()
	tw.tween_property(m, "scale", Vector3.ONE * radius, dur).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_method(func(v): mat.set_shader_parameter("alpha", v), 1.0, 0.0, dur)
	tw.chain().tween_callback(m.queue_free)


func slash(pos: Vector3, ang: float, color: Color, radius: float) -> void:
	var m := _quad(_ring_sh, radius * 0.6)
	m.global_position = Vector3(pos.x, 1.0, pos.z)
	m.rotation.y = ang + 0.6
	var mat: ShaderMaterial = m.mesh.material
	mat.set_shader_parameter("color", color)
	mat.set_shader_parameter("arc", 2.6)
	mat.set_shader_parameter("inner", 0.55)
	var tw := create_tween().set_parallel()
	tw.tween_property(m, "scale", Vector3.ONE * radius, 0.22).set_ease(Tween.EASE_OUT)
	tw.tween_property(m, "rotation:y", ang - 0.6, 0.22)
	tw.tween_method(func(v): mat.set_shader_parameter("alpha", v), 1.0, 0.0, 0.25)
	tw.chain().tween_callback(m.queue_free)


func telegraph(pos: Vector3, radius: float, dur: float) -> void:
	var m := _quad(_disc_sh, radius)
	m.global_position = Vector3(pos.x, 0.05, pos.z)
	var mat: ShaderMaterial = m.mesh.material
	var tw := create_tween()
	tw.tween_method(func(v): mat.set_shader_parameter("progress", v), 0.0, 1.0, maxf(dur, 0.05))
	tw.tween_callback(m.queue_free)


func orb(color: Color, r: float) -> Node3D:
	var root := Node3D.new()
	var m := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = r
	s.height = r * 2
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = color.lightened(0.5)
	s.material = mat
	m.mesh = s
	m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(m)
	var halo := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2.ONE * r * 6
	var hm: StandardMaterial3D = _mat_add.duplicate()
	hm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	hm.vertex_color_use_as_albedo = false
	hm.albedo_color = color
	q.material = hm
	halo.mesh = q
	root.add_child(halo)
	var L := OmniLight3D.new()
	L.light_color = color
	L.light_energy = 0.7
	L.omni_range = 3.0
	root.add_child(L)
	return root


func loot_beam(color: Color, rarity: int) -> Node3D:
	var root := Node3D.new()
	var hgt := 1.6 + rarity * 1.1
	var c := MeshInstance3D.new()
	var cy := CylinderMesh.new()
	cy.top_radius = 0.18 + rarity * 0.04
	cy.bottom_radius = 0.32 + rarity * 0.05
	cy.height = hgt
	cy.cap_top = false
	cy.cap_bottom = false
	var mat := ShaderMaterial.new()
	mat.shader = _beam_sh
	mat.set_shader_parameter("color", color)
	mat.set_shader_parameter("height", hgt)
	mat.set_shader_parameter("alpha", 0.5 + rarity * 0.18)
	cy.material = mat
	c.mesh = cy
	c.position.y = hgt * 0.5
	c.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(c)
	var ring := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(2, 2)
	var rm := ShaderMaterial.new()
	rm.shader = _ring_sh
	rm.set_shader_parameter("color", color)
	rm.set_shader_parameter("alpha", 0.8)
	rm.set_shader_parameter("inner", 0.6)
	pm.material = rm
	ring.mesh = pm
	ring.scale = Vector3.ONE * (0.55 + rarity * 0.1)
	ring.position.y = 0.04
	root.add_child(ring)
	root.set_meta("beam_mat", mat)
	return root
