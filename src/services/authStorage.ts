import { chunkValue } from '@/utils/auth';
import * as SecureStore from 'expo-secure-store';

// Where the account session is kept: the Keychain (iOS) and the Keystore (Android). Not `app_meta`:
// a backup is the whole database, so a session there would travel inside every backup file.

// A session is a few thousand characters, and older iOS versions refuse a Keychain entry above about
// 2048 bytes. A part of 600 UTF-16 units is at most 1800 bytes.
const CHUNK_SIZE = 600;

const OPTIONS: SecureStore.SecureStoreOptions = {
  // Never copied to another device with an encrypted device backup.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const countKey = (key: string): string => `${key}.n`;
const partKey = (key: string, index: number): string => `${key}.${index}`;

async function readCount(key: string): Promise<number> {
  const count = Number(await SecureStore.getItemAsync(countKey(key), OPTIONS));
  return Number.isInteger(count) && count > 0 ? count : 0;
}

async function removeParts(key: string, from: number, to: number): Promise<void> {
  for (let index = from; index < to; index++) {
    await SecureStore.deleteItemAsync(partKey(key, index), OPTIONS);
  }
}

/** The storage the account service writes its session to. Keys may hold letters, digits, `.`, `-` and `_`. */
export const authStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const count = await readCount(key);
    if (count === 0) return null;
    const parts: string[] = [];
    for (let index = 0; index < count; index++) {
      const part = await SecureStore.getItemAsync(partKey(key, index), OPTIONS);
      // A write that was cut short: half a session is no session.
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },

  setItem: async (key: string, value: string): Promise<void> => {
    const previous = await readCount(key);
    const parts = chunkValue(value, CHUNK_SIZE);
    // The count goes first to zero: a reader between two writes sees nothing rather than a mix.
    await SecureStore.deleteItemAsync(countKey(key), OPTIONS);
    for (let index = 0; index < parts.length; index++) {
      await SecureStore.setItemAsync(partKey(key, index), parts[index], OPTIONS);
    }
    await removeParts(key, parts.length, previous);
    if (parts.length > 0) await SecureStore.setItemAsync(countKey(key), String(parts.length), OPTIONS);
  },

  removeItem: async (key: string): Promise<void> => {
    const previous = await readCount(key);
    await SecureStore.deleteItemAsync(countKey(key), OPTIONS);
    await removeParts(key, 0, previous);
  },
};
