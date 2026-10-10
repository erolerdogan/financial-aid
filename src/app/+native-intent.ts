import { completeAuthLink } from '@/services/auth';

// A file shared into the app arrives as `<scheme>://expo-sharing`; land on Home and let
// SharedImportHost pick the file up.
// The link of "sign in by email" arrives as `<scheme>://auth-callback`. It is finished here, not on
// a route: at a cold start the launch redirect to Welcome could replace that route before it ran.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (completeAuthLink(path)) return '/';
  } catch (error) {
    console.warn('Sign-in link warning:', error);
    return '/';
  }
  try {
    if (new URL(path).hostname === 'expo-sharing') {
      return '/';
    }
  } catch {
    // Not an absolute URL; leave it to the router.
  }
  return path;
}
