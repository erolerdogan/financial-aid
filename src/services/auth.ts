// The account, as the app talks to the account service (Supabase). Together with `supabase.ts` this is
// the only code that sends anything about the user, and what it sends is the email address or the
// token of Apple or Google. Nothing from the database goes through here. Rules: `src/utils/auth.ts`.

import { AUTH_CONFIGURED, GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '@/constants/buildConfig';
import { authStorage } from '@/services/authStorage';
import { AUTH_STORAGE_KEY, getSupabase } from '@/services/supabase';
import {
  AUTH_CALLBACK_HOST,
  type AuthClient,
  type AuthEvent,
  type AuthResult,
  parseAuthCallback,
  type SignInOutcome,
  userFromSession,
} from '@/utils/auth';
import { FunctionsFetchError, isAuthRetryableFetchError } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { AppState, Platform } from 'react-native';

/** The scheme is the one in `app.json`. The same value is an allowed redirect URL in the Supabase dashboard. */
export const AUTH_REDIRECT_URL = `financial-aid://${AUTH_CALLBACK_HOST}`;

/** The edge function in `supabase/functions/delete-account`. */
const DELETE_FUNCTION = 'delete-account';

/** Google needs its client ids in the build; on iOS also the URL scheme that `app.config.ts` adds. */
export const GOOGLE_SIGN_IN_AVAILABLE =
  AUTH_CONFIGURED && GOOGLE_WEB_CLIENT_ID !== '' && (Platform.OS !== 'ios' || GOOGLE_IOS_CLIENT_ID !== '');

/** Sign in with Apple exists on iOS 13 and later only. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (!AUTH_CONFIGURED || Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

const listeners = new Set<(event: AuthEvent) => void>();

const emit = (event: AuthEvent) => listeners.forEach((listener) => listener(event));

const hasCode = (error: unknown, code: string): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === code;

const failure = (error: unknown): AuthResult => {
  const offline =
    isAuthRetryableFetchError(error) ||
    error instanceof FunctionsFetchError ||
    (error instanceof TypeError && /network/i.test(error.message));
  if (!offline) console.warn('Account request failed:', error);
  return offline ? 'offline' : 'failed';
};

async function signInWithToken(provider: 'apple' | 'google', token: string, nonce?: string): Promise<SignInOutcome> {
  const supabase = getSupabase();
  if (!supabase) return { result: 'unavailable' };
  const { data, error } = await supabase.auth.signInWithIdToken({ provider, token, nonce });
  if (error) return { result: failure(error) };
  const user = userFromSession(data.session);
  return user ? { result: 'success', user } : { result: 'failed' };
}

async function signInWithApple(): Promise<SignInOutcome> {
  if (!(await isAppleSignInAvailable())) return { result: 'unavailable' };
  try {
    // Apple signs the hash into the token; the account service gets the value itself and compares.
    const nonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    // The email only: the account stores no name.
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) return { result: 'failed' };
    return await signInWithToken('apple', credential.identityToken, nonce);
  } catch (error) {
    if (hasCode(error, 'ERR_REQUEST_CANCELED')) return { result: 'cancelled' };
    return { result: failure(error) };
  }
}

let googleConfigured = false;

// Loaded on first use. The package is an ES module, which this tsconfig cannot import statically.
async function loadGoogle() {
  const google = await import('@react-native-google-signin/google-signin');
  if (!googleConfigured) {
    google.GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    });
    googleConfigured = true;
  }
  return google;
}

async function signInWithGoogle(): Promise<SignInOutcome> {
  if (!GOOGLE_SIGN_IN_AVAILABLE) return { result: 'unavailable' };
  let codes: { SIGN_IN_CANCELLED: string; IN_PROGRESS: string; PLAY_SERVICES_NOT_AVAILABLE: string } | null = null;
  try {
    const { GoogleSignin, statusCodes } = await loadGoogle();
    codes = statusCodes;
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') return { result: 'cancelled' };
    if (!response.data.idToken) return { result: 'failed' };
    return await signInWithToken('google', response.data.idToken);
  } catch (error) {
    if (codes) {
      if (hasCode(error, codes.SIGN_IN_CANCELLED) || hasCode(error, codes.IN_PROGRESS)) return { result: 'cancelled' };
      if (hasCode(error, codes.PLAY_SERVICES_NOT_AVAILABLE)) return { result: 'unavailable' };
    }
    return { result: failure(error) };
  }
}

async function sendEmailLink(email: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return 'unavailable';
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: AUTH_REDIRECT_URL, shouldCreateUser: true },
    });
    return error ? failure(error) : 'emailSent';
  } catch (error) {
    return failure(error);
  }
}

/** Forgets the Google account picked last time, so the next sign-in asks again. */
async function forgetGoogleAccount(): Promise<void> {
  if (!GOOGLE_SIGN_IN_AVAILABLE) return;
  try {
    const { GoogleSignin } = await loadGoogle();
    await GoogleSignin.signOut();
  } catch {
    // Nothing was picked.
  }
}

async function signOut(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  // `local`: this device only. The session is removed even when the service cannot be reached.
  const { error } = await supabase.auth.signOut({ scope: 'local' }).catch((caught: unknown) => ({ error: caught }));
  if (error) {
    // An expired session that could not be refreshed offline is left in place by the client.
    await authStorage.removeItem(AUTH_STORAGE_KEY).catch(() => {});
    await authStorage.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`).catch(() => {});
  }
  await forgetGoogleAccount();
}

async function deleteAccount(): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return 'unavailable';
  try {
    // Sent with the user's own session; the function deletes that user and nobody else.
    const { error } = await supabase.functions.invoke(DELETE_FUNCTION, { method: 'POST' });
    if (error) return failure(error);
  } catch (error) {
    return failure(error);
  }
  await signOut();
  return 'success';
}

async function restore() {
  if (!AUTH_CONFIGURED) return null;
  // Straight from the Keychain: asking the client would try to refresh an expired session first,
  // and offline that fails although the user is still signed in.
  const stored = await authStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) return null;
  try {
    return userFromSession(JSON.parse(stored));
  } catch {
    return null;
  }
}

function subscribe(listener: (event: AuthEvent) => void): () => void {
  listeners.add(listener);
  const supabase = getSupabase();
  if (!supabase) {
    return () => {
      listeners.delete(listener);
    };
  }

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    const user = userFromSession(session);
    if (user) emit({ type: 'user', user });
    // No session with any other event (the first one, offline) does not mean signed out.
    else if (event === 'SIGNED_OUT') emit({ type: 'signedOut' });
  });

  // Sessions are renewed only while the app is in front.
  const refresh = (state: string) => {
    if (state === 'active') supabase.auth.startAutoRefresh().catch(() => {});
    else supabase.auth.stopAutoRefresh().catch(() => {});
  };
  refresh(AppState.currentState);
  const appState = AppState.addEventListener('change', refresh);

  return () => {
    listeners.delete(listener);
    data.subscription.unsubscribe();
    appState.remove();
    supabase.auth.stopAutoRefresh().catch(() => {});
  };
}

/**
 * Finishes "sign in by email" with the link that opened the app. False when the link is not that one.
 * Called outside React (`+native-intent.ts`); the result reaches the app as an event.
 */
export function completeAuthLink(url: string): boolean {
  const callback = parseAuthCallback(url);
  if (!callback) return false;
  const supabase = getSupabase();
  if (callback.kind === 'error' || !supabase) {
    emit({ type: 'linkFailed' });
    return true;
  }
  supabase.auth
    .exchangeCodeForSession(callback.code)
    .then(({ error }) => {
      if (error) emit({ type: 'linkFailed' });
    })
    .catch(() => emit({ type: 'linkFailed' }));
  return true;
}

export const authClient: AuthClient = {
  restore,
  subscribe,
  signInWithApple,
  signInWithGoogle,
  sendEmailLink,
  signOut,
  deleteAccount,
};
