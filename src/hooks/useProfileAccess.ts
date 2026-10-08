import { useEntitlement } from '@/contexts/EntitlementContext';
import { useProfile } from '@/contexts/ProfileContext';
import { isProfileReadOnly } from '@/utils/entitlement';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

/**
 * Whether the active profile can be edited. A profile beyond the free limit stays visible and
 * switchable; its writes go through `guardWrite`, which shows the read-only sheet instead.
 */
export function useProfileAccess() {
  const { profiles, activeProfile, isDemoMode } = useProfile();
  const { isPro, showReadOnly } = useEntitlement();

  const readOnly = isProfileReadOnly(
    isPro,
    profiles.map((profile) => profile.id),
    activeProfile?.id,
    isDemoMode
  );

  /** Runs `action` unless the profile is read-only. Returns whether it ran. */
  const guardWrite = useCallback(
    (action?: () => void): boolean => {
      if (readOnly) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        showReadOnly({ kind: 'profile' });
        return false;
      }
      action?.();
      return true;
    },
    [readOnly, showReadOnly]
  );

  return { readOnly, guardWrite };
}
