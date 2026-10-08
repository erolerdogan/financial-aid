import { Directory, File, Paths } from 'expo-file-system';
import { Platform, Share } from 'react-native';

export function writeFile(file: File, bytes: Uint8Array): void {
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
}

/**
 * Hands a file to the system: a directory picker on Android, the share sheet on iOS.
 * Returns false when the user cancelled.
 */
export async function saveFile(name: string, bytes: Uint8Array, mimeType: string): Promise<boolean> {
  if (Platform.OS === 'android') {
    let directory: Directory;
    try {
      directory = await Directory.pickDirectoryAsync();
    } catch {
      return false;
    }
    directory.createFile(name, mimeType).write(bytes);
    return true;
  }

  const file = new File(Paths.cache, name);
  writeFile(file, bytes);
  try {
    const result = await Share.share({ url: file.uri });
    return result.action === Share.sharedAction;
  } finally {
    if (file.exists) file.delete();
  }
}
