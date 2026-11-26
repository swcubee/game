// All sounds are synthesised with WebAudio: no audio files to load.
// Soft, cozy palette: glass clinks, liquid pours, brush strokes, through a small room reverb.
(function () {
  let ctx = null, master = null, wet = null, on = true, noise = null;
  // pentatonic notes for painting: consecutive fills form a gentle melody
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
  let note = 2;

  function impulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = on ? 0.8 : 0;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
      master.connect(comp).connect(ctx.destination);
      const rev = ctx.createConvolver(); rev.buffer = impulse(1.1, 3);
      wet = ctx.createGain(); wet.gain.value = 0.18; wet.connect(rev).connect(master);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended' && on && !document.hidden) ctx.resume();
    return ctx;
  }
  function out(node, rev = 1) { node.connect(master); if (rev) { const s = ctx.createGain(); s.gain.value = rev; node.connect(s).connect(wet); } }
  function env(g, t0, a, d, vol) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
  function tone(f, t0, dur, { type = 'sine', vol = 0.2, to = null, a = 0.006, rev = 1 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + a + dur);
    env(g, t0, a, dur, vol); o.connect(g); out(g, rev); o.start(t0); o.stop(t0 + a + dur + 0.05);
  }
  function hiss(t0, dur, { f = 1000, q = 1, vol = 0.2, to = null, type = 'bandpass', a = 0.005, rev = 1 } = {}) {
    const s = ctx.createBufferSource(), bq = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; s.loop = true; bq.type = type; bq.Q.value = q; bq.frequency.setValueAtTime(f, t0);
    if (to) bq.frequency.exponentialRampToValueAtTime(to, t0 + a + dur);
    env(g, t0, a, dur, vol); s.connect(bq).connect(g); out(g, rev); s.start(t0, Math.random() * 0.5); s.stop(t0 + a + dur + 0.05);
  }
  // glass: a few inharmonic partials with quick decay
  function glass(f, t, vol = 0.08, len = 0.35) {
    [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.9, 0.12]].forEach(([m, v]) => tone(f * m, t, len / m ** 0.3, { vol: vol * v, a: 0.002 }));
  }
  // a soft bubble: sine with a fast upward chirp
  function bubble(f, t, vol = 0.05) { tone(f, t, 0.05, { vol, to: f * 1.8, a: 0.004, rev: 0.6 }); }
  const play = fn => { if (!on || !ensure()) return; fn(ctx.currentTime + 0.01); };
  const bell = (f, t, vol = 0.13) => { tone(f, t, 0.9, { type: 'triangle', vol }); tone(f * 2.01, t, 0.5, { vol: vol * 0.35 }); };

  window.Sound = {
    unlock: ensure,
    isOn: () => on,
    // the context is created by the first sound (a tap), never at boot: browsers block audio before a gesture
    setOn(v) { on = v; if (ctx) { master.gain.setTargetAtTime(v ? 0.8 : 0, ctx.currentTime, 0.03); if (v) ensure(); } },
    suspend() { if (ctx) ctx.suspend(); },
    resume() { if (ctx && on) ctx.resume(); },
    // lifting a flask / UI tap: a light glass "tink"
    pick: () => play(t => { glass(1760, t, 0.1, 0.18); hiss(t, 0.025, { f: 5000, q: 2, vol: 0.02, rev: 0 }); }),
    // setting a flask down on the wooden shelf: soft wood knock + glass clink
    drop: () => play(t => {
      tone(150, t, 0.07, { vol: 0.26, to: 90, a: 0.002, rev: 0.3 });
      hiss(t, 0.04, { f: 600, q: 1.5, vol: 0.06, type: 'lowpass', rev: 0.2 });
      glass(1320, t + 0.012, 0.08, 0.3);
    }),
    // pouring n layers into a flask that already holds `level` layers.
    // Matches the stream on screen (~0.5 s); pitch rises as the flask fills, like real liquid.
    pour: (n, level) => play(t => {
      const dur = 0.5, f0 = 420 + level * 160, f1 = f0 + 180 + n * 140;
      // the stream: resonant filtered noise, gurgling
      const s = ctx.createBufferSource(), bq = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      s.buffer = noise; s.loop = true; bq.type = 'bandpass'; bq.Q.value = 7;
      bq.frequency.setValueAtTime(f0, t); bq.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.06);
      g.gain.setValueAtTime(0.22, t + dur - 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
      const trem = ctx.createGain(); trem.gain.value = 0.7;
      lfo.frequency.value = 14; lg.gain.value = 0.3; lfo.connect(lg).connect(trem.gain);
      s.connect(bq).connect(g).connect(trem); out(trem, 0.8);
      s.start(t); s.stop(t + dur + 0.1); lfo.start(t); lfo.stop(t + dur + 0.1);
      // bubbles on top
      const k = 4 + n * 2;
      for (let i = 0; i < k; i++) bubble(f0 * 1.4 + (f1 - f0) * (i / k) + Math.random() * 120, t + 0.05 + (i / k) * (dur - 0.08) + Math.random() * 0.03, 0.035 + Math.random() * 0.02);
    }),
    cork: () => play(t => { hiss(t, 0.05, { f: 1900, q: 2, vol: 0.3 }); tone(880, t, 0.09, { type: 'square', vol: 0.04, to: 280 }); bell(1318.5, t + 0.08, 0.06); }),
    // painting a cell: a soft brush swish and a gentle chime that walks a pentatonic melody
    fill: () => play(t => {
      hiss(t, 0.22, { f: 700, to: 2200, q: 0.9, vol: 0.07, a: 0.04, rev: 0.4 });
      hiss(t + 0.02, 0.16, { f: 3500, to: 5500, q: 1.2, vol: 0.02, a: 0.03, rev: 0.2 });
      note = Math.max(0, Math.min(PENTA.length - 1, note + [-1, 1, 1, 2, -2][Math.floor(Math.random() * 5)]));
      const f = PENTA[note];
      tone(f, t + 0.05, 0.5, { type: 'triangle', vol: 0.05, a: 0.01 });
      tone(f * 2, t + 0.05, 0.25, { vol: 0.015, a: 0.01 });
    }),
    error: () => play(t => { tone(180, t, 0.12, { type: 'triangle', vol: 0.08, to: 140, rev: 0.3 }); tone(150, t + 0.09, 0.14, { type: 'triangle', vol: 0.07, to: 120, rev: 0.3 }); }),
    win: () => play(t => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, t + i * 0.11))),
    lose: () => play(t => { tone(311, t, 0.5, { type: 'triangle', vol: 0.12, to: 233 }); tone(233, t + 0.25, 0.7, { type: 'triangle', vol: 0.1, to: 155 }); }),
    picture: () => play(t => [392, 466.16, 587.33, 698.46, 783.99, 932.33].forEach((f, i) => bell(f, t + i * 0.09, 0.11))),
  };
})();
