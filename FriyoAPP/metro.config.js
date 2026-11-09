const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Local fallback when Watchman stalls; keep the default for other environments.
if (process.env.FRIYO_NO_WATCHMAN === '1') config.resolver.useWatchman = false;
module.exports = config;
