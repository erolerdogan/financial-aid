import { scryptAsync } from '@noble/hashes/scrypt';

export type BackupErrorCode = 'NOT_BACKUP' | 'DAMAGED' | 'NEWER_VERSION' | 'WRONG_PASSWORD';

export class BackupError extends Error {
  code: BackupErrorCode;

  constructor(code: BackupErrorCode) {
    super(code);
    this.code = code;
  }
}

/**
 * Password-protected backup: a fixed header followed by the AES-256-GCM ciphertext and its tag.
 *
 *   magic (8) | version (1) | kdf (1) | logN (1) | r (1) | p (1) | salt (16) | nonce (12) | ciphertext | tag (16)
 *
 * The whole header is the GCM additional data, so changing any parameter fails authentication.
 */
export interface BackupHeader {
  logN: number;
  r: number;
  p: number;
  salt: Uint8Array;
  nonce: Uint8Array;
}

const MAGIC = 'FAIDBKP1';
const FORMAT_VERSION = 1;
const KDF_SCRYPT = 1;

export const SALT_LENGTH = 16;
export const NONCE_LENGTH = 12;
export const TAG_LENGTH = 16;
export const KEY_LENGTH = 32;
export const HEADER_LENGTH = MAGIC.length + 5 + SALT_LENGTH + NONCE_LENGTH;
export const MIN_PASSWORD_LENGTH = 8;

/** Cost for new backups. Restore reads the cost from the file, so this can change later. */
export const DEFAULT_KDF = { logN: 15, r: 8, p: 1 } as const;

// Upper bounds for a cost read from a file: beyond these the derivation would exhaust a phone's memory.
const MAX_LOG_N = 18;
const MAX_R = 16;
const MAX_P = 4;

export function isEncryptedBackup(bytes: Uint8Array): boolean {
  if (bytes.length < MAGIC.length) return false;
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC.charCodeAt(i)) return false;
  }
  return true;
}

export function encodeHeader(header: BackupHeader): Uint8Array {
  if (header.salt.length !== SALT_LENGTH || header.nonce.length !== NONCE_LENGTH) {
    throw new Error('Invalid backup header');
  }
  const bytes = new Uint8Array(HEADER_LENGTH);
  let offset = 0;
  for (; offset < MAGIC.length; offset++) bytes[offset] = MAGIC.charCodeAt(offset);
  bytes[offset++] = FORMAT_VERSION;
  bytes[offset++] = KDF_SCRYPT;
  bytes[offset++] = header.logN;
  bytes[offset++] = header.r;
  bytes[offset++] = header.p;
  bytes.set(header.salt, offset);
  bytes.set(header.nonce, offset + SALT_LENGTH);
  return bytes;
}

/** Returns null when the bytes are not a password-protected backup. */
export function parseHeader(bytes: Uint8Array): BackupHeader | null {
  if (!isEncryptedBackup(bytes)) return null;
  if (bytes.length < MAGIC.length + 2) throw new BackupError('DAMAGED');

  let offset = MAGIC.length;
  if (bytes[offset++] !== FORMAT_VERSION || bytes[offset++] !== KDF_SCRYPT) throw new BackupError('NEWER_VERSION');
  if (bytes.length < HEADER_LENGTH + TAG_LENGTH) throw new BackupError('DAMAGED');

  const logN = bytes[offset++];
  const r = bytes[offset++];
  const p = bytes[offset++];
  if (logN < 1 || logN > MAX_LOG_N || r < 1 || r > MAX_R || p < 1 || p > MAX_P) throw new BackupError('DAMAGED');

  return {
    logN,
    r,
    p,
    salt: bytes.slice(offset, offset + SALT_LENGTH),
    nonce: bytes.slice(offset + SALT_LENGTH, offset + SALT_LENGTH + NONCE_LENGTH),
  };
}

/** Ciphertext with its tag: everything after the header. */
export function encryptedBody(bytes: Uint8Array): Uint8Array {
  return bytes.subarray(HEADER_LENGTH);
}

export function joinBackup(header: Uint8Array, body: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(header.length + body.length);
  bytes.set(header, 0);
  bytes.set(body, header.length);
  return bytes;
}

/** Password → AES-256 key. Yields to the event loop while it runs, so a spinner keeps turning. */
export async function deriveKey(
  password: string,
  header: Pick<BackupHeader, 'logN' | 'r' | 'p' | 'salt'>
): Promise<Uint8Array> {
  return scryptAsync(password.normalize('NFKC'), header.salt, {
    N: 2 ** header.logN,
    r: header.r,
    p: header.p,
    dkLen: KEY_LENGTH,
  });
}
