/* Regional Italian deck styles, drawn as SVG. No image files: every card is generated, so the game works offline.
 * The art is a stylised interpretation of each regional pattern (suit system, single/double-headed courts,
 * colour scheme, card back), not a reproduction of any manufacturer's artwork.
 */
(function (root) {
  'use strict';

  // system: 'it' = Italian suits (curved interlaced swords, straight batons)
  //         'es' = Spanish-type Italian suits (straight swords, knobbly cudgels)
  //         'fr' = French suits (Quadri, Cuori, Picche, Fiori)
  // figures: 'full' = single full-length courts, 'double' = double-headed courts
  const BASE = {
    paper: '#fbf7ec', ink: '#1c1a17', gold: '#e5b21c', red: '#c42127', blue: '#1f4f9d', green: '#2f7a35',
    skin: '#f5d2ab', hair: '#5d3418', horse: '#f3eee2', blade: '#7fa6c9', baton: '#c9572a', club: '#5b8f2c', idx: '#1c1a17',
  };

  const DECKS = [
    { id: 'triestine', name: 'Triestine', region: 'Trieste', area: 'Friuli-Venezia Giulia', system: 'it', figures: 'double', label: true,
      pal: { blue: '#1d4c98', red: '#c4212b', gold: '#e8b51b', green: '#2c7a3a', baton: '#c4212b', blade: '#5f8fc4' },
      back: { kind: 'tartan', c1: '#1d4c98', c2: '#c4212b' } },
    { id: 'trevigiane', name: 'Trevigiane', region: 'Treviso', area: 'Veneto', system: 'it', figures: 'full',
      pal: { red: '#b8232e', blue: '#23558f', green: '#2d6e3e', gold: '#e3ae2a', baton: '#2d6e3e', blade: '#8aaed0' },
      back: { kind: 'diamonds', c1: '#2d6e3e', c2: '#e3ae2a' } },
    { id: 'bergamasche', name: 'Bergamasche', region: 'Bergamo', area: 'Lombardia', system: 'it', figures: 'double',
      pal: { red: '#a51d2d', blue: '#283f86', gold: '#efc24a', green: '#3b7a3f', baton: '#a51d2d', blade: '#6f93bf' },
      back: { kind: 'checks', c1: '#8b1d2c', c2: '#efc24a' } },
    { id: 'bresciane', name: 'Bresciane', region: 'Brescia', area: 'Lombardia', system: 'it', figures: 'double',
      pal: { red: '#c0392b', blue: '#233a7a', gold: '#d9a21b', green: '#2e6b4a', baton: '#233a7a', blade: '#97b4d4' },
      back: { kind: 'stripes', c1: '#233a7a', c2: '#d9a21b' } },
    { id: 'trentine', name: 'Trentine', region: 'Trento', area: 'Trentino', system: 'it', figures: 'double',
      pal: { red: '#9c2a2a', blue: '#2d4f80', gold: '#e3c26b', green: '#46703a', baton: '#46703a', blade: '#7d9cb8' },
      back: { kind: 'diamonds', c1: '#6e2b2b', c2: '#e3c26b' } },
    { id: 'piacentine', name: 'Piacentine', region: 'Piacenza', area: 'Emilia-Romagna', system: 'es', figures: 'full',
      pal: { red: '#d02a26', blue: '#1f5fae', gold: '#f2c12e', green: '#2f8a3a', club: '#c87a2a', blade: '#4f86c6' },
      back: { kind: 'diamonds', c1: '#b71c1c', c2: '#ffffff' } },
    { id: 'romagnole', name: 'Romagnole', region: 'Romagna', area: 'Emilia-Romagna', system: 'es', figures: 'full',
      pal: { red: '#b5302a', blue: '#20507a', gold: '#e8c547', green: '#0f5c4f', club: '#7a5a2a', blade: '#6b98c0' },
      back: { kind: 'stripes', c1: '#0f5c4f', c2: '#e8c547' } },
    { id: 'napoletane', name: 'Napoletane', region: 'Napoli', area: 'Campania', system: 'es', figures: 'full',
      pal: { red: '#e0262b', blue: '#1565c0', gold: '#fbc72c', green: '#2e9b44', club: '#3f9a3a', blade: '#2f78c9' },
      back: { kind: 'checks', c1: '#1565c0', c2: '#90caf9' } },
    { id: 'siciliane', name: 'Siciliane', region: 'Palermo', area: 'Sicilia', system: 'es', figures: 'full',
      pal: { red: '#b82533', blue: '#2a4d8f', gold: '#e9c46a', green: '#3d7d45', club: '#8a5a2b', blade: '#6c90c2' },
      back: { kind: 'tartan', c1: '#8e2430', c2: '#e9c46a' } },
    { id: 'sarde', name: 'Sarde', region: 'Cagliari', area: 'Sardegna', system: 'es', figures: 'full',
      pal: { red: '#c13a2b', blue: '#2b5d8a', gold: '#d8b43a', green: '#1b5e20', club: '#6d8b2e', blade: '#8aa9c4' },
      back: { kind: 'checks', c1: '#1b5e20', c2: '#c0ca33' } },
    { id: 'toscane', name: 'Toscane', region: 'Firenze', area: 'Toscana', system: 'fr', figures: 'double',
      pal: { red: '#c8102e', blue: '#2a4b8d', gold: '#e6b333', green: '#3f7d3a' },
      back: { kind: 'diamonds', c1: '#a31621', c2: '#f4d58d' } },
    { id: 'genovesi', name: 'Genovesi', region: 'Genova', area: 'Liguria', system: 'fr', figures: 'double',
      pal: { red: '#d0202e', blue: '#174a9c', gold: '#f0c03a', green: '#2b7a4b' },
      back: { kind: 'stripes', c1: '#0d47a1', c2: '#e3f2fd' } },
    { id: 'piemontesi', name: 'Piemontesi', region: 'Torino', area: 'Piemonte', system: 'fr', figures: 'double',
      pal: { red: '#b71c2a', blue: '#2b3f7a', gold: '#dcae47', green: '#486b3a' },
      back: { kind: 'tartan', c1: '#6d2e46', c2: '#e8c0a0' } },
    { id: 'milanesi', name: 'Milanesi', region: 'Milano', area: 'Lombardia', system: 'fr', figures: 'double',
      pal: { red: '#c62828', blue: '#1f3c73', gold: '#e2b23c', green: '#33693f' },
      back: { kind: 'checks', c1: '#263238', c2: '#b0bec5' } },
  ];
  // Settlers: a private Trieste-style deck, hidden until a photo pack for it is opened (with its code, which is not
  // stored anywhere in the app) or another phone in the same game shares it. Friends' photos are not part of the
  // app: they come from an encrypted photo pack on each phone (see photos.js) and are set with setPhotos().
  // A card without a photo shows the normal Trieste design, so the deck is always playable.
  DECKS.push({
    id: 'settlers', name: 'Settlers', region: 'Trieste', area: 'Edizione privata', system: 'it', figures: 'double', label: true,
    hidden: true, photoDeck: true,
    pal: { blue: '#1d4c98', red: '#c4212b', gold: '#e8b51b', green: '#2c7a3a', baton: '#c4212b', blade: '#5f8fc4' },
    back: { kind: 'tartan', c1: '#7a1f2b', c2: '#e8b51b' },
  });
  DECKS.forEach((d) => { d.pal = Object.assign({}, BASE, d.pal); });
  const byId = Object.fromEntries(DECKS.map((d) => [d.id, d]));
  const get = (id) => byId[id] || byId.triestine;

  const SUIT_KEYS = ['coin', 'cup', 'sword', 'club'];
  const sid = (d, key) => `bs-${d.id}-${key}`;
  const W = 200, H = 340;

  // ---------- suit symbols (viewBox -50 -50 100 100 unless noted) ----------
  function symbolDefs(d) {
    const p = d.pal, k = p.ink;
    const out = [];
    if (d.system === 'fr') {
      out.push(`<symbol id="${sid(d, 'coin')}" viewBox="-50 -50 100 100"><path d="M0,-46 L36,0 L0,46 L-36,0 Z" fill="${p.red}" stroke="${k}" stroke-width="2.5"/></symbol>`);
      out.push(`<symbol id="${sid(d, 'cup')}" viewBox="-50 -50 100 100"><path d="M0,44 C-12,30 -44,10 -44,-14 C-44,-34 -24,-44 -12,-40 C-6,-38 -2,-32 0,-26 C2,-32 6,-38 12,-40 C24,-44 44,-34 44,-14 C44,10 12,30 0,44 Z" fill="${p.red}" stroke="${k}" stroke-width="2.5"/></symbol>`);
      out.push(`<symbol id="${sid(d, 'sword')}" viewBox="-50 -50 100 100"><path d="M0,-46 C10,-28 44,-12 44,10 C44,26 30,34 18,30 C10,27 6,22 4,18 C6,30 10,40 16,46 L-16,46 C-10,40 -6,30 -4,18 C-6,22 -10,27 -18,30 C-30,34 -44,26 -44,10 C-44,-12 -10,-28 0,-46 Z" fill="${k}"/></symbol>`);
      out.push(`<symbol id="${sid(d, 'club')}" viewBox="-50 -50 100 100"><g fill="${k}"><circle cx="0" cy="-22" r="20"/><circle cx="-22" cy="10" r="20"/><circle cx="22" cy="10" r="20"/><path d="M-4,4 L4,4 C6,26 12,38 18,46 L-18,46 C-12,38 -6,26 -4,4 Z"/></g></symbol>`);
      return out.join('');
    }
    // Denari / Coins
    let petals = '';
    for (let i = 0; i < 8; i++) petals += `<ellipse cx="0" cy="-14" rx="5.5" ry="11" transform="rotate(${i * 45})" fill="${i % 2 ? p.green : p.blue}" stroke="${k}" stroke-width="1.2"/>`;
    let dots = '';
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; dots += `<circle cx="${(Math.cos(a) * 41).toFixed(1)}" cy="${(Math.sin(a) * 41).toFixed(1)}" r="2.2" fill="${k}"/>`; }
    out.push(`<symbol id="${sid(d, 'coin')}" viewBox="-50 -50 100 100"><circle r="47" fill="${p.gold}" stroke="${k}" stroke-width="3"/>${dots}<circle r="35" fill="${p.red}" stroke="${k}" stroke-width="2"/><circle r="28" fill="${p.gold}" stroke="${k}" stroke-width="1.6"/>${petals}<circle r="6" fill="${p.red}" stroke="${k}" stroke-width="1.5"/></symbol>`);
    // Coppe / Cups
    out.push(`<symbol id="${sid(d, 'cup')}" viewBox="-50 -50 100 100">
      <path d="M-36,-46 H36 C36,-12 20,4 0,7 C-20,4 -36,-12 -36,-46 Z" fill="${p.gold}" stroke="${k}" stroke-width="2.5"/>
      <path d="M-35,-34 H35 C34,-28 33,-25 32,-22 H-32 C-33,-25 -34,-28 -35,-34 Z" fill="${p.red}" stroke="${k}" stroke-width="1.5"/>
      <path d="M-20,-14 Q0,-4 20,-14" fill="none" stroke="${k}" stroke-width="1.5"/>
      <rect x="-6" y="6" width="12" height="24" fill="${p.red}" stroke="${k}" stroke-width="2"/>
      <ellipse cx="0" cy="17" rx="12" ry="6" fill="${p.blue}" stroke="${k}" stroke-width="2"/>
      <path d="M-28,47 C-22,30 22,30 28,47 Z" fill="${p.gold}" stroke="${k}" stroke-width="2.5"/></symbol>`);
    // Straight sword (viewBox -14 -50 28 100), used by 'es' pips and every ace/court
    out.push(`<symbol id="${sid(d, 'sword')}" viewBox="-14 -50 28 100">
      <path d="M-4.5,-24 L4.5,-24 L4.5,38 L0,49 L-4.5,38 Z" fill="${p.blade}" stroke="${k}" stroke-width="1.8"/>
      <line x1="0" y1="-22" x2="0" y2="40" stroke="${k}" stroke-width="0.9" opacity="0.6"/>
      <path d="M-13,-28 Q0,-22 13,-28 L13,-23 Q0,-17 -13,-23 Z" fill="${p.gold}" stroke="${k}" stroke-width="1.6"/>
      <rect x="-3.2" y="-43" width="6.4" height="16" fill="${p.red}" stroke="${k}" stroke-width="1.5"/>
      <circle cx="0" cy="-45" r="4.5" fill="${p.gold}" stroke="${k}" stroke-width="1.5"/></symbol>`);
    // Cudgel / baton (viewBox -14 -50 28 100)
    if (d.system === 'es') {
      out.push(`<symbol id="${sid(d, 'club')}" viewBox="-14 -50 28 100">
        <path d="M-3.5,49 L3.5,49 L10,-36 Q10,-49 0,-49 Q-10,-49 -10,-36 Z" fill="${p.club}" stroke="${k}" stroke-width="2"/>
        <path d="M6,-20 l7,-5 M-7,-4 l-6,-4 M5,14 l6,-4 M-5,28 l-5,-3" stroke="${k}" stroke-width="2.4" stroke-linecap="round"/>
        <ellipse cx="-2" cy="-30" rx="2.4" ry="3.6" fill="${k}" opacity="0.55"/><ellipse cx="2" cy="2" rx="2" ry="3.2" fill="${k}" opacity="0.55"/>
        <rect x="-4.5" y="40" width="9" height="5" fill="${p.red}" stroke="${k}" stroke-width="1.2"/></symbol>`);
    } else {
      out.push(`<symbol id="${sid(d, 'club')}" viewBox="-14 -50 28 100">
        <rect x="-5" y="-48" width="10" height="96" rx="5" fill="${p.baton}" stroke="${k}" stroke-width="2"/>
        <rect x="-6.5" y="-30" width="13" height="5" fill="${p.gold}" stroke="${k}" stroke-width="1.2"/>
        <rect x="-6.5" y="25" width="13" height="5" fill="${p.gold}" stroke="${k}" stroke-width="1.2"/>
        <circle cx="0" cy="-46" r="5.5" fill="${p.gold}" stroke="${k}" stroke-width="1.5"/>
        <circle cx="0" cy="46" r="5.5" fill="${p.gold}" stroke="${k}" stroke-width="1.5"/></symbol>`);
    }
    return out.join('');
  }

  function backPattern(d) {
    const b = d.back, id = sid(d, 'pat');
    switch (b.kind) {
      case 'tartan':
        return `<pattern id="${id}" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="${b.c1}"/><rect x="0" y="9" width="24" height="6" fill="${b.c2}" opacity="0.55"/><rect x="9" y="0" width="6" height="24" fill="${b.c2}" opacity="0.55"/><rect x="0" y="20" width="24" height="1.5" fill="#fff" opacity="0.35"/><rect x="20" y="0" width="1.5" height="24" fill="#fff" opacity="0.35"/></pattern>`;
      case 'diamonds':
        return `<pattern id="${id}" width="20" height="28" patternUnits="userSpaceOnUse"><rect width="20" height="28" fill="${b.c1}"/><path d="M10,2 L18,14 L10,26 L2,14 Z" fill="none" stroke="${b.c2}" stroke-width="2"/><circle cx="10" cy="14" r="2.2" fill="${b.c2}"/></pattern>`;
      case 'stripes':
        return `<pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="${b.c1}"/><rect width="5" height="14" fill="${b.c2}" opacity="0.8"/></pattern>`;
      default: // checks
        return `<pattern id="${id}" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="${b.c1}"/><rect width="10" height="10" fill="${b.c2}" opacity="0.6"/><rect x="10" y="10" width="10" height="10" fill="${b.c2}" opacity="0.6"/></pattern>`;
    }
  }

  // Sprite holding every deck's symbols, created lazily so previews of several decks can coexist.
  const loaded = new Set();
  function ensure(d) {
    if (typeof document === 'undefined' || loaded.has(d.id)) return;
    let host = document.getElementById('bs-sprite');
    if (!host) {
      host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      host.id = 'bs-sprite';
      host.setAttribute('aria-hidden', 'true');
      host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      host.innerHTML = '<defs></defs>';
      document.body.prepend(host);
    }
    host.querySelector('defs').insertAdjacentHTML('beforeend', symbolDefs(d) + backPattern(d) + (d.photoDeck ? photoClips(d) : ''));
    loaded.add(d.id);
  }

  const use = (d, key, x, y, w, h, extra) => `<use href="#${sid(d, key)}" x="${x}" y="${y}" width="${w}" height="${h}"${extra || ''}/>`;
  const useC = (d, key, cx, cy, size) => use(d, key, cx - size / 2, cy - size / 2, size, size);
  // long items (sword/club symbols have a 28x100 viewBox)
  const useLong = (d, key, cx, cy, len, angle) =>
    `<g transform="translate(${cx} ${cy}) rotate(${angle || 0})">${use(d, key, -len * 0.14, -len / 2, len * 0.28, len)}</g>`;

  // ---------- pips ----------
  const AREA = { x: 34, y: 44, w: 132, h: 252 };
  const LAYOUT = {
    2: [[0.5, 0.2], [0.5, 0.8]],
    3: [[0.5, 0.14], [0.5, 0.5], [0.5, 0.86]],
    4: [[0.26, 0.2], [0.74, 0.2], [0.26, 0.8], [0.74, 0.8]],
    5: [[0.26, 0.17], [0.74, 0.17], [0.5, 0.5], [0.26, 0.83], [0.74, 0.83]],
    6: [[0.26, 0.16], [0.74, 0.16], [0.26, 0.5], [0.74, 0.5], [0.26, 0.84], [0.74, 0.84]],
    7: [[0.26, 0.14], [0.74, 0.14], [0.5, 0.32], [0.26, 0.55], [0.74, 0.55], [0.26, 0.86], [0.74, 0.86]],
  };
  const at = (fx, fy) => [AREA.x + fx * AREA.w, AREA.y + fy * AREA.h];

  function gridPips(d, key, r) {
    const size = r <= 3 ? 64 : r <= 5 ? 56 : 50;
    return LAYOUT[r].map(([fx, fy], i) => {
      const [x, y] = at(fx, fy);
      // French pips in the lower half are inverted, as on real cards.
      const flip = d.system === 'fr' && fy > 0.55 ? ` transform="rotate(180 ${x} ${y})"` : '';
      return `<g${flip}>${useC(d, key, x, y, size)}</g>`;
    }).join('');
  }

  // Venetian-style curved swords: nested lens shapes sharing their tips, odd card adds a straight centre sword.
  function italianSwords(d, r) {
    const p = d.pal, k = p.ink, cx = 100, top = 56, bot = 284;
    let s = '';
    const pairs = Math.floor(r / 2);
    const blade = (path) => `<path d="${path}" fill="none" stroke="${k}" stroke-width="9" stroke-linecap="round"/><path d="${path}" fill="none" stroke="${p.blade}" stroke-width="5.5" stroke-linecap="round"/>`;
    const hilt = (x, y, up) => {
      const dir = up ? -1 : 1;
      return `<g transform="translate(${x} ${y})"><path d="M-11,0 Q0,${4 * dir} 11,0" fill="none" stroke="${k}" stroke-width="7" stroke-linecap="round"/><path d="M-11,0 Q0,${4 * dir} 11,0" fill="none" stroke="${p.gold}" stroke-width="4" stroke-linecap="round"/><rect x="-3" y="${up ? -16 : 2}" width="6" height="14" fill="${p.red}" stroke="${k}" stroke-width="1.4"/><circle cx="0" cy="${up ? -19 : 19}" r="4" fill="${p.gold}" stroke="${k}" stroke-width="1.4"/></g>`;
    };
    for (let i = 0; i < pairs; i++) {
      const w = 16 + i * 16 + (pairs === 1 ? 8 : 0);
      const tl = top + 14 + i * 4, bl = bot - 14 - i * 4;
      s += blade(`M${cx},${tl} Q${cx - w * 2},${(tl + bl) / 2} ${cx},${bl}`);
      s += blade(`M${cx},${tl} Q${cx + w * 2},${(tl + bl) / 2} ${cx},${bl}`);
    }
    if (r % 2) s += blade(`M${cx},${top + 6} L${cx},${bot - 6}`);
    // Hilts sit at the tips: top for the left blades, bottom for the right ones.
    s += hilt(cx, top + 4, true) + hilt(cx, bot - 4, false);
    // Small rosette where the blades meet, typical of the Venetian family.
    s += `<circle cx="${cx}" cy="170" r="${r % 2 ? 7 : 0}" fill="${p.gold}" stroke="${k}" stroke-width="1.5"/>`;
    return s;
  }

  // Venetian-style batons: long straight sticks in a diagonal lattice.
  function italianBatons(d, r) {
    const p = d.pal, k = p.ink;
    const pairs = Math.floor(r / 2);
    const stick = (x1, y1, x2, y2) => {
      const lerp = (t) => [(x1 + (x2 - x1) * t).toFixed(1), (y1 + (y2 - y1) * t).toFixed(1)];
      let o = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${k}" stroke-width="10.5" stroke-linecap="round"/>`
        + `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${p.baton}" stroke-width="7" stroke-linecap="round"/>`;
      for (const t of [0.2, 0.8]) { const [x, y] = lerp(t); o += `<circle cx="${x}" cy="${y}" r="4.6" fill="${p.gold}" stroke="${k}" stroke-width="1.3"/>`; }
      for (const t of [0, 1]) { const [x, y] = lerp(t); o += `<circle cx="${x}" cy="${y}" r="5.5" fill="${p.gold}" stroke="${k}" stroke-width="1.4"/>`; }
      return o;
    };
    let s = '';
    const top = 58, bot = 282, step = pairs === 2 ? 44 : 36, spread = pairs <= 1 ? 44 : step / 2;
    for (let i = 0; i < pairs; i++) {
      const off = (i - (pairs - 1) / 2) * step;
      s += stick(100 + off - spread, bot, 100 + off + spread, top);
      s += stick(100 - off + spread, bot, 100 - off - spread, top);
    }
    if (r % 2) s += stick(100, top - 4, 100, bot + 4);
    return s;
  }

  // Spanish-type swords and cudgels: crossed pairs stacked, odd card adds a vertical one through the middle.
  function crossedPips(d, key, r) {
    let s = '';
    const pairs = Math.floor(r / 2);
    const rows = Math.max(1, pairs);
    const len = rows === 1 ? 200 : rows === 2 ? 128 : 92;
    for (let i = 0; i < pairs; i++) {
      const y = AREA.y + ((i + 0.5) / rows) * AREA.h;
      s += useLong(d, key, 100, y, len, 30);
      s += useLong(d, key, 100, y, len, -30);
    }
    if (r % 2) s += useLong(d, key, 100, 170, pairs ? 236 : 210, 0);
    return s;
  }

  function ace(d, s) {
    const p = d.pal, k = p.ink;
    const key = SUIT_KEYS[s];
    let o = '';
    if (d.system === 'fr') return useC(d, key, 100, 170, 112);
    if (s === 0) {
      let leaves = '';
      for (let i = 0; i < 20; i++) leaves += `<ellipse cx="0" cy="-74" rx="5" ry="11" transform="translate(100 166) rotate(${i * 18})" fill="${p.green}" stroke="${k}" stroke-width="1.2"/>`;
      o += leaves + useC(d, 'coin', 100, 166, 124);
      o += `<path d="M44,262 Q100,250 156,262 L150,284 Q100,272 50,284 Z" fill="${p.paper}" stroke="${k}" stroke-width="1.6"/><text x="100" y="275" text-anchor="middle" font-family="Georgia,serif" font-size="12" letter-spacing="1.5" fill="${k}">${d.name.toUpperCase()}</text>`;
      return o;
    }
    if (s === 1) return `<circle cx="100" cy="170" r="70" fill="${p.gold}" opacity="0.18"/>` + useC(d, 'cup', 100, 172, 156);
    if (s === 2) {
      o += `<path d="M64,96 Q100,64 136,96" fill="none" stroke="${p.green}" stroke-width="9" stroke-linecap="round"/><path d="M64,96 Q100,64 136,96" fill="none" stroke="${k}" stroke-width="1.2" stroke-dasharray="4 5"/>`;
      return o + useLong(d, 'sword', 100, 170, 252, 0);
    }
    return `<path d="M76,70 q-22,-8 -26,-26 q20,2 26,26 Z M124,80 q22,-10 30,-26 q-22,0 -30,26 Z" fill="${p.green}" stroke="${k}" stroke-width="1.5"/>` + useLong(d, 'club', 100, 172, 250, 0);
  }

  // ---------- courts ----------
  function holdLong(d, s) { return s >= 2 && d.system !== 'fr'; }

  function courtColors(d, s) {
    const p = d.pal;
    const sets = [[p.red, p.gold], [p.blue, p.red], [p.green, p.gold], [p.red, p.blue]];
    return sets[s];
  }

  // Full-length single figure, drawn in the whole card area.
  function fullFigure(d, s, r) {
    const p = d.pal, k = p.ink, [main, acc] = courtColors(d, s);
    const key = SUIT_KEYS[s], long = holdLong(d, s);
    const sw = `stroke="${k}" stroke-width="2"`;
    const eyes = (x, y) => `<circle cx="${x - 6}" cy="${y}" r="1.8" fill="${k}"/><circle cx="${x + 6}" cy="${y}" r="1.8" fill="${k}"/>`;
    let o = '';
    if (r === 10) { // Re
      o += `<path d="M64,120 L40,292 L160,292 L136,120 Z" fill="${acc}" ${sw}/>`;
      o += `<path d="M72,118 Q100,108 128,118 L146,290 L54,290 Z" fill="${main}" ${sw}/>`;
      o += `<rect x="95" y="118" width="10" height="172" fill="${p.gold}" ${sw}/><rect x="54" y="280" width="92" height="10" fill="${p.gold}" ${sw}/>`;
      o += `<path d="M74,124 L58,188" stroke="${k}" stroke-width="16" stroke-linecap="round"/><path d="M74,124 L58,188" stroke="${main}" stroke-width="12" stroke-linecap="round"/><circle cx="58" cy="192" r="7" fill="${p.skin}" ${sw}/>`;
      o += `<path d="M126,124 L140,166" stroke="${k}" stroke-width="16" stroke-linecap="round"/><path d="M126,124 L140,166" stroke="${main}" stroke-width="12" stroke-linecap="round"/>`;
      o += `<rect x="93" y="104" width="14" height="14" fill="${p.skin}" ${sw}/><circle cx="100" cy="92" r="19" fill="${p.skin}" ${sw}/>`;
      o += `<path d="M82,94 Q84,128 100,130 Q116,128 118,94 Q110,104 100,104 Q90,104 82,94 Z" fill="${p.hair}" ${sw}/>` + eyes(100, 89);
      o += `<path d="M80,78 L80,58 L88,68 L94,52 L100,66 L106,52 L112,68 L120,58 L120,78 Z" fill="${p.gold}" ${sw}/><circle cx="100" cy="72" r="3" fill="${p.red}"/>`;
      o += long ? useLong(d, key, 146, 150, 190, 8) : useC(d, key, 142, 162, 46);
      o += `<circle cx="140" cy="168" r="7" fill="${p.skin}" ${sw}/>`;
    } else if (r === 8) { // Fante
      o += `<rect x="86" y="226" width="12" height="58" fill="${acc}" ${sw}/><rect x="102" y="226" width="12" height="58" fill="${acc}" ${sw}/>`;
      o += `<ellipse cx="90" cy="288" rx="11" ry="5" fill="${k}"/><ellipse cx="110" cy="288" rx="11" ry="5" fill="${k}"/>`;
      o += `<path d="M76,124 Q100,114 124,124 L136,234 L64,234 Z" fill="${main}" ${sw}/>`;
      o += `<rect x="70" y="180" width="60" height="9" fill="${p.gold}" ${sw}/>`;
      o += `<path d="M64,234 L136,234" stroke="${acc}" stroke-width="6"/>`;
      o += `<path d="M78,128 L56,160" stroke="${k}" stroke-width="15" stroke-linecap="round"/><path d="M78,128 L56,160" stroke="${main}" stroke-width="11" stroke-linecap="round"/>`;
      o += `<path d="M122,128 L140,186" stroke="${k}" stroke-width="15" stroke-linecap="round"/><path d="M122,128 L140,186" stroke="${main}" stroke-width="11" stroke-linecap="round"/><circle cx="140" cy="190" r="6.5" fill="${p.skin}" ${sw}/>`;
      o += `<rect x="94" y="106" width="12" height="14" fill="${p.skin}" ${sw}/><circle cx="100" cy="96" r="17" fill="${p.skin}" ${sw}/>`;
      o += `<path d="M83,96 Q82,108 88,114 L86,94 Z M117,96 Q118,108 112,114 L114,94 Z" fill="${p.hair}" ${sw}/>` + eyes(100, 95);
      o += `<ellipse cx="100" cy="80" rx="25" ry="9" fill="${acc}" ${sw}/><path d="M112,76 Q132,52 146,58 Q128,62 116,80 Z" fill="${p.gold}" ${sw}/>`;
      o += long ? useLong(d, key, 52, 150, 176, -10) : useC(d, key, 54, 140, 44);
      o += `<circle cx="56" cy="162" r="6.5" fill="${p.skin}" ${sw}/>`;
    } else { // Cavallo
      o += `<path d="M44,206 C30,226 34,250 38,262" fill="none" stroke="${p.hair}" stroke-width="8" stroke-linecap="round"/>`;
      for (const [x, y, h] of [[58, 232, 56], [76, 234, 54], [118, 234, 54], [136, 232, 56]]) o += `<rect x="${x}" y="${y}" width="10" height="${h}" fill="${p.horse}" ${sw}/><rect x="${x - 1}" y="${y + h - 6}" width="12" height="6" fill="${k}"/>`;
      o += `<ellipse cx="98" cy="214" rx="58" ry="27" fill="${p.horse}" ${sw}/>`;
      o += `<path d="M128,204 L146,158 L166,166 L150,216 Z" fill="${p.horse}" ${sw}/>`;
      o += `<ellipse cx="164" cy="172" rx="10" ry="20" transform="rotate(-55 164 172)" fill="${p.horse}" ${sw}/><path d="M150,156 l2,-12 l7,9 Z" fill="${p.horse}" ${sw}/><circle cx="168" cy="166" r="1.8" fill="${k}"/>`;
      o += `<path d="M146,158 Q136,176 130,200" fill="none" stroke="${p.hair}" stroke-width="6"/>`;
      o += `<path d="M70,192 L128,192 L124,244 L74,244 Z" fill="${main}" ${sw}/><path d="M74,244 L124,244" stroke="${p.gold}" stroke-width="5" stroke-dasharray="4 3"/>`;
      o += `<rect x="92" y="196" width="13" height="44" fill="${acc}" ${sw}/><ellipse cx="98" cy="244" rx="10" ry="5" fill="${k}"/>`;
      o += `<path d="M86,148 L114,148 L118,200 L82,200 Z" fill="${main}" ${sw}/><rect x="84" y="176" width="32" height="7" fill="${p.gold}" ${sw}/>`;
      o += `<path d="M88,154 L66,124" stroke="${k}" stroke-width="13" stroke-linecap="round"/><path d="M88,154 L66,124" stroke="${main}" stroke-width="9" stroke-linecap="round"/>`;
      o += `<circle cx="100" cy="132" r="14" fill="${p.skin}" ${sw}/>` + eyes(100, 132).replace(/r="1.8"/g, 'r="1.5"');
      o += `<path d="M86,128 Q86,110 100,110 Q114,110 114,128 Z" fill="${acc}" ${sw}/><path d="M100,110 Q108,92 124,92 Q112,100 104,112 Z" fill="${p.gold}" ${sw}/>`;
      o += long ? useLong(d, key, 62, 104, 150, -18) : useC(d, key, 62, 104, 42);
      o += `<circle cx="65" cy="122" r="6" fill="${p.skin}" ${sw}/>`;
    }
    return o;
  }

  // Upper half of a double-headed court (mirrored to make the full card).
  function bust(d, s, r) {
    const p = d.pal, k = p.ink, [main, acc] = courtColors(d, s);
    const key = SUIT_KEYS[s], long = holdLong(d, s);
    const sw = `stroke="${k}" stroke-width="2"`;
    const queen = d.system === 'fr' && r === 9;
    const knight = r === 9 && !queen;
    let o = '';
    if (knight) {
      o += `<path d="M30,170 L44,120 Q46,100 34,88 L22,96 Q14,92 20,82 L36,66 Q52,58 62,74 L70,118 L66,170 Z" fill="${p.horse}" ${sw}/>`;
      o += `<path d="M38,66 l-2,-12 l9,8 Z" fill="${p.horse}" ${sw}/><circle cx="34" cy="76" r="1.8" fill="${k}"/>`;
      o += `<path d="M56,70 Q72,100 70,140" fill="none" stroke="${p.hair}" stroke-width="5"/>`;
    }
    o += `<path d="M46,170 L58,134 Q100,118 142,134 L154,170 Z" fill="${main}" ${sw}/>`;
    o += `<path d="M76,128 Q100,150 124,128 Q100,138 76,128 Z" fill="${acc}" ${sw}/>`;
    o += `<rect x="95" y="138" width="10" height="32" fill="${p.gold}" ${sw}/>`;
    o += `<rect x="92" y="112" width="16" height="16" fill="${p.skin}" ${sw}/>`;
    if (queen) o += `<path d="M74,98 Q72,60 100,58 Q128,60 126,98 L132,138 Q118,128 116,110 L84,110 Q82,128 68,138 Z" fill="${p.hair}" ${sw}/>`;
    o += `<circle cx="100" cy="98" r="22" fill="${p.skin}" ${sw}/>`;
    o += `<circle cx="93" cy="96" r="2" fill="${k}"/><circle cx="107" cy="96" r="2" fill="${k}"/><path d="M95,108 Q100,111 105,108" fill="none" stroke="${k}" stroke-width="1.5"/>`;
    if (r === 10) {
      o += `<path d="M80,104 Q82,132 100,134 Q118,132 120,104 Q110,114 100,114 Q90,114 80,104 Z" fill="${p.hair}" ${sw}/>`;
      o += `<path d="M78,80 L78,56 L87,68 L94,50 L100,64 L106,50 L113,68 L122,56 L122,80 Z" fill="${p.gold}" ${sw}/><circle cx="100" cy="74" r="3.5" fill="${p.red}"/>`;
    } else if (queen) {
      o += `<path d="M84,78 L88,64 L94,72 L100,60 L106,72 L112,64 L116,78 Z" fill="${p.gold}" ${sw}/>`;
    } else if (knight) {
      o += `<path d="M78,92 Q78,68 100,68 Q122,68 122,92 Z" fill="${acc}" ${sw}/><path d="M100,68 Q110,46 132,48 Q116,56 106,70 Z" fill="${p.gold}" ${sw}/>`;
    } else { // Fante
      o += `<path d="M80,92 Q76,104 82,116 L84,90 Z M120,92 Q124,104 118,116 L116,90 Z" fill="${p.hair}" ${sw}/>`;
      o += `<ellipse cx="100" cy="80" rx="27" ry="10" fill="${acc}" ${sw}/><path d="M114,76 Q136,50 152,56 Q132,62 118,80 Z" fill="${p.gold}" ${sw}/>`;
    }
    if (long) o += useLong(d, key, 142, 114, 110, 14);
    else o += useC(d, key, 142, 128, 44);
    o += `<circle cx="136" cy="${long ? 140 : 152}" r="7" fill="${p.skin}" ${sw}/>`;
    return o;
  }

  const ROLE_IT = { 8: 'FANTE', 9: 'CAVALLO', 10: 'RE' };
  const ROLE_FR = { 8: 'FANTE', 9: 'DONNA', 10: 'RE' };

  function court(d, s, r) {
    if (d.figures === 'full') return fullFigure(d, s, r);
    const half = `<g transform="translate(100 170) scale(1.1) translate(-100 -170)">${bust(d, s, r)}</g>`;
    let o = `<clipPath id="cl-${d.id}-${s}-${r}"><rect x="12" y="12" width="176" height="158"/></clipPath>`;
    o += `<g clip-path="url(#cl-${d.id}-${s}-${r})">${half}</g>`;
    o += `<g transform="rotate(180 100 170)"><g clip-path="url(#cl-${d.id}-${s}-${r})">${half}</g></g>`;
    o += `<line x1="22" y1="170" x2="178" y2="170" stroke="${d.pal.ink}" stroke-width="1.5"/>`;
    if (d.label) {
      const t = (d.system === 'fr' ? ROLE_FR : ROLE_IT)[r];
      o += `<rect x="58" y="160" width="84" height="20" rx="3" fill="${d.pal.paper}" stroke="${d.pal.ink}" stroke-width="1.5"/><text x="100" y="174.5" text-anchor="middle" font-family="Georgia,serif" font-size="12" letter-spacing="1.2" fill="${d.pal.ink}">${t}</text>`;
    }
    return o;
  }

  // ---------- photo cards (Settlers) ----------
  const SUIT_IT = ['DENARI', 'COPPE', 'SPADE', 'BASTONI'];
  const PHOTOS = {}; // deck id -> { card: image URL }, held in memory only
  const photoSrc = (d, card) => PHOTOS[d.id][card];
  /** Set (or clear, with null) the photos shown on a deck's cards. */
  function setPhotos(deckId, map) {
    PHOTOS[deckId] = map || {};
    for (const k of [...faceCache.keys()]) if (k.startsWith(deckId + ':')) faceCache.delete(k);
  }

  // Photo clip shapes live once in the shared sprite: a card drawn twice (or once inside a hidden sheet)
  // would otherwise carry duplicate ids, and browsers drop clips defined inside display:none subtrees.
  const photoClips = (d) => `<clipPath id="ph-${d.id}-oval"><ellipse cx="100" cy="158" rx="64" ry="85"/></clipPath>`
    + `<clipPath id="ph-${d.id}-rect"><rect x="9" y="9" width="182" height="322" rx="10"/></clipPath>`;

  // Medallion layout: aces, and any number card given a photo later (the ribbon names the card).
  function photoAce(d, card, s, base) {
    const p = d.pal, k = p.ink, id = `ph-${d.id}-oval`;
    let o = base;
    o += `<ellipse cx="100" cy="158" rx="70" ry="91" fill="${p.paper}" stroke="${p.gold}" stroke-width="7"/>`;
    o += `<image href="${photoSrc(d, card)}" x="36" y="73" width="128" height="170" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`;
    o += `<ellipse cx="100" cy="158" rx="70" ry="91" fill="none" stroke="${k}" stroke-width="1.6"/>`;
    o += `<ellipse cx="100" cy="158" rx="64" ry="85" fill="none" stroke="${k}" stroke-width="1.2"/>`;
    // Suit emblems around the medallion keep the card recognisable at a glance.
    for (const [x, y] of [[100, 62], [24, 158], [176, 158]]) o += `<circle cx="${x}" cy="${y}" r="15" fill="${p.paper}" stroke="${k}" stroke-width="1.2"/>` + useC(d, SUIT_KEYS[s], x, y, 22);
    o += `<path d="M30,262 Q100,250 170,262 L164,286 Q100,274 36,286 Z" fill="${p.paper}" stroke="${k}" stroke-width="1.6"/>`;
    o += `<text x="100" y="276" text-anchor="middle" font-family="Georgia,serif" font-size="12" letter-spacing="1.2" fill="${k}">${card % 10 ? (card % 10 + 1) : 'ASSO'} DI ${SUIT_IT[s]}</text>`;
    return o;
  }

  function photoCourt(d, card, s, r, base) {
    const p = d.pal, k = p.ink, id = `ph-${d.id}-rect`;
    const role = ROLE_IT[r];
    let o = base;
    o += `<image href="${photoSrc(d, card)}" x="9" y="9" width="182" height="322" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`;
    o += `<rect x="9" y="9" width="182" height="322" rx="10" fill="none" stroke="${p.gold}" stroke-width="5"/>`;
    o += `<rect x="6.5" y="6.5" width="187" height="327" rx="12" fill="none" stroke="${k}" stroke-width="1.4"/>`;
    // Paper badges behind the corner indices, and a name banner with the suit on both sides.
    const badge = `<rect x="5" y="9" width="29" height="58" rx="6" fill="${p.paper}" fill-opacity="0.94" stroke="${k}" stroke-width="1"/>`;
    o += badge + `<g transform="rotate(180 100 170)">${badge}</g>`;
    o += `<rect x="44" y="300" width="112" height="24" rx="5" fill="${p.paper}" fill-opacity="0.95" stroke="${k}" stroke-width="1.2"/>`;
    o += useC(d, SUIT_KEYS[s], 57, 312, 16) + useC(d, SUIT_KEYS[s], 143, 312, 16);
    o += `<text x="100" y="316.5" text-anchor="middle" font-family="Georgia,serif" font-size="12" font-weight="700" letter-spacing="1.4" fill="${k}">${role}</text>`;
    return o;
  }

  // ---------- indices ----------
  function indexLabel(d, r) {
    if (d.system === 'fr') return { 1: 'A', 8: 'J', 9: 'Q', 10: 'K' }[r] || String(r);
    return String(r);
  }
  function indexColor(d, s) {
    if (d.system === 'fr') return s <= 1 ? d.pal.red : d.pal.ink;
    return [d.pal.red, d.pal.blue, d.pal.blue, d.pal.green][s];
  }

  const faceCache = new Map();
  function face(card, deckId) {
    const d = get(deckId);
    const ck = d.id + ':' + card;
    if (faceCache.has(ck)) return faceCache.get(ck);
    ensure(d);
    const s = Math.floor(card / 10), r = (card % 10) + 1;
    const key = SUIT_KEYS[s];
    let body;
    if (r === 1) body = ace(d, s);
    else if (r >= 8) body = court(d, s, r);
    else if (d.system === 'it' && s === 2) body = italianSwords(d, r);
    else if (d.system === 'it' && s === 3) body = italianBatons(d, r);
    else if (d.system === 'es' && s >= 2) body = crossedPips(d, key, r);
    else body = gridPips(d, key, r);
    if (PHOTOS[d.id] && PHOTOS[d.id][card]) body = r < 8 ? photoAce(d, card, s, body) : photoCourt(d, card, s, r, body);

    const col = indexColor(d, s), lab = indexLabel(d, r);
    const idx = `<text x="19" y="37" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-weight="700" font-size="${lab.length > 1 ? 24 : 30}" fill="${col}">${lab}</text>` + (holdLong(d, s) ? use(d, key, 14, 44, 10, 34) : useC(d, key, 19, 54, 18));
    const svg = `<svg class="cface" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">`
      + `<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="14" fill="${d.pal.paper}" stroke="#00000033" stroke-width="3"/>`
      + `<rect x="8" y="8" width="${W - 16}" height="${H - 16}" rx="9" fill="none" stroke="${d.pal.ink}" stroke-opacity="0.18" stroke-width="1.2"/>`
      + body + idx + `<g transform="rotate(180 ${W / 2} ${H / 2})">${idx}</g></svg>`;
    faceCache.set(ck, svg);
    return svg;
  }

  function back(deckId) {
    const d = get(deckId);
    ensure(d);
    const b = d.back;
    return `<svg class="cback" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`
      + `<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="14" fill="${d.pal.paper}" stroke="#00000033" stroke-width="3"/>`
      + `<rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="8" fill="url(#${sid(d, 'pat')})" stroke="${b.c1}" stroke-width="3"/>`
      + `<rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="5" fill="none" stroke="${d.pal.paper}" stroke-width="2" opacity="0.8"/>`
      + `</svg>`;
  }

  function suitIcon(s, deckId, cls) {
    const d = get(deckId);
    ensure(d);
    const key = SUIT_KEYS[s];
    const long = (key === 'sword' || key === 'club') && d.system !== 'fr';
    const vb = long ? '-14 -50 28 100' : '-50 -50 100 100';
    return `<svg class="${cls || 'sicon'}" viewBox="${vb}" aria-hidden="true">${use(d, key, long ? -14 : -50, -50, long ? 28 : 100, 100)}</svg>`;
  }


  root.BriscolaDecks = { list: DECKS, get, face, back, suitIcon, indexLabel, ensure, setPhotos };
})(typeof self !== 'undefined' ? self : this);
