import type { ConfigContext, ExpoConfig } from 'expo/config';

// `app.json` stays the config. This file adds the one part that depends on a value outside the
// repository: Google sign-in on iOS needs the reversed iOS client id as a URL scheme, and its plugin
// refuses to run without it. No client id: the plugin is left out and the app has no Google button.
const GOOGLE_CLIENT_SUFFIX = '.apps.googleusercontent.com';

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
  if (!iosClientId.endsWith(GOOGLE_CLIENT_SUFFIX)) return base;
  const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.slice(0, -GOOGLE_CLIENT_SUFFIX.length)}`;
  return {
    ...base,
    plugins: [...(base.plugins ?? []), ['@react-native-google-signin/google-signin', { iosUrlScheme }]],
  };
};
