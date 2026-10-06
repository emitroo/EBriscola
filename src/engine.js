/* Briscola rules engine. Pure logic, no DOM. Works in the browser (window.BriscolaEngine) and in Node (module.exports).
 *
 * Cards are integers 0..39: suit = Math.floor(id / 10), rank = id % 10 + 1.
 * Suits (Latin order): 0 Denari/Coins, 1 Coppe/Cups, 2 Spade/Swords, 3 Bastoni/Clubs.
 * Ranks: 1 Ace, 2..7, 8 Fante (Jack), 9 Cavallo (Knight/Queen), 10 Re (King).
 * Seats play in increasing index order (seat i+1 sits to the right of seat i, i.e. counter-clockwise as in Italy).
 */
(function (root, factory) {
  const E = factory();
  if (typeof module === 'object' && module.exports) module.exports = E;
  else root.BriscolaEngine = E;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const POINTS = { 1: 11, 3: 10, 10: 4, 9: 3, 8: 2 };
  // Trick-taking strength: Ace > 3 > King > Knight > Jack > 7 > 6 > 5 > 4 > 2
  const STRENGTH = { 2: 1, 4: 2, 5: 3, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8, 3: 9, 1: 10 };
  const TOTAL_POINTS = 120;
  const REMOVED_IN_THREE = 1 * 10 + 1; // the 2 of Coppe/Cups leaves the deck in 3-player games

  const suit = (c) => Math.floor(c / 10);
  const rank = (c) => (c % 10) + 1;
  const points = (c) => POINTS[rank(c)] || 0;
  const strength = (c) => STRENGTH[rank(c)];
  const cardId = (s, r) => s * 10 + (r - 1);

  // Mulberry32: small seedable PRNG so games are reproducible in tests.
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Does card `b`, played after `a` is currently winning, take over? */
  function beats(b, a, trump) {
    const sb = suit(b), sa = suit(a);
    if (sb === sa) return strength(b) > strength(a);
    return sb === trump;
  }

  /** Index (into trick) of the winning play. trick = [{p, c}] in play order. */
  function trickWinnerIndex(trick, trump) {
    let w = 0;
    for (let i = 1; i < trick.length; i++) if (beats(trick[i].c, trick[w].c, trump)) w = i;
    return w;
  }

  const teamOf = (state, p) => (state.teams ? p % 2 : p);

  /**
   * Deal a new hand.
   * opts: { n: 2|3|4, dealer, seed, swapRank: 0|2|7 }
   */
  function deal(opts) {
    const n = opts.n;
    if (![2, 3, 4].includes(n)) throw new Error('Briscola needs 2, 3 or 4 players');
    const seed = opts.seed != null ? opts.seed : Math.floor(Math.random() * 2 ** 31);
    const rng = makeRng(seed);
    let cards = [];
    for (let i = 0; i < 40; i++) cards.push(i);
    if (n === 3) cards = cards.filter((c) => c !== REMOVED_IN_THREE);
    shuffle(cards, rng);

    const dealer = opts.dealer != null ? opts.dealer % n : 0;
    const first = (dealer + 1) % n;
    const hands = Array.from({ length: n }, () => []);
    // Three cards each, one at a time, starting from the player after the dealer.
    for (let k = 0; k < 3; k++) for (let i = 0; i < n; i++) hands[(first + i) % n].push(cards.pop());
    const briscola = cards.pop(); // turned face up, goes under the deck and is drawn last

    return {
      v: 1,
      n,
      teams: n === 4,
      seed,
      dealer,
      hands,
      deck: cards, // draw with pop()
      briscola,
      briscolaTaken: false,
      trump: suit(briscola),
      removed: n === 3 ? REMOVED_IN_THREE : null,
      swapRank: opts.swapRank || 0,
      swapped: null, // {p, gave, took} once the swap has happened
      leader: first,
      turn: first,
      trick: [],
      captured: Array.from({ length: n }, () => []),
      played: [], // every card played so far, public knowledge
      lastTrick: null, // {plays, winner, points}
      tricks: 0,
      phase: 'play', // 'play' | 'trickDone' | 'over'
      pendingWinner: null,
    };
  }

  const cardsLeftToDraw = (s) => s.deck.length + (s.briscolaTaken ? 0 : 1);

  function play(s, p, c) {
    if (s.phase !== 'play') throw new Error('Not in play phase');
    if (p !== s.turn) throw new Error('Not this player\'s turn');
    const idx = s.hands[p].indexOf(c);
    if (idx < 0) throw new Error('Card not in hand');
    s.hands[p].splice(idx, 1);
    s.trick.push({ p, c });
    s.played.push(c);
    if (s.trick.length === s.n) {
      s.phase = 'trickDone';
      s.pendingWinner = s.trick[trickWinnerIndex(s.trick, s.trump)].p;
    } else {
      s.turn = (p + 1) % s.n;
    }
    return s;
  }

  /** Collect the finished trick, refill hands (winner first), and set up the next trick. Returns drawn cards per seat. */
  function resolveTrick(s) {
    if (s.phase !== 'trickDone') throw new Error('No finished trick');
    const winner = s.pendingWinner;
    const pts = s.trick.reduce((a, t) => a + points(t.c), 0);
    for (const t of s.trick) s.captured[winner].push(t.c);
    s.lastTrick = { plays: s.trick.slice(), winner, points: pts };
    s.trick = [];
    s.tricks++;
    s.pendingWinner = null;

    const drawn = Array.from({ length: s.n }, () => null);
    if (cardsLeftToDraw(s) > 0) {
      for (let i = 0; i < s.n; i++) {
        const p = (winner + i) % s.n;
        let c;
        if (s.deck.length > 0) c = s.deck.pop();
        else { c = s.briscola; s.briscolaTaken = true; }
        s.hands[p].push(c);
        drawn[p] = c;
      }
    }
    s.leader = winner;
    s.turn = winner;
    s.phase = s.hands.every((h) => h.length === 0) ? 'over' : 'play';
    return drawn;
  }

  /** The face-up briscola may be exchanged for the 2 or 7 of trumps (house rule), while cards remain to be drawn. */
  function canSwap(s, p) {
    if (!s.swapRank || s.phase !== 'play' || s.turn !== p || s.briscolaTaken || s.swapped) return false;
    if (s.deck.length === 0) return false;
    if (rank(s.briscola) === s.swapRank) return false;
    return s.hands[p].includes(cardId(s.trump, s.swapRank));
  }

  function doSwap(s, p) {
    if (!canSwap(s, p)) throw new Error('Swap not allowed');
    const give = cardId(s.trump, s.swapRank);
    const h = s.hands[p];
    h[h.indexOf(give)] = s.briscola;
    s.swapped = { p, gave: give, took: s.briscola };
    s.briscola = give;
    return s;
  }

  function scores(s) {
    const perPlayer = s.captured.map((cs) => cs.reduce((a, c) => a + points(c), 0));
    if (!s.teams) return { perPlayer, perSide: perPlayer.slice() };
    return { perPlayer, perSide: [perPlayer[0] + perPlayer[2], perPlayer[1] + perPlayer[3]] };
  }

  /** Final result: winners are side indices (team index in 4p, seat index otherwise). Empty array never; ties return several. */
  function result(s) {
    const { perSide, perPlayer } = scores(s);
    const best = Math.max(...perSide);
    const winners = perSide.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
    return { perSide, perPlayer, winners, draw: winners.length > 1 };
  }

  return {
    POINTS, STRENGTH, TOTAL_POINTS, REMOVED_IN_THREE,
    suit, rank, points, strength, cardId, beats, trickWinnerIndex, teamOf,
    makeRng, shuffle, deal, play, resolveTrick, canSwap, doSwap, scores, result, cardsLeftToDraw,
  };
});
