import type { TranslationKey } from '../../src/i18n';
import { PATHS, type SiteContext } from './html';

type FeatureCopy = 'import' | 'health' | 'debts' | 'growth' | 'backup';

export interface Feature {
  /** Web path segment, also the screenshot's file name. */
  slug: string;
  /** Middle part of its `feature.<copy>.*` keys. */
  copy: FeatureCopy;
  /** The name as the app shows it. */
  name: (ctx: SiteContext) => string;
  /** Shown under the page; the app carries the same line on that screen. */
  disclaimer?: TranslationKey;
}

export const FEATURES: Feature[] = [
  { slug: 'import', copy: 'import', name: (ctx) => ctx.s('feature.import.name') },
  { slug: 'budget-health', copy: 'health', name: (ctx) => ctx.t('health.title'), disclaimer: 'health.disclaimer' },
  { slug: 'debts', copy: 'debts', name: (ctx) => ctx.t('home.debts.title') },
  { slug: 'future-growth', copy: 'growth', name: (ctx) => ctx.t('freedom.name'), disclaimer: 'freedom.disclaimer' },
  { slug: 'backup', copy: 'backup', name: (ctx) => ctx.t('settings.backup') },
];

export const featurePath = (feature: Feature): string => `${PATHS.features}${feature.slug}/`;
