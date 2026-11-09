const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
function load(storage) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/tokenStorage.web.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, sessionStorage: storage });
  return module.exports.tokenStorage;
}
test('browser tokens roundtrip in tab storage and clear on logout', async () => {
  const values = new Map();
  const store = load({ getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) });
  await store.setItemAsync('access', 'token'); assert.equal(await store.getItemAsync('access'), 'token');
  await store.deleteItemAsync('access'); assert.equal(await store.getItemAsync('access'), null);
});
test('server rendering does not access browser storage', async () => {
  const store = load(undefined);
  assert.equal(await store.getItemAsync('access'), null);
  await store.deleteItemAsync('access');
  await assert.rejects(store.setItemAsync('access', 'token'), /unavailable/);
});
