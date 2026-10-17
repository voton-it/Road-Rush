// Shared helpers. Every script attaches to the global RR namespace so the game
// runs straight from index.html without a bundler or a local server.
window.RR = window.RR || {};

RR.U = (function () {
  const U = {};

  U.clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (min, max) => min + Math.random() * (max - min);
  U.randInt = (min, max) => Math.floor(U.rand(min, max + 1));
  U.choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.sign = (v) => (v < 0 ? -1 : 1);
  U.approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
  U.damp = (v, target, rate, dt) => U.lerp(v, target, 1 - Math.exp(-rate * dt));

  U.easeIn = (a, b, t) => a + (b - a) * Math.pow(t, 2);
  U.easeOut = (a, b, t) => a + (b - a) * (1 - Math.pow(1 - t, 2));
  U.easeInOut = (a, b, t) => a + (b - a) * (-Math.cos(t * Math.PI) / 2 + 0.5);

  U.percentRemaining = (n, total) => (n % total) / total;
  U.exponentialFog = (distance, density) => 1 / Math.pow(Math.E, distance * distance * density);

  // Small, fast seeded PRNG so a given track always builds the same way.
  U.rng = function (seed) {
    let a = seed >>> 0;
    const next = function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (min, max) => min + next() * (max - min);
    next.int = (min, max) => Math.floor(next.range(min, max + 1));
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.chance = (p) => next() < p;
    return next;
  };

  // ---- colour helpers -------------------------------------------------------
  const cache = {};
  U.parse = function (c) {
    if (cache[c]) return cache[c];
    let r, g, b;
    if (c[0] === '#') {
      let h = c.slice(1);
      if (h.length === 3) h = h.split('').map((x) => x + x).join('');
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
    } else {
      const m = c.match(/\d+(\.\d+)?/g).map(Number);
      [r, g, b] = m;
    }
    return (cache[c] = [r, g, b]);
  };
  U.rgb = (r, g, b) => 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  U.rgba = (c, a) => {
    const [r, g, b] = U.parse(c);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  };
  U.mix = function (c1, c2, t) {
    const a = U.parse(c1), b = U.parse(c2);
    return U.rgb(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  };
  U.shade = (c, amt) => (amt >= 0 ? U.mix(c, '#ffffff', amt) : U.mix(c, '#000000', -amt));

  // ---- formatting -----------------------------------------------------------
  U.formatTime = function (s) {
    if (!isFinite(s)) return '--:--.-';
    const m = Math.floor(s / 60);
    const sec = s - m * 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(1);
  };
  U.ordinal = function (n) {
    const s = ['TH', 'ST', 'ND', 'RD'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  U.money = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');

  U.makeCanvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  };

  U.store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) { /* storage unavailable: progress lives for this session only */ }
    },
  };

  return U;
})();
