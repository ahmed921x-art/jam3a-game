const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../game-logic.js');

const category = (name, offset = 0) => ({ name, questions: [200, 400, 600].flatMap((points) => [0, 1, 2].map((i) => ({ points, q: `${name} ${points} ${i + offset}`, a: 'answer' }))) });
const teams = [{ name: 'A', score: 0, correct: 0, lifelines: [] }, { name: 'B', score: 0, correct: 0, lifelines: [] }];

test('board selects two unique questions per value and rejects repeats across categories', () => {
  const board = rules.pickBoard([category('alpha'), category('beta')], false);
  assert.equal(board.length, 2);
  assert.deepEqual(board[0].questions.map((q) => q.points), [200, 200, 400, 400, 600, 600]);
  assert.equal(new Set(board.flatMap((c) => c.questions.map((q) => rules.key(q.q)))).size, 12);
  assert.throws(() => rules.pickBoard([category('alpha'), category('alpha')], false));
});

test('awarding a steal gives points only once and alternates selection turn', () => {
  const result = rules.award(teams, 1, 2, 400);
  assert.deepEqual(result.teams.map((t) => t.score), [0, 400]);
  assert.deepEqual(result.teams.map((t) => t.correct), [0, 1]);
  assert.equal(result.turn, 2);
  assert.equal(result.stolen, true);
  assert.deepEqual(teams.map((t) => t.score), [0, 0]);
  assert.deepEqual(rules.award(result.teams, 2, 0, 200).teams.map((t) => t.score), [0, 400]);
  assert.throws(() => rules.award(teams, 1, 3, 200));
});

test('timer uses elapsed wall time, pauses, and ignores clock reversal', () => {
  assert.deepEqual(rules.advanceTimer(4, 1000, 3550, false), { elapsed: 6, lastTick: 3000 });
  assert.deepEqual(rules.advanceTimer(6, 3000, 9000, true), { elapsed: 6, lastTick: 9000 });
  assert.deepEqual(rules.advanceTimer(6, 9000, 8000, false), { elapsed: 6, lastTick: 9000 });
});

test('golden wager clamps invalid values and scores both teams once', () => {
  const starting = [{ ...teams[0], score: 500 }, { ...teams[1], score: 200 }];
  assert.equal(rules.clampWager('999', 500), 500);
  assert.equal(rules.clampWager('not-a-number', 500), 0);
  assert.deepEqual(rules.applyGolden(starting, [300, 999], [false, true]).map((t) => t.score), [200, 400]);
  assert.throws(() => rules.applyGolden(starting, [100, 100], [true, null]));
});

test('saved match validation rejects partial and already answered current questions', () => {
  const snap = { teams, turn: 1, cats: rules.pickBoard([category('alpha')], false), current: { ci: 0, qi: 0 } };
  assert.equal(rules.validateSnapshot(snap), true);
  snap.cats[0].questions[0].done = true;
  assert.equal(rules.validateSnapshot(snap), false);
  assert.equal(rules.validateSnapshot({ teams: null, cats: [] }), false);
});

test('custom category import rejects malformed, duplicate, and executable data', () => {
  assert.equal(rules.cleanCategory({ name: 'bad', questions: [] }), null);
  const clean = rules.cleanCategory({ ...category('safe'), icon: '<img>', questions: [...category('safe').questions, { points: 200, q: '', a: 'x' }] });
  assert.ok(clean);
  assert.equal(clean.questions.length, 9);
  assert.equal(clean.icon, '<img>'); // Escaped at every HTML rendering boundary.
  assert.equal(rules.cleanCategory({ name: 'dup', questions: [200, 400, 600].flatMap((p) => [{ points: p, q: 'same', a: 'a' }, { points: p, q: 'same', a: 'b' }]) }), null);
});
