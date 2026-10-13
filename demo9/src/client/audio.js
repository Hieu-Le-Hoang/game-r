// Âm thanh: ưu tiên file mẫu (public/sounds), thiếu thì tổng hợp bằng WebAudio. Định vị trái/phải + nhỏ dần theo khoảng cách.
const BASE = import.meta.env.BASE_URL;

export class Audio3D {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    this.volume = +(localStorage.getItem('demo9.vol') ?? 0.7);
    this.voice = localStorage.getItem('demo9.voice') !== '0';
    this.noise = null;
  }

  async init(files) {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    this.master.connect(comp).connect(this.ctx.destination);
    const n = this.ctx.sampleRate * 1.5;
    this.noise = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    await Promise.all(Object.entries(files ?? {}).map(async ([k, list]) => {
      const arr = Array.isArray(list) ? list : [list];
      const bufs = [];
      for (const f of arr) {
        try {
          const r = await fetch(`${BASE}sounds/${f}`);
          if (r.ok) bufs.push(await this.ctx.decodeAudioData(await r.arrayBuffer()));
        } catch { /* thiếu file thì dùng synth */ }
      }
      if (bufs.length) this.buffers[k] = bufs;
    }));
  }

  setVolume(v) { this.volume = v; localStorage.setItem('demo9.vol', String(v)); if (this.master) this.master.gain.value = v; }

  // Nút đầu ra theo vị trí (null = âm 2D tại người nghe)
  out(pos, vol = 1, range = 60) {
    const c = this.ctx;
    const g = c.createGain();
    let gain = vol, pan = 0;
    if (pos) {
      const L = this.listener;
      const dx = pos.x - L.x, dy = pos.y - L.y, dz = pos.z - L.z, d = Math.hypot(dx, dy, dz);
      if (d > range) return null;
      gain *= Math.pow(1 - d / range, 1.6) / (1 + d * 0.03);
      const rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
      pan = d > 0.5 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) * 0.8 : 0;
    }
    g.gain.value = gain;
    const p = c.createStereoPanner();
    p.pan.value = pan;
    g.connect(p).connect(this.master);
    return g;
  }

  sample(name, pos, vol = 1, range = 60, rate = 1) {
    const list = this.buffers[name];
    if (!list || !this.ctx) return false;
    const o = this.out(pos, vol, range);
    if (!o) return true;
    const s = this.ctx.createBufferSource();
    s.buffer = list[(Math.random() * list.length) | 0];
    s.playbackRate.value = rate * (0.96 + Math.random() * 0.08);
    s.connect(o);
    s.start();
    return true;
  }

  // ---------- Synth ----------
  burst(o, { dur = 0.15, f = 2000, q = 0.7, type = 'lowpass', sweep = 0, at = 0, vol = 1 }) {
    const c = this.ctx, t = c.currentTime + at;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = c.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    if (sweep) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f * sweep), t + dur);
    fl.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl).connect(g).connect(o);
    s.start(t, Math.random(), dur + 0.05);
  }
  tone(o, { f = 440, f2 = 0, dur = 0.1, type = 'sine', vol = 0.5, at = 0 }) {
    const c = this.ctx, t = c.currentTime + at;
    const os = c.createOscillator();
    os.type = type;
    os.frequency.setValueAtTime(f, t);
    if (f2) os.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    os.connect(g).connect(o);
    os.start(t);
    os.stop(t + dur + 0.02);
  }

  play(name, pos = null, opts = {}) {
    if (!this.ctx) return;
    const range = opts.range ?? 60;
    if (this.sample(name, pos, opts.vol ?? 1, range, opts.rate ?? 1)) return;
    const o = this.out(pos, opts.vol ?? 1, range);
    if (!o) return;
    const S = SYNTH[name];
    if (S) S(this, o);
  }

  say(text) {
    if (!this.voice || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 1.05;
    u.pitch = 0.8;
    u.volume = Math.min(1, this.volume * 1.2);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
}

const SYNTH = {
  pistol: (a, o) => { a.burst(o, { dur: 0.12, f: 3200, sweep: 0.3, vol: 0.9 }); a.tone(o, { f: 160, f2: 60, dur: 0.08, vol: 0.6 }); },
  deagle: (a, o) => { a.burst(o, { dur: 0.25, f: 2600, sweep: 0.2, vol: 1 }); a.tone(o, { f: 120, f2: 40, dur: 0.15, vol: 0.9 }); },
  smg: (a, o) => { a.burst(o, { dur: 0.09, f: 2800, sweep: 0.4, vol: 0.7 }); a.tone(o, { f: 140, f2: 70, dur: 0.06, vol: 0.4 }); },
  rifle: (a, o) => { a.burst(o, { dur: 0.18, f: 2200, sweep: 0.25, vol: 1 }); a.tone(o, { f: 110, f2: 45, dur: 0.12, vol: 0.8 }); a.burst(o, { dur: 0.4, f: 600, sweep: 0.5, vol: 0.25, at: 0.03 }); },
  m4: (a, o) => { a.burst(o, { dur: 0.15, f: 2600, sweep: 0.3, vol: 0.9 }); a.tone(o, { f: 130, f2: 50, dur: 0.1, vol: 0.7 }); },
  awp: (a, o) => { a.burst(o, { dur: 0.5, f: 1800, sweep: 0.15, vol: 1.2 }); a.tone(o, { f: 90, f2: 30, dur: 0.35, vol: 1.1 }); a.burst(o, { dur: 0.9, f: 400, sweep: 0.5, vol: 0.35, at: 0.05 }); },
  dry: (a, o) => a.tone(o, { f: 1800, dur: 0.03, type: 'square', vol: 0.2 }),
  reload: (a, o) => { a.burst(o, { dur: 0.05, f: 3000, type: 'bandpass', q: 3, vol: 0.5, at: 0.1 }); a.burst(o, { dur: 0.06, f: 2000, type: 'bandpass', q: 3, vol: 0.6, at: 0.7 }); a.burst(o, { dur: 0.05, f: 4000, type: 'bandpass', q: 4, vol: 0.5, at: 1.2 }); },
  deploy: (a, o) => a.burst(o, { dur: 0.06, f: 3500, type: 'bandpass', q: 3, vol: 0.35 }),
  step: (a, o) => a.burst(o, { dur: 0.07, f: 700, type: 'bandpass', q: 1.2, vol: 0.5 }),
  land: (a, o) => a.burst(o, { dur: 0.12, f: 400, type: 'lowpass', vol: 0.7 }),
  knife: (a, o) => a.burst(o, { dur: 0.18, f: 1200, sweep: 3, type: 'bandpass', q: 2, vol: 0.35 }),
  knifeHit: (a, o) => { a.burst(o, { dur: 0.1, f: 900, type: 'lowpass', vol: 0.8 }); a.tone(o, { f: 200, f2: 80, dur: 0.08, vol: 0.4 }); },
  hit: (a, o) => { a.burst(o, { dur: 0.08, f: 800, type: 'lowpass', vol: 0.7 }); },
  headshot: (a, o) => { a.burst(o, { dur: 0.06, f: 2500, type: 'bandpass', q: 2, vol: 0.9 }); a.tone(o, { f: 900, f2: 300, dur: 0.07, type: 'triangle', vol: 0.35 }); },
  ric: (a, o) => { a.burst(o, { dur: 0.05, f: 4500, type: 'bandpass', q: 6, vol: 0.25 }); if (Math.random() < 0.3) a.tone(o, { f: 3000 + Math.random() * 2000, f2: 1500, dur: 0.15, type: 'sine', vol: 0.06 }); },
  explode: (a, o) => { a.burst(o, { dur: 1.4, f: 1500, sweep: 0.05, vol: 1.3 }); a.tone(o, { f: 70, f2: 25, dur: 0.9, vol: 1.2 }); },
  bounce: (a, o) => a.tone(o, { f: 900, f2: 500, dur: 0.05, type: 'triangle', vol: 0.3 }),
  beep: (a, o) => a.tone(o, { f: 2350, dur: 0.12, type: 'sine', vol: 0.45 }),
  plant: (a, o) => { for (let i = 0; i < 7; i++) a.tone(o, { f: 1400 + (i % 3) * 300, dur: 0.06, type: 'square', vol: 0.12, at: i * 0.35 }); },
  defuse: (a, o) => { for (let i = 0; i < 4; i++) a.burst(o, { dur: 0.05, f: 2500, type: 'bandpass', q: 4, vol: 0.4, at: i * 0.4 }); },
  zoom: (a, o) => a.burst(o, { dur: 0.05, f: 5000, type: 'bandpass', q: 5, vol: 0.4 }),
  buy: (a, o) => a.tone(o, { f: 1200, dur: 0.05, type: 'triangle', vol: 0.2 }),
  denied: (a, o) => a.tone(o, { f: 220, dur: 0.15, type: 'square', vol: 0.15 }),
  pickup: (a, o) => { a.burst(o, { dur: 0.05, f: 2500, type: 'bandpass', q: 3, vol: 0.4 }); a.burst(o, { dur: 0.05, f: 1800, type: 'bandpass', q: 3, vol: 0.4, at: 0.12 }); },
  hurt: (a, o) => a.burst(o, { dur: 0.15, f: 500, type: 'lowpass', vol: 0.8 }),
};
