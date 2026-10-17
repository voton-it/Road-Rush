// Track construction: a list of road segments with curves, hills and roadside
// scenery. Layouts are seeded per track and level so riders can learn them.
RR.Track = (function () {
  const U = RR.U;
  const SEG = 200;          // segment length (world units)
  const RUMBLE = 3;         // segments per rumble strip colour band
  const ROAD_W = 2000;      // half road width
  const START_INDEX = 40;   // segment holding the start line
  const RUNOUT = 520;       // straight road after the finish line

  function build(theme, level, art) {
    const rng = U.rng(theme.seed * 31 + level.n * 977);
    const segments = [];

    function lastY() {
      return segments.length === 0 ? 0 : segments[segments.length - 1].p2.world.y;
    }
    function addSegment(curve, y) {
      const n = segments.length;
      segments.push({
        index: n,
        p1: { world: { y: lastY(), z: n * SEG }, camera: {}, screen: {} },
        p2: { world: { y: y, z: (n + 1) * SEG }, camera: {}, screen: {} },
        curve,
        sprites: [],
        light: Math.floor(n / RUMBLE) % 2 === 0,
        lit: 0,
        clip: 0,
        fog: 0,
      });
    }
    function addRoad(enter, hold, leave, curve, y) {
      const startY = lastY();
      const endY = startY + y * SEG;
      const total = enter + hold + leave;
      for (let n = 0; n < enter; n++) addSegment(U.easeIn(0, curve, n / enter), U.easeInOut(startY, endY, n / total));
      for (let n = 0; n < hold; n++) addSegment(curve, U.easeInOut(startY, endY, (enter + n) / total));
      for (let n = 0; n < leave; n++) addSegment(U.easeInOut(curve, 0, n / leave), U.easeInOut(startY, endY, (enter + hold + n) / total));
    }

    const signs = [];
    const curveScale = theme.curvy;
    const hillScale = theme.hilly;
    const hill = (min, max) => {
      let h = rng.range(min, max) * hillScale * (rng() < 0.5 ? -1 : 1);
      const y = lastY() / SEG;
      if (y + h > 70) h = -Math.abs(h);
      if (y + h < -70) h = Math.abs(h);
      return h;
    };

    addRoad(0, START_INDEX + 80, 0, 0, 0);
    const target = START_INDEX + level.segments;
    while (segments.length < target) {
      const r = rng();
      const dir = rng() < 0.5 ? -1 : 1;
      const len = rng.pick([25, 40, 50, 70, 100]);
      if (r < 0.16) {
        addRoad(len, len, len, 0, rng() < 0.4 ? hill(10, 40) : 0);
      } else if (r < 0.5) {
        const c = rng.pick([2, 3, 4, 5, 6]) * curveScale * dir;
        if (Math.abs(c) >= 3.5) signs.push({ at: segments.length - 25, dir: Math.sign(c) });
        addRoad(len, rng.pick([25, 50, 80]), len, c, rng() < 0.35 ? hill(10, 30) : 0);
      } else if (r < 0.66) {
        const c = rng.pick([2, 3, 4]) * curveScale;
        addRoad(30, 30, 30, c * dir, 0);
        addRoad(30, 30, 30, -c * dir, 0);
      } else if (r < 0.82) {
        // rolling hills: the big jumps live here
        const h = hill(20, 45);
        addRoad(len, 10, len, 0, h);
        addRoad(len * 0.6 | 0, 10, len * 0.6 | 0, 0, -h * rng.range(0.6, 1.2));
      } else {
        const c = rng.pick([3, 5]) * curveScale * dir;
        if (Math.abs(c) >= 3.5) signs.push({ at: segments.length - 25, dir: Math.sign(c) });
        addRoad(50, 40, 50, c, hill(20, 50));
      }
    }
    // level out for the finish
    addRoad(60, 60, 60, 0, -lastY() / SEG);
    const finishIndex = segments.length + 20;
    addRoad(0, RUNOUT + 20, 0, 0, 0);

    decorate(theme, art, segments, rng, finishIndex, signs);
    return {
      theme, segments, length: segments.length * SEG,
      startIndex: START_INDEX, finishIndex,
      startZ: START_INDEX * SEG, finishZ: finishIndex * SEG,
      raceLength: (finishIndex - START_INDEX) * SEG,
    };
  }

  function weighted(rng, list) {
    let total = 0;
    for (const [, w] of list) total += w;
    let r = rng() * total;
    for (const [name, w] of list) {
      r -= w;
      if (r <= 0) return name;
    }
    return list[list.length - 1][0];
  }

  function decorate(theme, art, segments, rng, finishIndex, signs) {
    const S = art.sprites;
    const pick = (name) => (S[name] ? rng.pick(S[name]) : null);
    const add = (index, name, offset, collide) => {
      const seg = segments[index];
      const sprite = pick(name);
      if (!seg || !sprite) return;
      seg.sprites.push({ s: sprite, offset, collide: collide && sprite.collide });
    };

    segments[START_INDEX].sprites.push({ s: S.start[0], offset: 0, collide: false });
    segments[finishIndex].sprites.push({ s: S.finish[0], offset: 0, collide: false });
    const clearOf = (i) => Math.abs(i - START_INDEX) > 3 && Math.abs(i - finishIndex) > 3;

    if (S.signL) {
      for (const sg of signs) {
        if (sg.at > START_INDEX + 10 && clearOf(sg.at)) add(sg.at, sg.dir > 0 ? 'signR' : 'signL', sg.dir > 0 ? -1.5 : 1.5, true);
      }
    }

    const ocean = !!theme.grassR;
    const lampEvery = theme.lamps || 0;
    const postEvery = theme.left.some(([n]) => n === 'post') ? 8 : 0;
    const strip = (list) => list.filter(([n]) => n !== 'lamp' && n !== 'post' && n !== 'sign');
    const near = { '-1': strip(theme.left), '1': strip(theme.right) };
    const far = { '-1': theme.farLeft || [], '1': theme.farRight || [] };
    let zonePhase = rng() * 100;

    for (let i = 8; i < segments.length - 4; i++) {
      if (!clearOf(i)) continue;
      const zone = 0.5 + 0.5 * Math.sin(i / 47 + zonePhase) * Math.sin(i / 13 + zonePhase * 0.7);
      for (const side of [-1, 1]) {
        if (lampEvery && i % lampEvery === 0) {
          add(i, side < 0 ? 'lampL' : 'lampR', side * 1.42, true);
          continue;
        }
        if (postEvery && i % postEvery === 0 && !(ocean && side > 0)) {
          add(i, 'post', side * 1.3, true);
          continue;
        }
        if (ocean && side > 0) {
          if (rng() < 0.01) add(i, 'rock', side * rng.range(1.5, 2.2), true);
          if (rng() < 0.012) add(i, 'seastack', side * rng.range(4, 12), false);
          continue;
        }
        const density = theme.dense ? 0.5 : theme.id === 'city' ? 0.34 : 0.22;
        if (near[side].length && rng() < density * zone) {
          const name = weighted(rng, near[side]);
          let off = rng.range(1.5, 2.3);
          if (name === 'building') off = rng.range(2.3, 2.7);
          if (name === 'billboard' || name === 'house' || name === 'shack') off = rng.range(2.3, 3.2);
          if (name === 'hydrant') off = 1.36;
          add(i, name, side * off, true);
        }
        if (far[side].length && rng() < (theme.dense ? 0.3 : theme.id === 'city' ? 0.1 : 0.2)) {
          add(i, weighted(rng, far[side]), side * rng.range(3, 7), false);
        }
      }
    }

    // night lighting pools around the street lamps
    if (lampEvery) {
      for (const seg of segments) {
        const d = Math.min(seg.index % lampEvery, lampEvery - (seg.index % lampEvery));
        seg.lit = Math.max(0, 3 - d);
      }
    }
  }

  function findSegment(track, z) {
    const segs = track.segments;
    const i = Math.floor(z / SEG);
    return segs[U.clamp(i, 0, segs.length - 1)];
  }
  function roadY(track, z) {
    const seg = findSegment(track, z);
    const p = U.clamp((z % SEG) / SEG, 0, 1);
    return U.lerp(seg.p1.world.y, seg.p2.world.y, p);
  }

  return { build, findSegment, roadY, SEG, RUMBLE, ROAD_W };
})();
