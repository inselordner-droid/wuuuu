/* =====================================================================
   WUUUU! – Sprich, und die Bruecke steigt
   Grafik: "Platformer Graphics (Deluxe)" von Kenney Vleugels
   (www.kenney.nl), Lizenz CC0 – siehe assets/KENNEY-LIZENZ.txt
   ===================================================================== */
'use strict';

/* ------------------------------ 1. CONFIG --------------------------- */
const CONFIG = {
  voice: {
    sensitivity: 1.0, noiseGate: 0.035,
    smoothingAttack: 0.42, smoothingRelease: 0.18,
    responseCurve: 0.85, maxClamp: 1.0, fftSize: 1024
  },
  bridge: { gain: 5, maxSpeed: 260, maxAccel: 700, wobble: 1.4 },
  physics: {
    gravity: 780, runSpeed: 62, jumpForce: 240, terminalVy: 430,
    stepUp: 8, gapJumpMax: 40, dropMax: 80,
    stumbleBack: 16, stumbleTime: 0.42
  },
  game: {
    W: 480, H: 270,          // Spielkoordinaten (unveraendert)
    scale: 3,                // intern 1440x810 fuer die gezeichneten Grafiken
    tile: 12,                // Kachelgroesse in Spieleinheiten
    fixedStep: 1 / 120, deathY: 300
  },
  art: { playerH: 17 }       // sichtbare Figurenhoehe (Kollisionsbox ist 15)
};

/* ------------------------------ 2. UTILS ---------------------------- */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rectsOverlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------ 3. FIGUREN --------------------------- */
const CHARS = [
  { key: 'p1', name: 'GRÜNI', blurb: 'Der Schnellste', color: '#8bc34a', flag: 'flagGreen' },
  { key: 'p2', name: 'BLAUKOPF', blurb: 'Immer gelassen', color: '#4aa8d8', flag: 'flagBlue' },
  { key: 'p3', name: 'ROSI', blurb: 'Springt am höchsten', color: '#e8628b', flag: 'flagRed' }
];

/* ------------------------------ 4. UMGEBUNGEN ------------------------ */
const THEME_DEFS = {
  wald: {
    name: 'Grüne Hügel',
    sky: ['#7ec8f2', '#cdeefb'], haze: '#dff1f7', band: '#6fbb3a', night: 0,
    set: 'grass', liquid: 'water',
    hills: ['hill_large', 'hill_small'], hillTint: null,
    props: [['bush', 1.0], ['plant', 0.8], ['mushroomRed', 0.7], ['rock', 0.8], ['fence', 0.9]]
  },
  wueste: {
    name: 'Sandwüste',
    sky: ['#61bced', '#ffd9a0'], haze: '#ffd9a0', band: '#e0b060', night: 0,
    set: 'sand', liquid: 'water',
    hills: ['hill_largeAlt', 'hill_smallAlt'], hillTint: null,
    props: [['cactus', 1.1], ['rock', 0.9], ['plant', 0.7]]
  },
  hoehle: {
    name: 'Lavagrotte',
    sky: ['#2a1a3a', '#5a3150'], haze: '#6a3a4a', band: '#3a2a44', night: 0.45,
    set: 'stone', liquid: 'lava',
    hills: ['hill_large', 'hill_small'], hillTint: 'rgba(40,20,50,0.75)',
    props: [['rock', 1.0], ['torch', 1.0], ['mushroomBrown', 0.8]]
  },
  schnee: {
    name: 'Schneeland',
    sky: ['#9ed3ef', '#f2fbff'], haze: '#f2fbff', band: '#cfe8f5', night: 0,
    set: 'snow', liquid: 'water',
    hills: ['hill_large', 'hill_small'], hillTint: 'rgba(230,245,255,0.72)',
    props: [['snowhill', 1.1], ['rock', 0.9], ['plant', 0.7]]
  },
  burg: {
    name: 'Burgmauern',
    sky: ['#4a5a8c', '#c9a0c0'], haze: '#d8b8cf', band: '#6a6072', night: 0.18,
    set: 'castle', liquid: 'lava',
    hills: ['hill_large', 'hill_small'], hillTint: 'rgba(70,60,95,0.6)',
    props: [['torch', 1.0], ['rock', 0.9], ['fence', 0.9]]
  },
  sumpf: {
    name: 'Nachtsumpf',
    sky: ['#1d2a52', '#4a5a86'], haze: '#5a6a96', band: '#2e4034', night: 0.4,
    set: 'dirt', liquid: 'water',
    hills: ['hill_large', 'hill_small'], hillTint: 'rgba(30,45,60,0.7)',
    props: [['bush', 1.0], ['mushroomBrown', 0.8], ['plantPurple', 0.8], ['rock', 0.9]]
  }
};

/* ------------------------------ 5. BILDLADER -------------------------
   Alle Grafiken liegen als PNG im Ordner assets/ und sind dadurch
   einzeln austauschbar.
   -------------------------------------------------------------------- */
const IMG = {};
const MANIFEST = (function () {
  const list = [
    'liquidWater', 'liquidWaterTop_mid', 'liquidLava', 'liquidLavaTop_mid',
    'door_closedTop', 'door_closedMid', 'door_openTop', 'door_openMid',
    'sign', 'signRight', 'tochLit', 'tochLit2',
    'hill_large', 'hill_small', 'hill_largeAlt', 'hill_smallAlt', 'fence',
    'bush', 'cactus', 'plant', 'plantPurple', 'mushroomRed', 'mushroomBrown', 'rock',
    'snowhill', 'spikes', 'star', 'cloud1', 'cloud2', 'cloud3',
    'flagGreen', 'flagGreen2', 'flagBlue', 'flagBlue2', 'flagRed', 'flagRed2',
    'blockerBody', 'blockerMad', 'blockerSad'
  ];
  ['grass', 'sand', 'snow', 'stone', 'dirt', 'castle'].forEach((t) => {
    ['Mid', 'Center', 'Left', 'Right', 'CliffLeft', 'CliffRight', 'Half', 'HalfLeft', 'HalfRight', 'HalfMid']
      .forEach((suf) => list.push(t + suf));
  });
  ['p1', 'p2', 'p3'].forEach((p) => {
    ['stand', 'jump', 'hurt', 'duck', 'front'].forEach((n) => list.push(p + '_' + n));
    for (let i = 1; i <= 11; i++) list.push(p + '_walk' + (i < 10 ? '0' + i : i));
  });
  return list;
})();

function loadImages(onProgress, onDone) {
  if (typeof Image === 'undefined') { onDone(); return; }   // Kopfloser Test
  let done = 0;
  MANIFEST.forEach((name) => {
    const im = new Image();
    im.onload = im.onerror = () => { done++; onProgress(done, MANIFEST.length); if (done === MANIFEST.length) onDone(); };
    im.src = 'assets/' + name + '.png';
    IMG[name] = im;
  });
}

/* Animationssaetze der Figuren aus den geladenen Bildern */
function charFrames(key) {
  const walk = [];
  for (let i = 1; i <= 11; i++) walk.push(IMG[key + '_walk' + (i < 10 ? '0' + i : i)]);
  return {
    idle: [IMG[key + '_stand']],
    run: walk,
    jump: [IMG[key + '_jump']],
    fall: [IMG[key + '_jump']],
    land: [IMG[key + '_duck']],
    stumble: [IMG[key + '_hurt']],
    hurt: [IMG[key + '_hurt']],
    celebrate: [IMG[key + '_front'], IMG[key + '_jump']]
  };
}
const ASSETS = {
  chars: {},
  frames(key) {
    if (!this.chars[key]) this.chars[key] = charFrames(key);
    return this.chars[key];
  },
  liquid(kind) {
    return kind === 'lava'
      ? { top: IMG.liquidLavaTop_mid, body: IMG.liquidLava }
      : { top: IMG.liquidWaterTop_mid, body: IMG.liquidWater };
  },
  prop(name, t) {
    if (name === 'torch') return ((t * 6) | 0) % 2 ? IMG.tochLit2 : IMG.tochLit;
    return IMG[name];
  },
  flag(charKey, t) {
    const c = CHARS.find((x) => x.key === charKey) || CHARS[0];
    return ((t * 4) | 0) % 2 ? IMG[c.flag + '2'] : IMG[c.flag];
  }
};
/* ------------------- 4. VOICE CONTROLLER ----------------------------
   Kapselt alles Mikrofonwissen. Der Rest des Spiels sieht nur
   getNormalizedVolume() / isSpeaking().
   -------------------------------------------------------------------- */
class VoiceController {
  constructor() {
    this.ctx = null; this.analyser = null; this.stream = null; this.src = null;
    this.buf = null;
    this.raw = 0; this.smoothed = 0; this.normalized = 0;
    this.noiseFloor = 0.012; this.maximumReference = 0.22;
    this.active = false; this.error = null;
    this.peak = 0;
  }
  get supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext));
  }
  async start() {
    if (this.active) return true;
    if (!this.supported) { this.error = 'unsupported'; return false; }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
    } catch (e) { this.error = e && e.name ? e.name : 'denied'; return false; }
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = Snd.ctx || new AC();
    Snd.attach(this.ctx);
    if (this.ctx.state === 'suspended') { try { await this.ctx.resume(); } catch (e) { /* ignore */ } }
    this.src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = CONFIG.voice.fftSize;
    this.analyser.smoothingTimeConstant = 0.1;
    this.src.connect(this.analyser);
    this.buf = new Uint8Array(this.analyser.fftSize);
    this.active = true; this.error = null;
    return true;
  }
  stop() {
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null; this.active = false;
  }
  getRawVolume() { return this.raw; }
  getNormalizedVolume() { return this.normalized; }
  isSpeaking() { return this.normalized > 0.08; }
  setSensitivity(v) { CONFIG.voice.sensitivity = clamp(v, 0.3, 3); }
  setNoiseGate(v) { CONFIG.voice.noiseGate = clamp(v, 0, 0.3); }

  update(dt) {
    if (!this.active || !this.analyser) { this.raw = 0; this.smoothed = 0; this.normalized = 0; return; }
    this.analyser.getByteTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) {
      const v = (this.buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.buf.length);
    this.raw = rms;
    this.peak = Math.max(this.peak * 0.995, rms);
    // Attack/Release-Glättung, framerate-unabhängig
    const rising = rms > this.smoothed;
    const base = rising ? CONFIG.voice.smoothingAttack : CONFIG.voice.smoothingRelease;
    const k = 1 - Math.pow(1 - base, clamp(dt * 60, 0, 4));
    this.smoothed = this.smoothed + (rms - this.smoothed) * k;
    // Noise Gate
    const gated = this.smoothed < this.noiseFloor + CONFIG.voice.noiseGate * 0.5 ? 0 : this.smoothed;
    // Normalisierung auf Kalibrierbereich
    const span = Math.max(0.02, this.maximumReference - this.noiseFloor);
    let n = clamp((gated - this.noiseFloor) / span, 0, 1);
    n = Math.pow(n, CONFIG.voice.responseCurve) * CONFIG.voice.sensitivity;
    this.normalized = clamp(n, 0, CONFIG.voice.maxClamp); // Clamp: Schreien bringt nichts
  }
  band() {
    const n = this.normalized;
    if (n < 0.10) return 0; if (n < 0.30) return 1; if (n < 0.65) return 2; return 3;
  }
}

/* ------------------- 5. INPUT MANAGER -------------------------------
   Mikro + Touch + Tastatur laufen parallel; der stärkste Wert gewinnt.
   -------------------------------------------------------------------- */
class InputManager {
  constructor(canvas) {
    this.keys = {};
    this.touchHeld = false;
    this.keyLevel = 0.55;      // Stärke der Ersatzsteuerung
    this.pointer = { x: 0, y: 0, down: false, clicked: false, downFrame: false, upFrame: false };
    this.canvas = canvas;
    this.typed = [];
    addEventListener('keydown', (e) => {
      if (e.key && e.key.length === 1) this.typed.push(e.key);
      if (e.key === 'Backspace') this.typed.push('\b');
      if (e.key === 'Enter') this.typed.push('\n');
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','F1','F2'].includes(e.code)) e.preventDefault();
      if (!this.keys[e.code]) this.keys[e.code + '_pressed'] = true;
      this.keys[e.code] = true;
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    const pos = (ev) => {
      const r = canvas.getBoundingClientRect();
      const t = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
      this.pointer.x = ((t.clientX - r.left) / r.width) * CONFIG.game.W;
      this.pointer.y = ((t.clientY - r.top) / r.height) * CONFIG.game.H;
    };
    const down = (ev) => { pos(ev); this.pointer.down = true; this.pointer.downFrame = true; this.touchHeld = true; ev.preventDefault(); };
    const up = (ev) => { this.pointer.down = false; this.pointer.upFrame = true; this.pointer.clicked = true; this.touchHeld = false; if (ev.cancelable) ev.preventDefault(); };
    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('mousemove', pos);
    addEventListener('mouseup', up);
    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchmove', (e) => { pos(e); e.preventDefault(); }, { passive: false });
    addEventListener('touchend', up, { passive: false });
    addEventListener('touchcancel', up, { passive: false });
  }
  pressed(code) { const v = !!this.keys[code + '_pressed']; return v; }
  endFrame() {
    for (const k in this.keys) if (k.endsWith('_pressed')) this.keys[k] = false;
    this.pointer.clicked = false; this.pointer.downFrame = false; this.pointer.upFrame = false;
    this.typed.length = 0;
  }
  fallbackLevel() {
    let v = 0;
    if (this.keys['Space']) v = this.keyLevel;
    if (this.keys['ArrowUp']) v = 1;
    if (this.keys['ArrowDown']) v = 0.18;
    if (this.touchHeld) v = Math.max(v, this.keyLevel);
    return v;
  }
}

/* ------------------- 6. AUDIO MANAGER -------------------------------
   Chiptune-Effekte und Musik werden synthetisiert (keine Fremddateien).
   Jede Stimme ist einzeln austauschbar: Snd.sfx.<name>()
   -------------------------------------------------------------------- */
const Snd = {
  ctx: null, master: null, musicGain: null, sfxGain: null,
  settings: { music: true, sfx: true, speech: true, volume: 0.8 },
  musicTimer: 0, musicStep: 0, musicOn: false,
  attach(ctx) {
    if (this.ctx) return;
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = this.settings.volume;
    this.master.connect(ctx.destination);
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0.16; this.musicGain.connect(this.master);
    this.sfxGain = ctx.createGain(); this.sfxGain.gain.value = 0.5; this.sfxGain.connect(this.master);
  },
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.attach(new AC());
  },
  tone(freq, dur, type, gain, dest, slideTo) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'square';
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain || 0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  },
  play(name) {
    if (!this.settings.sfx || !this.ctx) return;
    switch (name) {
      case 'ui_click': this.tone(680, 0.07, 'square', 0.24); break;
      case 'voice_start': this.tone(220, 0.18, 'triangle', 0.16, null, 520); break;
      case 'bridge_rise': this.tone(170, 0.24, 'sawtooth', 0.08, null, 320); break;
      case 'jump': this.tone(430, 0.15, 'square', 0.22, null, 790); break;
      case 'land': this.tone(180, 0.09, 'triangle', 0.2, null, 110); break;
      case 'stumble': this.tone(240, 0.14, 'square', 0.16, null, 150); break;
      case 'collect': this.tone(880, 0.09, 'square', 0.2); setTimeout(() => this.tone(1320, 0.12, 'square', 0.18), 70); break;
      case 'splash': this.tone(420, 0.22, 'sine', 0.18, null, 110); break;
      case 'hit': this.tone(240, 0.26, 'sawtooth', 0.2, null, 80); break;
      case 'goal': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, 'square', 0.22), i * 90)); break;
      case 'level_complete': [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.26), i * 110)); break;
      default: break;
    }
  },
  // sanfte Chiptune-Schleife, bewusst unaufdringlich
  MELODY: [0, 4, 7, 12, 7, 4, 9, 7, 5, 9, 12, 9, 7, 4, 2, 0],
  BASS: [0, 0, 5, 5, 7, 7, 5, 5],
  updateMusic(dt) {
    if (!this.ctx || !this.settings.music) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.33;
    const root = 261.63;
    const n = this.MELODY[this.musicStep % this.MELODY.length];
    if (this.musicStep % 2 === 0 || Math.random() > 0.4) {
      this.tone(root * Math.pow(2, n / 12), 0.28, 'square', 0.12, this.musicGain);
    }
    const b = this.BASS[(this.musicStep >> 1) % this.BASS.length];
    if (this.musicStep % 2 === 0) this.tone(root / 2 * Math.pow(2, b / 12), 0.3, 'triangle', 0.16, this.musicGain);
    this.musicStep++;
  },
  // Sprachfeedback: Web Speech API als Prototyp, Dateien austauschbar
  voiceFiles: {},
  speak(key, text) {
    if (!this.settings.speech) return;
    const file = this.voiceFiles[key];
    if (file) { try { const a = new window.Audio(file); a.volume = this.settings.volume; a.play(); return; } catch (e) { /* fallthrough */ } }
    if (!('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE'; u.rate = 0.95; u.pitch = 1.3; u.volume = this.settings.volume;
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }
};

/* ------------------- 7. SAVE MANAGER -------------------------------- */
const Save = {
  KEY: 'wuuu_kenney_v1',
  data: { unlocked: 1, stars: {}, bestTime: {}, settings: null, calib: null, mode: 'A', seen: false, char: 'p1', ranking: [] },
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) this.data = Object.assign(this.data, JSON.parse(raw));
    } catch (e) { /* localStorage kann blockiert sein */ }
    return this.data;
  },
  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
  },
  setStars(level, stars) {
    const cur = this.data.stars[level] || 0;
    if (stars > cur) this.data.stars[level] = stars;
    if (level + 1 > this.data.unlocked) this.data.unlocked = level + 1;
    this.save();
  },
  setTime(level, t) {
    const cur = this.data.bestTime[level];
    if (!cur || t < cur) this.data.bestTime[level] = t;
    this.save();
  },
  totalStars() {
    return Object.values(this.data.stars).reduce((a, b) => a + b, 0);
  }
};
const LEVELS = [
  {"id": 1, "name": "Mach dein Wuuu", "theme": "wald", "width": 672, "spawn": {"x": 26, "y": 180}, "goal": {"x": 602, "y": 170}, "ground": [{"x": 0, "y": 210, "w": 176, "h": 90}, {"x": 342, "y": 210, "w": 330, "h": 90}], "bridges": [{"x": 194, "w": 130, "crossY": 210, "n": 0.214, "low": 254, "high": 48}], "water": [{"x": 176, "y": 254, "w": 166, "h": 46}], "spikes": [], "stars": [{"x": 253, "y": 168}], "checkpoints": [130]},
  {"id": 2, "name": "Sterne im Wind", "theme": "wald", "width": 704, "spawn": {"x": 26, "y": 180}, "goal": {"x": 634, "y": 170}, "ground": [{"x": 0, "y": 210, "w": 168, "h": 90}, {"x": 344, "y": 210, "w": 360, "h": 90}], "bridges": [{"x": 186, "w": 140, "crossY": 210, "n": 0.214, "low": 254, "high": 48}], "water": [{"x": 168, "y": 254, "w": 176, "h": 46}], "spikes": [], "stars": [{"x": 250, "y": 168}, {"x": 230, "y": 170}, {"x": 300, "y": 176}], "checkpoints": [122]},
  {"id": 3, "name": "Höhere Kante", "theme": "wald", "width": 924, "spawn": {"x": 26, "y": 180}, "goal": {"x": 854, "y": 150}, "ground": [{"x": 0, "y": 210, "w": 160, "h": 90}, {"x": 328, "y": 190, "w": 150, "h": 110}, {"x": 624, "y": 190, "w": 300, "h": 110}], "bridges": [{"x": 178, "w": 132, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 496, "w": 110, "crossY": 190, "n": 0.311, "low": 254, "high": 48}], "water": [{"x": 160, "y": 254, "w": 168, "h": 46}, {"x": 478, "y": 254, "w": 146, "h": 46}], "spikes": [], "stars": [{"x": 238, "y": 168}, {"x": 545, "y": 148}], "checkpoints": [114, 432]},
  {"id": 4, "name": "Waldpfad", "theme": "wald", "width": 1156, "spawn": {"x": 26, "y": 180}, "goal": {"x": 1086, "y": 150}, "ground": [{"x": 0, "y": 210, "w": 150, "h": 90}, {"x": 314, "y": 210, "w": 140, "h": 90}, {"x": 610, "y": 190, "w": 140, "h": 110}, {"x": 896, "y": 190, "w": 260, "h": 110}], "bridges": [{"x": 168, "w": 128, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 472, "w": 120, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 768, "w": 110, "crossY": 190, "n": 0.311, "low": 254, "high": 48}], "water": [{"x": 150, "y": 254, "w": 164, "h": 46}, {"x": 454, "y": 254, "w": 156, "h": 46}, {"x": 750, "y": 254, "w": 146, "h": 46}], "spikes": [{"x": 454, "y": 0, "w": 156, "h": 44}], "stars": [{"x": 226, "y": 168}, {"x": 526, "y": 168}, {"x": 817, "y": 148}], "checkpoints": [104, 408, 704]},
  {"id": 5, "name": "Heißer Sand", "theme": "wueste", "width": 948, "spawn": {"x": 26, "y": 180}, "goal": {"x": 878, "y": 170}, "ground": [{"x": 0, "y": 210, "w": 160, "h": 90}, {"x": 336, "y": 210, "w": 150, "h": 90}, {"x": 648, "y": 210, "w": 300, "h": 90}], "bridges": [{"x": 178, "w": 140, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 504, "w": 126, "crossY": 210, "n": 0.214, "low": 254, "high": 48}], "water": [{"x": 160, "y": 254, "w": 176, "h": 46}, {"x": 486, "y": 254, "w": 162, "h": 46}], "spikes": [{"x": 486, "y": 0, "w": 162, "h": 44}], "stars": [{"x": 242, "y": 168}, {"x": 561, "y": 168}], "checkpoints": [114, 440]},
  {"id": 6, "name": "Schluchtsprung", "theme": "wueste", "width": 1120, "spawn": {"x": 26, "y": 180}, "goal": {"x": 1050, "y": 130}, "ground": [{"x": 0, "y": 210, "w": 150, "h": 90}, {"x": 312, "y": 190, "w": 130, "h": 110}, {"x": 590, "y": 190, "w": 130, "h": 110}, {"x": 860, "y": 170, "w": 260, "h": 130}], "bridges": [{"x": 168, "w": 126, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 460, "w": 112, "crossY": 190, "n": 0.311, "low": 254, "high": 48}, {"x": 738, "w": 104, "crossY": 190, "n": 0.311, "low": 254, "high": 48}], "water": [{"x": 150, "y": 254, "w": 162, "h": 46}, {"x": 442, "y": 254, "w": 148, "h": 46}, {"x": 720, "y": 254, "w": 140, "h": 46}], "spikes": [{"x": 150, "y": 0, "w": 162, "h": 44}, {"x": 720, "y": 0, "w": 140, "h": 44}], "stars": [{"x": 225, "y": 168}, {"x": 510, "y": 148}, {"x": 784, "y": 148}], "checkpoints": [104, 396, 674]},
  {"id": 7, "name": "Trockenes Bett", "theme": "wueste", "width": 1226, "spawn": {"x": 26, "y": 180}, "goal": {"x": 1156, "y": 150}, "ground": [{"x": 0, "y": 210, "w": 150, "h": 90}, {"x": 416, "y": 210, "w": 140, "h": 90}, {"x": 702, "y": 190, "w": 130, "h": 110}, {"x": 976, "y": 190, "w": 250, "h": 110}], "bridges": [{"x": 168, "w": 230, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 574, "w": 110, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 850, "w": 108, "crossY": 190, "n": 0.311, "low": 254, "high": 48}], "water": [{"x": 150, "y": 254, "w": 266, "h": 46}, {"x": 556, "y": 254, "w": 146, "h": 46}, {"x": 832, "y": 254, "w": 144, "h": 46}], "spikes": [{"x": 150, "y": 0, "w": 266, "h": 44}], "stars": [{"x": 277, "y": 168}, {"x": 623, "y": 168}, {"x": 898, "y": 148}, {"x": 300, "y": 150}], "checkpoints": [104, 510, 786]},
  {"id": 8, "name": "Sonnenterrasse", "theme": "wueste", "width": 1292, "spawn": {"x": 26, "y": 180}, "goal": {"x": 1222, "y": 110}, "ground": [{"x": 0, "y": 210, "w": 150, "h": 90}, {"x": 306, "y": 190, "w": 120, "h": 110}, {"x": 562, "y": 170, "w": 120, "h": 130}, {"x": 814, "y": 170, "w": 120, "h": 130}, {"x": 1062, "y": 150, "w": 230, "h": 150}], "bridges": [{"x": 168, "w": 120, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 444, "w": 100, "crossY": 190, "n": 0.311, "low": 254, "high": 48}, {"x": 700, "w": 96, "crossY": 170, "n": 0.408, "low": 254, "high": 48}, {"x": 952, "w": 92, "crossY": 170, "n": 0.408, "low": 254, "high": 48}], "water": [{"x": 150, "y": 254, "w": 156, "h": 46}, {"x": 426, "y": 254, "w": 136, "h": 46}, {"x": 682, "y": 254, "w": 132, "h": 46}, {"x": 934, "y": 254, "w": 128, "h": 46}], "spikes": [{"x": 426, "y": 0, "w": 136, "h": 44}, {"x": 934, "y": 0, "w": 128, "h": 44}], "stars": [{"x": 222, "y": 168}, {"x": 488, "y": 148}, {"x": 742, "y": 128}, {"x": 992, "y": 128}], "checkpoints": [104, 380, 636, 888]},
  {"id": 9, "name": "Ins Dunkle", "theme": "hoehle", "width": 934, "spawn": {"x": 26, "y": 180}, "goal": {"x": 864, "y": 150}, "ground": [{"x": 0, "y": 210, "w": 160, "h": 90}, {"x": 330, "y": 210, "w": 150, "h": 90}, {"x": 634, "y": 190, "w": 300, "h": 110}], "bridges": [{"x": 178, "w": 134, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 498, "w": 118, "crossY": 210, "n": 0.214, "low": 254, "high": 48}], "water": [{"x": 160, "y": 254, "w": 170, "h": 46}, {"x": 480, "y": 254, "w": 154, "h": 46}], "spikes": [{"x": 160, "y": 0, "w": 170, "h": 44}], "stars": [{"x": 239, "y": 168}, {"x": 551, "y": 168}], "checkpoints": [114, 434]},
  {"id": 10, "name": "Lavagraben", "theme": "hoehle", "width": 1120, "spawn": {"x": 26, "y": 180}, "goal": {"x": 1050, "y": 150}, "ground": [{"x": 0, "y": 210, "w": 150, "h": 90}, {"x": 314, "y": 190, "w": 130, "h": 110}, {"x": 588, "y": 210, "w": 130, "h": 90}, {"x": 870, "y": 190, "w": 250, "h": 110}], "bridges": [{"x": 168, "w": 128, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 462, "w": 108, "crossY": 190, "n": 0.311, "low": 254, "high": 48}, {"x": 736, "w": 116, "crossY": 210, "n": 0.214, "low": 254, "high": 48}], "water": [{"x": 150, "y": 254, "w": 164, "h": 46}, {"x": 444, "y": 254, "w": 144, "h": 46}, {"x": 718, "y": 254, "w": 152, "h": 46}], "spikes": [{"x": 150, "y": 0, "w": 164, "h": 44}, {"x": 444, "y": 0, "w": 144, "h": 44}], "stars": [{"x": 226, "y": 168}, {"x": 510, "y": 148}, {"x": 788, "y": 168}], "checkpoints": [104, 398, 672]},
  {"id": 11, "name": "Kristallsprung", "theme": "hoehle", "width": 1056, "spawn": {"x": 26, "y": 180}, "goal": {"x": 986, "y": 130}, "ground": [{"x": 0, "y": 210, "w": 150, "h": 90}, {"x": 304, "y": 190, "w": 120, "h": 110}, {"x": 562, "y": 170, "w": 120, "h": 130}, {"x": 816, "y": 170, "w": 240, "h": 130}], "bridges": [{"x": 168, "w": 118, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 442, "w": 102, "crossY": 190, "n": 0.311, "low": 254, "high": 48}, {"x": 700, "w": 98, "crossY": 170, "n": 0.408, "low": 254, "high": 48}], "water": [{"x": 150, "y": 254, "w": 154, "h": 46}, {"x": 424, "y": 254, "w": 138, "h": 46}, {"x": 682, "y": 254, "w": 134, "h": 46}], "spikes": [{"x": 424, "y": 0, "w": 138, "h": 44}, {"x": 682, "y": 0, "w": 134, "h": 44}], "stars": [{"x": 221, "y": 168}, {"x": 487, "y": 148}, {"x": 743, "y": 128}], "checkpoints": [104, 378, 636]},
  {"id": 12, "name": "Tiefe Halle", "theme": "hoehle", "width": 1390, "spawn": {"x": 26, "y": 180}, "goal": {"x": 1320, "y": 130}, "ground": [{"x": 0, "y": 210, "w": 150, "h": 90}, {"x": 326, "y": 190, "w": 130, "h": 110}, {"x": 602, "y": 170, "w": 130, "h": 130}, {"x": 880, "y": 190, "w": 130, "h": 110}, {"x": 1150, "y": 170, "w": 240, "h": 130}], "bridges": [{"x": 168, "w": 140, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 474, "w": 110, "crossY": 190, "n": 0.311, "low": 254, "high": 48}, {"x": 750, "w": 112, "crossY": 170, "n": 0.408, "low": 254, "high": 48}, {"x": 1028, "w": 104, "crossY": 190, "n": 0.311, "low": 254, "high": 48}], "water": [{"x": 150, "y": 254, "w": 176, "h": 46}, {"x": 456, "y": 254, "w": 146, "h": 46}, {"x": 732, "y": 254, "w": 148, "h": 46}, {"x": 1010, "y": 254, "w": 140, "h": 46}], "spikes": [{"x": 150, "y": 0, "w": 176, "h": 44}, {"x": 732, "y": 0, "w": 148, "h": 44}], "stars": [{"x": 232, "y": 168}, {"x": 523, "y": 148}, {"x": 800, "y": 128}, {"x": 1074, "y": 148}], "checkpoints": [104, 410, 686, 964]},
  {"id": 13, "name": "Erster Schnee", "theme": "schnee", "width": 930, "spawn": {"x": 26, "y": 180}, "goal": {"x": 860, "y": 150}, "ground": [{"x": 0, "y": 210, "w": 160, "h": 90}, {"x": 328, "y": 190, "w": 150, "h": 110}, {"x": 630, "y": 190, "w": 300, "h": 110}], "bridges": [{"x": 178, "w": 132, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 496, "w": 116, "crossY": 190, "n": 0.311, "low": 254, "high": 48}], "water": [{"x": 160, "y": 254, "w": 168, "h": 46}, {"x": 478, "y": 254, "w": 152, "h": 46}], "spikes": [], "stars": [{"x": 238, "y": 168}, {"x": 548, "y": 148}], "checkpoints": [114, 432]},
  {"id": 14, "name": "Eisspalte", "theme": "schnee", "width": 1124, "spawn": {"x": 26, "y": 180}, "goal": {"x": 1054, "y": 150}, "ground": [{"x": 0, "y": 210, "w": 150, "h": 90}, {"x": 312, "y": 210, "w": 130, "h": 90}, {"x": 598, "y": 190, "w": 130, "h": 110}, {"x": 874, "y": 190, "w": 250, "h": 110}], "bridges": [{"x": 168, "w": 126, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 460, "w": 120, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 746, "w": 110, "crossY": 190, "n": 0.311, "low": 254, "high": 48}], "water": [{"x": 150, "y": 254, "w": 162, "h": 46}, {"x": 442, "y": 254, "w": 156, "h": 46}, {"x": 728, "y": 254, "w": 146, "h": 46}], "spikes": [{"x": 442, "y": 0, "w": 156, "h": 44}], "stars": [{"x": 225, "y": 168}, {"x": 514, "y": 168}, {"x": 795, "y": 148}], "checkpoints": [104, 396, 682]},
  {"id": 15, "name": "Glatte Kante", "theme": "schnee", "width": 1290, "spawn": {"x": 26, "y": 180}, "goal": {"x": 1220, "y": 110}, "ground": [{"x": 0, "y": 210, "w": 150, "h": 90}, {"x": 302, "y": 190, "w": 120, "h": 110}, {"x": 560, "y": 170, "w": 120, "h": 130}, {"x": 812, "y": 150, "w": 120, "h": 150}, {"x": 1060, "y": 150, "w": 230, "h": 150}], "bridges": [{"x": 168, "w": 116, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 440, "w": 102, "crossY": 190, "n": 0.311, "low": 254, "high": 48}, {"x": 698, "w": 96, "crossY": 170, "n": 0.408, "low": 254, "high": 48}, {"x": 950, "w": 92, "crossY": 150, "n": 0.505, "low": 254, "high": 48}], "water": [{"x": 150, "y": 254, "w": 152, "h": 46}, {"x": 422, "y": 254, "w": 138, "h": 46}, {"x": 680, "y": 254, "w": 132, "h": 46}, {"x": 932, "y": 254, "w": 128, "h": 46}], "spikes": [{"x": 680, "y": 0, "w": 132, "h": 44}, {"x": 932, "y": 0, "w": 128, "h": 44}], "stars": [{"x": 220, "y": 168}, {"x": 485, "y": 148}, {"x": 740, "y": 128}, {"x": 990, "y": 108}], "checkpoints": [104, 376, 634, 886]},
  {"id": 16, "name": "Gipfelsturm", "theme": "schnee", "width": 1376, "spawn": {"x": 26, "y": 180}, "goal": {"x": 1306, "y": 90}, "ground": [{"x": 0, "y": 210, "w": 150, "h": 90}, {"x": 320, "y": 190, "w": 130, "h": 110}, {"x": 598, "y": 170, "w": 130, "h": 130}, {"x": 870, "y": 150, "w": 130, "h": 150}, {"x": 1136, "y": 130, "w": 240, "h": 170}], "bridges": [{"x": 168, "w": 134, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 468, "w": 112, "crossY": 190, "n": 0.311, "low": 254, "high": 48}, {"x": 746, "w": 106, "crossY": 170, "n": 0.408, "low": 254, "high": 48}, {"x": 1018, "w": 100, "crossY": 150, "n": 0.505, "low": 254, "high": 48}], "water": [{"x": 150, "y": 254, "w": 170, "h": 46}, {"x": 450, "y": 254, "w": 148, "h": 46}, {"x": 728, "y": 254, "w": 142, "h": 46}, {"x": 1000, "y": 254, "w": 136, "h": 46}], "spikes": [{"x": 450, "y": 0, "w": 148, "h": 44}, {"x": 1000, "y": 0, "w": 136, "h": 44}], "stars": [{"x": 229, "y": 168}, {"x": 518, "y": 148}, {"x": 793, "y": 128}, {"x": 1062, "y": 108}], "checkpoints": [104, 404, 682, 954]},
  {"id": 17, "name": "Irrlichter", "theme": "sumpf", "width": 938, "spawn": {"x": 26, "y": 180}, "goal": {"x": 868, "y": 150}, "ground": [{"x": 0, "y": 210, "w": 160, "h": 90}, {"x": 332, "y": 210, "w": 150, "h": 90}, {"x": 638, "y": 190, "w": 300, "h": 110}], "bridges": [{"x": 178, "w": 136, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 500, "w": 120, "crossY": 210, "n": 0.214, "low": 254, "high": 48}], "water": [{"x": 160, "y": 254, "w": 172, "h": 46}, {"x": 482, "y": 254, "w": 156, "h": 46}], "spikes": [{"x": 482, "y": 0, "w": 156, "h": 44}], "stars": [{"x": 240, "y": 168}, {"x": 554, "y": 168}], "checkpoints": [114, 436]},
  {"id": 18, "name": "Schilfgraben", "theme": "sumpf", "width": 1380, "spawn": {"x": 26, "y": 180}, "goal": {"x": 1310, "y": 130}, "ground": [{"x": 0, "y": 210, "w": 150, "h": 90}, {"x": 314, "y": 190, "w": 130, "h": 110}, {"x": 588, "y": 210, "w": 130, "h": 90}, {"x": 872, "y": 190, "w": 130, "h": 110}, {"x": 1140, "y": 170, "w": 240, "h": 130}], "bridges": [{"x": 168, "w": 128, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 462, "w": 108, "crossY": 190, "n": 0.311, "low": 254, "high": 48}, {"x": 736, "w": 118, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 1020, "w": 102, "crossY": 190, "n": 0.311, "low": 254, "high": 48}], "water": [{"x": 150, "y": 254, "w": 164, "h": 46}, {"x": 444, "y": 254, "w": 144, "h": 46}, {"x": 718, "y": 254, "w": 154, "h": 46}, {"x": 1002, "y": 254, "w": 138, "h": 46}], "spikes": [{"x": 444, "y": 0, "w": 144, "h": 44}, {"x": 1002, "y": 0, "w": 138, "h": 44}], "stars": [{"x": 226, "y": 168}, {"x": 510, "y": 148}, {"x": 789, "y": 168}, {"x": 1065, "y": 148}], "checkpoints": [104, 398, 672, 956]},
  {"id": 19, "name": "Lange Fahrt", "theme": "sumpf", "width": 1132, "spawn": {"x": 26, "y": 180}, "goal": {"x": 1062, "y": 150}, "ground": [{"x": 0, "y": 210, "w": 150, "h": 90}, {"x": 426, "y": 190, "w": 140, "h": 110}, {"x": 832, "y": 190, "w": 300, "h": 110}], "bridges": [{"x": 168, "w": 240, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 584, "w": 230, "crossY": 190, "n": 0.311, "low": 254, "high": 48}], "water": [{"x": 150, "y": 254, "w": 276, "h": 46}, {"x": 566, "y": 254, "w": 266, "h": 46}], "spikes": [{"x": 150, "y": 0, "w": 276, "h": 44}, {"x": 566, "y": 0, "w": 266, "h": 44}], "stars": [{"x": 282, "y": 168}, {"x": 693, "y": 148}, {"x": 320, "y": 150}, {"x": 700, "y": 148}], "checkpoints": [104, 520]},
  {"id": 20, "name": "Großes Finale", "theme": "sumpf", "width": 1696, "spawn": {"x": 26, "y": 180}, "goal": {"x": 1626, "y": 110}, "ground": [{"x": 0, "y": 210, "w": 150, "h": 90}, {"x": 336, "y": 190, "w": 130, "h": 110}, {"x": 622, "y": 170, "w": 130, "h": 130}, {"x": 904, "y": 190, "w": 130, "h": 110}, {"x": 1182, "y": 170, "w": 130, "h": 130}, {"x": 1456, "y": 150, "w": 240, "h": 150}], "bridges": [{"x": 168, "w": 150, "crossY": 210, "n": 0.214, "low": 254, "high": 48}, {"x": 484, "w": 120, "crossY": 190, "n": 0.311, "low": 254, "high": 48}, {"x": 770, "w": 116, "crossY": 170, "n": 0.408, "low": 254, "high": 48}, {"x": 1052, "w": 112, "crossY": 190, "n": 0.311, "low": 254, "high": 48}, {"x": 1330, "w": 108, "crossY": 170, "n": 0.408, "low": 254, "high": 48}], "water": [{"x": 150, "y": 254, "w": 186, "h": 46}, {"x": 466, "y": 254, "w": 156, "h": 46}, {"x": 752, "y": 254, "w": 152, "h": 46}, {"x": 1034, "y": 254, "w": 148, "h": 46}, {"x": 1312, "y": 254, "w": 144, "h": 46}], "spikes": [{"x": 466, "y": 0, "w": 156, "h": 44}, {"x": 1312, "y": 0, "w": 144, "h": 44}], "stars": [{"x": 237, "y": 168}, {"x": 538, "y": 148}, {"x": 822, "y": 128}, {"x": 1102, "y": 148}, {"x": 1378, "y": 128}], "checkpoints": [104, 420, 706, 988, 1266]}
];
/* ------------------- 10. BRUECKENWESEN -------------------------------- */
class Bridge {
  constructor(d) {
    Object.assign(this, d);
    this.y = d.low; this.prevY = d.low; this.vel = 0;
    this.blink = 2 + Math.random() * 4; this.blinking = 0; this.wob = 0;
  }
  get dy() { return this.y - this.prevY; }
  rect() { return { x: this.x, y: this.y, w: this.w, h: Math.max(4, 320 - this.y) }; }
  get vy() { return this.dy / Math.max(1e-4, this.lastDt || CONFIG.game.fixedStep); }
  update(dt, n) {
    const vBefore = this.vy;
    this.prevY = this.y; this.lastDt = dt;
    const B = CONFIG.bridge;
    const target = lerp(this.low, this.high, clamp(n, 0, 1));
    // Geschwindigkeit und Beschleunigung sind begrenzt: das Wesen ist schwer
    const desired = clamp((target - this.y) * B.gain, -B.maxSpeed, B.maxSpeed);
    this.vel = (this.vel || 0) + clamp(desired - (this.vel || 0), -B.maxAccel * dt, B.maxAccel * dt);
    this.y += this.vel * dt;
    if (this.y < this.high) { this.y = this.high; this.vel = 0; }
    if (this.y > this.low) { this.y = this.low; this.vel = 0; }
    this.accel = (this.vy - vBefore) / dt;
    this.wob += dt * (2 + Math.abs(this.dy) * 0.5);
    this.blink -= dt;
    if (this.blink <= 0) { this.blinking = 0.12; this.blink = 2.5 + Math.random() * 4; }
    this.blinking -= dt;
  }
  faceState(n) {
    if (this.y < 72) return 3;
    if (n < 0.10) return 0;
    if (n < 0.45) return 1;
    return 2;
  }
}

/* ------------------- 11. SPIELFIGUR (laeuft ohne Halt) ---------------- */
class Player {
  constructor(charKey) { this.charKey = charKey; this.w = 10; this.h = 15; this.reset(0, 0); }
  reset(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.grounded = false; this.support = null; this.onBridge = false;
    this.state = 'run'; this.anim = 0; this.dead = false; this.deadTimer = 0;
    this.celebrate = false; this.landTimer = 0; this.stumbleT = 0;
    this.tilt = 0; this.squash = 1;
  }
  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  supportAt(px, feet, solids) {
    for (const s of solids) {
      if (px < s.x || px > s.x + s.w) continue;
      if (feet >= s.y - 3 && feet <= s.y + 6) return s;
    }
    return null;
  }
  topAt(px, minY, maxY, solids) {
    let best = null;
    for (const s of solids) {
      if (px < s.x - 1 || px > s.x + s.w + 1) continue;
      if (s.y >= minY && s.y <= maxY && (!best || s.y < best.y)) best = s;
    }
    return best;
  }
  update(dt, level, game) {
    const ph = CONFIG.physics;
    const solids = level.solids();
    if (this.dead) {
      this.vy += ph.gravity * dt * 0.5; this.y += this.vy * dt;
      this.deadTimer -= dt; this.anim += dt;
      if (this.deadTimer <= 0) game.respawn();
      return;
    }
    if (this.celebrate) { this.anim += dt; return; }
    // Mitfahren: Position uebernehmen, Schwung merken
    this.carryVy = 0;
    if (this.grounded && this.support && this.support.ref) {
      const b = this.support.ref;
      this.y += b.dy;
      this.carryVy = b.vy;
      if (b.accel > ph.gravity) {       // Bruecke bremst staerker als die Schwerkraft
        this.vy = b.vy;                 // -> die Figur loest sich und fliegt mit ihrem Schwung weiter
        this.grounded = false; this.support = null;
      } else this.vy = 0;
    }

    const feet = this.y + this.h;
    if (this.grounded && this.stumbleT <= 0 && !this.supportAt(this.x + this.w + 2, feet, solids)) {
      let landing = null, ldx = 0;
      for (let dx = 5; dx <= ph.gapJumpMax; dx += 3) {
        const s = this.topAt(this.x + this.w + dx, feet - 34, feet + ph.dropMax, solids);
        if (s) { landing = s; ldx = dx; break; }
      }
      if (landing && (feet - landing.y > 2 || ldx > 8)) {
        this.vy = -ph.jumpForce; this.grounded = false; this.support = null; this.onBridge = false;
        Snd.play('jump');
        level.burst(this.x + 5, feet, 5, '#fff3d6', 8, 26);
      }
    }
    if (this.stumbleT > 0) { this.stumbleT -= dt; this.vx = -ph.runSpeed * 0.5; }
    else this.vx = ph.runSpeed;
    this.x += this.vx * dt;
    for (const s of solids) {
      if (!rectsOverlap(this.rect, s)) continue;
      if ((this.y + this.h) - s.y <= ph.stepUp && this.vy >= 0) { this.y = s.y - this.h; this.vy = 0; }
      else if (this.vx > 0) {
        this.x = s.x - this.w - 0.01;
        if (this.stumbleT <= 0) {
          this.stumbleT = ph.stumbleTime; Snd.play('stumble');
          level.burst(this.x + 5, this.y + 12, 4, '#d9c9a8', 6, 20);
        }
      }
    }
    this.vy = clamp(this.vy + ph.gravity * dt, -ph.jumpForce * 1.6, ph.terminalVy);
    const prevBottom = this.y + this.h;
    this.y += this.vy * dt;
    const wasGrounded = this.grounded;
    const prevSupport = this.support;
    this.grounded = false; this.support = null;
    for (const s of solids) {
      if (!rectsOverlap(this.rect, s)) continue;
      if (this.vy >= 0 && prevBottom <= s.y + 9) { this.y = s.y - this.h; this.vy = 0; this.grounded = true; this.support = s; }
      else if (this.vy < 0 && this.y > s.y) { this.y = s.y + s.h; this.vy = 0; }
    }
    // kurzer Nachgreifbereich, damit die Figur bei ruckartiger Fahrt nicht durchrutscht
    if (!this.grounded && prevSupport && prevSupport.isBridge && this.vy >= 0) {
      const cx = this.x + this.w / 2, gap = prevSupport.y - (this.y + this.h);
      if (cx >= prevSupport.x && cx <= prevSupport.x + prevSupport.w && gap >= -2 && gap < 8) {
        this.y = prevSupport.y - this.h; this.vy = prevSupport.ref ? prevSupport.ref.vy : 0;
        this.grounded = true; this.support = prevSupport;
      }
    }
    if (!this.grounded && wasGrounded && prevSupport && prevSupport.isBridge && this.carryVy < 0 && this.vy > this.carryVy) {
      this.vy = this.carryVy;            // von der steigenden Bruecke abspringen
    }
    this.onBridge = !!(this.support && this.support.isBridge);
    if (this.grounded && !wasGrounded) {
      Snd.play('land'); this.landTimer = 0.16;
      level.burst(this.x + 5, this.y + this.h, 5, '#d9c9a8', 8, 22);
    }
    this.landTimer -= dt;
    if (!this.grounded) this.state = this.vy < 0 ? 'jump' : 'fall';
    else if (this.stumbleT > 0) this.state = 'stumble';
    else if (this.landTimer > 0) this.state = 'land';
    else this.state = 'run';

    // Neigung: in der Luft nach der Flugbahn, auf der Brücke nach der Trägheit
    let want;
    if (this.dead) want = 0.9;
    else if (!this.grounded) want = clamp(this.vy / 620, -0.30, 0.34);
    else if (this.support && this.support.ref) want = clamp(this.support.ref.vel / 620, -0.20, 0.20);
    else want = Math.sin(this.anim * 14) * 0.02;
    this.tilt += (want - this.tilt) * (1 - Math.pow(0.001, dt));
    // Stauchen beim Landen, Strecken im Steigflug
    const wantSq = this.landTimer > 0 ? 0.88 : (!this.grounded && this.vy < -60) ? 1.06 : 1;
    this.squash += (wantSq - this.squash) * (1 - Math.pow(0.004, dt));
    this.anim += dt;
  }
  frame() {
    const F = ASSETS.frames(this.charKey);
    const key = this.dead ? 'hurt' : this.celebrate ? 'celebrate' : this.state;
    const set = F[key] || F.idle;
    const speed = key === 'run' ? 16 : 6;
    return set[((this.anim * speed) | 0) % set.length];
  }
}

/* ------------------- 12. DEKORATION ----------------------------------- */
function buildDecor(seed, groundList, width, themeKey, blocked) {
  const rnd = mulberry32(seed);
  const T = THEME_DEFS[themeKey] || THEME_DEFS.wald;
  const bag = T.props;
  const plane = [];
  groundList.forEach((g) => {
    let x = g.x + 6;
    while (x < g.x + g.w - 16) {
      const pick = bag[(rnd() * bag.length) | 0];
      if (!(blocked || []).some((bx) => Math.abs(bx - x) < 26))
        plane.push({ t: pick[0], s: pick[1], x: x, gy: g.y, sway: pick[0] === 'rock' ? 0 : 0.8 });
      x += 22 + ((rnd() * 40) | 0);
    }
  });
  const front = [];
  groundList.forEach((g) => {
    let x = g.x + 18;
    while (x < g.x + g.w - 22) {
      const pick = bag[(rnd() * bag.length) | 0];
      if (!(blocked || []).some((bx) => Math.abs(bx - x) < 30) && rnd() > 0.45)
        front.push({ t: pick[0], s: pick[1] * 1.35, x: x, gy: g.y + 3, sway: 0.9 });
      x += 60 + ((rnd() * 90) | 0);
    }
  });
  const clouds = [];
  for (let i = 0; i < 9; i++) clouds.push({ i: 1 + ((rnd() * 3) | 0), x: rnd() * (width + 300), y: 8 + rnd() * 54, s: 0.10 + rnd() * 0.12 });
  const motes = [];
  for (let i = 0; i < 22; i++) motes.push({ x: rnd() * width, y: rnd() * 240, r: 0.4 + rnd() * 1.2, p: rnd() * 6.28 });
  return { plane: plane, front: front, fore: [], clouds: clouds, motes: motes };
}

class Particle {
  constructor(x, y, vx, vy, life, col, size) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.max = life; this.col = col; this.size = size || 1;
  }
}

/* ------------------- 13. LEVEL ----------------------------------------- */
class Level {
  constructor(data) {
    this.data = data;
    this.bridges = data.bridges.map((b) => new Bridge(b));
    // Boden und Flüssigkeit reichen bis deutlich unter den Bildrand,
    // damit bei tiefem Kamerastand unten kein Himmel durchscheint
    const FLOOR = 360;
    this.ground = data.ground.map((g) => Object.assign({}, g, { h: Math.max(g.h, FLOOR - g.y) }));
    this.water = (data.water || []).map((w) => Object.assign({}, w, { h: Math.max(w.h, FLOOR - w.y) }));
    this.spikes = (data.spikes || []).map((s) => Object.assign({}, s));
    this.decor = buildDecor(data.id * 7717 + 3, data.ground, data.width, data.theme,
      [data.goal.x + 14, data.goal.x + 34].concat(data.checkpoints || []));
    this.signs = (data.checkpoints || []).map((cx) => {
      const g = data.ground.find((gg) => cx >= gg.x - 4 && cx <= gg.x + gg.w + 4) || data.ground[0];
      return { x: cx, gy: g.y };
    });
    this.reset();
  }
  reset() {
    this.stars = (this.data.stars || []).map((s) => ({ x: s.x, y: s.y, taken: false, t: Math.random() * 6 }));
    this.particles = []; this.time = 0; this.deaths = 0; this.finished = false; this.checkpoint = 0;
    this.bridges.forEach((b) => { b.y = b.low; b.prevY = b.low; b.vel = 0; });
  }
  solids() {
    const list = [];
    this.ground.forEach((g) => list.push(g));
    this.bridges.forEach((b) => { const r = b.rect(); r.isBridge = true; r.ref = b; list.push(r); });
    return list;
  }
  burst(x, y, n, col, spread, up) {
    for (let i = 0; i < n; i++) {
      this.particles.push(new Particle(
        x + (Math.random() - 0.5) * (spread || 8), y + (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 50, -Math.random() * (up || 40),
        0.35 + Math.random() * 0.5, col, Math.random() > 0.6 ? 2 : 1));
    }
  }
  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vy += 140 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
}

class Camera {
  constructor() { this.x = 0; this.y = 0; }
  target(p, level) {
    return {
      x: clamp(p.x - CONFIG.game.W * 0.34, 0, Math.max(0, level.data.width - CONFIG.game.W)),
      y: clamp(p.y - CONFIG.game.H * 0.56, -50, 60)
    };
  }
  follow(p, level, dt) {
    const t = this.target(p, level);
    const k = 1 - Math.pow(0.0018, dt);
    this.x = lerp(this.x, t.x, k); this.y = lerp(this.y, t.y, k);
  }
  snap(p, level) { const t = this.target(p, level); this.x = t.x; this.y = t.y; }
}

/* ------------------- 14. ENDLOS-MODUS ----------------------------------
   Vier Etagen, links und rechts je ein Häuschen pro Farbe. Jede Figur
   startet in ihrem Häuschen und will zum gleichfarbigen Häuschen auf der
   anderen Seite. Läuft sie in ein falsches Haus, kostet das ein Leben.
   -------------------------------------------------------------------- */
const SHAFT = { x: 200, w: 80 };
const FLOORS = [190, 145, 100, 58];
const END_WATER = 240;
const END_SPIKE = 28;
const END_DEF = {
  slabs: [
    { x: 16, y: 190, w: 184, h: 60 }, { x: 280, y: 190, w: 184, h: 60 },
    { x: 46, y: 145, w: 154, h: 22 }, { x: 280, y: 145, w: 154, h: 22 },
    { x: 76, y: 100, w: 124, h: 22 }, { x: 280, y: 100, w: 124, h: 22 },
    { x: 106, y: 58, w: 94, h: 22 }, { x: 280, y: 58, w: 94, h: 22 }
  ],
  // jede Farbe hat links und rechts ein Haus, aber auf verschiedenen Etagen
  houses: [
    { key: 'p1', side: -1, x: 20, slabY: 190 }, { key: 'p1', side: 1, x: 396, slabY: 100 },
    { key: 'p2', side: -1, x: 50, slabY: 145 }, { key: 'p2', side: 1, x: 418, slabY: 190 },
    { key: 'p3', side: -1, x: 110, slabY: 58 }, { key: 'p3', side: 1, x: 390, slabY: 145 }
  ]
};
const doorX = (h) => h.x + 14;

/* Schwierigkeitsgrade: Anzahl gleichzeitig sichtbarer Figuren und ob sie
   zum Schacht zurücklaufen, wenn sie auf der falschen Etage stehen. */
const DIFFS = [
  { key: 'leicht', name: 'LEICHT', max: 3, interval: 3.2, retry: true, speed: 0 },
  { key: 'mittel', name: 'MITTEL', max: 4, interval: 2.4, retry: false, speed: 2 },
  { key: 'schwer', name: 'SCHWER', max: 10, interval: 1.1, retry: false, speed: 5 },
  { key: 'extrem', name: 'SUPER SCHWER', max: 25, interval: 0.45, retry: false, speed: 9 }
];

class Runner {
  constructor(key, home, target, speed, scene) {
    this.key = key; this.speed = speed;
    this.home = home; this.house = target;
    this.x = doorX(home) - 5; this.y = home.slabY - 15;
    this.vy = 0; this.state = 'walk'; this.dir = home.side < 0 ? 1 : -1;
    this.anim = 0; this.timer = 0; this.onBridge = false; this.support = null;
    this.paceT = 0; this.paceDir = 1; this.tilt = 0; this.fx = 0; this.grace = 0.8;
  }
  get w() { return 10; }
  get h() { return 15; }
  get rect() { return { x: this.x, y: this.y, w: 10, h: 15 }; }
  supportUnder(px, feet, supports) {
    let best = null;
    for (const s of supports) {
      if (px < s.x || px > s.x + s.w) continue;
      if (feet >= s.y - 4 && feet <= s.y + 6 && (!best || s.y < best.y)) best = s;
    }
    return best;
  }
  // naechste Kante in Laufrichtung, die erreichbar waere
  reachable(px, feet, supports) {
    let best = null;
    for (const s of supports) {
      if (px < s.x - 2 || px > s.x + s.w + 2) continue;
      if (s.y >= feet - 30 && s.y <= feet + 55 && (!best || Math.abs(s.y - feet) < Math.abs(best.y - feet))) best = s;
    }
    return best;
  }
  desiredDir(scene) {
    const side = this.house.side;
    if (this.onBridge) return side;
    const mySide = this.x + 5 < SHAFT.x ? -1 : 1;
    if (mySide === side) {
      if (Math.abs((this.y + this.h) - this.house.slabY) < 8) return doorX(this.house) > this.x + 5 ? 1 : -1;
      // Leicht: noch mal zurück zum Schacht. Ab Mittel: sie läuft weiter – und damit ins falsche Haus.
      return scene.diff.retry ? (side < 0 ? 1 : -1) : (side < 0 ? -1 : 1);
    }
    return mySide < 0 ? 1 : -1;
  }
  update(dt, scene) {
    if (this.state === 'home') { this.anim += dt; this.timer -= dt; if (this.timer <= 0) this.state = 'gone'; return; }
    if (this.state === 'dead') { this.timer -= dt; this.anim += dt; if (this.timer <= 0) this.state = 'gone'; return; }
    if (this.state === 'gone') return;
    this.grace -= dt;

    const bridge = scene.bridge.rect();
    bridge.isBridge = true;
    const supports = scene.slabs.concat([bridge]);
    const feet = this.y + this.h;
    const cx = this.x + 5;
    const prevOn = this.onBridge;
    this.support = this.supportUnder(cx, feet, supports);
    if (!this.support && prevOn && cx >= bridge.x && cx <= bridge.x + bridge.w &&
        bridge.y < END_WATER - 2 && Math.abs(bridge.y - feet) < 10) this.support = bridge;
    this.onBridge = this.support === bridge;

    if (!this.support) {
      this.state = this.vy < 0 ? 'jump' : 'fall';
      this.vy = clamp(this.vy + CONFIG.physics.gravity * 0.85 * dt, -400, CONFIG.physics.terminalVy);
      this.y += this.vy * dt;
      this.x += this.speed * this.dir * dt * 0.9;          // Schwung im Sprung
      if (this.y + this.h >= END_WATER) { scene.kill(this, 'water'); return; }
    } else {
      if (this.onBridge) this.y = this.support.y - this.h;
      else this.y = this.support.y - this.h;
      this.vy = 0;
      this.paceT -= dt;
      const want = this.desiredDir(scene);
      const wx = want > 0 ? this.x + this.w + 1 : this.x - 1;
      const flat = this.supportUnder(wx, feet, supports);
      const step = this.reachable(want > 0 ? this.x + this.w + 10 : this.x - 10, feet, supports);
      if (flat || step) this.paceT = 0;                    // Weg frei: sofort hin
      this.dir = this.paceT > 0 ? this.paceDir : want;

      // Haus betreten?
      if (this.grace <= 0) {
        for (const h of scene.houses) {
          if (h === this.home) continue;
          if (Math.abs(feet - h.slabY) < 8 && Math.abs(cx - doorX(h)) < 9) { scene.deliver(this, h); return; }
        }
      }
      const aheadX = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
      const ahead = this.supportUnder(aheadX, feet, supports);
      if (ahead) {
        this.state = 'walk';
        this.x += this.speed * this.dir * dt;
      } else {
        const tgt = this.reachable(this.dir > 0 ? this.x + this.w + 10 : this.x - 10, feet, supports);
        if (tgt && feet - tgt.y > 3) {                     // hoehere Kante: hinaufspringen
          this.vy = -215; this.state = 'jump'; this.support = null; this.onBridge = false;
          this.y -= 6;                                     // sofort abheben, sonst klebt sie fest
          this.x += this.speed * this.dir * dt;
        } else if (tgt) {                                   // tiefere Kante: hinunterlaufen
          this.state = 'walk'; this.x += this.speed * this.dir * dt;
        } else {                                            // nichts da: umdrehen, nie stehenbleiben
          if (this.paceT <= 0) { this.paceDir = -this.dir; this.paceT = 0.55; }
          this.dir = this.paceDir; this.state = 'walk';
          this.x += this.speed * this.dir * dt * 0.85;
        }
      }
    }
    if (this.y < END_SPIKE) { scene.kill(this, 'spikes'); return; }
    const w = (this.state === 'fall' || this.state === 'jump') ? clamp(this.vy / 620, -0.3, 0.34)
            : (this.onBridge ? clamp(scene.bridge.vel / 620, -0.2, 0.2) : 0);
    this.tilt += (w - this.tilt) * (1 - Math.pow(0.001, dt));
    this.anim += dt;
  }
  frame() {
    const F = ASSETS.frames(this.key);
    if (this.state === 'home') return F.celebrate[((this.anim * 6) | 0) % 2];
    if (this.state === 'dead') return F.hurt[0];
    if (this.state === 'fall' || this.state === 'jump') return F.jump[0];
    if (this.state === 'walk') return F.run[((this.anim * 13) | 0) % F.run.length];
    return F.idle[0];
  }
}

class EndlessScene {
  constructor(themeKey, diffKey) {
    this.diff = DIFFS.find((d) => d.key === diffKey) || DIFFS[0];
    this.data = { theme: themeKey || 'wald', width: 480, id: 99 };
    this.slabs = END_DEF.slabs.map((s) => Object.assign({}, s));
    this.houses = END_DEF.houses.map((h) => Object.assign({}, h));
    this.bridge = new Bridge({ x: SHAFT.x, w: SHAFT.w, low: END_WATER - 6, high: 24, crossY: 190, n: 0.21 });
    this.decor = buildDecor(4242, this.slabs, 480, this.data.theme, this.houses.map(doorX));
    this.reset();
  }
  reset() {
    this.runners = []; this.particles = [];
    this.rescued = {}; CHARS.forEach((c) => { this.rescued[c.key] = 0; });
    this.lives = 10; this.score = 0; this.wrong = 0; this.time = 0; this.spawnT = 0.6; this.over = false;
    this.flash = null; this.flashT = 0;
    this.bridge.y = this.bridge.low; this.bridge.prevY = this.bridge.low; this.bridge.vel = 0;
  }
  spawn() {
    const c = CHARS[(Math.random() * CHARS.length) | 0];
    const pair = this.houses.filter((h) => h.key === c.key);
    const i = (Math.random() * 2) | 0;
    const home = pair[i], target = pair[1 - i];
    this.runners.push(new Runner(c.key, home, target,
      22 + this.diff.speed + Math.random() * 8 + Math.min(10, this.time * 0.05), this));
  }
  deliver(r, house) {
    const right = house.key === r.key;
    r.state = 'home'; r.timer = 0.9;
    const col = (CHARS.find((c) => c.key === r.key) || CHARS[0]).color;
    if (right) {
      this.score++; this.rescued[r.key]++;
      Snd.play('collect');
      this.burst(doorX(house), house.slabY - 16, 12, col, 12, 60);
      this.flash = { x: doorX(house), y: house.slabY - 52, text: '+1', col: '#ffd447' }; this.flashT = 1.1;
    } else {
      this.lives--; this.wrong++;
      Snd.play('hit');
      this.burst(doorX(house), house.slabY - 16, 12, '#ff6a4c', 12, 50);
      this.flash = { x: doorX(house), y: house.slabY - 52, text: 'FALSCH', col: '#ff8a6a' }; this.flashT = 1.3;
      if (this.lives <= 0) this.over = true;
    }
  }
  kill(r, why) {
    if (r.state === 'dead') return;
    r.state = 'dead'; r.timer = 0.9; r.fx = why === 'water' ? 2 : 1;
    this.lives--;
    Snd.play(why === 'water' ? 'splash' : 'hit');
    this.burst(r.x + 5, r.y + 6, 10, why === 'water' ? '#bfe8fb' : '#fff3d6', 10, 50);
    if (this.lives <= 0) this.over = true;
  }
  active() { return this.runners.filter((r) => ['home', 'dead', 'gone'].indexOf(r.state) < 0).length; }
  burst(x, y, n, col, spread, up) { Level.prototype.burst.call(this, x, y, n, col, spread, up); }
  updateParticles(dt) { Level.prototype.updateParticles.call(this, dt); }
  update(dt, n) {
    if (this.over) return;
    this.time += dt;
    if (this.flashT > 0) this.flashT -= dt;
    this.bridge.update(dt, n);
    this.runners.forEach((r) => r.update(dt, this));
    this.updateParticles(dt);
    // erledigte Figuren aufräumen
    for (let i = this.runners.length - 1; i >= 0; i--) if (this.runners[i].state === 'gone') this.runners.splice(i, 1);
    // nachrücken, sobald wieder Platz ist
    this.spawnT -= dt;
    if (this.active() < this.diff.max && this.spawnT <= 0) {
      this.spawn();
      this.spawnT = this.diff.interval;
    }
  }
}
/* ------------------- 15. RENDERER ------------------------------------
   Gezeichnet wird in Spielkoordinaten (480x270); das Canvas laeuft
   intern mit dreifacher Aufloesung, damit die Grafiken scharf bleiben.
   HINTERGRUND (Parallax) | SPIELEBENE | VORDERGRUND
   -------------------------------------------------------------------- */
const TILE = CONFIG.game.tile;

class Renderer {
  constructor(ctx) { this.x = ctx; this.t = 0; }

  /* --- Grundlagen ---------------------------------------------------- */
  img(im, x, y, w, h) {
    if (!im || !im.width) return;
    this.x.drawImage(im, x, y, w, h);
  }
  // Bild als Kachel zeichnen, Rest sauber abschneiden
  tile(im, x, y, w, h) {
    if (!im || !im.width) return;
    const sw = im.width * (w / TILE), sh = im.height * (h / TILE);
    // 0.4 Einheiten Überstand, sonst blitzen bei der Skalierung Fugen durch
    this.x.drawImage(im, 0, 0, Math.max(1, sw), Math.max(1, sh), x, y, w + 0.4, h + 0.4);
  }
  // Figur mit Neigung und Stauchung auf der Grundlinie
  actor(im, cx, baseY, height, tilt, squash) {
    if (!im || !im.width) return;
    const c = this.x;
    const h = height * (squash || 1), w = im.width / im.height * height / (squash || 1);
    if (!tilt) { c.drawImage(im, cx - w / 2, baseY - h, w, h); return; }
    c.save();
    c.translate(cx, baseY);
    c.rotate(tilt);
    c.drawImage(im, -w / 2, -h, w, h);
    c.restore();
  }
  // Bild mit fester Hoehe, Breite proportional, auf einer Grundlinie
  stand(im, cx, baseY, height, flipY) {
    if (!im || !im.width) return;
    const w = im.width / im.height * height;
    if (flipY) {
      this.x.save(); this.x.translate(cx - w / 2, baseY); this.x.scale(1, -1);
      this.x.drawImage(im, 0, 0, w, height); this.x.restore();
    } else this.x.drawImage(im, cx - w / 2, baseY - height, w, height);
  }
  text(s, x, y, size, col, align, plain) {
    const c = this.x;
    c.font = 'bold ' + (size || 10) + 'px "Trebuchet MS", "Segoe UI", sans-serif';
    c.textAlign = align || 'left'; c.textBaseline = 'top';
    if (!plain) {
      c.lineWidth = Math.max(2, size * 0.28); c.lineJoin = 'round';
      c.strokeStyle = 'rgba(28,22,40,0.92)'; c.strokeText(s, x, y);
    }
    c.fillStyle = col || '#ffffff'; c.fillText(s, x, y);
  }
  roundRect(x, y, w, h, r) {
    const c = this.x;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  panel(x, y, w, h, light) {
    const c = this.x;
    this.roundRect(x, y, w, h, 5);
    c.fillStyle = 'rgba(28,22,40,0.86)'; c.fill();
    c.lineWidth = 1.6; c.strokeStyle = light ? '#ffd447' : 'rgba(255,255,255,0.45)'; c.stroke();
    this.roundRect(x + 2, y + 2, w - 4, (h - 4) * 0.42, 4);
    c.fillStyle = light ? 'rgba(255,212,71,0.22)' : 'rgba(255,255,255,0.10)'; c.fill();
  }
  plate(x, y, w, h, a) {
    this.roundRect(x, y, w, h, 4);
    this.x.fillStyle = 'rgba(28,22,40,' + (a === undefined ? 0.6 : a) + ')';
    this.x.fill();
  }

  /* --- Ebene 1: Himmel, Wolken, Huegel -------------------------------- */
  background(themeKey, cam) {
    const c = this.x, W = CONFIG.game.W, H = CONFIG.game.H;
    const T = THEME_DEFS[themeKey] || THEME_DEFS.wald;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, T.sky[0]); g.addColorStop(0.72, T.sky[1]); g.addColorStop(1, T.haze);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // Jede Ebene steht auf ihrem eigenen Farbband, das bis unter den Bildrand
    // reicht - so kann keine Silhouette in der Luft haengen.
    const row = (name, span, baseY, hgt, par, alpha, bandCol) => {
      const base = baseY - cam.y * par;
      const im = IMG[name];
      if (im && im.width) {
        const w = im.width / im.height * hgt;
        c.globalAlpha = alpha;
        let x = ((-cam.x * par) % span + span) % span - span;
        while (x < W + span) { this.img(im, x, base - hgt + 1, w, hgt); x += span; }
        c.globalAlpha = 1;
      }
      c.fillStyle = bandCol;
      c.fillRect(0, base, W, Math.max(0, 400 - base));
    };
    row(T.hills[0], 96, 204, 58, 0.12, 0.6, T.haze);
    row(T.hills[1], 74, 214, 38, 0.22, 0.85, T.band);
    if (T.hillTint) { c.fillStyle = T.hillTint; c.fillRect(0, 118, W, 100); }
  }
  clouds(level, cam) {
    const c = this.x;
    level.decor.clouds.forEach((cl) => {
      const im = IMG['cloud' + cl.i];
      if (!im || !im.width) return;
      const span = level.data.width + 340;
      let x = cl.x - cam.x * cl.s + Math.sin(this.t * 0.1 + cl.x) * 3;
      x = ((x % span) + span) % span - 130;
      c.globalAlpha = 0.85;
      this.img(im, x, cl.y - cam.y * 0.08, im.width * 0.28, im.height * 0.28);
      c.globalAlpha = 1;
    });
  }

  /* --- Ebene 2: Spielebene -------------------------------------------- */
  ground(T, g) {
    const set = T.set;
    const cols = Math.max(1, Math.ceil(g.w / TILE));
    const colW = (i) => Math.min(TILE, g.x + g.w - (g.x + i * TILE));
    // Dünne, schwebende Plattform: einreihige Halbkacheln
    if (g.h <= 26) {
      for (let i = 0; i < cols; i++) {
        const x = g.x + i * TILE;
        const im = IMG[set + (cols === 1 ? 'Half' : i === 0 ? 'HalfLeft' : i === cols - 1 ? 'HalfRight' : 'HalfMid')];
        this.tile(im, x, g.y, colW(i), TILE);
      }
      return;
    }
    const rows = Math.max(1, Math.ceil(g.h / TILE));
    for (let i = 0; i < cols; i++) {
      const x = g.x + i * TILE, w = colW(i);
      // Oberkante: einzige Reihe mit Randkacheln
      this.tile(IMG[set + (i === 0 ? 'Left' : i === cols - 1 ? 'Right' : 'Mid')], x, g.y, w, TILE);
      // darunter nur deckende Füllung, sonst sieht man hindurch
      for (let ry = 1; ry < rows; ry++) {
        const y = g.y + ry * TILE, h = Math.min(TILE, g.y + g.h - y);
        if (h <= 0) break;
        this.tile(IMG[set + 'Center'], x, y, w, h);
      }
    }
    // Felswand als Auflage auf der deckenden Füllung, nur die erste Reihe darunter
    if (rows > 1 && cols > 1) {
      const h = Math.min(TILE, g.h - TILE);
      this.tile(IMG[set + 'CliffLeft'], g.x, g.y + TILE, colW(0), h);
      this.tile(IMG[set + 'CliffRight'], g.x + (cols - 1) * TILE, g.y + TILE, colW(cols - 1), h);
    }
  }
  liquid(T, w) {
    const c = this.x;
    const L = ASSETS.liquid(T.liquid);
    const lava = T.liquid === 'lava';
    const col = lava ? '#e46816' : '#96e3ec';
    const bob = Math.sin(this.t * 2) * 0.5;
    c.fillStyle = col;
    c.fillRect(w.x, w.y + TILE * 0.62, w.w, Math.max(0, w.h - TILE * 0.62));
    // langsame Stroemung zur Seite; Lava zaeher als Wasser
    const flow = (this.t * (lava ? 2.2 : 5.0)) % TILE;
    c.save();
    c.beginPath(); c.rect(w.x, w.y - 3, w.w, w.h + 3); c.clip();
    for (let x = w.x - TILE + flow; x < w.x + w.w + TILE; x += TILE) {
      this.img(L.top, x, w.y + bob, TILE + 0.4, TILE + 0.4);
      for (let y = w.y + TILE; y < w.y + w.h; y += TILE) this.img(L.body, x, y, TILE + 0.4, TILE + 0.4);
    }
    c.restore();
  }
  spikes(T, s) {
    const c = this.x;
    const barH = Math.min(16, s.h * 0.34);
    const spH = s.h - barH;
    for (let x = s.x; x < s.x + s.w; x += TILE) {
      const w = Math.min(TILE, s.x + s.w - x);
      for (let y = s.y; y < s.y + barH; y += TILE) {
        this.tile(IMG[(T && T.set ? T.set : 'stone') + 'Center'], x, y, w, Math.min(TILE, s.y + barH - y));
      }
      const im = IMG.spikes;
      if (im && im.width) {
        c.save(); c.translate(x, s.y + s.h); c.scale(1, -1);
        c.drawImage(im, 0, 0, im.width * (w / TILE), im.height, 0, 0, w + 0.4, spH);
        c.restore();
      }
    }
  }
  bridge(b, n) {
    const c = this.x;
    const wob = Math.sin(b.wob) * CONFIG.bridge.wobble * 0.5;
    const top = b.y;
    c.save();
    c.beginPath(); c.rect(b.x - 1, 28, b.w + 2, 320 - 28); c.clip();
    for (let x = b.x; x < b.x + b.w; x += TILE) {
      const w = Math.min(TILE, b.x + b.w - x);
      for (let y = top; y < 320; y += TILE) this.tile(IMG.blockerBody, x + wob, y, w, TILE);
    }
    // Gesicht in der Mitte der Oberkante
    const face = (b.blinking > 0 || n < 0.12) ? IMG.blockerSad : IMG.blockerMad;
    const fw = TILE * 2.2;
    this.img(face, b.x + wob + b.w / 2 - fw / 2, top + 1, fw, fw);
    c.restore();
    // Zielmarken
    c.fillStyle = 'rgba(255,212,71,0.75)';
    c.fillRect(b.x - 4, b.crossY - 1, 4, 2); c.fillRect(b.x + b.w, b.crossY - 1, 4, 2);
  }
  props(list, cam) {
    list.forEach((d) => {
      if (d.x - cam.x < -90 || d.x - cam.x > CONFIG.game.W + 90) return;
      const im = ASSETS.prop(d.t, this.t);
      if (!im || !im.width) return;
      const h = TILE * d.s;
      const sway = Math.sin(this.t * 1.4 + d.x * 0.07) * d.sway;
      this.stand(im, d.x + sway, d.gy + 1, h);
    });
  }
  goal(level, charKey) {
    const g = level.data.goal;
    const gy = g.y + 40;                       // Bodenhoehe am Ziel
    this.stand(IMG.door_closedMid, g.x + 14, gy, TILE * 1.4);
    this.stand(IMG.door_closedTop, g.x + 14, gy - TILE * 1.4, TILE * 1.4);
    this.stand(ASSETS.flag(charKey, this.t), g.x + 34, gy, TILE * 2.6);
  }
  character(frames, key, x, baseY, extra) {
    const F = frames;
    const im = F;
    this.stand(im, x, baseY, CONFIG.art.playerH * (extra || 1));
  }
  plane(level, cam, player, n, dt) {
    const c = this.x, T = THEME_DEFS[level.data.theme] || THEME_DEFS.wald;
    c.save(); c.translate(-cam.x, -cam.y);
    level.bridges.forEach((b) => this.bridge(b, n));
    level.water.forEach((w) => this.liquid(T, w));
    level.ground.forEach((g) => this.ground(T, g));
    this.props(level.decor.plane, cam);
    level.spikes.forEach((s) => this.spikes(T, s));
    level.stars.forEach((s) => {
      if (s.taken) return;
      s.t += dt;
      this.stand(IMG.star, s.x + 6, s.y + 12 + Math.sin(s.t * 3) * 2, TILE);
    });
    (level.signs || []).forEach((sg) => this.stand(IMG.sign, sg.x + 8, sg.gy + 1, TILE * 1.2));
    this.goal(level, player.charKey);
    this.actor(player.frame(), player.x + player.w / 2, player.y + player.h + 1, CONFIG.art.playerH, player.tilt, player.squash);
    level.particles.forEach((p) => {
      c.globalAlpha = clamp(p.life / p.max, 0, 1);
      c.fillStyle = p.col; c.fillRect(p.x, p.y, p.size, p.size);
    });
    c.globalAlpha = 1;
    this.props(level.decor.front || [], cam);      // steht vor der Figur
    c.restore();
  }

  /* --- Ebene 3: Vordergrund ------------------------------------------- */
  foreground(level, cam) {
    const c = this.x, T = THEME_DEFS[level.data.theme] || THEME_DEFS.wald;
    level.decor.motes.forEach((m) => {
      const px = m.x - cam.x * 1.15, py = m.y - cam.y * 0.4 + Math.sin(this.t * 1.6 + m.p) * 6;
      if (px < -10 || px > CONFIG.game.W + 10) return;
      c.globalAlpha = 0.25 + 0.4 * (0.5 + 0.5 * Math.sin(this.t * 3 + m.p));
      c.fillStyle = T.night ? '#bdf5d0' : '#ffffff';
      c.fillRect(px, py, m.r > 1 ? 1.6 : 1, m.r > 1 ? 1.6 : 1);
      c.globalAlpha = 1;
    });
    if (T.night) { c.fillStyle = 'rgba(18,16,48,' + T.night + ')'; c.fillRect(0, 0, CONFIG.game.W, CONFIG.game.H); }
    const g = c.createLinearGradient(0, 0, 0, CONFIG.game.H);
    g.addColorStop(0, 'rgba(20,14,30,0.20)'); g.addColorStop(0.35, 'rgba(20,14,30,0)');
    g.addColorStop(0.82, 'rgba(20,14,30,0)'); g.addColorStop(1, 'rgba(20,14,30,0.28)');
    c.fillStyle = g; c.fillRect(0, 0, CONFIG.game.W, CONFIG.game.H);
  }
  world(level, cam, player, n, dt) {
    this.t += dt;
    this.background(level.data.theme, cam);
    this.clouds(level, cam);
    this.plane(level, cam, player, n, dt);
    this.foreground(level, cam);
  }

  /* --- Endlos-Bildschirm ---------------------------------------------- */
  endless(scene, n, dt) {
    this.t += dt;
    const c = this.x, cam = { x: 0, y: 0 };
    const T = THEME_DEFS[scene.data.theme] || THEME_DEFS.wald;
    this.background(scene.data.theme, cam);
    this.clouds(scene, cam);
    this.bridge(scene.bridge, n);
    scene.slabs.forEach((s) => this.ground(T, s));
    this.props(scene.decor.plane, cam);
    scene.houses.forEach((h) => {
      const gy = h.slabY, x = doorX(h);
      this.stand(IMG.door_closedMid, x, gy, TILE * 1.4);
      this.stand(IMG.door_closedTop, x, gy - TILE * 1.4, TILE * 1.4);
      this.stand(ASSETS.flag(h.key, this.t), x + 20, gy, TILE * 2.2);
      const col = (CHARS.find((ch) => ch.key === h.key) || CHARS[0]).color;
      c.globalAlpha = 0.9;
      this.roundRect(x - 9, gy - 44, 18, 9, 3); c.fillStyle = col; c.fill();
      c.globalAlpha = 1;
    });
    scene.runners.forEach((r) => {
      if (r.state === 'gone') return;
      if (r.state === 'dead' || r.state === 'home') c.globalAlpha = clamp(r.timer + 0.2, 0, 1);
      const bob = r.state === 'home' ? Math.sin(r.anim * 8) * 2 : 0;
      this.actor(r.frame(), r.x + 5, r.y + r.h + 1 - bob, CONFIG.art.playerH, r.tilt, 1);
      c.globalAlpha = 1;
    });
    scene.particles.forEach((p) => {
      c.globalAlpha = clamp(p.life / p.max, 0, 1);
      c.fillStyle = p.col; c.fillRect(p.x, p.y, p.size, p.size);
    });
    c.globalAlpha = 1;
    this.props(scene.decor.front || [], cam);
    this.liquid(T, { x: 0, y: END_WATER, w: CONFIG.game.W, h: CONFIG.game.H - END_WATER });
    this.spikes(T, { x: 0, y: 0, w: CONFIG.game.W, h: 28 });
    if (scene.flashT > 0 && scene.flash) {
      c.globalAlpha = clamp(scene.flashT, 0, 1);
      this.text(scene.flash.text, scene.flash.x, scene.flash.y - (1.2 - scene.flashT) * 10, 13, scene.flash.col, 'center');
      c.globalAlpha = 1;
    }
    this.foreground(scene, cam);
  }
}
/* ------------------- 16. SPIEL ----------------------------------------- */
const STATE = {
  MENU: 'MENU', CHAR_SELECT: 'CHAR_SELECT', MIC_SETUP: 'MIC_SETUP',
  LEVEL_SELECT: 'LEVEL_SELECT', READY: 'READY', PLAYING: 'PLAYING',
  PAUSED: 'PAUSED', DEAD: 'DEAD', SUCCESS: 'SUCCESS', GAME_COMPLETE: 'GAME_COMPLETE',
  SETTINGS: 'SETTINGS', ENDLESS: 'ENDLESS', ENDLESS_OVER: 'ENDLESS_OVER',
  NAME: 'NAME', RANKING: 'RANKING', ENDLESS_SETUP: 'ENDLESS_SETUP', CREDITS: 'CREDITS'
};
const WORLDS = [
  { key: 'wald', from: 0 }, { key: 'wueste', from: 4 }, { key: 'hoehle', from: 8 },
  { key: 'schnee', from: 12 }, { key: 'sumpf', from: 16 }
];

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;
    this.r = new Renderer(this.ctx);
    this.input = new InputManager(canvas);
    this.voice = new VoiceController();
    this.cam = new Camera();
    Save.load();
    this.charKey = Save.data.char || 'fuchs';
    this.player = new Player(this.charKey);
    this.level = null; this.levelIndex = 0; this.scene = null;
    this.state = STATE.MENU;
    this.acc = 0; this.last = performance.now();
    this.debug = false; this.fps = 60; this.menuT = 0;
    this.msg = ''; this.msgTimer = 0; this.readyT = 0; this.calib = null;
    this.nameBuf = ''; this.worldT = 0; this.diffKey = Save.data.diff || 'leicht';
    if (Save.data.settings) Snd.settings = Object.assign(Snd.settings, Save.data.settings);
    if (Save.data.calib) { this.voice.noiseFloor = Save.data.calib.n; this.voice.maximumReference = Save.data.calib.m; }
    if (Save.data.sensitivity) CONFIG.voice.sensitivity = Save.data.sensitivity;
    this.menuLevel = new Level(LEVELS[0]);
  }
  voiceLevel() { return Math.max(this.voice.active ? this.voice.getNormalizedVolume() : 0, this.input.fallbackLevel()); }
  say(t) { this.msg = t; this.msgTimer = 2.2; Snd.speak(t, t); }

  startLevel(i) {
    this.levelIndex = i;
    this.level = new Level(LEVELS[i]);
    this.player = new Player(this.charKey);
    this.player.reset(LEVELS[i].spawn.x, LEVELS[i].spawn.y);
    this.cam.snap(this.player, this.level);
    this.state = STATE.READY; this.readyT = 1.2;
    Snd.ensure();
  }
  startEndless(diffKey) {
    if (diffKey) { this.diffKey = diffKey; Save.data.diff = diffKey; Save.save(); }
    if (!this.diffKey) this.diffKey = Save.data.diff || 'leicht';
    const themes = Object.keys(THEME_DEFS);
    const i = ((Save.data.endlessTheme || 0) + 1) % themes.length;
    Save.data.endlessTheme = i; Save.save();
    this.scene = new EndlessScene(themes[i], this.diffKey);
    this.worldT = 2.6;
    this.state = STATE.ENDLESS;
    Snd.ensure();
  }
  respawn() {
    const cp = this.level.checkpoint, deaths = this.level.deaths, time = this.level.time;
    const taken = this.level.stars.map((s) => s.taken);
    this.level.reset();
    this.level.deaths = deaths; this.level.time = time; this.level.checkpoint = cp;
    this.level.stars.forEach((s, i) => { s.taken = taken[i]; });
    this.player.reset(cp || this.level.data.spawn.x, cp ? 180 : this.level.data.spawn.y);
    this.cam.snap(this.player, this.level);
    this.state = STATE.PLAYING;
  }
  kill(reason) {
    if (this.player.dead) return;
    this.player.dead = true; this.player.deadTimer = 0.85; this.player.vy = -110;
    this.level.deaths++; this.state = STATE.DEAD;
    Snd.play(reason === 'water' ? 'splash' : 'hit');
    this.level.burst(this.player.x + 5, this.player.y + 8, 10, reason === 'water' ? '#bfe8fb' : '#fff3d6', 10, 55);
    this.say('Noch mal!');
  }
  finish() {
    if (this.level.finished) return;
    this.level.finished = true; this.player.celebrate = true;
    Snd.play('level_complete'); this.say('Geschafft!');
    const total = this.level.stars.length, got = this.level.stars.filter((s) => s.taken).length;
    let stars = 1;
    if (total === 0) stars = this.level.deaths === 0 ? 3 : 2;
    else { if (got >= total) stars = 2; if (got >= total && this.level.deaths === 0) stars = 3; }
    Save.setStars(this.levelIndex + 1, stars);
    Save.setTime(this.levelIndex + 1, Math.round(this.level.time * 10) / 10);
    this.completeData = { stars: stars, got: got, total: total, time: this.level.time, deaths: this.level.deaths };
    setTimeout(() => {
      this.state = this.levelIndex + 1 >= LEVELS.length ? STATE.GAME_COMPLETE : STATE.SUCCESS;
    }, 1100);
  }

  loop(now) {
    let dt = (now - this.last) / 1000; this.last = now;
    if (dt > 0.25) dt = 0.25;
    this.fps = lerp(this.fps, 1 / Math.max(dt, 0.0001), 0.1);
    this.voice.update(dt); Snd.updateMusic(dt);
    if (this.msgTimer > 0) this.msgTimer -= dt;
    if (this.input.pressed('F1')) this.debug = !this.debug;
    if (this.state === STATE.PLAYING || this.state === STATE.DEAD) {
      this.acc += dt;
      let guard = 0;
      while (this.acc >= CONFIG.game.fixedStep && guard++ < 8) { this.step(CONFIG.game.fixedStep); this.acc -= CONFIG.game.fixedStep; }
    } else if (this.state === STATE.ENDLESS) {
      this.acc += dt;
      let guard = 0;
      while (this.acc >= CONFIG.game.fixedStep && guard++ < 8) {
        this.scene.update(CONFIG.game.fixedStep, this.voiceLevel());
        this.acc -= CONFIG.game.fixedStep;
      }
      if (this.scene.over) {
        if (this.scene.score > (Save.data.endlessBest || 0)) { Save.data.endlessBest = this.scene.score; Save.save(); }
        this.nameBuf = Save.data.lastTeam || '';
        this.state = STATE.NAME;
      }
    } else {
      this.acc = 0;
      if (this.level) this.level.bridges.forEach((b) => b.update(dt, this.state === STATE.READY ? this.voiceLevel() : 0));
    }
    this.draw(dt);
    this.input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }
  step(dt) {
    const lv = this.level, p = this.player, n = this.voiceLevel();
    lv.time += dt;
    lv.bridges.forEach((b) => b.update(dt, n));
    lv.updateParticles(dt);
    p.update(dt, lv, this);
    this.cam.follow(p, lv, dt);
    if (p.dead || p.celebrate) return;
    (lv.data.checkpoints || []).forEach((cx) => { if (p.x > cx && lv.checkpoint < cx) lv.checkpoint = cx; });
    lv.stars.forEach((s) => {
      if (s.taken) return;
      if (rectsOverlap(p.rect, { x: s.x, y: s.y, w: 12, h: 12 })) {
        s.taken = true; Snd.play('collect');
        lv.burst(s.x + 6, s.y + 6, 9, '#ffd447', 9, 55);
      }
    });
    for (const w of lv.water) if (rectsOverlap(p.rect, w)) { this.kill('water'); return; }
    for (const s of lv.spikes) if (rectsOverlap(p.rect, s)) { this.kill('spikes'); return; }
    if (p.y > CONFIG.game.deathY) { this.kill('fall'); return; }
    const g = lv.data.goal;
    if (rectsOverlap(p.rect, { x: g.x + 10, y: g.y + 12, w: 18, h: 28 })) { Snd.play('goal'); this.finish(); }
  }

  draw(dt) {
    const c = this.ctx;
    const S = CONFIG.game.scale;
    c.setTransform(S, 0, 0, S, 0, 0);
    c.imageSmoothingEnabled = true;
    c.clearRect(0, 0, CONFIG.game.W, CONFIG.game.H);
    switch (this.state) {
      case STATE.MENU: this.drawMenu(dt); break;
      case STATE.CHAR_SELECT: this.drawCharSelect(dt); break;
      case STATE.MIC_SETUP: this.drawMicSetup(dt); break;
      case STATE.LEVEL_SELECT: this.drawLevelSelect(dt); break;
      case STATE.READY: this.drawGame(dt); this.drawReady(dt); break;
      case STATE.PLAYING: case STATE.DEAD: this.drawGame(dt); break;
      case STATE.PAUSED: this.drawGame(dt); this.drawPause(); break;
      case STATE.SUCCESS: case STATE.GAME_COMPLETE: this.drawGame(dt); this.drawSuccess(); break;
      case STATE.SETTINGS: this.drawSettings(dt); break;
      case STATE.ENDLESS: this.drawEndless(dt); break;
      case STATE.ENDLESS_OVER: this.drawEndless(dt); this.drawEndlessOver(); break;
      case STATE.NAME: this.menuT += dt; this.drawName(dt); break;
      case STATE.RANKING: this.drawRanking(dt); break;
      case STATE.ENDLESS_SETUP: this.drawEndlessSetup(dt); break;
      case STATE.CREDITS: this.drawCredits(dt); break;
      default: break;
    }
    if (this.debug) this.drawDebug();
  }
  button(x, y, w, h, label, size) {
    const p = this.input.pointer;
    const hover = p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
    this.r.panel(x, y, w, h, hover);
    this.r.text(label, x + w / 2, y + h / 2 - (size || 11) / 2, size || 11, '#fff3d6', 'center');
    if (hover && p.clicked) { Snd.play('ui_click'); return true; }
    return false;
  }
  voiceBar(x, y, w) {
    const n = this.voiceLevel(), c = this.ctx;
    this.r.plate(x - 3, y - 3, w + 6, 18, 0.6);
    this.r.roundRect(x, y, w, 11, 4); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fill();
    const fw = Math.max(0, w * clamp(n, 0, 1));
    if (fw > 2) {
      this.r.roundRect(x, y, fw, 11, 4);
      c.fillStyle = n < 0.45 ? '#7ede4a' : n < 0.78 ? '#ffd447' : '#ff7a4c'; c.fill();
    }
    this.r.text(['STILL', 'LEISE', 'WUUU', 'LAUT!'][n < 0.1 ? 0 : n < 0.3 ? 1 : n < 0.65 ? 2 : 3],
      x + w + 8, y - 1, 11, '#ffffff');
  }
  starRow(x, y, got, total, scale) {
    const s = 11 * (scale || 1);
    for (let i = 0; i < total; i++) {
      this.ctx.globalAlpha = i < got ? 1 : 0.3;
      this.r.stand(IMG.star, x + i * (s + 3) + s / 2, y + s, s);
      this.ctx.globalAlpha = 1;
    }
  }
  drawGame(dt) {
    const lv = this.level, n = this.voiceLevel();
    this.r.world(lv, this.cam, this.player, n, dt);
    this.voiceBar(8, 8, 96);
    this.starRow(CONFIG.game.W - 52, 8, lv.stars.filter((s) => s.taken).length, lv.stars.length, 1);
    this.r.text(lv.data.name, CONFIG.game.W / 2, 8, 10, '#fff3d6', 'center');
    if (this.button(CONFIG.game.W - 32, 28, 26, 18, 'II', 10)) this.state = STATE.PAUSED;
    if (this.input.pressed('Escape') && this.state === STATE.PLAYING) this.state = STATE.PAUSED;
    if (this.input.pressed('KeyR') && this.state === STATE.PLAYING) this.respawn();
    if (this.msgTimer > 0) {
      this.ctx.globalAlpha = clamp(this.msgTimer, 0, 1);
      this.r.text(this.msg, CONFIG.game.W / 2, 206, 14, '#ffd447', 'center');
      this.ctx.globalAlpha = 1;
    }
  }
  drawReady(dt) {
    this.readyT -= dt;
    this.r.text('WUUUU!', CONFIG.game.W / 2, 96, 24, '#ffd447', 'center');
    this.r.plate(130, 122, 220, 18, 0.55);
    this.r.text('SPRICH: DIE BRÜCKE STEIGT', CONFIG.game.W / 2, 125, 10, '#fff3d6', 'center');
    if (this.readyT <= 0 || this.input.pointer.clicked) { this.state = STATE.PLAYING; this.level.time = 0; }
  }
  drawPause() {
    this.ctx.fillStyle = 'rgba(12,8,18,0.65)'; this.ctx.fillRect(0, 0, CONFIG.game.W, CONFIG.game.H);
    this.r.panel(140, 56, 200, 152);
    this.r.text('PAUSE', 240, 68, 16, '#ffd447', 'center');
    if (this.button(160, 94, 160, 26, 'WEITER')) this.state = STATE.PLAYING;
    if (this.button(160, 126, 160, 26, 'NEU STARTEN', 10)) this.startLevel(this.levelIndex);
    if (this.button(160, 158, 160, 26, 'LEVELAUSWAHL', 10)) this.state = STATE.LEVEL_SELECT;
    if (this.input.pressed('Escape')) this.state = STATE.PLAYING;
  }
  drawSuccess() {
    const d = this.completeData || { stars: 1, got: 0, total: 0, time: 0, deaths: 0 };
    const all = this.state === STATE.GAME_COMPLETE;
    this.ctx.fillStyle = 'rgba(12,8,18,0.6)'; this.ctx.fillRect(0, 0, CONFIG.game.W, CONFIG.game.H);
    this.r.panel(118, 40, 244, 180);
    this.r.text(all ? 'ALLE LEVEL GESCHAFFT!' : 'GESCHAFFT!', 240, 52, all ? 13 : 17, '#ffd447', 'center');
    this.starRow(240 - 39, 76, d.stars, 3, 2);
    this.r.text('Sterne ' + d.got + '/' + d.total + '   Stürze ' + d.deaths + '   ' + d.time.toFixed(1) + 's', 240, 112, 9, '#fff3d6', 'center');
    if (!all && this.button(150, 132, 180, 28, 'NÄCHSTES LEVEL', 11)) this.startLevel(Math.min(this.levelIndex + 1, LEVELS.length - 1));
    if (this.button(150, 166, 84, 24, 'NOCHMAL', 9)) this.startLevel(this.levelIndex);
    if (this.button(246, 166, 84, 24, 'KARTE', 9)) this.state = STATE.LEVEL_SELECT;
  }

  /* --- Endlos ---------------------------------------------------------- */
  drawEndless(dt) {
    const n = this.voiceLevel();
    this.r.endless(this.scene, n, dt);
    this.voiceBar(8, 8, 96);
    this.r.plate(170, 4, 140, 20, 0.5);
    this.r.text('PUNKTE ' + this.scene.score + '  ·  ' + this.scene.diff.name, 240, 7, 11, '#ffd447', 'center');
    // Leben als Reihe
    this.r.plate(352, 4, 124, 20, 0.5);
    for (let i = 0; i < 10; i++) {
      const on = i < this.scene.lives;
      this.ctx.globalAlpha = on ? 1 : 0.22;
      this.r.roundRect(357 + i * 11.6, 9, 9, 9, 2);
      this.ctx.fillStyle = on ? '#ff6a7a' : '#ffffff';
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
    }
    if (this.worldT > 0) {
      this.worldT -= dt;
      this.ctx.globalAlpha = clamp(this.worldT, 0, 1);
      const nm = (THEME_DEFS[this.scene.data.theme] || THEME_DEFS.wald).name;
      this.r.plate(130, 108, 220, 44, 0.62);
      this.r.text(nm, 240, 112, 16, '#ffffff', 'center');
      this.r.text(this.scene.diff.name + ' · bringe jede Figur zur gleichen Farbe', 240, 134, 9, '#ffd447', 'center');
      this.ctx.globalAlpha = 1;
    }
    if (this.state === STATE.ENDLESS && this.button(CONFIG.game.W - 30, 28, 26, 18, 'II', 10)) this.state = STATE.MENU;
  }
  drawEndlessOver() {
    this.ctx.fillStyle = 'rgba(20,16,32,0.6)'; this.ctx.fillRect(0, 0, CONFIG.game.W, CONFIG.game.H);
    this.r.panel(130, 60, 220, 140);
    this.r.text('RUNDE VORBEI', 240, 70, 15, '#ffd447', 'center');
    this.r.text('Punkte: ' + this.scene.score, 240, 96, 12, '#ffffff', 'center');
    this.r.text('Bestwert: ' + (Save.data.endlessBest || 0), 240, 114, 10, '#ffffff', 'center');
    if (this.button(160, 134, 160, 26, 'NOCHMAL', 11)) this.state = STATE.ENDLESS_SETUP;
    if (this.button(160, 166, 160, 26, 'MENÜ', 10)) this.state = STATE.MENU;
  }
  saveScore() {
    const name = (this.nameBuf || 'TEAM').trim().slice(0, 12) || 'TEAM';
    Save.data.lastTeam = name;
    const list = Save.data.ranking || [];
    list.push({ name: name, score: this.scene.score, diff: this.scene.diff.name, world: (THEME_DEFS[this.scene.data.theme] || THEME_DEFS.wald).name });
    list.sort((a, b) => b.score - a.score);
    Save.data.ranking = list.slice(0, 10);
    Save.save();
    this.state = STATE.RANKING;
  }
  drawName(dt) {
    this.r.endless(this.scene, 0, dt);
    this.ctx.fillStyle = 'rgba(20,16,32,0.72)'; this.ctx.fillRect(0, 0, CONFIG.game.W, CONFIG.game.H);
    this.r.text('RUNDE VORBEI', 240, 12, 15, '#ffd447', 'center');
    this.r.text('Punkte: ' + this.scene.score + '   Falsch zugeordnet: ' + this.scene.wrong, 240, 34, 10, '#ffffff', 'center');
    this.r.text('WIE HEISST EUER TEAM?', 240, 52, 12, '#ffffff', 'center');
    // Eingabefeld
    this.r.panel(140, 70, 200, 26);
    const caret = ((this.menuT * 2) | 0) % 2 ? '_' : ' ';
    this.r.text((this.nameBuf || '') + caret, 240, 76, 14, '#ffd447', 'center');
    // Tastatur
    this.input.typed.forEach((ch) => {
      if (ch === '\b') this.nameBuf = this.nameBuf.slice(0, -1);
      else if (ch === '\n') { if (this.nameBuf.trim()) this.saveScore(); }
      else if (/[A-Za-z0-9 \-]/.test(ch) && this.nameBuf.length < 12) this.nameBuf += ch.toUpperCase();
    });
    const rows = ['ABCDEFGHIJ', 'KLMNOPQRST', 'UVWXYZ0123', '456789 -'];
    rows.forEach((row, ri) => {
      for (let i = 0; i < row.length; i++) {
        const x = 44 + i * 40, y = 104 + ri * 30;
        if (this.button(x, y, 36, 26, row[i] === ' ' ? '␣' : row[i], 13) && this.nameBuf.length < 12) this.nameBuf += row[i];
      }
    });
    if (this.button(44, 226, 120, 28, 'LÖSCHEN', 10)) this.nameBuf = this.nameBuf.slice(0, -1);
    if (this.button(316, 226, 120, 28, 'FERTIG', 12) && this.nameBuf.trim()) this.saveScore();
  }
  drawEndlessSetup(dt) {
    this.menuBackdrop(dt);
    this.r.text('ENDLOS – WIE SCHWER?', 240, 14, 15, '#ffd447', 'center');
    const info = [
      'Höchstens 3 Figuren. Wer die Etage verfehlt,',
      'Höchstens 4 Figuren. Wer die Etage verfehlt,',
      'Bis zu 10 Figuren gleichzeitig unterwegs.',
      'Bis zu 25 Figuren gleichzeitig unterwegs.'
    ];
    const info2 = [
      'läuft zum Schacht zurück.',
      'läuft ins falsche Haus.',
      'Falsche Etage heißt falsches Haus.',
      'Falsche Etage heißt falsches Haus.'
    ];
    DIFFS.forEach((d, i) => {
      const y = 44 + i * 44;
      const sel = (this.diffKey || Save.data.diff || 'leicht') === d.key;
      if (this.button(60, y, 150, 34, d.name, 14)) { this.diffKey = d.key; Save.data.diff = d.key; Save.save(); }
      if (sel) { this.ctx.strokeStyle = '#ffd447'; this.ctx.lineWidth = 2; this.r.roundRect(60, y, 150, 34, 5); this.ctx.stroke(); }
      this.r.plate(220, y + 2, 200, 30, 0.5);
      this.r.text(info[i], 226, y + 6, 9, '#ffffff');
      if (info2[i]) this.r.text(info2[i], 226, y + 18, 9, '#ffffff');
    });
    if (this.button(60, 228, 150, 30, 'LOS GEHT’S', 13)) {
      if (!Save.data.calib) this.beginCalibration(); else this.startEndless(this.diffKey || 'leicht');
    }
    if (this.button(340, 228, 100, 30, 'MENÜ', 11)) this.state = STATE.MENU;
  }
  drawCredits(dt) {
    this.menuBackdrop(dt);
    this.r.text('CREDITS', 240, 14, 16, '#ffd447', 'center');
    this.r.plate(40, 42, 400, 176, 0.62);
    const L = [
      ['GRAFIK', 16, '#ffd447'],
      ['Platformer Graphics (Deluxe)', 12, '#ffffff'],
      ['von Kenney Vleugels – kenney.nl', 12, '#ffffff'],
      ['Lizenz: CC0 (Public Domain)', 10, '#e8dcc4'],
      ['Nutzung frei, auch kommerziell.', 10, '#e8dcc4'],
      ['', 6, '#ffffff'],
      ['MUSIK UND GERÄUSCHE', 12, '#ffd447'],
      ['als Chiptune im Spiel erzeugt', 10, '#ffffff'],
      ['SPRACHANSAGEN', 12, '#ffd447'],
      ['Sprachausgabe des Browsers', 10, '#ffffff']
    ];
    let y = 52;
    L.forEach((l) => { if (l[0]) this.r.text(l[0], 240, y, l[1], l[2], 'center'); y += l[1] + 5; });
    // Kenney-Figuren als kleine Galerie
    CHARS.forEach((c, i) => this.r.stand(ASSETS.frames(c.key).idle[0], 150 + i * 60, 214, 34));
    if (this.button(8, 238, 90, 24, 'MENÜ', 10)) this.state = STATE.MENU;
  }
  drawRanking(dt) {
    this.menuBackdrop(dt);
    this.r.text('RANGLISTE ENDLOS', 240, 12, 15, '#ffd447', 'center');
    const list = Save.data.ranking || [];
    if (!list.length) this.r.text('Noch keine Einträge – spiel eine Runde Endlos!', 240, 110, 11, '#ffffff', 'center');
    list.slice(0, 8).forEach((e, i) => {
      const y = 40 + i * 24;
      this.r.plate(70, y, 340, 22, 0.55);
      this.r.text(String(i + 1) + '.', 84, y + 4, 12, '#ffd447');
      this.r.text(e.name, 112, y + 4, 12, '#ffffff');
      this.r.text((e.diff || '') + (e.world ? ' · ' + e.world : ''), 232, y + 6, 9, '#e8dcc4');
      this.r.text(String(e.score), 396, y + 4, 12, '#ffd447', 'right');
    });
    if (this.button(8, 240, 90, 22, 'MENÜ', 10)) this.state = STATE.MENU;
    if (this.button(370, 240, 100, 22, 'NOCHMAL', 10)) this.state = STATE.ENDLESS_SETUP;
  }

  /* --- Menues ---  /* --- Menues ----------------------------------------------------------- */
  menuBackdrop(dt) {
    this.menuT += dt;
    const lv = this.menuLevel;
    lv.bridges.forEach((b) => b.update(dt, this.voiceLevel()));
    const cam = { x: 120, y: 0 };
    const dummy = { charKey: this.charKey, x: -999, y: 0, w: 10, h: 15, frame: () => ASSETS.frames(this.charKey).idle[0] };
    this.r.t += dt;
    this.r.background(lv.data.theme, cam);
    this.r.clouds(lv, cam);
    this.r.plane(lv, cam, dummy, this.voiceLevel(), dt);
    this.r.foreground(lv, cam);
    this.ctx.fillStyle = 'rgba(12,8,18,0.32)'; this.ctx.fillRect(0, 0, CONFIG.game.W, CONFIG.game.H);
  }
  drawMenu(dt) {
    this.menuBackdrop(dt);
    const bob = Math.sin(this.menuT * 2) * 3;
    this.r.text('WUUUU!', 240, 18 + bob, 40, '#ffd447', 'center');
    this.r.plate(96, 60, 288, 18, 0.55);
    this.r.text('Sprich: die Brücke steigt. Schweig: sie fällt.', 240, 63, 10, '#fff3d6', 'center');
    const f = ASSETS.frames(this.charKey).run;
    this.r.stand(f[((this.menuT * 14) | 0) % f.length], 64, 214 + bob, 46);
    if (this.button(166, 84, 148, 28, 'ABENTEUER', 13)) {
      if (!Save.data.char) this.state = STATE.CHAR_SELECT;
      else if (!Save.data.calib) this.beginCalibration();
      else this.state = STATE.LEVEL_SELECT;
    }
    if (this.button(166, 116, 148, 26, 'ENDLOS', 12)) this.state = STATE.ENDLESS_SETUP;
    if (this.button(166, 144, 148, 22, 'FIGUR WÄHLEN', 9)) this.state = STATE.CHAR_SELECT;
    if (this.button(166, 168, 148, 22, 'RANGLISTE', 9)) this.state = STATE.RANKING;
    if (this.button(166, 192, 148, 22, 'EINSTELLUNGEN', 9)) this.state = STATE.SETTINGS;
    this.r.plate(150, 216, 180, 16, 0.5);
    this.r.text('ENDLOS-BESTWERT ' + (Save.data.endlessBest || 0), 240, 218, 10, '#ffd447', 'center');
    if (this.button(336, 238, 136, 22, 'GRAFIK: KENNEY.NL', 9)) this.state = STATE.CREDITS;
    this.voiceBar(8, 244, 96);
    this.r.text('Sterne ' + Save.totalStars() + '/' + LEVELS.length * 3, 472, 8, 9, '#fff3d6', 'right');
  }
  drawCharSelect(dt) {
    this.menuBackdrop(dt);
    this.r.text('WER SOLL LAUFEN?', 240, 14, 14, '#ffd447', 'center');
    CHARS.forEach((c, i) => {
      const x = 20 + i * 115, y = 48, w = 104, h = 148;
      const p = this.input.pointer;
      const hover = p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
      const sel = this.charKey === c.key;
      this.r.panel(x, y, w, h, hover || sel);
      if (sel) { this.ctx.fillStyle = 'rgba(255,212,71,0.22)'; this.ctx.fillRect(x + 2, y + 2, w - 4, h - 4); }
      const set = (hover || sel) ? ASSETS.frames(c.key).run : ASSETS.frames(c.key).idle;
      const img = set[((this.menuT * (hover || sel ? 14 : 4)) | 0) % set.length];
      this.r.stand(img, x + w / 2, y + 64 + Math.sin(this.menuT * 3 + i) * 2, 52);
      this.r.plate(x + 6, y + 68, w - 12, 40, 0.5);
      this.r.text(c.name, x + w / 2, y + 70, 15, '#ffd447', 'center');
      this.r.text(c.blurb, x + w / 2, y + 90, 9, '#fff3d6', 'center');
      this.ctx.fillStyle = c.house; this.ctx.fillRect(x + w / 2 - 18, y + 114, 36, 5);
      this.r.text('EIGENE TÜR', x + w / 2, y + 124, 9, '#e8dcc4', 'center');
      if (hover && p.clicked) {
        Snd.play('ui_click'); this.charKey = c.key; this.player = new Player(c.key);
        Save.data.char = c.key; Save.save();
      }
    });
    if (this.button(170, 206, 140, 28, 'WEITER', 12)) {
      if (!Save.data.calib) this.beginCalibration(); else this.state = STATE.LEVEL_SELECT;
    }
    if (this.button(8, 240, 70, 22, 'MENÜ', 9)) this.state = STATE.MENU;
  }
  beginCalibration() {
    this.state = STATE.MIC_SETUP;
    this.calib = { step: 0, timer: 0, samples: [], failed: false };
    Snd.ensure();
    this.voice.start().then((ok) => {
      if (!ok) this.calib.failed = true;
      else { this.calib.step = 1; this.calib.timer = 2.2; this.say('Sei kurz ganz still.'); }
    });
  }
  drawMicSetup(dt) {
    this.menuBackdrop(dt);
    const cal = this.calib;
    this.r.panel(58, 44, 364, 180);
    this.r.text('MIKROFON EINSTELLEN', 240, 54, 13, '#ffd447', 'center');
    this.voiceBar(180, 192, 96);
    if (cal.failed) {
      this.r.text('Ich kann dein Mikrofon nicht hören.', 240, 82, 10, '#fff3d6', 'center');
      if (this.button(84, 104, 150, 28, 'MIKRO ERLAUBEN', 9)) this.beginCalibration();
      if (this.button(246, 104, 150, 28, 'OHNE MIKRO SPIELEN', 8)) this.state = STATE.LEVEL_SELECT;
      this.r.text('ERSATZ: FINGER HALTEN ODER LEERTASTE', 240, 146, 9, '#e8dcc4', 'center');
      return;
    }
    if (cal.step === 1 || cal.step === 2) {
      cal.timer -= dt;
      if (cal.timer < 1.6) cal.samples.push(this.voice.raw);
      this.r.text(cal.step === 1 ? 'Sei kurz ganz still …' : 'Jetzt dein lautestes WUUUU!', 240, 86, 12, '#fff3d6', 'center');
      const p = clamp(1 - cal.timer / 2.2, 0, 1);
      this.r.panel(120, 114, 240, 18);
      this.ctx.fillStyle = '#7fe06a'; this.ctx.fillRect(123, 117, 234 * p, 12);
      if (cal.timer <= 0) {
        const arr = cal.samples.slice().sort((a, b) => a - b);
        const val = arr.length ? arr[Math.floor(arr.length * (cal.step === 1 ? 0.8 : 0.75))] : 0;
        if (cal.step === 1) {
          this.voice.noiseFloor = clamp(val + 0.006, 0.006, 0.12);
          cal.step = 2; cal.timer = 2.2; cal.samples = [];
          this.say('Jetzt mach dein lautestes Wuuu!');
        } else {
          this.voice.maximumReference = Math.max(this.voice.noiseFloor + 0.04, val * 0.85);
          Save.data.calib = { n: this.voice.noiseFloor, m: this.voice.maximumReference };
          Save.save(); cal.step = 3;
        }
      }
    } else if (cal.step === 3) {
      this.r.text('FERTIG!', 240, 82, 18, '#ffd447', 'center');
      this.r.text(['STILL', 'LEISES WUUU', 'WUUU', 'LAUTES WUUU!'][this.voice.band()], 240, 116, 13, '#ffd447', 'center');
      if (this.button(160, 150, 160, 28, 'LOS GEHT’S', 11)) this.state = STATE.LEVEL_SELECT;
    } else {
      this.r.text('Mikrofon wird gestartet …', 240, 100, 11, '#fff3d6', 'center');
      if (this.button(160, 150, 160, 28, 'ÜBERSPRINGEN', 10)) this.state = STATE.LEVEL_SELECT;
    }
  }
  drawLevelSelect(dt) {
    this.menuBackdrop(dt);
    this.r.text('ABENTEUER', 240, 6, 13, '#ffd447', 'center');
    WORLDS.forEach((wld, wi) => {
      const y = 26 + wi * 46;
      const T = THEME_DEFS[wld.key];
      this.r.plate(6, y + 2, 138, 32, 0.5);
      this.ctx.fillStyle = T.band; this.ctx.fillRect(8, y + 4, 5, 28);
      this.r.text(T.name, 18, y + 10, 10, '#fff3d6');
      for (let k = 0; k < 4; k++) {
        const i = wld.from + k, x = 150 + k * 78;
        const unlocked = i < Save.data.unlocked;
        const stars = Save.data.stars[i + 1] || 0;
        const p = this.input.pointer;
        const hover = unlocked && p.x >= x && p.x <= x + 70 && p.y >= y && p.y <= y + 34;
        this.r.panel(x, y, 70, 34, hover);
        this.ctx.globalAlpha = unlocked ? 1 : 0.4;
        this.r.text(String(i + 1), x + 8, y + 9, 14, '#ffd447');
        this.r.text(unlocked ? LEVELS[i].name.slice(0, 9) : 'ZU', x + 24, y + 5, 9, '#fff3d6');
        this.ctx.globalAlpha = 1;
        if (unlocked) this.starRow(x + 26, y + 18, stars, 3, 1);
        if (hover && p.clicked) { Snd.play('ui_click'); this.startLevel(i); }
      }
    });
    if (this.button(8, 240, 80, 22, 'MENÜ', 9)) this.state = STATE.MENU;
    if (this.button(392, 240, 80, 22, 'ENDLOS', 9)) this.state = STATE.ENDLESS_SETUP;
  }
  drawSettings(dt) {
    this.menuBackdrop(dt);
    this.r.text('EINSTELLUNGEN', 240, 12, 13, '#ffd447', 'center');
    const S = Snd.settings;
    const row = (y, label, value, minus, plus) => {
      this.r.text(label, 40, y + 5, 10, '#fff3d6');
      this.r.text(value, 300, y + 5, 10, '#ffd447', 'right');
      if (this.button(312, y, 24, 18, '-', 11)) minus();
      if (this.button(340, y, 24, 18, '+', 11)) plus();
    };
    row(38, 'Empfindlichkeit', String(Math.round(CONFIG.voice.sensitivity * 64)),
      () => this.voice.setSensitivity(CONFIG.voice.sensitivity - 0.1),
      () => this.voice.setSensitivity(CONFIG.voice.sensitivity + 0.1));
    row(62, 'Musik', S.music ? 'an' : 'aus', () => { S.music = !S.music; }, () => { S.music = !S.music; });
    row(86, 'Geräusche', S.sfx ? 'an' : 'aus', () => { S.sfx = !S.sfx; }, () => { S.sfx = !S.sfx; });
    row(110, 'Sprachansagen', S.speech ? 'an' : 'aus', () => { S.speech = !S.speech; }, () => { S.speech = !S.speech; });
    row(134, 'Lautstärke', Math.round(S.volume * 100) + '%',
      () => { S.volume = clamp(S.volume - 0.1, 0, 1); if (Snd.master) Snd.master.gain.value = S.volume; },
      () => { S.volume = clamp(S.volume + 0.1, 0, 1); if (Snd.master) Snd.master.gain.value = S.volume; });
    row(158, 'Figur', CHARS.find((c) => c.key === this.charKey).name,
      () => { const i = CHARS.findIndex((c) => c.key === this.charKey); this.charKey = CHARS[(i + CHARS.length - 1) % CHARS.length].key; this.player = new Player(this.charKey); Save.data.char = this.charKey; Save.save(); },
      () => { const i = CHARS.findIndex((c) => c.key === this.charKey); this.charKey = CHARS[(i + 1) % CHARS.length].key; this.player = new Player(this.charKey); Save.data.char = this.charKey; Save.save(); });
    this.r.text('Mikrofon testen:', 40, 188, 9, '#fff3d6');
    this.voiceBar(150, 186, 96);
    if (this.button(300, 182, 80, 22, 'NEU MESSEN', 8)) this.beginCalibration();
    if (this.button(386, 182, 86, 22, this.voice.active ? 'MIKRO LÄUFT' : 'MIKRO AN', 8)) { Snd.ensure(); this.voice.start(); }
    if (this.button(100, 240, 90, 22, 'CREDITS', 10)) this.state = STATE.CREDITS;
    if (this.button(8, 240, 80, 22, 'ZURÜCK', 9)) {
      Save.data.settings = Snd.settings; Save.data.sensitivity = CONFIG.voice.sensitivity; Save.save();
      this.state = STATE.MENU;
    }
    this.r.text('F1 DEBUG · R NEUSTART · ESC PAUSE · LEERTASTE = STIMME', 240, 254, 9, '#e8dcc4', 'center');
  }
  drawDebug() {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,0,0,0.65)'; c.fillRect(0, 0, 158, 112);
    const L = ['FPS ' + this.fps.toFixed(0), 'rawVolume ' + this.voice.raw.toFixed(4),
      'noiseFloor ' + this.voice.noiseFloor.toFixed(4), 'maxRef ' + this.voice.maximumReference.toFixed(4),
      'normalized ' + this.voice.normalized.toFixed(3), 'sens ' + Math.round(CONFIG.voice.sensitivity * 64),
      'player ' + (this.player.x | 0) + ',' + (this.player.y | 0), 'state ' + this.state];
    if (this.level && this.level.bridges[0]) L.push('bridge1 y' + this.level.bridges[0].y.toFixed(0) + ' ziel' + this.level.bridges[0].crossY);
    L.forEach((s, i) => this.r.text(s, 4, 3 + i * 11, 8, '#9fff9f', 'left', false));
    if (this.button(4, 114, 30, 16, '-s', 9)) this.voice.setSensitivity(CONFIG.voice.sensitivity - 0.1);
    if (this.button(38, 114, 30, 16, '+s', 9)) this.voice.setSensitivity(CONFIG.voice.sensitivity + 0.1);
  }
}

/* ------------------- 17. SELBSTTEST ------------------------------------- */
function runSelfTest(game) {
  const res = [];
  const ok = (n, c) => { res.push((c ? 'OK   ' : 'FEHLT') + ' \u00b7 ' + n); return c; };
  ok('Canvas + Kontext', !!game.ctx);
  const missing = MANIFEST.filter((k) => !IMG[k] || !IMG[k].width);
  ok('Alle ' + MANIFEST.length + ' Grafiken geladen' + (missing.length ? ' (fehlt: ' + missing.slice(0, 4).join(', ') + ')' : ''), missing.length === 0);
  ok('Drei Figuren mit Laufzyklus', CHARS.every((c) => ASSETS.frames(c.key).run.length === 11));
  ok('Sechs Umgebungen', Object.keys(THEME_DEFS).length === 6);
  ok('Level geladen', LEVELS.length >= 20);
  let valid = true, themes = {};
  LEVELS.forEach((l) => {
    if (!l.spawn || !l.goal || !l.ground.length || !l.bridges.length) valid = false;
    if (!THEME_DEFS[l.theme]) valid = false;
    themes[l.theme] = true;
    l.bridges.forEach((b) => {
      if (b.n < 0.15 || b.n > 0.9 || b.high < 30) valid = false;
      const gin = l.ground.find((g) => Math.abs(g.x + g.w - (b.x - 18)) < 1);
      if (!gin || gin.y !== b.crossY) valid = false;
    });
  });
  ok('Levelstruktur gültig', valid);
  ok('Fünf Umgebungen im Abenteuer, sechste im Endlosmodus', Object.keys(themes).length === 5);
  ok('Endlos-Modus aufgebaut', (function () {
    const s = new EndlessScene('wald');
    return s.slabs.length === 8 && s.houses.length === CHARS.length && !!s.bridge;
  })());
  ok('VoiceController-API', ['start', 'stop', 'getRawVolume', 'getNormalizedVolume', 'isSpeaking', 'setSensitivity', 'setNoiseGate'].every((m) => typeof game.voice[m] === 'function'));
  ok('Mikrofon verfügbar', game.voice.supported);
  ok('Ersatzsteuerung (Touch/Leertaste)', typeof game.input.fallbackLevel === 'function');
  ok('Speichern möglich', (function () { try { localStorage.setItem('t', '1'); localStorage.removeItem('t'); return true; } catch (e) { return false; } })());
  console.log('%cWUUUU! Selbsttest', 'font-weight:bold');
  res.forEach((r) => console.log(r));
  return res;
}

/* ------------------- 18. BOOT -------------------------------------------- */
(function boot() {
  const canvas = document.getElementById('game');
  const S = CONFIG.game.scale;
  canvas.width = CONFIG.game.W * S; canvas.height = CONFIG.game.H * S;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
  ctx.setTransform(S, 0, 0, S, 0, 0);

  function resize() {
    const scale = Math.min(innerWidth / CONFIG.game.W, innerHeight / CONFIG.game.H);
    canvas.style.width = Math.floor(CONFIG.game.W * scale) + 'px';
    canvas.style.height = Math.floor(CONFIG.game.H * scale) + 'px';
    const rot = document.getElementById('rotate');
    if (rot) rot.style.display = (innerHeight > innerWidth * 1.25) ? 'flex' : 'none';
  }
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();

  function loadingScreen(done, total) {
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.fillStyle = '#1d2436'; ctx.fillRect(0, 0, CONFIG.game.W, CONFIG.game.H);
    ctx.font = 'bold 22px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd447'; ctx.fillText('WUUUU!', 240, 110);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(150, 140, 180, 10);
    ctx.fillStyle = '#7ede4a'; ctx.fillRect(150, 140, 180 * (done / total), 10);
    ctx.font = 'bold 10px "Trebuchet MS", sans-serif'; ctx.fillStyle = '#ffffff';
    ctx.fillText('Grafiken werden geladen \u2026 ' + done + '/' + total, 240, 160);
  }
  loadingScreen(0, MANIFEST.length);
  loadImages(loadingScreen, () => {
    const game = new Game(canvas);
    window.WUUU = { game: game, CONFIG: CONFIG, LEVELS: LEVELS, IMG: IMG, CHARS: CHARS, THEMES: THEME_DEFS, selfTest: () => runSelfTest(game) };
    const unlock = () => Snd.ensure();
    addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
    runSelfTest(game);
    requestAnimationFrame((t) => { game.last = t; game.loop(t); });
  });
})();
