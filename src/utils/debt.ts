import type { DebtType } from '@/db/database';
import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const DEBT_TYPE_OPTIONS: { key: DebtType; label: string; icon: IconName }[] = [
  { key: 'LOAN', label: 'Loan', icon: 'cash-outline' },
  { key: 'MORTGAGE', label: 'Mortgage', icon: 'home-outline' },
  { key: 'STUDENT', label: 'Student', icon: 'school-outline' },
  { key: 'PERSONAL', label: 'Personal', icon: 'person-outline' },
  { key: 'OTHER', label: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
];

export const getDebtTypeIcon = (type: DebtType): IconName =>
  DEBT_TYPE_OPTIONS.find((o) => o.key === type)?.icon ?? 'cash-outline';

export const getDebtTypeLabel = (type: DebtType): string =>
  DEBT_TYPE_OPTIONS.find((o) => o.key === type)?.label ?? 'Loan';

export const formatPayoffMonth = (monthKey: string | null): string => {
  if (!monthKey) return '—';
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

export const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const isValidDateKey = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

export const parseNumber = (value: string): number => {
  const parsed = parseFloat(value.replace(',', '.').trim());
  return isNaN(parsed) ? NaN : parsed;
};