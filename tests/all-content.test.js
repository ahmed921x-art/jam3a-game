const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const R = require('../match-logic.js');

test('the published catalog has no repeated question or category across packs', () => {
  const root = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\s+src="([^"?]+\.js)"/g)]
    .map((m) => m[1]).filter((name) => /^(questions|gaming-pack|video-pack|expansion-pack)/.test(name));
  const context = vm.createContext({});
  for (const script of scripts) vm.runInContext(fs.readFileSync(path.join(root, script), 'utf8'), context, { filename: script });
  const categories = vm.runInContext('CATEGORIES', context);
  assert.ok(categories.length >= 73);
  assert.ok(categories.reduce((n, c) => n + c.questions.length, 0) >= 1050);
  const ids = new Set();
  const questions = new Set();
  for (const cat of categories) {
    assert.ok(cat.id && !ids.has(cat.id), `duplicate category: ${cat.id}`);
    ids.add(cat.id);
    assert.ok(R.canFill(cat), `incomplete category: ${cat.id}`);
    for (const points of [200, 400, 600]) assert.ok(cat.questions.filter((q) => q.points === points).length >= 4, `thin ${points} tier: ${cat.id}`);
    for (const raw of cat.questions) {
      const q = R.cleanQuestion(raw);
      assert.ok(q, `invalid question in ${cat.id}`);
      const key = q.q.trim().normalize('NFKC').replace(/\s+/g, ' ').toLowerCase() + '|' + (q.img || q.audio || q.video || q.yt || '');
      assert.ok(!questions.has(key), `repeated question in ${cat.id}: ${q.q}`);
      questions.add(key);
    }
    const identity = (cell) => cell.q.q.trim().normalize('NFKC').replace(/\s+/g, ' ').toLowerCase() + '|' + (cell.q.img || cell.q.audio || cell.q.video || cell.q.yt || '');
    const first = R.buildBoard([cat], { random: false })[0].cells.map(identity);
    const second = R.buildBoard([cat], { random: false, history: first })[0].cells.map(identity);
    assert.equal(second.filter((key) => first.includes(key)).length, 0, `second match repeated a question in ${cat.id}`);
  }
});
