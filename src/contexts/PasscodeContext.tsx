import { deletePasscodeRecord, readPasscodeRecord, writePasscodeRecord } from '@/services/passcodeStore';
import {
  createPasscodeRecord,
  type PasscodeRecord,
  registerFailure,
  registerSuccess,
  remainingLockSeconds,
  SALT_LENGTH,
  verifyPasscode,
} from '@/utils/passcode';
import { getRandomBytes } from 'expo-crypto';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

/** `waitSeconds` is above 0 when no further try is accepted for that long. */
export type PasscodeAttempt = { ok: true } | { ok: false; waitSeconds: number };

interface PasscodeContextType {
  /** A passcode is set. */
  enabled: boolean;
  /** The passcode has to be entered before anything is shown. */
  locked: boolean;
  /** The app is not in front: hide the content from the app switcher. */
  covered: boolean;
  /** Checks a passcode and counts a wrong try. A right one also unlocks the app. */
  attempt: (code: string) => Promise<PasscodeAttempt>;
  /** Seconds until the next try is accepted, 0 when one is allowed now. */
  waitSeconds: () => number;
  /** Sets or replaces the passcode. Throws when it cannot be saved. */
  setPasscode: (code: string) => Promise<void>;
  removePasscode: () => void;
}

const PasscodeContext = createContext<PasscodeContextType>({
  enabled: false,
  locked: false,
  covered: false,
  attempt: async () => ({ ok: true }),
  waitSeconds: () => 0,
  setPasscode: async () => {},
  removePasscode: () => {},
});

export function PasscodeProvider({ children }: { children: React.ReactNode }) {
  // Read synchronously so the first frame is already locked.
  const [record, setRecord] = useState<PasscodeRecord | null>(readPasscodeRecord);
  const [lockPending, setLockPending] = useState(true);
  const [covered, setCovered] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setCovered(false);
        return;
      }
      // iOS passes through `inactive` before the app switcher takes its picture.
      setCovered(true);
      if (state === 'background') setLockPending(true);
    });
    return () => subscription.remove();
  }, []);

  const attempt = useCallback(
    async (code: string): Promise<PasscodeAttempt> => {
      if (!record) return { ok: true };

      const wait = remainingLockSeconds(record, Date.now());
      if (wait > 0) return { ok: false, waitSeconds: wait };

      const ok = await verifyPasscode(record, code);
      const next = ok ? registerSuccess(record) : registerFailure(record, Date.now());
      if (next !== record) {
        try {
          writePasscodeRecord(next);
        } catch (error) {
          console.warn('Passcode save warning:', error);
        }
        setRecord(next);
      }
      if (!ok) return { ok: false, waitSeconds: remainingLockSeconds(next, Date.now()) };

      setLockPending(false);
      return { ok: true };
    },
    [record]
  );

  const waitSeconds = useCallback(() => (record ? remainingLockSeconds(record, Date.now()) : 0), [record]);

  const setPasscode = useCallback(async (code: string) => {
    const next = await createPasscodeRecord(code, getRandomBytes(SALT_LENGTH));
    writePasscodeRecord(next);
    setRecord(next);
    // Whoever sets it is using the app right now.
    setLockPending(false);
  }, []);

  const removePasscode = useCallback(() => {
    deletePasscodeRecord();
    setRecord(null);
  }, []);

  const value = useMemo<PasscodeContextType>(
    () => ({
      enabled: record !== null,
      locked: record !== null && lockPending,
      covered,
      attempt,
      waitSeconds,
      setPasscode,
      removePasscode,
    }),
    [record, lockPending, covered, attempt, waitSeconds, setPasscode, removePasscode]
  );

  return <PasscodeContext.Provider value={value}>{children}</PasscodeContext.Provider>;
}

export const usePasscode = () => useContext(PasscodeContext);
