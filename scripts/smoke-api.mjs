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
