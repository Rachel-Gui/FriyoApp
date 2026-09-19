// Expo SDK 54's Metro supports Buffer input, but also passes file paths to
// image-size v1. The patched v2 parser accepts bytes only. Keep that adapter
// explicit and fail closed if a Metro upgrade changes the expected code.
const fs = require('node:fs');
const path = require('node:path');
const target = path.join(path.dirname(require.resolve('metro/package.json')), 'src/Assets.js');
const old = 'const dimensions = isImage ? (0, _imageSize.default)(isImageInput) : null;';
const replacement = 'const dimensions = isImage ? (0, _imageSize.default)(typeof isImageInput === "string" ? _fs.default.readFileSync(isImageInput) : isImageInput) : null;';
const source = fs.readFileSync(target, 'utf8');
if (source.includes(old)) fs.writeFileSync(target, source.replace(old, replacement));
else if (!source.includes(replacement)) throw new Error('Metro image parser adapter requires review after dependency upgrade');
console.log('Metro image parser compatibility verified');
// query-string 7 is part of Expo Router's public URL behavior. Its API remains
// unchanged; normalize the ESM default export of the fixed URI decoder.
const queryTarget = require.resolve('query-string');
const queryOld = "const decodeComponent = require('decode-uri-component');";
const queryNew = "const decodeModule = require('decode-uri-component'); const decodeComponent = typeof decodeModule === 'function' ? decodeModule : decodeModule.default;";
const querySource = fs.readFileSync(queryTarget, 'utf8');
if (querySource.includes(queryOld)) fs.writeFileSync(queryTarget, querySource.replace(queryOld, queryNew));
else if (!querySource.includes(queryNew)) throw new Error('Query-string decoder adapter requires review after dependency upgrade');
console.log('Query-string decoder compatibility verified');
