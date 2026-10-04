import { useProfile } from '@/contexts/ProfileContext';
import { makeRangeKey, parseRangeKey } from '@/db/database';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type DateFilter =
  | { kind: 'ALL' }
  | { kind: 'MONTH'; month: string }
  | { kind: 'RANGE'; from: string; to: string };

interface PeriodContextType {
  period: DateFilter;
  setPeriod: (period: DateFilter) => void;
}

const ALL_PERIOD: DateFilter = { kind: 'ALL' };

const PeriodContext = createContext<PeriodContextType>({
  period: ALL_PERIOD,
  setPeriod: () => {},
});

/** Period key (`YYYY-MM` or a range key) → filter. */
export function periodFromKey(key: string): DateFilter {
  const range = parseRangeKey(key);
  if (range) return { kind: 'RANGE', from: range.from, to: range.to };
  return /^\d{4}-\d{2}$/.test(key) ? { kind: 'MONTH', month: key } : ALL_PERIOD;
}

export function periodToKey(period: DateFilter): string | null {
  if (period.kind === 'MONTH') return period.month;
  if (period.kind === 'RANGE') return makeRangeKey(period.from, period.to);
  return null;
}

// The period the user picked, shared by Home and Transactions. `ALL` means nothing picked yet:
// Home then shows the latest month and Transactions the full list.
export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const { activeProfile } = useProfile();
  const activeProfileId = activeProfile?.id;
  const [picked, setPicked] = useState<{ profileId: number | undefined; period: DateFilter }>({
    profileId: undefined,
    period: ALL_PERIOD,
  });

  // A pick belongs to the profile it was made in; switching profile starts from "nothing picked".
  const period = picked.profileId === activeProfileId ? picked.period : ALL_PERIOD;

  const setPeriod = useCallback(
    (next: DateFilter) => setPicked({ profileId: activeProfileId, period: next }),
    [activeProfileId]
  );

  const value = useMemo(() => ({ period, setPeriod }), [period, setPeriod]);

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export const usePeriod = () => useContext(PeriodContext);
