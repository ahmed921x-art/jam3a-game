const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const R = require('../match-logic.js');

// يحمّل ملفات الأسئلة + catalog.js في سياق معزول، مع نسخة محلية محفوظة (كأنها من Firestore)
function loadCatalog(cached) {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const packs = [...html.matchAll(/<script\s+src="([^"?]+\.js)"/g)].map((m) => m[1]).filter((n) => /^(questions|gaming-pack|video-pack|expansion-pack)/.test(n));
  const store = { bio_catalog_v1: JSON.stringify(cached) };
  const context = vm.createContext({
    localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = v) },
    document: { addEventListener() {} },
  });
  for (const f of packs) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), context, { filename: f });
  vm.runInContext(fs.readFileSync(path.join(root, 'catalog.js'), 'utf8'), context, { filename: 'catalog.js' });
  return vm.runInContext('CATEGORIES', context);
}

test('an admin-edited built-in category replaces the original in place', () => {
  const before = loadCatalog({ cats: [], hidden: [], images: {} });
  const idx = before.findIndex((c) => c.id === 'g-trivia');
  const orig = before[idx];
  const questions = orig.questions.map((q, i) => (i === 0 ? { ...q, a: 'إجابة معدّلة' } : q));
  questions.push({ points: 200, q: 'سؤال جديد من الأدمن؟', a: 'جواب' });
  const after = loadCatalog({ cats: [{ id: 'g-trivia', name: 'ألغاز معدّلة', icon: '🧩', group: 'general', questions }], hidden: [], images: {} });

  assert.equal(after.length, before.length, 'no duplicate category');
  const edited = after.find((c) => c.id === 'g-trivia');
  assert.equal(after.indexOf(edited), idx, 'keeps its place');
  assert.equal(edited.group, orig.group, 'keeps the built-in group (gaming)');
  assert.equal(edited.name, 'ألغاز معدّلة');
  assert.equal(edited.questions.length, orig.questions.length + 1);
  assert.equal(edited.questions[0].a, 'إجابة معدّلة');
  assert.ok(R.canFill(edited));
});

test('an admin category duplicating a built-in name is hidden', () => {
  const before = loadCatalog({ cats: [], hidden: [], images: {} });
  const qs = [200, 200, 400, 400, 600, 600].map((points, i) => ({ points, q: 'سؤال ' + i + '؟', a: 'ج' + i }));
  const after = loadCatalog({ cats: [{ id: 'a_dup', name: 'الكيمياء الحيوية', icon: '⚗️', group: 'bio', questions: qs }], hidden: [], images: {} });
  assert.equal(after.length, before.length);
  assert.equal(after.filter((c) => c.name === 'الكيمياء الحيوية').length, 1);
  assert.equal(after.find((c) => c.name === 'الكيمياء الحيوية').id, 'biochem');
});

test('media fields survive an admin edit of a clip category', () => {
  const base = loadCatalog({ cats: [], hidden: [], images: {} }).find((c) => c.id === 'g-music');
  const questions = base.questions.map((q) => ({ ...q, a: q.a + ' ✓' }));
  const edited = loadCatalog({ cats: [{ id: 'g-music', name: base.name, icon: base.icon, group: 'general', questions }], hidden: [], images: {} }).find((c) => c.id === 'g-music');
  assert.equal(edited.questions.length, base.questions.length, 'shared question text is not treated as duplicate');
  edited.questions.forEach((q, i) => {
    assert.equal(q.yt, base.questions[i].yt);
    assert.equal(q.type, base.questions[i].type);
    assert.deepEqual(JSON.parse(JSON.stringify(q.win)), JSON.parse(JSON.stringify(base.questions[i].win)));
  });
  const board = R.buildBoard([edited], { random: false });
  assert.ok(board[0].cells.every((cell) => cell.q.type === 'audio' && cell.q.yt));
});
