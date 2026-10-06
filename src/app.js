/* Briscola: UI, game flow and pass-and-play handling. */
(function () {
  'use strict';
  const E = window.BriscolaEngine, AI = window.BriscolaAI, D = window.BriscolaDecks, I18N = window.BriscolaI18n;
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
    seats: [0, 1, 2, 3].map(() => ({ name: '', cpu: false, level: 'normal' })),
    hideHands: true, twoTap: true, swap: 0, partnerView: true, showScore: false,
    target: 1, speed: 'normal', sound: true,
  };

  const S = { settings: JSON.parse(JSON.stringify(DEFAULTS)), session: null };
  // session: { cfg: {n, seats, swap, target}, G (engine state), M: {wins, hand, dealer, over, counted} }

  const ui = {
    viewer: -1, selected: null, handoff: null, sheet: null, toast: null, collecting: false,
    justPlayed: null, justDrawn: [], gen: 0, humanResolve: null, error: '',
  };

  function persist() { store.save({ settings: S.settings, session: S.session }); }

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

  const cfg = () => S.session.cfg;
  const G = () => S.session.G;
  const M = () => S.session.M;
  const seatOf = (p) => cfg().seats[p];
  function nameFrom(seats, p) {
    const s = seats[p];
    const nm = (s.name || '').trim();
    return nm || (s.cpu ? t('cpu_name', { n: p + 1 }) : t('seat', { n: p + 1 }));
  }
  const name = (p) => nameFrom(cfg().seats, p);
  const humans = () => cfg().seats.slice(0, cfg().n).filter((s) => !s.cpu).length;
  const sideCount = () => (cfg().n === 4 ? 2 : cfg().n);
  const sideName = (i) => (cfg().n === 4 ? t('team', { a: name(i), b: name(i + 2) }) : name(i));
  const totalTricks = (n) => (n === 2 ? 20 : n === 3 ? 13 : 10);

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
  };

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
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.session && !$('#game').hidden) keepAwake(); });

  // ---------- table geometry ----------
  function viewerForRender() {
    if (ui.viewer >= 0) return ui.viewer;
    if (ui.handoff) return ui.handoff.p;
    return nextHumanFrom(G().turn);
  }
  function nextHumanFrom(p) {
    const n = cfg().n;
    for (let i = 0; i < n; i++) { const q = (p + i) % n; if (!seatOf(q).cpu) return q; }
    return 0;
  }
  function posOf(p, v) {
    const n = cfg().n, r = (p - v + n) % n;
    if (n === 2) return r ? 'top' : 'bottom';
    if (n === 3) return ['bottom', 'right', 'left'][r];
    return ['bottom', 'right', 'top', 'left'][r];
  }

  // ================= SETUP SCREEN =================
  function renderSetup() {
    const st = S.settings, n = st.n, d = deck();
    const nm = (p) => nameFrom(st.seats, p);
    const seg = (act, opts, cur) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${esc(l)}</button>`).join('')}</div>`;
    const sw = (id, key) => `<span class="switch"><input type="checkbox" id="${id}" data-set="${key}" ${st[key] ? 'checked' : ''}><span></span></span>`;

    let seats = '';
    for (let p = 0; p < n; p++) {
      const s = st.seats[p];
      const team = n === 4 ? (p % 2 ? 'team-b' : 'team-a') : '';
      seats += `<div class="seat-row"><span class="dot ${team}">${p + 1}</span>
        <input id="seat-name-${p}" data-name="${p}" maxlength="16" autocomplete="off" placeholder="${esc(s.cpu ? t('cpu_name', { n: p + 1 }) : t('seat', { n: p + 1 }))}" value="${esc(s.name)}">
        <div class="seat-ctrl">${seg('seat-cpu-' + p, [['0', t('human')], ['1', t('cpu')]], s.cpu ? '1' : '0')}
        ${s.cpu ? `<select id="seat-level-${p}" data-level="${p}" aria-label="CPU">${['easy', 'normal', 'hard'].map((l) => `<option value="${l}" ${s.level === l ? 'selected' : ''}>${t(l)}</option>`).join('')}</select>` : ''}</div></div>`;
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
        <div class="seats">${seats}</div>
        ${hint ? `<p class="hint" id="seat-hint">${hint}</p>` : ''}
        ${ui.error ? `<p class="error" role="alert">${esc(ui.error)}</p>` : ''}
      </div>
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
  }

  function seatHint() {
    const st = S.settings, n = st.n, nm = (p) => esc(nameFrom(st.seats, p));
    return n === 4 ? t('teams_hint', { a: nm(0), b: nm(1), c: nm(2), d: nm(3) }) : n === 3 ? t('three_hint') : '';
  }

  function fanHTML(d) {
    const second = d.system === 'fr' ? 19 : 28; // King of Hearts / Knight of Swords
    return `<span class="fan"><span class="c">${D.face(0, d.id)}</span><span class="c">${D.face(second, d.id)}</span><span class="c">${D.back(d.id)}</span></span>`;
  }

  // ================= GAME SCREEN =================
  function render() {
    renderLayer();
    if (!S.session || $('#game').hidden) return;
    renderGame();
  }

  function renderGame() {
    const g = G(), n = g.n, v = viewerForRender(), st = S.settings;
    const sc = E.scores(g).perPlayer;
    const teams = n === 4;
    const tdot = (p) => (teams ? `<span class="tdot ${p % 2 ? 'b' : 'a'}"></span>` : '');
    const dealer = (p) => (p === g.dealer ? `<span class="badge dealer" title="dealer">${t('dealer')}</span>` : '');
    const cpu = (p) => (seatOf(p).cpu && seatOf(p).name ? `<span class="badge">${t('cpu')}</span>` : '');
    const pts = (p) => (st.showScore ? `<span class="pts">${teams ? E.scores(g).perSide[p % 2] : sc[p]}</span>` : '');
    const partnerOpen = teams && st.partnerView && E.cardsLeftToDraw(g) === 0;
    const handVisible = ui.viewer >= 0 && !ui.handoff && !seatOf(ui.viewer).cpu;

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
      <div class="top-spacer"></div><div class="deck-chip">${left ? `<b>${left}</b><br>${esc(t('in_deck', { n: '' }).trim())}` : esc(t('deck_empty'))}</div>${matchChip}</div>`;

    // Opponents (ordered left, top, right as seen by the viewer)
    const order = { left: 0, top: 1, right: 2 };
    const others = [];
    for (let p = 0; p < n; p++) if (p !== v) others.push(p);
    others.sort((a, b) => order[posOf(a, v)] - order[posOf(b, v)]);
    const opps = others.map((p) => {
      const isPartner = teams && p === (v + 2) % 4;
      const showFace = isPartner && partnerOpen && handVisible;
      const minis = showFace
        ? `<div class="minis face">${g.hands[p].map(faceHTML).join('')}</div>`
        : `<div class="minis">${g.hands[p].map(backHTML).join('')}</div>`;
      const turn = g.phase === 'play' && g.turn === p ? ' turn' : '';
      return `<div class="opp${turn}">${minis}<div class="tag">${tdot(p)}<span class="nm">${esc(name(p))}</span>${cpu(p)}${dealer(p)}${pts(p)}</div></div>`;
    }).join('');

    // Stock
    let stock;
    if (!g.briscolaTaken) {
      const layers = Math.min(4, Math.ceil(g.deck.length / 6));
      let pile = '';
      for (let i = 0; i < layers; i++) pile += `<div class="c" style="transform:translate(${i * 1.5}px,${-i * 1.5}px)">${D.back(deckId())}</div>`;
      stock = `<div class="stock"><div class="brisc">${faceHTML(g.briscola)}</div><div class="pile">${pile}</div><div class="count">${g.deck.length ? t('in_deck', { n: left }) : t('last_card')}</div></div>`;
    } else {
      stock = `<div class="stock"><div class="empty-trump">${trumpIcon}</div><div class="count">${t('deck_empty')}</div></div>`;
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
    const toast = ui.toast ? `<div class="toast" role="status">${ui.toast}</div>` : '';
    const firstTurn = g.phase === 'play' && g.turn === v && handVisible && g.tricks === 0 && M().hand === 1 && ui.selected == null && !ui.toast;
    const table = `<div class="table n${n}${collect}">${stock}${slots}${lastBtn}${trickNo}${toast}</div>`;

    // Viewer line + hand
    const myTurn = g.phase === 'play' && g.turn === v && handVisible;
    let status = '', statusCls = 'status';
    if (g.phase === 'play') {
      if (myTurn) { status = t('your_turn', { name: name(v) }); statusCls += ' go'; }
      else if (seatOf(g.turn).cpu) status = t('thinking', { name: name(g.turn) });
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
    ui.justPlayed = null;
    ui.justDrawn = [];
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
      body = head(t('menu')) + `<div class="btn-col">
        <button class="btn btn-primary" data-act="close">${t('back_game')}</button>
        <button class="btn btn-ghost" data-act="last" ${G().lastTrick ? '' : 'disabled'}>${t('last_trick')}</button>
        <button class="btn btn-ghost" data-act="decks">${t('deck')}: ${deck().name}</button>
        <button class="btn btn-ghost" data-act="rules">${t('rules')}</button>
        <button class="btn btn-ghost" data-act="toggle-sound">${t('opt_sound')}: ${S.settings.sound ? 'On' : t('off')}</button>
        <button class="btn btn-ghost" data-act="ask-redeal">${t('redeal')}</button>
        <button class="btn btn-ghost" data-act="ask-quit">${t('quit')}</button></div>`;
    } else if (sh.type === 'last') {
      const lt = G().lastTrick;
      body = head(t('last_trick')) + (lt
        ? `<div class="last-trick-cards">${lt.plays.map((pl) => `<figure class="${pl.p === lt.winner ? 'win' : ''}">${faceHTML(pl.c)}<figcaption>${esc(name(pl.p))}</figcaption></figure>`).join('')}</div><p style="text-align:center">${esc(t('takes', { name: name(lt.winner), pts: ptsLabel(lt.points) }))}</p>`
        : `<p>${t('no_trick')}</p>`);
    } else if (sh.type === 'confirm') {
      body = `<p class="confirm-text">${t(sh.text)}</p><div class="btn-row"><button class="btn btn-ghost" data-act="close">${t('cancel')}</button><button class="btn btn-primary" data-act="${sh.act}">${t(sh.yes)}</button></div>`;
    } else if (sh.type === 'summary') body = summaryHTML();
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
    const buttons = m.over
      ? `<button class="btn btn-ghost" data-act="quit">${t('setup')}</button><button class="btn btn-primary" data-act="new-match">${t('new_match')}</button>`
      : `<button class="btn btn-ghost" data-act="quit">${t('setup')}</button><button class="btn btn-primary" data-act="next-hand">${t('next_hand')}</button>`;
    return `<div class="result-banner"><span class="kicker">${t('hand_over', { n: m.hand })}</span><h2>${title}</h2></div>
      <div class="sides">${rows}</div>${matchLine}${matchBanner}<div class="btn-row">${buttons}</div>`;
  }

  // ================= FLOW =================
  function showScreen(which) {
    $('#setup').hidden = which !== 'setup';
    $('#game').hidden = which !== 'game';
    if (which === 'setup') renderSetup();
    else keepAwake();
  }

  function startMatch() {
    const st = S.settings, n = st.n;
    const seats = st.seats.slice(0, n).map((s) => ({ name: s.name.trim(), cpu: !!s.cpu, level: s.level || 'normal' }));
    if (!seats.some((s) => !s.cpu)) { ui.error = t('need_human'); renderSetup(); return; }
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

  function needsHandoff() { return S.settings.hideHands && humans() > 1; }

  function handoff(p) {
    return new Promise((resolve) => {
      ui.viewer = -1;
      ui.selected = null;
      ui.handoff = { p, ready: Date.now() + 450, resolve };
      render();
    });
  }

  function waitHuman() {
    return new Promise((resolve) => { ui.humanResolve = resolve; });
  }

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
    const alive = () => gen === ui.gen && S.session && S.session.G;
    render();
    while (alive() && G().phase !== 'over') {
      const g = G();
      if (g.phase === 'trickDone') { await finishTrick(alive); continue; }
      const p = g.turn, seat = seatOf(p);
      if (needsHandoff()) {
        const nh = nextHumanFrom(p);
        if (nh !== ui.viewer) { await handoff(nh); if (!alive()) return; }
      } else if (!seat.cpu) ui.viewer = p;
      else if (ui.viewer < 0) ui.viewer = nextHumanFrom(p);

      if (seat.cpu) {
        render();
        await sleep(650 * spd() + Math.random() * 250 * spd());
        if (!alive()) return;
        if (AI.wantsSwap(g, p)) {
          const took = g.briscola;
          E.doSwap(g, p);
          ui.toast = esc(t('swapped', { name: name(p), give: cardName(g.swapped.gave), took: cardName(took) }));
          render();
          await sleep(1400 * spd());
          if (!alive()) return;
          ui.toast = null;
        }
        playCard(p, AI.choose(g, p, seat.level));
      } else {
        render();
        if (humans() > 1 || g.tricks === 0) sfx.turn();
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
    ui.toast = `${esc(name(w))} · <b>${esc(ptsLabel(pts))}</b>`;
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
    ui.viewer = nextHumanFrom(0);
    ui.sheet = { type: 'summary' };
    render();
  }

  function stopFlow() {
    ui.gen++;
    ui.humanResolve = null;
    ui.handoff = null;
  }

  function resume() {
    if (!S.session || !S.session.G) return;
    ui.viewer = -1; ui.selected = null; ui.sheet = null; ui.toast = null; ui.collecting = false;
    showScreen('game');
    if (G().phase === 'over') { render(); endHand(); } else run();
  }

  // ================= EVENTS =================
  function onHandCard(c) {
    const g = G(), v = ui.viewer;
    if (!ui.humanResolve || ui.handoff || ui.sheet || g.phase !== 'play' || g.turn !== v) return;
    if (S.settings.twoTap && ui.selected !== c) { ui.selected = c; render(); return; }
    const r = ui.humanResolve;
    ui.humanResolve = null;
    r(c);
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
    if (act.startsWith('seat-cpu-')) {
      const p = +act.slice(9);
      st.seats[p].cpu = v === '1';
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
      case 'decks': ui.sheet = { type: 'decks', from: ui.sheet && ui.sheet.type }; render(); return;
      case 'pick-deck':
        st.deck = v; persist();
        ui.sheet = null;
        if (!$('#setup').hidden) renderSetup();
        render(); return;
      case 'rules': ui.sheet = { type: 'rules', from: ui.sheet && ui.sheet.type }; render(); return;
      case 'menu': ui.selected = null; ui.sheet = { type: 'menu' }; render(); return;
      case 'last': ui.sheet = { type: 'last', from: ui.sheet && ui.sheet.type }; render(); return;
      case 'close': case 'backdrop': ui.sheet = null; render(); return;
      case 'toggle-sound': st.sound = !st.sound; persist(); render(); return;
      case 'ask-quit': ui.sheet = { type: 'confirm', text: 'confirm_quit', yes: 'yes_quit', act: 'quit' }; render(); return;
      case 'ask-redeal': ui.sheet = { type: 'confirm', text: 'confirm_redeal', yes: 'yes_redeal', act: 'redeal' }; render(); return;
      case 'quit': stopFlow(); S.session = null; ui.sheet = null; persist(); render(); showScreen('setup'); return;
      case 'redeal': stopFlow(); dealHand(); return;
      case 'next-hand': {
        const m = M(); stopFlow();
        m.hand++; m.dealer = (m.dealer + 1) % cfg().n;
        dealHand(); return;
      }
      case 'new-match': {
        stopFlow();
        const c = cfg();
        S.session.M = { wins: Array(c.n === 4 ? 2 : c.n).fill(0), hand: 1, dealer: (M().dealer + 1) % c.n, over: false };
        dealHand(); return;
      }
      case 'reveal': {
        const h = ui.handoff;
        if (!h || Date.now() < h.ready) return;
        ui.viewer = h.p; ui.handoff = null;
        render();
        h.resolve();
        return;
      }
      case 'do-swap': {
        const g = G();
        if (!ui.humanResolve || !E.canSwap(g, ui.viewer)) return;
        const took = g.briscola;
        E.doSwap(g, ui.viewer);
        ui.justDrawn = [took];
        persist(); render(); return;
      }
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
    }
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset.set) { S.settings[el.dataset.set] = el.checked; persist(); }
    else if (el.dataset.level != null) { S.settings.seats[+el.dataset.level].level = el.value; persist(); }
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && ui.sheet && ui.sheet.type !== 'summary') { ui.sheet = null; render(); }
  });

  // ================= BOOT =================
  function start(hotData) {
    const saved = (hotData && hotData.settings) ? hotData : store.load();
    if (saved && saved.settings) {
      S.settings = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), saved.settings);
      if (!Array.isArray(S.settings.seats) || S.settings.seats.length < 4) S.settings.seats = DEFAULTS.seats;
      if (saved.session && saved.session.G && saved.session.G.v === 1) S.session = saved.session;
    }
    showScreen('setup');
  }
  if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
    try { window.claude.hot.snapshot(() => ({ settings: S.settings, session: S.session })); } catch (e) { /* ignore */ }
  }
  if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start);
  else start(window.claude && window.claude.hot ? window.claude.hot.data : null);
})();
