/* Briscola: UI, game flow, pass-and-play and phone-to-phone multiplayer.
 *
 * Multiplayer model: the phone that pairs others is the host. It runs the engine and sends every guest
 * phone a redacted view (its own cards only). Guests send back the card they play. Seats can mix
 * this-phone humans, CPU players and other phones.
 */
(function () {
  'use strict';
  const E = window.BriscolaEngine, AI = window.BriscolaAI, D = window.BriscolaDecks, I18N = window.BriscolaI18n;
  // BRISCOLA_NO_NET is set by builds that run where peer-to-peer connections are blocked (the claude.ai Artifact).
  const N = window.BriscolaNet && window.BriscolaNet.supported() && !window.BRISCOLA_NO_NET ? window.BriscolaNet : null;
  const STORE = 'briscola.v1';

  // ---------- persistence ----------
  const store = {
    load() { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; } },
    save(v) { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (e) { /* storage unavailable: play on without saving */ } },
  };

  const DEFAULTS = {
    lang: (navigator.language || 'en').toLowerCase().startsWith('it') ? 'it' : 'en',
    deck: 'triestine',
    n: 2,
    seats: [0, 1, 2, 3].map(() => ({ name: '', cpu: false, level: 'normal', remote: null })),
    hideHands: true, twoTap: true, swap: 0, partnerView: true, showScore: false,
    target: 1, speed: 'normal', sound: true,
    myName: '', knownDevs: {}, room: null, lastRoom: null,
  };

  const S = { settings: JSON.parse(JSON.stringify(DEFAULTS)), session: null, savedSession: null };
  // session: { cfg: {n, seats, swap, target}, G (engine state, or a redacted view on guests), M: {wins, hand, dealer, over, counted}, opts? }

  const ui = {
    viewer: -1, selected: null, handoff: null, sheet: null, toast: null, collecting: false,
    justPlayed: null, justDrawn: [], drawnAll: null, gen: 0, humanResolve: null, remoteWait: null, error: '', sent: false,
  };

  const net = {
    role: null, // null (this phone runs the game) | 'guest'
    devices: {}, // host: dev -> { dev, name, link, online, via }
    room: null, // host: { code, broker, status: 'opening' | 'open' | 'error', err }
    pair: null, // open pairing screen state
    guest: null, // guest: { link, mode, code, hostName, status, lobby }
    lastSent: {},
  };
  const DEV = N ? N.deviceId() : 'local';

  function persist() {
    store.save({ settings: S.settings, session: net.role === 'guest' ? S.savedSession : S.session });
  }

  // ---------- helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function t(key, vars) {
    const dict = I18N[S.settings.lang] || I18N.en;
    let s = dict[key] != null ? dict[key] : I18N.en[key] != null ? I18N.en[key] : key;
    if (vars && typeof s === 'string') s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
    return s;
  }
  const SPEED = { slow: 1.5, normal: 1, fast: 0.55 };
  const spd = () => SPEED[S.settings.speed] || 1;
  const deckId = () => S.settings.deck;
  const deck = () => D.get(deckId());

  const isGuest = () => net.role === 'guest';
  const deviceList = () => Object.values(net.devices);
  const hasDevices = () => deviceList().length > 0;
  const devOnline = (dev) => !!(net.devices[dev] && net.devices[dev].online);
  const devName = (dev) => (net.devices[dev] && net.devices[dev].name) || S.settings.knownDevs[dev] || t('remote');

  const cfg = () => S.session.cfg;
  const G = () => S.session.G;
  const M = () => S.session.M;
  const seatOf = (p) => cfg().seats[p];
  /** Game options decided by the host. */
  const opt = (k) => (isGuest() && S.session && S.session.opts ? S.session.opts[k] : S.settings[k]);
  function nameFrom(seats, p) {
    const s = seats[p];
    const nm = (s.name || '').trim();
    return nm || (s.cpu ? t('cpu_name', { n: p + 1 }) : t('seat', { n: p + 1 }));
  }
  const name = (p) => nameFrom(cfg().seats, p);
  /** A human seat played on this phone. */
  function isLocal(p) {
    const s = seatOf(p);
    if (isGuest()) return s.remote === 'me';
    return !s.cpu && !s.remote;
  }
  function localSeats() {
    const out = [];
    for (let p = 0; p < cfg().n; p++) if (isLocal(p)) out.push(p);
    return out;
  }
  const sideCount = () => (cfg().n === 4 ? 2 : cfg().n);
  const sideName = (i) => (cfg().n === 4 ? t('team', { a: name(i), b: name(i + 2) }) : name(i));
  const totalTricks = (n) => (n === 2 ? 20 : n === 3 ? 13 : 10);
  function scoresOf(g) {
    if (!g.pts) return E.scores(g);
    return { perPlayer: g.pts, perSide: g.teams ? [g.pts[0] + g.pts[2], g.pts[1] + g.pts[3]] : g.pts.slice() };
  }
  function hostName() {
    const st = S.settings;
    for (let p = 0; p < st.n; p++) {
      const s = st.seats[p];
      if (!s.cpu && !s.remote && s.name.trim()) return s.name.trim();
    }
    return t('host_tag');
  }

  function cardName(c) {
    const r = E.rank(c), s = E.suit(c), fr = deck().system === 'fr';
    const rn = r === 1 ? t('rank_1') : r === 8 ? t('rank_8') : r === 9 ? t(fr ? 'rank_9fr' : 'rank_9') : r === 10 ? t('rank_10') : String(r);
    return `${rn} ${t('of')} ${suitName(s)}`;
  }
  const suitName = (s) => t(deck().system === 'fr' ? 'suits_fr' : 'suits_latin')[s];
  const ptsLabel = (n) => (n === 0 ? t('pt0') : n === 1 ? t('pt1') : t('pts', { n }));

  const faceHTML = (c) => `<div class="c">${D.face(c, deckId())}</div>`;
  const backHTML = () => `<div class="c">${D.back(deckId())}</div>`;

  const ICON = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>',
  };

  function toastHTML(x) {
    if (!x) return '';
    if (x.k === 'takes') return `${esc(name(x.p))} · <b>${esc(ptsLabel(x.pts))}</b>`;
    if (x.k === 'swap') return esc(t('swapped', { name: name(x.p), give: cardName(x.give), took: cardName(x.took) }));
    return '';
  }

  // ---------- sound & screen ----------
  let actx = null;
  function tone(freq, dur, type, vol, delay) {
    if (!S.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = actx.currentTime + (delay || 0);
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'triangle'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.08, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* audio unavailable */ }
  }
  const sfx = {
    play: () => tone(330, 0.07, 'triangle', 0.09),
    win: () => { tone(523, 0.12, 'sine', 0.07); tone(784, 0.18, 'sine', 0.06, 0.1); },
    turn: () => tone(660, 0.08, 'sine', 0.05),
  };
  let wakeLock = null;
  async function keepAwake() {
    try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { /* refused */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (S.session || hasDevices() || isGuest())) keepAwake();
  });

  // ---------- table geometry ----------
  function viewerForRender() {
    if (ui.viewer >= 0) return ui.viewer;
    if (ui.handoff) return ui.handoff.p;
    return nextLocalFrom(G().turn);
  }
  function nextLocalFrom(p) {
    const n = cfg().n;
    for (let i = 0; i < n; i++) { const q = (p + i) % n; if (isLocal(q)) return q; }
    return 0;
  }
  function posOf(p, v) {
    const n = cfg().n, r = (p - v + n) % n;
    if (n === 2) return r ? 'top' : 'bottom';
    if (n === 3) return ['bottom', 'right', 'left'][r];
    return ['bottom', 'right', 'top', 'left'][r];
  }

  // ================= SETUP SCREEN =================
  const seg = (act, opts, cur) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${esc(l)}</button>`).join('')}</div>`;

  function renderSetup() {
    if (isGuest()) { renderLobby(); return; }
    const st = S.settings, n = st.n, d = deck();
    const sw = (id, key) => `<span class="switch"><input type="checkbox" id="${id}" data-set="${key}" ${st[key] ? 'checked' : ''}><span></span></span>`;
    const devs = deviceList();

    let seats = '';
    for (let p = 0; p < n; p++) {
      const s = st.seats[p];
      const team = n === 4 ? (p % 2 ? 'team-b' : 'team-a') : '';
      const kind = s.remote ? 'r' : s.cpu ? 'c' : 'h';
      const kinds = [['h', devs.length || s.remote ? t('this_phone') : t('human')], ['c', t('cpu')]];
      if (devs.length || s.remote) kinds.push(['r', t('remote')]);
      let extra = '';
      if (s.cpu) extra = `<select id="seat-level-${p}" data-level="${p}" aria-label="CPU">${['easy', 'normal', 'hard'].map((l) => `<option value="${l}" ${s.level === l ? 'selected' : ''}>${t(l)}</option>`).join('')}</select>`;
      else if (s.remote) {
        const ids = new Set(devs.map((x) => x.dev).concat([s.remote]));
        extra = `<select id="seat-dev-${p}" data-dev="${p}" aria-label="${t('choose_phone')}">${[...ids].map((id) => `<option value="${esc(id)}" ${s.remote === id ? 'selected' : ''}>${esc(devName(id))}${devOnline(id) ? '' : ' (' + t('st_offline') + ')'}</option>`).join('')}</select>`;
      }
      seats += `<div class="seat-row"><span class="dot ${team}">${p + 1}</span>
        <input id="seat-name-${p}" data-name="${p}" maxlength="16" autocomplete="off" placeholder="${esc(s.cpu ? t('cpu_name', { n: p + 1 }) : s.remote ? devName(s.remote) : t('seat', { n: p + 1 }))}" value="${esc(s.name)}">
        <div class="seat-ctrl">${seg('seat-kind-' + p, kinds, kind)}${extra}</div></div>`;
    }
    const hint = seatHint();

    let resume = '';
    if (S.session && S.session.G) {
      const c = S.session.cfg;
      const names = c.seats.slice(0, c.n).map((_, p) => nameFrom(c.seats, p)).join(', ');
      resume = `<button class="resume" data-act="resume"><span><strong>${t('resume')}</strong><span>${esc(t('resume_d', { hand: S.session.M.hand, names }))}</span></span><span aria-hidden="true">&rsaquo;</span></button>`;
    }

    const suits = [0, 1, 2, 3].map((s) => D.suitIcon(s, d.id)).join('');
    $('#setup').innerHTML = `<div class="setup-wrap">
      <header class="brand"><div><h1 class="wordmark">Briscola</h1><p class="wordmark-sub">${t('tagline')}</p></div><div class="brand-suits">${suits}</div></header>
      ${resume}
      <div class="panel"><div class="panel-head"><h2>${t('players')}</h2></div>
        ${seg('n', [[2, '2'], [3, '3'], [4, '4']], n)}
        <div class="seats${devs.length || st.seats.slice(0, n).some((x) => x.remote) ? ' stacked' : ''}">${seats}</div>
        ${hint ? `<p class="hint" id="seat-hint">${hint}</p>` : ''}
        ${ui.error ? `<p class="error" role="alert">${esc(ui.error)}</p>` : ''}
      </div>
      ${phonesPanel()}
      <div class="panel"><div class="panel-head"><h2>${t('deck')}</h2></div>
        <button class="deck-choice" data-act="decks">${fanHTML(d)}<span class="deck-meta"><strong>${d.name}</strong><span>${d.region} · ${d.area}</span><span>${t('sys_' + d.system)}, ${t(d.figures)}</span><em>${t('change')}</em></span></button>
      </div>
      <div class="panel"><h2>${t('options')}</h2>
        <div class="opt"><label for="o-hide">${t('opt_hide')}</label>${sw('o-hide', 'hideHands')}<p class="hint">${t('opt_hide_d')}</p></div>
        <div class="opt"><label for="o-tap">${t('opt_twotap')}</label>${sw('o-tap', 'twoTap')}<p class="hint">${t('opt_twotap_d')}</p></div>
        <div class="opt"><span class="lbl">${t('opt_swap')}</span>${seg('swap', [[0, t('off')], [2, '2'], [7, '7']], st.swap)}<p class="hint">${t('opt_swap_d')}</p></div>
        ${n === 4 ? `<div class="opt"><label for="o-partner">${t('opt_partner')}</label>${sw('o-partner', 'partnerView')}<p class="hint">${t('opt_partner_d')}</p></div>` : ''}
        <div class="opt"><label for="o-score">${t('opt_score')}</label>${sw('o-score', 'showScore')}<p class="hint">${t('opt_score_d')}</p></div>
        <div class="opt"><span class="lbl">${t('opt_match')}</span>${seg('target', [[1, '1'], [2, '2'], [3, '3'], [5, '5']], st.target)}</div>
        <div class="opt"><span class="lbl">${t('opt_speed')}</span>${seg('speed', [['slow', t('slow')], ['normal', t('normal')], ['fast', t('fast')]], st.speed)}</div>
        <div class="opt"><label for="o-sound">${t('opt_sound')}</label>${sw('o-sound', 'sound')}</div>
        <div class="opt"><span class="lbl">${t('lang')}</span>${seg('lang', [['en', 'English'], ['it', 'Italiano']], st.lang)}</div>
      </div>
      <p style="text-align:center;margin:0"><button class="linkish" data-act="rules" style="color:var(--on-felt)">${t('rules')}</button></p>
    </div>
    <div class="deal-bar"><button class="btn btn-primary" data-act="deal">${t('deal')}</button></div>`;
    document.documentElement.lang = st.lang;
    broadcastLobby();
  }

  function deviceRows() {
    return deviceList().map((d) => `<div class="dev-row"><span class="sdot ${d.online ? 'on' : 'off'}"></span>
      <span class="dev-meta"><strong>${esc(d.name || t('remote'))}</strong><span>${d.via === 'room' ? t('room_code') : 'QR'} · ${t(d.online ? 'st_online' : 'st_offline')}</span></span>
      <button class="close-btn" data-act="dev-remove" data-v="${esc(d.dev)}" aria-label="${t('remove')}">${ICON.close}</button></div>`).join('');
  }

  let roomQrCache = { code: null, svg: '' };
  function roomBlock() {
    const r = net.room;
    if (!r) return '';
    if (r.status === 'opening') return `<div class="room-box"><p class="hint">${t('room_opening')}</p></div>`;
    if (r.status === 'error') return `<div class="room-box"><p class="error">${esc(r.err)}</p><button class="btn btn-ghost" data-act="room-close">${t('close')}</button></div>`;
    if (roomQrCache.code !== r.code) {
      const url = location.origin + location.pathname + '?join=' + r.code;
      roomQrCache = { code: r.code, svg: N.qrSvg(url) };
    }
    return `<div class="room-box"><span class="kicker">${t('room_code')}</span><div class="room-code" id="room-code">${r.code}</div>
      <div class="qr-box small">${roomQrCache.svg}</div><p class="hint">${t('room_hint')}</p>
      <button class="btn btn-ghost" data-act="room-close">${t('close_room')}</button></div>`;
  }

  function phonesPanel() {
    if (!N) return '';
    const devs = deviceList();
    return `<div class="panel" id="phones-panel"><div class="panel-head"><h2>${t('phones')}</h2>${ICON.phone}</div>
      ${devs.length ? `<div class="devs">${deviceRows()}</div>` : `<p class="hint">${t('phones_d')}</p>`}
      ${roomBlock()}
      <div class="btn-col">
        <button class="btn btn-ink" data-act="pair-qr">${t('add_qr')}<small>${t('add_qr_d')}</small></button>
        ${net.room ? '' : `<button class="btn btn-ghost" data-act="room-open">${t('open_room')}<small>${t('open_room_d')}</small></button>`}
      </div>
      ${devs.length || net.room ? '' : `${S.settings.lastRoom ? `<button class="btn btn-primary" data-act="rejoin">${t('rejoin', { code: S.settings.lastRoom })}</button>` : ''}<p style="text-align:center;margin:0"><button class="linkish" data-act="join-open">${t('join_game')}</button></p>`}
    </div>`;
  }

  function seatHint() {
    const st = S.settings, n = st.n, nm = (p) => esc(nameFrom(st.seats, p));
    return n === 4 ? t('teams_hint', { a: nm(0), b: nm(1), c: nm(2), d: nm(3) }) : n === 3 ? t('three_hint') : '';
  }

  function fanHTML(d) {
    const second = d.system === 'fr' ? 19 : 28; // King of Hearts / Knight of Swords
    return `<span class="fan"><span class="c">${D.face(0, d.id)}</span><span class="c">${D.face(second, d.id)}</span><span class="c">${D.back(d.id)}</span></span>`;
  }

  // ---------- guest lobby ----------
  function renderLobby() {
    const gst = net.guest, lob = gst.lobby, d = deck();
    const host = (lob && lob.host) || gst.hostName || t('host_tag');
    let seats = '';
    if (lob) {
      seats = lob.seats.map((s, p) => `<div class="lobby-seat"><span class="dot ${lob.n === 4 ? (p % 2 ? 'team-b' : 'team-a') : ''}">${p + 1}</span><span class="nm">${esc(s.name)}</span>${s.cpu ? `<span class="badge">${t('cpu')}</span>` : ''}${s.mine ? `<span class="badge mine">${t('you_tag')}</span>` : ''}</div>`).join('');
    }
    const sw = (id, key) => `<span class="switch"><input type="checkbox" id="${id}" data-set="${key}" ${S.settings[key] ? 'checked' : ''}><span></span></span>`;
    $('#setup').innerHTML = `<div class="setup-wrap">
      <header class="brand"><div><h1 class="wordmark">Briscola</h1><p class="wordmark-sub">${esc(t('lobby_title', { name: host }))}</p></div><div class="brand-suits">${[0, 1, 2, 3].map((s) => D.suitIcon(s, d.id)).join('')}</div></header>
      ${guestBanner()}
      <div class="panel"><div class="panel-head"><h2>${t('seats_title')}</h2>${ICON.phone}</div>
        <label class="field"><span>${t('your_name')}</span><input id="my-name" data-myname maxlength="16" autocomplete="off" value="${esc(S.settings.myName)}"></label>
        <div class="lobby-seats">${seats}</div>
        <p class="hint">${esc(t('lobby_wait', { name: host }))}</p>
      </div>
      <div class="panel"><div class="panel-head"><h2>${t('deck')}</h2></div>
        <button class="deck-choice" data-act="decks">${fanHTML(d)}<span class="deck-meta"><strong>${d.name}</strong><span>${d.region} · ${d.area}</span><em>${t('change')}</em></span></button>
      </div>
      <div class="panel"><h2>${t('options')}</h2>
        <div class="opt"><label for="o-tap">${t('opt_twotap')}</label>${sw('o-tap', 'twoTap')}</div>
        <div class="opt"><label for="o-sound">${t('opt_sound')}</label>${sw('o-sound', 'sound')}</div>
        <div class="opt"><span class="lbl">${t('lang')}</span>${seg('lang', [['en', 'English'], ['it', 'Italiano']], S.settings.lang)}</div>
      </div>
      <p style="text-align:center;margin:0"><button class="btn btn-ghost" data-act="guest-leave" style="color:var(--on-felt)">${t('leave')}</button></p>
    </div>`;
    document.documentElement.lang = S.settings.lang;
  }

  function guestBanner() {
    const gst = net.guest;
    if (!gst || gst.status !== 'lost') return '';
    if (gst.mode === 'room') return `<div class="netbanner">${t('lost')} ${t('reconnecting')}</div>`;
    return `<div class="netbanner">${t('lost')} ${t('repair_hint')}<button class="btn btn-light" data-act="join-open">${t('scan_host')}</button></div>`;
  }

  // ================= GAME SCREEN =================
  function render() {
    renderLayer();
    if (!S.session || !S.session.G || $('#game').hidden) return;
    renderGame();
  }

  function netChip() {
    if (isGuest()) {
      return net.guest && net.guest.status === 'lost' ? `<button class="net-chip off" data-act="menu">${t(net.guest.mode === 'room' ? 'reconnecting' : 'lost')}</button>` : '';
    }
    const off = [];
    for (let p = 0; p < cfg().n; p++) { const s = seatOf(p); if (s.remote && !devOnline(s.remote) && !off.includes(s.remote)) off.push(s.remote); }
    if (!off.length) return '';
    return `<button class="net-chip off" data-act="phones">${esc(t('dev_off', { name: devName(off[0]) }))}</button>`;
  }

  function renderGame() {
    const g = G(), n = g.n, v = viewerForRender(), st = S.settings;
    const sc = scoresOf(g);
    const teams = n === 4;
    const tdot = (p) => (teams ? `<span class="tdot ${p % 2 ? 'b' : 'a'}"></span>` : '');
    const dealer = (p) => (p === g.dealer ? `<span class="badge dealer" title="dealer">${t('dealer')}</span>` : '');
    const cpu = (p) => (seatOf(p).cpu && seatOf(p).name ? `<span class="badge">${t('cpu')}</span>` : '');
    const phoneMark = (p) => (!isGuest() && seatOf(p).remote ? `<span class="badge${devOnline(seatOf(p).remote) ? '' : ' warn'}">${ICON.phone}</span>` : '');
    const pts = (p) => (opt('showScore') && g.pts !== null ? `<span class="pts">${teams ? sc.perSide[p % 2] : sc.perPlayer[p]}</span>` : '');
    const partnerOpen = teams && opt('partnerView') && E.cardsLeftToDraw(g) === 0;
    const handVisible = ui.viewer >= 0 && !ui.handoff && isLocal(ui.viewer);

    // Top bar
    const left = E.cardsLeftToDraw(g);
    const trumpIcon = D.suitIcon(g.trump, deckId());
    let matchChip = '';
    if (cfg().target > 1 || M().hand > 1) {
      matchChip = `<div class="match-chip">${t('match')}<br><b>${M().wins.join(' – ')}</b></div>`;
    }
    const top = `<div class="topbar">
      <button class="icon-btn" data-act="menu" aria-label="${t('menu')}">${ICON.menu}</button>
      <div class="trump-chip">${trumpIcon}<span><small>${t('briscola')}</small><br><b>${esc(suitName(g.trump))}</b></span></div>
      <div class="top-spacer"></div>${netChip()}<div class="deck-chip">${left ? `<b>${left}</b><br>${esc(t('in_deck', { n: '' }).trim())}` : esc(t('deck_empty'))}</div>${matchChip}</div>`;

    // Opponents (ordered left, top, right as seen by the viewer)
    const order = { left: 0, top: 1, right: 2 };
    const others = [];
    for (let p = 0; p < n; p++) if (p !== v) others.push(p);
    others.sort((a, b) => order[posOf(a, v)] - order[posOf(b, v)]);
    const opps = others.map((p) => {
      const isPartner = teams && p === (v + 2) % 4;
      const showFace = isPartner && partnerOpen && handVisible && g.hands[p].every((c) => c >= 0);
      const minis = showFace
        ? `<div class="minis face">${g.hands[p].map(faceHTML).join('')}</div>`
        : `<div class="minis">${g.hands[p].map(backHTML).join('')}</div>`;
      const turn = g.phase === 'play' && g.turn === p ? ' turn' : '';
      return `<div class="opp${turn}">${minis}<div class="tag">${tdot(p)}<span class="nm">${esc(name(p))}</span>${cpu(p)}${phoneMark(p)}${dealer(p)}${pts(p)}</div></div>`;
    }).join('');

    // Stock
    let stock;
    if (!g.briscolaTaken) {
      const layers = Math.min(4, Math.ceil(g.deck.length / 6));
      let pile = '';
      for (let i = 0; i < layers; i++) pile += `<div class="c" style="transform:translate(${i * 1.5}px,${-i * 1.5}px)">${D.back(deckId())}</div>`;
      stock = `<div class="stock"><div class="brisc">${faceHTML(g.briscola)}</div><div class="pile">${pile}</div></div>`;
    } else {
      stock = `<div class="stock"><div class="empty-trump">${trumpIcon}</div></div>`;
    }

    // Trick
    const slots = g.trick.map((pl) => {
      const pos = posOf(pl.p, v);
      const cls = ['slot', 'p-' + pos];
      if (pl.c === ui.justPlayed) cls.push('enter');
      if (g.phase === 'trickDone' && pl.p === g.pendingWinner) cls.push('win');
      return `<div class="${cls.join(' ')}">${faceHTML(pl.c)}<span class="who">${esc(name(pl.p))}</span></div>`;
    }).join('');
    const collect = ui.collecting && g.pendingWinner != null ? ' collect-' + posOf(g.pendingWinner, v) : '';
    const lastBtn = g.lastTrick ? `<button class="last-btn" data-act="last">${ICON.back}${t('last_trick')}</button>` : '';
    const trickNo = `<div class="trick-no">${t('trick_of', { i: Math.min(g.tricks + 1, totalTricks(n)), n: totalTricks(n) })}</div>`;
    const toast = ui.toast ? `<div class="toast" role="status">${toastHTML(ui.toast)}</div>` : '';
    const firstTurn = g.phase === 'play' && g.turn === v && handVisible && g.tricks === 0 && M().hand === 1 && ui.selected == null && !ui.toast;
    const table = `<div class="table n${n}${collect}">${stock}${slots}${lastBtn}${trickNo}${toast}</div>`;

    // Viewer line + hand
    const myTurn = g.phase === 'play' && g.turn === v && handVisible && !ui.sent;
    let status = '', statusCls = 'status';
    if (g.phase === 'play') {
      const ts = seatOf(g.turn);
      if (myTurn) { status = t('your_turn', { name: name(v) }); statusCls += ' go'; }
      else if (ts.cpu) status = t('thinking', { name: name(g.turn) });
      else if (!isGuest() && ts.remote) status = t(devOnline(ts.remote) ? 'wait_remote' : 'wait_off', { name: name(g.turn) });
      else if (isGuest() && ts.off) status = t('wait_off', { name: name(g.turn) });
      else status = t('waiting', { name: name(g.turn) });
    }
    const swap = myTurn && E.canSwap(g, v) ? `<button class="swap-btn" data-act="do-swap">${esc(t('swap_btn', { card: cardName(g.briscola) }))}</button>` : '';
    const meTag = `<div class="tag">${tdot(v)}<span class="nm">${esc(name(v))}</span>${dealer(v)}${pts(v)}</div>`;
    let hand;
    if (handVisible) {
      hand = g.hands[v].map((c) => {
        const cls = ['hc'];
        if (ui.selected === c) cls.push('sel');
        if (ui.justDrawn.includes(c)) cls.push('drawn');
        return `<button class="${cls.join(' ')}" data-card="${c}" aria-label="${esc(cardName(c))}">${faceHTML(c)}</button>`;
      }).join('');
    } else {
      hand = g.hands[v].map(() => `<div class="hc" aria-hidden="true">${backHTML()}</div>`).join('');
    }
    const me = `<div class="me"><div class="me-line"><span class="${statusCls}">${esc(status)}${firstTurn ? `<small>${esc(t(st.twoTap ? 'tap2' : 'tap1'))}</small>` : ''}</span>${swap || meTag}</div>
      <div class="hand${myTurn ? '' : ' off'}">${hand}</div></div>`;

    $('#game').innerHTML = top + `<div class="opps">${opps}</div>` + table + me;
    $('#game').style.setProperty('--spd', spd());
    broadcastView();
    ui.justPlayed = null;
    ui.justDrawn = [];
    ui.drawnAll = null;
  }

  // ================= OVERLAYS =================
  function renderLayer() {
    const L = $('#layer');
    if (ui.handoff) {
      const g = G(), p = ui.handoff.p;
      let info = '';
      if (g.phase === 'play' && g.turn === p) info = g.trick.length ? t('on_table', { n: g.trick.length }) : t('you_lead');
      L.innerHTML = `<div class="overlay handoff" data-act="reveal" role="dialog" aria-label="${esc(t('pass_to'))}">
        <div class="ho-back">${backHTML()}</div>
        <p class="ho-kicker">${t('pass_to')}</p><p class="ho-name">${esc(name(p))}</p>
        ${info ? `<p class="ho-info">${info}</p>` : ''}
        <button class="btn btn-light" data-act="reveal">${t('tap_reveal')}</button></div>`;
      return;
    }
    if (!ui.sheet) { L.innerHTML = ''; return; }
    const sh = ui.sheet;
    const head = (title) => `<div class="sheet-head"><h2>${title}</h2><button class="close-btn" data-act="close" aria-label="${t('close')}">${ICON.close}</button></div>`;
    let body = '';
    if (sh.type === 'rules') body = head(t('rules')) + t('rules_html');
    else if (sh.type === 'decks') {
      body = head(t('choose_deck')) + `<div class="deck-grid">${D.list.map((d) => `<button class="deck-tile" data-act="pick-deck" data-v="${d.id}" aria-pressed="${d.id === deckId()}">${fanHTML(d)}<strong>${d.name}</strong><span>${d.region} · ${d.area}</span><span class="sys">${t('sys_' + d.system)}</span></button>`).join('')}</div>`;
    } else if (sh.type === 'menu') {
      const hostItems = isGuest()
        ? `<button class="btn btn-ghost" data-act="ask-leave">${t('leave')}</button>`
        : `${hasDevices() || net.room ? `<button class="btn btn-ghost" data-act="phones">${t('phones_menu')}</button>` : ''}
           <button class="btn btn-ghost" data-act="ask-redeal">${t('redeal')}</button>
           <button class="btn btn-ghost" data-act="ask-quit">${t('quit')}</button>`;
      body = head(t('menu')) + `<div class="btn-col">
        <button class="btn btn-primary" data-act="close">${t('back_game')}</button>
        <button class="btn btn-ghost" data-act="last" ${G().lastTrick ? '' : 'disabled'}>${t('last_trick')}</button>
        <button class="btn btn-ghost" data-act="decks">${t('deck')}: ${deck().name}</button>
        <button class="btn btn-ghost" data-act="rules">${t('rules')}</button>
        <button class="btn btn-ghost" data-act="toggle-sound">${t('opt_sound')}: ${S.settings.sound ? t('on') : t('off')}</button>
        ${hostItems}</div>`;
    } else if (sh.type === 'phones') {
      body = head(t('phones_menu')) + `<div class="devs">${deviceRows()}</div>${roomBlock()}
        <div class="btn-col"><button class="btn btn-ink" data-act="pair-qr">${t('add_qr')}<small>${t('add_qr_d')}</small></button>
        ${net.room ? '' : `<button class="btn btn-ghost" data-act="room-open">${t('open_room')}<small>${t('open_room_d')}</small></button>`}</div>`;
    } else if (sh.type === 'last') {
      const lt = G().lastTrick;
      body = head(t('last_trick')) + (lt
        ? `<div class="last-trick-cards">${lt.plays.map((pl) => `<figure class="${pl.p === lt.winner ? 'win' : ''}">${faceHTML(pl.c)}<figcaption>${esc(name(pl.p))}</figcaption></figure>`).join('')}</div><p style="text-align:center">${esc(t('takes', { name: name(lt.winner), pts: ptsLabel(lt.points) }))}</p>`
        : `<p>${t('no_trick')}</p>`);
    } else if (sh.type === 'confirm') {
      body = `<p class="confirm-text">${t(sh.text)}</p><div class="btn-row"><button class="btn btn-ghost" data-act="close">${t('cancel')}</button><button class="btn btn-primary" data-act="${sh.act}">${t(sh.yes)}</button></div>`;
    } else if (sh.type === 'summary') body = summaryHTML();
    else if (sh.type === 'notice') body = head('Briscola') + `<p>${esc(sh.text)}</p>`;
    L.innerHTML = `<div class="overlay" data-act="${sh.type === 'summary' || sh.type === 'confirm' ? '' : 'backdrop'}"><div class="sheet" role="dialog" aria-modal="true">${body}</div></div>`;
  }

  function summaryHTML() {
    const g = G(), r = E.result(g), m = M(), c = cfg();
    const teams = c.n === 4;
    let title;
    if (r.draw) title = t('draw');
    else title = t(teams ? 'win_pl' : 'wins', { name: esc(sideName(r.winners[0])) });
    const sides = [];
    for (let i = 0; i < sideCount(); i++) {
      const members = teams ? [i, i + 2] : [i];
      const cards = members.flatMap((p) => g.captured[p]);
      const pc = cards.filter((x) => E.points(x) > 0).sort((a, b) => E.strength(b) - E.strength(a) || a - b);
      sides.push({ i, pts: r.perSide[i], cards, pc });
    }
    sides.sort((a, b) => b.pts - a.pts);
    const rows = sides.map((s) => `<div class="side${!r.draw && r.winners.includes(s.i) ? ' won' : ''}">
      <div class="side-top"><strong>${esc(sideName(s.i))}</strong><span class="big">${s.pts}<small> / 120</small></span></div>
      <div class="bar"><i style="width:${(s.pts / 120) * 100}%"></i></div>
      <div class="pointcards">${s.pc.map(faceHTML).join('')}</div>
      <p class="hint">${t('cards_n', { n: s.cards.length })}</p></div>`).join('');
    let matchLine = '';
    if (c.target > 1 || m.hand > 1) {
      const tally = Array.from({ length: sideCount() }, (_, i) => `${esc(sideName(i))} ${m.wins[i]}`).join(' · ');
      matchLine = `<p class="match-line">${t('match')} (${t('first_to', { n: c.target })}): ${tally}</p>`;
    }
    let matchBanner = '';
    if (m.over) {
      const best = Math.max(...m.wins);
      const w = m.wins.indexOf(best);
      matchBanner = `<p class="match-line" style="color:var(--wine);font-weight:700;font-size:16px">${t(teams ? 'match_won_pl' : 'match_won', { name: esc(sideName(w)) })}</p>`;
    }
    let buttons;
    if (isGuest()) buttons = `<button class="btn btn-ghost" data-act="ask-leave">${t('leave')}</button><button class="btn btn-primary" data-act="guest-next">${t(m.over ? 'new_match' : 'next_hand')}</button>`;
    else if (m.over) buttons = `<button class="btn btn-ghost" data-act="quit">${t('setup')}</button><button class="btn btn-primary" data-act="new-match">${t('new_match')}</button>`;
    else buttons = `<button class="btn btn-ghost" data-act="quit">${t('setup')}</button><button class="btn btn-primary" data-act="next-hand">${t('next_hand')}</button>`;
    return `<div class="result-banner"><span class="kicker">${t('hand_over', { n: m.hand })}</span><h2>${title}</h2></div>
      <div class="sides">${rows}</div>${matchLine}${matchBanner}<div class="btn-row">${buttons}</div>`;
  }

  // ================= FLOW (this phone runs the game) =================
  function showScreen(which) {
    $('#setup').hidden = which !== 'setup';
    $('#game').hidden = which !== 'game';
    if (which === 'setup') renderSetup();
    else keepAwake();
  }

  function startMatch() {
    const st = S.settings, n = st.n;
    const seats = st.seats.slice(0, n).map((s) => ({
      name: (s.name.trim() || (s.remote ? devName(s.remote) : '')).slice(0, 16),
      cpu: !!s.cpu && !s.remote, level: s.level || 'normal', remote: s.remote || null,
    }));
    if (!seats.some((s) => !s.cpu)) { ui.error = t('need_human'); renderSetup(); return; }
    if (seats.some((s) => s.remote) && !seats.some((s) => !s.cpu && !s.remote)) { ui.error = t('need_local'); renderSetup(); return; }
    if (seats.some((s) => s.remote && !devOnline(s.remote))) { ui.error = t('need_device'); renderSetup(); return; }
    ui.error = '';
    S.session = {
      cfg: { n, seats, swap: st.swap, target: st.target },
      M: { wins: Array(n === 4 ? 2 : n).fill(0), hand: 1, dealer: Math.floor(Math.random() * n), over: false },
      G: null,
    };
    dealHand();
  }

  function dealHand() {
    const c = cfg(), m = M();
    S.session.G = E.deal({ n: c.n, dealer: m.dealer, swapRank: c.swap });
    m.counted = false;
    ui.viewer = -1; ui.selected = null; ui.sheet = null; ui.toast = null; ui.collecting = false;
    persist();
    showScreen('game');
    run();
  }

  function needsHandoff() { return opt('hideHands') && localSeats().length > 1; }

  function handoff(p) {
    return new Promise((resolve) => {
      ui.viewer = -1;
      ui.selected = null;
      ui.handoff = { p, ready: Date.now() + 450, resolve };
      render();
    });
  }

  const waitHuman = () => new Promise((resolve) => { ui.humanResolve = resolve; });
  const waitRemote = (p) => new Promise((resolve) => { ui.remoteWait = { p, resolve }; });

  function playCard(p, c) {
    E.play(G(), p, c);
    ui.justPlayed = c;
    ui.selected = null;
    sfx.play();
    persist();
    render();
  }

  async function run() {
    const gen = ++ui.gen;
    const alive = () => gen === ui.gen && S.session && S.session.G && !isGuest();
    render();
    while (alive() && G().phase !== 'over') {
      const g = G();
      if (g.phase === 'trickDone') { await finishTrick(alive); continue; }
      const p = g.turn, seat = seatOf(p);
      if (needsHandoff()) {
        const nh = nextLocalFrom(p);
        if (nh !== ui.viewer) { await handoff(nh); if (!alive()) return; }
      } else if (isLocal(p)) ui.viewer = p;
      else if (ui.viewer < 0) ui.viewer = nextLocalFrom(p);

      if (seat.cpu) {
        render();
        await sleep(650 * spd() + Math.random() * 250 * spd());
        if (!alive()) return;
        if (AI.wantsSwap(g, p)) {
          const took = g.briscola;
          E.doSwap(g, p);
          ui.toast = { k: 'swap', p, give: g.swapped.gave, took };
          render();
          await sleep(1400 * spd());
          if (!alive()) return;
          ui.toast = null;
        }
        playCard(p, AI.choose(g, p, seat.level));
      } else if (seat.remote) {
        render();
        const c = await waitRemote(p);
        if (!alive()) return;
        playCard(p, c);
      } else {
        render();
        if (localSeats().length > 1 || g.tricks === 0) sfx.turn();
        const c = await waitHuman();
        if (!alive()) return;
        playCard(p, c);
      }
    }
    if (alive()) endHand();
  }

  async function finishTrick(alive) {
    const g = G();
    const w = g.pendingWinner;
    const pts = g.trick.reduce((a, x) => a + E.points(x.c), 0);
    await sleep(250 * spd());
    if (!alive()) return;
    ui.toast = { k: 'takes', p: w, pts };
    render();
    sfx.win();
    await sleep(1050 * spd());
    if (!alive()) return;
    ui.collecting = true;
    render();
    await sleep(400 * spd());
    if (!alive()) return;
    const drawn = E.resolveTrick(g);
    ui.collecting = false;
    ui.toast = null;
    const v = ui.viewer;
    ui.justDrawn = v >= 0 && drawn[v] != null ? [drawn[v]] : [];
    ui.drawnAll = drawn;
    persist();
    render();
    await sleep(300 * spd());
  }

  function endHand() {
    const g = G(), m = M();
    if (!m.counted) {
      const r = E.result(g);
      if (!r.draw) r.winners.forEach((i) => { m.wins[i]++; });
      m.counted = true;
      m.over = m.wins.some((x) => x >= cfg().target);
      persist();
    }
    ui.handoff = null;
    ui.viewer = nextLocalFrom(0);
    ui.sheet = { type: 'summary' };
    render();
  }

  function stopFlow() {
    ui.gen++;
    ui.humanResolve = null;
    ui.remoteWait = null;
    ui.handoff = null;
  }

  function resume() {
    if (!S.session || !S.session.G) return;
    ui.viewer = -1; ui.selected = null; ui.sheet = null; ui.toast = null; ui.collecting = false;
    showScreen('game');
    if (G().phase === 'over') { render(); endHand(); } else run();
  }

  function nextHand() {
    const m = M(); stopFlow();
    m.hand++; m.dealer = (m.dealer + 1) % cfg().n;
    dealHand();
  }
  function newMatch() {
    stopFlow();
    const c = cfg();
    S.session.M = { wins: Array(c.n === 4 ? 2 : c.n).fill(0), hand: 1, dealer: (M().dealer + 1) % c.n, over: false };
    dealHand();
  }
  function quitToSetup() {
    stopFlow(); S.session = null; ui.sheet = null; persist(); render(); showScreen('setup');
  }

  // ================= HOST: phones =================
  function sendTo(d, msg) { if (d && d.link && d.online) d.link.send(msg); }

  function lobbyFor(dev) {
    const st = S.settings;
    return {
      t: 'lobby', host: hostName(), started: !!(S.session && S.session.G), n: st.n,
      seats: st.seats.slice(0, st.n).map((s, p) => ({
        name: nameFrom(st.seats, p) === t('seat', { n: p + 1 }) && s.remote ? devName(s.remote) : nameFrom(st.seats, p),
        cpu: !!s.cpu && !s.remote, mine: s.remote === dev,
      })),
    };
  }

  function broadcastLobby() {
    if (isGuest()) return;
    for (const d of deviceList()) {
      if (S.session && S.session.G) continue; // a game is on: devices get views instead
      sendTo(d, lobbyFor(d.dev));
    }
  }

  function viewFor(dev) {
    const g = G(), c = cfg(), m = M();
    const mine = [];
    for (let p = 0; p < c.n; p++) if (c.seats[p].remote === dev) mine.push(p);
    const over = g.phase === 'over';
    const partnerOpen = g.teams && S.settings.partnerView && E.cardsLeftToDraw(g) === 0;
    const visible = (p) => over || mine.includes(p) || (partnerOpen && mine.includes((p + 2) % 4));
    const v = Object.assign({}, g);
    v.hands = g.hands.map((h, p) => (visible(p) ? h.slice() : h.map(() => -1)));
    v.deck = g.deck.map(() => -1);
    v.seed = 0;
    if (!over) v.captured = g.captured.map((cs) => cs.map(() => -1));
    v.pts = S.settings.showScore || over ? E.scores(g).perPlayer : null;
    const seats = c.seats.map((s) => ({
      name: s.name, cpu: s.cpu, level: s.level,
      remote: s.remote === dev ? 'me' : s.remote ? 'x' : null,
      off: s.remote && s.remote !== dev ? !devOnline(s.remote) : false,
    }));
    return {
      t: 'view', host: hostName(), G: v, cfg: { n: c.n, seats, swap: c.swap, target: c.target }, M: m,
      opts: { hideHands: S.settings.hideHands, showScore: S.settings.showScore, partnerView: S.settings.partnerView },
      fx: { played: ui.justPlayed, collecting: ui.collecting, toast: ui.toast, drawn: ui.drawnAll },
    };
  }

  function broadcastView() {
    if (isGuest() || !S.session || !S.session.G) return;
    for (const d of deviceList()) {
      if (!d.online) continue;
      const msg = viewFor(d.dev);
      const key = JSON.stringify(msg);
      if (net.lastSent[d.dev] === key) continue;
      net.lastSent[d.dev] = key;
      d.link.send(msg);
    }
  }

  function sendState(d) {
    net.lastSent[d.dev] = null;
    if (S.session && S.session.G) sendTo(d, viewFor(d.dev));
    else sendTo(d, lobbyFor(d.dev));
  }

  /** Wait for a guest's hello on a freshly opened link, then register the phone. */
  function adoptLink(link, via) {
    let adopted = false;
    link.on('message', (m) => {
      if (!adopted) {
        if (m.t !== 'hello') return;
        if (m.v !== N.PROTOCOL) { link.send({ t: 'error', code: 'ver' }); setTimeout(() => link.close('version'), 300); return; }
        adopted = true;
        registerDevice(link, via, String(m.dev || '').slice(0, 24), String(m.name || '').slice(0, 16));
        return;
      }
    });
  }

  function registerDevice(link, via, dev, nm) {
    const prev = net.devices[dev];
    if (prev && prev.link && prev.link !== link) { prev.link.on('close', null); prev.link.close('replaced'); }
    const d = { dev, name: nm || (prev && prev.name) || '', link, online: true, via };
    net.devices[dev] = d;
    if (d.name) S.settings.knownDevs[dev] = d.name;
    link.on('message', (m) => onHostMessage(d, m));
    link.on('close', () => {
      if (d.link !== link) return;
      d.online = false; d.link = null;
      onDevicesChanged();
    });
    link.send({ t: 'welcome', host: hostName() });
    // A new phone takes the first free human seat with no name, which is what people expect for 2-player games.
    if (!prev && !(S.session && S.session.G)) {
      const st = S.settings;
      if (!st.seats.slice(0, st.n).some((s) => s.remote === dev)) {
        for (let p = 1; p < st.n; p++) {
          const s = st.seats[p];
          if (!s.cpu && !s.remote && !s.name.trim()) { s.remote = dev; break; }
        }
      }
    }
    persist();
    if (net.pair && net.pair.kind === 'host-qr' && net.pair.link === link) closePair();
    onDevicesChanged();
    sendState(d);
    keepAwake();
  }

  function onDevicesChanged() {
    if (!$('#setup').hidden) renderSetup();
    else render();
  }

  function onHostMessage(d, m) {
    const g = S.session && S.session.G;
    switch (m.t) {
      case 'name':
        d.name = String(m.name || '').slice(0, 16);
        if (d.name) S.settings.knownDevs[d.dev] = d.name;
        persist();
        onDevicesChanged();
        break;
      case 'play': {
        const p = m.seat;
        if (!g || !ui.remoteWait || ui.remoteWait.p !== p || cfg().seats[p].remote !== d.dev) return;
        if (g.phase !== 'play' || g.turn !== p || !g.hands[p].includes(m.card)) return;
        const r = ui.remoteWait.resolve;
        ui.remoteWait = null;
        r(m.card);
        break;
      }
      case 'swap': {
        const p = m.seat;
        if (!g || !ui.remoteWait || ui.remoteWait.p !== p || cfg().seats[p].remote !== d.dev || !E.canSwap(g, p)) return;
        const took = g.briscola;
        E.doSwap(g, p);
        ui.drawnAll = g.hands.map((_, q) => (q === p ? took : null));
        persist();
        render();
        break;
      }
      case 'next':
        if (g && g.phase === 'over' && ui.sheet && ui.sheet.type === 'summary') { if (M().over) newMatch(); else nextHand(); }
        break;
      case 'leave':
        d.link.close('left');
        break;
      default:
    }
  }

  function removeDevice(dev) {
    const d = net.devices[dev];
    if (d && d.link) { d.link.on('close', null); d.link.send({ t: 'bye' }); setTimeout(() => d.link && d.link.close('removed'), 200); }
    delete net.devices[dev];
    S.settings.seats.forEach((s) => { if (s.remote === dev) s.remote = null; });
    persist();
    onDevicesChanged();
  }

  // ---------- host: room code ----------
  async function openRoom(code, attempt) {
    attempt = attempt || 0;
    const fresh = !code;
    code = code || N.roomCode();
    net.room = { code, status: 'opening', broker: null };
    onDevicesChanged();
    const broker = new N.Broker(N.roomPeerId(code), N.brokerUrl());
    try {
      await broker.connect(8000);
    } catch (e) {
      if (!net.room || net.room.code !== code) return;
      if (e.message === 'id-taken') {
        if (fresh && attempt < 3) return openRoom(null, attempt + 1);
        if (attempt < 20) { setTimeout(() => { if (net.room && net.room.code === code) openRoom(code, attempt + 1); }, 3000); return; }
      }
      net.room = { code, status: 'error', err: t('broker_fail') };
      onDevicesChanged();
      return;
    }
    if (!net.room || net.room.code !== code) { broker.close(); return; }
    net.room = { code, status: 'open', broker };
    S.settings.room = code;
    persist();
    const pending = {};
    broker.on('message', async (m) => {
      if (m.type === 'OFFER' && m.payload && m.payload.sdp) {
        if (m.payload.v !== N.PROTOCOL) return;
        const link = new N.Link({ trickle: true, ice: N.STUN });
        pending[m.src] = link;
        link.on('candidate', (c) => broker.send('CANDIDATE', m.src, { c }));
        adoptLink(link, 'room');
        try {
          const sdp = await link.createAnswer(m.payload.sdp);
          broker.send('ANSWER', m.src, { sdp });
          await link.whenOpen(30000);
        } catch (e) { link.close('failed'); }
        delete pending[m.src];
      } else if (m.type === 'CANDIDATE' && pending[m.src] && m.payload) {
        pending[m.src].addCandidate(m.payload.c);
      }
    });
    broker.on('drop', () => {
      if (net.room && net.room.code === code) setTimeout(() => { if (net.room && net.room.code === code) openRoom(code, 1); }, 2000);
    });
    onDevicesChanged();
  }

  function closeRoom() {
    if (net.room && net.room.broker) net.room.broker.close();
    net.room = null;
    S.settings.room = null;
    persist();
    onDevicesChanged();
  }

  // ================= PAIRING SCREENS =================
  function pairLayer() { return $('#pair-layer'); }

  function closePair() {
    const P = net.pair;
    if (!P) return;
    if (P.scanner) P.scanner.stop();
    if (P.link && !P.adopted && !P.link.open) P.link.close('cancelled');
    net.pair = null;
    pairLayer().innerHTML = '';
  }

  function pairSet(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
  function pairShow(id, show) { const el = document.getElementById(id); if (el) el.hidden = !show; }

  async function hostPairQR() {
    closePair();
    if (ui.sheet && ui.sheet.type === 'phones') { ui.sheet = null; render(); }
    const P = net.pair = { kind: 'host-qr', link: null, scanner: null, busy: false };
    pairLayer().innerHTML = `<div class="overlay"><div class="sheet pair" role="dialog" aria-modal="true">
      <div class="sheet-head"><h2>${t('pair_title')}</h2><button class="close-btn" data-act="pair-close" aria-label="${t('close')}">${ICON.close}</button></div>
      <p class="step"><b>1</b><span>${t('pair_s1')}</span></p>
      <div class="qr-box" id="pq-qr"><span class="hint">${t('connecting')}</span></div>
      <p class="step"><b>2</b><span>${t('pair_s2')}</span></p>
      <div class="cam"><video id="pq-video" playsinline muted></video></div>
      <p class="pair-status" id="pq-status" role="status">${t('cam_start')}</p>
      <details><summary>${t('trouble')}</summary>
        <div class="codebox"><textarea id="pq-mycode" readonly rows="3"></textarea><button class="btn btn-ghost" data-act="copy" data-v="pq-mycode">${t('copy')}</button></div>
        <label class="field"><span>${t('paste_reply')}</span><textarea id="pq-paste" rows="3"></textarea></label>
        <button class="btn btn-primary" data-act="pair-paste">${t('connect')}</button>
      </details></div></div>`;
    // Camera first: with camera access granted, browsers share the phone's real LAN address, which
    // makes the offline connection more reliable than the anonymised addresses used otherwise.
    try {
      P.scanner = await N.startScanner($('#pq-video'), (text) => hostGotReply(P, text));
      if (net.pair !== P) { P.scanner.stop(); return; }
      pairSet('pq-status', t('cam_on'));
    } catch (e) {
      if (net.pair !== P) return;
      pairSet('pq-status', t('cam_denied'));
    }
    try {
      const link = P.link = new N.Link({ trickle: false });
      adoptLink(link, 'qr');
      const sdp = await link.createOffer();
      const code = await N.pack({ k: 'o', v: N.PROTOCOL, s: sdp, h: hostName() });
      if (net.pair !== P) { link.close('cancelled'); return; }
      P.code = code;
      pairSet('pq-qr', N.qrSvg(code));
      const ta = $('#pq-mycode'); if (ta) ta.value = code;
    } catch (e) {
      pairSet('pq-status', t('pair_fail'));
    }
  }

  async function hostGotReply(P, text) {
    if (net.pair !== P || P.busy || !P.link) return;
    // The camera reports the same code several times a second: claim the attempt before any await.
    P.busy = true;
    let obj;
    try { obj = await N.unpack(text); } catch (e) { P.busy = false; pairSet('pq-status', t('bad_code')); return; }
    if (obj.k !== 'a') { P.busy = false; return; } // probably our own code reflected back; keep scanning
    if (obj.v !== N.PROTOCOL) { P.busy = false; pairSet('pq-status', t('ver_mismatch')); return; }
    pairSet('pq-status', t('connecting'));
    try {
      await P.link.acceptAnswer(obj.s);
      await P.link.whenOpen(20000);
      P.adopted = true;
      // registerDevice closes the pairing screen once the guest says hello.
    } catch (e) {
      if (net.pair !== P) return;
      P.busy = false;
      pairSet('pq-status', `${t('pair_fail')} <button class="btn btn-ghost" data-act="pair-qr">${t('add_qr')}</button>`);
    }
  }

  function openJoin(prefillRoom) {
    closePair();
    const P = net.pair = { kind: 'join', link: null, scanner: null, busy: false };
    const offline = !N;
    pairLayer().innerHTML = `<div class="overlay"><div class="sheet pair" role="dialog" aria-modal="true">
      <div class="sheet-head"><h2>${t('join_title')}</h2><button class="close-btn" data-act="pair-close" aria-label="${t('close')}">${ICON.close}</button></div>
      ${offline ? `<p class="error">${t('no_webrtc')}</p>` : ''}
      <label class="field"><span>${t('your_name')}</span><input id="pj-name" data-myname maxlength="16" autocomplete="off" value="${esc(S.settings.myName)}"></label>
      <button class="btn btn-ink" data-act="join-scan" id="pj-scan-btn">${t('scan_host')}<small>${t('scan_host_d')}</small></button>
      <div class="cam" id="pj-cam" hidden><video id="pj-video" playsinline muted></video></div>
      <div class="qr-box" id="pj-reply" hidden></div>
      <p class="pair-status" id="pj-status" role="status"></p>
      <details><summary>${t('trouble')}</summary>
        <label class="field"><span>${t('paste_host')}</span><textarea id="pj-paste" rows="3"></textarea></label>
        <button class="btn btn-primary" data-act="join-paste">${t('use_code')}</button>
        <div id="pj-mycode-wrap" hidden><label class="field"><span>${t('your_reply')}</span></label><div class="codebox"><textarea id="pj-mycode" readonly rows="3"></textarea><button class="btn btn-ghost" data-act="copy" data-v="pj-mycode">${t('copy')}</button></div></div>
      </details>
      <h3>${t('or_room')}</h3>
      <div class="room-join"><input id="pj-room" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCDE" value="${esc(prefillRoom || '')}"><button class="btn btn-primary" data-act="join-room">${t('join')}</button></div>
      <p class="pair-status" id="pj-room-status" role="status"></p>
    </div></div>`;
  }

  async function joinScan() {
    const P = net.pair;
    if (!P || P.kind !== 'join' || P.scanner) return;
    pairShow('pj-cam', true);
    pairShow('pj-scan-btn', false);
    pairSet('pj-status', t('cam_start'));
    try {
      P.scanner = await N.startScanner($('#pj-video'), (text) => guestGotOffer(P, text));
      if (net.pair !== P) { P.scanner.stop(); return; }
      pairSet('pj-status', t('cam_on'));
    } catch (e) {
      pairSet('pj-status', t('cam_denied'));
      pairShow('pj-cam', false);
    }
  }

  async function guestGotOffer(P, text) {
    if (net.pair !== P || P.busy) return;
    P.busy = true;
    let obj;
    try { obj = await N.unpack(text); } catch (e) { P.busy = false; pairSet('pj-status', t('bad_code')); return; }
    if (obj.k !== 'o') { P.busy = false; pairSet('pj-status', t('bad_code')); return; }
    if (obj.v !== N.PROTOCOL) { P.busy = false; pairSet('pj-status', t('ver_mismatch')); return; }
    pairSet('pj-status', t('connecting'));
    try {
      const link = P.link = new N.Link({ trickle: false });
      // The answer is created while the camera is still on, for the same LAN-address reason as on the host.
      const sdp = await link.createAnswer(obj.s);
      if (P.scanner) { P.scanner.stop(); P.scanner = null; }
      pairShow('pj-cam', false);
      const code = await N.pack({ k: 'a', v: N.PROTOCOL, s: sdp, d: DEV, n: S.settings.myName });
      pairSet('pj-reply', N.qrSvg(code));
      pairShow('pj-reply', true);
      const ta = $('#pj-mycode'); if (ta) ta.value = code;
      pairShow('pj-mycode-wrap', true);
      pairSet('pj-status', t('join_s2'));
      await link.whenOpen(180000);
      if (net.pair !== P) return;
      P.adopted = true;
      closePair();
      becomeGuest(link, 'qr', obj.h, null);
    } catch (e) {
      if (net.pair !== P) return;
      P.busy = false;
      pairSet('pj-status', t('pair_fail'));
    }
  }

  /** Room-code join. With `silent`, used for automatic reconnection (no pairing screen). */
  async function joinRoom(code, silent) {
    code = N.normaliseRoom(code);
    const status = (k) => { if (!silent) pairSet('pj-room-status', t(k)); };
    if (code.length !== 5) { status('room_fail'); return false; }
    status('connecting');
    const hostId = N.roomPeerId(code);
    const broker = new N.Broker(`bg-${DEV}-${Math.random().toString(36).slice(2, 6)}`, N.brokerUrl());
    try { await broker.connect(8000); } catch (e) { status('broker_fail'); return false; }
    const link = new N.Link({ trickle: true, ice: N.STUN });
    let answered = false, expired = false;
    link.on('candidate', (c) => broker.send('CANDIDATE', hostId, { c }));
    broker.on('message', (m) => {
      if (m.src !== hostId && m.type !== 'EXPIRE') return;
      if (m.type === 'ANSWER' && m.payload) { answered = true; link.acceptAnswer(m.payload.sdp).catch(() => link.close('bad-answer')); }
      else if (m.type === 'CANDIDATE' && m.payload) link.addCandidate(m.payload.c);
      else if (m.type === 'EXPIRE' || m.type === 'ERROR') { expired = true; link.close('expired'); }
    });
    try {
      const sdp = await link.createOffer();
      broker.send('OFFER', hostId, { sdp, v: N.PROTOCOL, dev: DEV });
      await link.whenOpen(answered ? 20000 : 25000);
    } catch (e) {
      broker.close();
      link.close('failed');
      status(answered ? 'p2p_fail' : expired || !answered ? 'room_fail' : 'pair_fail');
      return false;
    }
    broker.close();
    if (!silent) closePair();
    S.settings.lastRoom = code;
    persist();
    becomeGuest(link, 'room', null, code);
    return true;
  }

  // ================= GUEST =================
  function becomeGuest(link, mode, hostNm, code) {
    if (!isGuest()) {
      S.savedSession = S.session;
      stopFlow();
    }
    net.role = 'guest';
    const prevLobby = net.guest && net.guest.lobby;
    net.guest = { link, mode, code, hostName: hostNm || (net.guest && net.guest.hostName) || '', status: 'online', lobby: prevLobby || null };
    link.on('message', onGuestMessage);
    link.on('close', () => { if (net.guest && net.guest.link === link) onGuestLost(); });
    // Say hello until the host answers: the first message on a fresh channel is occasionally lost.
    const gst = net.guest;
    const hello = () => {
      if (net.guest !== gst || gst.link !== link || gst.welcomed || link.closed) return;
      link.send({ t: 'hello', v: N.PROTOCOL, dev: DEV, name: S.settings.myName });
      setTimeout(hello, 1000);
    };
    hello();
    if (!S.session) { ui.sheet = null; showScreen('setup'); } else render();
    keepAwake();
  }

  function onGuestLost() {
    const gst = net.guest;
    if (!gst) return;
    gst.status = 'lost';
    gst.link = null;
    ui.sent = false;
    if (!$('#setup').hidden) renderSetup(); else render();
    if (gst.mode === 'room') retryRoom(gst);
  }

  async function retryRoom(gst) {
    while (net.guest === gst && gst.status === 'lost') {
      const ok = await joinRoom(gst.code, true);
      if (ok) return;
      await sleep(4000);
    }
  }

  function leaveGuest(notice) {
    const gst = net.guest;
    S.settings.lastRoom = null;
    if (gst && gst.link) { gst.link.send({ t: 'leave' }); const l = gst.link; setTimeout(() => l.close('left'), 150); }
    net.role = null;
    net.guest = null;
    S.session = S.savedSession;
    S.savedSession = null;
    ui.viewer = -1; ui.handoff = null; ui.sheet = notice ? { type: 'notice', text: notice } : null; ui.sent = false;
    persist();
    showScreen('setup');
    render();
  }

  function onGuestMessage(m) {
    const gst = net.guest;
    if (!gst) return;
    switch (m.t) {
      case 'welcome': gst.hostName = m.host; gst.status = 'online'; gst.welcomed = true; break;
      case 'lobby':
        gst.lobby = m;
        gst.hostName = m.host;
        if (!m.started) {
          S.session = null;
          ui.handoff = null;
          if (ui.sheet && ui.sheet.type === 'summary') ui.sheet = null;
          showScreen('setup');
          render();
        }
        break;
      case 'view': applyView(m); break;
      case 'bye': leaveGuest(); break;
      case 'error': if (m.code === 'ver') leaveGuest(t('ver_mismatch')); break;
      default:
    }
  }

  function applyView(m) {
    const firstView = !S.session || !S.session.G || $('#game').hidden;
    const prev = S.session && S.session.G;
    net.guest.hostName = m.host;
    S.session = { cfg: m.cfg, G: m.G, M: m.M, opts: m.opts };
    const g = m.G, fx = m.fx || {};
    const locals = localSeats();
    ui.sent = false;
    ui.collecting = !!fx.collecting;
    ui.toast = fx.toast || null;
    ui.justPlayed = fx.played != null ? fx.played : null;
    if (ui.selected != null && !(ui.viewer >= 0 && g.hands[ui.viewer] && g.hands[ui.viewer].includes(ui.selected))) ui.selected = null;

    if (ui.viewer >= 0 && !isLocal(ui.viewer)) ui.viewer = -1;
    if (ui.viewer < 0 && !ui.handoff && locals.length) ui.viewer = locals[0];
    const myTurnSeat = g.phase === 'play' && isLocal(g.turn) ? g.turn : -1;
    if (myTurnSeat >= 0 && myTurnSeat !== ui.viewer && !(ui.handoff && ui.handoff.p === myTurnSeat)) {
      if (opt('hideHands') && locals.length > 1) { ui.viewer = -1; ui.selected = null; ui.handoff = { p: myTurnSeat, ready: Date.now() + 450, resolve: null }; }
      else ui.viewer = myTurnSeat;
    }
    ui.justDrawn = fx.drawn && ui.viewer >= 0 && fx.drawn[ui.viewer] != null ? [fx.drawn[ui.viewer]] : [];

    if (fx.played != null) sfx.play();
    if (fx.toast && fx.toast.k === 'takes' && !(prev && prev.phase === 'trickDone' && ui.lastToastTricks === g.tricks)) { sfx.win(); ui.lastToastTricks = g.tricks; }
    if (myTurnSeat >= 0 && !(prev && prev.turn === g.turn && prev.phase === 'play')) sfx.turn();

    if (g.phase === 'over') { if (!ui.sheet || ui.sheet.type !== 'summary') ui.sheet = { type: 'summary' }; ui.handoff = null; }
    else if (ui.sheet && ui.sheet.type === 'summary') ui.sheet = null;
    if (firstView) { ui.sheet = g.phase === 'over' ? { type: 'summary' } : null; showScreen('game'); }
    render();
  }

  function guestSend(msg) {
    const gst = net.guest;
    return !!(gst && gst.link && gst.link.send(msg));
  }

  // ================= EVENTS =================
  function onHandCard(c) {
    const g = G(), v = ui.viewer;
    if (ui.handoff || ui.sheet || g.phase !== 'play' || g.turn !== v || !isLocal(v)) return;
    if (isGuest()) {
      if (ui.sent) return;
      if (S.settings.twoTap && ui.selected !== c) { ui.selected = c; render(); return; }
      if (guestSend({ t: 'play', seat: v, card: c })) { ui.sent = true; ui.selected = null; render(); }
      return;
    }
    if (!ui.humanResolve) return;
    if (S.settings.twoTap && ui.selected !== c) { ui.selected = c; render(); return; }
    const r = ui.humanResolve;
    ui.humanResolve = null;
    r(c);
  }

  function setSeatKind(p, kind) {
    const s = S.settings.seats[p];
    if (kind === 'c') { s.cpu = true; s.remote = null; }
    else if (kind === 'h') { s.cpu = false; s.remote = null; }
    else if (kind === 'r') {
      s.cpu = false;
      const used = new Set(S.settings.seats.slice(0, S.settings.n).map((x) => x.remote).filter(Boolean));
      const free = deviceList().find((d) => !used.has(d.dev)) || deviceList()[0];
      s.remote = s.remote || (free ? free.dev : null);
    }
  }

  async function copyFrom(id) {
    const ta = document.getElementById(id);
    if (!ta || !ta.value) return;
    try { await navigator.clipboard.writeText(ta.value); } catch (e) { ta.select(); try { document.execCommand('copy'); } catch (err) { /* ignore */ } }
  }

  document.addEventListener('click', (ev) => {
    const cardBtn = ev.target.closest('[data-card]');
    if (cardBtn) { onHandCard(+cardBtn.dataset.card); return; }
    const el = ev.target.closest('[data-act]');
    if (!el) {
      // Tapping the table clears a lifted card.
      if (ui.selected != null && ev.target.closest('#game')) { ui.selected = null; render(); }
      return;
    }
    const act = el.dataset.act, v = el.dataset.v, st = S.settings;
    if (act === 'backdrop' && ev.target !== el) return; // clicks inside the sheet
    if (act === '') return;
    if (act.startsWith('seat-kind-')) {
      setSeatKind(+act.slice(10), v);
      ui.error = '';
      persist(); renderSetup(); return;
    }
    switch (act) {
      case 'n': st.n = +v; ui.error = ''; break;
      case 'swap': st.swap = +v; break;
      case 'target': st.target = +v; break;
      case 'speed': st.speed = v; break;
      case 'lang': st.lang = v; break;
      case 'deal': persist(); startMatch(); return;
      case 'resume': resume(); return;
      case 'decks': ui.sheet = { type: 'decks' }; render(); return;
      case 'pick-deck':
        st.deck = v; persist();
        ui.sheet = null;
        if (!$('#setup').hidden) renderSetup();
        render(); return;
      case 'rules': ui.sheet = { type: 'rules' }; render(); return;
      case 'menu': ui.selected = null; ui.sheet = { type: 'menu' }; render(); return;
      case 'phones': ui.sheet = { type: 'phones' }; render(); return;
      case 'last': ui.sheet = { type: 'last' }; render(); return;
      case 'close': case 'backdrop': ui.sheet = null; render(); return;
      case 'toggle-sound': st.sound = !st.sound; persist(); render(); return;
      case 'ask-quit': ui.sheet = { type: 'confirm', text: 'confirm_quit', yes: 'yes_quit', act: 'quit' }; render(); return;
      case 'ask-redeal': ui.sheet = { type: 'confirm', text: 'confirm_redeal', yes: 'yes_redeal', act: 'redeal' }; render(); return;
      case 'ask-leave': ui.sheet = { type: 'confirm', text: 'leave', yes: 'leave', act: 'guest-leave' }; render(); return;
      case 'quit': quitToSetup(); return;
      case 'redeal': stopFlow(); dealHand(); return;
      case 'next-hand': nextHand(); return;
      case 'new-match': newMatch(); return;
      case 'guest-next': guestSend({ t: 'next' }); return;
      case 'guest-leave': leaveGuest(); return;
      case 'reveal': {
        const h = ui.handoff;
        if (!h || Date.now() < h.ready) return;
        ui.viewer = h.p; ui.handoff = null;
        render();
        if (h.resolve) h.resolve();
        return;
      }
      case 'do-swap': {
        const g = G();
        if (!E.canSwap(g, ui.viewer)) return;
        if (isGuest()) { if (!ui.sent) guestSend({ t: 'swap', seat: ui.viewer }); return; }
        if (!ui.humanResolve) return;
        const took = g.briscola;
        E.doSwap(g, ui.viewer);
        ui.justDrawn = [took];
        ui.drawnAll = g.hands.map((_, q) => (q === ui.viewer ? took : null));
        persist(); render(); return;
      }
      // ----- phones -----
      case 'pair-qr': hostPairQR(); return;
      case 'pair-close': closePair(); return;
      case 'pair-paste': { const P = net.pair; const ta = $('#pq-paste'); if (P && ta && ta.value.trim()) hostGotReply(P, ta.value); return; }
      case 'copy': copyFrom(v); el.textContent = t('copied'); return;
      case 'room-open': if (ui.sheet && ui.sheet.type !== 'phones') ui.sheet = null; openRoom(); return;
      case 'room-close': closeRoom(); return;
      case 'dev-remove': removeDevice(v); return;
      case 'join-open': openJoin(''); return;
      case 'rejoin': openJoin(S.settings.lastRoom); joinRoom(S.settings.lastRoom, false); return;
      case 'join-scan': joinScan(); return;
      case 'join-paste': { const P = net.pair; const ta = $('#pj-paste'); if (P && ta && ta.value.trim()) guestGotOffer(P, ta.value); return; }
      case 'join-room': { const inp = $('#pj-room'); if (inp) joinRoom(inp.value, false); return; }
      default: return;
    }
    persist();
    renderSetup();
  });

  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.dataset.name != null) {
      S.settings.seats[+el.dataset.name].name = el.value;
      persist();
      // Update the team hint in place: re-rendering here would swallow the next tap (e.g. on Deal).
      const h = document.getElementById('seat-hint');
      if (h) h.innerHTML = seatHint();
    } else if (el.dataset.myname != null) {
      S.settings.myName = el.value.slice(0, 16);
      persist();
    } else if (el.id === 'pj-room') {
      const caret = el.value.length;
      el.value = N.normaliseRoom(el.value);
      if (caret >= 5) el.setSelectionRange(5, 5);
    }
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset.set) { S.settings[el.dataset.set] = el.checked; persist(); broadcastLobby(); }
    else if (el.dataset.level != null) { S.settings.seats[+el.dataset.level].level = el.value; persist(); }
    else if (el.dataset.dev != null) { S.settings.seats[+el.dataset.dev].remote = el.value; persist(); renderSetup(); }
    else if (el.dataset.name != null) broadcastLobby();
    else if (el.dataset.myname != null && isGuest()) guestSend({ t: 'name', name: S.settings.myName });
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (net.pair) closePair();
      else if (ui.sheet && ui.sheet.type !== 'summary') { ui.sheet = null; render(); }
    }
    if (ev.key === 'Enter' && ev.target.id === 'pj-room') joinRoom(ev.target.value, false);
  });

  // ================= BOOT =================
  function start(hotData) {
    const saved = (hotData && hotData.settings) ? hotData : store.load();
    if (saved && saved.settings) {
      S.settings = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), saved.settings);
      if (!Array.isArray(S.settings.seats) || S.settings.seats.length < 4) S.settings.seats = JSON.parse(JSON.stringify(DEFAULTS.seats));
      S.settings.seats.forEach((s) => { if (s.remote === undefined) s.remote = null; });
      if (!S.settings.knownDevs) S.settings.knownDevs = {};
      if (saved.session && saved.session.G && saved.session.G.v === 1) S.session = saved.session;
    }
    showScreen('setup');
    if (N) {
      let join = null;
      try {
        const q = new URLSearchParams(location.search);
        join = q.get('join');
        if (join) { q.delete('join'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); }
      } catch (e) { /* ignore */ }
      if (join) openJoin(N.normaliseRoom(join));
      else if (S.settings.room) openRoom(S.settings.room); // reopen so guests can reconnect after a reload
    }
  }

  // Test hook: lets automated tests drive pairing without cameras.
  window.__briscola = { net, S, ui, joinRoom, openRoom, hostPairQR, openJoin };

  if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
    try { window.claude.hot.snapshot(() => ({ settings: S.settings, session: isGuest() ? S.savedSession : S.session })); } catch (e) { /* ignore */ }
  }
  if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start);
  else start(window.claude && window.claude.hot ? window.claude.hot.data : null);
})();
