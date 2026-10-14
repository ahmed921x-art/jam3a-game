const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const R = require('../match-logic.js');

const root = path.resolve(__dirname, '..');
// فئة فيها n أسئلة لكل مستوى (200/400/600)
const cat = (id, n = 2) => ({
  id, name: id,
  questions: [200, 400, 600].flatMap((p) => Array.from({ length: n }, (_, i) => ({ points: p, q: `${id} ${p} ${i}?`, a: `${id}${p}${i}` }))),
});
const match = (rules = {}) => R.newMatch({
  mode: 'teams',
  sides: [{ name: 'A', players: ['a1', 'a2'] }, { name: 'B' }],
  board: R.buildBoard([cat('x'), cat('y'), cat('z')], { values: 200, random: false }),
  rules,
});

test('every column is 200 200 400 400 600 600 with unique questions', () => {
  const board = R.buildBoard([cat('x', 4), cat('y', 3)], { values: 200 });
  for (const col of board) assert.deepEqual(col.cells.map((c) => c.points), [200, 200, 400, 400, 600, 600]);
  const keys = board.flatMap((c) => c.cells.map((x) => x.q.q));
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(R.buildBoard([cat('x')], { values: 100 })[0].cells.map((c) => c.points), [100, 100, 200, 200, 300, 300]);
});

test('a category needs two different questions per difficulty', () => {
  assert.ok(R.canFill(cat('z')));
  assert.ok(!R.canFill(cat('z', 1)));
  // نفس الإجابة (نفس الشخصية) لا تتكرر في عمود واحد للأسئلة المصوّرة
  const dupe = { id: 'd', name: 'd', questions: [200, 200, 400, 400, 600, 600].map((p, i) => ({ points: p, type: 'image', img: `https://x.test/${i}.png`, q: 'مين؟', a: p === 200 ? 'Mario' : `c${i}` })) };
  assert.ok(!R.canFill(dupe));
});

test('correct answer scores once, marks the cell used and passes the turn', () => {
  let m = match();
  m = R.open(m, 0, 2);
  m = R.judge(m, true);
  assert.equal(m.sides[0].score, 400);
  assert.equal(m.board[0].cells[2].status, 'used');
  assert.throws(() => R.judge(m, true));
  assert.throws(() => R.skip(m));
  m = R.close(m);
  assert.equal(m.turn, 1);
  assert.equal(m.sides[0].playerIdx, 1);
  assert.throws(() => R.open(m, 0, 2), /not available/);
  assert.throws(() => R.close(m));
});

test('wrong answer opens a steal; steal awards the other side', () => {
  let m = R.judge(R.open(match({ steal: 'full', penalty: 'none' }), 1, 3), false);
  assert.equal(m.current.stage, 'steal');
  assert.equal(m.current.team, 1);
  m = R.judge(m, true);
  assert.equal(m.sides[1].score, 400);
  assert.equal(m.sides[1].steals, 1);
  assert.equal(m.sides[0].score, 0);
  assert.equal(R.close(m).turn, 1); // الدور يذهب لمن لم يختر
});

test('half steal, penalties, and no steal after reveal', () => {
  let m = R.judge(R.judge(R.open(match({ steal: 'half', penalty: 'half' }), 0, 4), false), true);
  assert.equal(m.sides[0].score, -300);
  assert.equal(m.sides[1].score, 300);
  m = R.judge(R.reveal(R.open(R.close(m), 1, 0)), false);
  assert.equal(m.current.stage, 'resolved');
  m = R.judge(R.open(match({ steal: 'off' }), 0, 0), false);
  assert.equal(m.current.stage, 'resolved');
  assert.equal(m.board[0].cells[0].winner, null);
});

test('match ends when every cell is played; snapshots validate', () => {
  let m = match();
  assert.ok(R.validate(m));
  while (m.phase !== 'done') {
    const ci = m.board.findIndex((c) => c.cells.some((x) => x.status === 'open'));
    const ri = m.board[ci].cells.findIndex((x) => x.status === 'open');
    m = R.close(R.judge(R.open(m, ci, ri), true));
    assert.ok(R.validate(m));
  }
  assert.equal(R.remaining(m), 0);
  assert.equal(m.sides[0].score + m.sides[1].score, 3 * 2 * (200 + 400 + 600));
  assert.notEqual(R.winner(m), undefined);
});

test('snippet start is random but stays inside a safe window', () => {
  const q = { win: [[10, 30], [50, 52]] };
  for (let i = 0; i < 200; i++) {
    const s = R.pickStart(q, 8);
    assert.ok(s >= 10 && s + 8 <= 30, `start ${s} outside window`); // النافذة القصيرة لا تتسع لـ 8 ثوانٍ
  }
  assert.equal(R.pickStart({ start: 7 }, 5), 7);
  // فترة أقصر من المقطع: يُقصَّر المقطع ولا يخرج من الفترة
  const short = R.pickClip({ win: [[3, 7]] }, 12);
  assert.deepEqual(short, { start: 3, len: 4 });
  assert.deepEqual(R.CLIP_AUTO, [12, 8, 5]);
});

test('media fields are sanitised', () => {
  assert.equal(R.cleanQuestion({ q: 'x', a: 'y', type: 'image', img: 'javascript:alert(1)' }).type, 'text');
  assert.equal(R.cleanQuestion({ q: 'x', a: 'y', type: 'audio', audio: '../secret.wav' }).type, 'text');
  assert.equal(R.cleanQuestion({ q: 'x', a: 'y', type: 'audio', audio: 'assets/media/audio/coin.wav' }).audio, 'assets/media/audio/coin.wav');
  assert.equal(R.cleanQuestion({ q: 'x', a: 'y', type: 'audio', yt: 'NTa6Xbzfq1U' }).type, 'audio');
  assert.equal(R.cleanQuestion({ q: 'x', a: 'y', type: 'video', yt: '"><script>' }).type, 'text');
  assert.equal(R.cleanQuestion({ q: 'x', a: 'y', focus: 'url(evil)' }).focus, undefined);
  assert.deepEqual(R.cleanQuestion({ q: 'x', a: 'y', win: [[5, 3], [1, 9], 'x'] }).win, [[1, 9]]);
});

test('content packs: every category fills a fair board and its media are valid', () => {
  const ctx = vm.createContext({});
  vm.runInContext('var CATEGORIES = [];', ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'gaming-pack.js'), 'utf8'), ctx);
  const cats = vm.runInContext('CATEGORIES', ctx);
  assert.ok(cats.length >= 9);
  for (const c of cats) {
    assert.ok(['gaming', 'anime', 'cartoon'].includes(c.group), `${c.id}: unknown group`);
    assert.ok(R.canFill(c), `${c.id} needs two different questions for each of 200/400/600`);
    for (const q of c.questions) {
      assert.ok([200, 400, 600].includes(q.points), `${c.id}: points must be 200/400/600 (${q.a})`);
      const cq = R.cleanQuestion(q);
      assert.ok(cq, `${c.id}: invalid question ${q.q}`);
      assert.equal(cq.type, q.type || 'text', `${c.id}: media rejected for ${q.a}`);
      for (const f of ['img', 'aImg', 'audio', 'video']) if (q[f] && !q[f].startsWith('https://')) assert.ok(fs.existsSync(path.join(root, q[f])), `missing ${q[f]}`);
      if (q.yt) assert.equal(cq.yt, q.yt, `${c.id}: bad YouTube id ${q.yt}`);
      if (q.win) assert.equal(cq.win.length, q.win.length, `${c.id}: bad window for ${q.a}`);
    }
  }
});
