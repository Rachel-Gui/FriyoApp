const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');

function client(fetch) {
  const values = new Map([['friyo_access_token', 'old'], ['friyo_refresh_token', 'refresh']]);
  const secure = { getItemAsync: async k => values.get(k), setItemAsync: async (k,v) => { assert.equal(typeof v, 'string'); values.set(k,v); }, deleteItemAsync: async k => values.delete(k) };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/api.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: () => secure, fetch, process: { env: {} }, setTimeout, clearTimeout });
  return { api: module.exports, values };
}
const response = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

test('unwraps backend envelope and converts nested fields', async () => {
  const { api } = client(async () => response(200, { success: true, data: { avatar_url: 'image', saved_recipes: [{ recipe_id: '1' }] } }));
  const result = await api.get('/users/me');
  assert.equal(result.avatarUrl, 'image'); assert.equal(result.savedRecipes[0].recipeId, '1');
});
test('concurrent expired requests share one refresh and persist rotated token pair', async () => {
  let refreshes = 0;
  const { api, values } = client(async (url, opts) => {
    if (url.endsWith('/auth/refresh')) { refreshes++; await new Promise(r => setTimeout(r, 5)); return response(200, { success: true, data: { access_token: 'new', refresh_token: 'rotated' } }); }
    return opts.headers.Authorization === 'Bearer new' ? response(200, { success: true, data: 'ok' }) : response(401, {});
  });
  assert.deepEqual(await Promise.all([api.get('/a'), api.get('/b')]), ['ok','ok']);
  assert.equal(refreshes, 1); assert.equal(values.get('friyo_refresh_token'), 'rotated');
});
test('revoked refresh token clears credentials and signals sign-out', async () => {
  const { api, values } = client(async () => response(401, {}));
  let expired = false; api.setSessionExpiredHandler(() => { expired = true; });
  await assert.rejects(api.get('/a')); assert.equal(values.size, 0); assert.equal(expired, true);
});
test('malformed refresh payload does not persist undefined credentials', async () => {
  const { api, values } = client(async url => response(url.endsWith('/auth/refresh') ? 200 : 401, { success: true, data: {} }));
  await assert.rejects(api.get('/a')); assert.equal(values.get('friyo_access_token'), 'old');
});
test('public login errors do not attempt token refresh', async () => {
  let calls = 0; const { api } = client(async () => { calls++; return response(401, { message: ['Invalid credentials'] }); });
  await assert.rejects(api.post('/auth/login', {}, { public: true }), /Invalid credentials/); assert.equal(calls, 1);
});

test('fridge edits and deductions match server snake_case DTOs', async () => {
  const calls = [];
  const apiMock = Object.fromEntries(['get','post','patch','del','postForm'].map(method => [method, async (url, body) => calls.push({ method, url, body })]));
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/fridgeService.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: () => apiMock });
  const service = module.exports.fridgeService;
  await service.updateItem('id', { customName: 'Milk', storageType: 'fridge', expiryDate: null });
  assert.equal(JSON.stringify(calls[0].body), JSON.stringify({ custom_name: 'Milk', storage_type: 'fridge', expiry_date: null }));
  await service.deductIngredients('recipe', 2);
  assert.equal(calls[1].body.recipe_id, 'recipe'); assert.equal(calls[1].body.servings_used, 2);
});

test('temporary refresh outage retains credentials and does not signal session expiry', async () => {
  const { api, values } = client(async url => response(url.endsWith('/auth/refresh') ? 503 : 401, {}));
  let expired = false; api.setSessionExpiredHandler(() => { expired = true; });
  await assert.rejects(api.get('/a'), error => error.status === 503);
  assert.equal(expired, false); assert.equal(values.get('friyo_refresh_token'), 'refresh');
});

test('patched URL decoder preserves Expo Router query parsing, including malformed input', () => {
  const query = require('query-string');
  const parsed = query.parse('name=Friyo%20App&tag=a&tag=b');
  assert.equal(parsed.name, 'Friyo App'); assert.deepEqual(parsed.tag, ['a', 'b']);
  assert.equal(query.parse('text=%E0%A4%A').text, '%E0%A4%A');
});
