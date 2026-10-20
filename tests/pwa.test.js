const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('offline shell includes every local script, stylesheet and install icon', () => {
  const context = vm.createContext({ self: { addEventListener() {} } });
  vm.runInContext(read('sw.js'), context);
  const assets = new Set(vm.runInContext('ASSETS', context).map((p) => p.replace(/^\.\//, '')));
  const html = read('index.html');
  const linked = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1]).filter((src) => !/^(?:https?:|data:|#)/.test(src));
  const manifest = JSON.parse(read('manifest.json'));
  linked.push(...manifest.icons.map((icon) => icon.src));
  for (const file of linked) {
    assert.ok(fs.existsSync(path.join(root, file)), `missing published asset: ${file}`);
    assert.ok(assets.has(file), `asset omitted from offline cache: ${file}`);
  }
  for (const file of assets) {
    if (file) assert.ok(fs.existsSync(path.join(root, file)), `offline cache references a missing file: ${file}`);
  }
});
