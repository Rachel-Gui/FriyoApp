/** Fail closed on production configuration mistakes without logging secrets. */
export function validateEnvironment(env: Record<string, unknown>) {
  if (env.NODE_ENV !== 'production') return env;
  const missing: string[] = [];
  const text = (key: string) => typeof env[key] === 'string' ? (env[key] as string).trim() : '';
  const required = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'ADMIN_JWT_SECRET',
    'AWS_S3_BUCKET', 'AWS_SES_FROM_EMAIL', 'GOOGLE_CLIENT_IDS', 'APPLE_CLIENT_ID', 'APPLE_TEAM_ID',
    'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY', 'OAUTH_TOKEN_ENCRYPTION_KEY', 'APP_URL', 'ADMIN_URL'];
  for (const key of required) if (!text(key) || /your_|placeholder|NOT_CONFIGURED/i.test(text(key))) missing.push(key);
  const secrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'ADMIN_JWT_SECRET'].map(text);
  if (secrets.some(s => s.length < 32) || new Set(secrets).size !== 3) missing.push('distinct JWT secrets (32+ characters)');
  if (!/^[a-f0-9]{64}$/i.test(text('OAUTH_TOKEN_ENCRYPTION_KEY'))) missing.push('OAUTH_TOKEN_ENCRYPTION_KEY (64 hex characters)');
  if (!text('OPENAI_API_KEY') && !text('GEMINI_API_KEY')) missing.push('OPENAI_API_KEY or GEMINI_API_KEY');
  for (const key of ['APP_URL', 'ADMIN_URL']) {
    try { if (new URL(text(key)).protocol !== 'https:') missing.push(`${key} (HTTPS)`); }
    catch { missing.push(`${key} (valid URL)`); }
  }
  if (missing.length) throw new Error(`Invalid production configuration: ${[...new Set(missing)].join(', ')}`);
  return env;
}
