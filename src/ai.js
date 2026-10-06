/* CPU players. choose(state, seat, level, rng) returns a card id from that seat's hand.
 * Uses only information a real player has: own hand, the table, the face-up briscola and cards already played.
 */
(function (root, factory) {
  const E = typeof module === 'object' && module.exports ? require('./engine.js') : root.BriscolaEngine;
  const A = factory(E);
  if (typeof module === 'object' && module.exports) module.exports = A;
  else root.BriscolaAI = A;
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';
  const { suit, rank, points, strength, beats, trickWinnerIndex, teamOf } = E;

  // How much holding a card is worth for later tricks (beyond its own points).
  function keepValue(c, trump, deckLeft) {
    const late = deckLeft === 0 ? 0.5 : 1;
    if (suit(c) === trump) return (3 + strength(c) * 0.7) * late;
    return 0;
  }

  /** Cards no one has publicly seen yet, from `p`'s point of view. */
  function unseen(s, p) {
    const known = new Set(s.played.concat(s.hands[p]));
    if (!s.briscolaTaken) known.add(s.briscola);
    if (s.removed != null) known.add(s.removed);
    const out = [];
    for (let c = 0; c < 40; c++) if (!known.has(c)) out.push(c);
    return out;
  }

  /** Probability that `c`, winning right now, survives the players still to act. */
  function holdProbability(s, p, c, counting, pot) {
    const toAct = s.n - 1 - s.trick.length;
    if (toAct === 0) return 1;
    // Players after us who are on our side do not threaten the card.
    let threats = 0;
    for (let i = 1; i <= toAct; i++) {
      const q = (p + i) % s.n;
      if (teamOf(s, q) !== teamOf(s, p)) threats++;
    }
    if (threats === 0) return 1;
    if (!counting) {
      const base = suit(c) === s.trump ? 0.55 + strength(c) * 0.045 : 0.35 + strength(c) * 0.04;
      return Math.min(0.97, Math.pow(base, threats));
    }
    const pool = unseen(s, p);
    if (pool.length === 0) return 1;
    const killers = pool.filter((x) => beats(x, c, s.trump)).length;
    const handSize = Math.max(1, s.hands[p].length); // opponents hold roughly the same number
    const draws = threats * handSize;
    // Chance none of the opponents' cards is a killer (hypergeometric, approximated).
    let pNone = 1;
    for (let k = 0; k < draws && k < pool.length; k++) pNone *= Math.max(0, (pool.length - killers - k) / (pool.length - k));
    // Opponents do not always spend a killer: the bigger the pot, the more likely they do.
    const willing = Math.min(1, 0.45 + (pot || 0) / 22);
    return 1 - (1 - pNone) * willing;
  }

  function evaluate(s, p, c, counting) {
    const trump = s.trump;
    const deckLeft = E.cardsLeftToDraw(s);
    const keep = keepValue(c, trump, deckLeft);
    const me = teamOf(s, p);

    if (s.trick.length === 0 && counting) {
      // Leading with card counting: estimate whether an opponent can (and will) take it.
      const hold = holdProbability(s, p, c, true, points(c) + 2);
      return hold * (points(c) + 1) - (1 - hold) * (points(c) + 2) - keep * 0.9;
    }
    if (s.trick.length === 0) {
      // Leading: risk giving the card away. Points and trumps are costly to lead.
      const exposure = points(c) * 0.8 + keep * 0.9;
      // Leading a low trump late can flush opponents' trumps; small bonus when the deck is empty.
      const flush = deckLeft === 0 && suit(c) === trump && points(c) === 0 ? 1 : 0;
      return -exposure + flush - strength(c) * 0.05;
    }

    const wi = trickWinnerIndex(s.trick, trump);
    const winning = s.trick[wi];
    const table = s.trick.reduce((a, t) => a + points(t.c), 0);
    const pot = table + points(c);
    const takesNow = beats(c, winning.c, trump);
    const partnerWinning = teamOf(s, winning.p) === me && winning.p !== p;

    let pOurs;
    if (takesNow) pOurs = holdProbability(s, p, c, counting, pot);
    else if (partnerWinning) pOurs = holdProbability(s, winning.p, winning.c, counting, pot) * 0.95;
    else pOurs = 0;

    // Expected point swing: pot goes to us with pOurs, else to opponents.
    const swing = pOurs * pot - (1 - pOurs) * pot;
    return swing - keep * (takesNow || suit(c) === trump ? 1 : 0.2);
  }

  /** Exact endgame for 2 players once the deck is empty: the opponent's hand is then known. Returns my best card. */
  function solveEndgame(s, p) {
    const q = 1 - p;
    const opp = unseen(s, p);
    if (opp.length !== s.hands[q].length) return null;
    const T = s.trump;
    // value = my points minus opponent points from here on
    function search(mine, theirs, lead, onTable) {
      if (mine.length === 0 && theirs.length === 0) return 0;
      if (onTable == null) {
        // lead is 'me' or 'them'
        const hand = lead === 'me' ? mine : theirs;
        let best = lead === 'me' ? -Infinity : Infinity;
        for (const c of hand) {
          const rest = hand.filter((x) => x !== c);
          const v = lead === 'me' ? search(rest, theirs, 'me', c) : search(mine, rest, 'them', c);
          best = lead === 'me' ? Math.max(best, v) : Math.min(best, v);
        }
        return best;
      }
      // follower responds to onTable
      const follower = lead === 'me' ? 'them' : 'me';
      const hand = follower === 'me' ? mine : theirs;
      let best = follower === 'me' ? -Infinity : Infinity;
      for (const c of hand) {
        const rest = hand.filter((x) => x !== c);
        const followerWins = beats(c, onTable, T);
        const winner = followerWins ? follower : lead;
        const pts = points(c) + points(onTable);
        const nm = follower === 'me' ? rest : mine;
        const nt = follower === 'me' ? theirs : rest;
        const v = (winner === 'me' ? pts : -pts) + search(nm, nt, winner, null);
        best = follower === 'me' ? Math.max(best, v) : Math.min(best, v);
      }
      return best;
    }
    const mine = s.hands[p];
    const onTable = s.trick.length ? s.trick[0].c : null;
    let bestCard = null, bestV = -Infinity;
    for (const c of mine) {
      const rest = mine.filter((x) => x !== c);
      let v;
      if (onTable == null) v = search(rest, opp, 'me', c);
      else {
        const win = beats(c, onTable, T);
        const pts = points(c) + points(onTable);
        v = (win ? pts : -pts) + search(rest, opp, win ? 'me' : 'them', null);
      }
      if (v > bestV) { bestV = v; bestCard = c; }
    }
    return bestCard;
  }

  function choose(s, p, level, rng) {
    rng = rng || Math.random;
    const hand = s.hands[p];
    if (hand.length === 1) return hand[0];
    if (level === 'easy' && rng() < 0.6) return hand[Math.floor(rng() * hand.length)];
    const counting = level === 'hard';
    if (counting && s.n === 2 && E.cardsLeftToDraw(s) === 0) {
      const c = solveEndgame(s, p);
      if (c != null) return c;
    }
    let best = null, bestScore = -Infinity;
    for (const c of hand) {
      const noise = level === 'easy' ? rng() * 6 : rng() * 0.01;
      const sc = evaluate(s, p, c, counting) + noise;
      if (sc > bestScore) { bestScore = sc; best = c; }
    }
    return best;
  }

  /** Whether the CPU should take the swap (always worth it: it trades a 2/7 for a better trump). */
  function wantsSwap(s, p) {
    return E.canSwap(s, p) && strength(s.briscola) > strength(E.cardId(s.trump, s.swapRank));
  }

  return { choose, wantsSwap, evaluate, unseen };
});
