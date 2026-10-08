import { getAppMeta, replaceDatabaseContents, setAppMeta } from '@/db/database';
import { saveFile, writeFile } from '@/services/fileSaver';
import {
  BackupError,
  DEFAULT_KDF,
  deriveKey,
  encodeHeader,
  encryptedBody,
  isEncryptedBackup,
  joinBackup,
  NONCE_LENGTH,
  parseHeader,
  SALT_LENGTH,
  TAG_LENGTH,
} from '@/utils/backupFormat';
import { CLASSIFIER_VERSION } from '@/utils/parser';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync, getRandomBytes } from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { deserializeDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

export { BackupError, type BackupErrorCode } from '@/utils/backupFormat';

export interface BackupSummary {
  profiles: number;
  transactions: number;
  firstDate: string | null;
  lastDate: string | null;
}

export interface PendingBackup {
  source: SQLiteDatabase;
  summary: BackupSummary;
  /** When the file was written, if the system reports it. */
  createdAt: Date | null;
}

/** A password-protected backup that has been picked but not opened yet. */
export interface LockedBackup {
  locked: true;
  bytes: Uint8Array;
  createdAt: Date | null;
}

const LAST_BACKUP_KEY = 'lastBackupAt';
const SAFETY_COPY_NAME = 'pre-restore.db';
const SQLITE_MAGIC = 'SQLite format 3\u0000';

const safetyCopyFile = (): File => new File(Paths.document, SAFETY_COPY_NAME);

const pad = (n: number): string => String(n).padStart(2, '0');

/** `YYYY-MM-DD` of today, for file names. */
export const fileDateStamp = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * A WAL-mode header (format version 2) cannot be opened as an in-memory database.
 * The snapshot is complete without the WAL file, so mark it as a plain rollback-journal file.
 */
function normalizeHeader(bytes: Uint8Array): Uint8Array {
  if (bytes.length > 19) {
    if (bytes[18] === 2) bytes[18] = 1;
    if (bytes[19] === 2) bytes[19] = 1;
  }
  return bytes;
}

function isSqliteFile(bytes: Uint8Array): boolean {
  if (bytes.length < 100) return false;
  for (let i = 0; i < SQLITE_MAGIC.length; i++) {
    if (bytes[i] !== SQLITE_MAGIC.charCodeAt(i)) return false;
  }
  return true;
}

async function snapshot(db: SQLiteDatabase): Promise<Uint8Array> {
  await db.getAllAsync(`PRAGMA wal_checkpoint(TRUNCATE);`);
  return normalizeHeader(await db.serializeAsync());
}

async function encrypt(plain: Uint8Array, password: string): Promise<Uint8Array> {
  const salt = getRandomBytes(SALT_LENGTH);
  const nonce = getRandomBytes(NONCE_LENGTH);
  const header = encodeHeader({ ...DEFAULT_KDF, salt, nonce });
  const key = await AESEncryptionKey.import(await deriveKey(password, { ...DEFAULT_KDF, salt }));
  const sealed = await aesEncryptAsync(plain, key, { nonce: { bytes: nonce }, additionalData: header });
  return joinBackup(header, await sealed.ciphertext({ includeTag: true }));
}

async function decrypt(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  const header = parseHeader(bytes);
  if (!header) throw new BackupError('NOT_BACKUP');

  const key = await AESEncryptionKey.import(await deriveKey(password, header));
  const sealed = AESSealedData.fromParts(header.nonce, encryptedBody(bytes), TAG_LENGTH);
  try {
    return await aesDecryptAsync(sealed, key, { additionalData: encodeHeader(header) });
  } catch {
    // Authentication failed: a wrong password and a damaged file look the same.
    throw new BackupError('WRONG_PASSWORD');
  }
}

export async function summarizeDatabase(db: SQLiteDatabase): Promise<BackupSummary> {
  const profiles = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM profiles;`);
  const tx = await db.getFirstAsync<{ count: number; firstDate: string | null; lastDate: string | null }>(
    `SELECT COUNT(*) AS count, MIN(date) AS firstDate, MAX(date) AS lastDate FROM transactions;`
  );
  return {
    profiles: profiles?.count ?? 0,
    transactions: tx?.count ?? 0,
    firstDate: tx?.firstDate ?? null,
    lastDate: tx?.lastDate ?? null,
  };
}

/** Opens the bytes as an in-memory database and checks it is a usable backup. Nothing live is touched. */
async function openBackup(bytes: Uint8Array, createdAt: Date | null): Promise<PendingBackup> {
  if (!isSqliteFile(bytes)) throw new BackupError('NOT_BACKUP');

  let source: SQLiteDatabase;
  try {
    source = await deserializeDatabaseAsync(normalizeHeader(bytes));
  } catch {
    throw new BackupError('DAMAGED');
  }

  try {
    let healthy = false;
    try {
      const check = await source.getFirstAsync<{ integrity_check: string }>(`PRAGMA integrity_check;`);
      healthy = check?.integrity_check === 'ok';
    } catch {
      healthy = false;
    }
    if (!healthy) throw new BackupError('DAMAGED');

    const tables = await source.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('profiles', 'transactions');`
    );
    if (tables.length < 2) throw new BackupError('NOT_BACKUP');

    const version = await source.getFirstAsync<{ user_version: number }>(`PRAGMA user_version;`);
    if ((version?.user_version ?? 0) > CLASSIFIER_VERSION) throw new BackupError('NEWER_VERSION');

    const summary = await summarizeDatabase(source);
    if (summary.profiles === 0) throw new BackupError('NOT_BACKUP');

    return { source, summary, createdAt };
  } catch (error) {
    await source.closeAsync().catch(() => {});
    throw error;
  }
}

/**
 * Writes a snapshot of every profile and hands it to the system; with a password the file is encrypted.
 * Returns false when the user cancelled.
 */
export async function exportBackup(db: SQLiteDatabase, password?: string): Promise<boolean> {
  const plain = await snapshot(db);
  const bytes = password ? await encrypt(plain, password) : plain;
  const name = `financial-aid-${fileDateStamp()}.${password ? 'fabackup' : 'db'}`;

  if (!(await saveFile(name, bytes, 'application/octet-stream'))) return false;

  await setAppMeta(db, LAST_BACKUP_KEY, new Date().toISOString());
  return true;
}

export async function getLastBackupDate(db: SQLiteDatabase): Promise<Date | null> {
  const value = await getAppMeta(db, LAST_BACKUP_KEY);
  return value ? new Date(value) : null;
}

/**
 * Lets the user choose a backup file and validates it. A password-protected file comes back locked,
 * to be opened with `unlockBackup`. Returns null when the picker was cancelled.
 */
export async function pickBackup(): Promise<PendingBackup | LockedBackup | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled || !result.assets || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const file = new File(asset.uri);
  try {
    const bytes = await file.bytes();
    const createdAt = asset.lastModified ? new Date(asset.lastModified) : null;
    if (isEncryptedBackup(bytes)) {
      parseHeader(bytes);
      return { locked: true, bytes, createdAt };
    }
    return await openBackup(bytes, createdAt);
  } finally {
    if (file.exists) file.delete();
  }
}

/** Decrypts a picked backup and validates it like any other. Throws `WRONG_PASSWORD` when it does not open. */
export async function unlockBackup(backup: LockedBackup, password: string): Promise<PendingBackup> {
  return openBackup(await decrypt(backup.bytes, password), backup.createdAt);
}

/** Date of the copy kept by the last restore, or null when there is none. */
export function getSafetyCopyDate(): Date | null {
  const file = safetyCopyFile();
  if (!file.exists) return null;
  return file.modificationTime ? new Date(file.modificationTime) : new Date();
}

export async function openSafetyCopy(): Promise<PendingBackup | null> {
  const file = safetyCopyFile();
  if (!file.exists) return null;
  return openBackup(await file.bytes(), getSafetyCopyDate());
}

/** Keeps a copy of the current data, then replaces everything with the backup. */
export async function applyBackup(db: SQLiteDatabase, backup: PendingBackup): Promise<void> {
  writeFile(safetyCopyFile(), await snapshot(db));
  try {
    await replaceDatabaseContents(db, backup.source);
  } finally {
    await backup.source.closeAsync().catch(() => {});
  }
}

export async function discardBackup(backup: PendingBackup): Promise<void> {
  await backup.source.closeAsync().catch(() => {});
}
