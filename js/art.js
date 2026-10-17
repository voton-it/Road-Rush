// Procedural art. Roadside sprites, cars and background layers are painted once
// per track into offscreen canvases; bikes and riders are drawn as vectors every
// frame so they can lean, swing weapons and tumble smoothly at any size.
RR.Art = (function () {
  const U = RR.U;
  const A = {};
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------------------
  // small drawing helpers
  // ---------------------------------------------------------------------------
  function poly(g, pts) {
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
  }
  function rrect(g, x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r);
    else g.rect(x, y, w, h);
  }
  function circle(g, x, y, r) {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
  }
  function ellipse(g, x, y, rx, ry, rot) {
    g.beginPath();
    g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU);
  }

  // Periodic noise (integer frequencies) so background layers tile seamlessly.
  function periodicNoise(rng, freqs) {
    const parts = freqs.map((f, i) => ({ f, a: 1 / Math.pow(1.7, i), p: rng() * TAU }));
    const total = parts.reduce((s, p) => s + p.a, 0);
    return function (x, ridged) {
      let v = 0;
      for (const p of parts) {
        const s = Math.sin(x * TAU * p.f + p.p);
        v += p.a * (ridged ? 1 - Math.abs(s) : s * 0.5 + 0.5);
      }
      return v / total;
    };
  }

  // A sprite is a canvas plus its size in world units.
  function makeSprite(w, h, worldW, draw, opts) {
    opts = opts || {};
    const img = U.makeCanvas(w, h);
    const g = img.getContext('2d');
    draw(g, w, h);
    return {
      img, w: worldW, h: (worldW * h) / w,
      collide: opts.collide !== false, cw: opts.cw || 0.4,
      sil: null, silColor: null,
    };
  }

  // Flat fog-coloured copy of a sprite, drawn over it with alpha for depth haze.
  A.silhouette = function (sprite, color) {
    if (sprite.sil && sprite.silColor === color) return sprite.sil;
    const c = U.makeCanvas(sprite.img.width, sprite.img.height);
    const g = c.getContext('2d');
    g.drawImage(sprite.img, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    sprite.sil = c;
    sprite.silColor = color;
    return c;
  };

  // ---------------------------------------------------------------------------
  // roadside sprites. K = { rng, night, L(color) } where L applies scene lighting.
  // ---------------------------------------------------------------------------
  const GEN = {};

  GEN.pine = function (K, snow) {
    const W = 220, H = 460;
    const greens = snow ? ['#24463a', '#2f5a48'] : [K.rng.pick(['#1f4a2c', '#24532f', '#1c4430']), '#2f6a3b'];
    return makeSprite(W, H, snow ? 560 : 600, function (g) {
      const cx = W / 2;
      g.fillStyle = K.L('#4a3121');
      g.fillRect(cx - 9, H - 74, 18, 74);
      g.fillStyle = K.L('#36231a');
      g.fillRect(cx - 9, H - 74, 7, 74);
      const tiers = 6, top = 10, bottom = H - 52;
      for (let i = 0; i < tiers; i++) {
        const yTop = top + (bottom - top) * (i / tiers) * 0.78;
        const yBot = Math.min(bottom, top + (bottom - top) * ((i + 1.7) / tiers) * 0.78);
        const half = 22 + (W / 2 - 14) * ((i + 1) / tiers);
        const pts = [cx, yTop];
        const teeth = 7;
        for (let k = 0; k <= teeth; k++) {
          const t = k / teeth;
          pts.push(cx + half - t * half * 2, yBot + (k % 2 ? -10 : 2) + K.rng.range(-3, 3));
        }
        g.fillStyle = K.L(greens[0]);
        poly(g, pts);
        g.fill();
        g.fillStyle = K.L(greens[1]);
        poly(g, [cx, yTop, cx + half, yBot, cx + half * 0.15, yBot - 4]);
        g.fill();
        if (snow) {
          g.fillStyle = K.L('#f4f8fb');
          const sh = (yBot - yTop) * 0.42;
          poly(g, [cx, yTop, cx + half * 0.45, yTop + sh, cx + half * 0.2, yTop + sh - 6, cx, yTop + sh + 2,
            cx - half * 0.25, yTop + sh - 5, cx - half * 0.45, yTop + sh]);
          g.fill();
        }
      }
    }, { cw: 0.22 });
  };

  GEN.redwood = function (K) {
    const W = 280, H = 760;
    return makeSprite(W, H, 900, function (g) {
      const cx = W / 2 + K.rng.range(-10, 10);
      // trunk
      g.fillStyle = K.L('#7a3b22');
      poly(g, [cx - 36, H, cx + 36, H, cx + 15, 60, cx - 15, 60]);
      g.fill();
      g.fillStyle = K.L('#5a2a18');
      poly(g, [cx - 36, H, cx - 8, H, cx - 4, 60, cx - 15, 60]);
      g.fill();
      g.strokeStyle = K.L('#4a2213');
      g.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const x = K.rng.range(-26, 26);
        g.beginPath();
        g.moveTo(cx + x, H);
        g.lineTo(cx + x * 0.4, K.rng.range(120, 400));
        g.stroke();
      }
      // flared base
      g.fillStyle = K.L('#6a321d');
      poly(g, [cx - 52, H, cx - 30, H - 50, cx + 30, H - 50, cx + 52, H]);
      g.fill();
      // foliage clumps
      const dark = K.L('#1d3d24'), mid = K.L('#28502c'), lite = K.L('#3a6a36');
      for (let i = 0; i < 16; i++) {
        const t = i / 15;
        const y = 30 + t * (H * 0.62);
        const side = i % 2 ? 1 : -1;
        const spread = 40 + t * 70;
        const x = cx + side * K.rng.range(10, spread);
        const r = 26 + t * 18 + K.rng.range(-6, 6);
        g.fillStyle = dark;
        ellipse(g, x, y, r * 1.4, r * 0.75);
        g.fill();
        g.fillStyle = mid;
        ellipse(g, x + 4, y - 5, r * 1.1, r * 0.5);
        g.fill();
        g.fillStyle = lite;
        ellipse(g, x + 10, y - 8, r * 0.6, r * 0.25);
        g.fill();
      }
    }, { cw: 0.16 });
  };

  GEN.palm = function (K) {
    const W = 340, H = 560;
    return makeSprite(W, H, 820, function (g) {
      const lean = K.rng.range(-50, 50);
      const bx = W / 2, by = H, tx = W / 2 + lean, ty = 120;
      const cx1 = W / 2 + lean * 0.1, cy1 = H * 0.5;
      const at = (t) => {
        const u = 1 - t;
        return [u * u * bx + 2 * u * t * cx1 + t * t * tx, u * u * by + 2 * u * t * cy1 + t * t * ty];
      };
      for (let i = 0; i < 26; i++) {
        const t = i / 26;
        const [x, y] = at(t);
        const w = 15 - t * 6;
        g.fillStyle = K.L(i % 2 ? '#8a6a45' : '#7a5c3a');
        ellipse(g, x, y, w, 12);
        g.fill();
        g.fillStyle = K.L('#5e4429');
        ellipse(g, x - w * 0.45, y, w * 0.45, 11);
        g.fill();
      }
      // fronds
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI + (i / (n - 1)) * Math.PI + K.rng.range(-0.15, 0.15);
        const len = K.rng.range(110, 150);
        const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.5 + 60;
        const mx = tx + Math.cos(a) * len * 0.55, my = ty + Math.sin(a) * len * 0.5 - 18;
        g.strokeStyle = K.L(i % 2 ? '#2f7a3a' : '#3b8a40');
        g.lineWidth = 2.4;
        for (let k = 1; k < 16; k++) {
          const t = k / 16, u = 1 - t;
          const px = u * u * tx + 2 * u * t * mx + t * t * ex;
          const py = u * u * ty + 2 * u * t * my + t * t * ey;
          const leaf = 26 * Math.sin(t * Math.PI) + 4;
          g.beginPath();
          g.moveTo(px, py);
          g.lineTo(px + Math.cos(a + 1.2) * leaf * 0.5, py + leaf);
          g.moveTo(px, py);
          g.lineTo(px + Math.cos(a - 1.2) * leaf * 0.5, py + leaf * 0.8);
          g.stroke();
        }
        g.strokeStyle = K.L('#2a5a2a');
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(tx, ty);
        g.quadraticCurveTo(mx, my, ex, ey);
        g.stroke();
      }
      g.fillStyle = K.L('#5a3f1f');
      for (let i = 0; i < 3; i++) {
        circle(g, tx - 8 + i * 8, ty + 10, 7);
        g.fill();
      }
    }, { cw: 0.12 });
  };

  function blobCluster(K, g, W, H, n, colors, flat) {
    for (let pass = 0; pass < colors.length; pass++) {
      g.fillStyle = K.L(colors[pass]);
      for (let i = 0; i < n; i++) {
        const x = W * 0.18 + K.rng() * W * 0.64 + pass * 6;
        const y = H * (flat ? 0.55 : 0.45) + K.rng() * H * 0.35 - pass * 8;
        const r = (H * 0.22) * (1 - pass * 0.25) * K.rng.range(0.7, 1.2);
        circle(g, x, y, r);
        g.fill();
      }
    }
  }

  GEN.bush = function (K) {
    return makeSprite(260, 170, 460, function (g, W, H) {
      blobCluster(K, g, W, H, 9, ['#2b5a26', '#3d7a32', '#5a9a40'], true);
    }, { cw: 0.6 });
  };
  GEN.shrub = function (K) {
    return makeSprite(220, 130, 330, function (g, W, H) {
      g.strokeStyle = K.L('#6b5530');
      g.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        g.beginPath();
        g.moveTo(W / 2, H);
        g.lineTo(W / 2 + K.rng.range(-90, 90), H - K.rng.range(40, 110));
        g.stroke();
      }
      blobCluster(K, g, W, H, 6, ['#7a7a42', '#9a9450'], true);
    }, { collide: false });
  };
  GEN.fern = function (K) {
    return makeSprite(260, 160, 420, function (g, W, H) {
      for (let i = 0; i < 13; i++) {
        const a = Math.PI + 0.25 + (i / 12) * (Math.PI - 0.5);
        const len = K.rng.range(80, 120);
        g.strokeStyle = K.L(i % 2 ? '#3f7a34' : '#4f8f3c');
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(W / 2, H);
        const ex = W / 2 + Math.cos(a) * len, ey = H + Math.sin(a) * len * 0.9;
        g.quadraticCurveTo(W / 2 + Math.cos(a) * len * 0.6, H + Math.sin(a) * len * 1.2, ex, ey + 30);
        g.stroke();
      }
    }, { collide: false });
  };

  GEN.cactus = function (K) {
    return makeSprite(200, 380, 340, function (g, W, H) {
      const cx = W / 2;
      const body = K.L('#3f7a3f'), dark = K.L('#2c5a2e'), lite = K.L('#5a9a50');
      const arm = (x, y, dir, h) => {
        g.fillStyle = body;
        rrect(g, dir > 0 ? x : x - 34, y, 34, 22, 10);
        g.fill();
        rrect(g, dir > 0 ? x + 10 : x - 34, y - h, 24, h + 22, 12);
        g.fill();
      };
      if (K.rng() < 0.8) arm(cx + 14, 170, 1, K.rng.range(50, 90));
      if (K.rng() < 0.8) arm(cx - 14, 210, -1, K.rng.range(40, 80));
      g.fillStyle = body;
      rrect(g, cx - 22, 30, 44, H - 30, 22);
      g.fill();
      g.fillStyle = dark;
      rrect(g, cx - 22, 30, 14, H - 30, 10);
      g.fill();
      g.strokeStyle = lite;
      g.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.moveTo(cx + i * 9, 40);
        g.lineTo(cx + i * 9, H);
        g.stroke();
      }
    }, { cw: 0.25 });
  };

  GEN.rock = function (K) {
    return makeSprite(260, 180, K.rng.range(420, 600), function (g, W, H) {
      const base = K.rng.pick(['#8a8378', '#7c7468', '#94887a']);
      const pts = [];
      const n = 9;
      for (let i = 0; i <= n; i++) {
        const a = Math.PI + (i / n) * Math.PI;
        pts.push(W / 2 + Math.cos(a) * W * 0.45 * K.rng.range(0.8, 1), H - 4 + Math.sin(a) * H * 0.9 * K.rng.range(0.7, 1));
      }
      g.fillStyle = K.L(base);
      poly(g, pts);
      g.fill();
      g.fillStyle = K.L(U.shade(base, -0.3));
      poly(g, [pts[0], pts[1], pts[2], pts[3], pts[4], pts[5], W * 0.42, H * 0.55, W * 0.45, H]);
      g.fill();
      g.fillStyle = K.L(U.shade(base, 0.2));
      poly(g, [pts[12], pts[13], pts[14], pts[15], W * 0.6, H * 0.45]);
      g.fill();
    }, { cw: 0.7 });
  };

  GEN.seastack = function (K) {
    return makeSprite(260, 320, 1800, function (g, W, H) {
      g.fillStyle = K.L('#7d7466');
      poly(g, [W * 0.2, H, W * 0.28, H * 0.4, W * 0.4, H * 0.12, W * 0.62, H * 0.08, W * 0.72, H * 0.45, W * 0.82, H]);
      g.fill();
      g.fillStyle = K.L('#5d5549');
      poly(g, [W * 0.2, H, W * 0.28, H * 0.4, W * 0.4, H * 0.12, W * 0.45, H]);
      g.fill();
      g.fillStyle = K.L('#4f7a3a');
      ellipse(g, W * 0.52, H * 0.1, W * 0.13, H * 0.04);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.75)';
      ellipse(g, W * 0.5, H - 6, W * 0.38, 7);
      g.fill();
    }, { collide: false });
  };

  function windows(K, g, x, y, w, h, cols, rows, lit) {
    const cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const on = K.night && K.rng() < lit;
        g.fillStyle = on ? K.rng.pick(['#ffd27a', '#ffe7a8', '#f6b860']) : K.L(K.night ? '#1a1c28' : '#5c7a96');
        g.fillRect(x + c * cw + cw * 0.18, y + r * ch + ch * 0.2, cw * 0.64, ch * 0.55);
      }
    }
  }

  GEN.house = function (K) {
    return makeSprite(380, 280, 1500, function (g, W, H) {
      const wall = K.rng.pick(['#e9dcc4', '#d8e4e6', '#f0d6c8', '#e6e0b8']);
      const roof = K.rng.pick(['#8a3a2e', '#5a6a7a', '#6a4a3a']);
      g.fillStyle = K.L(wall);
      g.fillRect(30, 110, W - 60, H - 110);
      g.fillStyle = K.L(U.shade(wall, -0.18));
      g.fillRect(30, 110, 50, H - 110);
      g.fillStyle = K.L(roof);
      poly(g, [10, 116, W / 2, 30, W - 10, 116]);
      g.fill();
      g.fillStyle = K.L(U.shade(roof, -0.25));
      poly(g, [10, 116, W / 2, 30, W / 2, 116]);
      g.fill();
      windows(K, g, 90, 140, W - 140, 70, 4, 1, 0.8);
      g.fillStyle = K.L('#5a3a28');
      g.fillRect(W / 2 - 20, H - 70, 40, 70);
    }, { cw: 0.8 });
  };
  GEN.shack = function (K) {
    return makeSprite(300, 220, 1100, function (g, W, H) {
      g.fillStyle = K.L('#8a6a48');
      g.fillRect(30, 70, W - 60, H - 70);
      g.strokeStyle = K.L('#6a4e33');
      g.lineWidth = 3;
      for (let x = 40; x < W - 30; x += 16) {
        g.beginPath();
        g.moveTo(x, 70);
        g.lineTo(x, H);
        g.stroke();
      }
      g.fillStyle = K.L('#7a7a80');
      poly(g, [15, 76, W - 10, 50, W - 10, 66, 15, 92]);
      g.fill();
      g.fillStyle = K.L('#2a2018');
      g.fillRect(W / 2 - 18, H - 64, 36, 64);
    }, { cw: 0.8 });
  };
  GEN.cabin = function (K) {
    return makeSprite(320, 240, 1200, function (g, W, H) {
      g.fillStyle = K.L('#6a4426');
      g.fillRect(30, 100, W - 60, H - 100);
      g.strokeStyle = K.L('#4f311b');
      g.lineWidth = 4;
      for (let y = 108; y < H; y += 14) {
        g.beginPath();
        g.moveTo(30, y);
        g.lineTo(W - 30, y);
        g.stroke();
      }
      g.fillStyle = K.L('#f2f6f9');
      poly(g, [8, 108, W / 2, 26, W - 8, 108]);
      g.fill();
      windows(K, g, 70, 140, W - 140, 50, 3, 1, 0.9);
    }, { cw: 0.8 });
  };

  GEN.building = function (K) {
    const tall = K.rng.range(1.2, 2.6);
    const W = 300, H = Math.round(300 * tall);
    return makeSprite(W, H, 2600, function (g) {
      const body = K.rng.pick(['#4a4a58', '#5a4a48', '#3e4a58', '#56524a', '#3a3a46']);
      g.fillStyle = K.L(body);
      g.fillRect(10, 20, W - 20, H - 20);
      g.fillStyle = K.L(U.shade(body, -0.3));
      g.fillRect(10, 20, 40, H - 20);
      g.fillStyle = K.L(U.shade(body, -0.15));
      g.fillRect(4, 14, W - 8, 12);
      windows(K, g, 56, 40, W - 80, H - 120, 5, Math.floor((H - 120) / 34), 0.45);
      // shop front
      g.fillStyle = K.night ? K.rng.pick(['#ffcf7a', '#9fe0ff', '#ff9ac0']) : K.L('#3a5068');
      g.fillRect(56, H - 70, W - 80, 50);
      g.fillStyle = K.L('#222');
      g.fillRect(56, H - 80, W - 80, 10);
      if (K.night && K.rng() < 0.7) {
        const neon = K.rng.pick(['#ff3fa4', '#3ff0ff', '#ffe03f', '#7dff6a']);
        g.save();
        g.shadowColor = neon;
        g.shadowBlur = 18;
        g.strokeStyle = neon;
        g.lineWidth = 6;
        rrect(g, 70, H - 150, W - 110, 40, 8);
        g.stroke();
        g.fillStyle = neon;
        g.font = 'bold 26px Teko, Impact, sans-serif';
        g.textAlign = 'center';
        g.fillText(K.rng.pick(['BAR', 'MOTEL', 'PAWN', 'DINER', 'TATTOO', 'LIQUOR', 'PIZZA', 'GARAGE']), W / 2 + 10, H - 120);
        g.restore();
      }
    }, { cw: 0.95 });
  };

  const ADS = {
    coast: [['SURF SHACK', 'boards & wax', '#1f8ab0', '#ffe9b0'], ['GRIT COLA', 'taste the road', '#c0302a', '#fff'], ['MOTO MART', 'parts · tires · bail', '#2a2a2a', '#f2c230']],
    desert: [['LAST GAS', '82 miles', '#f2c230', '#2a1a10'], ['ROADKILL BBQ', 'next exit', '#7a2a1a', '#f6e3c4'], ['GRIT COLA', 'taste the road', '#c0302a', '#fff']],
    city: [['NITRO NOODLE', 'open all night', '#ff3fa4', '#fff'], ['BAIL BONDS', '555-0199', '#f2c230', '#111'], ['MOTO MART', 'parts · tires · bail', '#2a2a2a', '#f2c230']],
    alpine: [['SKI LODGE', '4 miles', '#2a5aa0', '#fff'], ['CHAINS REQ.', 'when flashing', '#f2c230', '#111']],
    forest: [['CAMPGROUND', '2 miles', '#3a5a2a', '#f6e3c4']],
  };
  GEN.billboard = function (K, theme) {
    const ad = K.rng.pick(ADS[theme.id] || ADS.coast);
    return makeSprite(440, 320, 1700, function (g, W, H) {
      g.fillStyle = K.L('#3a3a3a');
      g.fillRect(90, 150, 16, H - 150);
      g.fillRect(W - 106, 150, 16, H - 150);
      g.fillStyle = K.L('#2a2a2a');
      g.fillRect(20, 20, W - 40, 150);
      const lit = K.night ? (c) => U.shade(c, -0.1) : K.L;
      g.fillStyle = lit(ad[2]);
      g.fillRect(28, 28, W - 56, 134);
      g.fillStyle = lit(ad[3]);
      g.textAlign = 'center';
      g.font = 'bold 76px Teko, Impact, sans-serif';
      g.fillText(ad[0], W / 2, 104);
      g.font = '34px Teko, Impact, sans-serif';
      g.fillText(ad[1].toUpperCase(), W / 2, 146);
      if (K.night) {
        const grad = g.createLinearGradient(0, 0, 0, 170);
        grad.addColorStop(0, 'rgba(255,240,200,0.35)');
        grad.addColorStop(1, 'rgba(255,240,200,0)');
        g.fillStyle = grad;
        g.fillRect(28, 28, W - 56, 134);
      }
    }, { cw: 0.5 });
  };

  GEN.signL = function (K) { return curveSign(K, -1); };
  GEN.signR = function (K) { return curveSign(K, 1); };
  function curveSign(K, dir) {
    return makeSprite(130, 240, 300, function (g, W, H) {
      g.fillStyle = K.L('#8a8a8a');
      g.fillRect(W / 2 - 4, 90, 8, H - 90);
      g.fillStyle = K.L('#f2c230');
      poly(g, [W / 2, 6, W - 6, 66, W / 2, 126, 6, 66]);
      g.fill();
      g.strokeStyle = K.L('#111');
      g.lineWidth = 5;
      poly(g, [W / 2, 14, W - 14, 66, W / 2, 118, 14, 66]);
      g.stroke();
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(W / 2 - dir * 4, 100);
      g.quadraticCurveTo(W / 2 - dir * 6, 60, W / 2 + dir * 22, 50);
      g.stroke();
      g.fillStyle = K.L('#111');
      poly(g, [W / 2 + dir * 34, 50, W / 2 + dir * 16, 36, W / 2 + dir * 18, 66]);
      g.fill();
    }, { cw: 0.25 });
  }

  GEN.post = function (K) {
    return makeSprite(40, 130, 80, function (g, W, H) {
      g.fillStyle = K.L('#f0f0f0');
      g.fillRect(8, 6, W - 16, H - 6);
      g.fillStyle = K.L('#bbbbbb');
      g.fillRect(8, 6, 8, H - 6);
      g.fillStyle = '#e0302a';
      g.fillRect(10, 16, W - 20, 18);
    }, { cw: 0.6 });
  };
  GEN.fence = function (K) {
    return makeSprite(300, 120, 700, function (g, W, H) {
      g.fillStyle = K.L('#7a5a3a');
      for (const x of [16, W / 2 - 6, W - 28]) g.fillRect(x, 10, 12, H - 10);
      g.fillStyle = K.L('#8f6c48');
      g.fillRect(6, 30, W - 12, 10);
      g.fillRect(6, 66, W - 12, 10);
    }, { cw: 0.9 });
  };
  GEN.hydrant = function (K) {
    return makeSprite(70, 100, 120, function (g, W, H) {
      g.fillStyle = K.L('#c8302a');
      rrect(g, 18, 20, 34, H - 20, 8);
      g.fill();
      g.fillRect(8, 44, W - 16, 14);
      circle(g, W / 2, 20, 16);
      g.fill();
    }, { cw: 0.8 });
  };

  GEN.lamp = function (K, theme, dir) {
    const W = 300, H = 640;
    return makeSprite(W, H, 1000, function (g) {
      const px = dir > 0 ? 60 : W - 60;
      const hx = px + dir * 170;
      if (K.night) {
        const glow = g.createRadialGradient(hx, 70, 4, hx, 70, 120);
        glow.addColorStop(0, 'rgba(255,230,170,0.95)');
        glow.addColorStop(0.25, 'rgba(255,200,120,0.35)');
        glow.addColorStop(1, 'rgba(255,190,110,0)');
        g.fillStyle = glow;
        g.fillRect(hx - 130, 0, 260, 220);
      }
      g.fillStyle = K.L('#4a4d55');
      g.fillRect(px - 7, 60, 14, H - 60);
      g.fillRect(px - 14, H - 30, 28, 30);
      g.strokeStyle = K.L('#4a4d55');
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(px, 70);
      g.quadraticCurveTo(px, 50, px + dir * 40, 50);
      g.lineTo(hx, 56);
      g.stroke();
      g.fillStyle = K.L('#3a3c42');
      poly(g, [hx - 32, 52, hx + 32, 52, hx + 24, 70, hx - 24, 70]);
      g.fill();
      g.fillStyle = K.night ? '#fff4d0' : '#d8d4c4';
      g.fillRect(hx - 22, 68, 44, 6);
    }, { cw: 0.06 });
  };

  GEN.gantry = function (K, theme, label) {
    const W = 1400, H = 520;
    return makeSprite(W, H, 6200, function (g) {
      g.fillStyle = K.L('#3a3a40');
      g.fillRect(40, 60, 36, H - 60);
      g.fillRect(W - 76, 60, 36, H - 60);
      g.fillStyle = K.L('#22222a');
      g.fillRect(40, 60, 12, H - 60);
      g.fillRect(W - 76, 60, 12, H - 60);
      // checker band
      const top = 40, bh = 150, sq = 25;
      for (let y = 0; y < 2; y++) {
        for (let x = 0; x < W / sq; x++) {
          g.fillStyle = (x + y) % 2 ? K.L('#f2f2f2') : K.L('#111');
          g.fillRect(x * sq, top + y * sq, sq, sq);
          g.fillRect(x * sq, top + bh - sq * (2 - y), sq, sq);
        }
      }
      g.fillStyle = K.L(label === 'FINISH' ? '#c7302a' : '#1f4fa0');
      g.fillRect(0, top + sq * 2, W, bh - sq * 4);
      g.fillStyle = K.L('#ffffff');
      g.font = 'bold 120px Teko, Impact, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(label, W / 2, top + bh / 2 + 8);
    }, { collide: false });
  };

  // ---------------------------------------------------------------------------
  // cars
  // ---------------------------------------------------------------------------
  const CAR_COLORS = ['#c8302a', '#2a5ab0', '#e8e4dc', '#2a2a30', '#3a7a4a', '#d8a020', '#7a3a8a', '#8a8f96', '#1f7a8a', '#b86a2a'];
  const MODELS = {
    sedan: { bodyTop: 104, cabTop: 56, cabIn: 30, cabTopIn: 58, w: 560 },
    hatch: { bodyTop: 98, cabTop: 44, cabIn: 36, cabTopIn: 52, w: 520 },
    sports: { bodyTop: 118, cabTop: 80, cabIn: 40, cabTopIn: 72, w: 580, spoiler: true },
    van: { bodyTop: 26, cabTop: 26, cabIn: 0, cabTopIn: 0, w: 600, box: true },
    pickup: { bodyTop: 108, cabTop: 50, cabIn: 54, cabTopIn: 72, w: 600, bed: true },
    taxi: { bodyTop: 104, cabTop: 56, cabIn: 30, cabTopIn: 58, w: 560, taxi: true },
  };

  function drawCar(K, model, color, front) {
    const M = MODELS[model];
    const W = 340, H = 220, pad = 40, bw = W - pad * 2, x0 = pad, x1 = W - pad, ground = 206;
    return makeSprite(W, H, (M.w * W) / bw, function (g) {
      const body = K.L(color), dark = K.L(U.shade(color, -0.35)), lite = K.L(U.shade(color, 0.25));
      const tire = K.L('#141416');
      // tyres
      g.fillStyle = tire;
      rrect(g, x0 + 10, ground - 40, 42, 40, 6);
      g.fill();
      rrect(g, x1 - 52, ground - 40, 42, 40, 6);
      g.fill();
      // cabin / glass
      const cabBottom = M.bodyTop + 4;
      if (!M.box) {
        g.fillStyle = body;
        poly(g, [x0 + M.cabIn, cabBottom, x1 - M.cabIn, cabBottom, x1 - M.cabTopIn, M.cabTop, x0 + M.cabTopIn, M.cabTop]);
        g.fill();
        const glass = g.createLinearGradient(0, M.cabTop, 0, cabBottom);
        glass.addColorStop(0, K.night ? '#0c0e16' : (front ? '#7a9ab8' : '#2a3442'));
        glass.addColorStop(1, K.night ? '#141824' : (front ? '#3a4a5c' : '#141a24'));
        g.fillStyle = glass;
        poly(g, [x0 + M.cabIn + 9, cabBottom - 2, x1 - M.cabIn - 9, cabBottom - 2, x1 - M.cabTopIn - 6, M.cabTop + 7, x0 + M.cabTopIn + 6, M.cabTop + 7]);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.18)';
        poly(g, [x1 - M.cabTopIn - 30, M.cabTop + 8, x1 - M.cabTopIn - 14, M.cabTop + 8, x1 - M.cabIn - 40, cabBottom - 3, x1 - M.cabIn - 56, cabBottom - 3]);
        g.fill();
      }
      // body
      g.fillStyle = body;
      rrect(g, x0, M.bodyTop, bw, ground - 22 - M.bodyTop, M.box ? 18 : 14);
      g.fill();
      g.fillStyle = lite;
      g.fillRect(x0 + 8, M.bodyTop + 4, bw - 16, 5);
      g.fillStyle = dark;
      g.fillRect(x0, ground - 46, bw, 24);
      if (M.box) {
        g.fillStyle = K.night ? '#0c0e16' : (front ? '#5a7a98' : '#1a2230');
        rrect(g, x0 + 16, M.bodyTop + 16, bw - 32, 40, 6);
        g.fill();
        if (!front) {
          g.fillStyle = dark;
          g.fillRect(W / 2 - 2, M.bodyTop + 10, 4, ground - 60 - M.bodyTop);
        }
      }
      if (M.bed && !front) {
        g.fillStyle = dark;
        g.fillRect(x0 + 6, M.bodyTop + 2, bw - 12, 8);
      }
      if (M.taxi) {
        g.fillStyle = K.night ? '#fff2a0' : '#f6e27a';
        rrect(g, W / 2 - 26, M.cabTop - 16, 52, 16, 4);
        g.fill();
        g.fillStyle = '#222';
        g.font = 'bold 13px sans-serif';
        g.textAlign = 'center';
        g.fillText('TAXI', W / 2, M.cabTop - 4);
        g.fillStyle = '#222';
        for (let i = 0; i < 12; i++) if (i % 2) g.fillRect(x0 + i * (bw / 12), ground - 76, bw / 12, 7);
      }
      if (M.spoiler && !front) {
        g.fillStyle = dark;
        g.fillRect(x0 - 4, M.bodyTop - 14, bw + 8, 9);
        g.fillRect(x0 + 30, M.bodyTop - 8, 8, 12);
        g.fillRect(x1 - 38, M.bodyTop - 8, 8, 12);
      }
      const ly = M.bodyTop + (M.box ? 70 : 14);
      if (front) {
        g.fillStyle = K.L('#1a1a1e');
        rrect(g, W / 2 - 60, ly + 6, 120, 30, 6);
        g.fill();
        g.fillStyle = K.night ? '#fffbe8' : K.L('#e8e6dc');
        rrect(g, x0 + 10, ly, 50, 22, 8);
        g.fill();
        rrect(g, x1 - 60, ly, 50, 22, 8);
        g.fill();
        g.fillStyle = K.L('#e8a030');
        g.fillRect(x0 + 10, ly + 26, 26, 8);
        g.fillRect(x1 - 36, ly + 26, 26, 8);
        if (K.night) glowAt(g, [[x0 + 35, ly + 11], [x1 - 35, ly + 11]], 'rgba(255,250,225,', 70);
      } else {
        g.fillStyle = K.night ? '#ff3a2a' : K.L('#c41e1e');
        rrect(g, x0 + 6, ly, 48, 18, 4);
        g.fill();
        rrect(g, x1 - 54, ly, 48, 18, 4);
        g.fill();
        g.fillStyle = K.L('#f0f0f0');
        g.fillRect(x0 + 40, ly + 4, 10, 8);
        g.fillRect(x1 - 50, ly + 4, 10, 8);
        g.fillStyle = K.L('#e8e2c0');
        g.fillRect(W / 2 - 26, ground - 74, 52, 22);
        if (K.night) glowAt(g, [[x0 + 30, ly + 9], [x1 - 30, ly + 9]], 'rgba(255,40,30,', 46);
      }
    }, { cw: (bw / W) * 0.92 });
  }
  function glowAt(g, points, rgbaPrefix, r) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const [x, y] of points) {
      const grad = g.createRadialGradient(x, y, 1, x, y, r);
      grad.addColorStop(0, rgbaPrefix + '0.9)');
      grad.addColorStop(0.3, rgbaPrefix + '0.35)');
      grad.addColorStop(1, rgbaPrefix + '0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.restore();
  }

  // ---------------------------------------------------------------------------
  // background layers
  // ---------------------------------------------------------------------------
  function genLayer(K, theme, def) {
    const W = 2048, H = def.kind === 'clouds' ? 420 : 400;
    const c = U.makeCanvas(W, H);
    const g = c.getContext('2d');
    const rng = K.rng;
    const col = K.L(def.color);
    const base = K.L(def.base || def.color);

    function fillRidge(heightAt, step) {
      const ys = [];
      for (let x = 0; x <= W; x += step) ys.push(heightAt(x / W));
      const grad = g.createLinearGradient(0, H * 0.1, 0, H);
      grad.addColorStop(0, col);
      grad.addColorStop(1, base);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, H);
      ys.forEach((y, i) => g.lineTo(i * step, y));
      g.lineTo(W, H);
      g.closePath();
      g.fill();
      return ys;
    }

    if (def.kind === 'clouds') {
      g.fillStyle = def.color;
      for (let i = 0; i < 14; i++) {
        const cx = rng() * W, cy = H * rng.range(0.2, 0.8);
        const s = rng.range(0.5, 1.3);
        for (let k = 0; k < 9; k++) {
          const ox = rng.range(-110, 110) * s, oy = rng.range(-18, 12) * s, r = rng.range(26, 56) * s;
          for (const wrap of [-W, 0, W]) {
            g.globalAlpha = 0.16;
            ellipse(g, cx + ox + wrap, cy + oy, r * 1.6, r * 0.8);
            g.fill();
            g.globalAlpha = 0.12;
            ellipse(g, cx + ox + wrap, cy + oy - r * 0.2, r, r * 0.55);
            g.fill();
          }
        }
      }
      g.globalAlpha = 1;
    } else if (def.kind === 'mountains') {
      const n = periodicNoise(rng, def.small ? [3, 5, 9, 17, 29] : [2, 3, 5, 9, 15, 27]);
      const ys = fillRidge((x) => H * (0.08 + 0.85 * (1 - Math.pow(n(x, true), 1.6))), 2);
      // slope shading
      for (let i = 1; i < ys.length; i++) {
        const slope = ys[i] - ys[i - 1];
        if (slope > 0) {
          g.fillStyle = 'rgba(10,20,40,' + Math.min(0.32, slope * 0.12) + ')';
          g.fillRect((i - 1) * 2, ys[i - 1], 2, H - ys[i - 1]);
        }
      }
      if (def.snow) {
        const snowLine = H * (def.small ? 0.45 : 0.4);
        g.fillStyle = K.L('#f4f8fc');
        for (let i = 0; i < ys.length; i++) {
          if (ys[i] < snowLine) {
            const depth = (snowLine - ys[i]) * 0.65 + Math.sin(i * 1.7) * 4;
            g.fillRect(i * 2, ys[i], 2, depth);
          }
        }
        for (let i = 1; i < ys.length; i++) {
          const slope = ys[i] - ys[i - 1];
          if (slope > 0 && ys[i] < snowLine) {
            g.fillStyle = 'rgba(90,120,170,' + Math.min(0.35, slope * 0.12) + ')';
            g.fillRect((i - 1) * 2, ys[i - 1], 2, (snowLine - ys[i]) * 0.65);
          }
        }
      }
    } else if (def.kind === 'mesas') {
      const n = periodicNoise(rng, def.small ? [4, 7, 13] : [2, 3, 5, 11]);
      const d = periodicNoise(rng, [40, 67]);
      const ys = fillRidge((x) => {
        const v = n(x);
        const plateau = U.clamp((v - 0.5) * 9, 0, 1);
        return H * (0.92 - plateau * (def.small ? 0.5 : 0.75) - v * 0.12 + d(x) * 0.02);
      }, 2);
      g.save();
      g.beginPath();
      g.moveTo(0, H);
      ys.forEach((y, i) => g.lineTo(i * 2, y));
      g.lineTo(W, H);
      g.clip();
      for (let y = 0; y < H; y += 13) {
        g.fillStyle = 'rgba(60,20,20,0.12)';
        g.fillRect(0, y, W, 4);
      }
      for (let i = 1; i < ys.length; i++) {
        const slope = ys[i] - ys[i - 1];
        if (slope > 1) {
          g.fillStyle = 'rgba(40,10,30,0.35)';
          g.fillRect((i - 1) * 2, ys[i - 1], 2, H);
        }
      }
      g.restore();
    } else if (def.kind === 'hills' || def.kind === 'headlands') {
      const n = periodicNoise(rng, def.kind === 'headlands' ? [3, 5, 8] : [2, 4, 7, 13]);
      const gappy = def.gappy || def.kind === 'headlands';
      const ys = fillRidge((x) => {
        let v = n(x);
        if (gappy) v = Math.max(0, v - 0.42) * 2.4;
        return H * (1 - v * (def.kind === 'headlands' ? 0.45 : 0.8)) + 2;
      }, 4);
      if (def.kind === 'hills') {
        g.fillStyle = K.L(U.shade(def.color, -0.25));
        for (let i = 0; i < ys.length; i += 2) {
          if (ys[i] < H - 8 && rng() < 0.6) {
            ellipse(g, i * 4, ys[i] + 3, 5, 4);
            g.fill();
          }
        }
      }
    } else if (def.kind === 'treeline') {
      const n = periodicNoise(rng, [2, 3, 6]);
      const ridge = (x) => H * (0.55 + n(x) * 0.25);
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += 4) g.lineTo(x, ridge(x / W));
      g.lineTo(W, H);
      g.fill();
      let x = 0;
      while (x < W) {
        const h = rng.range(40, 110), w = h * rng.range(0.28, 0.4);
        const y = ridge(x / W) + 6;
        for (const wrap of [0, x + w > W ? -W : null]) {
          if (wrap === null) continue;
          poly(g, [x + wrap - w / 2, y, x + wrap, y - h, x + wrap + w / 2, y]);
          g.fill();
        }
        x += rng.range(6, 16);
      }
      const fade = g.createLinearGradient(0, H * 0.4, 0, H);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      fade.addColorStop(1, U.rgba(base, 0.6));
      g.fillStyle = fade;
      g.fillRect(0, 0, W, H);
    } else if (def.kind === 'skyline') {
      let x = 0;
      while (x < W) {
        const w = Math.min(W - x, rng.range(40, 110));
        const h = H * rng.range(def.near ? 0.25 : 0.35, def.near ? 0.7 : 0.95);
        const top = H - h;
        g.fillStyle = col;
        g.fillRect(x, top, w + 1, h);
        if (rng() < 0.3) g.fillRect(x + w * 0.45, top - 30, 3, 30);
        if (rng() < 0.15) {
          g.fillStyle = '#ff3a3a';
          g.fillRect(x + w * 0.45 - 1, top - 32, 5, 4);
        }
        for (let wy = top + 8; wy < H - 6; wy += 9) {
          for (let wx = x + 5; wx < x + w - 5; wx += 8) {
            if (rng() < 0.22) {
              g.fillStyle = def.windows;
              g.globalAlpha = rng.range(0.4, 1);
              g.fillRect(wx, wy, 3, 4);
              g.globalAlpha = 1;
            }
          }
        }
        if (def.near && rng() < 0.12) {
          const neon = rng.pick(['#ff3fa4', '#3ff0ff', '#ffe03f']);
          g.save();
          g.shadowColor = neon;
          g.shadowBlur = 14;
          g.fillStyle = neon;
          g.fillRect(x + 6, top + 14, w - 12, 6);
          g.restore();
        }
        x += w;
      }
    }
    return { img: c, def, baseColor: base };
  }

  // ---------------------------------------------------------------------------
  // theme bundle
  // ---------------------------------------------------------------------------
  A.buildTheme = function (theme) {
    const rng = U.rng(theme.seed * 7 + 13);
    const night = !!theme.night;
    const K = {
      rng, night,
      L: night ? (c) => U.mix(c, '#0a0c1c', 0.62) : (c) => c,
    };
    const sprites = {};
    const variants = (name, n, fn) => {
      sprites[name] = [];
      for (let i = 0; i < n; i++) sprites[name].push(fn(i));
    };
    const used = new Set();
    for (const list of [theme.left, theme.right, theme.farLeft, theme.farRight]) {
      for (const [name] of list || []) used.add(name);
    }
    used.forEach((name) => {
      if (name === 'pinesnow') variants(name, 3, () => GEN.pine(K, true));
      else if (name === 'lamp') {
        sprites.lampL = [GEN.lamp(K, theme, 1)];
        sprites.lampR = [GEN.lamp(K, theme, -1)];
      } else if (name === 'sign') {
        sprites.signL = [GEN.signL(K)];
        sprites.signR = [GEN.signR(K)];
      } else if (GEN[name]) variants(name, name === 'building' ? 6 : name === 'billboard' ? 3 : 3, () => GEN[name](K, theme));
    });
    sprites.start = [GEN.gantry(K, theme, 'START')];
    sprites.finish = [GEN.gantry(K, theme, 'FINISH')];

    const cars = {};
    const models = theme.id === 'city' ? ['sedan', 'hatch', 'van', 'taxi', 'taxi', 'sports'] : ['sedan', 'hatch', 'van', 'pickup', 'sports'];
    cars.models = models;
    cars.get = function (model, colorIdx, front) {
      const key = model + colorIdx + (front ? 'f' : 'r');
      if (!cars[key]) {
        const color = model === 'taxi' ? '#f2c230' : CAR_COLORS[colorIdx % CAR_COLORS.length];
        cars[key] = drawCar(K, model, color, front);
      }
      return cars[key];
    };

    const layers = theme.layers.map((def) => genLayer(K, theme, def));
    return { sprites, cars, layers, night, K };
  };

  A.CAR_COLOR_COUNT = CAR_COLORS.length;

  // ---------------------------------------------------------------------------
  // bikes and riders (vector, per frame). One unit ~ 1/80 of the bike's width.
  // ---------------------------------------------------------------------------
  function limb(g, pts, width, color, outline) {
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.lineWidth = width + 2.6;
    g.strokeStyle = outline;
    g.stroke();
    g.lineWidth = width;
    g.strokeStyle = color;
    g.stroke();
  }
  function shapeFill(g, fill, outline) {
    g.fillStyle = fill;
    g.fill();
    if (outline) g.stroke();
  }

  // Attack extension curve: pulls back during the windup, snaps out, then eases home.
  function attackExtension(a) {
    const w = a.windup / a.dur;
    const p = a.t / a.dur;
    if (p < w) return -0.35 * (p / w);
    const e = (p - w) / (1 - w);
    return e < 0.3 ? -0.35 + 1.35 * (e / 0.3) : 1 - (e - 0.3) / 0.7;
  }

  function drawWeapon(g, T, type, hx, hy, d, swing, t) {
    if (type === 'club' || type === 'baton') {
      const ang = U.lerp(-2.0, 0.3, swing);
      const len = type === 'club' ? 36 : 30;
      const ex = hx + d * Math.cos(ang) * len, ey = hy + Math.sin(ang) * len;
      g.lineCap = 'round';
      limb(g, [hx, hy, ex, ey], type === 'club' ? 6 : 4, T(type === 'club' ? '#7a5532' : '#1a1a1e'), T('#120c08'));
    } else if (type === 'chain') {
      const ang = U.lerp(-2.4, 0.15, swing);
      const len = 46;
      g.fillStyle = T('#c8ccd4');
      g.strokeStyle = T('#3a3e46');
      g.lineWidth = 1;
      for (let i = 1; i <= 12; i++) {
        const k = i / 12;
        const sag = Math.sin(k * Math.PI) * (6 + 6 * (1 - swing)) + Math.sin(t * 20 + i) * 1.2;
        const x = hx + d * Math.cos(ang) * len * k;
        const y = hy + Math.sin(ang) * len * k + sag;
        ellipse(g, x, y, 2.3, 1.6, i % 2 ? 0.6 : -0.6);
        g.fill();
        g.stroke();
      }
    }
  }

  // o: { lean, jacket, helmet, stripe, pants, bike, trim, cop, weapon, attack, flash,
  //      fog, fogColor, night, braking, nitro, t, lift, pipes, flashLights }
  A.drawBike = function (g, x, y, s, o) {
    const fogT = o.fog || 0, fogC = o.fogColor || '#888';
    const flash = o.flash || 0;
    const T = function (c) {
      if (flash > 0) c = U.mix(c, '#ffffff', flash * 0.7);
      return fogT > 0.01 ? U.mix(c, fogC, fogT) : c;
    };
    const OL = T('#0b0b0d');
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    // shadow on the road
    const lift = (o.lift || 0) / s;
    g.fillStyle = 'rgba(0,0,0,' + (0.38 * Math.max(0.2, 1 - lift / 120) * (1 - fogT)).toFixed(3) + ')';
    ellipse(g, 0, 0, 32, 5.5);
    g.fill();
    g.translate(0, -lift + (o.jitter || 0));
    g.rotate((o.lean || 0) * 0.42);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.lineWidth = 1.4;
    g.strokeStyle = OL;

    const atk = o.attack;
    const atkSide = atk ? atk.side : 0;
    const ext = atk ? attackExtension(atk) : 0;
    const kick = atk && atk.type === 'kick';
    const swing = atk ? U.clamp((atk.t - atk.windup) / (atk.dur - atk.windup) * 2.2, 0, 1) : 0;

    // tyre
    rrect(g, -7.5, -30, 15, 30, 6.5);
    shapeFill(g, T('#18181b'), true);
    g.strokeStyle = T('#34343a');
    g.lineWidth = 1;
    const ph = ((o.t || 0) * 30) % 6;
    for (let yy = -27 + ph; yy < -2; yy += 6) {
      g.beginPath();
      g.moveTo(-5, yy);
      g.lineTo(5, yy);
      g.stroke();
    }
    g.strokeStyle = OL;
    g.lineWidth = 1.4;

    // exhausts
    const pipes = o.pipes || 1;
    for (let i = 0; i < pipes; i++) {
      const d = pipes === 2 ? (i ? 1 : -1) : 1;
      poly(g, [d * 9, -38, d * 21, -36, d * 22, -27, d * 10, -27]);
      shapeFill(g, T('#b9bdc6'), true);
      circle(g, d * 17, -31.5, 3.6);
      shapeFill(g, T('#2a2a2e'), true);
      if (o.nitro) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        const fl = 9 + Math.random() * 6;
        const grad = g.createRadialGradient(d * 17, -31.5, 0, d * 17, -31.5, fl);
        grad.addColorStop(0, 'rgba(220,240,255,1)');
        grad.addColorStop(0.35, 'rgba(90,150,255,0.85)');
        grad.addColorStop(1, 'rgba(255,120,40,0)');
        g.fillStyle = grad;
        circle(g, d * 17, -31.5, fl);
        g.fill();
        g.restore();
      }
    }

    // swingarm hugger
    poly(g, [-9.5, -36, 9.5, -36, 7.5, -25, -7.5, -25]);
    shapeFill(g, T(o.trim || '#222'), true);

    // side fairings / tank
    for (const d of [-1, 1]) {
      poly(g, [d * 13, -66, d * 25, -60, d * 25, -44, d * 13, -46]);
      shapeFill(g, T(U.shade(o.bike, d > 0 ? 0.12 : -0.18)), true);
    }

    // tail cowl, light, plate
    poly(g, [-15.5, -52, 15.5, -52, 12, -38, -12, -38]);
    shapeFill(g, T(o.bike), true);
    g.fillStyle = T(U.shade(o.bike, 0.3));
    g.fillRect(-13, -51, 26, 2);
    rrect(g, -8.5, -49, 17, 5.5, 2);
    shapeFill(g, o.braking ? '#ff5a40' : T('#c41f24'), true);
    g.fillStyle = T('#e8e2c8');
    g.fillRect(-6, -37.5, 12, 7);
    if (o.cop) {
      const on = Math.floor((o.t || 0) * 8) % 2;
      g.fillStyle = on ? '#ff2a2a' : '#5a1010';
      g.fillRect(-14, -58, 8, 5);
      g.fillStyle = on ? '#1a3a8a' : '#3a8aff';
      g.fillRect(6, -58, 8, 5);
    }
    if ((o.night || o.braking) && fogT < 0.9) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      const r = o.braking ? 16 : 11;
      const grad = g.createRadialGradient(0, -46, 0, 0, -46, r);
      grad.addColorStop(0, 'rgba(255,60,40,0.8)');
      grad.addColorStop(1, 'rgba(255,40,30,0)');
      g.fillStyle = grad;
      circle(g, 0, -46, r);
      g.fill();
      if (o.cop) {
        const on = Math.floor((o.t || 0) * 8) % 2;
        const cx = on ? -10 : 10;
        const grad2 = g.createRadialGradient(cx, -56, 0, cx, -56, 26);
        grad2.addColorStop(0, on ? 'rgba(255,50,50,0.9)' : 'rgba(80,140,255,0.9)');
        grad2.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad2;
        circle(g, cx, -56, 26);
        g.fill();
      }
      g.restore();
    }

    // seat
    poly(g, [-11, -57, 11, -57, 13.5, -51, -13.5, -51]);
    shapeFill(g, T('#141416'), true);

    // legs
    const pants = T(o.pants || '#25252b');
    for (const d of [-1, 1]) {
      if (kick && d === atkSide) {
        const e = Math.max(0, ext);
        const knee = [d * (25 + 8 * e), -56 + 4 * e];
        const foot = [d * (24 + 36 * e), -42 - 6 * e];
        limb(g, [d * 8, -58, knee[0], knee[1], foot[0], foot[1]], 10, pants, OL);
        rrect(g, foot[0] - 5, foot[1] - 4, 10, 8, 3);
        shapeFill(g, T('#1a1412'), true);
      } else {
        limb(g, [d * 8, -58, d * 24, -51, d * 19.5, -36], 10, pants, OL);
        rrect(g, d * 19.5 - 5, -38, 10, 8, 3);
        shapeFill(g, T('#1a1412'), true);
      }
    }

    // handlebar & mirrors
    g.lineWidth = 2.6;
    g.strokeStyle = T('#1c1c20');
    g.beginPath();
    g.moveTo(-31, -66);
    g.lineTo(31, -66);
    g.stroke();
    g.lineWidth = 1.4;
    for (const d of [-1, 1]) {
      g.strokeStyle = T('#2a2a2e');
      g.beginPath();
      g.moveTo(d * 27, -67);
      g.lineTo(d * 33, -78);
      g.stroke();
      g.strokeStyle = OL;
      ellipse(g, d * 34.5, -80, 4.8, 3.2);
      shapeFill(g, T('#2a2c30'), true);
    }

    // torso (twisted toward the attack side)
    g.save();
    g.translate(atkSide * 2.5 * Math.max(0, ext), 0);
    const jacket = T(o.jacket);
    g.beginPath();
    g.moveTo(-13, -56);
    g.lineTo(13, -56);
    g.lineTo(20, -80);
    g.quadraticCurveTo(19, -87, 10, -88);
    g.lineTo(-10, -88);
    g.quadraticCurveTo(-19, -87, -20, -80);
    g.closePath();
    shapeFill(g, jacket, true);
    g.fillStyle = T(U.shade(o.jacket, 0.14));
    poly(g, [1, -56, 13, -56, 20, -80, 10, -87, 1, -87]);
    g.fill();
    if (o.stripe) {
      g.fillStyle = T(o.stripe);
      g.fillRect(-7, -86, 3.2, 29);
      g.fillRect(4, -86, 3.2, 29);
    }
    if (o.cop) {
      g.fillStyle = T('#d8c040');
      circle(g, 0, -73, 4);
      g.fill();
    }
    g.fillStyle = T(U.shade(o.jacket, -0.25));
    g.fillRect(-13, -59, 26, 3);

    // arms
    const glove = T('#141416');
    for (const d of [-1, 1]) {
      const attacking = atk && !kick && d === atkSide;
      if (attacking) {
        const e = ext;
        const hand = [d * (28 + 36 * Math.max(0, e)), -86 - 6 * Math.max(0, -e) + 2 * Math.max(0, e)];
        const elbow = [d * (25 + 12 * e), -88];
        limb(g, [d * 17, -82, elbow[0], elbow[1], hand[0], hand[1]], 8.5, jacket, OL);
        if (atk.type !== 'fist') drawWeapon(g, T, atk.type, hand[0], hand[1], d, swing, o.t || 0);
        circle(g, hand[0], hand[1], 4.8);
        shapeFill(g, glove, true);
      } else {
        limb(g, [d * 17, -82, d * 27, -75, d * 29.5, -67], 8.5, jacket, OL);
        circle(g, d * 29.5, -67, 4.2);
        shapeFill(g, glove, true);
        if (o.weapon && d === 1 && !atk) {
          if (o.weapon === 'chain') {
            g.fillStyle = T('#c8ccd4');
            for (let i = 1; i < 8; i++) {
              ellipse(g, 30 + Math.sin(i * 0.7 + (o.t || 0) * 6) * 1.5, -67 + i * 3.4, 2, 1.5, i % 2 ? 0.6 : -0.6);
              g.fill();
            }
          } else {
            limb(g, [30, -67, 37, -95], o.weapon === 'baton' ? 4 : 5.5, T(o.weapon === 'club' ? '#7a5532' : '#1a1a1e'), OL);
          }
        }
      }
    }

    // helmet, seen from behind: shaded shell, thin racing stripes, neck roll
    const hg = g.createRadialGradient(4, -101, 1, 0, -96, 13);
    hg.addColorStop(0, T(U.shade(o.helmet, 0.28)));
    hg.addColorStop(0.55, T(o.helmet));
    hg.addColorStop(1, T(U.shade(o.helmet, -0.3)));
    circle(g, 0, -96, 11.8);
    shapeFill(g, hg, true);
    g.save();
    circle(g, 0, -96, 11.8);
    g.clip();
    if (o.stripe) {
      g.fillStyle = T(o.stripe);
      g.fillRect(-3.4, -110, 1.8, 24);
      g.fillRect(1.6, -110, 1.8, 24);
    }
    g.restore();
    g.strokeStyle = T(U.shade(o.helmet, -0.5));
    g.lineWidth = 2.2;
    g.beginPath();
    g.arc(0, -96, 10.4, Math.PI * 0.22, Math.PI * 0.78);
    g.stroke();
    g.strokeStyle = OL;
    g.lineWidth = 1.4;
    g.restore();
    g.restore();
  };

  A.drawFallenBike = function (g, x, y, s, o) {
    const T = (c) => (o.fog > 0.01 ? U.mix(c, o.fogColor, o.fog) : c);
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    ellipse(g, 0, 0, 46, 6);
    g.fill();
    g.rotate(o.rot || 0);
    g.lineWidth = 1.4;
    g.strokeStyle = T('#0b0b0d');
    ellipse(g, -30, -9, 6, 10);
    shapeFill(g, T('#18181b'), true);
    ellipse(g, 32, -9, 6, 10);
    shapeFill(g, T('#18181b'), true);
    poly(g, [-34, -14, 28, -20, 38, -9, -32, -4]);
    shapeFill(g, T(o.bike), true);
    poly(g, [-12, -18, 12, -21, 14, -16, -10, -14]);
    shapeFill(g, T('#141416'), true);
    poly(g, [-20, -6, 6, -4, 6, 1, -22, -1]);
    shapeFill(g, T('#b9bdc6'), true);
    g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(26, -18);
    g.lineTo(32, -32);
    g.stroke();
    g.restore();
  };

  // pose: 'tumble' (rot), 'run' (phase), 'down'
  A.drawRider = function (g, x, y, s, o) {
    const T = (c) => (o.fog > 0.01 ? U.mix(c, o.fogColor, o.fog) : c);
    const OL = T('#0b0b0d');
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    const lift = (o.lift || 0) / s;
    g.fillStyle = 'rgba(0,0,0,' + (0.3 * Math.max(0.2, 1 - lift / 150)).toFixed(3) + ')';
    ellipse(g, 0, 0, 18, 4);
    g.fill();
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.lineWidth = 1.4;
    g.strokeStyle = OL;
    const jacket = T(o.jacket), pants = T(o.pants || '#25252b');
    if (o.pose === 'run') {
      const p = Math.sin(o.phase || 0);
      g.translate(0, -Math.abs(Math.cos(o.phase || 0)) * 3);
      limb(g, [-5, -36, -6 + p * 7, -18, -6 + p * 10, -2], 7, pants, OL);
      limb(g, [5, -36, 6 - p * 7, -18, 6 - p * 10, -2], 7, pants, OL);
      rrect(g, -12, -66, 24, 32, 7);
      shapeFill(g, jacket, true);
      limb(g, [-11, -62, -16, -50 + p * 6, -14 - p * 4, -40], 6, jacket, OL);
      limb(g, [11, -62, 16, -50 - p * 6, 14 + p * 4, -40], 6, jacket, OL);
      circle(g, 0, -76, 10.5);
      shapeFill(g, T(o.helmet), true);
      rrect(g, -7, -80, 14, 7, 3);
      shapeFill(g, T('#1a2230'), true);
    } else {
      g.translate(0, -lift - 14);
      g.rotate(o.rot || 0);
      const f = Math.sin((o.rot || 0) * 2);
      limb(g, [-5, 10, -10 - f * 4, 24, -14, 36], 7, pants, OL);
      limb(g, [5, 10, 12, 22 + f * 4, 16, 34], 7, pants, OL);
      rrect(g, -11, -16, 22, 30, 7);
      shapeFill(g, jacket, true);
      limb(g, [-10, -12, -22, -20 + f * 6, -28, -10], 6, jacket, OL);
      limb(g, [10, -12, 22, -22 - f * 6, 30, -16], 6, jacket, OL);
      circle(g, 0, -26, 10.5);
      shapeFill(g, T(o.helmet), true);
    }
    g.restore();
  };

  return A;
})();
