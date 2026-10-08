import type { PaywallFeature } from '@/constants/features';
import type { TranslationKey } from '@/i18n';
import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type PlanId = 'yearly' | 'monthly' | 'lifetime';

export interface PlanDefinition {
  id: PlanId;
  /** Placeholder until the store provides the price. */
  amount: number;
  /** Free days before the first charge; 0 = none. */
  trialDays: number;
}

// TODO(payments): placeholders. The real prices, currency and trial come from the store through
// `getOfferings()` in `src/services/purchases.ts`.
export const PLACEHOLDER_CURRENCY_SYMBOL = '€';
export const PLANS: readonly PlanDefinition[] = [
  { id: 'yearly', amount: 29.99, trialDays: 7 },
  { id: 'monthly', amount: 3.99, trialDays: 0 },
  { id: 'lifetime', amount: 79.99, trialDays: 0 },
];
export const DEFAULT_PLAN: PlanId = 'yearly';

// TODO(payments): placeholders; replace with the published pages before the paywall goes live.
export const TERMS_URL = 'https://example.com/terms';
export const PRIVACY_URL = 'https://example.com/privacy';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface BenefitGroup {
  key: 'history' | 'planning' | 'household' | 'personal';
  title: TranslationKey;
  icon: IconName;
  benefits: TranslationKey[];
  /** The reasons for opening the paywall that this group answers. */
  features: PaywallFeature[];
}

export const BENEFIT_GROUPS: readonly BenefitGroup[] = [
  {
    key: 'history',
    title: 'paywall.group.history',
    icon: 'time-outline',
    benefits: ['paywall.benefit.pdfImport', 'paywall.benefit.trendsRange', 'paywall.benefit.trendsCompare'],
    features: ['pdfImport', 'trends'],
  },
  {
    key: 'planning',
    title: 'paywall.group.planning',
    icon: 'trending-up-outline',
    benefits: [
      'paywall.benefit.budgets',
      'paywall.benefit.debts',
      'paywall.benefit.debtSimulator',
      'paywall.benefit.growth',
    ],
    features: ['budgets', 'debts', 'debtSimulator', 'growth'],
  },
  {
    key: 'household',
    title: 'paywall.group.household',
    icon: 'people-outline',
    benefits: ['paywall.benefit.profiles'],
    features: ['profiles', 'readOnly'],
  },
  {
    key: 'personal',
    title: 'paywall.group.personal',
    icon: 'color-palette-outline',
    benefits: ['paywall.benefit.themes'],
    features: ['themes'],
  },
];
