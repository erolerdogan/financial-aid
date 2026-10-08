import { scryptAsync } from '@noble/hashes/scrypt';

/** The app passcode is always this many digits. */
export const PASSCODE_LENGTH = 6;
export const SALT_LENGTH = 16;

const RECORD_VERSION = 1;
const HASH_LENGTH = 32;
// Low on purpose: a six-digit code can be tried exhaustively at any cost, so a high cost would only slow the unlock.
const DEFAULT_LOG_N = 10;
const MAX_LOG_N = 15;

/** Wrong tries allowed before the first wait. */
export const FREE_ATTEMPTS = 4;
// Wait after the 5th, 6th, 7th and every later wrong try, in seconds.
const LOCKOUT_STEPS = [60, 300, 900, 3600] as const;

/**
 * What is kept on the device: the salted scrypt hash of the passcode, never the passcode,
 * plus the wrong tries so far, so closing the app does not reset the wait.
 */
export interface PasscodeRecord {
  version: number;
  logN: number;
  /** Hex. */
  salt: string;
  /** Hex. */
  hash: string;
  failedAttempts: number;
  /** Epoch milliseconds until which no try is accepted, or null. */
  lockedUntil: number | null;
}

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

const fromHex = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
};

const isHex = (value: unknown, bytes: number): value is string =>
  typeof value === 'string' && value.length === bytes * 2 && /^[0-9a-f]+$/.test(value);

export const isValidPasscode = (code: string): boolean => new RegExp(`^\\d{${PASSCODE_LENGTH}}$`).test(code);

const hashPasscode = (code: string, salt: Uint8Array, logN: number): Promise<Uint8Array> =>
  scryptAsync(code, salt, { N: 2 ** logN, r: 8, p: 1, dkLen: HASH_LENGTH });

/** `salt` is `SALT_LENGTH` random bytes from the caller (this module stays free of native code). */
export async function createPasscodeRecord(code: string, salt: Uint8Array): Promise<PasscodeRecord> {
  if (!isValidPasscode(code) || salt.length !== SALT_LENGTH) throw new Error('Invalid passcode');
  return {
    version: RECORD_VERSION,
    logN: DEFAULT_LOG_N,
    salt: toHex(salt),
    hash: toHex(await hashPasscode(code, salt, DEFAULT_LOG_N)),
    failedAttempts: 0,
    lockedUntil: null,
  };
}

export async function verifyPasscode(record: PasscodeRecord, code: string): Promise<boolean> {
  if (!isValidPasscode(code)) return false;
  const expected = fromHex(record.hash);
  const actual = await hashPasscode(code, fromHex(record.salt), record.logN);
  // No early exit, so the time taken does not show how many bytes matched.
  let difference = expected.length ^ actual.length;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ (expected[i] ?? 0);
  return difference === 0;
}

/** Returns null for anything that is not a usable record. */
export function parsePasscodeRecord(text: string): PasscodeRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const { version, logN, salt, hash, failedAttempts, lockedUntil } = parsed as Record<string, unknown>;
  if (version !== RECORD_VERSION) return null;
  if (typeof logN !== 'number' || !Number.isInteger(logN) || logN < 1 || logN > MAX_LOG_N) return null;
  if (!isHex(salt, SALT_LENGTH) || !isHex(hash, HASH_LENGTH)) return null;

  return {
    version,
    logN,
    salt,
    hash,
    failedAttempts:
      typeof failedAttempts === 'number' && Number.isInteger(failedAttempts) && failedAttempts > 0 ? failedAttempts : 0,
    lockedUntil: typeof lockedUntil === 'number' && Number.isFinite(lockedUntil) ? lockedUntil : null,
  };
}

/** Seconds to wait after the given number of wrong tries in a row. */
export function lockoutSeconds(failedAttempts: number): number {
  if (failedAttempts <= FREE_ATTEMPTS) return 0;
  return LOCKOUT_STEPS[Math.min(failedAttempts - FREE_ATTEMPTS, LOCKOUT_STEPS.length) - 1];
}

export function registerFailure(record: PasscodeRecord, now: number): PasscodeRecord {
  const failedAttempts = record.failedAttempts + 1;
  const wait = lockoutSeconds(failedAttempts);
  return { ...record, failedAttempts, lockedUntil: wait > 0 ? now + wait * 1000 : null };
}

export const registerSuccess = (record: PasscodeRecord): PasscodeRecord =>
  record.failedAttempts === 0 && record.lockedUntil === null
    ? record
    : { ...record, failedAttempts: 0, lockedUntil: null };

/** Seconds left before the next try is accepted; 0 when a try is allowed now. */
export function remainingLockSeconds(record: PasscodeRecord, now: number): number {
  if (record.lockedUntil === null) return 0;
  const longest = LOCKOUT_STEPS[LOCKOUT_STEPS.length - 1];
  // A clock that was set back must not stretch the wait beyond the longest step.
  return Math.min(Math.max(0, Math.ceil((record.lockedUntil - now) / 1000)), longest);
}
