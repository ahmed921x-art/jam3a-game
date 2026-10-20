const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const R = require('../match-logic.js');

// مقاطع ثبت أن YouTube يرفض تشغيلها داخل اللعبة (خطأ 150) مع أن oEmbed يقبلها — لا تُعاد إضافتها
const EMBED_BLOCKED = ['spLV1gF0fkI', 'M766FGsv5do', 'zhEWqfP6V_w', '91eoGiLSCgY', 'PYD42JzyuzI', 'fXVWZS76QyE', 'NBDAna_qxY8', 'wnfiXhNVudk', 'PHjukOhzFLE', 'gbkgbbKZ1CA', 'NpXbckymq5E', 'KvSiRNO1BTY', '0i-gsQJg7jc', 'HbE96IMB9Vw', 'IipmpVcISXE', 'f5Iph5tGRz0', 'kL0IkvLrQLM', 'rFgLU123HTE'];

test('song video pack contains only distinct, playable video questions', () => {
  const context = vm.createContext({ CATEGORIES: [] });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'video-pack.js'), 'utf8'), context);
  assert.deepEqual(context.CATEGORIES.map((c) => c.id), ['video-songs']);
  assert.ok(context.CATEGORIES.every((c) => c.questions.length === 18));
  const videos = context.CATEGORIES.flatMap((c) => c.questions);
  assert.equal(new Set(videos.map((q) => q.yt)).size, videos.length);
  assert.equal(new Set(videos.map((q) => q.q)).size, videos.length);
  assert.ok(videos.every((q) => q.type === 'video' && /^[\w-]{11}$/.test(q.yt) && R.cleanQuestion(q)?.type === 'video'));
  assert.ok(context.CATEGORIES.every(R.canFill));
  assert.deepEqual(videos.filter((q) => EMBED_BLOCKED.includes(q.yt)).map((q) => q.yt), []);
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

test('no published question uses a clip that YouTube blocks from embedding', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\s+src="([^"?]+\.js)"/g)].map((m) => m[1]).filter((n) => /^(questions|gaming-pack|video-pack|expansion-pack)/.test(n));
  const context = vm.createContext({});
  for (const s of scripts) vm.runInContext(fs.readFileSync(path.join(root, s), 'utf8'), context);
  const used = vm.runInContext('CATEGORIES', context).flatMap((c) => c.questions.map((q) => q.yt).filter(Boolean));
  const blocked = used.filter((id) => EMBED_BLOCKED.includes(id));
  assert.equal(blocked.length, 0, `blocked clips still published: ${blocked.join(", ")}`);
});
