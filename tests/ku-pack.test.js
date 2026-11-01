const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const R = require('../match-logic.js');

function load() {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\s+src="([^"?]+\.js)"/g)].map((m) => m[1]).filter((n) => /^(questions|gaming-pack|video-pack|expansion-pack|map-pack|ku-)/.test(n));
  const context = vm.createContext({});
  for (const s of scripts) vm.runInContext(fs.readFileSync(path.join(root, s), 'utf8'), context);
  return vm.runInContext('CATEGORIES', context);
}

test('Kuwait University group has playable general, science and map categories', () => {
  const ku = load().filter((c) => c.group === 'ku');
  assert.deepEqual(['ku-map', 'ku-science', 'ku-history'].filter((id) => !ku.some((c) => c.id === id)), []);
  for (const c of ku) assert.ok(R.canFill(c), c.id);
  const qs = ku.flatMap((c) => c.questions.filter((q) => q.type !== 'map').map((q) => q.q + '|' + (q.img || '')));
  assert.equal(new Set(qs).size, qs.length);
});

test('campus map labels never show any answer in the category', () => {
  const map = load().find((c) => c.id === 'ku-map');
  for (const q of map.questions) {
    assert.equal(R.cleanQuestion(q).type, 'map', q.a);
    assert.ok(q.labels.length >= 3, `${q.a}: too few nearby names`);
    const words = [...new Set(map.questions.flatMap((x) => x.ban.split(',')))].map((w) => w.trim().toLowerCase());
    for (const [, , name] of q.labels) assert.ok(!words.some((w) => name.toLowerCase().includes(w)), `${q.a}: "${name}"`);
  }
});

test('the Kuwait map no longer repeats the university', () => {
  const map = load().find((c) => c.id === 'kuwait-map');
  assert.ok(!map.questions.some((q) => q.a.includes('جامعة الكويت')));
  assert.ok(R.canFill(map));
});
