import { DEFAULT_HOUSEHOLD, type Household, type HousingType } from '../constants/benchmarks';
import { parseNumber } from './debt';

/** The colours a profile avatar can take; the first is the default. */
export const AVATAR_COLORS = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5856D6'];

export const SETUP_STEPS = ['profile', 'household', 'money'] as const;
/** App-wide settings (theme, passcode lock), not per profile: asked on first launch only. */
export const APP_SETUP_STEPS = ['appearance', 'security'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number] | (typeof APP_SETUP_STEPS)[number];

/** The steps in the order they are asked; the app-wide ones come after the profile's. */
export const setupSteps = (withAppSteps: boolean): readonly SetupStep[] =>
  withAppSteps ? [...SETUP_STEPS, ...APP_SETUP_STEPS] : SETUP_STEPS;

/** What the questionnaire hands back; a skipped step leaves its fields undefined. */
export interface SetupAnswers {
  name: string;
  color: string;
  currency: string;
  adults?: number;
  children?: number;
  housingType?: HousingType;
  incomeText?: string;
  savingsText?: string;
}

/** Empty = not given; otherwise a number of 0 or more, or NaN when it cannot be read. */
export const parseOptionalAmount = (text: string): number | null => {
  if (text.trim() === '') return null;
  const value = parseNumber(text);
  return Number.isFinite(value) && value >= 0 ? value : NaN;
};

/** The household row to save: skipped or unreadable answers fall back to the defaults. */
export function buildHousehold(
  answers: Pick<SetupAnswers, 'adults' | 'children' | 'housingType' | 'incomeText' | 'savingsText'>
): Household {
  const income = parseOptionalAmount(answers.incomeText ?? '');
  const savings = parseOptionalAmount(answers.savingsText ?? '');
  return {
    adults: answers.adults ?? DEFAULT_HOUSEHOLD.adults,
    children: answers.children ?? DEFAULT_HOUSEHOLD.children,
    housingType: answers.housingType ?? DEFAULT_HOUSEHOLD.housingType,
    // 0 means "not given": the detected income is used.
    netIncomeOverride: income !== null && income > 0 ? income : null,
    safetySavings: savings !== null && !Number.isNaN(savings) ? savings : null,
  };
}

/**
 * What the income field of the household sheet starts with when no income was typed (the question was skipped
 * or left empty): the monthly average found in the statements, in whole units. Empty when there is none.
 */
export function incomePrefill(netIncomeOverride: number | null, detectedIncome: number | null): string {
  if (netIncomeOverride !== null || detectedIncome === null) return '';
  const rounded = Math.round(detectedIncome);
  return rounded > 0 ? String(rounded) : '';
}

/**
 * The income to save from the household sheet: null (keep following the statements) when the field is empty,
 * 0, or still the untouched prefill; otherwise the typed figure.
 */
export function incomeOverrideToSave(incomeText: string, prefill: string): number | null {
  if (prefill !== '' && incomeText.trim() === prefill) return null;
  const income = parseOptionalAmount(incomeText);
  return income !== null && income > 0 ? income : null;
}

/** The device region's currency when the app supports it, otherwise the fallback. */
export function defaultCurrency(
  regionCurrency: string | null | undefined,
  supported: readonly string[],
  fallback = 'EUR'
): string {
  const code = (regionCurrency ?? '').toUpperCase();
  return supported.includes(code) ? code : fallback;
}
