const { URL } = require('node:url');
const { expo } = require('./app.json');
const errors = [];
const fs = require('node:fs');
const path = require('node:path');
for (const file of ['.env.local', '.env']) {
  const target = path.join(__dirname, file);
  if (fs.existsSync(target)) process.loadEnvFile(target);
}
const icon = fs.readFileSync(path.resolve(__dirname, expo.icon));
if (icon.toString('hex', 0, 8) !== '89504e470d0a1a0a' || icon.readUInt32BE(16) !== 1024 || icon.readUInt32BE(20) !== 1024 || icon[25] !== 2) errors.push('App icon must be a 1024×1024 opaque RGB PNG');
for (const name of ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'EXPO_PUBLIC_SUPPORT_EMAIL', 'EXPO_PUBLIC_PRIVACY_URL']) {
  if (!process.env[name] || /YOUR_|placeholder/i.test(process.env[name])) errors.push(`${name} is required`);
}
for (const name of ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_PRIVACY_URL']) {
  try { const url = new URL(process.env[name]); if (url.protocol !== 'https:' || /localhost|127\.0\.0\.1/.test(url.hostname)) throw Error(); }
  catch { errors.push(`${name} must be a public HTTPS URL`); }
}
if (process.env.EXPO_PUBLIC_API_URL && !/\/api\/v1\/?$/.test(process.env.EXPO_PUBLIC_API_URL)) errors.push('API URL must end with /api/v1');
for (const name of ['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID']) {
  if (!process.env[name]?.endsWith('.apps.googleusercontent.com')) errors.push(`${name} must be a Google OAuth client ID`);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.EXPO_PUBLIC_SUPPORT_EMAIL || '')) errors.push('Support email must be valid');
if (!expo.extra?.eas?.projectId || !expo.ios?.bundleIdentifier) errors.push('EAS project and iOS bundle ID are required');
if (errors.length) { console.error('Release configuration is incomplete:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log('Release configuration checks passed. Credentials and device flows still require verification.');
