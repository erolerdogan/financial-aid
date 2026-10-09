import { useProfile } from '@/contexts/ProfileContext';
import { getUncategorisedCount } from '@/db/database';
import { useProfileAccess } from '@/hooks/useProfileAccess';
import { INCOME_CATEGORY, UNCATEGORISED } from '@/utils/parser';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

interface QuickCategoriseOptions {
  /** Runs after transactions were added to a category, so the screen can reload. */
  onMoved?: (count: number) => void;
  /** Runs when the sheet closes, with or without a change. */
  onClosed?: () => void;
}

/**
 * State for `QuickCategoriseSheet`: how many transactions are uncategorised, whether a category
 * can take them, and the props of the sheet.
 */
export function useQuickCategorise({ onMoved, onClosed }: QuickCategoriseOptions = {}) {
  const db = useSQLiteContext();
  const { activeProfile, dataVersion } = useProfile();
  const { readOnly } = useProfileAccess();
  const profileId = activeProfile?.id ?? 1;

  const [count, setCount] = useState(0);
  const [category, setCategory] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const reloadCount = useCallback(async () => {
    if (!db) return;
    try {
      setCount(await getUncategorisedCount(db, profileId));
    } catch (error) {
      console.error('Failed to count uncategorised transactions:', error);
    }
  }, [db, profileId]);

  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    getUncategorisedCount(db, profileId)
      .then((value) => {
        if (!cancelled) setCount(value);
      })
      .catch((error) => console.error('Failed to count uncategorised transactions:', error));
    return () => {
      cancelled = true;
    };
  }, [db, profileId, dataVersion]);

  /** Uncategorised rows are expenses, so Income cannot take them. */
  const canAdd = (target: string | null | undefined): boolean =>
    !readOnly &&
    count > 0 &&
    !!target &&
    target !== 'All' &&
    target !== UNCATEGORISED &&
    target !== INCOME_CATEGORY;

  const open = (target: string) => {
    Haptics.selectionAsync().catch(() => {});
    setCategory(target);
    setVisible(true);
  };

  const sheetProps = {
    visible,
    category,
    onClose: () => {
      setVisible(false);
      onClosed?.();
    },
    onMoved: (moved: number) => {
      reloadCount();
      onMoved?.(moved);
    },
  };

  return { count, canAdd, open, sheetProps, reloadCount };
}
