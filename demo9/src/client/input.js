// Bàn phím + chuột (pointer lock) -> input của người chơi
const SENS_KEY = 'demo9.sens';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouse = { left: false, right: false };
    this.dx = 0;
    this.dy = 0;
    this.sens = +(localStorage.getItem(SENS_KEY) ?? 2.2);
    this.locked = false;
    this.handlers = {}; // phím đặc biệt: onKey(code) -> true nếu đã xử lý
    this.wheel = 0;
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (this.onKey?.(e.code, e)) { e.preventDefault(); return; }
      this.keys.add(e.code);
      if (['Tab', 'Space', 'ControlLeft', 'KeyB', 'KeyR', 'KeyE'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); this.onKeyUp?.(e.code); });
    addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) this.mouse.right = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    addEventListener('wheel', (e) => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.mouse.left = this.mouse.right = false;
      this.onLockChange?.(this.locked);
    });
  }

  lock() { this.canvas.requestPointerLock?.()?.catch?.(() => {}); }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  setSens(v) { this.sens = v; localStorage.setItem(SENS_KEY, String(v)); }
  down(code) { return this.keys.has(code); }

  // Đổ input vào agent; trả về góc xoay chuột (rad) đã dùng
  apply(a, zoomMul) {
    const k = (c) => this.keys.has(c);
    const inp = a.input;
    inp.fwd = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0);
    inp.side = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0);
    inp.jump = k('Space');
    inp.duck = k('ControlLeft') || k('KeyC');
    inp.walk = k('ShiftLeft');
    inp.reload = k('KeyR');
    inp.use = k('KeyE');
    inp.drop = k('KeyG');
    inp.fire = this.mouse.left;
    inp.fire2 = this.mouse.right;
    const s = this.sens * 0.022 * 0.0174533 * zoomMul; // giống m_yaw 0.022 của CS
    a.yaw -= this.dx * s;
    a.pitch = Math.max(-1.5, Math.min(1.5, a.pitch - this.dy * s));
    this.dx = this.dy = 0;
    if (this.wheel) {
      const order = [1, 2, 3, 4, 5].filter((n) => (n <= 3 ? a.inv[n] : n === 4 ? a.inv[4] > 0 : a.inv[5]));
      const i = order.indexOf(a.slot);
      inp.slot = order[(i + this.wheel + order.length * 4) % order.length];
      this.wheel = 0;
    }
  }
}
