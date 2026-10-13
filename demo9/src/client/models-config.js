// Thông số model glTF (đo bằng tools/measure-assets.mjs). Thiếu mục nào thì dùng model dựng bằng khối.
export const MANIFEST = {
  chars: { T: 'chars/t.glb', CT: 'chars/ct.glb' },
  gunsFile: 'guns/guns.glb', // 1 scene, mỗi súng là 1 node gốc tên = id, đầu nòng là node <id>_muzzle
};

// Quaternius Ultimate Animated Character: cao ~1.81m, mặt hướng +Z (game dùng -Z -> xoay 180°).
// Súng gắn vào node GunSocket_R (đã canh theo pose Idle_Gun_Pointing).
const CLIPS = {
  idle: 'Idle_Gun_Pointing', shoot: 'Idle_Gun_Shoot', walk: 'Walk', run: 'Run', runShoot: 'Run_Shoot',
  back: 'Run_Back', left: 'Run_Left', right: 'Run_Right', death: 'Death', hit: 'HitRecieve',
  interact: 'Interact', knifeIdle: 'Idle_Sword', slash: 'Sword_Slash',
};

export const CHAR_CFG = {
  T: { scale: 1, yaw: Math.PI, socket: 'GunSocket_R', clips: CLIPS, deathSink: 0.21 },
  CT: { scale: 1, yaw: Math.PI, socket: 'GunSocket_R', clips: CLIPS, deathSink: 0.05 },
};

// id trong game -> id node trong guns.glb (đã theo quy ước nòng -Z, gốc ở tay cầm)
export const GUN_NODE = { glock: 'glock', usp: 'usp', deagle: 'deagle', mp5: 'mp5', ak47: 'ak47', m4a1: 'm4a1', awp: 'awp', knife: 'knife', he: 'grenade' };

// tên âm thanh trong game -> file trong public/sounds (mảng = chọn ngẫu nhiên)
export const SOUND_FILES = {
  pistol: 'pistol.mp3', deagle: 'deagle.mp3', smg: 'smg.mp3', rifle: 'ak47.mp3', m4: 'm4a1.mp3', awp: 'awp.mp3', awpBolt: 'awp_bolt.mp3',
  reload: 'reload_rifle.mp3', reloadPistol: 'reload_pistol.mp3', deploy: 'deploy.mp3', dry: 'dryfire.mp3',
  step: ['step_1.mp3', 'step_2.mp3', 'step_3.mp3', 'step_4.mp3'], shell: ['shell_1.mp3', 'shell_2.mp3', 'shell_3.mp3'],
  explode: 'explode.mp3', bounce: 'grenade_bounce.mp3', hit: 'hit_body.mp3', headshot: 'hit_helmet.mp3', knifeHit: 'knife_hit.mp3',
  plant: 'c4_plant.mp3', press: 'c4_press.mp3', beep: 'c4_beep.mp3',
};
