// A file shared into the app arrives as `<scheme>://expo-sharing`; land on Home and let
// SharedImportHost pick the file up.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (new URL(path).hostname === 'expo-sharing') {
      return '/';
    }
  } catch {
    // Not an absolute URL; leave it to the router.
  }
  return path;
}
