// Hiệu ứng: vệt đạn, chớp nòng, lỗ đạn, bụi/máu, nổ. Dùng sprite + pool, không shader tự viết.
import * as THREE from 'three';

function radialTex(stops, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function flashTex() {
  const s = 128, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.translate(s / 2, s / 2);
  for (let i = 0; i < 7; i++) {
    g.rotate((Math.PI * 2) / 7 + Math.random() * 0.3);
    const gr = g.createLinearGradient(0, 0, s / 2, 0);
    gr.addColorStop(0, 'rgba(255,240,200,1)');
    gr.addColorStop(1, 'rgba(255,140,30,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(0, -5); g.lineTo(s / 2 * (0.6 + Math.random() * 0.4), 0); g.lineTo(0, 5);
    g.fill();
  }
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, s / 4);
  gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(1, 'rgba(255,180,60,0)');
  g.fillStyle = gr;
  g.fillRect(-s / 2, -s / 2, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function holeTex() {
  const s = 32, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(10,8,6,1)'); gr.addColorStop(0.35, 'rgba(25,20,15,0.95)'); gr.addColorStop(0.6, 'rgba(60,50,40,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.tex = {
      flash: flashTex(),
      glow: radialTex([[0, 'rgba(255,230,180,1)'], [0.4, 'rgba(255,150,50,0.6)'], [1, 'rgba(255,100,0,0)']]),
      smoke: radialTex([[0, 'rgba(200,190,170,0.8)'], [0.6, 'rgba(170,160,140,0.35)'], [1, 'rgba(150,140,120,0)']]),
      dust: radialTex([[0, 'rgba(210,190,150,0.9)'], [1, 'rgba(200,180,140,0)']]),
      blood: radialTex([[0, 'rgba(150,10,10,0.95)'], [0.6, 'rgba(110,0,0,0.5)'], [1, 'rgba(80,0,0,0)']]),
      hole: holeTex(),
    };
    // Lỗ đạn: pool cố định
    this.holes = [];
    this.holeIdx = 0;
    const hg = new THREE.PlaneGeometry(0.09, 0.09);
    const hm = new THREE.MeshBasicMaterial({ map: this.tex.hole, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    for (let i = 0; i < 160; i++) {
      const m = new THREE.Mesh(hg, hm);
      m.visible = false;
      scene.add(m);
      this.holes.push(m);
    }
    // Vệt đạn
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.55 });
    this.light = new THREE.PointLight(0xffb060, 0, 8, 2);
    scene.add(this.light);
    this.lightT = 0;
  }

  sprite(tex, pos, size, life, opts = {}) {
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: opts.add ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: opts.opacity ?? 1, rotation: Math.random() * 6.28 });
    const s = new THREE.Sprite(m);
    s.position.copy(pos);
    s.scale.setScalar(size);
    this.scene.add(s);
    this.items.push({ obj: s, baseOp: opts.opacity ?? 1, t: 0, life, grow: opts.grow ?? 0, vel: opts.vel ?? null, size, fade: opts.fade ?? 1, gravity: opts.gravity ?? 0 });
  }

  tracer(from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    if (len < 2) return;
    const start = from.clone().addScaledVector(dir, 1.2 / len);
    const seg = Math.min(len * 0.5, 6);
    const end = start.clone().addScaledVector(dir, seg / len);
    const g = new THREE.BufferGeometry().setFromPoints([start, end]);
    const l = new THREE.Line(g, this.tracerMat.clone());
    this.scene.add(l);
    this.items.push({ obj: l, t: 0, life: 0.06, tracer: { dir: dir.normalize(), speed: 300, len, travelled: 0 } });
  }

  muzzle(pos, big) {
    this.sprite(this.tex.flash, pos, big ? 0.55 : 0.35, 0.05, { add: true });
    this.light.position.copy(pos);
    this.light.intensity = big ? 6 : 3.5;
    this.lightT = 0.05;
  }

  impact(pos, normal, flesh) {
    if (flesh) {
      for (let i = 0; i < 3; i++) this.sprite(this.tex.blood, pos, 0.25 + Math.random() * 0.2, 0.35, { grow: 1.2, vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 1.2, (Math.random() - 0.5) * 1.5), gravity: 4 });
      return;
    }
    const n = normal ? new THREE.Vector3(normal.x, normal.y, normal.z) : new THREE.Vector3(0, 1, 0);
    this.sprite(this.tex.dust, pos.clone().addScaledVector(n, 0.05), 0.25, 0.5, { grow: 1.5, vel: n.clone().multiplyScalar(0.8), opacity: 0.8 });
    if (Math.random() < 0.4) this.sprite(this.tex.glow, pos.clone().addScaledVector(n, 0.03), 0.12, 0.06, { add: true });
    const h = this.holes[this.holeIdx++ % this.holes.length];
    h.visible = true;
    h.position.copy(pos).addScaledVector(n, 0.01);
    h.lookAt(pos.clone().add(n));
    h.rotateZ(Math.random() * 6.28);
  }

  explosion(pos, big) {
    const p = new THREE.Vector3(pos.x, pos.y + 0.3, pos.z);
    const k = big ? 3.5 : 1;
    this.sprite(this.tex.glow, p, 3 * k, 0.35, { add: true, grow: 2 });
    for (let i = 0; i < (big ? 26 : 12); i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 4 + 1, (Math.random() - 0.5) * 6).multiplyScalar(k * 0.7);
      this.sprite(this.tex.smoke, p, (1 + Math.random()) * k, 1.6 + Math.random() * (big ? 2.5 : 1), { grow: 1.2, vel: v, opacity: 0.9 });
    }
    for (let i = 0; i < 10; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 14, Math.random() * 9, (Math.random() - 0.5) * 14).multiplyScalar(k * 0.6);
      this.sprite(this.tex.glow, p, 0.25, 0.5, { add: true, vel: v, gravity: 9 });
    }
    this.light.position.copy(p);
    this.light.intensity = big ? 60 : 25;
    this.light.distance = big ? 40 : 15;
    this.lightT = big ? 0.5 : 0.18;
  }

  clearHoles() { for (const h of this.holes) h.visible = false; }

  update(dt) {
    if (this.lightT > 0) { this.lightT -= dt; if (this.lightT <= 0) { this.light.intensity = 0; this.light.distance = 8; } }
    for (const it of this.items) {
      it.t += dt;
      const k = it.t / it.life;
      if (it.tracer) {
        const tr = it.tracer;
        tr.travelled += tr.speed * dt;
        it.obj.position.addScaledVector(tr.dir, tr.speed * dt);
        if (tr.travelled > tr.len - 1) it.t = it.life;
        it.obj.material.opacity = 0.55 * (1 - k);
        continue;
      }
      const o = it.obj;
      if (it.vel) { o.position.addScaledVector(it.vel, dt); it.vel.y -= it.gravity * dt; it.vel.multiplyScalar(1 - Math.min(1, dt * 1.5)); }
      if (it.grow) o.scale.setScalar(it.size * (1 + it.grow * k));
      o.material.opacity = it.baseOp * Math.max(0, 1 - k);
    }
    this.items = this.items.filter((it) => {
      if (it.t < it.life) return true;
      this.scene.remove(it.obj);
      it.obj.material.dispose();
      if (it.tracer) it.obj.geometry.dispose();
      return false;
    });
  }
}
