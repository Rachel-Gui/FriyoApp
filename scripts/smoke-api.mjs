import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const base = process.env.FRIYO_API_URL?.replace(/\/$/, '');
if (!base || process.env.FRIYO_SMOKE_STAGING !== 'true') {
  throw new Error('Set FRIYO_API_URL and FRIYO_SMOKE_STAGING=true. This test creates and deletes its own staging account.');
}
let access;
async function request(path, method = 'GET', body, expected = 200) {
  const response = await fetch(`${base}${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, expected, `${method} ${path}: unexpected HTTP status`);
  if (expected === 204) return;
  const json = await response.json(); return json.data ?? json;
}
try {
  const health = await request('/health'); assert.equal(health.status, 'ok');
  const email = `release-${randomBytes(8).toString('hex')}@example.com`;
  const password = randomBytes(24).toString('base64url');
  const auth = await request('/auth/register', 'POST', { email, password, name: 'Release Smoke Test' }, 201);
  access = auth.access_token;
  assert.ok(access && auth.refresh_token);
  const user = await request('/users/me'); assert.equal(user.email, email);
  await request('/users/profile','PATCH',{ onboarding_completed: true });
  const fridge = await request('/fridge/items','POST',{ custom_name: 'Test apple', quantity: 2, unit: 'pcs', storage_type: 'fridge' },201);
  assert.ok(fridge.id);
  await request(`/fridge/items/${fridge.id}`,'PATCH',{ quantity: 1 });
  const items = await request('/fridge'); assert.ok(items.some(i => i.id === fridge.id));
  await request(`/fridge/items/${fridge.id}`,'DELETE',undefined,204);
  const catalog = await request('/recipes?limit=20');
  assert.ok(catalog.items.length, 'Recipe catalog must contain recipes');
  const detail = await request(`/recipes/${catalog.items[0].id}`);
  assert.ok(detail.ingredients.length && detail.steps.length, 'Detail must include ingredients and steps');
  const line = detail.ingredients.find(item => !item.isOptional);
  assert.ok(line, 'Recipe must have a required ingredient');
  const name = line.ingredient?.nameZh || line.displayName || line.ingredient?.name;
  const ingredientItem = await request('/fridge/items', 'POST', { custom_name: name, quantity: 1000, unit: line.unit || 'pcs', storage_type: 'fridge' }, 201);
  const cooking = await request(`/recipes/${detail.id}/for-cooking`);
  assert.ok(cooking.fridge_status.some(item => item.in_fridge), 'Custom-name fridge item must match cooking ingredients');
  const matched = await request('/recipes/recommendations/fridge');
  assert.ok(matched.some(item => item.recipe.id === detail.id && item.fridge_match_ratio > 0), 'Matching recipe must appear in fridge recommendations');
  const search = await request(`/recipes/search?q=${encodeURIComponent(name)}`);
  assert.ok(search.items.some(item => item.id === detail.id), 'Ingredient keyword must find the recipe');
  await request(`/fridge/items/${ingredientItem.id}`, 'DELETE', undefined, 204);
  console.log('PASS: authenticated recipe search, detail, cooking steps and custom-name fridge recommendations');
  const aiStatus = await request('/ai/status');
  assert.equal(aiStatus.local_matching_available, true);
  assert.ok(Array.isArray(aiStatus.configured_providers));
  if (!aiStatus.configured_providers.length || process.env.FRIYO_SMOKE_AI === 'true') {
    const reply = await request('/ai/chat', 'POST', { message: 'What can I cook in 30 minutes?', language: 'en' }, 201);
    assert.ok(['local', 'gemini', 'openai'].includes(reply.response_source));
    assert.ok(reply.suggested_recipes.length, 'Empty fridge must return profile catalog alternatives');
    for (const suggestion of reply.suggested_recipes) {
      const persisted = await request(`/recipes/${suggestion.recipe_id}`);
      assert.ok(persisted.id, 'AI cards must reference durable catalog recipes');
      assert.equal(suggestion.used_ingredients.length, 0, 'Empty fridge must not claim available food');
    }
    console.log(`PASS: AI ${reply.response_source}, empty-fridge alternatives and durable recipe links`);
  }
  await request('/recipes', 'POST', { title: 'Invalid graph test', ingredients: [{ display_name: 'Rice' }], steps: [{ step_number: 1, description: 'Cook rice', parallel_with_step_number: 2 }] }, 400);
  console.log('PASS: authenticated AI status and invalid dependency rejection');
  const refreshed = await request('/auth/refresh','POST',{ refresh_token: auth.refresh_token });
  access = refreshed.access_token; assert.ok(access);
  await request('/auth/refresh','POST',{ refresh_token: auth.refresh_token },401);
  await request('/users/me');
  console.log('PASS: health, registration, profile, inventory CRUD and one-use refresh rotation');
} finally {
  if (access) {
    await request('/users/me','DELETE',{ confirmation: 'DELETE' },204);
    await request('/users/me','GET',undefined,401);
    console.log('PASS: test account deleted and access invalidated');
  }
}
