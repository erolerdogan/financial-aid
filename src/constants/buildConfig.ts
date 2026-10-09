/**
 * Whether this build may use the Pro testing switch (Settings → Subscription).
 * True in a development build, and in a release build bundled with `EXPO_PUBLIC_PRO_TESTING=1`.
 * Expo inlines the variable at bundle time, and only in this exact `process.env.NAME` form.
 */
export const PRO_TESTING_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_PRO_TESTING === '1';
