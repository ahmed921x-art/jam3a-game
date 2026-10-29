const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const R = require('../match-logic.js');

test('map questions are sanitized: Kuwait coordinates, clean labels', () => {
  const ok = R.cleanQuestion({ type: 'map', q: 'وين؟', a: 'x', lat: 29.3, lng: 47.9, z: 30, labels: [[29.31, 47.91, 'شارع', 'road'], [1, 2, 'خارج الكويت'], [29.3, 47.9, '<b>', 'evil']] });
  assert.equal(ok.type, 'map');
  assert.equal(ok.z, 18);
  assert.deepEqual(ok.labels, [[29.31, 47.91, 'شارع', 'road'], [29.3, 47.9, '<b>', 'poi']]);
  assert.equal(R.cleanQuestion({ type: 'map', q: 'وين؟', a: 'x', lat: 40, lng: 2 }).type, 'text');
});

test('map places are not reused by other Kuwait categories', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\s+src="([^"?]+\.js)"/g)].map((m) => m[1]).filter((n) => /^(questions|gaming-pack|video-pack|expansion-pack|map-pack)/.test(n));
  const context = vm.createContext({});
  for (const s of scripts) vm.runInContext(fs.readFileSync(path.join(root, s), 'utf8'), context);
  const cats = vm.runInContext('CATEGORIES', context);
  const others = cats.filter((c) => c.group === 'kuwait' && c.id !== 'kuwait-map').flatMap((c) => c.questions.map((q) => (q.q + ' ' + q.a).toLowerCase()));
  for (const q of cats.find((c) => c.id === 'kuwait-map').questions) {
    const name = q.a.split(/ \(| —/)[0].trim().toLowerCase();
    const dup = others.find((t) => t.includes(name));
    assert.equal(dup, undefined, `${q.a} is already used: ${dup}`);
  }
});

test('Kuwait map pack never labels the place it asks about', () => {
  const context = vm.createContext({ CATEGORIES: [] });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'map-pack.js'), 'utf8'), context);
  const cat = context.CATEGORIES.find((c) => c.id === 'kuwait-map');
  assert.ok(cat && R.canFill(cat));
  for (const q of cat.questions) {
    assert.equal(R.cleanQuestion(q).type, 'map', q.a);
    assert.ok(q.labels.length >= 3, `${q.a}: too few nearby names`);
    const bans = q.ban.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
    for (const [, , name] of q.labels) {
      const low = name.toLowerCase();
      assert.ok(!bans.some((b) => low.includes(b)), `${q.a}: label "${name}" reveals the answer`);
    }
  }
});
