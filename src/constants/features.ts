import type { ThemeName } from '@/contexts/ThemeContext';

/**
 * What Free gets and what Pro unlocks. Every check in the app reads this map through
 * `useEntitlement()` (or the pure helpers in `src/utils/entitlement.ts`); see `docs/subscription.md`.
 */
export const FEATURES = {
  /** How many of each a free user can create and edit. More than that stays visible, read-only. */
  limits: {
    maxProfiles: 1,
    maxBudgets: 3,
    maxDebts: 2,
  },
  /** Themes a free user can pick. */
  freeThemes: ['aurora', 'classic', 'sunset'] as readonly ThemeName[],
  /** Pro-only features. */
  flags: [
    'pdfImport',
    'trendsCustomRange',
    'trendsDaily',
    'trendsLastYear',
    // Whole segments of the Plan tab. Without Pro they show their explainer, or a read-only view of what was saved.
    'budgetHealth',
    'futureGrowth',
    'allThemes',
    'debtSimulator',
    // Placeholders: nothing is gated by these yet.
    'healthFull',
    'wrapPro',
    'reportPdf',
    'multiAccount',
  ],
} as const;

export type FeatureFlag = (typeof FEATURES.flags)[number];
export type LimitKey = keyof typeof FEATURES.limits;

/** Why the paywall was opened; it highlights the matching group of benefits. */
export type PaywallFeature =
  | 'pdfImport'
  | 'trends'
  | 'budgets'
  | 'debts'
  | 'debtSimulator'
  | 'growth'
  | 'health'
  | 'profiles'
  | 'themes'
  | 'readOnly'
  | 'offer';

export const PAYWALL_FEATURES: readonly PaywallFeature[] = [
  'pdfImport',
  'trends',
  'budgets',
  'debts',
  'debtSimulator',
  'growth',
  'health',
  'profiles',
  'themes',
  'readOnly',
  'offer',
];

export const isPaywallFeature = (value: unknown): value is PaywallFeature =>
  PAYWALL_FEATURES.some((feature) => feature === value);
