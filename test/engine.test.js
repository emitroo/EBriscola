const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine.js');
const AI = require('../src/ai.js');

test('deck has 120 points', () => {
  let t = 0;
  for (let c = 0; c < 40; c++) t += E.points(c);
  assert.equal(t, 120);
});

test('trick winner: led suit, higher strength, trumps', () => {
  const T = 0; // Denari trump
  const c = E.cardId;
  // 3 beats King of the same suit
  assert.equal(E.trickWinnerIndex([{ p: 0, c: c(1, 10) }, { p: 1, c: c(1, 3) }], T), 1);
  // Off-suit Ace does not beat led 2
  assert.equal(E.trickWinnerIndex([{ p: 0, c: c(1, 2) }, { p: 1, c: c(2, 1) }], T), 0);
  // Trump 2 beats led Ace
  assert.equal(E.trickWinnerIndex([{ p: 0, c: c(1, 1) }, { p: 1, c: c(0, 2) }], T), 1);
  // Higher trump wins among trumps; 4 players
  assert.equal(E.trickWinnerIndex([
    { p: 0, c: c(3, 1) }, { p: 1, c: c(0, 4) }, { p: 2, c: c(0, 8) }, { p: 3, c: c(3, 3) },
  ], T), 2);
});

test('deal sizes and removed card for 3 players', () => {
  for (const n of [2, 3, 4]) {
    const s = E.deal({ n, seed: 42 });
    assert.equal(s.hands.length, n);
    s.hands.forEach((h) => assert.equal(h.length, 3));
    const total = s.deck.length + 1 + 3 * n;
    assert.equal(total, n === 3 ? 39 : 40);
    assert.equal(E.cardsLeftToDraw(s) % n, 0, 'remaining cards divide evenly');
    if (n === 3) {
      const all = s.deck.concat([s.briscola], ...s.hands);
      assert.ok(!all.includes(E.REMOVED_IN_THREE));
    }
  }
});

function playOut(n, seed, levels) {
  const s = E.deal({ n, seed, swapRank: 7 });
  const rng = E.makeRng(seed + 1);
  let tricks = 0;
  while (s.phase !== 'over') {
    if (s.phase === 'trickDone') { E.resolveTrick(s); tricks++; continue; }
    const p = s.turn;
    if (AI.wantsSwap(s, p)) E.doSwap(s, p);
    E.play(s, p, AI.choose(s, p, levels[p % levels.length], rng));
  }
  return { s, tricks };
}

test('full games complete with all points accounted for', () => {
  for (const n of [2, 3, 4]) {
    for (let seed = 1; seed <= 60; seed++) {
      const { s, tricks } = playOut(n, seed, ['easy', 'normal', 'hard']);
      assert.equal(tricks, n === 2 ? 20 : n === 3 ? 13 : 10);
      const r = E.result(s);
      const totalPts = r.perPlayer.reduce((a, b) => a + b, 0);
      assert.equal(totalPts, n === 3 ? 120 : 120); // removed 2 is worth 0
      assert.equal(s.captured.flat().length, n === 3 ? 39 : 40);
      assert.ok(s.briscolaTaken);
    }
  }
});

test('swap rule exchanges the face-up card', () => {
  for (let seed = 1; seed < 500; seed++) {
    const s = E.deal({ n: 2, seed, swapRank: 2 });
    const two = E.cardId(s.trump, 2);
    const p = s.turn;
    if (!s.hands[p].includes(two) || E.rank(s.briscola) === 2) continue;
    assert.ok(E.canSwap(s, p));
    const faceUp = s.briscola;
    E.doSwap(s, p);
    assert.equal(s.briscola, two);
    assert.ok(s.hands[p].includes(faceUp));
    assert.ok(!E.canSwap(s, p));
    return;
  }
  assert.fail('no seed produced a swap opportunity');
});

test('hard AI beats random play over many 2-player games', () => {
  let hardPts = 0, games = 400;
  for (let seed = 1; seed <= games; seed++) {
    const seat = seed % 2; // alternate seats
    const levels = seat === 0 ? ['hard', 'random'] : ['random', 'hard'];
    const s = E.deal({ n: 2, seed, dealer: seed % 2 });
    const rng = E.makeRng(seed * 7);
    while (s.phase !== 'over') {
      if (s.phase === 'trickDone') { E.resolveTrick(s); continue; }
      const p = s.turn;
      const lv = levels[p];
      const c = lv === 'random' ? s.hands[p][Math.floor(rng() * s.hands[p].length)] : AI.choose(s, p, lv, rng);
      E.play(s, p, c);
    }
    hardPts += E.scores(s).perPlayer[seat];
  }
  const avg = hardPts / games;
  assert.ok(avg > 66, `hard AI average ${avg.toFixed(1)} should clearly beat random`);
});
