import { BackupRestoreModal } from '@/components/modals/BackupRestoreModal';
import { DebtFormModal, DebtPrefill } from '@/components/modals/DebtFormModal';
import { InboxAnchor, InboxModal } from '@/components/modals/InboxModal';
import { useProfile } from '@/contexts/ProfileContext';
import { DebtSummary, getDebtSummaries } from '@/db/database';
import { useStatementImporter } from '@/hooks/useStatementImporter';
import { dismissInboxItem, getInboxItems, InboxItem, isQuietInboxItem } from '@/services/inboxService';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

interface InboxContextType {
  items: InboxItem[];
  /** Items that need a decision; shown as the number on the bell. */
  count: number;
  /** Only reminders are left; shown as a dot. */
  hasQuietItems: boolean;
  visible: boolean;
  /** Window position of the bell that opened the panel. */
  anchor: InboxAnchor | null;
  openInbox: (anchor?: InboxAnchor) => void;
  closeInbox: () => void;
  /** `force` recomputes even when nothing seems to have changed. */
  refreshInbox: (force?: boolean) => Promise<void>;
  dismissItem: (item: InboxItem) => Promise<void>;
}

const InboxContext = createContext<InboxContextType>({
  items: [],
  count: 0,
  hasQuietItems: false,
  visible: false,
  anchor: null,
  openInbox: () => {},
  closeInbox: () => {},
  refreshInbox: async () => {},
  dismissItem: async () => {},
});

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const { activeProfile, dataVersion, isDemoMode, refreshProfiles } = useProfile();
  const profileId = activeProfile?.id ?? 1;

  const [items, setItems] = useState<InboxItem[]>([]);
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<InboxAnchor | null>(null);
  const requestRef = useRef(0);
  // What the current items were built from; unchanged means nothing to recompute.
  const stampRef = useRef('');

  const refreshInbox = useCallback(async (force = false) => {
    if (!db) return;
    try {
      const row = await db.getFirstAsync<{ changes: number }>(`SELECT total_changes() AS changes;`);
      const stamp = `${profileId}:${dataVersion}:${isDemoMode}:${row?.changes ?? -1}:${new Date().toDateString()}`;
      if (!force && row && stamp === stampRef.current) return;

      // Counted only for calls that load, so a skipped call cannot discard one still in flight.
      const request = ++requestRef.current;
      const next = await getInboxItems(db, profileId, { includeBackup: !isDemoMode });
      if (request !== requestRef.current) return;
      stampRef.current = stamp;
      setItems(next);
    } catch (error) {
      console.error('Failed to load inbox:', error);
    }
  }, [db, profileId, dataVersion, isDemoMode]);

  const dismissItem = useCallback(
    async (item: InboxItem) => {
      setItems((prev) => prev.filter((i) => i.key !== item.key));
      try {
        await dismissInboxItem(db, profileId, item);
        // The Debts tab lists the same suggestions; a data refresh keeps both in step.
        if (item.kind === 'DEBT_SUGGESTIONS') await refreshProfiles();
        else await refreshInbox();
      } catch (error) {
        console.error('Failed to dismiss inbox item:', error);
      }
    },
    [db, profileId, refreshInbox, refreshProfiles]
  );

  const openInbox = useCallback(
    (from?: InboxAnchor) => {
      setAnchor(from ?? null);
      setVisible(true);
      // What is on screen when the panel opens must never be a stale list.
      refreshInbox(true);
    },
    [refreshInbox]
  );
  const closeInbox = useCallback(() => setVisible(false), []);

  const value = useMemo(() => {
    const count = items.filter((i) => !isQuietInboxItem(i)).length;
    return {
      items,
      count,
      hasQuietItems: items.length > count,
      visible,
      anchor,
      openInbox,
      closeInbox,
      refreshInbox,
      dismissItem,
    };
  }, [items, visible, anchor, openInbox, closeInbox, refreshInbox, dismissItem]);

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export const useInbox = () => useContext(InboxContext);

// Mounted once in the tabs layout: the sheet and the modals its rows open.
export function InboxHost() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { activeProfile, refreshProfiles } = useProfile();
  const { items, visible, anchor, closeInbox, refreshInbox, dismissItem } = useInbox();
  const { importStatement } = useStatementImporter();
  const profileId = activeProfile?.id ?? 1;

  const [formVisible, setFormVisible] = useState(false);
  const [formDebt, setFormDebt] = useState<DebtSummary | null>(null);
  const [formPrefill, setFormPrefill] = useState<DebtPrefill | null>(null);
  const [backupVisible, setBackupVisible] = useState(false);

  const runAction = async (item: InboxItem) => {
    switch (item.kind) {
      case 'DEBT_SUGGESTIONS': {
        // Several are picked from the cards on the Debts tab; a single one goes straight to the form.
        if (item.suggestions.length > 1) {
          router.navigate({ pathname: '/debts', params: { segment: 'debts' } });
          break;
        }
        const [suggestion] = item.suggestions;
        setFormDebt(null);
        setFormPrefill({ name: suggestion.name, type: suggestion.type, keywords: [suggestion.keyword] });
        setFormVisible(true);
        break;
      }
      case 'DEBT_MATCHES': {
        const debt = (await getDebtSummaries(db, profileId)).find((d) => d.id === item.debtId);
        if (!debt) return;
        setFormDebt(debt);
        setFormPrefill(null);
        setFormVisible(true);
        break;
      }
      case 'UNCATEGORISED':
        router.push('/review');
        break;
      case 'HEALTH_ALERT':
        // The Health segment lists the same alerts with "Don't alert me about this".
        router.navigate({ pathname: '/debts', params: { segment: 'health' } });
        break;
      case 'PARTIAL_MONTH':
        await importStatement();
        break;
      case 'BACKUP':
        setBackupVisible(true);
        break;
    }
  };

  // Reloads the screens behind the form, then drops the row that was just handled.
  const handleDebtSaved = async () => {
    await refreshProfiles();
    await refreshInbox(true);
  };

  const handleAction = (item: InboxItem) => {
    closeInbox();
    // Let the sheet go before another modal is presented.
    setTimeout(() => {
      runAction(item).catch((error) => console.error('Inbox action failed:', error));
    }, 250);
  };

  return (
    <>
      <InboxModal
        visible={visible}
        anchor={anchor}
        items={items}
        onClose={closeInbox}
        onAction={handleAction}
        onDismissItem={dismissItem}
      />

      <DebtFormModal
        visible={formVisible}
        debt={formDebt}
        prefill={formPrefill}
        onClose={() => setFormVisible(false)}
        onSaved={handleDebtSaved}
      />

      <BackupRestoreModal
        visible={backupVisible}
        onClose={() => {
          setBackupVisible(false);
          refreshInbox(true);
        }}
      />
    </>
  );
}
