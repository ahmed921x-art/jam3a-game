const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const R = require('../match-logic.js');

test('song and football packs contain only distinct, playable video questions', () => {
  const context = vm.createContext({ CATEGORIES: [] });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'video-pack.js'), 'utf8'), context);
  assert.deepEqual(context.CATEGORIES.map((c) => c.id), ['video-songs', 'video-football']);
  assert.ok(context.CATEGORIES.every((c) => c.questions.length === 18));
  const videos = context.CATEGORIES.flatMap((c) => c.questions);
  assert.equal(new Set(videos.map((q) => q.yt)).size, videos.length);
  assert.equal(new Set(videos.map((q) => q.q)).size, videos.length);
  assert.ok(videos.every((q) => q.type === 'video' && /^[\w-]{11}$/.test(q.yt) && R.cleanQuestion(q)?.type === 'video'));
  assert.ok(context.CATEGORIES.every(R.canFill));
  for (const c of context.CATEGORIES) {
    const history = [];
    const picked = new Set();
    for (let game = 0; game < 3; game++) {
      const board = R.buildBoard([c], { history });
      for (const cell of board[0].cells) {
        assert.ok(!picked.has(cell.q.yt), `${c.id}: video repeated before its pool was exhausted`);
        picked.add(cell.q.yt);
        history.push(`${cell.q.q.normalize('NFKC').toLowerCase()}|${cell.q.yt}`);
      }
    }
  }
});
