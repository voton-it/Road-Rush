// Boot and main loop.
RR.Main = (function () {
  const G = RR.Game, R = RR.Render, HUD = RR.HUD, UI = RR.UI, I = RR.Input, D = RR.DATA;
  const STEP = 1 / 60;
  const M = {};
  let attractTrack = Math.floor(Math.random() * D.TRACKS.length);

  M.startAttract = function () {
    attractTrack = (attractTrack + 1) % D.TRACKS.length;
    G.setup({ mode: 'attract', track: attractTrack, level: 1, bike: 'fury' });
    G.onAttractEnd = M.startAttract;
    G.onEnd = null;
  };

  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!G.paused && G.state !== 'idle') {
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 6) {
        G.update(STEP);
        acc -= STEP;
        steps++;
      }
      if (steps === 6) acc = 0;
    }
    if (G.mode !== 'attract' && !G.paused && (G.state === 'race' || G.state === 'countdown' || G.state === 'finished')) {
      if (I.take('pause')) UI.pause();
    } else I.take('pause');
    if (G.track) {
      R.draw(G);
      if (G.showHud && G.state !== 'idle') HUD.draw(G);
    }
    requestAnimationFrame(frame);
  }

  function boot() {
    R.init(document.getElementById('game'));
    UI.init();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) UI.pause();
    });
    const go = () => {
      M.startAttract();
      UI.showTitle();
      requestAnimationFrame(frame);
    };
    // Sprites bake text into canvases, so wait briefly for the web fonts.
    if (document.fonts && document.fonts.load) {
      Promise.race([
        Promise.all([document.fonts.load('600 40px Teko'), document.fonts.load('40px "Rubik Dirt"')]),
        new Promise((r) => setTimeout(r, 1500)),
      ]).then(go, go);
    } else go();
  }

  M.boot = boot;
  return M;
})();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', RR.Main.boot);
else RR.Main.boot();
