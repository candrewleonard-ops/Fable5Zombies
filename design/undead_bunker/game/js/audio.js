// Procedural WebAudio SFX — no external samples needed
window.G = window.G || {};
G.audio = (() => {
  let ctx = null, master = null, noiseBuf = null;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function resume() { init(); if (ctx.state === 'suspended') ctx.resume(); }

  function noise(dur, o = {}) {
    if (!ctx) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.f || 1000, ctx.currentTime);
    if (o.fEnd) f.frequency.exponentialRampToValueAtTime(o.fEnd, ctx.currentTime + dur);
    f.Q.value = o.q || 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(o.gain || 0.4, ctx.currentTime + (o.attack || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(); src.stop(ctx.currentTime + dur + 0.05);
  }
  function tone(freq, dur, o = {}) {
    if (!ctx) return;
    const osc = ctx.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime + (o.delay || 0));
    g.gain.linearRampToValueAtTime(o.gain || 0.15, ctx.currentTime + (o.delay || 0) + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (o.delay || 0) + dur);
    osc.connect(g); g.connect(master);
    osc.start(ctx.currentTime + (o.delay || 0)); osc.stop(ctx.currentTime + (o.delay || 0) + dur + 0.05);
  }

  // ----- weapon shots -----
  const shots = {
    pistol:  () => { noise(0.14, { f: 2400, fEnd: 300, gain: 0.5 }); tone(150, 0.09, { type: 'triangle', gain: 0.3, slide: 55 }); },
    rifle:   () => { noise(0.30, { f: 3200, fEnd: 180, gain: 0.65 }); tone(110, 0.22, { type: 'triangle', gain: 0.42, slide: 40 }); },
    shotgun: () => { noise(0.32, { f: 1600, fEnd: 120, gain: 0.75, q: 0.5 }); tone(90, 0.25, { type: 'triangle', gain: 0.5, slide: 35 }); },
    smg:     () => { noise(0.10, { f: 2600, fEnd: 400, gain: 0.4 }); tone(160, 0.06, { type: 'triangle', gain: 0.22, slide: 70 }); },
    lmg:     () => { noise(0.13, { f: 2200, fEnd: 300, gain: 0.5 }); tone(130, 0.09, { type: 'triangle', gain: 0.3, slide: 50 }); },
    arc:     () => { tone(1200, 0.35, { type: 'sawtooth', gain: 0.18, slide: 200 }); tone(2400, 0.3, { type: 'square', gain: 0.06, slide: 500 }); noise(0.25, { f: 6000, fEnd: 800, gain: 0.2, type: 'bandpass', q: 3 }); },
    laser:   () => { tone(2200, 0.14, { type: 'square', gain: 0.1, slide: 340 }); tone(880, 0.2, { type: 'sawtooth', gain: 0.16, slide: 110 }); noise(0.18, { f: 5200, fEnd: 900, gain: 0.3, type: 'bandpass', q: 2.5 }); tone(140, 0.12, { type: 'triangle', gain: 0.25, slide: 60 }); },
  };
  function shot(kind) { (shots[kind] || shots.pistol)(); }

  function empty()      { tone(1600, 0.05, { type: 'square', gain: 0.06 }); tone(900, 0.04, { type: 'square', gain: 0.05, delay: 0.07 }); }
  function reloadStart(){ noise(0.06, { f: 3000, gain: 0.12, type: 'highpass' }); tone(700, 0.04, { type: 'square', gain: 0.05 }); }
  function reloadEnd()  { tone(1100, 0.05, { type: 'square', gain: 0.08 }); noise(0.05, { f: 2500, gain: 0.1, type: 'highpass', q: 2 }); }
  function bolt()       { tone(500, 0.05, { type: 'square', gain: 0.07 }); tone(750, 0.05, { type: 'square', gain: 0.07, delay: 0.12 }); }

  function hitTick(head) { tone(head ? 2000 : 1400, 0.05, { type: 'square', gain: 0.09 }); }
  function playerHurt()  { tone(70, 0.4, { type: 'triangle', gain: 0.4, slide: 40 }); noise(0.3, { f: 300, gain: 0.25 }); }

  function groan(vol) {
    if (!ctx) return;
    const v = Math.min(0.5, vol);
    if (v < 0.01) return;
    const base = 55 + Math.random() * 60, dur = 0.9 + Math.random() * 1.1;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(base * (0.75 + Math.random() * 0.5), ctx.currentTime + dur);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 4 + Math.random() * 6;
    const lfoG = ctx.createGain(); lfoG.gain.value = base * 0.25;
    lfo.connect(lfoG); lfoG.connect(osc.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(v * 0.5, ctx.currentTime + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(f); f.connect(g); g.connect(master);
    osc.start(); lfo.start(); osc.stop(ctx.currentTime + dur + 0.1); lfo.stop(ctx.currentTime + dur + 0.1);
  }
  function attackSnarl(vol) {
    const v = Math.min(0.5, vol); if (v < 0.01) return;
    noise(0.35, { f: 900, fEnd: 300, gain: v, type: 'bandpass', q: 2 });
    tone(120, 0.3, { type: 'sawtooth', gain: v * 0.7, slide: 60 });
  }

  function boardRip() { noise(0.25, { f: 1200, fEnd: 200, gain: 0.35, q: 2 }); tone(220, 0.15, { type: 'square', gain: 0.08, slide: 90 }); }
  function boardAdd() { tone(180, 0.07, { type: 'square', gain: 0.15 }); tone(240, 0.06, { type: 'square', gain: 0.12, delay: 0.08 }); noise(0.08, { f: 1800, gain: 0.15 }); }
  function buy()      { tone(520, 0.1, { type: 'triangle', gain: 0.16 }); tone(780, 0.16, { type: 'triangle', gain: 0.16, delay: 0.09 }); }
  function deny()     { tone(160, 0.2, { type: 'square', gain: 0.1 }); tone(120, 0.24, { type: 'square', gain: 0.1, delay: 0.1 }); }
  function doorOpen() { noise(0.8, { f: 400, fEnd: 90, gain: 0.35 }); tone(60, 0.7, { type: 'triangle', gain: 0.3, slide: 35 }); }
  function perkJingle(){ [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, { type: 'triangle', gain: 0.14, delay: i * 0.13 })); }
  function boxJingle() { [392, 523, 659, 523, 784, 659, 1046].forEach((f, i) => tone(f, 0.22, { type: 'triangle', gain: 0.1, delay: i * 0.19 })); }
  function explosion(){ noise(0.9, { f: 900, fEnd: 60, gain: 0.8, q: 0.4 }); tone(55, 0.8, { type: 'triangle', gain: 0.5, slide: 25 }); }
  function vaultThud(){ tone(90, 0.15, { type: 'triangle', gain: 0.2, slide: 50 }); noise(0.12, { f: 500, gain: 0.18 }); }
  function papHum()   { tone(70, 3.2, { type: 'sawtooth', gain: 0.18, slide: 95 }); tone(105, 3.2, { type: 'sawtooth', gain: 0.12, slide: 140 }); noise(3.0, { f: 300, gain: 0.12 }); }
  function papDing()  { [880, 1320, 1760].forEach((f, i) => tone(f, 0.4, { type: 'triangle', gain: 0.14, delay: i * 0.16 })); tone(220, 0.5, { type: 'square', gain: 0.08 }); }
  function teddy()    { [1180, 990, 1180, 880, 740].forEach((f, i) => tone(f, 0.22, { type: 'sine', gain: 0.16, delay: i * 0.17, slide: f * 0.92 })); tone(160, 1.2, { type: 'triangle', gain: 0.1, slide: 60, delay: 0.2 }); }
  function zap()      { noise(0.08, { f: 4200, fEnd: 1500, gain: 0.14, type: 'bandpass', q: 3 }); tone(2400, 0.06, { type: 'square', gain: 0.05, slide: 700 }); }
  function craftTick(){ tone(700 + Math.random() * 500, 0.06, { type: 'square', gain: 0.06 }); noise(0.05, { f: 3200, gain: 0.08, type: 'highpass' }); }
  function pickup()   { tone(880, 0.08, { type: 'triangle', gain: 0.1 }); tone(1320, 0.1, { type: 'triangle', gain: 0.1, delay: 0.06 }); }
  function jet()      { noise(0.14, { f: 900, fEnd: 500, gain: 0.1, q: 0.6 }); }
  function roundStart() {
    tone(55, 2.4, { type: 'sawtooth', gain: 0.16, slide: 110 });
    tone(82, 2.4, { type: 'sawtooth', gain: 0.12, slide: 165, delay: 0.05 });
    noise(2.0, { f: 200, gain: 0.1, q: 1 });
  }
  function roundEnd() { [220, 196, 165, 147].forEach((f, i) => tone(f, 0.5, { type: 'triangle', gain: 0.12, delay: i * 0.3 })); }

  return { init, resume, shot, empty, reloadStart, reloadEnd, bolt, hitTick, playerHurt, groan, attackSnarl,
           boardRip, boardAdd, buy, deny, doorOpen, perkJingle, boxJingle, explosion, vaultThud, roundStart, roundEnd, papHum, papDing,
           teddy, zap, craftTick, pickup, jet };
})();
