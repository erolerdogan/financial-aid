/**
 * Whether this build may use the Pro testing switch (Settings → Subscription).
 * True in a development build, and in a release build bundled with `EXPO_PUBLIC_PRO_TESTING=1`.
 * Expo inlines the variable at bundle time, and only in this exact `process.env.NAME` form.
 */
export const PRO_TESTING_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_PRO_TESTING === '1';

/**
 * The account service (Supabase). The URL and the anon key are public values: they identify the project,
 * and what a caller may do is decided on the server. Both empty: the build has no accounts, every
 * account screen is hidden and buying asks for none. See `docs/account.md`.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const AUTH_CONFIGURED = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';

/** Google OAuth client ids. The web one is what the account service checks the token against. */
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
/** iOS only. `app.config.ts` derives the URL scheme of the native project from it. */
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

/** Where "Contact support" (You tab → Help & about) sends its mail. */
export const SUPPORT_EMAIL = 'reeforca@gmail.com';
