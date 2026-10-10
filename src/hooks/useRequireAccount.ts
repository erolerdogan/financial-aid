import { useAuth } from '@/contexts/AuthContext';
import { useCallback, useRef, useState } from 'react';

// An alert or the store sheet cannot present while the sign-in sheet is still closing.
const SHEET_CLOSE_MS = 300;

/**
 * A purchase belongs to an account. `requireAccount(action)` runs the action when the user is signed
 * in, and otherwise opens the sign-in sheet and runs it after signing in. In a build without the
 * account service it runs the action as it is. Give `sheet` to a `SignInSheet` in the same screen.
 */
export function useRequireAccount() {
  const { user, available } = useAuth();
  const [visible, setVisible] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  const requireAccount = useCallback(
    (action: () => void) => {
      if (!available || user) {
        action();
        return;
      }
      pending.current = action;
      setVisible(true);
    },
    [available, user]
  );

  const onClose = useCallback(() => {
    pending.current = null;
    setVisible(false);
  }, []);

  const onSignedIn = useCallback(() => {
    const action = pending.current;
    pending.current = null;
    setVisible(false);
    if (action) setTimeout(action, SHEET_CLOSE_MS);
  }, []);

  return { requireAccount, sheet: { visible, onClose, onSignedIn } };
}
