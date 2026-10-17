// In-race HUD drawn on the game canvas.
RR.HUD = (function () {
  const U = RR.U, D = RR.DATA;
  const H = {};
  const AMBER = '#f2a516', BONE = '#f2efe6', RED = '#e0402a', BLUE = '#6aa8ff', INK = 'rgba(14,12,10,0.62)';
  const FONT = 'Teko, "Arial Narrow", Impact, sans-serif';

  function panel(ctx, x, y, w, h, slant) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(x + slant, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - slant, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
  }
  function text(ctx, s, x, y, size, color, align, weight) {
    ctx.font = (weight || 600) + ' ' + Math.round(size) + 'px ' + FONT;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(s, x, y);
  }
  function bar(ctx, x, y, w, h, pct, color, label, u) {
    pct = U.clamp(pct, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, y, w, h);
    const low = pct < 0.3;
    ctx.fillStyle = low && Math.floor(performance.now() / 180) % 2 ? '#ffffff' : color;
    ctx.fillRect(x, y, w * pct, h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 1; i < 10; i++) ctx.fillRect(x + (w * i) / 10 - 1, y, 2, h);
    if (label) text(ctx, label, x, y - u * 0.5, u * 2.6, BONE, 'left', 500);
  }

  H.draw = function (G) {
    const ctx = RR.Render.ctx, W = RR.Render.W, Ht = RR.Render.H;
    const u = Math.min(Ht / 100, W / 150);
    const P = G.player;
    if (!P) return;
    ctx.save();
    ctx.lineJoin = 'round';

    // ---- position & time ----------------------------------------------------
    const pad = u * 2.4;
    panel(ctx, pad, pad, u * 30, u * 20, u * 2);
    const place = P.place || 15;
    text(ctx, String(place), pad + u * 3, pad + u * 12.6, u * 14, AMBER, 'left', 700);
    const pw = ctx.measureText(String(place)).width;
    text(ctx, U.ordinal(place).replace(/\d+/, ''), pad + u * 3 + pw + u * 0.6, pad + u * 6.6, u * 4.6, AMBER, 'left', 600);
    text(ctx, '/ ' + G.racers.length, pad + u * 3 + pw + u * 0.6, pad + u * 12.2, u * 4, BONE, 'left', 400);
    ctx.fillStyle = 'rgba(242,239,230,0.18)';
    ctx.fillRect(pad + u * 2.6, pad + u * 14.2, u * 24.4, 1);
    text(ctx, U.formatTime(G.raceTime), pad + u * 3, pad + u * 18.4, u * 4, BONE, 'left', 500);
    text(ctx, 'LEVEL ' + G.level.n, pad + u * 26.6, pad + u * 18.2, u * 3, 'rgba(242,239,230,0.7)', 'right', 400);

    // ---- rider & bike condition ------------------------------------------------
    const by = pad + u * 22;
    panel(ctx, pad, by, u * 30, u * 15, u * 2);
    bar(ctx, pad + u * 3, by + u * 4.8, u * 23, u * 2, P.stamina / P.maxStamina, AMBER, 'RIDER', u);
    bar(ctx, pad + u * 3, by + u * 10.4, u * 23, u * 2, P.bikeHp / 100, '#e8e2d4', 'BIKE', u);
    const wpn = P.weapon ? D.WEAPONS[P.weapon].name.toUpperCase() : 'FISTS';
    text(ctx, wpn, pad + u * 26, by + u * 3.2 + u * 1, u * 2.6, P.weapon ? '#ffd36a' : 'rgba(242,239,230,0.6)', 'right', 500);

    // ---- speedometer ----------------------------------------------------------
    const r = u * 9.5, cx = W - pad - r - u, cy = pad + r + u;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(cx, cy, r + u * 1.2, 0, Math.PI * 2);
    ctx.fill();
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, maxMph = 240;
    const mph = Math.round(P.speed / G.MPH);
    ctx.lineWidth = u * 0.5;
    for (let m = 0; m <= maxMph; m += 20) {
      const a = a0 + (a1 - a0) * (m / maxMph);
      const big = m % 40 === 0;
      ctx.strokeStyle = m >= 180 ? RED : 'rgba(242,239,230,0.75)';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * (big ? 0.78 : 0.85), cy + Math.sin(a) * r * (big ? 0.78 : 0.85));
      ctx.lineTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95);
      ctx.stroke();
    }
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = u * 0.9;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.98, a0, a0 + (a1 - a0) * Math.min(1, mph / maxMph));
    ctx.stroke();
    const na = a0 + (a1 - a0) * Math.min(1, mph / maxMph);
    ctx.strokeStyle = '#ff5a3a';
    ctx.lineWidth = u * 0.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(na) * r * 0.8, cy + Math.sin(na) * r * 0.8);
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(cx, cy, u * 1.1, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, String(mph), cx, cy + r * 0.62, u * 5.2, BONE, 'center', 600);
    text(ctx, 'MPH', cx, cy + r * 0.62 + u * 2.6, u * 2.2, 'rgba(242,239,230,0.6)', 'center', 400);
    if (G.bike.nitro > 0) {
      for (let i = 0; i < G.bike.nitro; i++) {
        const on = i < P.nitro;
        const nx = cx - (G.bike.nitro - 1) * u * 2 + i * u * 4;
        ctx.fillStyle = on ? '#7ec0ff' : 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(nx - u * 1.3, cy + r + u * 2.4, u * 2.6, u * 1.6, u * 0.4) : ctx.rect(nx - u * 1.3, cy + r + u * 2.4, u * 2.6, u * 1.6);
        ctx.fill();
      }
      text(ctx, 'NITRO', cx, cy + r + u * 6.6, u * 2.2, 'rgba(126,192,255,0.85)', 'center', 500);
    }

    // ---- track progress ---------------------------------------------------------
    const tr = G.track;
    const px0 = W * 0.3, px1 = W * 0.7, py = pad + u * 1.2;
    ctx.fillStyle = 'rgba(14,12,10,0.5)';
    ctx.fillRect(px0 - u, py - u * 1.2, px1 - px0 + u * 2, u * 2.4);
    ctx.fillStyle = 'rgba(242,239,230,0.35)';
    ctx.fillRect(px0, py - 1, px1 - px0, 2);
    const prog = (z) => px0 + (px1 - px0) * U.clamp((z - tr.startZ) / tr.raceLength, 0, 1);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#111' : '#eee';
      ctx.fillRect(px1 + u * 0.4, py - u + (i % 3) * u * 0.66, u * 0.66, u * 0.66);
      ctx.fillStyle = i % 2 ? '#eee' : '#111';
      ctx.fillRect(px1 + u * 1.06, py - u + (i % 3) * u * 0.66, u * 0.66, u * 0.66);
    }
    for (const c of G.cops) {
      ctx.fillStyle = c.ai.pursuit ? BLUE : 'rgba(106,168,255,0.5)';
      ctx.fillRect(prog(c.z) - u * 0.3, py - u * 0.8, u * 0.6, u * 1.6);
    }
    for (const rr of G.racers) {
      if (rr === P) continue;
      ctx.fillStyle = 'rgba(242,239,230,0.85)';
      ctx.beginPath();
      ctx.arc(prog(rr.z), py, u * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.arc(prog(P.z), py, u * 0.95, 0, Math.PI * 2);
    ctx.fill();
    const milesLeft = Math.max(0, (tr.finishZ - P.z) / (G.MPH * 3600));
    text(ctx, milesLeft.toFixed(1) + ' MI TO GO', (px0 + px1) / 2, py + u * 4.2, u * 2.6, 'rgba(242,239,230,0.75)', 'center', 400);

    // ---- nearest rival ------------------------------------------------------------
    const nr = G.nearRival;
    if (nr && G.state !== 'countdown') {
      const w = u * 30, x = W / 2 - w / 2, y = py + u * 6.5;
      panel(ctx, x, y, w, u * 7.4, u * 1.5);
      text(ctx, nr.name.toUpperCase(), x + u * 3, y + u * 4, u * 3.6, nr.isCop ? BLUE : BONE, 'left', 600);
      if (nr.weapon) text(ctx, D.WEAPONS[nr.weapon].name.toUpperCase(), x + w - u * 3, y + u * 4, u * 2.6, '#ffd36a', 'right', 500);
      if (nr.state === 'ride') bar(ctx, x + u * 3, y + u * 5, w - u * 6, u * 1.2, nr.stamina / nr.maxStamina, nr.isCop ? BLUE : RED, null, u);
      else text(ctx, 'DOWN', x + w - u * 3, y + u * 6.4, u * 2.6, AMBER, 'right', 500);
    }

    // ---- messages ---------------------------------------------------------------------
    let my = py + u * (nr ? 19 : 11);
    for (const m of G.messages) {
      const a = Math.min(1, m.t / 0.4, (m.max - m.t) / 0.12 + 0.2);
      ctx.globalAlpha = U.clamp(a, 0, 1);
      ctx.font = '600 ' + Math.round(u * 4) + 'px ' + FONT;
      const tw = ctx.measureText(m.text).width;
      ctx.fillStyle = 'rgba(14,12,10,0.5)';
      ctx.fillRect(W / 2 - tw / 2 - u * 2, my - u * 3.6, tw + u * 4, u * 4.8);
      text(ctx, m.text, W / 2, my, u * 4, m.color, 'center', 600);
      my += u * 5.6;
    }
    ctx.globalAlpha = 1;

    // ---- riders right behind you ---------------------------------------------------------
    if (P.state === 'ride') {
      const stack = { left: 0, right: 0 };
      const behind = G.racers.concat(G.cops)
        .filter((rr) => rr !== P && rr.state === 'ride' && P.z - rr.z > 100 && P.z - rr.z < 2200)
        .sort((a, b) => b.z - a.z);
      for (const rr of behind) {
        const dz = P.z - rr.z;
        if (stack[rr.x < P.x ? 'left' : 'right'] < 3) {
          const left = rr.x < P.x;
          const x = left ? u * 3 : W - u * 3;
          const y = Ht * 0.62 + stack[left ? 'left' : 'right']++ * u * 5;
          const a = 1 - dz / 2200;
          ctx.globalAlpha = 0.4 + a * 0.6;
          ctx.fillStyle = rr.isCop ? BLUE : AMBER;
          ctx.beginPath();
          const s = left ? 1 : -1;
          ctx.moveTo(x, y);
          ctx.lineTo(x + s * u * 2.2, y - u * 1.8);
          ctx.lineTo(x + s * u * 2.2, y + u * 1.8);
          ctx.fill();
          text(ctx, rr.name.toUpperCase(), x + s * u * 3.2, y + u * 1.2, u * 3, BONE, left ? 'left' : 'right', 500);
          ctx.globalAlpha = 1;
        }
      }
    }

    // ---- police lights -------------------------------------------------------------------
    if (G.copAlert > 0.25 && G.state !== 'over') {
      const on = Math.floor(G.time * 6) % 2;
      const a = G.copAlert * 0.35;
      const grd = ctx.createLinearGradient(0, 0, 0, u * 5);
      grd.addColorStop(0, on ? 'rgba(255,40,40,' + a + ')' : 'rgba(60,120,255,' + a + ')');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, u * 5);
    }

    // ---- countdown & banners -------------------------------------------------------------
    if (G.state === 'countdown') {
      const n = Math.ceil(G.countdown - 0.6);
      if (n >= 1 && n <= 3) {
        const f = (G.countdown - 0.6) % 1;
        const s = u * (22 + f * 10);
        ctx.globalAlpha = Math.min(1, f * 2 + 0.3);
        ctx.font = '700 ' + Math.round(s) + 'px ' + FONT;
        ctx.textAlign = 'center';
        ctx.lineWidth = u * 1.2;
        ctx.strokeStyle = 'rgba(14,12,10,0.8)';
        ctx.strokeText(String(n), W / 2, Ht * 0.45);
        ctx.fillStyle = AMBER;
        ctx.fillText(String(n), W / 2, Ht * 0.45);
        ctx.globalAlpha = 1;
      }
      ctx.font = '500 ' + Math.round(u * 3.2) + 'px ' + FONT;
      const hint = 'HOLD THROTTLE AT GO FOR A FAST START';
      const hw = ctx.measureText(hint).width;
      ctx.fillStyle = 'rgba(14,12,10,0.6)';
      ctx.fillRect(W / 2 - hw / 2 - u * 2, Ht * 0.6 - u * 3.4, hw + u * 4, u * 4.6);
      text(ctx, hint, W / 2, Ht * 0.6, u * 3.2, BONE, 'center', 500);
    }
    if (G.banner) {
      const b = G.banner;
      const age = b.max - b.t;
      const pop = Math.min(1, age / 0.18);
      const s = u * 16 * (0.6 + 0.4 * pop);
      ctx.globalAlpha = Math.min(1, b.t / 0.3);
      ctx.font = '700 ' + Math.round(s) + 'px ' + FONT;
      ctx.textAlign = 'center';
      ctx.lineWidth = u * 1.1;
      ctx.strokeStyle = 'rgba(14,12,10,0.85)';
      ctx.strokeText(b.text, W / 2, Ht * 0.44);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, W / 2, Ht * 0.44);
      if (b.sub) {
        ctx.font = '500 ' + Math.round(u * 4.4) + 'px ' + FONT;
        ctx.lineWidth = u * 0.6;
        ctx.strokeText(b.sub, W / 2, Ht * 0.44 + u * 7);
        ctx.fillStyle = BONE;
        ctx.fillText(b.sub, W / 2, Ht * 0.44 + u * 7);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };

  return H;
})();
