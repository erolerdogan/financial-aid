// Loaded before `scripts/perf-db.ts` (tsx --require): native Expo and React Native modules resolve
// to this file, so `src/db/database.ts` and the services can be imported under Node.
const Module = require('node:module');

const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (/^(expo|react-native)(-|\/|$)/.test(request) || request.startsWith('@expo/')) return module.filename;
  return resolveFilename.call(this, request, ...rest);
};

// Any property, call or `new` gives the stub back; `getPrototypeOf` keeps that true for the
// namespace object the bundler builds for `import * as`.
const stub = new Proxy(function () {}, {
  get: (_target, key) => (key === '__esModule' ? true : stub),
  getPrototypeOf: () => stub,
  apply: () => stub,
  construct: () => stub,
});

module.exports = stub;
