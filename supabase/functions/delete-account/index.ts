// Deletes the account of the caller: the purchase customer at RevenueCat, then the user itself.
// Runs on Supabase Edge Functions (Deno), never in the app. The app calls it with the session of the
// signed-in user (`deleteAccount` in `src/services/auth.ts`); whose account goes is read from that
// session, never from the request body. Deploy and secrets: docs/account.md.

import { createClient } from 'npm:@supabase/supabase-js@2';

const REVENUECAT_API = 'https://api.revenuecat.com/v1/subscribers';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

/** True when the customer is gone: deleted now, or never there. */
async function deleteRevenueCatCustomer(userId: string, secretKey: string): Promise<boolean> {
  const response = await fetch(`${REVENUECAT_API}/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!response.ok && response.status !== 404) {
    console.error(`RevenueCat delete failed: ${response.status}`);
    return false;
  }
  return true;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return reply(500, { error: 'not_configured' });

  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, { error: 'unauthorized' });

  // The service role stays on the server. It is used for two things: to check the caller's token
  // and to delete that one user.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error: userError } = await admin.auth.getUser(token);
  const user = data?.user;
  if (userError || !user) return reply(401, { error: 'unauthorized' });

  // Purchases first: when this fails the account is still there, and the user can try again.
  // Without the key (purchases not set up yet) there is no customer to delete.
  const revenueCatKey = Deno.env.get('REVENUECAT_SECRET_KEY');
  if (revenueCatKey) {
    const removed = await deleteRevenueCatCustomer(user.id, revenueCatKey).catch((error) => {
      console.error('RevenueCat delete failed:', error);
      return false;
    });
    if (!removed) return reply(502, { error: 'purchases_not_deleted' });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('User delete failed:', deleteError.message);
    return reply(500, { error: 'user_not_deleted' });
  }

  return reply(200, { deleted: true });
});
