// Hình nhân vật (góc nhìn thứ 3), súng rơi, bom, lựu đạn đang bay.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { MODELS, fallbackGun, fallbackSoldier } from './assets.js';
import { CHAR_CFG } from './models-config.js';

const tmp = new THREE.Vector3();

export function gunMesh(id) {
  const src = MODELS.guns[id];
  if (!src) return fallbackGun(id);
  const g = src.clone(true);
  g.userData.muzzle = src.userData.muzzle.clone();
  return g;
}

const findClip = (clips, name) => clips.find((c) => c.name === name);

class Actor {
  constructor(scene, a) {
    this.a = a;
    this.team = a.team;
    this.root = new THREE.Group();
    scene.add(this.root);
    const src = MODELS.chars[a.team];
    const cfg = CHAR_CFG[a.team];
    if (src && cfg) {
      this.model = SkeletonUtils.clone(src.scene);
      this.model.scale.setScalar(cfg.scale);
      this.model.rotation.y = cfg.yaw ?? 0;
      this.root.add(this.model);
      this.mixer = new THREE.AnimationMixer(this.model);
      const clips = src.animations;
      this.clips = {};
      for (const [k, re] of Object.entries(cfg.clips)) {
        const c = findClip(clips, re);
        if (c) this.clips[k] = this.mixer.clipAction(c);
      }
      if (this.clips.death) { this.clips.death.setLoop(THREE.LoopOnce, 1); this.clips.death.clampWhenFinished = true; }
      this.hand = this.model.getObjectByName(cfg.socket);
      this.chest = this.model.getObjectByName('Chest');
      this.cfg = cfg;
      this.cur = null;
      this.play('idle');
    } else {
      this.model = fallbackSoldier(a.team);
      this.root.add(this.model);
      this.rig = this.model.userData.rig;
      this.hand = this.rig.hand;
    }
    this.gunId = null;
    this.gun = null;
    this.walkPhase = 0;
    this.deadT = 0;
    this.flash = 0;
  }

  play(name, fade = 0.2) {
    const act = this.clips[name] ?? this.clips.idle;
    if (!act || act === this.cur) return;
    act.reset().fadeIn(fade).play();
    this.cur?.fadeOut(fade);
    this.cur = act;
  }

  setGun(id) {
    if (id === this.gunId) return;
    this.gunId = id;
    if (this.gun) this.gun.parent?.remove(this.gun);
    this.gun = id ? gunMesh(id) : null;
    if (!this.gun || !this.hand) return;
    if (!this.mixer) {
      this.gun.rotation.x = -Math.PI / 2;
      this.gun.position.set(0, 0, -0.02);
    }
    this.hand.add(this.gun);
  }

  update(dt, a, pos, now) {
    this.root.visible = true;
    this.root.position.copy(pos);
    this.root.rotation.y = a.yaw;
    const moving = a.speed > 0.5;
    this.setGun(a.alive ? a.weaponId : null);
    if (this.mixer) {
      const m = this.model;
      m.scale.set(1, a.alive && a.ducking ? 0.72 : 1, 1); // không có clip ngồi -> nén chiều cao
      m.position.y = 0;
      const knife = a.weaponId === 'knife';
      if (!a.alive) { this.play('death', 0.1); m.position.y = this.cfg.deathSink; }
      else if (a.plantStart >= 0 || a.defuseStart >= 0) this.play('interact');
      else if (knife && now - a.lastShot < 0.35) this.play('slash', 0.08);
      else if (moving) {
        const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
        const f = (a.vel.x * fx + a.vel.z * fz) / a.speed, sd = (a.vel.x * -fz + a.vel.z * fx) / a.speed;
        if (f < -0.5) this.play('back');
        else if (Math.abs(sd) > 0.7) this.play(sd > 0 ? 'right' : 'left');
        else if (now - a.lastShot < 0.3) this.play('runShoot');
        else this.play(a.speed > 3.2 && !a.ducking ? 'run' : 'walk');
      } else if (knife) this.play('knifeIdle');
      else this.play(now - a.lastShot < 0.3 ? 'shoot' : 'idle');
      if (this.cur) this.cur.timeScale = this.cur === this.clips.walk || this.cur === this.clips.run ? Math.max(0.6, a.speed / (this.cur === this.clips.run ? 5.5 : 2.6)) : 1;
      this.mixer.update(dt);
      // Ngẩng / cúi theo góc nhìn
      if (this.chest && a.alive) this.chest.rotateX(-a.pitch * 0.8);
      return;
    }
    this.animFallback(dt, a, moving, now);
  }

  animFallback(dt, a, moving, now) {
    const r = this.rig;
    if (!a.alive) {
      this.deadT = Math.min(1, this.deadT + dt * 2.5);
      const k = 1 - (1 - this.deadT) ** 2;
      this.model.rotation.x = k * 1.5;
      this.model.position.y = k * 0.25;
      return;
    }
    this.deadT = 0;
    this.model.rotation.x = 0;
    this.model.position.y = 0;
    this.walkPhase += dt * a.speed * 1.6;
    const sw = moving ? Math.sin(this.walkPhase) * Math.min(1, a.speed / 4) * 0.7 : 0;
    const duck = a.ducking ? 1 : 0;
    r.hips.position.y = 0.95 - duck * 0.4;
    r.legL.rotation.x = sw - duck * 1.2;
    r.legR.rotation.x = -sw - duck * 0.5;
    r.shinL.rotation.x = Math.max(0, -sw) * 0.8 + duck * 1.9;
    r.shinR.rotation.x = Math.max(0, sw) * 0.8 + duck * 1.2;
    r.torso.rotation.x = -duck * 0.15;
    // Hai tay cầm súng chĩa theo góc nhìn
    const p = a.pitch;
    const recoil = now - a.lastShot < 0.08 ? 0.15 : 0;
    r.armR.rotation.set(1.35 + p + recoil, 0, 0.1);
    r.foreR.rotation.set(0.15, 0, 0);
    r.armL.rotation.set(1.3 + p + recoil, 0, 0.5);
    r.foreL.rotation.set(0.25, 0, 0.6);
    r.neck.rotation.x = p * 0.6;
  }

  dispose() { this.root.parent?.remove(this.root); }
}

export class Actors {
  constructor(scene) {
    this.scene = scene;
    this.map = new Map();
    this.drops = new Map();
    this.nades = new Map();
    this.bombObj = null;
  }

  update(dt, game, viewer, interp) {
    for (const a of game.agents) {
      let act = this.map.get(a);
      if (!act || act.team !== a.team) { act?.dispose(); act = new Actor(this.scene, a); this.map.set(a, act); }
      if (a === viewer) { act.root.visible = false; continue; }
      act.update(dt, a, interp(a), game.now);
    }
    // Súng rơi
    const seen = new Set();
    for (const d of game.dropped) {
      seen.add(d);
      if (d.kind === 'c4') continue;
      let m = this.drops.get(d);
      if (!m) {
        m = gunMesh(d.gun.id);
        m.position.set(d.pos.x, d.pos.y + 0.05, d.pos.z);
        m.rotation.set(0, d.yaw, Math.PI / 2);
        this.scene.add(m);
        this.drops.set(d, m);
      }
    }
    for (const [d, m] of this.drops) if (!seen.has(d)) { this.scene.remove(m); this.drops.delete(d); }
    // Bom
    const b = game.bomb;
    const showBomb = b.state === 'dropped' || b.state === 'planted';
    if (showBomb) {
      if (!this.bombObj) {
        this.bombObj = gunMesh('c4');
        this.bombLed = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
        this.bombLed.position.set(0.05, 0.05, 0);
        this.bombObj.add(this.bombLed);
        this.scene.add(this.bombObj);
      }
      this.bombObj.visible = true;
      this.bombObj.position.set(b.pos.x, b.pos.y + 0.04, b.pos.z);
      const left = b.explodeAt - game.now;
      const period = Math.max(0.15, Math.min(1, left / 35));
      this.bombLed.visible = b.state === 'planted' && (game.now % period) < period * 0.4;
    } else if (this.bombObj) this.bombObj.visible = false;
    // Lựu đạn
    const ns = new Set();
    for (const n of game.nades) {
      ns.add(n);
      let m = this.nades.get(n);
      if (!m) { m = gunMesh('he'); this.scene.add(m); this.nades.set(n, m); }
      const p = n.body.translation(), q = n.body.rotation();
      m.position.set(p.x, p.y, p.z);
      m.quaternion.set(q.x, q.y, q.z, q.w);
    }
    for (const [n, m] of this.nades) if (!ns.has(n)) { this.scene.remove(m); this.nades.delete(n); }
  }

  // Vị trí đầu nòng súng của actor (để vẽ chớp lửa / vệt đạn từ đúng chỗ)
  muzzleOf(a) {
    const act = this.map.get(a);
    if (!act?.gun || !act.root.visible) return null;
    act.root.updateMatrixWorld(true);
    return act.gun.localToWorld(tmp.copy(act.gun.userData.muzzle ?? new THREE.Vector3())).clone();
  }
}
