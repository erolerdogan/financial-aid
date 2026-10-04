import { getAppMeta, replaceDatabaseContents, setAppMeta } from '@/db/database';
import { CLASSIFIER_VERSION } from '@/utils/parser';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { deserializeDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { Platform, Share } from 'react-native';

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

export type BackupErrorCode = 'NOT_BACKUP' | 'DAMAGED' | 'NEWER_VERSION';

export class BackupError extends Error {
  code: BackupErrorCode;

  constructor(code: BackupErrorCode) {
    super(code);
    this.code = code;
  }
}

const LAST_BACKUP_KEY = 'lastBackupAt';
const SAFETY_COPY_NAME = 'pre-restore.db';
const SQLITE_MAGIC = 'SQLite format 3\u0000';

const safetyCopyFile = (): File => new File(Paths.document, SAFETY_COPY_NAME);

const pad = (n: number): string => String(n).padStart(2, '0');

const backupFileName = (): string => {
  const now = new Date();
  return `financial-aid-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.db`;
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

function writeFile(file: File, bytes: Uint8Array): void {
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
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

/** Writes a snapshot of every profile and hands it to the system. Returns false when the user cancelled. */
export async function exportBackup(db: SQLiteDatabase): Promise<boolean> {
  const bytes = await snapshot(db);
  const name = backupFileName();

  if (Platform.OS === 'android') {
    let directory: Directory;
    try {
      directory = await Directory.pickDirectoryAsync();
    } catch {
      return false;
    }
    directory.createFile(name, 'application/octet-stream').write(bytes);
  } else {
    const file = new File(Paths.cache, name);
    writeFile(file, bytes);
    try {
      const result = await Share.share({ url: file.uri });
      if (result.action !== Share.sharedAction) return false;
    } finally {
      if (file.exists) file.delete();
    }
  }

  await setAppMeta(db, LAST_BACKUP_KEY, new Date().toISOString());
  return true;
}

export async function getLastBackupDate(db: SQLiteDatabase): Promise<Date | null> {
  const value = await getAppMeta(db, LAST_BACKUP_KEY);
  return value ? new Date(value) : null;
}

/** Lets the user choose a backup file and validates it. Returns null when the picker was cancelled. */
export async function pickBackup(): Promise<PendingBackup | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled || !result.assets || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const file = new File(asset.uri);
  try {
    const bytes = await file.bytes();
    return await openBackup(bytes, asset.lastModified ? new Date(asset.lastModified) : null);
  } finally {
    if (file.exists) file.delete();
  }
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
