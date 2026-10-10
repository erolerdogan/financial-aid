import { AUTH_CONFIGURED, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/constants/buildConfig';
import { authStorage } from '@/services/authStorage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// The account service. Used for the account only (`src/services/auth.ts`): the app has no tables
// there and never sends anything from the database. See `docs/account.md`.

/** Under this key the session is stored (`authStorage`); `-code-verifier` is added for an open email link. */
export const AUTH_STORAGE_KEY = 'financial-aid-auth';

let client: SupabaseClient | null | undefined;

/** Null in a build without the account service. Created on first use, so a launch does not pay for it. */
export function getSupabase(): SupabaseClient | null {
  if (client === undefined) {
    client = AUTH_CONFIGURED
      ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            storage: authStorage,
            storageKey: AUTH_STORAGE_KEY,
            persistSession: true,
            autoRefreshToken: true,
            // There is no page URL in an app; the link back is handled in `+native-intent.ts`.
            detectSessionInUrl: false,
            flowType: 'pkce',
          },
        })
      : null;
  }
  return client;
}
