import { parsePasscodeRecord, type PasscodeRecord } from '@/utils/passcode';
import { File, Paths } from 'expo-file-system';

// A file, not `app_meta`: a backup is the whole database, so a row there would travel inside every
// backup file, and a restore would replace this device's passcode with the one in the backup.
const PASSCODE_FILE_NAME = 'passcode.json';

const passcodeFile = (): File => new File(Paths.document, PASSCODE_FILE_NAME);

/** Synchronous, so the first frame is already locked. Null when no passcode is set or the file is unreadable. */
export function readPasscodeRecord(): PasscodeRecord | null {
  try {
    const file = passcodeFile();
    return file.exists ? parsePasscodeRecord(file.textSync()) : null;
  } catch (error) {
    console.warn('Passcode read warning:', error);
    return null;
  }
}

export function writePasscodeRecord(record: PasscodeRecord): void {
  const file = passcodeFile();
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(record));
}

export function deletePasscodeRecord(): void {
  const file = passcodeFile();
  if (file.exists) file.delete();
}
