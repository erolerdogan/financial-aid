import { FEATURES, type FeatureFlag, type LimitKey } from '@/constants/features';
import type { ThemeName } from '@/contexts/ThemeContext';

/** Where the current tier comes from. `dev` is the Pro testing switch in Settings. */
export type EntitlementSource = 'free' | 'pro' | 'dev';

/** `app_meta` key of the Pro testing switch. */
export const PRO_DEV_OVERRIDE_KEY = 'pro_dev_override';
/** `app_meta` key: how many imports stored at least one row. It survives "Reset". */
export const PRO_OFFER_IMPORTS_KEY = 'pro_offer_imports';
/** `app_meta` key: set once the one-time Pro offer has been shown. It survives "Reset". */
export const PRO_OFFER_SHOWN_KEY = 'pro_offer_shown';
/**
 * The one-time offer opens after this many successful imports. One: the first summary is the moment the
 * user sees their own money in the app, and statements are monthly, so a second import may be weeks away.
 */
export const PRO_OFFER_AFTER_IMPORTS = 1;

/**
 * The stored testing switch counts only where testing is enabled (`PRO_TESTING_ENABLED`: a development
 * build, or a release build made with `EXPO_PUBLIC_PRO_TESTING=1`). `app_meta` travels inside backups and
 * stays on the device across an update, so a production build must not become Pro from a leftover value.
 */
export const resolveSource = (devOverride: string | null, testingEnabled: boolean): EntitlementSource =>
  testingEnabled && devOverride === '1' ? 'dev' : 'free';

export const isProSource = (source: EntitlementSource): boolean => source !== 'free';

export const can = (isPro: boolean, flag: FeatureFlag): boolean => isPro && FEATURES.flags.includes(flag);

export const limit = (isPro: boolean, key: LimitKey): number => (isPro ? Infinity : FEATURES.limits[key]);

/** Whether one more can be created when `count` exist already. */
export const canAdd = (isPro: boolean, key: LimitKey, count: number): boolean => count < limit(isPro, key);

/** The ids that stay editable: the oldest ones, `orderedIds` being oldest first. */
export const editableIds = <T>(isPro: boolean, key: LimitKey, orderedIds: readonly T[]): T[] => {
  const max = limit(isPro, key);
  return max === Infinity ? [...orderedIds] : orderedIds.slice(0, max);
};

/** An item beyond the free limit: still shown, not editable. An id that is not in the list is new, so not read-only. */
export const isItemReadOnly = <T>(isPro: boolean, key: LimitKey, orderedIds: readonly T[], id: T): boolean => {
  const index = orderedIds.indexOf(id);
  return index >= 0 && index >= limit(isPro, key);
};

/** `profileIds` oldest first, without the demo profile. The demo workspace is never read-only. */
export const isProfileReadOnly = (
  isPro: boolean,
  profileIds: readonly number[],
  activeId: number | null | undefined,
  isDemo: boolean
): boolean => {
  if (isDemo || activeId === null || activeId === undefined) return false;
  return isItemReadOnly(isPro, 'maxProfiles', profileIds, activeId);
};

export const isThemeLocked = (isPro: boolean, name: ThemeName): boolean =>
  !can(isPro, 'allThemes') && !FEATURES.freeThemes.includes(name);

/** The paywall is offered once, unasked, after the user has imported. */
export const shouldOfferPro = (state: {
  isPro: boolean;
  isDemo: boolean;
  readOnly: boolean;
  imports: number;
  shown: boolean;
}): boolean =>
  !state.isPro && !state.isDemo && !state.readOnly && !state.shown && state.imports >= PRO_OFFER_AFTER_IMPORTS;
