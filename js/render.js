// Pseudo-3D renderer: projects road segments front to back, then paints scenery,
// vehicles, riders and particles back to front with hill clipping and fog.
RR.Render = (function () {
  const U = RR.U, T = RR.Track, Art = RR.Art;
  const SEG = T.SEG, ROAD_W = T.ROAD_W;
  const R = {};
  const FOG_LEVELS = 32;

  R.FOV = 100;
  R.CAMERA_HEIGHT = 1000;
  R.DRAW_DISTANCE = 260;
  R.cameraDepth = 1 / Math.tan(((R.FOV / 2) * Math.PI) / 180);
  R.PLAYER_Z = R.CAMERA_HEIGHT * R.cameraDepth * 1.6; // camera-to-player distance
  R.BIKE_W = 360;                                     // world width of a bike sprite (80 bike units)

  let canvas, ctx, W = 1, H = 1;
  let palettes = null, theme = null, art = null;
  let vignette = null, skyGrad = null, stars = null;

  R.init = function (cv) {
    canvas = cv;
    ctx = cv.getContext('2d', { alpha: false });
    R.ctx = ctx;
    R.resize();
    window.addEventListener('resize', R.resize);
  };

  R.resize = function () {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
    const maxPx = 2.1e6;
    if (w * h > maxPx) {
      const k = Math.sqrt(maxPx / (w * h));
      w *= k;
      h *= k;
    }
    canvas.width = Math.max(320, w | 0);
    canvas.height = Math.max(200, h | 0);
    W = canvas.width;
    H = canvas.height;
    R.W = W;
    R.H = H;
    vignette = null;
    skyGrad = null;
  };

  R.setTheme = function (th, bundle) {
    theme = th;
    art = bundle;
    skyGrad = null;
    palettes = buildPalettes(th);
    stars = null;
    if (th.night) {
      stars = U.makeCanvas(1024, 400);
      const g = stars.getContext('2d');
      const rng = U.rng(th.seed);
      for (let i = 0; i < 260; i++) {
        g.fillStyle = 'rgba(255,255,255,' + rng.range(0.25, 0.9).toFixed(2) + ')';
        const s = rng() < 0.08 ? 2 : 1;
        g.fillRect(rng() * 1024, rng() * 400, s, s);
      }
    }
  };

  function buildPalettes(th) {
    const lit = th.lit;
    const pals = [];
    for (let l = 0; l < 4; l++) {
      pals.push([]);
      for (let f = 0; f < FOG_LEVELS; f++) {
        const t = f / (FOG_LEVELS - 1);
        const L = (c, lc) => U.mix(lit && l > 0 && lc ? U.mix(c, lc, l / 3) : c, th.fog, t);
        const pair = (a, la) => [L(a[0], la && la[0]), L(a[1], la && la[1])];
        pals[l].push({
          grass: pair(th.grass, lit && lit.grass),
          grassR: pair(th.grassR || th.grass, lit && lit.grass),
          road: pair(th.road, lit && lit.road),
          rumble: pair(th.rumble, lit && lit.rumble),
          shoulder: pair(th.shoulder, lit && lit.shoulder),
          shoulderR: pair(th.shoulderR || th.shoulder, lit && lit.shoulder),
          lane: L(th.lane, lit && lit.lane),
          center: L(th.center, lit && lit.center),
        });
      }
    }
    return pals;
  }

  // ---------------------------------------------------------------------------
  function project(p, camX, camY, camZ) {
    p.camera.x = -camX;
    p.camera.y = (p.world.y || 0) - camY;
    p.camera.z = p.world.z - camZ;
    p.screen.scale = R.cameraDepth / p.camera.z;
    p.screen.x = W / 2 + p.screen.scale * p.camera.x * W / 2;
    p.screen.y = H / 2 - p.screen.scale * p.camera.y * H / 2;
    p.screen.w = p.screen.scale * ROAD_W * W / 2;
  }

  function quad(x1, y1, x2, y2, x3, y3, x4, y4) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }
  function stripe(x1, y1, w1, x2, y2, w2, at, half) {
    const a1 = x1 + w1 * at, a2 = x2 + w2 * at, h1 = w1 * half, h2 = w2 * half;
    quad(a1 - h1, y1, a1 + h1, y1, a2 + h2, y2, a2 - h2, y2);
  }

  function renderSegment(seg, pal) {
    // overlap neighbouring segments by a pixel so anti-aliasing leaves no seams
    const x1 = seg.p1.screen.x, y1 = seg.p1.screen.y + 0.7, w1 = seg.p1.screen.w;
    const x2 = seg.p2.screen.x, y2 = seg.p2.screen.y - 0.7, w2 = seg.p2.screen.w;
    const li = seg.light ? 0 : 1;
    const top = Math.floor(y2), hgt = Math.ceil(y1) - top + 1;
    ctx.fillStyle = pal.grass[li];
    ctx.fillRect(0, top, W, hgt);
    if (theme.grassR) {
      ctx.fillStyle = pal.grassR[li];
      quad(x1 + w1 * 1.2, y1, W, y1, W, y2, x2 + w2 * 1.2, y2);
    }
    const r1 = w1 * 0.08, r2 = w2 * 0.08, s1 = w1 * 0.2, s2 = w2 * 0.2;
    ctx.fillStyle = pal.shoulder[li];
    quad(x1 - w1 - r1 - s1, y1, x1 - w1 - r1, y1, x2 - w2 - r2, y2, x2 - w2 - r2 - s2, y2);
    ctx.fillStyle = pal.shoulderR[li];
    quad(x1 + w1 + r1, y1, x1 + w1 + r1 + s1, y1, x2 + w2 + r2 + s2, y2, x2 + w2 + r2, y2);
    ctx.fillStyle = pal.rumble[li];
    quad(x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2);
    quad(x1 + w1, y1, x1 + w1 + r1, y1, x2 + w2 + r2, y2, x2 + w2, y2);
    ctx.fillStyle = pal.road[li];
    quad(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2);
    if (w1 > 60) {
      ctx.fillStyle = pal.lane;
      stripe(x1, y1, w1, x2, y2, w2, -0.94, 0.012);
      stripe(x1, y1, w1, x2, y2, w2, 0.94, 0.012);
      if (seg.light) {
        stripe(x1, y1, w1, x2, y2, w2, -0.48, 0.01);
        stripe(x1, y1, w1, x2, y2, w2, 0.48, 0.01);
      }
      ctx.fillStyle = pal.center;
      stripe(x1, y1, w1, x2, y2, w2, -0.022, 0.008);
      stripe(x1, y1, w1, x2, y2, w2, 0.022, 0.008);
    }
  }

  // ---------------------------------------------------------------------------
  function drawBackground(G) {
    if (!skyGrad) {
      skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.62);
      for (const [o, c] of theme.sky) skyGrad.addColorStop(o, c);
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);
    const off = G.bgOffset;
    const lift = U.clamp(G.cam.y / 12000, -1.5, 1.5);

    if (stars) {
      const sw = W, sh = (stars.height * W) / stars.width;
      const sx = -(((off * 0.02 * W) % sw) + sw) % sw;
      ctx.drawImage(stars, sx, 0, sw, sh);
      ctx.drawImage(stars, sx + sw, 0, sw, sh);
    }
    const sun = theme.sun || null;
    if (sun) {
      const sx = ((((sun.x - off * 0.03) % 1) + 1) % 1) * W * 1.4 - W * 0.2;
      const sy = sun.y * H * 0.5 + lift * H * 0.02;
      const r = sun.r * H;
      const glow = ctx.createRadialGradient(sx, sy, r * 0.5, sx, sy, r * 8);
      glow.addColorStop(0, sun.glow);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sx - r * 8, sy - r * 8, r * 16, r * 16);
      ctx.fillStyle = sun.color;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      if (theme.rays) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 6; i++) {
          const a = 0.5 + i * 0.22 + Math.sin(G.time * 0.2 + i) * 0.02;
          ctx.fillStyle = 'rgba(255,250,220,0.045)';
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(a) * H * 2, sy + Math.sin(a) * H * 2);
          ctx.lineTo(sx + Math.cos(a + 0.07) * H * 2, sy + Math.sin(a + 0.07) * H * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
    if (theme.moon) {
      const m = theme.moon;
      const sx = ((((m.x - off * 0.03) % 1) + 1) % 1) * W * 1.4 - W * 0.2;
      const sy = m.y * H * 0.5, r = m.r * H;
      const glow = ctx.createRadialGradient(sx, sy, r, sx, sy, r * 6);
      glow.addColorStop(0, 'rgba(200,210,255,0.25)');
      glow.addColorStop(1, 'rgba(200,210,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sx - r * 6, sy - r * 6, r * 12, r * 12);
      ctx.fillStyle = '#eef0ff';
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(180,185,215,0.5)';
      ctx.beginPath();
      ctx.arc(sx - r * 0.3, sy - r * 0.2, r * 0.25, 0, Math.PI * 2);
      ctx.arc(sx + r * 0.35, sy + r * 0.3, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }

    const horizon = H / 2;
    art.layers.forEach((layer, i) => {
      const def = layer.def;
      const img = layer.img;
      const dh = H * def.h;
      const dw = (img.width * dh) / img.height;
      let x = -((((off + (def.kind === 'clouds' ? G.time * 0.004 : 0)) * def.parallax * W * 4) % dw) + dw) % dw;
      let y;
      if (def.kind === 'clouds') {
        y = def.y * H;
      } else {
        y = horizon - dh + H * 0.012 * (i + 1) + lift * def.parallax * H * 0.25;
      }
      for (; x < W; x += dw) ctx.drawImage(img, x, y, dw + 1, dh);
      if (def.kind !== 'clouds') {
        ctx.fillStyle = layer.baseColor;
        ctx.fillRect(0, y + dh - 1, W, H - y - dh + 1);
      }
    });
    // horizon haze
    const haze = ctx.createLinearGradient(0, horizon - H * 0.12, 0, horizon + H * 0.06);
    haze.addColorStop(0, U.rgba(theme.fog, 0));
    haze.addColorStop(0.7, U.rgba(theme.fog, theme.night ? 0.35 : 0.5));
    haze.addColorStop(1, U.rgba(theme.fog, 0.2));
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon - H * 0.12, W, H * 0.18);
  }

  // ---------------------------------------------------------------------------
  function drawSprite(sp, scale, x, y, clip, fog) {
    const s = sp.s;
    const dw = s.w * scale * W / 2;
    if (dw < 2 || dw > W * 4) return;
    const dh = s.h * scale * W / 2;
    const dx = x - dw / 2, dy = y - dh;
    const clipH = clip ? Math.max(0, y - clip) : 0;
    if (clipH >= dh) return;
    const srcH = s.img.height * (1 - clipH / dh);
    ctx.drawImage(s.img, 0, 0, s.img.width, srcH, dx, dy, dw, dh - clipH);
    if (fog > 0.04 && dw > 5) {
      ctx.globalAlpha = Math.min(1, fog);
      ctx.drawImage(Art.silhouette(s, theme.fog), 0, 0, s.img.width, srcH, dx, dy, dw, dh - clipH);
      ctx.globalAlpha = 1;
    }
  }

  // Screen position of a world point (z, lateral road units, height above road).
  function placeOn(seg, z, xRoad) {
    const p = (z - seg.p1.world.z) / SEG;
    const scale = U.lerp(seg.p1.screen.scale, seg.p2.screen.scale, p);
    return {
      scale,
      x: U.lerp(seg.p1.screen.x, seg.p2.screen.x, p) + scale * xRoad * ROAD_W * W / 2,
      y: U.lerp(seg.p1.screen.y, seg.p2.screen.y, p),
    };
  }
  R.placeOn = placeOn;

  function drawEntity(G, e, seg) {
    // anything squeezed between the lens and the player would fill the screen
    const near = e.z - G.cam.z;
    if (near < R.PLAYER_Z * (e.kind === 'particle' ? 0.9 : 0.8)) return;
    const pos = placeOn(seg, e.z, e.x);
    if (pos.scale <= 0) return;
    const fogAmt = 1 - seg.fog;
    const clipped = pos.y > seg.clip + 1;
    if (clipped) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, seg.clip);
      ctx.clip();
    }
    const unit = pos.scale * W / 2;
    const lift = (e.lift || 0) * pos.scale * H / 2;
    if (e.kind === 'car') {
      const s = e.sprite;
      const dw = s.w * unit, dh = s.h * unit;
      if (dw > 1) {
        ctx.fillStyle = 'rgba(0,0,0,' + (0.35 * (1 - fogAmt)).toFixed(3) + ')';
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, dw * 0.38, dh * 0.06 + 1, 0, 0, Math.PI * 2);
        ctx.fill();
        const bob = Math.sin(G.time * 9 + e.z * 0.01) * dh * 0.004;
        ctx.drawImage(s.img, pos.x - dw / 2, pos.y - dh + bob, dw, dh);
        if (fogAmt > 0.03) {
          ctx.globalAlpha = Math.min(1, fogAmt);
          ctx.drawImage(Art.silhouette(s, theme.fog), pos.x - dw / 2, pos.y - dh + bob, dw, dh);
          ctx.globalAlpha = 1;
        }
      }
    } else if (e.kind === 'bike') {
      const s = (unit * R.BIKE_W) / 80;
      if (s > 0.04) {
        const r = e.r;
        Art.drawBike(ctx, pos.x, pos.y, s, {
          lean: r.lean, jacket: r.look.jacket, helmet: r.look.helmet, stripe: r.look.stripe, pants: r.look.pants,
          bike: r.look.bike, trim: r.look.trim, cop: r.isCop, weapon: r.weapon, attack: r.attack,
          flash: r.flash, fog: fogAmt, fogColor: theme.fog, night: theme.night, braking: r.braking,
          nitro: r.nitroT > 0, t: G.time + r.id, lift, pipes: r.look.pipes,
          jitter: r.air ? 0 : Math.sin(G.time * 70 + r.id) * 0.35 * Math.min(1, r.speed / 4000),
        });
      }
    } else if (e.kind === 'fallen') {
      const s = (unit * R.BIKE_W) / 80;
      if (s > 0.04) Art.drawFallenBike(ctx, pos.x, pos.y, s, { bike: e.r.look.bike, rot: e.rot, fog: fogAmt, fogColor: theme.fog });
    } else if (e.kind === 'rider') {
      const s = (unit * R.BIKE_W) / 80;
      if (s > 0.04) {
        Art.drawRider(ctx, pos.x, pos.y, s, {
          pose: e.pose, rot: e.rot, phase: e.phase, lift, jacket: e.r.look.jacket, helmet: e.r.look.helmet,
          pants: e.r.look.pants, fog: fogAmt, fogColor: theme.fog,
        });
      }
    } else if (e.kind === 'particle') {
      const p = e.p;
      const r = Math.max(0.6, p.size * unit);
      const a = Math.max(0, p.life / p.max) * (1 - fogAmt * 0.8);
      if (p.type === 'spark') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,' + (180 + ((p.seed * 70) | 0)) + ',90,' + a.toFixed(3) + ')';
        ctx.lineWidth = Math.max(1, r * 0.5);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y - lift);
        ctx.lineTo(pos.x - p.vx * unit * ROAD_W * 0.02, pos.y - lift + p.vy * pos.scale * H * 0.00002 * 4);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.globalAlpha = a * (p.type === 'smoke' ? 0.45 : 0.7);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        if (p.type === 'debris') ctx.rect(pos.x - r / 2, pos.y - lift - r / 2, r, r * 0.6);
        else ctx.arc(pos.x, pos.y - lift, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    if (clipped) ctx.restore();
  }

  // ---------------------------------------------------------------------------
  R.draw = function (G) {
    const track = G.track, segs = track.segments, cam = G.cam;
    ctx.save();
    if (G.shake > 0) ctx.translate((Math.random() - 0.5) * G.shake * W * 0.02, (Math.random() - 0.5) * G.shake * H * 0.02);
    drawBackground(G);

    const base = T.findSegment(track, cam.z);
    const basePct = (cam.z - base.p1.world.z) / SEG;
    let maxy = H;
    let x = 0;
    let dx = -(base.curve * basePct);
    const DD = R.DRAW_DISTANCE;
    const pals = palettes;
    let last = base.index;

    for (let n = 0; n < DD; n++) {
      const seg = segs[base.index + n];
      if (!seg) break;
      last = seg.index;
      seg.fog = U.exponentialFog(n / DD, theme.fogDensity);
      seg.clip = maxy;
      project(seg.p1, cam.x - x, cam.y, cam.z);
      project(seg.p2, cam.x - x - dx, cam.y, cam.z);
      x += dx;
      dx += seg.curve;
      if (seg.p1.camera.z <= R.cameraDepth || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;
      const fl = Math.min(FOG_LEVELS - 1, Math.round((1 - seg.fog) * (FOG_LEVELS - 1)));
      renderSegment(seg, pals[seg.lit || 0][fl]);
      maxy = seg.p1.screen.y;
    }

    // headlight pool at night
    if (theme.night && G.player && G.player.state === 'ride') {
      const pseg = T.findSegment(track, G.player.z);
      if (pseg.p1.camera.z > R.cameraDepth) {
        const pos = placeOn(pseg, G.player.z, G.player.x);
        const r = W * 0.32;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const grd = ctx.createRadialGradient(pos.x, pos.y - H * 0.12, 0, pos.x, pos.y - H * 0.12, r);
        grd.addColorStop(0, 'rgba(255,236,190,0.22)');
        grd.addColorStop(1, 'rgba(255,236,190,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y - H * 0.12, r, r * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // scenery and entities, back to front
    const buckets = G.buckets;
    for (let i = last; i >= base.index; i--) {
      const seg = segs[i];
      if (seg.p1.camera.z <= R.cameraDepth * 0.5) continue;
      const scale = seg.p1.screen.scale;
      for (const sp of seg.sprites) {
        drawSprite(sp, scale, seg.p1.screen.x + scale * sp.offset * ROAD_W * W / 2, seg.p1.screen.y, seg.clip, 1 - seg.fog);
      }
      const list = buckets[i];
      if (list) {
        if (list.length > 1) list.sort((a, b) => b.z - a.z);
        for (const e of list) drawEntity(G, e, seg);
      }
    }
    postEffects(G);
    ctx.restore();
  };

  function postEffects(G) {
    const p = G.player;
    if (p && G.showHud) {
      const sp = p.speed / 12000;
      const nitro = p.nitroT > 0;
      if (sp > 0.7 || nitro) {
        const k = nitro ? 1 : (sp - 0.7) / 0.3;
        ctx.save();
        ctx.strokeStyle = nitro ? 'rgba(170,210,255,0.35)' : 'rgba(255,255,255,' + (0.18 * k).toFixed(3) + ')';
        ctx.lineWidth = Math.max(1, W * 0.0015);
        const cx = W / 2, cy = H * 0.45;
        for (let i = 0; i < (nitro ? 26 : 14); i++) {
          const a = Math.random() * Math.PI * 2;
          const r0 = W * (0.32 + Math.random() * 0.2);
          const r1 = r0 + W * (0.08 + Math.random() * 0.15) * (nitro ? 1.6 : 1);
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.7);
          ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.7);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    if (!vignette) {
      vignette = U.makeCanvas(W, H);
      const g = vignette.getContext('2d');
      const grd = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.75);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.5)');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
    }
    ctx.drawImage(vignette, 0, 0);
    if (G.hurt > 0) {
      const grd = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      grd.addColorStop(0, 'rgba(200,20,20,0)');
      grd.addColorStop(1, 'rgba(200,20,20,' + (G.hurt * 0.55).toFixed(3) + ')');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    }
  }

  return R;
})();
