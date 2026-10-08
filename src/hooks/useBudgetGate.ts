import { useEntitlement } from '@/contexts/EntitlementContext';
import { useProfile } from '@/contexts/ProfileContext';
import { getBudgetOrder } from '@/db/database';
import { usePaywall } from '@/hooks/usePaywall';
import { useProfileAccess } from '@/hooks/useProfileAccess';
import { canAdd, isItemReadOnly } from '@/utils/entitlement';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

/**
 * The free limit on budgets. The oldest budgets stay editable; the ones beyond the limit are shown
 * read-only and can only be removed. Call `reload` after a budget was saved.
 */
export function useBudgetGate() {
  const db = useSQLiteContext();
  const { activeProfile, dataVersion } = useProfile();
  const profileId = activeProfile?.id ?? 1;
  const { isPro, showReadOnly } = useEntitlement();
  const { openPaywall } = usePaywall();
  const { guardWrite } = useProfileAccess();
  // Categories that have a budget, oldest first.
  const [order, setOrder] = useState<string[]>([]);

  const reload = useCallback(async () => {
    try {
      setOrder(await getBudgetOrder(db, profileId));
    } catch (error) {
      console.error('Failed to load budget order:', error);
    }
  }, [db, profileId]);

  useEffect(() => {
    let cancelled = false;
    getBudgetOrder(db, profileId)
      .then((next) => {
        if (!cancelled) setOrder(next);
      })
      .catch((error) => console.error('Failed to load budget order:', error));
    return () => {
      cancelled = true;
    };
  }, [db, profileId, dataVersion]);

  const isReadOnly = (category: string): boolean => isItemReadOnly(isPro, 'maxBudgets', order, category);

  /** Runs `edit` when this category's budget may be set or changed; `onRemove` clears a read-only one. */
  const guardBudget = (category: string, edit: () => void, onRemove: () => void): boolean =>
    guardWrite(() => {
      if (isReadOnly(category)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        showReadOnly({ kind: 'budget', onRemove });
        return;
      }
      if (!order.includes(category) && !canAdd(isPro, 'maxBudgets', order.length)) {
        openPaywall('budgets');
        return;
      }
      edit();
    });

  return { isReadOnly, guardBudget, reload };
}
