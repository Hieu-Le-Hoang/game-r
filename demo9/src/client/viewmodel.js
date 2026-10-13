// Súng góc nhìn thứ nhất (không vẽ tay — tay dựng bằng khối nhìn vụng hơn súng trơn): scene riêng, camera FOV hẹp, vẽ sau cùng (không xuyên tường). Nhún khi đi, giật khi bắn, hạ khi nạp đạn.
import * as THREE from 'three';
import { gunMesh } from './actors.js';
import { VIEW_CFG } from './view-config.js';

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(54, 1, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x806850, 1.6));
    const d = new THREE.DirectionalLight(0xfff0d6, 1.6);
    d.position.set(0.5, 1, 0.3);
    this.scene.add(d);
    this.holder = new THREE.Group();
    this.scene.add(this.holder);
    this.id = null;
    this.gun = null;
    this.bob = 0;
    this.kick = 0;
    this.swing = 0;
    this.sway = new THREE.Vector2();
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffd090, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.flash.visible = false;
  }

  setTexture(flashTex) { this.flash.material.map = flashTex; this.flash.material.needsUpdate = true; }

  set(id) {
    if (id === this.id) return;
    this.id = id;
    this.holder.clear();
    if (!id) return;
    this.gun = gunMesh(id);
    const cfg = VIEW_CFG[id] ?? VIEW_CFG.default;
    this.base = new THREE.Vector3(...cfg.pos);
    this.gun.rotation.set(...(cfg.rot ?? [0, 0, 0]));
    this.gun.scale.multiplyScalar(cfg.scale ?? 1);
    this.holder.add(this.gun);
    this.flash.position.copy(this.gun.userData.muzzle ?? new THREE.Vector3(0, 0.05, -0.4));
    this.flash.scale.setScalar(0.3);
    this.gun.add(this.flash);
    this.deployT = 0;
  }

  shoot(big) {
    this.kick = big ? 1.4 : 1;
    this.flash.visible = true;
    this.flash.material.rotation = Math.random() * 6.28;
    this.flashT = 0.04;
  }
  slash() { this.swing = 1; }

  update(dt, a, now, mouseDx) {
    if (!this.gun) return;
    const reloading = a.reloadEnd > now;
    const deploying = a.deployEnd > now;
    const speed = a.speed;
    if (a.onGround) this.bob += dt * speed * 1.7;
    const bobAmt = Math.min(1, speed / 5) * (a.onGround ? 1 : 0.3);
    this.kick = Math.max(0, this.kick - dt * 9);
    this.swing = Math.max(0, this.swing - dt * 4);
    this.sway.x += (-mouseDx * 0.0006 - this.sway.x) * Math.min(1, dt * 8);
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flash.visible = false; }
    const p = this.base;
    let y = p.y + Math.abs(Math.sin(this.bob)) * 0.012 * bobAmt - this.kick * 0.012;
    let z = p.z + this.kick * 0.04;
    let rx = this.kick * 0.09;
    const x = p.x + Math.sin(this.bob * 0.5) * 0.012 * bobAmt + this.sway.x;
    if (reloading) { y -= 0.08; rx -= 0.5; }
    if (deploying) { const k = Math.max(0, (a.deployEnd - now) / 0.6); y -= k * 0.15; rx -= k * 0.8; }
    if (!a.onGround) y += 0.01;
    this.holder.position.set(x, y, z);
    this.holder.rotation.set(rx, this.swing * 0.9, -this.swing * 0.5);
    this.holder.visible = !a.scoped;
  }

  render(renderer, aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = true;
  }
}
