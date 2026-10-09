const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Metro caches each transformed file, and the cache key does not know the value Expo inlined for
// `process.env.EXPO_PUBLIC_PRO_TESTING` (`src/constants/buildConfig.ts`). Without this, a build
// reuses the file from the previous build: a production build after a test build would keep the
// Pro testing switch. A cache per value keeps the two apart.
config.cacheVersion = `${config.cacheVersion ?? ''}pro-testing:${process.env.EXPO_PUBLIC_PRO_TESTING === '1' ? '1' : '0'}`;

module.exports = config;
