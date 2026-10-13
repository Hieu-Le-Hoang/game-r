// Một trận đang chơi phía client: scene + actor + fx + HUD + viewmodel, chạy sim theo bước cố định và vẽ mỗi frame.
// Tách khỏi main.js để chạy được trong Node (tools/smoke-client.mjs) với renderer giả.
import * as THREE from 'three';
import { DT } from '../sim/game.js';
import { WEAPONS } from '../sim/constants.js';
import { currentSpread } from '../sim/combat.js';
import { buildWorld } from './world.js';
import { Actors } from './actors.js';
import { ViewModel } from './viewmodel.js';
import { Fx } from './fx.js';
import { Hud } from './hud.js';

const GUN_SND = { glock: 'pistol', usp: 'pistol', deagle: 'deagle', mp5: 'smg', ak47: 'rifle', m4a1: 'm4', awp: 'awp' };
const v3 = (p) => new THREE.Vector3(p.x, p.y, p.z);
const D = Math.PI / 180;

export class Session {
  constructor(game, { renderer, camera, audio, specMode }) {
    this.game = game;
    this.renderer = renderer;
    this.camera = camera;
    this.audio = audio;
    this.specMode = specMode;
    this.scene = new THREE.Scene();
    this.world = buildWorld(this.scene, game.map);
    this.actors = new Actors(this.scene);
    this.vm = new ViewModel();
    this.fx = new Fx(this.scene);
    this.vm.setTexture(this.fx.tex.flash);
    this.hud = new Hud(game);
    this.viewer = game.human ?? game.agents[0];
    this.specIdx = 0;
    this.deathAt = 0;
    this.acc = 0;
    this.shake = 0;
    this.nextBeep = 0;
    this.prevPos = new Map();
    this._ip = new THREE.Vector3();
  }

  interp(a) {
    const p = this.prevPos.get(a), k = this.acc / DT;
    if (!p) return this._ip.set(a.pos.x, a.pos.y, a.pos.z);
    return this._ip.set(p.x + (a.pos.x - p.x) * k, p.y + (a.pos.y - p.y) * k, p.z + (a.pos.z - p.z) * k);
  }

  cycleSpec(dir) {
    const g = this.game, me = g.human;
    const pool = g.agents.filter((a) => a.alive && (!me || a.team === me.team || !g.alive(me.team).length));
    if (!pool.length) return;
    this.specIdx = (this.specIdx + dir + pool.length) % pool.length;
    this.viewer = pool[this.specIdx];
  }

  // dt: giây thật; mouseDx: chuột ngang frame này (cho sway súng)
  frame(dt, mouseDx = 0, fps = 0) {
    const g = this.game, me = g.human;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= DT && steps < 6) {
      for (const a of g.agents) {
        const p = this.prevPos.get(a);
        if (p) { p.x = a.pos.x; p.y = a.pos.y; p.z = a.pos.z; } else this.prevPos.set(a, { ...a.pos });
      }
      g.step(DT);
      this.acc -= DT;
      steps++;
      this.handleEvents(g.drain());
    }
    if (steps >= 6) this.acc = 0;

    // Chết -> 2s sau xem đồng đội
    if (me && !me.alive && this.viewer === me && this.deathAt && performance.now() - this.deathAt > 2000) this.cycleSpec(0);
    if (this.viewer && !this.viewer.alive && this.viewer !== me) this.cycleSpec(1);
    const viewer = this.viewer, cam = this.camera;

    const vp = this.interp(viewer);
    const eye = new THREE.Vector3(vp.x, vp.y + (viewer.alive ? viewer.eyeH : 0.3), vp.z);
    this.shake = Math.max(0, this.shake - dt * 1.5);
    if (this.shake > 0) eye.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(this.shake * 0.3));
    cam.position.copy(eye);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(viewer.pitch + viewer.punchP * D, viewer.yaw + viewer.punchY * D, viewer.alive ? 0 : 0.4);
    const fov = viewer.scoped === 1 ? 30 : viewer.scoped === 2 ? 8 : 74;
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    if (this.audio) this.audio.listener = { x: eye.x, y: eye.y, z: eye.z, yaw: viewer.yaw };

    if (g.phase === 'planted' && g.now >= this.nextBeep) {
      const left = g.bomb.explodeAt - g.now;
      this.audio?.play('beep', { x: g.bomb.pos.x, y: g.bomb.pos.y + 0.2, z: g.bomb.pos.z }, { range: 45, vol: 0.8 });
      this.nextBeep = g.now + Math.max(0.12, Math.min(1.4, left / 25));
    }

    this.actors.update(dt, g, viewer, (a) => this.interp(a));
    this.fx.update(dt);
    this.vm.set(viewer.alive ? viewer.weaponId : null);
    this.vm.update(dt, viewer, g.now, mouseDx);
    this.hud.update(viewer, me, currentSpread(viewer, g.now), fps);

    this.renderer.render(this.scene, cam);
    if (viewer.alive) this.vm.render(this.renderer, cam.aspect);
  }

  handleEvents(events) {
    const g = this.game, me = g.human, audio = this.audio, fx = this.fx, cam = this.camera;
    const play = (...a) => audio?.play(...a);
    for (const e of events) {
      const own = e.a && e.a === this.viewer;
      const at = e.a ? (own ? null : { x: e.a.pos.x, y: e.a.pos.y + 1.5, z: e.a.pos.z }) : null;
      switch (e.type) {
        case 'shot': {
          play(GUN_SND[e.weapon] ?? 'pistol', at, { range: e.weapon === 'awp' ? 140 : 100, vol: own ? 0.8 : 1 });
          if (e.weapon === 'awp') setTimeout(() => play('awpBolt', at, { vol: 0.6, range: 30 }), 500);
          else if (own && Math.random() < 0.5) setTimeout(() => play('shell', null, { vol: 0.25 }), 250 + Math.random() * 200);
          let from;
          if (own) {
            this.vm.shoot(e.weapon === 'awp' || e.weapon === 'deagle');
            from = cam.position.clone().add(new THREE.Vector3(0.15, -0.12, 0).applyQuaternion(cam.quaternion));
          } else {
            from = this.actors.muzzleOf(e.a) ?? v3(e.from);
            fx.muzzle(from, e.weapon === 'awp');
          }
          if (!own || Math.random() < 0.35) fx.tracer(from, v3(e.to));
          if (e.flesh) fx.impact(v3(e.to), null, true);
          else if (e.normal) {
            fx.impact(v3(e.to), e.normal, false);
            if (Math.random() < 0.25) play('ric', e.to, { range: 25, vol: 0.5 });
          }
          break;
        }
        case 'hurt':
          play(e.group === 'head' && e.a.helmet ? 'headshot' : 'hit', e.a === this.viewer ? null : { x: e.a.pos.x, y: e.a.pos.y + 1.3, z: e.a.pos.z }, { range: 30, vol: e.a === this.viewer ? 0.9 : 0.6 });
          if (e.a === this.viewer) this.shake = Math.max(this.shake, 0.2);
          break;
        case 'step': play('step', at, { range: 26, vol: own ? 0.25 : 0.7 }); break;
        case 'land': play('step', at, { range: 20, vol: own ? 0.4 : 0.6, rate: 0.8 }); break;
        case 'reload': play(WEAPONS[e.weapon]?.pistol ? 'reloadPistol' : 'reload', at, { range: 15, vol: 0.7 }); break;
        case 'deploy': if (own) play('deploy', null, { vol: 0.4 }); break;
        case 'dry': if (own) play('dry', null, { vol: 0.6 }); break;
        case 'zoom': if (own) play('zoom', null, { vol: 0.5 }); break;
        case 'knife':
          play(e.hit ? 'knifeHit' : e.wall ? 'ric' : 'knife', at, { range: 15 });
          if (own) this.vm.slash();
          break;
        case 'throw': if (e.a === me) audio?.say('Fire in the hole!'); play('knife', at, { range: 15, vol: 0.5 }); break;
        case 'nadeBounce': play('bounce', e.pos, { range: 25, vol: 0.6 }); break;
        case 'nadeExplode':
          fx.explosion(e.pos, false);
          play('explode', e.pos, { range: 110, vol: 1 });
          this.shake = Math.max(this.shake, Math.max(0, 1 - cam.position.distanceTo(v3(e.pos)) / 15) * 0.6);
          break;
        case 'bombExplode':
          fx.explosion(e.pos, true);
          play('explode', e.pos, { range: 300, vol: 1.6, rate: 0.7 });
          this.shake = Math.max(this.shake, Math.max(0.3, 1 - cam.position.distanceTo(v3(e.pos)) / 40) * 1.2);
          break;
        case 'planting': play('press', at, { range: 15 }); break;
        case 'plant': play('plant', { ...e.a.pos }, { range: 30 }); audio?.say('The bomb has been planted.'); this.nextBeep = 0; break;
        case 'defuseStart': play('defuse', at, { range: 15 }); break;
        case 'defused': audio?.say('Bomb has been defused.'); break;
        case 'roundEnd': setTimeout(() => audio?.say(e.winner === 'T' ? 'Terrorists win!' : 'Counter-Terrorists win!'), e.reason === 'defuse' ? 1500 : 300); break;
        case 'go': if (me) audio?.say(me.team === 'CT' ? 'Go, go, go!' : "Let's move out!"); break;
        case 'roundStart': fx.clearHoles(); if (me) this.viewer = me; this.deathAt = 0; break;
        case 'buy': if (e.a === me) play('buy', null, { vol: 0.6 }); break;
        case 'buyFail': if (e.a === me) play('denied', null, { vol: 0.6 }); break;
        case 'pickup': case 'bombPick': if (own) play('pickup', null, { vol: 0.5 }); break;
        case 'kill': if (e.victim === me) this.deathAt = performance.now(); break;
      }
    }
    this.hud.onEvents(events, me);
  }
}
