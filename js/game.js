// Race simulation: bike physics, rival AI, brawling, crashes, cops and traffic.
RR.Game = (function () {
  const U = RR.U, D = RR.DATA, T = RR.Track, R = RR.Render, Art = RR.Art, AU = RR.Audio, I = RR.Input;
  const SEG = T.SEG, ROAD_W = T.ROAD_W;
  const GRAV = 10000;           // world units / s^2
  const MPH = 60;               // world units per second, per mph
  const BIKE_HALF = 110;        // half width of a bike for collisions (world units)
  const LANES = [-0.72, -0.3, 0.3, 0.72];
  const RIVAL_BIKES = ['#c4372d', '#26282e', '#e8e4dc', '#2a5ab0', '#d0a020', '#4f7a3a', '#7a3a8a', '#1f7a8a', '#b86a2a', '#8a8f96'];
  const PANTS = ['#25252b', '#2f3540', '#3a3026', '#1e2630', '#3b2b2b'];
  const artCache = {};

  const G = {
    state: 'idle', mode: 'attract', time: 0, raceTime: 0,
    cam: { x: 0, y: 0, z: 0 }, bgOffset: 0, shake: 0, hurt: 0,
    buckets: {}, particles: [], messages: [], racers: [], cops: [], cars: [],
    showHud: false, banner: null, onEnd: null, MPH,
  };

  function getArt(theme) {
    return artCache[theme.id] || (artCache[theme.id] = Art.buildTheme(theme));
  }
  G.getArt = getArt;

  let nextId = 1;
  function makeRacer(o) {
    return Object.assign({
      id: nextId++, name: '', isPlayer: false, isCop: false,
      z: 0, x: 0, y: 0, vy: 0, air: false, speed: 0, vx: 0, lean: 0,
      top: 7000, accel: 2500, handling: 1,
      stamina: 100, maxStamina: 100, bikeHp: 100,
      weapon: null, attack: null, attackCd: 0, flash: 0, invuln: 0, braking: false,
      nitro: 0, nitroT: 0, offroad: false,
      state: 'ride', crash: null, finished: false, finishTime: 0, finishOrder: 0, place: 0,
      knockouts: 0, ai: null, look: {},
    }, o);
  }

  function msg(text, color, dur) {
    G.messages.unshift({ text, color: color || '#f2efe6', t: dur || 2.4, max: dur || 2.4 });
    if (G.messages.length > 4) G.messages.length = 4;
  }
  G.msg = msg;
  function banner(text, sub, color, dur) {
    G.banner = { text, sub: sub || '', color: color || '#f2a516', t: dur || 3, max: dur || 3 };
  }

  // ---------------------------------------------------------------------------
  // race setup
  // ---------------------------------------------------------------------------
  G.setup = function (opts) {
    const theme = D.TRACKS[opts.track], level = D.LEVELS[opts.level];
    const bike = D.BIKES.find((b) => b.id === opts.bike) || D.BIKES[0];
    G.opts = opts;
    G.mode = opts.mode;
    G.theme = theme;
    G.level = level;
    G.bike = bike;
    G.art = getArt(theme);
    G.track = T.build(theme, level, G.art);
    R.setTheme(theme, G.art);
    G.racers = [];
    G.cops = [];
    G.cars = [];
    G.particles = [];
    G.messages = [];
    G.banner = null;
    G.time = 0;
    G.raceTime = 0;
    G.bgOffset = 0;
    G.shake = 0;
    G.hurt = 0;
    G.finishOrder = 0;
    G.outcome = null;
    G.endTimer = 0;
    G.result = null;
    G.nearRival = null;
    G.copAlert = 0;

    const track = G.track;
    const [lo, hi] = level.rivalMph;
    const rivals = D.RIVALS.map((d) => ({ d, k: d.skill + Math.random() * 0.05 })).sort((a, b) => b.k - a.k);
    const rivalRacers = rivals.map(({ d }, rank) => {
      const mph = U.lerp(hi, lo, rank / (rivals.length - 1)) + U.rand(-2, 2);
      const stamina = Math.round(level.stamina * U.rand(0.85, 1.2));
      const armed = Math.random() < level.weaponChance * (d.weapon ? 1 : 0.3);
      return makeRacer({
        name: d.name, top: mph * MPH, accel: mph * MPH * U.rand(0.19, 0.24),
        stamina, maxStamina: stamina,
        weapon: armed ? d.weapon || U.choice(['club', 'chain']) : null,
        look: { jacket: d.jacket, helmet: d.helmet, stripe: d.stripe, pants: U.choice(PANTS), bike: U.choice(RIVAL_BIKES), trim: '#1c1c20', pipes: Math.random() < 0.4 ? 2 : 1 },
        ai: { skill: d.skill, aggression: d.aggression * level.aggression, lane: 0, think: 0, pace: U.rand(0.95, 1), quote: d.quote },
      });
    });

    const P = makeRacer({
      name: 'You', isPlayer: true, top: bike.mph * MPH, accel: bike.mph * MPH * bike.accel * 0.5, handling: bike.handling,
      nitro: bike.nitro, stamina: 100, maxStamina: 100, bikeHp: 100,
      look: { jacket: '#3a3430', helmet: '#f2a516', stripe: '#141414', pants: '#2c3646', bike: bike.color, trim: bike.trim, pipes: bike.cls === 'Rat bike' ? 2 : 1 },
    });
    if (opts.mode === 'attract') P.ai = { skill: 1, aggression: 0, lane: 0.3, think: 0, pace: 1 };
    G.player = P;

    // starting grid: best rivals up front, the player starts near the back
    const grid = rivalRacers.slice(0, 13).concat([P], rivalRacers.slice(13));
    grid.forEach((r, i) => {
      const row = Math.floor(i / 3), col = i % 3;
      r.z = track.startZ - 160 - row * 520 - (col === 1 ? 140 : 0);
      r.x = [-0.55, 0, 0.55][col];
      if (r.ai) r.ai.lane = r.x;
    });
    G.racers = rivalRacers.concat([P]);

    for (let i = 0; i < level.cops; i++) {
      const stamina = 70 + level.n * 15;
      const c = makeRacer({
        name: 'Police', isCop: true, top: Math.max(bike.mph, hi + 6) * MPH * 1.02, accel: hi * MPH * 0.24,
        stamina, maxStamina: stamina, weapon: 'baton',
        look: { jacket: '#1d2b4a', helmet: '#f4f4f4', stripe: '#1d2b4a', pants: '#1a2236', bike: '#f0f0f0', trim: '#1d2b4a', pipes: 1 },
        ai: { cop: true, skill: 1, aggression: 1, lane: 0.3, think: 0, pace: 1, pursuit: false },
      });
      c.z = track.startZ + track.raceLength * (0.12 + (0.8 * (i + Math.random() * 0.6)) / level.cops);
      c.x = 0.3;
      c.speed = 85 * MPH;
      G.cops.push(c);
    }

    const carCount = Math.round(((track.raceLength / SEG) / 46) * theme.traffic * level.traffic);
    for (let i = 0; i < carCount; i++) {
      G.cars.push(makeCar(U.rand(track.startZ + 14000, track.finishZ + 4000), Math.random() < 0.45));
    }

    for (const r of riders()) {
      r.y = T.roadY(track, r.z);
      r.vy = 0;
    }
    G.state = opts.mode === 'attract' ? 'race' : 'countdown';
    G.countdown = 3.6;
    G.lastCount = 4;
    G.showHud = opts.mode !== 'attract';
    G.cam.z = P.z - R.PLAYER_Z;
    G.cam.x = P.x * ROAD_W;
    G.cam.y = P.y + R.CAMERA_HEIGHT;
    I.clear();
    rankRacers();
  };

  function makeCar(z, oncoming) {
    const cars = G.art.cars;
    const model = U.choice(cars.models);
    const col = U.randInt(0, Art.CAR_COLOR_COUNT - 1);
    const lane = oncoming ? U.choice([LANES[0], LANES[1]]) : U.choice([LANES[2], LANES[3]]);
    const mph = U.rand(34, 62);
    return {
      z, x: lane, lane, oncoming, speed: (oncoming ? -1 : 1) * mph * MPH, baseSpeed: mph * MPH,
      sprite: cars.get(model, col, oncoming), honked: false, sideOfPlayer: 0, wob: Math.random() * 10,
    };
  }

  function riders() {
    return G.racers.concat(G.cops);
  }

  // ---------------------------------------------------------------------------
  // particles
  // ---------------------------------------------------------------------------
  function emit(type, z, x, h, n, o) {
    if (Math.abs(z - G.player.z) > 40000) return;
    o = o || {};
    for (let i = 0; i < n && G.particles.length < 500; i++) {
      const life = (o.life || 0.6) * U.rand(0.6, 1.2);
      G.particles.push({
        type, z: z + U.rand(-40, 40), x: x + U.rand(-0.03, 0.03), h: h + U.rand(-20, 20),
        vz: (o.vz || 0) + U.rand(-1, 1) * (o.sz || 600),
        vx: (o.vx || 0) + U.rand(-1, 1) * (o.sx || 0.5),
        vy: (o.vy || 0) + U.rand(0, 1) * (o.sy || 900),
        life, max: life, size: (o.size || 20) * U.rand(0.7, 1.3),
        color: o.color || '#bbb', seed: Math.random(),
      });
    }
  }
  function updateParticles(dt) {
    const ps = G.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) {
        ps.splice(i, 1);
        continue;
      }
      p.z += p.vz * dt;
      p.x += p.vx * dt;
      p.h += p.vy * dt;
      if (p.type === 'smoke' || p.type === 'dust') {
        p.vy *= Math.exp(-2 * dt);
        p.vz *= Math.exp(-2 * dt);
        p.size += dt * (p.type === 'smoke' ? 60 : 40);
      } else {
        p.vy -= GRAV * 0.6 * dt;
        if (p.h < 0) {
          p.h = 0;
          p.vy = -p.vy * 0.35;
          p.vz *= 0.7;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // combat
  // ---------------------------------------------------------------------------
  function startAttack(r, side, type) {
    if (r.state !== 'ride' || r.attack || r.attackCd > 0 || r.air) return false;
    type = type || r.weapon || 'fist';
    const W = D.WEAPONS[type];
    r.attack = { side, type, t: 0, windup: W.windup, dur: W.dur, hit: false };
    r.attackCd = W.dur + 0.1;
    return true;
  }
  G.startAttack = startAttack;

  function volumeFor(z) {
    return U.clamp(1 - Math.abs(z - G.player.z) / 6000, 0, 1);
  }

  function updateAttack(r, dt) {
    const a = r.attack;
    if (!a) return;
    a.t += dt;
    if (!a.hit && a.t >= a.windup) {
      a.hit = true;
      resolveHit(r, a);
    }
    if (a.t >= a.dur) r.attack = null;
  }

  function findTarget(r, side, reach) {
    let best = null, bestD = 1e9;
    for (const t of riders()) {
      if (t === r || t.state !== 'ride') continue;
      const dz = t.z - r.z;
      if (Math.abs(dz) > 320) continue;
      const dx = (t.x - r.x) * ROAD_W;
      if (side && dx * side < 50) continue;
      if (Math.abs(dx) > reach) continue;
      if (Math.abs(t.y - r.y) > 500) continue;
      const d = Math.abs(dx) + Math.abs(dz) * 0.6;
      if (d < bestD) {
        best = t;
        bestD = d;
      }
    }
    return best;
  }
  G.findTarget = findTarget;

  function resolveHit(r, a) {
    const W = D.WEAPONS[a.type];
    const t = findTarget(r, a.side, W.reach);
    const vol = volumeFor(r.z);
    if (!t || t.invuln > 0) {
      if (vol > 0.1) AU.whoosh(r.isPlayer ? 0.9 : vol * 0.4);
      return;
    }
    let dmg = W.damage * U.rand(0.85, 1.15);
    if (t.isPlayer) dmg *= 0.7 + G.level.n * 0.08;
    t.stamina -= dmg;
    t.vx += a.side * W.push;
    t.flash = 1;
    if (a.type === 'kick') t.speed *= 0.97;
    if (vol > 0.05) AU.hit(a.type, Math.max(0.15, vol));
    const mx = (r.x + t.x) / 2, mz = (r.z + t.z) / 2;
    const h = (r.y - T.roadY(G.track, r.z)) + 360;
    emit('spark', mz, mx, h, a.type === 'chain' ? 14 : 8, { sy: 1600, sx: 1.2, sz: 900, vz: r.speed, life: 0.35, size: 10 });
    if (t.isPlayer) {
      G.shake = Math.max(G.shake, 0.7);
      G.hurt = 0.7;
    }
    if (r.isPlayer) {
      G.shake = Math.max(G.shake, 0.35);
      G.lastTarget = t;
      G.lastTargetT = 3;
    }
    if (t.isCop && r.isPlayer && !t.ai.pursuit) {
      t.ai.pursuit = true;
      msg('You hit a cop. Bad idea.', '#6aa8ff');
    }
    if (t.stamina <= 0) knockOff(t, a.side, r);
  }

  function knockOff(t, side, by) {
    crash(t, 'knockout', { side });
    if (by) by.knockouts++;
    if (by && by.isPlayer) {
      msg('Knocked off ' + t.name + '!', '#f2a516');
      if (t.weapon && !by.weapon) {
        by.weapon = t.weapon;
        t.weapon = null;
        msg('Grabbed the ' + D.WEAPONS[by.weapon].name.toLowerCase() + '!', '#ffd36a');
        AU.grab();
      }
    }
    if (t.isPlayer) {
      msg(by ? by.name + ' knocked you off!' : 'You got knocked off!', '#ff6a50');
      if (t.weapon) {
        if (by && !by.weapon && !by.isCop) by.weapon = t.weapon;
        msg('You dropped your ' + D.WEAPONS[t.weapon].name.toLowerCase() + '.', '#ff6a50');
        t.weapon = null;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // crashes
  // ---------------------------------------------------------------------------
  function crash(r, cause, o) {
    if (r.state !== 'ride') return;
    o = o || {};
    const sp = r.speed;
    const side = o.side || (Math.random() < 0.5 ? -1 : 1);
    const ry = T.roadY(G.track, r.z);
    r.state = 'crash';
    r.attack = null;
    r.nitroT = 0;
    r.crash = {
      t: 0, cause,
      bike: { z: r.z, x: r.x, speed: sp * (cause === 'car' ? 0.2 : 0.75), rot: side * 0.15 },
      rider: {
        z: r.z, x: r.x, h: Math.max(0, r.y - ry) + 120,
        vz: sp * (cause === 'car' ? 0.5 : 0.62), vx: side * U.rand(0.4, 1.2) + r.vx * 0.3,
        vy: 2200 + sp * 0.16 + (cause === 'car' ? 1800 : 0),
        rot: 0, vrot: side * U.rand(7, 11), phase: 0, anim: 0,
      },
    };
    const sf = U.clamp(sp / r.top, 0, 1.25);
    let bikeDmg;
    if (cause === 'car') {
      r.stamina -= 18 + 16 * sf;
      bikeDmg = 20 + 24 * sf;
    } else if (cause === 'object') {
      r.stamina -= 12 + 12 * sf;
      bikeDmg = 16 + 18 * sf;
    } else {
      bikeDmg = 4 + 6 * sf;
    }
    if (r.isPlayer) {
      r.bikeHp -= bikeDmg * (1.3 - 0.5 * G.bike.durability);
      G.shake = 1.2;
      G.hurt = 0.9;
      AU.crash(1);
      if (cause === 'car') msg('Wiped out on a car!', '#ff6a50');
      else if (cause === 'object') msg('Wiped out on the roadside!', '#ff6a50');
    } else {
      const v = volumeFor(r.z);
      if (v > 0.05) AU.crash(v * 0.6);
    }
    emit('debris', r.z, r.x, 200, 10, { vz: sp * 0.6, sy: 2200, sx: 1.5, color: '#222', size: 16, life: 1 });
    emit('spark', r.z, r.x, 60, 16, { vz: sp * 0.6, sy: 1400, sx: 1.4, life: 0.5, size: 10 });
    emit('dust', r.z, r.x, 40, 10, { vz: sp * 0.3, sy: 300, sx: 0.4, color: dustColor(), life: 1.2, size: 70 });
  }

  function dustColor() {
    const id = G.theme.id;
    return id === 'desert' ? '#c99a6a' : id === 'alpine' ? '#f0f4f8' : id === 'city' ? '#6a6a72' : '#a89a80';
  }

  function updateCrash(r, dt) {
    const c = r.crash;
    c.t += dt;
    const b = c.bike;
    b.speed = Math.max(0, b.speed - (b.speed * 1.4 + 1800) * dt);
    b.z += b.speed * dt;
    b.rot += (b.speed / 6000) * dt * Math.sign(b.rot || 1);
    if (b.speed > 1500 && Math.random() < 0.5) emit('spark', b.z, b.x, 20, 2, { vz: b.speed * 0.8, sy: 600, sx: 0.8, life: 0.3, size: 8 });
    r.z = b.z;
    r.x = b.x;
    r.speed = b.speed;
    r.y = T.roadY(G.track, r.z);
    const rd = c.rider;
    if (rd.phase === 0) {
      rd.vy -= GRAV * dt;
      rd.h += rd.vy * dt;
      rd.z += rd.vz * dt;
      rd.x += rd.vx * dt;
      rd.rot += rd.vrot * dt;
      if (rd.h <= 0) {
        rd.h = 0;
        if (rd.vy < -1600) {
          rd.vy = -rd.vy * 0.3;
          rd.vz *= 0.55;
          rd.vrot *= 0.6;
          emit('dust', rd.z, rd.x, 20, 5, { vz: rd.vz * 0.5, sy: 200, color: dustColor(), life: 0.9, size: 50 });
        } else {
          rd.phase = 1;
          rd.vy = 0;
        }
      }
    } else if (rd.phase === 1) {
      rd.vz = Math.max(0, rd.vz - (rd.vz * 3 + 2500) * dt);
      rd.z += rd.vz * dt;
      rd.vx *= Math.exp(-4 * dt);
      rd.x += rd.vx * dt;
      rd.vrot *= Math.exp(-4 * dt);
      rd.rot += rd.vrot * dt;
      if (rd.vz < 40 && c.t > 1.2 && b.speed < 200) rd.phase = 2;
    } else {
      rd.anim += dt * 14;
      const dz = b.z - rd.z, step = 1900 * dt;
      rd.z += U.clamp(dz, -step, step);
      rd.x = U.approach(rd.x, b.x, 1.8 * dt);
      if (Math.abs(b.z - rd.z) < 40 && Math.abs(rd.x - b.x) < 0.03) {
        if (r.isPlayer && r.bikeHp <= 0) return;
        remount(r);
      }
    }
    rd.x = U.clamp(rd.x, -2.6, 2.6);
  }

  function remount(r) {
    r.state = 'ride';
    r.crash = null;
    r.speed = 0;
    r.x = U.clamp(r.x, -0.85, 0.85);
    r.vx = 0;
    r.lean = 0;
    r.invuln = 1.8;
    r.stamina = Math.max(r.stamina, r.maxStamina * 0.5);
    r.y = T.roadY(G.track, r.z);
    r.vy = 0;
    r.air = false;
    if (r.ai) r.ai.lane = r.x > 0 ? LANES[2] : LANES[1];
  }

  // ---------------------------------------------------------------------------
  // riding physics, shared by the player and every AI rider
  // ---------------------------------------------------------------------------
  function ride(r, ctl, dt) {
    const track = G.track;
    const seg = T.findSegment(track, r.z);
    let top = r.top, accel = r.accel;
    if (r.nitroT > 0) {
      r.nitroT -= dt;
      top *= 1.24;
      accel *= 2.4;
    }
    const speedPct = r.speed / r.top;
    const grip = r.air ? 0.15 : 1;
    r.braking = ctl.brake > 0;
    if (!r.air) {
      if (ctl.brake) r.speed -= r.top * 1.05 * dt * ctl.brake;
      else if (ctl.throttle) r.speed += accel * (1 - 0.7 * Math.pow(r.speed / top, 2)) * dt * ctl.throttle;
      else r.speed -= r.top * 0.16 * dt;
    }
    // surface
    r.offroad = Math.abs(r.x) > 1.08;
    if (r.offroad && !r.air) {
      if (r.speed > r.top * 0.35) r.speed -= r.top * 0.8 * dt;
      if (Math.random() < 0.6 && r.speed > 1000) emit('dust', r.z - 80, r.x, 20, 1, { vz: r.speed * 0.4, sy: 400, color: dustColor(), life: 0.8, size: 60 });
    }
    // gravity along the slope
    const slope = (seg.p2.world.y - seg.p1.world.y) / SEG;
    if (!r.air) r.speed -= slope * 650 * dt;
    if (r.speed > top) r.speed = Math.max(top, r.speed - r.top * 0.5 * dt);
    r.speed = U.clamp(r.speed, 0, top * 1.05);

    // steering
    const steerRate = 2.0 * r.handling * (0.35 + 0.65 * Math.min(1, speedPct * 1.5)) * grip;
    r.x += ctl.steer * steerRate * dt;
    if (r.isPlayer && !r.ai) r.x -= dt * 2 * speedPct * speedPct * seg.curve * 0.3;
    r.x += r.vx * dt;
    r.vx *= Math.exp(-5 * dt);
    r.x = U.clamp(r.x, -2.6, 2.6);
    const leanTarget = U.clamp(ctl.steer * 0.75 + r.vx * 0.12 + seg.curve * speedPct * 0.1, -1, 1);
    r.lean = U.damp(r.lean, leanTarget, 7, dt);

    const z0 = r.z;
    r.z += r.speed * dt;
    const maxZ = (track.segments.length - R.DRAW_DISTANCE - 4) * SEG;
    if (r.z > maxZ) {
      r.z = maxZ;
      r.speed = 0;
    }

    // vertical: follow the road or fly off the crest of a hill
    const ry = T.roadY(track, r.z);
    if (!r.air) {
      const ballistic = r.y + r.vy * dt - 0.5 * GRAV * dt * dt;
      if (ballistic > ry + 4 && r.speed > r.top * 0.35) {
        r.air = true;
        r.y = ballistic;
        r.vy -= GRAV * dt;
      } else {
        r.vy = (ry - r.y) / dt;
        r.y = ry;
      }
    } else {
      r.vy -= GRAV * dt;
      r.y += r.vy * dt;
      if (r.y <= ry) {
        const roadVy = slope * r.speed;
        const impact = roadVy - r.vy;
        r.y = ry;
        r.vy = roadVy;
        r.air = false;
        if (r.isPlayer && impact > 2500) {
          G.shake = Math.max(G.shake, Math.min(1, impact / 9000));
          AU.land(Math.min(1, impact / 8000));
          emit('dust', r.z, r.x, 10, 6, { vz: r.speed * 0.4, sy: 400, sx: 0.8, color: dustColor(), life: 0.8, size: 60 });
        }
      }
    }
    return r.z - z0;
  }

  // ---------------------------------------------------------------------------
  // AI
  // ---------------------------------------------------------------------------
  function aiControl(r, dt) {
    const ai = r.ai, P = G.player;
    const seg = T.findSegment(G.track, r.z);
    ai.think -= dt;
    let target = r.top * ai.pace;
    target *= 1 - Math.min(0.18, Math.abs(seg.curve) * 0.025);
    if (r.finished) target = r.top * 0.5;
    const racing = G.mode !== 'attract' && G.state === 'race';

    if (!r.isPlayer && !r.isCop && racing && !r.finished) {
      const ahead = (r.z - P.z) / SEG;
      if (ahead > 140) target *= 0.95;
      else if (ahead < -140) target *= 1.05;
    }

    if (ai.cop) {
      const dz = P.z - r.z;
      if (!ai.pursuit && racing && P.state === 'ride' && dz > -1500 && dz < 3500) {
        ai.pursuit = true;
        msg('Cops on your tail!', '#6aa8ff');
      }
      if (ai.pursuit) {
        if (dz > 26000 || P.finished || !racing) ai.pursuit = false;
        else if (P.state === 'ride') {
          target = dz > 200 ? r.top : Math.max(0, P.speed * 0.97);
          ai.lane = U.clamp(P.x + (r.x < P.x ? -0.3 : 0.3), -0.9, 0.9);
        } else {
          target = dz > 600 ? r.top : 0;
          ai.lane = U.clamp(P.x + 0.3, -0.9, 0.9);
        }
      } else target = 82 * MPH;
    }

    if (ai.think <= 0) {
      ai.think = U.rand(0.05, 0.1) * (1.8 - ai.skill);
      ai.pace = U.clamp(ai.pace + U.rand(-0.02, 0.02), 0.93, 1.0);
      const danger = laneDanger(r);
      const nearest = (x) => {
        let best = 0;
        for (let i = 1; i < 4; i++) if (Math.abs(LANES[i] - x) < Math.abs(LANES[best] - x)) best = i;
        return best;
      };
      const here = nearest(r.x), aim = nearest(ai.lane);
      const score = (i) => {
        // a lane change sweeps through every lane between here and there
        let path = 0;
        const step = i > here ? 1 : -1;
        for (let k = here + step; i !== here && k !== i + step; k += step) path = Math.max(path, danger[k]);
        return -Math.max(danger[i], path * 0.9) * 10 - Math.abs(i - aim) * 0.35 + (LANES[i] > 0 ? 0.3 : 0);
      };
      let best = aim, bestScore = score(aim) + 0.6; // stick with the plan unless clearly worse
      for (let i = 0; i < 4; i++) {
        const sc = score(i);
        if (sc > bestScore) {
          bestScore = sc;
          best = i;
        }
      }
      ai.blocked = danger[best] > 0.55 || (danger[here] > 0.75 && Math.abs(r.x - LANES[best]) > 0.15);
      if (!ai.pursuit) {
        if (best !== aim || Math.abs(ai.lane - LANES[best]) > 0.12) ai.lane = LANES[best] + U.rand(-0.06, 0.06);
        ai.hunt = false;
        if (racing && !r.isPlayer && !r.finished && P.state === 'ride') {
          const dz = P.z - r.z, dx = P.x - r.x;
          const huntX = U.clamp(P.x - Math.sign(dx || 1) * 0.3, -0.85, 0.85);
          if (Math.abs(dz) < 1500 && Math.abs(dx) < 1.3 && Math.random() < ai.aggression * 0.8 && danger[nearest(huntX)] < 0.25) {
            ai.hunt = true;
            ai.lane = huntX;
          }
        }
      } else if (danger[nearest(ai.lane)] > 0.6) {
        ai.lane = LANES[best];
      }
    }
    if (ai.hunt) {
      const dz = P.z - r.z;
      if (dz > 150) target = Math.max(target, Math.min(r.top * 1.03, P.speed + 900));
      else if (dz < -150) target = Math.min(target, P.speed * 0.95);
      else target = P.speed;
    }

    // swing at anyone alongside
    if (!r.attack && r.attackCd <= 0 && (racing || ai.cop) && r.state === 'ride') {
      const reach = D.WEAPONS[r.weapon || 'fist'].reach * 0.9;
      const t = findTarget(r, 0, reach);
      if (t && !(ai.cop && !t.isPlayer) && Math.abs(t.x - r.x) * ROAD_W > 90) {
        const want = t.isPlayer ? 0.6 + 1.7 * ai.aggression : 0.3 * ai.aggression;
        if (!(ai.cop && !ai.pursuit) && Math.random() < dt * want) startAttack(r, Math.sign(t.x - r.x));
      }
    }

    // adaptive cruise: brake as hard as needed not to rear-end what is in our path
    let need = 0;
    for (const c of G.cars) {
      const dz = c.z - r.z;
      if (dz < 0 || dz > 4000 || c.speed < 0 || Math.abs(c.x - r.x) > 0.3) continue;
      const closing = r.speed - c.speed;
      if (closing > 0) need = Math.max(need, (closing * closing) / (2 * Math.max(60, dz - 340)));
    }
    const cruise = U.clamp((need / (r.top * 1.05)) * 1.2 * (0.75 + 0.25 * ai.skill), 0, 1);
    const steer = U.clamp((ai.lane - r.x) * 6, -1, 1);
    return {
      steer,
      throttle: r.speed < target && !ai.blocked && cruise < 0.05 ? 1 : 0,
      brake: Math.max(r.speed > target * 1.12 ? 0.6 : ai.blocked ? 0.2 : 0, cruise > 0.05 ? cruise : 0),
    };
  }

  // How soon each lane runs into traffic: 0 = clear, 1 = about to hit.
  function laneDanger(r) {
    const danger = [0, 0, 0, 0];
    for (const o of G.racers) {
      if (o === r || o.state !== 'ride' || o.isPlayer) continue;
      const dz = o.z - r.z, closing = r.speed - o.speed;
      if (dz < 0 || dz > 2500 || closing < 300) continue;
      const w = 0.6 * (1 - Math.min(1, dz / closing / 1.2));
      for (let i = 0; i < 4; i++) if (Math.abs(LANES[i] - o.x) < 0.2 && w > danger[i]) danger[i] = w;
    }
    for (const c of G.cars) {
      const dz = c.z - r.z;
      if (dz < -260 || dz > 32000) continue;
      const closing = r.speed - c.speed;
      let ttc;
      if (dz <= 300) ttc = 0;
      else if (closing <= 60) continue;
      else ttc = (dz - 300) / closing;
      if (ttc > 2.2) continue;
      const w = 1 - ttc / 2.2;
      for (let i = 0; i < 4; i++) if (Math.abs(LANES[i] - c.x) < 0.36 && w > danger[i]) danger[i] = w;
    }
    return danger;
  }

  // ---------------------------------------------------------------------------
  // collisions
  // ---------------------------------------------------------------------------
  function collideCars(r, dt) {
    if (r.state !== 'ride' || r.invuln > 0) return;
    const ry = T.roadY(G.track, r.z);
    if (r.y - ry > 700) return; // sailing over the roof
    for (const c of G.cars) {
      const dz = c.z - r.z;
      if (Math.abs(dz) > 900) continue;
      const prev = c.z - c.speed * dt - (r.z - r.speed * dt);
      if (!(Math.abs(dz) < 240 || Math.sign(dz) !== Math.sign(prev))) continue;
      const half = (c.sprite.w * c.sprite.cw) / 2 + BIKE_HALF * 0.75;
      if (Math.abs(c.x - r.x) * ROAD_W < half) {
        crash(r, 'car');
        if (volumeFor(c.z) > 0.3) AU.horn();
        return;
      }
    }
  }

  function collideScenery(r) {
    if (r.state !== 'ride' || Math.abs(r.x) < 1.2 || r.invuln > 0) return;
    const seg = T.findSegment(G.track, r.z);
    for (const sp of seg.sprites) {
      if (!sp.collide) continue;
      if (Math.abs(r.x - sp.offset) * ROAD_W < (sp.s.w * sp.s.cw) / 2 + BIKE_HALF) {
        crash(r, 'object', { side: Math.sign(r.x) });
        return;
      }
    }
  }

  function collideBikes() {
    const list = riders();
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.state !== 'ride') continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.state !== 'ride') continue;
        if (Math.abs(a.z - b.z) > 150) continue;
        const dx = (b.x - a.x) * ROAD_W;
        if (Math.abs(dx) > 180 || Math.abs(a.y - b.y) > 300) continue;
        const s = Math.sign(dx || 1);
        const push = (180 - Math.abs(dx)) / ROAD_W;
        a.x -= s * push * 0.5;
        b.x += s * push * 0.5;
        a.vx = U.clamp(a.vx - s * 0.1, -1.2, 1.2);
        b.vx = U.clamp(b.vx + s * 0.1, -1.2, 1.2);
        const behind = a.z < b.z ? a : b;
        behind.speed *= 0.985;
        if ((a.isPlayer || b.isPlayer) && Math.random() < 0.1) G.shake = Math.max(G.shake, 0.2);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // traffic
  // ---------------------------------------------------------------------------
  function updateCars(dt) {
    const P = G.player, track = G.track;
    const list = riders();
    for (const c of G.cars) {
      const z0 = c.z;
      // drivers ease off for a rider sitting in their lane
      const dir = c.oncoming ? -1 : 1;
      let limit = c.baseSpeed;
      for (const r of list) {
        const ahead = (r.z - c.z) * dir;
        if (ahead > 0 && ahead < 2500 && Math.abs(r.x - c.x) < 0.25) {
          const rs = r.speed * dir;
          if (rs < c.baseSpeed) limit = Math.min(limit, Math.max(0, rs) + (ahead - 500) * 0.9);
        }
      }
      limit = Math.max(0, limit);
      const sp = Math.abs(c.speed);
      c.speed = dir * (sp > limit ? Math.max(limit, sp - 9000 * dt) : Math.min(limit, sp + 800 * dt));
      c.z += c.speed * dt;
      c.wob += dt;
      c.x = c.lane + Math.sin(c.wob * 0.7) * 0.03;
      // recycle cars that fell far behind the camera
      if (c.z < G.cam.z - 2500 || c.z < track.startZ) {
        // respawn out of sight, and never on top of a rider
        let nz = 0;
        for (let tries = 0; tries < 6; tries++) {
          nz = G.cam.z + R.DRAW_DISTANCE * SEG + U.rand(0, 60000);
          if (!riders().some((r) => Math.abs(r.z - nz) < 3000)) break;
        }
        if (nz < track.finishZ + 6000) {
          Object.assign(c, makeCar(nz, c.oncoming));
        } else {
          c.z = track.length + 99999; // parked out of play
          c.speed = 0;
        }
        continue;
      }
      // audio cues around the player
      if (P.state === 'ride') {
        const dx = Math.abs(c.x - P.x);
        const d0 = z0 - P.z, d1 = c.z - P.z;
        if (Math.sign(d0) !== Math.sign(d1) && dx < 1.2) AU.carPass(U.clamp(1.2 - dx, 0.2, 1), c.x - P.x);
        if (c.oncoming && !c.honked && d1 > 0 && d1 < 4500 && dx < 0.3 && P.speed > 3000) {
          c.honked = true;
          AU.horn();
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // standings
  // ---------------------------------------------------------------------------
  function rankRacers() {
    const list = G.racers.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishOrder - b.finishOrder;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.z - a.z;
    });
    list.forEach((r, i) => (r.place = i + 1));
    G.standings = list;
  }

  // ---------------------------------------------------------------------------
  // main update
  // ---------------------------------------------------------------------------
  G.update = function (dt) {
    if (G.state === 'idle' || G.state === 'over') return;
    G.time += dt;
    const P = G.player, track = G.track;
    const racing = G.state === 'race' || G.state === 'finished';

    if (G.state === 'countdown') {
      G.countdown -= dt;
      const n = Math.ceil(G.countdown - 0.6);
      if (n < G.lastCount && n >= 0) {
        G.lastCount = n;
        if (n > 0) AU.beep(false);
      }
      const inp = I.poll();
      AU.engine(true, inp.gas ? 0.55 + Math.sin(G.time * 30) * 0.05 : 0.12, inp.gas ? 1 : 0, 0);
      if (G.countdown <= 0.6) {
        G.state = 'race';
        AU.beep(true);
        banner('GO!', '', '#f2a516', 0.9);
        if (inp.gas) {
          P.speed = P.top * 0.14;
          msg('Great start!', '#ffd36a');
        }
        I.clear();
      }
    }

    if (racing) {
      if (!P.finished && G.mode !== 'attract' && !G.outcome) G.raceTime += dt;
      // player input
      let ctl = { steer: 0, throttle: 0, brake: 0 };
      if (P.ai || P.finished || G.outcome) {
        if (P.state === 'ride') {
          if (!P.ai) P.ai = { skill: 1, aggression: 0, lane: U.clamp(P.x, -0.7, 0.7), think: 0, pace: 1 };
          ctl = aiControl(P, dt);
          if (P.finished || G.outcome) ctl.throttle = P.speed < P.top * 0.4 ? 1 : 0;
        }
      } else {
        const inp = I.poll();
        ctl = { steer: inp.steer, throttle: inp.gas ? 1 : 0, brake: inp.brake ? 1 : 0 };
        if (P.state === 'ride') {
          if (I.take('hitL')) startAttack(P, -1);
          if (I.take('hitR')) startAttack(P, 1);
          if (I.take('kick')) {
            const t = findTarget(P, 0, D.WEAPONS.kick.reach * 1.3);
            startAttack(P, t ? Math.sign(t.x - P.x) || 1 : 1, 'kick');
          }
          if (I.take('nitro')) {
            if (P.nitro > 0 && P.nitroT <= 0) {
              P.nitro--;
              P.nitroT = 3.2;
              AU.nitro();
              msg('Nitro!', '#9fd0ff', 1.2);
            } else if (G.bike.nitro === 0) msg('This bike has no nitro', '#c8c0b0', 1.2);
          }
        } else I.clear();
      }
      // player
      let moved = 0;
      if (P.state === 'ride') moved = ride(P, ctl, dt);
      else {
        const z0 = P.z;
        updateCrash(P, dt);
        moved = P.z - z0;
      }
      // rivals and cops
      for (const r of G.racers) {
        if (r === P) continue;
        if (r.state === 'ride') ride(r, aiControl(r, dt), dt);
        else updateCrash(r, dt);
      }
      for (const c of G.cops) {
        if (c.state === 'ride') ride(c, aiControl(c, dt), dt);
        else updateCrash(c, dt);
      }
      for (const r of riders()) {
        r.attackCd -= dt;
        r.flash = Math.max(0, r.flash - dt * 4);
        r.invuln = Math.max(0, r.invuln - dt);
        updateAttack(r, dt);
        if (r.state === 'ride' && r.stamina <= 0) knockOff(r, Math.sign(r.vx) || 1, null);
        if (r.state === 'ride' && r.stamina < r.maxStamina) r.stamina = Math.min(r.maxStamina, r.stamina + dt * 1.2);
        collideCars(r, dt);
        collideScenery(r);
        if (!r.finished && !r.isCop && r.z >= track.finishZ) {
          r.finished = true;
          r.finishOrder = ++G.finishOrder;
          r.finishTime = G.raceTime;
        }
      }
      collideBikes();
      updateCars(dt);
      rankRacers();

      // race events for the player
      if (G.mode === 'attract') {
        if (P.z > track.finishZ - 3000) G.onAttractEnd && G.onAttractEnd();
      } else {
        if (P.finished && G.state === 'race') {
          G.state = 'finished';
          G.outcome = 'finished';
          G.endTimer = 3.4;
          const q = P.place <= D.QUALIFY_PLACE;
          banner('FINISHED ' + U.ordinal(P.place), q ? 'You qualified' : 'Top ' + D.QUALIFY_PLACE + ' qualify', q ? '#f2a516' : '#e8e2d4', 3.4);
          AU.cash();
        }
        if (!G.outcome && P.state === 'crash' && P.bikeHp <= 0 && P.crash.t > 0.6) {
          G.outcome = 'wrecked';
          G.endTimer = 3;
          banner('WRECKED', 'Your bike is scrap metal', '#e0402a', 3);
        }
        if (!G.outcome && P.state === 'crash') {
          for (const c of G.cops) {
            if (c.state === 'ride' && Math.abs(c.z - P.z) < 800 && Math.abs(c.x - P.x) < 1.4) {
              G.outcome = 'busted';
              G.endTimer = 3;
              G.bustedBy = c;
              banner('BUSTED', 'The law caught up with you', '#6aa8ff', 3);
              AU.siren(1, 0);
              break;
            }
          }
        }
        if (G.outcome) {
          G.endTimer -= dt;
          if (G.endTimer <= 0) endRace();
        }
      }

      // camera
      G.cam.z = P.z - R.PLAYER_Z;
      G.cam.x = U.damp(G.cam.x, P.x * ROAD_W * 0.88, 7, dt);
      const camYT = (P.state === 'ride' ? P.y : T.roadY(track, P.z)) + R.CAMERA_HEIGHT;
      G.cam.y = U.damp(G.cam.y, camYT, 10, dt);
      const seg = T.findSegment(track, P.z);
      G.bgOffset += seg.curve * (moved / SEG) * 0.0016;

      // audio
      if (G.mode !== 'attract') {
        const sp = P.speed / P.top;
        const gears = 6, g = Math.min(gears - 1, Math.floor(sp * gears * 0.999));
        const rpm = P.state === 'ride' ? (sp < 0.02 ? 0.12 : 0.25 + (sp * gears - g) * 0.75) : 0.1;
        AU.engine(true, rpm, ctl.throttle, Math.min(1, P.speed / 12000));
        let copVol = 0, copPan = 0;
        for (const c of G.cops) {
          if (c.ai.pursuit && c.state === 'ride') {
            const v = U.clamp(1 - Math.abs(c.z - P.z) / 14000, 0, 1);
            if (v > copVol) {
              copVol = v;
              copPan = c.x - P.x;
            }
          }
        }
        AU.siren(G.outcome === 'busted' ? 1 : copVol, copPan);
        G.copAlert = copVol;
      }
    }

    // nameplate for the nearest rival
    let near = null, nd = 1e9;
    if (P.state === 'ride') {
      for (const r of riders()) {
        if (r === P || r.state !== 'ride') continue;
        const dz = Math.abs(r.z - P.z), dx = Math.abs(r.x - P.x);
        if (dz < 900 && dx < 1.1 && dz + dx * 800 < nd) {
          nd = dz + dx * 800;
          near = r;
        }
      }
    }
    if (!near && G.lastTargetT > 0 && G.lastTarget) near = G.lastTarget;
    G.lastTargetT = Math.max(0, (G.lastTargetT || 0) - dt);
    G.nearRival = near;

    updateParticles(dt);
    G.shake = Math.max(0, G.shake - dt * 2.2);
    G.hurt = Math.max(0, G.hurt - dt * 1.6);
    for (const m of G.messages) m.t -= dt;
    G.messages = G.messages.filter((m) => m.t > 0);
    if (G.banner) {
      G.banner.t -= dt;
      if (G.banner.t <= 0) G.banner = null;
    }
    buildBuckets();
  };

  function buildBuckets() {
    const B = {};
    const z0 = G.cam.z + 200, z1 = G.cam.z + R.DRAW_DISTANCE * SEG;
    const add = (e) => {
      if (e.z < z0 || e.z > z1) return;
      const i = Math.floor(e.z / SEG);
      (B[i] || (B[i] = [])).push(e);
    };
    const track = G.track;
    for (const r of riders()) {
      if (r.state === 'ride') {
        add({ kind: 'bike', z: r.z, x: r.x, lift: r.y - T.roadY(track, r.z), r });
      } else if (r.crash) {
        const b = r.crash.bike, rd = r.crash.rider;
        add({ kind: 'fallen', z: b.z, x: b.x, rot: b.rot, r });
        add({ kind: 'rider', z: rd.z, x: rd.x, lift: rd.h, pose: rd.phase === 2 ? 'run' : 'tumble', rot: rd.rot, phase: rd.anim, front: rd.z > b.z, r });
      }
    }
    for (const c of G.cars) add({ kind: 'car', z: c.z, x: c.x, sprite: c.sprite });
    for (const p of G.particles) add({ kind: 'particle', z: p.z, x: p.x, lift: p.h, p });
    G.buckets = B;
  }

  function endRace() {
    const P = G.player;
    G.state = 'over';
    AU.silence();
    const standings = G.standings.map((r) => ({
      name: r.name, isPlayer: r.isPlayer, place: r.place,
      time: r.finished ? r.finishTime : null,
      out: r.isPlayer && G.outcome !== 'finished' ? G.outcome : null,
    }));
    G.result = {
      outcome: G.outcome,
      place: G.outcome === 'finished' ? P.place : null,
      time: P.finishTime,
      knockouts: P.knockouts,
      standings,
      track: G.opts.track,
      level: G.opts.level,
      mode: G.mode,
    };
    if (G.onEnd) G.onEnd(G.result);
  }

  G.abort = function () {
    G.state = 'idle';
    AU.silence();
  };

  return G;
})();
