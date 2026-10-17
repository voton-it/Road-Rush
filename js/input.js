// Keyboard, gamepad and touch input merged into one set of actions.
RR.Input = (function () {
  const BINDINGS = {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    gas: ['ArrowUp', 'KeyW'],
    brake: ['ArrowDown', 'KeyS'],
    hitL: ['KeyZ', 'KeyJ'],
    hitR: ['KeyX', 'KeyK'],
    kick: ['KeyC', 'KeyL'],
    nitro: ['Space', 'ShiftLeft', 'ShiftRight'],
    pause: ['Escape', 'KeyP'],
  };
  const keys = new Set();
  const touch = {};
  const pressed = {};   // edge-triggered actions, consumed by take()
  const pad = { prev: {} };
  const I = { touch, BINDINGS };

  function actionFor(code) {
    for (const a in BINDINGS) if (BINDINGS[a].includes(code)) return a;
    return null;
  }

  window.addEventListener('keydown', (e) => {
    const a = actionFor(e.code);
    if (!a) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (a !== 'pause' || !e.repeat) e.preventDefault();
    if (!keys.has(e.code)) pressed[a] = true;
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  function padState() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && Array.from(pads).find((x) => x && x.connected);
    if (!p) return null;
    const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
    const ax = p.axes[0] || 0;
    const s = {
      left: ax < -0.3 || b(14), right: ax > 0.3 || b(15),
      gas: b(7) || b(0), brake: b(6) || b(1),
      hitL: b(2) || b(4), hitR: b(3) || b(5), kick: b(10) || b(11),
      nitro: b(12) || b(8), pause: b(9),
      steer: Math.abs(ax) > 0.15 ? ax : 0,
    };
    for (const a of ['hitL', 'hitR', 'kick', 'nitro', 'pause']) {
      if (s[a] && !pad.prev[a]) pressed[a] = true;
      pad.prev[a] = s[a];
    }
    return s;
  }

  // Current held state of every action.
  I.poll = function () {
    const st = {};
    const ps = padState();
    for (const a in BINDINGS) {
      st[a] = BINDINGS[a].some((k) => keys.has(k)) || !!touch[a] || !!(ps && ps[a]);
    }
    st.steer = (st.right ? 1 : 0) - (st.left ? 1 : 0);
    if (ps && ps.steer) st.steer = ps.steer;
    return st;
  };
  // Was the action pressed since the last call?
  I.take = function (a) {
    const v = !!pressed[a];
    pressed[a] = false;
    return v;
  };
  I.clear = function () {
    for (const a in pressed) pressed[a] = false;
  };
  I.press = function (a) {
    pressed[a] = true;
  };
  return I;
})();
