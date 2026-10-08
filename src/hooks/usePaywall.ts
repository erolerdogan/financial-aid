import type { PaywallFeature } from '@/constants/features';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/** Opens the paywall; `feature` says why, so the matching benefits are highlighted. */
export function usePaywall() {
  const router = useRouter();

  const openPaywall = useCallback(
    (feature?: PaywallFeature) => {
      Haptics.selectionAsync().catch(() => {});
      router.push(feature ? { pathname: '/paywall', params: { feature } } : '/paywall');
    },
    [router]
  );

  return { openPaywall };
}
