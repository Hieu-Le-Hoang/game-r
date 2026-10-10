// node tools/inspect-rig.mjs <glb> : in hướng tay/chân/mặt của rig ở rest pose và frame đầu clip A_TPose
import fs from 'node:fs';
import * as THREE from 'three';
const b = fs.readFileSync(process.argv[2]);
const j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
const nodes = j.nodes.map((n) => {
  const o = new THREE.Object3D(); o.name = n.name;
  if (n.translation) o.position.fromArray(n.translation);
  if (n.rotation) o.quaternion.fromArray(n.rotation);
  if (n.scale) o.scale.fromArray(n.scale);
  return o;
});
j.nodes.forEach((n, i) => (n.children || []).forEach((c) => nodes[i].add(nodes[c])));
const roots = nodes.filter((o) => !o.parent);
const scene = new THREE.Group(); roots.forEach((r) => scene.add(r));
scene.updateMatrixWorld(true);
const P = (n) => scene.getObjectByName(n).getWorldPosition(new THREE.Vector3());
const dir = (a, b) => P(b).sub(P(a)).normalize().toArray().map((v) => v.toFixed(2)).join(',');
const names = new Set(j.nodes.map((n) => n.name));
const pick = (...c) => c.find((n) => names.has(n));
const UA = pick('upperarm_l', 'DEF-upper_arm.L'), FA = pick('lowerarm_l', 'DEF-forearm.L');
const FT = pick('foot_l', 'DEF-foot.L'), TO = pick('ball_l', 'DEF-toe.L'), HIP = pick('pelvis', 'DEF-hips'), HD = pick('Head', 'DEF-head');
console.log('rest: arm_l dir', dir(UA, FA), '| foot->toe', dir(FT, TO), '| hips->head', dir(HIP, HD), '| hipY', P(HIP).y.toFixed(3), 'headY', P(HD).y.toFixed(3));
console.log('roots', roots.map((r) => r.name).join(','), 'root rot', JSON.stringify(j.nodes.find((n) => n.name === roots[0].name).rotation));
