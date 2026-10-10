import { useProfile } from '@/contexts/ProfileContext';
import { clearAllData } from '@/db/database';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';

/**
 * Removes every profile and everything in them from this phone and returns to Welcome. `app_meta`
 * (theme, language) and the passcode stay. Throws when the database could not be cleared.
 */
export function useEraseAllData() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { refreshProfiles } = useProfile();

  return useCallback(async () => {
    await clearAllData(db);
    await refreshProfiles();
    // Reset runs from the You tab, where nothing is stacked; the Account screen is a modal.
    if (router.canDismiss()) router.dismissAll();
    router.replace('/welcome');
  }, [db, refreshProfiles, router]);
}
