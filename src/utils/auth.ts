// The account: state and rules without any native or network code, so they can be tested with a fake
// client (`auth.test.ts`). The real client is `src/services/auth.ts`, the React wrapper `AuthContext`.
// The account holds a user id, an email address and a creation date. Nothing else is ever sent.

export type AuthMethod = 'apple' | 'google' | 'email';

export interface AuthUser {
  id: string;
  /** Null when the sign-in provider gave none. */
  email: string | null;
  /** How the account was created. Null for a provider this app does not offer. */
  method: AuthMethod | null;
}

/** `loading` lasts until the stored session is read; nothing in the app waits for it. */
export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export type AuthResult =
  | 'success'
  | 'cancelled'
  /** The sign-in link is on its way; the user becomes signed in when it is opened. */
  | 'emailSent'
  | 'invalidEmail'
  | 'offline'
  /** This build has no account service, or the method does not exist on this device. */
  | 'unavailable'
  | 'failed';

export interface SignInOutcome {
  result: AuthResult;
  /** Given with `success`. */
  user?: AuthUser;
}

export type AuthEvent =
  | { type: 'user'; user: AuthUser }
  | { type: 'signedOut' }
  /** A sign-in link was opened but could not be used (expired, used before, another device). */
  | { type: 'linkFailed' };

/** What the account service must offer. Nothing here throws: a failure is a result. */
export interface AuthClient {
  /** The user of the stored session, read without the network. */
  restore: () => Promise<AuthUser | null>;
  /** Changes that do not come from a call below: a link opened, a session revoked. Returns the unsubscribe. */
  subscribe: (listener: (event: AuthEvent) => void) => () => void;
  signInWithApple: () => Promise<SignInOutcome>;
  signInWithGoogle: () => Promise<SignInOutcome>;
  sendEmailLink: (email: string) => Promise<AuthResult>;
  /** Removes the session from this device. Works offline. */
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<AuthResult>;
}

export interface AuthHooks {
  /** A user is known: at launch with a stored session, and after every sign-in. */
  onSignedIn?: (userId: string) => void;
  /** A signed-in user left: sign-out, deleted account or a revoked session. */
  onSignedOut?: () => void;
}

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  /** The last sign-in link did not work. Cleared by the next sign-in attempt. */
  linkFailed: boolean;
}

export interface AuthController {
  getState: () => AuthState;
  /** Returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** Reads the stored session and starts listening to the client. Returns the stop function. */
  start: () => () => void;
  signInWithApple: () => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signInWithEmail: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<AuthResult>;
}

/** Host of the link that brings the user back: `<scheme>://auth-callback`. */
export const AUTH_CALLBACK_HOST = 'auth-callback';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const isValidEmail = (email: string): boolean => EMAIL_PATTERN.test(normalizeEmail(email));

export function createAuthController(client: AuthClient, hooks: AuthHooks = {}): AuthController {
  let state: AuthState = { status: 'loading', user: null, linkFailed: false };
  const listeners = new Set<() => void>();

  const update = (next: AuthState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };

  const setUser = (user: AuthUser | null) => {
    const previous = state.user;
    if (user === null) {
      if (state.status === 'signedOut') return;
      update({ status: 'signedOut', user: null, linkFailed: state.linkFailed });
      if (previous) hooks.onSignedOut?.();
      return;
    }
    const sameUser = previous?.id === user.id;
    if (sameUser && previous.email === user.email && previous.method === user.method) return;
    update({ status: 'signedIn', user, linkFailed: false });
    if (!sameUser) hooks.onSignedIn?.(user.id);
  };

  const setLinkFailed = (linkFailed: boolean) => {
    if (state.linkFailed !== linkFailed) update({ ...state, linkFailed });
  };

  const signIn = async (attempt: () => Promise<SignInOutcome>): Promise<AuthResult> => {
    setLinkFailed(false);
    const outcome = await attempt();
    if (outcome.result === 'success' && outcome.user) setUser(outcome.user);
    return outcome.result;
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start: () => {
      let stopped = false;
      const unsubscribe = client.subscribe((event) => {
        if (stopped) return;
        if (event.type === 'user') setUser(event.user);
        else if (event.type === 'signedOut') setUser(null);
        else setLinkFailed(true);
      });
      client
        .restore()
        .catch(() => null)
        .then((user) => {
          // Anything that happened meanwhile is newer than what was stored.
          if (stopped || state.status !== 'loading') return;
          setUser(user);
        });
      return () => {
        stopped = true;
        unsubscribe();
      };
    },
    signInWithApple: () => signIn(client.signInWithApple),
    signInWithGoogle: () => signIn(client.signInWithGoogle),
    signInWithEmail: async (email) => {
      if (!isValidEmail(email)) return 'invalidEmail';
      setLinkFailed(false);
      return client.sendEmailLink(normalizeEmail(email));
    },
    signOut: async () => {
      // The user asked to leave: signed out here even when the client could not finish.
      await client.signOut().catch(() => {});
      setUser(null);
    },
    deleteAccount: async () => {
      const result = await client.deleteAccount();
      if (result === 'success') setUser(null);
      return result;
    },
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const METHODS: readonly string[] = ['apple', 'google', 'email'];

/** Reads the user out of a session as the account service stores it. Null when there is none. */
export function userFromSession(session: unknown): AuthUser | null {
  if (!isRecord(session) || !isRecord(session.user)) return null;
  const { id, email, app_metadata: metadata } = session.user;
  if (typeof id !== 'string' || id === '') return null;
  const provider = isRecord(metadata) ? metadata.provider : undefined;
  return {
    id,
    email: typeof email === 'string' && email !== '' ? email : null,
    method: typeof provider === 'string' && METHODS.includes(provider) ? (provider as AuthMethod) : null,
  };
}

export type AuthCallback = { kind: 'code'; code: string } | { kind: 'error'; reason: string };

/** Reads the link that opens the app after "sign in by email". Null for any other link. */
export function parseAuthCallback(url: string): AuthCallback | null {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)[^?#]*(?:\?([^#]*))?(?:#(.*))?$/i.exec(url);
  if (!match || match[1].toLowerCase() !== AUTH_CALLBACK_HOST) return null;
  const params = new Map<string, string>();
  // The service puts an error in the fragment, a code in the query.
  for (const part of `${match[2] ?? ''}&${match[3] ?? ''}`.split('&')) {
    const [name, ...rest] = part.split('=');
    if (!name) continue;
    try {
      params.set(name, decodeURIComponent(rest.join('=').replace(/\+/g, ' ')));
    } catch {
      // A value that is not valid percent-encoding is of no use.
    }
  }
  const code = params.get('code');
  if (code) return { kind: 'code', code };
  return { kind: 'error', reason: params.get('error_code') ?? params.get('error') ?? 'missing_code' };
}

/**
 * Splits a value into parts of at most `size` UTF-16 units. A pair of surrogates stays together, because
 * each part is stored on its own and half a pair is not valid text.
 */
export function chunkValue(value: string, size: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < value.length) {
    let end = Math.min(start + size, value.length);
    const last = value.charCodeAt(end - 1);
    if (end < value.length && last >= 0xd800 && last <= 0xdbff && end - start > 1) end--;
    chunks.push(value.slice(start, end));
    start = end;
  }
  return chunks;
}
