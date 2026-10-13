// Vị trí súng góc nhìn thứ nhất (camera viewmodel FOV 54, đơn vị m). Gốc súng = tay cầm, nòng hướng -Z.
// Canh bằng: node tools/render-scene.mjs out.png --t 3 --agent 7 --vm <id>
export const VIEW_CFG = {
  default: { pos: [0.13, -0.14, -0.4] },
  knife: { pos: [0.14, -0.13, -0.32], rot: [0.25, 0.25, 0] },
  glock: { pos: [0.12, -0.12, -0.36], rot: [0, 0.04, 0] },
  usp: { pos: [0.12, -0.12, -0.36], rot: [0, 0.04, 0] },
  deagle: { pos: [0.12, -0.12, -0.37], rot: [0, 0.04, 0] },
  mp5: { pos: [0.12, -0.14, -0.34], rot: [0, 0.05, 0] },
  ak47: { pos: [0.12, -0.15, -0.36], rot: [0, 0.05, 0] },
  m4a1: { pos: [0.12, -0.155, -0.36], rot: [0, 0.05, 0] },
  awp: { pos: [0.12, -0.15, -0.32], rot: [0, 0.04, 0] },
  he: { pos: [0.12, -0.12, -0.3] },
  c4: { pos: [0.1, -0.17, -0.32], rot: [0.4, 0, 0] },
};
