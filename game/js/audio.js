// All sounds are synthesised with WebAudio: no audio files to load.
(function () {
  let ctx = null, master = null, on = true, noise = null;
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = on ? 0.8 : 0; master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended' && on && !document.hidden) ctx.resume();
    return ctx;
  }
  function env(g, t0, a, d, vol) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
  function tone(f, t0, dur, { type = 'sine', vol = 0.2, to = null, a = 0.006 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    env(g, t0, a, dur, vol); o.connect(g).connect(master); o.start(t0); o.stop(t0 + a + dur + 0.05);
  }
  function hiss(t0, dur, { f = 1000, q = 1, vol = 0.2, to = null, type = 'bandpass', a = 0.005 } = {}) {
    const s = ctx.createBufferSource(), bq = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; bq.type = type; bq.Q.value = q; bq.frequency.setValueAtTime(f, t0);
    if (to) bq.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    env(g, t0, a, dur, vol); s.connect(bq).connect(g).connect(master); s.start(t0, Math.random() * 0.5); s.stop(t0 + a + dur + 0.05);
  }
  const play = fn => { if (!on || !ensure()) return; fn(ctx.currentTime + 0.01); };
  const bell = (f, t, vol = 0.13) => { tone(f, t, 0.9, { type: 'triangle', vol }); tone(f * 2.01, t, 0.5, { vol: vol * 0.35 }); };

  window.Sound = {
    unlock: ensure,
    isOn: () => on,
    // the context is created by the first sound (a tap), never at boot: browsers block audio before a gesture
    setOn(v) { on = v; if (ctx) { master.gain.setTargetAtTime(v ? 0.8 : 0, ctx.currentTime, 0.03); if (v) ensure(); } },
    suspend() { if (ctx) ctx.suspend(); },
    resume() { if (ctx && on) ctx.resume(); },
    pick: () => play(t => { tone(660, t, 0.07, { type: 'triangle', vol: 0.12, to: 520 }); hiss(t, 0.03, { f: 3000, vol: 0.05 }); }),
    drop: () => play(t => tone(420, t, 0.06, { type: 'triangle', vol: 0.08, to: 360 })),
    pour: (n, level) => play(t => {
      const base = 260 + level * 70;
      for (let i = 0; i < n * 3; i++) {
        const ti = t + 0.05 + i * 0.1 + Math.random() * 0.02;
        tone(base + i * 18, ti, 0.07, { vol: 0.07, to: base + i * 18 + 120 });
        hiss(ti, 0.06, { f: 700 + i * 60, q: 4, vol: 0.06 });
      }
    }),
    cork: () => play(t => { hiss(t, 0.05, { f: 1900, q: 2, vol: 0.3 }); tone(880, t, 0.09, { type: 'square', vol: 0.05, to: 280 }); bell(1318.5, t + 0.08, 0.06); }),
    fill: () => play(t => { hiss(t, 0.2, { f: 900, to: 2600, q: 1.4, vol: 0.12, a: 0.02 }); tone(523.25 * (1 + Math.random() * 0.06), t + 0.02, 0.18, { vol: 0.035 }); }),
    error: () => play(t => { tone(150, t, 0.13, { type: 'square', vol: 0.05, to: 110 }); }),
    win: () => play(t => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, t + i * 0.11))),
    lose: () => play(t => { tone(311, t, 0.5, { type: 'triangle', vol: 0.12, to: 233 }); tone(233, t + 0.25, 0.7, { type: 'triangle', vol: 0.1, to: 155 }); }),
    picture: () => play(t => [392, 466.16, 587.33, 698.46, 783.99, 932.33].forEach((f, i) => bell(f, t + i * 0.09, 0.11))),
  };
})();
