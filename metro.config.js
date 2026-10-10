const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Metro caches each transformed file, and the cache key does not know the values Expo inlined for the
// `process.env.EXPO_PUBLIC_*` variables in `src/constants/buildConfig.ts`. Without this, a build
// reuses the file from the previous build: a production build after a test build would keep the
// Pro testing switch, or the account service of another project. A cache per set of values keeps
// them apart.
const BUILD_VARIABLES = [
  'EXPO_PUBLIC_PRO_TESTING',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
];
config.cacheVersion = `${config.cacheVersion ?? ''}build:${BUILD_VARIABLES.map((name) => process.env[name] ?? '').join('|')}`;

module.exports = config;
