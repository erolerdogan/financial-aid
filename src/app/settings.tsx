import { Redirect } from 'expo-router';

// Settings became the You tab. The route stays so an old link (`financial-aid://settings`) or a
// restored navigation state still lands in the right place.
export default function SettingsRedirect() {
  return <Redirect href="/you" />;
}
