import { AUTH_CONFIGURED } from '@/constants/buildConfig';
import { authClient } from '@/services/auth';
import { identify, reset } from '@/services/purchases';
import { type AuthResult, type AuthStatus, type AuthUser, createAuthController } from '@/utils/auth';
import React, { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

interface AuthContextType {
  /** The optional account: an id and an email address. Null when signed out. */
  user: AuthUser | null;
  /** `loading` until the stored session is read. Nothing waits for it: the app works signed out. */
  status: AuthStatus;
  /** False in a build without the account service: no account screens, and buying asks for none. */
  available: boolean;
  /** The sign-in link that was opened last did not work. */
  linkFailed: boolean;
  signInWithApple: () => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  /** Sends a sign-in link. The user is signed in once the link is opened on this device. */
  signInWithEmail: (email: string) => Promise<AuthResult>;
  /** This device only. Local data is not touched. */
  signOut: () => Promise<void>;
  /** Deletes the account on the server. Local data is not touched. */
  deleteAccount: () => Promise<AuthResult>;
}

const unavailable = async (): Promise<AuthResult> => 'unavailable';

const AuthContext = createContext<AuthContextType>({
  user: null,
  status: 'signedOut',
  available: false,
  linkFailed: false,
  signInWithApple: unavailable,
  signInWithGoogle: unavailable,
  signInWithEmail: unavailable,
  signOut: async () => {},
  deleteAccount: unavailable,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // The rules are in `src/utils/auth.ts`; this component only connects them to React and to the store.
  const [controller] = useState(() =>
    createAuthController(authClient, {
      onSignedIn: (userId) => {
        identify(userId).catch((error) => console.warn('Purchase identify warning:', error));
      },
      onSignedOut: () => {
        reset().catch((error) => console.warn('Purchase reset warning:', error));
      },
    })
  );

  useEffect(() => controller.start(), [controller]);

  const state = useSyncExternalStore(controller.subscribe, controller.getState);

  const value = useMemo<AuthContextType>(
    () => ({
      user: state.user,
      status: state.status,
      available: AUTH_CONFIGURED,
      linkFailed: state.linkFailed,
      signInWithApple: controller.signInWithApple,
      signInWithGoogle: controller.signInWithGoogle,
      signInWithEmail: controller.signInWithEmail,
      signOut: controller.signOut,
      deleteAccount: controller.deleteAccount,
    }),
    [state, controller]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
