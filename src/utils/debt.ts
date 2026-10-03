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

// Folds case, diacritics and punctuation so "Kredi Ödeme" and "KREDI-ODEME" compare equal.
export const normalizeMatchText = (text: string): string =>
  (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s\-_.,;:/\\|*#'"()[\]+&@!?]+/g, ' ')
    .trim();

export const MIN_DEBT_KEYWORD_LENGTH = 3;
// Keywords this long may also match the start of a longer word (VODAF -> VODAFONE).
const PREFIX_KEYWORD_LENGTH = 5;

export type DebtMatchStrength = 'EXACT' | 'POSSIBLE';

export const debtKeywordLength = (keyword: string): number =>
  normalizeMatchText(keyword).replace(/ /g, '').length;

const withinOneEdit = (a: string, b: string): boolean => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
};

const keywordStrength = (words: string[], keyword: string): DebtMatchStrength | null => {
  const keywordWords = normalizeMatchText(keyword).split(' ').filter(Boolean);
  const needle = keywordWords.join('');
  if (needle.length < MIN_DEBT_KEYWORD_LENGTH) return null;

  let possible = false;
  for (let i = 0; i < words.length; i++) {
    let run = '';
    for (let j = i; j < words.length; j++) {
      run += words[j];
      if (run === needle) return 'EXACT';
      if (run.startsWith(needle)) {
        if (needle.length >= PREFIX_KEYWORD_LENGTH) return 'EXACT';
        possible = true;
      } else if (needle.length >= PREFIX_KEYWORD_LENGTH && withinOneEdit(run, needle)) {
        possible = true;
      }
      if (run.length > needle.length + 1) break;
    }
  }

  if (possible) return 'POSSIBLE';
  if (needle.length >= PREFIX_KEYWORD_LENGTH && words.join('').includes(needle)) return 'POSSIBLE';
  if (keywordWords.length > 1 && keywordWords.every((w) => words.includes(w))) return 'POSSIBLE';
  return null;
};

// EXACT: the keyword equals whole words (spaces ignored) or, for longer keywords, starts a word.
// POSSIBLE: near-misses that are only ever suggested, never linked automatically.
export const evaluateDebtKeyword = (
  merchant: string,
  rawDescription: string,
  keywords: string[]
): { keyword: string; strength: DebtMatchStrength } | null => {
  const haystacks = [merchant, rawDescription].map((text) =>
    normalizeMatchText(text).split(' ').filter(Boolean)
  );
  let possible: string | null = null;
  for (const keyword of keywords) {
    for (const words of haystacks) {
      const strength = keywordStrength(words, keyword);
      if (strength === 'EXACT') return { keyword, strength };
      if (strength === 'POSSIBLE' && possible === null) possible = keyword;
    }
  }
  return possible === null ? null : { keyword: possible, strength: 'POSSIBLE' };
};

// Typical monthly payment, payment day and first payment date from matched statement transactions.
export const suggestDebtTerms = (
  matches: { date: string; amount: number }[]
): { payment: string; payDay: string; startDate: string; count: number } | null => {
  if (matches.length === 0) return null;

  const amounts = matches.map((m) => m.amount).sort((a, b) => a - b);
  const median = amounts[Math.floor((amounts.length - 1) / 2)];

  const byDate = [...matches].sort((a, b) => b.date.localeCompare(a.date));
  const dayCounts = new Map<number, number>();
  byDate.forEach((m) => {
    const day = Number(m.date.slice(8, 10));
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  });
  // Most common day; ties go to the most recent payment.
  let payDay = Number(byDate[0].date.slice(8, 10));
  for (const [day, count] of dayCounts) {
    if (count > (dayCounts.get(payDay) ?? 0)) payDay = day;
  }

  return {
    payment: String(Math.round(median * 100) / 100),
    payDay: String(payDay),
    startDate: byDate[byDate.length - 1].date.slice(0, 10),
    count: matches.length,
  };
};
