// Synthesised audio: engine, wind, impacts, sirens and a procedural grunge-rock
// loop. Nothing is loaded from disk. The context starts on the first user gesture.
RR.Audio = (function () {
  const U = RR.U;
  let ctx = null, master, sfxBus, musicBus, noiseBuf, distCurve;
  let engine = null, wind = null, siren = null;
  const prefs = U.store.get('rr.audio', { sfx: true, music: true });
  const A = { prefs };

  function makeDistortion(k) {
    const n = 2048, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }

  A.init = function () {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = prefs.sfx ? 0.75 : 0;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = prefs.music ? 0.26 : 0;
    musicBus.connect(master);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    distCurve = makeDistortion(38);

    buildEngine();
    buildWind();
    buildSiren();
  };

  A.setSfx = function (on) {
    prefs.sfx = on;
    U.store.set('rr.audio', prefs);
    if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 0.75 : 0, ctx.currentTime, 0.05);
  };
  A.setMusic = function (on) {
    prefs.music = on;
    U.store.set('rr.audio', prefs);
    if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.26 : 0, ctx.currentTime, 0.05);
  };

  function noiseSource(loop) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = !!loop;
    return src;
  }

  // ---- continuous voices -----------------------------------------------------
  function buildEngine() {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'square';
    o3.type = 'sine';
    const g1 = ctx.createGain(), g2 = ctx.createGain(), g3 = ctx.createGain();
    g1.gain.value = 0.5;
    g2.gain.value = 0.25;
    g3.gain.value = 0.6;
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortion(6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    lp.Q.value = 3;
    const out = ctx.createGain();
    out.gain.value = 0;
    // amplitude throb for that uneven twin-cylinder sound
    const trem = ctx.createGain();
    trem.gain.value = 0.7;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.3;
    lfo.connect(lfoGain).connect(trem.gain);
    o1.connect(g1).connect(shaper);
    o2.connect(g2).connect(shaper);
    o3.connect(g3).connect(shaper);
    shaper.connect(lp).connect(trem).connect(out).connect(sfxBus);
    [o1, o2, o3, lfo].forEach((o) => o.start());
    engine = { o1, o2, o3, lp, out, lfo };
  }
  function buildWind() {
    const src = noiseSource(true);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.6;
    const out = ctx.createGain();
    out.gain.value = 0;
    src.connect(bp).connect(out).connect(sfxBus);
    src.start();
    wind = { bp, out };
  }
  function buildSiren() {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = 760;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1.4;
    const lg = ctx.createGain();
    lg.gain.value = 230;
    lfo.connect(lg).connect(o.frequency);
    const out = ctx.createGain();
    out.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) o.connect(out).connect(pan).connect(sfxBus);
    else o.connect(out).connect(sfxBus);
    o.start();
    lfo.start();
    siren = { out, pan };
  }

  // rpm 0..1 within the current gear, throttle 0..1
  A.engine = function (on, rpm, throttle, speedPct) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const f = 34 + rpm * 120 + speedPct * 30;
    engine.o1.frequency.setTargetAtTime(f, t, 0.03);
    engine.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    engine.o3.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    engine.lfo.frequency.setTargetAtTime(f * 0.25, t, 0.05);
    engine.lp.frequency.setTargetAtTime(380 + rpm * 1500 + throttle * 900, t, 0.05);
    engine.out.gain.setTargetAtTime(on ? 0.1 + throttle * 0.08 : 0, t, 0.08);
    wind.out.gain.setTargetAtTime(on ? Math.pow(speedPct, 2) * 0.16 : 0, t, 0.1);
    wind.bp.frequency.setTargetAtTime(500 + speedPct * 1400, t, 0.1);
  };
  A.siren = function (volume, pan) {
    if (!ctx) return;
    siren.out.gain.setTargetAtTime(volume * 0.07, ctx.currentTime, 0.1);
    if (siren.pan) siren.pan.pan.setTargetAtTime(U.clamp(pan, -1, 1), ctx.currentTime, 0.1);
  };
  A.silence = function () {
    if (!ctx) return;
    A.engine(false, 0, 0, 0);
    A.siren(0, 0);
  };

  // ---- one-shots --------------------------------------------------------------
  function env(gainNode, t, attack, peak, decay) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function noiseHit(t, freq, type, q, peak, decay, dest) {
    const src = noiseSource(false);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const gn = ctx.createGain();
    env(gn, t, 0.004, peak, decay);
    src.connect(f).connect(gn).connect(dest || sfxBus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + decay + 0.05);
    return f;
  }
  function tone(t, type, f0, f1, peak, decay, dest) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + decay);
    const gn = ctx.createGain();
    env(gn, t, 0.004, peak, decay);
    o.connect(gn).connect(dest || sfxBus);
    o.start(t);
    o.stop(t + decay + 0.05);
  }

  A.hit = function (kind, vol) {
    if (!ctx) return;
    const t = ctx.currentTime, v = vol == null ? 1 : vol;
    if (kind === 'chain') {
      noiseHit(t, 3200, 'bandpass', 4, 0.5 * v, 0.18);
      tone(t, 'square', 1800, 1200, 0.08 * v, 0.12);
      tone(t, 'sine', 140, 60, 0.6 * v, 0.14);
    } else if (kind === 'club' || kind === 'baton') {
      noiseHit(t, 900, 'lowpass', 1, 0.7 * v, 0.12);
      tone(t, 'sine', 180, 50, 0.9 * v, 0.16);
    } else {
      noiseHit(t, 1400, 'lowpass', 1, 0.55 * v, 0.08);
      tone(t, 'sine', 120, 45, 0.85 * v, 0.12);
    }
  };
  A.whoosh = function (vol) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const f = noiseHit(t, 600, 'bandpass', 2, 0.25 * (vol || 1), 0.22);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.2);
  };
  A.crash = function (vol) {
    if (!ctx) return;
    const t = ctx.currentTime, v = vol || 1;
    const f = noiseHit(t, 3000, 'lowpass', 0.7, 0.9 * v, 1.1);
    f.frequency.exponentialRampToValueAtTime(200, t + 1);
    tone(t, 'sine', 90, 35, 1 * v, 0.4);
    tone(t + 0.18, 'sine', 70, 30, 0.6 * v, 0.3);
    noiseHit(t + 0.05, 5000, 'highpass', 1, 0.25 * v, 0.6);
  };
  A.carPass = function (vol, pan) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const f = noiseHit(t, 300, 'bandpass', 1.5, 0.35 * vol, 0.45);
    f.frequency.exponentialRampToValueAtTime(1600, t + 0.2);
    f.frequency.exponentialRampToValueAtTime(400, t + 0.45);
  };
  A.horn = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(t, 'sawtooth', 415, 0, 0.12, 0.5);
    tone(t, 'sawtooth', 330, 0, 0.12, 0.5);
  };
  A.land = function (vol) {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(t, 'sine', 90, 40, 0.6 * vol, 0.2);
    noiseHit(t, 600, 'lowpass', 1, 0.3 * vol, 0.15);
  };
  A.beep = function (high) {
    if (!ctx) return;
    tone(ctx.currentTime, 'square', high ? 1320 : 660, 0, 0.15, high ? 0.6 : 0.25);
  };
  A.ui = function () {
    if (!ctx) return;
    tone(ctx.currentTime, 'triangle', 880, 1200, 0.12, 0.06);
  };
  A.nitro = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    const f = noiseHit(t, 400, 'bandpass', 1, 0.7, 1.2);
    f.frequency.exponentialRampToValueAtTime(3000, t + 0.8);
  };
  A.cash = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(t, 'square', 1046, 0, 0.1, 0.1);
    tone(t + 0.08, 'square', 1568, 0, 0.1, 0.3);
  };
  A.grab = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(t, 'triangle', 520, 1040, 0.2, 0.15);
  };

  // ---- music: E-minor grunge loop at 132 bpm ----------------------------------
  const music = { playing: false, step: 0, next: 0, timer: null, intensity: 1 };
  const BPM = 132;
  const SONG = [
    [40, 40], [43, 45], [40, 40], [48, 50],
    [40, 40], [43, 45], [47, 47], [45, 43],
  ];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function guitar(t, root, dur, vol) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = distCurve;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gn.gain.setValueAtTime(vol, t + dur * 0.7);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const pre = ctx.createGain();
    pre.gain.value = 0.35;
    for (const iv of [0, 7, 12]) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(root + 12 + iv);
        o.detune.value = det;
        o.connect(pre);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    }
    pre.connect(shaper).connect(lp).connect(gn).connect(musicBus);
  }
  function bass(t, root, dur) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = mtof(root);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    const gn = ctx.createGain();
    env(gn, t, 0.006, 0.5, dur);
    o.connect(lp).connect(gn).connect(musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function kick(t) { tone(t, 'sine', 140, 42, 1.0, 0.28, musicBus); }
  function snare(t) {
    noiseHit(t, 1800, 'highpass', 0.7, 0.55, 0.16, musicBus);
    tone(t, 'triangle', 200, 120, 0.35, 0.1, musicBus);
  }
  function hat(t, open) { noiseHit(t, 8000, 'highpass', 1, open ? 0.16 : 0.1, open ? 0.18 : 0.04, musicBus); }

  function scheduleStep(step, t) {
    const sixteenth = 60 / BPM / 4;
    const bar = Math.floor(step / 16) % SONG.length;
    const s = step % 16;
    const root = SONG[bar][s < 8 ? 0 : 1];
    const phrase = Math.floor(step / 64) % 4;
    if (s === 0 || s === 8 || s === 10 || (phrase === 3 && s === 14)) kick(t);
    if (s === 4 || s === 12) snare(t);
    if (phrase === 3 && bar % 4 === 3 && s >= 12) snare(t);
    if (s % 2 === 0) hat(t, s === 6 || s === 14);
    if (s % 2 === 0) bass(t, root, sixteenth * 1.8);
    if (phrase === 0 || phrase === 2) {
      if (s % 2 === 0) guitar(t, root, sixteenth * (s === 0 || s === 8 ? 1.9 : 1.1), s === 0 || s === 8 ? 0.2 : 0.12);
    } else if (s === 0 || s === 8) {
      guitar(t, root, sixteenth * 7.5, 0.18);
    }
  }
  function tick() {
    if (!ctx || !music.playing) return;
    const sixteenth = 60 / BPM / 4;
    while (music.next < ctx.currentTime + 0.15) {
      scheduleStep(music.step, music.next);
      music.step++;
      music.next += sixteenth;
    }
  }
  A.startMusic = function () {
    if (!ctx || music.playing) return;
    music.playing = true;
    music.step = 0;
    music.next = ctx.currentTime + 0.1;
    music.timer = setInterval(tick, 30);
  };
  A.stopMusic = function () {
    music.playing = false;
    if (music.timer) clearInterval(music.timer);
    music.timer = null;
  };

  return A;
})();
