import type { Message, TFunction } from '@/i18n';
import { categoryLabel } from '@/i18n/categories';
import type { Formatters } from '@/i18n/format';

const MONEY_PARAMS = ['amount', 'usual'];

/** Whole amounts without decimals, anything else with two. */
export const formatAlertMoney = (value: number, format: Formatters, currencySymbol: string): string =>
  format.money(value, currencySymbol, Number.isInteger(value) ? 0 : 2);

/**
 * One alert as a sentence in the reader's language. Alerts are stored as a `Message`, so the text follows
 * the app language: `amount` / `usual` become money and `category` becomes the category's display name.
 */
export function alertText(message: Message, t: TFunction, format: Formatters, currencySymbol: string): string {
  const params: Record<string, string | number> = { ...message.params };

  for (const name of MONEY_PARAMS) {
    const value = params[name];
    if (typeof value === 'number') params[name] = formatAlertMoney(value, format, currencySymbol);
  }
  if (typeof params.category === 'string') params.category = categoryLabel(params.category, t);

  return t(message.key, params);
}
