/* Private photo packs for hidden decks (Settlers). The photos are never hosted anywhere:
 * - a pack file (.ebdeck) holds the photos encrypted with the deck code (PBKDF2-SHA256 + AES-GCM), so the file is
 *   useless without the code; players keep and pass it around themselves;
 * - a phone that imports a pack stores the photos in its own browser storage (IndexedDB) only;
 * - phones in the same game pass the photos to each other over their direct, encrypted WebRTC connection.
 * Works in the browser (window.BriscolaPhotos) and in Node 20+ (module.exports, used by tools/make-pack.mjs).
 */
(function (root) {
  'use strict';
  const MAGIC = [0x45, 0x42, 0x44, 0x31]; // "EBD1"
  const ITER = 250000;
  const MAX_PHOTO = 3 * 1024 * 1024; // base64 characters per photo
  const enc = new TextEncoder(), dec = new TextDecoder();
  const norm = (code) => String(code || '').trim().toLowerCase();

  function b64(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function key(code, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(norm(code)), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  /** Keep only well-formed photos: card 0..39 -> { type: 'image/…', data: base64 }. */
  function clean(photos) {
    const out = {};
    for (const [k, p] of Object.entries(photos || {})) {
      const c = +k;
      if (!Number.isInteger(c) || c < 0 || c > 39 || !p || typeof p.data !== 'string' || p.data.length > MAX_PHOTO) continue;
      if (typeof p.type !== 'string' || !/^image\/(jpeg|png|webp|gif)$/.test(p.type)) continue;
      out[c] = { type: p.type, data: p.data };
    }
    return out;
  }

  /** pack = { deck, photos: { [card]: { type, data } } } -> encrypted bytes. */
  async function seal(pack, code) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const body = enc.encode(JSON.stringify({ v: 1, deck: pack.deck, photos: clean(pack.photos) }));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(code, salt), body));
    const out = new Uint8Array(4 + 16 + 12 + ct.length);
    out.set(MAGIC, 0); out.set(salt, 4); out.set(iv, 20); out.set(ct, 32);
    return out;
  }

  /** Encrypted bytes -> pack. Throws Error('format') for a file that isn't a pack, Error('code') for a wrong code. */
  async function open(bytes, code) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (u8.length < 48 || MAGIC.some((b, i) => u8[i] !== b)) throw new Error('format');
    let body;
    try { body = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8.slice(20, 32) }, await key(code, u8.slice(4, 20)), u8.slice(32)); } catch (e) { throw new Error('code'); }
    const pack = JSON.parse(dec.decode(body));
    if (!pack || pack.v !== 1 || typeof pack.deck !== 'string') throw new Error('format');
    return { deck: pack.deck, photos: clean(pack.photos) };
  }

  // ---------- this phone's storage ----------
  const DB = 'ebriscola-photos', STORE = 'decks';
  function db() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(STORE, mode), req = fn(t.objectStore(STORE));
      t.oncomplete = () => { d.close(); res(req && req.result); };
      t.onerror = t.onabort = () => { d.close(); rej(t.error); };
    });
  }
  const load = (deck) => tx('readonly', (s) => s.get(deck)).then((v) => clean(v)).catch(() => ({}));
  const save = (deck, photos) => tx('readwrite', (s) => s.put(clean(photos), deck)).catch(() => {});
  const remove = (deck) => tx('readwrite', (s) => s.delete(deck)).catch(() => {});

  /** Photos -> object URLs for the card renderer. */
  function urls(photos) {
    const out = {};
    for (const [c, p] of Object.entries(photos)) out[c] = URL.createObjectURL(new Blob([unb64(p.data)], { type: p.type }));
    return out;
  }

  const P = { seal, open, clean, load, save, remove, urls, b64, unb64 };
  if (typeof module === 'object' && module.exports) module.exports = P;
  else root.BriscolaPhotos = P;
})(typeof self !== 'undefined' ? self : this);
