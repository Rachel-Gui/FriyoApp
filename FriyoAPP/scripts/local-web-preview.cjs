// Build a local preview outside the slow dependency directory while keeping
// application source in the workspace. Native/EAS build commands are unchanged.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync, spawn } = require('node:child_process');
const source = path.resolve(__dirname, '..');
const suffix = crypto.createHash('sha256').update(source).digest('hex').slice(0, 12);
const target = path.join(os.tmpdir(), `friyo-web-${suffix}`);
fs.mkdirSync(target, { recursive: true });
for (const name of ['app', 'assets', 'menu', 'components', 'constants', 'services', 'store', 'hooks', 'types', 'utils', 'data', 'scripts', 'tests']) {
  const input = path.join(source, name);
  if (!fs.existsSync(input)) continue;
  const output = path.join(target, name);
  fs.rmSync(output, { recursive: true, force: true });
  fs.cpSync(input, output, { recursive: true });
}
for (const name of ['package.json', 'package-lock.json', 'app.json', 'app.config.js', 'babel.config.js', 'metro.config.js', 'tsconfig.json', 'expo-env.d.ts', '.env.local']) {
  const input = path.join(source, name);
  if (fs.existsSync(input)) fs.copyFileSync(input, path.join(target, name));
}
const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(source, 'package-lock.json'))).digest('hex');
const marker = path.join(target, '.dependency-lock');
const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { cwd: target, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};
if (!fs.existsSync(path.join(target, 'node_modules', 'expo', 'bin', 'cli')) || !fs.existsSync(marker) || fs.readFileSync(marker, 'utf8') !== hash) {
  run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', path.join(os.tmpdir(), 'friyo-preview-npm-cache')]);
  run(process.execPath, ['scripts/patch-metro.cjs']);
  fs.writeFileSync(marker, hash);
}
console.log('Friyo preview: http://localhost:8082');
const child = spawn(process.execPath, ['node_modules/expo/bin/cli', 'start', '--web', '--localhost', '--port', '8082', '--max-workers', '2', '--clear'], {
  cwd: target, stdio: 'inherit', env: { ...process.env, BROWSER: 'none', FRIYO_NO_WATCHMAN: '1', EXPO_NO_TELEMETRY: '1' },
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code || 0; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
