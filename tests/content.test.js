const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\s+src="(questions[^"?]*\.js)"/g)].map((match) => match[1]);

test('published question scripts provide unique complete categories', () => {
  assert.ok(scripts.length >= 4, 'all question packs must be referenced by index.html');
  const context = vm.createContext({});
  for (const file of scripts) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  const categories = vm.runInContext('CATEGORIES', context);
  assert.ok(categories.length >= 46);
  const ids = new Set();
  const prompts = new Set();
  for (const category of categories) {
    assert.ok(category.id && !ids.has(category.id), `duplicate or missing category id: ${category.id}`);
    ids.add(category.id);
    for (const points of [200, 400, 600]) {
      const tier = category.questions.filter((question) => question.points === points);
      assert.ok(tier.length >= 2, `${category.id} needs two ${points}-point questions`);
      for (const question of tier) {
        assert.ok(question.q?.trim() && question.a?.trim(), `${category.id} has an empty question or answer`);
        const key = question.q.trim().normalize('NFKC').replace(/\s+/g, ' ').toLowerCase();
        assert.ok(!prompts.has(key), `duplicate question: ${question.q}`);
        prompts.add(key);
      }
    }
  }
});
