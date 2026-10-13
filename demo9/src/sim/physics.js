// Rapier: collider tĩnh cho map, character controller cho người chơi/bot, raycast đạn, lựu đạn nảy.
import RAPIER from '@dimforge/rapier3d-compat';
import { MOVE } from './constants.js';

let ready = null;
export const initPhysics = () => (ready ??= RAPIER.init());

// InteractionGroups = (membership << 16) | filter
const G_WORLD = 0x0001, G_AGENT = 0x0002, G_NADE = 0x0004;
const groups = (member, filter) => (member << 16) | filter;
const ONLY_WORLD = groups(0xffff, G_WORLD);

export class Physics {
  constructor(map) {
    this.world = new RAPIER.World({ x: 0, y: -MOVE.gravity, z: 0 });
    this.world.timestep = 1 / 60;
    const [sx, sz] = map.size;
    this.addBox([-2, -1, -2], [sx + 2, 0, sz + 2]); // sàn
    for (const b of map.boxes) this.addBox(b.min, b.max);
    this.cc = this.world.createCharacterController(0.02);
    this.cc.setUp({ x: 0, y: 1, z: 0 });
    this.cc.enableAutostep(0.4, 0.2, false);
    this.cc.enableSnapToGround(0.25);
    this.cc.setSlideEnabled(true);
    this.cc.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.cc.setApplyImpulsesToDynamicBodies(false);
    this.world.step();
  }

  addBox(min, max) {
    const hx = (max[0] - min[0]) / 2, hy = (max[1] - min[1]) / 2, hz = (max[2] - min[2]) / 2;
    const d = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setTranslation(min[0] + hx, min[1] + hy, min[2] + hz)
      .setCollisionGroups(groups(G_WORLD, 0xffff))
      .setFriction(0.6).setRestitution(0.4);
    this.world.createCollider(d);
  }

  // Capsule không gắn body; vị trí = chân người
  createAgent(pos) {
    const r = MOVE.radius, hh = MOVE.standHeight / 2 - r;
    const d = RAPIER.ColliderDesc.capsule(hh, r)
      .setTranslation(pos.x, pos.y + hh + r, pos.z)
      .setCollisionGroups(groups(G_AGENT, G_WORLD));
    return this.world.createCollider(d);
  }
  removeCollider(c) { this.world.removeCollider(c, false); }

  // Di chuyển agent: trả về chuyển động thực + có chạm đất không
  move(agent, dx, dy, dz) {
    const col = agent.collider;
    this.cc.computeColliderMovement(col, { x: dx, y: dy, z: dz }, undefined, ONLY_WORLD);
    const m = this.cc.computedMovement();
    const p = col.translation();
    col.setTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
    return { x: m.x, y: m.y, z: m.z, grounded: this.cc.computedGrounded() };
  }

  setAgentShape(agent, height) {
    const r = MOVE.radius, hh = height / 2 - r;
    agent.collider.setHalfHeight(hh);
    agent.collider.setTranslation({ x: agent.pos.x, y: agent.pos.y + hh + r, z: agent.pos.z });
  }
  syncAgent(agent) {
    const p = agent.collider.translation();
    const hh = agent.height / 2;
    agent.pos.x = p.x; agent.pos.y = p.y - hh; agent.pos.z = p.z;
  }
  teleport(agent, pos) {
    agent.pos.x = pos.x; agent.pos.y = pos.y; agent.pos.z = pos.z;
    this.setAgentShape(agent, agent.height);
  }

  // Đứng dậy được không (trần/hầm phía trên)
  canStand(agent) {
    const r = MOVE.radius, hh = MOVE.standHeight / 2 - r;
    const shape = new RAPIER.Capsule(hh, r - 0.02);
    const hit = this.world.intersectionWithShape(
      { x: agent.pos.x, y: agent.pos.y + hh + r + 0.03, z: agent.pos.z }, { x: 0, y: 0, z: 0, w: 1 }, shape, undefined, ONLY_WORLD,
    );
    return !hit;
  }

  // Ray tĩnh: trả {dist, normal} hoặc null
  ray(o, d, max) {
    const hit = this.world.castRayAndGetNormal(new RAPIER.Ray(o, d), max, true, undefined, ONLY_WORLD);
    return hit ? { dist: hit.timeOfImpact, normal: hit.normal } : null;
  }
  los(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return true;
    return !this.ray(a, { x: dx / len, y: dy / len, z: dz / len }, len - 0.05);
  }

  createNade(pos, vel) {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setLinvel(vel.x, vel.y, vel.z)
        .setLinearDamping(0.15).setAngularDamping(1.5).setCcdEnabled(true),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(0.07).setDensity(2).setRestitution(0.45).setFriction(0.7).setCollisionGroups(groups(G_NADE, G_WORLD)),
      body,
    );
    return body;
  }
  removeBody(b) { this.world.removeRigidBody(b); }

  step() { this.world.step(); }
}
