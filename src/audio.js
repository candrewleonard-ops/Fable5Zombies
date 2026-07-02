// Fully procedural WebAudio sound engine — zero audio assets.

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.started = false;
  }

  ensure() {
    if (this.ctx) return true;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this._noiseBuf = this._makeNoise(2);
    } catch { return false; }
    return true;
  }

  start() {
    if (!this.ensure()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.started) {
      this.started = true;
      this._ambient();
    }
  }

  _makeNoise(seconds) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _env(gainNode, t0, attack, peak, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(peak, t0 + attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  _noiseBurst({ peak = 0.5, decay = 0.15, filterType = 'lowpass', freq = 900, q = 0.8, rate = 1 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.playbackRate.value = rate;
    const filt = this.ctx.createBiquadFilter();
    filt.type = filterType; filt.frequency.value = freq; filt.Q.value = q;
    const g = this.ctx.createGain();
    this._env(g, t, 0.004, peak, decay);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t); src.stop(t + decay + 0.1);
  }

  _tone({ type = 'sine', from = 400, to = 100, dur = 0.2, peak = 0.3, delay = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    const g = this.ctx.createGain();
    this._env(g, t, 0.005, peak, dur);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.1);
  }

  // ---- one-shots ----
  shoot(kind) {
    if (!this.ctx) return;
    switch (kind) {
      case 'pistol':
        this._noiseBurst({ peak: 0.55, decay: 0.12, freq: 1400 });
        this._tone({ type: 'square', from: 220, to: 60, dur: 0.09, peak: 0.25 });
        break;
      case 'rifle':
        this._noiseBurst({ peak: 0.85, decay: 0.3, freq: 900 });
        this._tone({ type: 'sawtooth', from: 160, to: 40, dur: 0.26, peak: 0.4 });
        this._noiseBurst({ peak: 0.18, decay: 0.6, freq: 260, filterType: 'bandpass' });
        break;
      case 'smg':
        this._noiseBurst({ peak: 0.4, decay: 0.08, freq: 1800 });
        this._tone({ type: 'square', from: 260, to: 90, dur: 0.06, peak: 0.18 });
        break;
      case 'mg':
        this._noiseBurst({ peak: 0.5, decay: 0.09, freq: 1200 });
        this._tone({ type: 'sawtooth', from: 200, to: 70, dur: 0.07, peak: 0.22 });
        break;
      case 'stg':
        this._noiseBurst({ peak: 0.45, decay: 0.1, freq: 1500 });
        this._tone({ type: 'square', from: 230, to: 75, dur: 0.08, peak: 0.2 });
        break;
      case 'shotgun':
        this._noiseBurst({ peak: 0.8, decay: 0.3, freq: 700, q: 0.5 });
        this._tone({ type: 'sawtooth', from: 130, to: 35, dur: 0.25, peak: 0.4 });
        break;
      case 'laser':
        this._tone({ type: 'sawtooth', from: 1800, to: 300, dur: 0.18, peak: 0.3 });
        this._tone({ type: 'sine', from: 2600, to: 900, dur: 0.14, peak: 0.2 });
        break;
      case 'arc':
        this._noiseBurst({ peak: 0.4, decay: 0.25, freq: 2600, filterType: 'highpass' });
        this._tone({ type: 'sawtooth', from: 90, to: 400, dur: 0.2, peak: 0.3 });
        break;
      case 'raygun':
        this._tone({ type: 'square', from: 1200, to: 180, dur: 0.16, peak: 0.28 });
        this._tone({ type: 'sine', from: 2400, to: 500, dur: 0.12, peak: 0.18, delay: 0.01 });
        break;
      case 'revolver':
        this._noiseBurst({ peak: 0.75, decay: 0.28, freq: 1000 });
        this._tone({ type: 'sawtooth', from: 170, to: 40, dur: 0.22, peak: 0.4 });
        break;
    }
  }

  bolt() {
    this._tone({ type: 'square', from: 900, to: 600, dur: 0.05, peak: 0.14 });
    this._tone({ type: 'square', from: 600, to: 850, dur: 0.05, peak: 0.14, delay: 0.12 });
  }

  boardRip() {
    this._noiseBurst({ peak: 0.5, decay: 0.22, freq: 900, filterType: 'bandpass', q: 1.2 });
    this._tone({ type: 'sawtooth', from: 120, to: 60, dur: 0.18, peak: 0.22 });
  }

  boardAdd() {
    this._noiseBurst({ peak: 0.35, decay: 0.08, freq: 700 });
    this._tone({ type: 'square', from: 300, to: 180, dur: 0.07, peak: 0.2, delay: 0.05 });
  }

  vaultThud() { this._noiseBurst({ peak: 0.4, decay: 0.18, freq: 300 }); }

  attackSnarl(vol = 0.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.3);
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 700; filt.Q.value = 6;
    const g = this.ctx.createGain();
    this._env(g, t, 0.02, Math.min(0.4, vol * 0.4), 0.3);
    osc.connect(filt).connect(g).connect(this.master);
    osc.start(t); osc.stop(t + 0.4);
  }

  buy() {
    this._tone({ type: 'sine', from: 660, to: 660, dur: 0.09, peak: 0.16 });
    this._tone({ type: 'sine', from: 990, to: 990, dur: 0.12, peak: 0.16, delay: 0.09 });
  }

  deny() {
    this._tone({ type: 'square', from: 220, to: 180, dur: 0.12, peak: 0.16 });
    this._tone({ type: 'square', from: 180, to: 140, dur: 0.16, peak: 0.16, delay: 0.13 });
  }

  doorOpen() {
    this._noiseBurst({ peak: 0.4, decay: 0.5, freq: 400, q: 0.6 });
    this._tone({ type: 'sawtooth', from: 80, to: 45, dur: 0.5, peak: 0.2 });
  }

  perkJingle() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => this._tone({ type: 'sine', from: f, to: f, dur: 0.16, peak: 0.15, delay: i * 0.12 }));
  }

  boxJingle() {
    const notes = [392, 494, 587, 494, 659];
    notes.forEach((f, i) => this._tone({ type: 'triangle', from: f, to: f, dur: 0.2, peak: 0.13, delay: i * 0.15 }));
  }

  teddy() {
    const notes = [880, 1046, 880, 698];
    notes.forEach((f, i) => this._tone({ type: 'sine', from: f, to: f * 0.98, dur: 0.22, peak: 0.14, delay: i * 0.18 }));
  }

  roundStart() {
    this._tone({ type: 'sawtooth', from: 98, to: 92, dur: 1.6, peak: 0.35 });
    this._tone({ type: 'sawtooth', from: 147, to: 138, dur: 1.6, peak: 0.2 });
    this._tone({ type: 'sine', from: 49, to: 46, dur: 2.0, peak: 0.3 });
  }

  roundEnd() {
    this._tone({ type: 'sine', from: 392, to: 392, dur: 0.3, peak: 0.14 });
    this._tone({ type: 'sine', from: 523, to: 523, dur: 0.45, peak: 0.14, delay: 0.25 });
  }

  papHum() {
    this._tone({ type: 'sawtooth', from: 55, to: 65, dur: 3.2, peak: 0.16 });
    this._tone({ type: 'sine', from: 110, to: 130, dur: 3.2, peak: 0.1, delay: 0.2 });
  }

  papDing() {
    this._tone({ type: 'sine', from: 1318, to: 1318, dur: 0.4, peak: 0.16 });
    this._tone({ type: 'sine', from: 1976, to: 1976, dur: 0.5, peak: 0.1, delay: 0.1 });
  }

  zap() {
    this._noiseBurst({ peak: 0.35, decay: 0.12, freq: 3200, filterType: 'highpass' });
    this._tone({ type: 'sawtooth', from: 1600 + Math.random() * 800, to: 200, dur: 0.1, peak: 0.18 });
  }

  craftTick() { this._tone({ type: 'square', from: 1400, to: 1200, dur: 0.03, peak: 0.1 }); }

  explosion() {
    this._noiseBurst({ peak: 0.9, decay: 0.6, freq: 500, q: 0.4 });
    this._tone({ type: 'sine', from: 90, to: 30, dur: 0.55, peak: 0.5 });
  }

  jet() { this._noiseBurst({ peak: 0.12, decay: 0.14, freq: 900, filterType: 'bandpass', q: 0.7 }); }

  dryFire() { this._tone({ type: 'square', from: 900, to: 700, dur: 0.03, peak: 0.12 }); }

  reload() {
    this._tone({ type: 'square', from: 1200, to: 800, dur: 0.04, peak: 0.1 });
    this._tone({ type: 'square', from: 700, to: 500, dur: 0.05, peak: 0.12, delay: 0.16 });
    this._tone({ type: 'square', from: 1500, to: 900, dur: 0.04, peak: 0.14, delay: 0.34 });
  }

  hit() { this._noiseBurst({ peak: 0.3, decay: 0.07, freq: 500, filterType: 'bandpass', q: 2 }); }

  headshot() {
    this._noiseBurst({ peak: 0.45, decay: 0.1, freq: 2400, filterType: 'bandpass', q: 3 });
    this._tone({ type: 'sine', from: 1400, to: 1900, dur: 0.07, peak: 0.2 });
  }

  kill() { this._tone({ type: 'sine', from: 700, to: 1050, dur: 0.1, peak: 0.16 }); }

  zombieGroan(dist = 10, big = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = (big ? 55 : 85) + Math.random() * 40;
    const vol = Math.min(0.35, 3.5 / Math.max(3, dist)) * (big ? 1.5 : 1);
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.linearRampToValueAtTime(base * (0.7 + Math.random() * 0.25), t + 0.7);
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 400; filt.Q.value = 4;
    // wobble the filter like a throat
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 5 + Math.random() * 5;
    const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 150;
    lfo.connect(lfoGain).connect(filt.frequency);
    const g = this.ctx.createGain();
    this._env(g, t, 0.12, vol, 0.8);
    osc.connect(filt).connect(g).connect(this.master);
    osc.start(t); lfo.start(t);
    osc.stop(t + 1.1); lfo.stop(t + 1.1);
  }

  zombieBite() {
    this._noiseBurst({ peak: 0.5, decay: 0.12, freq: 350, filterType: 'bandpass', q: 1.5 });
    this._tone({ type: 'sawtooth', from: 200, to: 60, dur: 0.15, peak: 0.3 });
  }

  playerHurt() {
    this._tone({ type: 'sawtooth', from: 300, to: 90, dur: 0.25, peak: 0.35 });
    this._noiseBurst({ peak: 0.25, decay: 0.2, freq: 600 });
  }

  pickup() {
    this._tone({ type: 'sine', from: 620, to: 880, dur: 0.08, peak: 0.18 });
    this._tone({ type: 'sine', from: 880, to: 1240, dur: 0.1, peak: 0.15, delay: 0.07 });
  }

  equip() { this._noiseBurst({ peak: 0.25, decay: 0.12, freq: 2000, filterType: 'highpass' }); }

  heal() {
    this._tone({ type: 'sine', from: 500, to: 900, dur: 0.3, peak: 0.15 });
    this._tone({ type: 'sine', from: 750, to: 1350, dur: 0.3, peak: 0.1, delay: 0.1 });
  }

  waveHorn(blood = false) {
    if (!this.ctx) return;
    const f = blood ? 66 : 98;
    this._tone({ type: 'sawtooth', from: f, to: f * 0.94, dur: 1.6, peak: 0.35 });
    this._tone({ type: 'sawtooth', from: f * 1.5, to: f * 1.41, dur: 1.6, peak: 0.2 });
    this._tone({ type: 'sine', from: f * 0.5, to: f * 0.47, dur: 2.0, peak: 0.3 });
  }

  slowmo(on) {
    this._tone(on
      ? { type: 'sine', from: 800, to: 120, dur: 0.5, peak: 0.2 }
      : { type: 'sine', from: 120, to: 800, dur: 0.35, peak: 0.15 });
  }

  footstep() { this._noiseBurst({ peak: 0.07, decay: 0.05, freq: 300 }); }

  jump() { this._noiseBurst({ peak: 0.1, decay: 0.08, freq: 450 }); }
  land() { this._noiseBurst({ peak: 0.2, decay: 0.1, freq: 250 }); }

  // ---- ambient bed: wind + low drone, loops forever ----
  _ambient() {
    const t = this.ctx.currentTime;
    // wind
    const wind = this.ctx.createBufferSource();
    wind.buffer = this._noiseBuf; wind.loop = true;
    const wf = this.ctx.createBiquadFilter();
    wf.type = 'bandpass'; wf.frequency.value = 320; wf.Q.value = 0.4;
    const wg = this.ctx.createGain(); wg.gain.value = 0.045;
    const wLfo = this.ctx.createOscillator(); wLfo.frequency.value = 0.13;
    const wLfoG = this.ctx.createGain(); wLfoG.gain.value = 0.03;
    wLfo.connect(wLfoG).connect(wg.gain);
    wind.connect(wf).connect(wg).connect(this.master);
    wind.start(t); wLfo.start(t);
    // drone
    const d1 = this.ctx.createOscillator(); d1.type = 'sine'; d1.frequency.value = 55;
    const d2 = this.ctx.createOscillator(); d2.type = 'sine'; d2.frequency.value = 55.7;
    const dg = this.ctx.createGain(); dg.gain.value = 0.035;
    d1.connect(dg); d2.connect(dg); dg.connect(this.master);
    d1.start(t); d2.start(t);
  }
}

export const audio = new AudioEngine();
