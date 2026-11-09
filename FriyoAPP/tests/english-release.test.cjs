const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
test('English-only release ignores previous Chinese preference and cannot enable Chinese', () => {
  const source = fs.readFileSync(path.join(__dirname, '../store/languageStore.ts'), 'utf8');
  const exports = {};
  let state;
  const create = () => initialize => {
    state = initialize(patch => { state = { ...state, ...patch }; });
    return { getState: () => state };
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports,
    require: name => {
      assert.equal(name, 'zustand', 'English release must not hydrate old language preferences');
      return { create };
    },
  });
  assert.equal(exports.useLanguageStore.getState().language, 'en');
  exports.useLanguageStore.getState().setLanguage('zh');
  assert.equal(exports.useLanguageStore.getState().language, 'en');
});
