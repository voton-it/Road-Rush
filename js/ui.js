// Menus, career progression, bike shop and results.
RR.UI = (function () {
  const U = RR.U, D = RR.DATA, G = RR.Game, AU = RR.Audio, Art = RR.Art;
  const $ = (id) => document.getElementById(id);
  const UI = {};
  const SAVE = 'rr.career';
  let career = loadCareer();
  let current = null;
  const quick = U.store.get('rr.quick', { track: 0, level: 0, bike: 'fury' });
  UI.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  function loadCareer() {
    const c = U.store.get(SAVE, null);
    return c && typeof c.money === 'number' && c.level >= 0 ? c : null;
  }
  function save() {
    U.store.set(SAVE, career);
  }
  function newCareer() {
    career = { level: 0, money: 1000, bike: 'vandal', qualified: {}, best: {}, races: 0, wins: 0 };
    save();
  }
  UI.career = () => career;

  function bikeById(id) {
    return D.BIKES.find((b) => b.id === id) || D.BIKES[0];
  }

  UI.show = function (id) {
    document.querySelectorAll('.screen').forEach((s) => (s.hidden = s.id !== id));
    current = id;
    $('touch').hidden = !(id === null && UI.touch);
    if (id && id !== 'scr-pause' && id !== 'scr-results' && id !== 'scr-notice') UI.ensureAttract();
    if (id) {
      const first = $(id).querySelector('.btn-primary:not([disabled]), .btn:not([disabled])');
      if (first && !UI.touch) setTimeout(() => first.focus({ preventScroll: true }), 30);
    }
  };
  UI.current = () => current;

  UI.ensureAttract = function () {
    if (G.mode !== 'attract' || G.state === 'idle' || G.state === 'over') RR.Main.startAttract();
  };

  // ---------------------------------------------------------------------------
  // title
  // ---------------------------------------------------------------------------
  let wipeArmed = false;
  function showTitle() {
    if (UI.touch) document.querySelector('.title-foot').textContent = 'Best played in landscape · on-screen buttons appear in the race';
    $('btn-continue').hidden = !career;
    $('btn-new').textContent = career ? 'New career' : 'Start career';
    $('btn-new').classList.toggle('btn-primary', !career);
    wipeArmed = false;
    UI.show('scr-title');
  }
  UI.showTitle = showTitle;

  // ---------------------------------------------------------------------------
  // hub
  // ---------------------------------------------------------------------------
  const thumbs = {};
  function trackThumb(theme) {
    if (thumbs[theme.id]) return thumbs[theme.id];
    const c = U.makeCanvas(320, 180);
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 110);
    theme.sky.forEach(([o, col]) => grd.addColorStop(o, col));
    g.fillStyle = grd;
    g.fillRect(0, 0, 320, 180);
    const art = G.getArt(theme);
    if (theme.sun) {
      g.fillStyle = theme.sun.glow;
      g.beginPath();
      g.arc(theme.sun.x * 320, theme.sun.y * 90, 26, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = theme.sun.color;
      g.beginPath();
      g.arc(theme.sun.x * 320, theme.sun.y * 90, 8, 0, Math.PI * 2);
      g.fill();
    }
    art.layers.forEach((l, i) => {
      const h = 180 * l.def.h, w = (l.img.width * h) / l.img.height;
      const y = l.def.kind === 'clouds' ? l.def.y * 180 : 92 - h + i * 2;
      for (let x = -i * 60; x < 320; x += w) g.drawImage(l.img, x, y, w, h);
      if (l.def.kind !== 'clouds') {
        g.fillStyle = l.baseColor;
        g.fillRect(0, y + h - 1, 320, 180);
      }
    });
    g.fillStyle = theme.grass[0];
    g.fillRect(0, 96, 320, 84);
    if (theme.grassR) {
      g.fillStyle = theme.grassR[0];
      g.beginPath();
      g.moveTo(170, 96);
      g.lineTo(320, 96);
      g.lineTo(320, 180);
      g.lineTo(290, 180);
      g.fill();
    }
    g.fillStyle = theme.rumble[1];
    g.beginPath();
    g.moveTo(152, 96);
    g.lineTo(168, 96);
    g.lineTo(300, 180);
    g.lineTo(20, 180);
    g.fill();
    g.fillStyle = theme.road[0];
    g.beginPath();
    g.moveTo(154, 96);
    g.lineTo(166, 96);
    g.lineTo(285, 180);
    g.lineTo(35, 180);
    g.fill();
    g.fillStyle = theme.center;
    g.beginPath();
    g.moveTo(159.5, 96);
    g.lineTo(160.5, 96);
    g.lineTo(163, 180);
    g.lineTo(157, 180);
    g.fill();
    const fog = g.createLinearGradient(0, 70, 0, 120);
    fog.addColorStop(0, U.rgba(theme.fog, 0));
    fog.addColorStop(0.5, U.rgba(theme.fog, 0.45));
    fog.addColorStop(1, U.rgba(theme.fog, 0));
    g.fillStyle = fog;
    g.fillRect(0, 70, 320, 50);
    thumbs[theme.id] = c;
    return c;
  }

  function showHub() {
    if (!career) newCareer();
    const lvl = D.LEVELS[career.level];
    $('hub-level').textContent = 'Level ' + lvl.n + ' of ' + D.LEVELS.length;
    $('hub-cash').textContent = U.money(career.money);
    $('hub-bike').textContent = bikeById(career.bike).name;
    const qn = D.TRACKS.filter((t) => career.qualified[t.id]).length;
    $('hub-qual').textContent = qn + ' / ' + D.TRACKS.length;
    const box = $('hub-tracks');
    box.innerHTML = '';
    D.TRACKS.forEach((t, i) => {
      const btn = document.createElement('button');
      btn.className = 'track-card';
      btn.type = 'button';
      const q = !!career.qualified[t.id];
      const best = career.best[t.id + ':' + career.level];
      const thumb = trackThumb(t);
      const cv = U.makeCanvas(thumb.width, thumb.height);
      cv.getContext('2d').drawImage(thumb, 0, 0);
      btn.appendChild(cv);
      btn.insertAdjacentHTML('beforeend',
        '<span class="chip ' + (q ? 'chip-ok' : 'chip-todo') + '">' + (q ? 'Qualified' : 'To qualify') + '</span>' +
        '<span class="tc-name">' + t.name + '</span>' +
        '<span class="tc-meta"><span>' + (t.night ? 'Night' : 'Day') + ' &middot; ' + miles(t, lvl) + ' mi</span><span>' + (best ? 'Best ' + U.formatTime(best) : 'No time yet') + '</span></span>');
      btn.addEventListener('click', () => {
        AU.ui();
        showBrief(i);
      });
      box.appendChild(btn);
    });
    UI.show('scr-hub');
  }
  UI.showHub = showHub;

  function miles(theme, lvl) {
    return ((lvl.segments * RR.Track.SEG) / (G.MPH * 3600)).toFixed(1);
  }

  // ---------------------------------------------------------------------------
  // briefing
  // ---------------------------------------------------------------------------
  let briefTrack = 0;
  function showBrief(i) {
    briefTrack = i;
    const t = D.TRACKS[i], lvl = D.LEVELS[career.level];
    $('brief-eyebrow').textContent = 'Level ' + lvl.n + ' · Race ' + (i + 1) + ' of ' + D.TRACKS.length;
    $('brief-name').textContent = t.name;
    $('brief-blurb').textContent = t.blurb;
    const facts = [
      ['Distance', miles(t, lvl) + ' mi'],
      ['1st prize', U.money(Math.round((D.PRIZES[0] * lvl.prize) / 10) * 10)],
      ['Qualify', 'Top ' + D.QUALIFY_PLACE],
      ['Cops', String(lvl.cops)],
      ['Your bike', bikeById(career.bike).name],
    ];
    $('brief-facts').innerHTML = facts.map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>').join('');
    const rv = U.choice(D.RIVALS);
    $('brief-quote').textContent = '“' + rv.quote + '”';
    $('brief-who').textContent = '— ' + rv.name;
    UI.show('scr-brief');
  }

  // ---------------------------------------------------------------------------
  // shop
  // ---------------------------------------------------------------------------
  function bikeThumb(b) {
    const c = U.makeCanvas(172, 172);
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 172);
    grd.addColorStop(0, '#2a251f');
    grd.addColorStop(1, '#14120f');
    g.fillStyle = grd;
    g.fillRect(0, 0, 172, 172);
    g.fillStyle = '#3a342c';
    g.fillRect(0, 140, 172, 32);
    Art.drawBike(g, 86, 166, 1.42, {
      lean: 0.16, jacket: '#3a3430', helmet: '#f2a516', stripe: '#141414', pants: '#2c3646',
      bike: b.color, trim: b.trim, pipes: b.cls === 'Rat bike' ? 2 : 1, t: 0,
    });
    return c;
  }

  let armedBuy = null, armedTimer = 0;
  function showShop() {
    $('shop-cash').textContent = U.money(career.money);
    const box = $('shop-list');
    box.innerHTML = '';
    const cur = bikeById(career.bike);
    const tradeIn = Math.round(cur.price * 0.5);
    D.BIKES.forEach((b) => {
      const card = document.createElement('div');
      card.className = 'bike-card' + (b.id === cur.id ? ' is-current' : '');
      const top = document.createElement('div');
      top.className = 'bike-top';
      top.appendChild(bikeThumb(b));
      top.insertAdjacentHTML('beforeend', '<div><div class="bike-cls">' + b.cls + '</div><div class="bike-name">' + b.name + '</div></div>');
      card.appendChild(top);
      const m = (k, v, max, label) => '<span>' + k + '</span><span class="meter"><i style="width:' + Math.round(U.clamp(v / max, 0, 1) * 100) + '%"></i></span><span>' + label + '</span>';
      card.insertAdjacentHTML('beforeend',
        '<p class="bike-blurb">' + b.blurb + '</p>' +
        '<div class="meters">' +
        m('Top speed', b.mph - 100, 100, b.mph + ' mph') +
        m('Accel', b.accel - 0.25, 0.27, Math.round(b.accel * 100)) +
        m('Handling', b.handling - 0.85, 0.32, Math.round(b.handling * 100)) +
        m('Toughness', b.durability - 0.7, 0.47, Math.round(b.durability * 100)) +
        m('Nitro', b.nitro, 3, b.nitro ? b.nitro + ' shots' : 'none') +
        '</div>');
      const buy = document.createElement('div');
      buy.className = 'bike-buy';
      const net = b.price - tradeIn;
      const btn = document.createElement('button');
      btn.className = 'btn' + (b.id === cur.id ? ' btn-ghost' : ' btn-primary');
      btn.type = 'button';
      if (b.id === cur.id) {
        btn.textContent = 'Your bike';
        btn.disabled = true;
      } else if (net > career.money) {
        btn.textContent = 'Need ' + U.money(net - career.money) + ' more';
        btn.disabled = true;
      } else {
        btn.textContent = net >= 0 ? 'Buy for ' + U.money(net) : 'Swap, get ' + U.money(-net);
        btn.addEventListener('click', () => {
          if (armedBuy !== b.id) {
            armedBuy = b.id;
            btn.textContent = 'Confirm: ' + (net >= 0 ? 'pay ' + U.money(net) : 'take ' + U.money(-net));
            clearTimeout(armedTimer);
            armedTimer = setTimeout(() => {
              armedBuy = null;
              showShop();
            }, 3500);
            return;
          }
          clearTimeout(armedTimer);
          armedBuy = null;
          career.money -= net;
          career.bike = b.id;
          save();
          AU.cash();
          showShop();
        });
      }
      buy.innerHTML = '<span class="price">' + (b.price ? U.money(b.price) : 'Free') + (b.id !== cur.id && tradeIn ? '<small>−' + U.money(tradeIn) + ' trade-in</small>' : '') + '</span>';
      buy.appendChild(btn);
      card.appendChild(buy);
      box.appendChild(card);
    });
    UI.show('scr-shop');
  }

  // ---------------------------------------------------------------------------
  // quick race
  // ---------------------------------------------------------------------------
  function pills(boxId, items, selected, onPick) {
    const box = $(boxId);
    box.innerHTML = '';
    items.forEach(([value, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pill';
      b.textContent = label;
      b.setAttribute('aria-pressed', String(value === selected));
      b.addEventListener('click', () => {
        AU.ui();
        onPick(value);
        box.querySelectorAll('.pill').forEach((p) => p.setAttribute('aria-pressed', String(p === b)));
      });
      box.appendChild(b);
    });
  }
  function showQuick() {
    pills('quick-track', D.TRACKS.map((t, i) => [i, t.name]), quick.track, (v) => (quick.track = v));
    pills('quick-level', D.LEVELS.map((l, i) => [i, 'Level ' + l.n]), quick.level, (v) => (quick.level = v));
    pills('quick-bike', D.BIKES.map((b) => [b.id, b.name]), quick.bike, (v) => (quick.bike = v));
    UI.show('scr-quick');
  }

  // ---------------------------------------------------------------------------
  // racing
  // ---------------------------------------------------------------------------
  let lastRace = null;
  function startRace(opts) {
    AU.init();
    lastRace = opts;
    UI.show(null);
    G.paused = false;
    G.setup(opts);
    G.onEnd = onRaceEnd;
    if (AU.prefs.music) AU.startMusic();
  }
  UI.startRace = startRace;

  UI.pause = function () {
    if (G.mode === 'attract' || G.state === 'over' || G.state === 'idle' || current) return;
    G.paused = true;
    AU.silence();
    syncSound();
    UI.show('scr-pause');
  };
  function resume() {
    G.paused = false;
    RR.Input.clear();
    UI.show(null);
  }

  // ---------------------------------------------------------------------------
  // results
  // ---------------------------------------------------------------------------
  let afterResults = null;
  function onRaceEnd(res) {
    const isCareer = res.mode === 'career';
    const t = D.TRACKS[res.track];
    const lvl = D.LEVELS[res.level];
    const title = $('res-title');
    title.className = 'h1 res-title';
    const ledger = [];
    afterResults = isCareer ? showHub : showTitle;

    if (res.outcome === 'finished') {
      title.textContent = U.ordinal(res.place) + ' place';
      const q = res.place <= D.QUALIFY_PLACE;
      title.classList.add(q ? 'win' : 'x');
      $('res-sub').textContent = t.name + ' · ' + U.formatTime(res.time) + (q ? ' · Qualified' : ' · Top ' + D.QUALIFY_PLACE + ' qualify');
    } else if (res.outcome === 'wrecked') {
      title.textContent = 'Wrecked';
      title.classList.add('bad');
      $('res-sub').textContent = 'You destroyed your bike on ' + t.name + '. The repair shop sends its regards.';
    } else {
      title.textContent = 'Busted';
      title.classList.add('cop');
      $('res-sub').textContent = 'The police caught you on the ground on ' + t.name + '. Pay up.';
    }
    $('res-eyebrow').textContent = (isCareer ? 'Career · Level ' : 'Quick race · Level ') + lvl.n;

    if (isCareer) {
      let prize = 0, bonus = 0, cost = 0;
      if (res.outcome === 'finished') {
        prize = Math.round((D.PRIZES[res.place - 1] * lvl.prize) / 10) * 10;
        if (res.place <= D.QUALIFY_PLACE) career.qualified[t.id] = true;
        const key = t.id + ':' + career.level;
        if (!career.best[key] || res.time < career.best[key]) career.best[key] = res.time;
        if (res.place === 1) career.wins++;
      }
      bonus = res.knockouts * Math.round(100 * lvl.prize);
      if (res.outcome === 'wrecked') cost = lvl.repair;
      if (res.outcome === 'busted') cost = lvl.fine;
      career.races++;
      const before = career.money;
      career.money += prize + bonus - cost;
      ledger.push(['Cash before', U.money(before), '']);
      if (prize) ledger.push(['Prize money', '+' + U.money(prize), 'plus']);
      if (bonus) ledger.push([res.knockouts + ' knockout' + (res.knockouts > 1 ? 's' : '') + ' bonus', '+' + U.money(bonus), 'plus']);
      if (cost) ledger.push([res.outcome === 'wrecked' ? 'Repair bill' : 'Police fine', '−' + U.money(cost), 'minus']);
      ledger.push(['Cash now', U.money(career.money), 'total']);

      if (career.money < 0) {
        afterResults = () => {
          career = null;
          U.store.set(SAVE, null);
          notice('Game over', 'Out of cash', "You couldn't cover the bill. The bank took your bike and your leathers. Start a new career and try again.", showTitle);
        };
      } else if (D.TRACKS.every((tr) => career.qualified[tr.id])) {
        if (career.level >= D.LEVELS.length - 1) {
          career.champion = true;
          afterResults = () => notice('Career complete', 'Champion of the road', 'You qualified on every road at every level. Nobody rides meaner. Your save stays as it is, so keep racing for cash and better times.', () => {
            career.qualified = {};
            save();
            showHub();
          });
        } else {
          career.level++;
          career.qualified = {};
          const nl = D.LEVELS[career.level];
          afterResults = () => notice('Level ' + nl.n + ' unlocked', 'Moving up', 'Longer roads, faster rivals and more cops. Rivals now top out around ' + nl.rivalMph[1] + ' mph, so check the bike shop before you race.', showHub);
        }
      }
      save();
    } else {
      ledger.push(['Your time', res.outcome === 'finished' ? U.formatTime(res.time) : 'DNF', '']);
      ledger.push(['Knockouts', String(res.knockouts), '']);
    }

    $('res-ledger').innerHTML = ledger.map(([k, v, cls]) => '<dt class="' + cls + '">' + k + '</dt><dd class="' + cls + '">' + v + '</dd>').join('');
    $('res-table').innerHTML = res.standings.map((s) => {
      const label = s.out ? s.out.toUpperCase() : s.time != null ? U.formatTime(s.time) : '—';
      const cls = (s.isPlayer ? 'me' : '') + (s.place <= D.QUALIFY_PLACE && !s.out ? ' q' : '');
      return '<li class="' + cls + '"><span class="pos">' + (s.out ? '–' : s.place) + '</span><span>' + s.name + '</span><span>' + label + '</span></li>';
    }).join('');
    $('res-retry').hidden = isCareer && (!career || career.money < 0);
    $('res-continue').textContent = isCareer ? 'Continue' : 'Main menu';
    UI.show('scr-results');
  }

  function notice(eyebrow, title, body, next) {
    $('notice-eyebrow').textContent = eyebrow;
    $('notice-title').textContent = title;
    $('notice-body').textContent = body;
    $('notice-ok').onclick = () => {
      AU.ui();
      next();
    };
    UI.show('scr-notice');
  }

  // ---------------------------------------------------------------------------
  // sound toggles
  // ---------------------------------------------------------------------------
  function syncSound() {
    for (const id of ['opt-sfx', 'opt-sfx2']) $(id).checked = AU.prefs.sfx;
    for (const id of ['opt-music', 'opt-music2']) $(id).checked = AU.prefs.music;
  }

  // ---------------------------------------------------------------------------
  // touch controls
  // ---------------------------------------------------------------------------
  function bindTouch() {
    const edge = { hitL: 1, hitR: 1, kick: 1, nitro: 1, pause: 1 };
    document.querySelectorAll('#touch .tc').forEach((b) => {
      const act = b.dataset.act;
      const down = (e) => {
        e.preventDefault();
        b.setPointerCapture && b.setPointerCapture(e.pointerId);
        b.classList.add('on');
        if (act === 'pause') return UI.pause();
        RR.Input.touch[act] = true;
        if (edge[act]) RR.Input.press(act);
      };
      const up = (e) => {
        e.preventDefault();
        b.classList.remove('on');
        RR.Input.touch[act] = false;
      };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  // ---------------------------------------------------------------------------
  UI.init = function () {
    const click = (id, fn) => $(id).addEventListener('click', () => {
      AU.init();
      if (AU.prefs.music) AU.startMusic();
      AU.ui();
      fn();
    });
    click('btn-continue', showHub);
    click('btn-new', () => {
      if (career && !wipeArmed) {
        wipeArmed = true;
        $('btn-new').textContent = 'Click again to erase your save';
        return;
      }
      newCareer();
      showHub();
    });
    click('btn-quick', showQuick);
    click('btn-help', () => UI.show('scr-help'));
    click('help-back', showTitle);
    click('hub-shop', showShop);
    click('hub-menu', showTitle);
    click('shop-back', showHub);
    click('brief-back', showHub);
    click('brief-go', () => startRace({ mode: 'career', track: briefTrack, level: career.level, bike: career.bike }));
    click('quick-back', showTitle);
    click('quick-go', () => {
      U.store.set('rr.quick', quick);
      startRace({ mode: 'quick', track: quick.track, level: quick.level, bike: quick.bike });
    });
    click('res-continue', () => afterResults && afterResults());
    click('res-retry', () => {
      if (lastRace.mode === 'career') lastRace = Object.assign({}, lastRace, { bike: career.bike, level: career.level });
      startRace(lastRace);
    });
    click('pause-resume', resume);
    click('pause-restart', () => startRace(G.opts));
    click('pause-quit', () => {
      G.abort();
      G.paused = false;
      if (G.opts && G.opts.mode === 'career') showHub();
      else showTitle();
    });
    for (const id of ['opt-sfx', 'opt-sfx2']) $(id).addEventListener('change', (e) => { AU.init(); AU.setSfx(e.target.checked); syncSound(); });
    for (const id of ['opt-music', 'opt-music2']) $(id).addEventListener('change', (e) => {
      AU.init();
      AU.setMusic(e.target.checked);
      if (e.target.checked) AU.startMusic();
      syncSound();
    });
    syncSound();
    bindTouch();
  };

  return UI;
})();
