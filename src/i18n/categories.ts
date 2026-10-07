import type { Message, TFunction, TranslationKey } from './index';

// Stored (English) built-in category name → translation key. The database keeps the English names.
const BUILT_IN_CATEGORY_KEYS: Record<string, TranslationKey> = {
  Housing: 'category.housing',
  Childcare: 'category.childcare',
  'Credit Card Payments': 'category.creditCardPayments',
  Groceries: 'category.groceries',
  'Dining Out': 'category.diningOut',
  'Health & Care': 'category.healthCare',
  'Financial Transfers': 'category.financialTransfers',
  'Utilities & Telecom': 'category.utilitiesTelecom',
  'Loan & Insurance': 'category.loanInsurance',
  Transportation: 'category.transportation',
  'Taxes & Municipal Fees': 'category.taxes',
  'Shopping & Retail': 'category.shopping',
  Uncategorised: 'category.uncategorised',
  Income: 'category.income',
};

/** Display name of a category: built-in names are translated, custom and renamed ones stay as typed. */
export const categoryLabel = (name: string, t: TFunction): string => {
  const key = BUILT_IN_CATEGORY_KEYS[name];
  return key ? t(key) : name;
};

/** Renders a message built outside React; a `category` param is a stored category name and is translated. */
export const formatMessage = (message: Message, t: TFunction): string => {
  const category = message.params?.category;
  return t(
    message.key,
    typeof category === 'string' ? { ...message.params, category: categoryLabel(category, t) } : message.params
  );
};

/** Joins message parts into one sentence-cased line. */
export const formatMessages = (messages: readonly Message[], t: TFunction, tag?: string): string => {
  const text = messages.map((message) => formatMessage(message, t)).join(', ');
  if (!text) return text;
  let first = text[0].toUpperCase();
  try {
    first = text[0].toLocaleUpperCase(tag);
  } catch {}
  return first + text.slice(1);
};
