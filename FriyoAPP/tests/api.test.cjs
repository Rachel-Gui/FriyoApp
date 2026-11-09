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
  vm.runInNewContext(code, { module, exports: module.exports, require: () => ({ tokenStorage: secure }), fetch, process: { env: {} }, setTimeout, clearTimeout });
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

test('recipe recommendations unwrap ranked results and preserve cover images', async () => {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/recipeService.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const calls = [];
  const api = { get: async url => { calls.push(url); return url.includes('/recommendations/fridge') ? [{ recipe: { id: 'recipe', title: 'Soup', coverImageUrl: 'https://example.com/soup.jpg' }, finalScore: 95 }] : { items: [{ id: 'recipe', title: 'Soup' }], total: 1, pages: 1 }; } };
  vm.runInNewContext(code, { module, exports: module.exports, require: () => api, URLSearchParams });
  const service = module.exports.recipeService;
  const items = await service.getRecommendationsByFridge();
  assert.equal(items[0].id, 'recipe'); assert.equal(items[0].imageUrl, 'https://example.com/soup.jpg');
  await service.searchRecipes({ q: 'rice & beans', page: 2, limit: 30 });
  assert.match(calls[1], /q=rice\+%26\+beans/); assert.match(calls[1], /page=2/);
});

test('scan confirmation maps AI estimated quantities and storage to valid API fields', async () => {
  const module = { exports: {} }; let payload;
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/fridgeService.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: () => ({ post: async (_url, body) => { payload = body; } }) });
  await module.exports.fridgeService.confirmScan('scan', [{ name: 'Peas', estimatedQuantity: 2, estimatedShelfDays: 7, storageType: 'frozen', unit: 'bags' }]);
  assert.equal(payload.items[0].custom_name, 'Peas'); assert.equal(payload.items[0].quantity, 2); assert.equal(payload.items[0].storage_type, 'freezer'); assert.match(payload.items[0].expiry_date, /^\d{4}-\d{2}-\d{2}$/);
});

test('recipe detail and cooking normalize database ingredient relations and nested fridge status', async () => {
  const module = { exports: {} };
  const recipe = { id: 'r', coverImageUrl: 'cover', ingredients: [{ id: 'i', displayName: '番茄', quantity: 2 }], steps: [{ stepNumber: 2 }, { stepNumber: 1 }] };
  const api = { get: async url => url.includes('for-cooking') ? { recipe, fridgeStatus: [{ ingredient: { name: '番茄', unit: 'g' }, inFridge: true }] } : recipe };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/recipeService.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: () => api, URLSearchParams });
  const detail = await module.exports.recipeService.getRecipeDetail('r');
  assert.equal(detail.ingredients[0].ingredientName, '番茄');
  assert.equal(detail.steps[0].stepNumber, 1);
  const cooking = await module.exports.recipeService.getRecipeForCooking('r');
  assert.equal(cooking.fridgeStatus[0].ingredientName, '番茄');
  assert.equal(cooking.fridgeStatus[0].inFridge, true);
  assert.equal(cooking.recipe.imageUrl, 'cover');
});

test('AI sends only unchecked, bounded shopping context after consent', async () => {
  const module = { exports: {} }; const calls = [];
  const shoppingList = Array.from({ length: 60 }, (_, i) => ({ name: `Item ${i}`, quantity: 2, unit: 'pcs', checked: i === 0, id: 'private', recipeTitle: 'not needed' }));
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/aiService.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let consent = true; let reads = 0;
  const imports = {
    '@/store/languageStore': { useLanguageStore: { getState: () => ({ language: 'en' }) } },
    './shoppingListService': { shoppingListService: { getItems: async () => { reads++; return shoppingList; } } },
    './aiConsentService': { aiConsentService: { requestConsent: async () => consent } },
    './api': { post: async (url, body) => { calls.push({ url, body }); return {}; } },
  };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => imports[name] });
  await module.exports.aiService.sendMessage('Dinner?', 'conversation');
  assert.equal(calls[0].body.shoppingList.length, 50); assert.equal(calls[0].body.shoppingList[0].name, 'Item 1');
  assert.deepEqual(Object.keys(calls[0].body.shoppingList[0]).sort(), ['name','quantity','unit']);
  consent = false; await assert.rejects(module.exports.aiService.sendMessage('Dinner?'), /permission/);
  assert.equal(reads, 1); assert.equal(calls.length, 1);
});
