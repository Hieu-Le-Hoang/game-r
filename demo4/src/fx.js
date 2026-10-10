import * as THREE from 'three';

// ---------- tween nhẹ ----------
export class Tweens {
  constructor() { this.list = []; }
  add(dur, fn, done) { const t = { t: 0, dur, fn, done }; this.list.push(t); return t; }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      t.t += dt;
      const k = Math.min(1, t.t / t.dur);
      t.fn(k);
      if (k >= 1) { this.list.splice(i, 1); t.done && t.done(); }
    }
  }
}

// ---------- particle system (Points + shader, 1 draw call) ----------
const VERT = `
attribute float size; attribute vec4 col; varying vec4 vCol; uniform float uScale;
void main() { vCol = col; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const FRAG = `
varying vec4 vCol; uniform float uSoft;
void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; float a = pow(1.0 - d * 2.0, uSoft); gl_FragColor = vec4(vCol.rgb, a * vCol.a); }`;

export class Particles {
  constructor(scene, cap, additive) {
    this.cap = cap; this.n = 0;
    this.pos = new Float32Array(cap * 3); this.vel = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 4); this.size = new Float32Array(cap);
    this.life = new Float32Array(cap); this.max = new Float32Array(cap);
    this.s0 = new Float32Array(cap); this.s1 = new Float32Array(cap);
    this.a0 = new Float32Array(cap); this.grav = new Float32Array(cap); this.drag = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('col', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 400 }, uSoft: { value: additive ? 1.6 : 1.0 } },
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.geo = g;
    scene.add(this.points);
  }
  emit(o) {
    const n = o.count || 1;
    const c = new THREE.Color(o.color ?? 0xffffff);
    for (let k = 0; k < n; k++) {
      let i = this.n < this.cap ? this.n++ : Math.floor(Math.random() * this.cap);
      const sp = o.spread ?? 0.2;
      this.pos[i * 3] = o.x + (Math.random() - 0.5) * sp;
      this.pos[i * 3 + 1] = o.y + (Math.random() - 0.5) * sp;
      this.pos[i * 3 + 2] = o.z + (Math.random() - 0.5) * sp;
      const sMin = o.speed?.[0] ?? 1, sMax = o.speed?.[1] ?? 3;
      const s = sMin + Math.random() * (sMax - sMin);
      let dx = Math.random() - 0.5, dy = Math.random() * (o.up ?? 0.6) + (o.up != null ? 0 : -0.1), dz = Math.random() - 0.5;
      if (o.dir) { dx += o.dir.x; dy += o.dir.y; dz += o.dir.z; }
      if (o.flat) dy = 0;
      const l = Math.hypot(dx, dy, dz) || 1;
      this.vel[i * 3] = dx / l * s; this.vel[i * 3 + 1] = dy / l * s; this.vel[i * 3 + 2] = dz / l * s;
      const cc = o.colors ? new THREE.Color(o.colors[Math.floor(Math.random() * o.colors.length)]) : c;
      this.col[i * 4] = cc.r; this.col[i * 4 + 1] = cc.g; this.col[i * 4 + 2] = cc.b;
      this.a0[i] = o.alpha ?? 1;
      this.max[i] = this.life[i] = (o.life ?? 0.6) * (0.7 + Math.random() * 0.6);
      this.s0[i] = o.size?.[0] ?? 0.3; this.s1[i] = o.size?.[1] ?? 0;
      this.grav[i] = o.gravity ?? 0; this.drag[i] = o.drag ?? 1.5;
    }
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= dr; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt; this.vel[i * 3 + 2] *= dr;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.s1[i] + (this.s0[i] - this.s1[i]) * k;
      this.col[i * 4 + 3] = this.a0[i] * Math.min(1, k * 2.5);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.col.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.geo.setDrawRange(0, this.n);
  }
}

// ---------- mesh effects ----------
const beamMat = (color) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uColor: { value: new THREE.Color(color) }, uA: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'varying vec2 vUv; uniform vec3 uColor; uniform float uA; void main(){ float a = pow(1.0 - vUv.y, 1.6) * uA; gl_FragColor = vec4(uColor * 1.6, a); }',
});

export function lootBeam(color, rarity) {
  const g = new THREE.Group();
  const h = [0, 3.2, 5, 8][rarity];
  if (h) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18 + rarity * 0.05, 0.32 + rarity * 0.06, h, 20, 1, true), beamMat(color));
    beam.position.y = h / 2;
    g.add(beam);
    g.userData.beam = beam;
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.6, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
  g.add(ring);
  g.userData.ring = ring;
  return g;
}

// review demo3: VFX vòng trắng đục phẳng -> shader gradient: viền sáng, lõi trong suốt, màu đậm dần ra mép, additive
const fxVert = 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const shockMat = (color) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uColor: { value: new THREE.Color(color) }, uA: { value: 1 } },
  vertexShader: fxVert,
  fragmentShader: `varying vec2 vP; uniform vec3 uColor; uniform float uA;
    void main(){
      float r = length(vP);
      float rim = smoothstep(0.62, 0.96, r) * (1.0 - smoothstep(0.96, 1.0, r));
      float a = (pow(rim, 2.0) + r * r * 0.12) * uA;
      vec3 c = mix(uColor, vec3(1.0), pow(rim, 6.0) * 0.3) * 1.05;
      gl_FragColor = vec4(c, a);
    }`,
});

export function shock(scene, tweens, pos, color, r1, dur = 0.4, y = 0.08) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 64), shockMat(color));
  m.rotation.x = -Math.PI / 2; m.position.set(pos.x, y, pos.z);
  scene.add(m);
  tweens.add(dur, (k) => { const e = 1 - (1 - k) ** 3; m.scale.setScalar(0.2 + e * r1); m.material.uniforms.uA.value = (1 - k) ** 1.5; }, () => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
}

// vệt chém: sáng ở mép trước (đầu lưỡi kiếm), đuôi mờ dần, lõi trắng nóng
const slashMat = (color, r0, r1, a0, len) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uColor: { value: new THREE.Color(color) }, uA: { value: 1 } },
  vertexShader: fxVert,
  fragmentShader: `varying vec2 vP; uniform vec3 uColor; uniform float uA;
    void main(){
      float t = clamp((atan(vP.y, vP.x) - (${a0.toFixed(4)})) / ${len.toFixed(4)}, 0.0, 1.0);
      float rr = clamp((length(vP) - ${r0.toFixed(4)}) / ${(r1 - r0).toFixed(4)}, 0.0, 1.0);
      float edge = pow(rr, 2.2) * (1.0 - smoothstep(0.92, 1.0, rr));
      float a = pow(t, 1.8) * edge * uA * (1.0 - smoothstep(0.94, 1.0, t));
      vec3 c = mix(uColor, vec3(1.0), smoothstep(0.55, 1.0, t * rr) * 0.45) * 1.3;
      gl_FragColor = vec4(c, a);
    }`,
});

export function slash(scene, tweens, pos, angle, color = 0xfff0c8, r = 1.7) {
  const a0 = -1.15, len = 2.3;
  const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.45, r, 40, 3, a0, len), slashMat(color, r * 0.45, r, a0, len));
  m.rotation.order = 'YXZ';
  m.rotation.set(-Math.PI / 2, angle, 0);
  m.position.set(pos.x, 1.0, pos.z);
  scene.add(m);
  tweens.add(0.24, (k) => { m.material.uniforms.uA.value = (1 - k) ** 1.3; m.scale.setScalar(0.85 + k * 0.3); m.rotation.y = angle - 0.5 + k * 1.0; }, () => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
}

export function telegraph(scene, tweens, pos, radius, dur) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.06, pos.z);
  scene.add(m);
  tweens.add(dur, (k) => { m.scale.setScalar(radius * (0.3 + 0.7 * k)); m.material.opacity = 0.15 + k * 0.35; }, () => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
}

export function orb(color, size = 0.22) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(size, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2) }));
  return m;
}

// mũi tên: thân + đầu nhọn, trục +Z (dùng lookAt để xoay theo hướng bay)
export function arrow(color = 0xfff0c8) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6), new THREE.MeshBasicMaterial({ color: 0x8a6a48 }));
  shaft.rotation.x = Math.PI / 2;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2) }));
  tip.rotation.x = Math.PI / 2; tip.position.z = 0.65;
  g.add(shaft, tip);
  return g;
}
