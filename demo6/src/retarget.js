import * as THREE from 'three';

// Retarget animation Quaternius Universal Animation Library (rig T-pose, mặt +Z, mét) -> VRM normalized rig.
// Normalized rig của three-vrm có rest rotation = identity, cha = human bone gần nhất, nên:
//   D(bone)  = world_anim * world_rest^-1   (world-delta của xương nguồn)
//   local    = D(cha)^-1 * D(bone)
// VRM 0.x quay mặt -Z -> xoay D 180° quanh Y (đổi dấu x, z).

const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];
const SEG = { Thumb: ['Metacarpal', 'Proximal', 'Distal'], Index: ['Proximal', 'Intermediate', 'Distal'] };
const seg = (f) => SEG[f] || SEG.Index;

function buildMap(core, limb, finger) {
  const m = { ...core };
  for (const [s, side] of [['l', 'left'], ['r', 'right']]) {
    for (const [vrm, src] of Object.entries(limb)) m[side + vrm] = src(s);
    FINGERS.forEach((f) => seg(f).forEach((sg, i) => { m[`${side}${f}${sg}`] = finger(f, i + 1, s); }));
  }
  return m;
}

// UAL2: tên kiểu Unreal mannequin
const UE = { Thumb: 'thumb', Index: 'index', Middle: 'middle', Ring: 'ring', Little: 'pinky' };
const MAP_UAL2 = buildMap(
  { hips: 'pelvis', spine: 'spine_01', chest: 'spine_02', upperChest: 'spine_03', neck: 'neck_01', head: 'Head' },
  { Shoulder: (s) => `clavicle_${s}`, UpperArm: (s) => `upperarm_${s}`, LowerArm: (s) => `lowerarm_${s}`, Hand: (s) => `hand_${s}`, UpperLeg: (s) => `thigh_${s}`, LowerLeg: (s) => `calf_${s}`, Foot: (s) => `foot_${s}`, Toes: (s) => `ball_${s}` },
  (f, i, s) => `${UE[f]}_0${i}_${s}`,
);
// UAL1: tên kiểu Rigify DEF-*
const RG = { Thumb: 'thumb', Index: 'f_index', Middle: 'f_middle', Ring: 'f_ring', Little: 'f_pinky' };
const MAP_UAL1 = buildMap(
  { hips: 'DEF-hips', spine: 'DEF-spine.001', chest: 'DEF-spine.002', upperChest: 'DEF-spine.003', neck: 'DEF-neck', head: 'DEF-head' },
  { Shoulder: (s) => `DEF-shoulder.${s.toUpperCase()}`, UpperArm: (s) => `DEF-upper_arm.${s.toUpperCase()}`, LowerArm: (s) => `DEF-forearm.${s.toUpperCase()}`, Hand: (s) => `DEF-hand.${s.toUpperCase()}`, UpperLeg: (s) => `DEF-thigh.${s.toUpperCase()}`, LowerLeg: (s) => `DEF-shin.${s.toUpperCase()}`, Foot: (s) => `DEF-foot.${s.toUpperCase()}`, Toes: (s) => `DEF-toe.${s.toUpperCase()}` },
  (f, i, s) => `DEF-${RG[f]}.0${i}.${s.toUpperCase()}`,
);

// Chuẩn bị nguồn: 1 file anim GLB -> { scene, clips, map, rest, hipY }
export function makeSource(gltf) {
  const scene = gltf.scene;
  const map = scene.getObjectByName('pelvis') ? MAP_UAL2 : MAP_UAL1;
  scene.updateMatrixWorld(true);
  const rest = {};
  for (const [bone, name] of Object.entries(map)) {
    // GLTFLoader bỏ ký tự đặc biệt khỏi tên node ("DEF-upper_arm.L" -> "DEF-upper_armL")
    const n = scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
    if (n) rest[bone] = { node: n, q: n.getWorldQuaternion(new THREE.Quaternion()), p: n.getWorldPosition(new THREE.Vector3()) };
  }
  return { scene, clips: gltf.animations, map, rest, hipY: rest.hips.p.y, mixer: new THREE.AnimationMixer(scene) };
}

const FPS = 30;
const _q = new THREE.Quaternion(), _p = new THREE.Vector3();

// Normalized rig chỉ khác nhau ở bộ xương có mặt + quan hệ cha -> các avatar cùng cấu trúc dùng chung
// kết quả lấy mẫu (VRoid gần như cùng 1 rig: 7 avatar -> lấy mẫu 1 lần). Hông lưu delta chưa scale.
const sampled = new Map();

// Retarget 1 clip của src sang vrm. Trả về AnimationClip có track trỏ vào node Normalized_*
export function retargetClip(src, clip, vrm) {
  const h = vrm.humanoid;
  const v0 = vrm.meta?.metaVersion === '0';
  const bones = Object.keys(src.rest).filter((b) => h.getNormalizedBoneNode(b));
  // cha (trong normalized rig) của từng bone, đã quy về bone có animation
  const nodeToBone = new Map(bones.map((b) => [h.getNormalizedBoneNode(b), b]));
  const parentOf = (b) => {
    let p = h.getNormalizedBoneNode(b).parent;
    while (p && !nodeToBone.has(p)) p = p.parent;
    return p ? nodeToBone.get(p) : null;
  };
  const parents = Object.fromEntries(bones.map((b) => [b, parentOf(b)]));
  const sig = `${clip.uuid}|${v0}|${bones.map((b) => `${b}<${parents[b]}`).join()}`;
  let s = sampled.get(sig);
  if (!s) sampled.set(sig, (s = sample(src, clip, bones, parents, v0)));

  const hipsNode = h.getNormalizedBoneNode('hips');
  const hip0 = hipsNode.position;
  const k = hip0.y / src.hipY;
  const pos = new Float32Array(s.hipD.length);
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] = s.hipD[i] * k + hip0.x; pos[i + 1] = s.hipD[i + 1] * k + hip0.y; pos[i + 2] = s.hipD[i + 2] * k + hip0.z;
  }
  const tracks = bones.map((b) => new THREE.QuaternionKeyframeTrack(`${h.getNormalizedBoneNode(b).name}.quaternion`, s.times, s.rot[b]));
  tracks.push(new THREE.VectorKeyframeTrack(`${hipsNode.name}.position`, s.times, pos));
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

function sample(src, clip, bones, parents, v0) {
  const n = Math.max(2, Math.round(clip.duration * FPS) + 1);
  const times = new Float32Array(n);
  const rot = Object.fromEntries(bones.map((b) => [b, new Float32Array(n * 4)]));
  const hipD = new Float32Array(n * 3);
  const D = {};
  for (const b of bones) D[b] = new THREE.Quaternion();
  const restInv = Object.fromEntries(bones.map((b) => [b, src.rest[b].q.clone().invert()]));

  const action = src.mixer.clipAction(clip);
  action.reset().play();
  for (let i = 0; i < n; i++) {
    const t = Math.min(clip.duration, i / FPS);
    times[i] = t;
    src.mixer.setTime(t);
    src.scene.updateMatrixWorld(true);
    for (const b of bones) {
      src.rest[b].node.getWorldQuaternion(_q);
      D[b].copy(_q).multiply(restInv[b]);
      if (v0) { D[b].x = -D[b].x; D[b].z = -D[b].z; }
    }
    for (const b of bones) {
      const p = parents[b];
      _q.copy(D[b]);
      if (p) _q.premultiply(D[p].clone().invert());
      _q.toArray(rot[b], i * 4);
    }
    src.rest.hips.node.getWorldPosition(_p).sub(src.rest.hips.p);
    if (v0) { _p.x = -_p.x; _p.z = -_p.z; }
    _p.toArray(hipD, i * 3);
  }
  action.stop();
  src.mixer.uncacheAction(clip);
  return { times, rot, hipD };
}
