import type { Message } from '@/i18n';
import { buildMerchantProfiles, type FixedCostRow } from '@/utils/fixedCost';
import { isGenericMerchant, looksLikeCode } from '@/utils/merchantName';
import {
  type LearnedCategories,
  lookupLearnedCategory,
  matchKeywords,
  merchantRuleKeyword,
} from '@/utils/parser';

export interface CategorySuggestion {
  category: string;
  /** Short explanation shown next to the suggestion. */
  reason: Message;
}

/** A merchant that already has a real category, with how many transactions carry it. */
export interface KnownMerchant {
  merchant: string;
  category: string;
  count: number;
}

export interface SuggestionGroup {
  title: string;
  iban: string | null;
  sample: string;
  rows: (FixedCostRow & { txType?: string | null })[];
}

export type MerchantIndex = Map<string, KnownMerchant[]>;

const MIN_WORD_LENGTH = 4;
// Leading words that many unrelated merchants share.
const COMMON_WORDS = new Set([
  'STICHTING', 'BETALING', 'PAYMENT', 'ONLINE', 'FROM', 'VOOR', 'GEMEENTE', 'HOLDING', 'GROUP',
  'GROEP', 'NEDERLAND', 'INTERNATIONAL',
]);

/** First real word of a merchant name: "KWEKERIJ" for "Kwekerij De Linde 0042". */
function significantWord(name: string): string {
  for (const word of merchantRuleKeyword(name).split(/[^\p{L}\p{N}&]+/u)) {
    const letters = (word.match(/\p{L}/gu) ?? []).length;
    if (letters >= MIN_WORD_LENGTH && !looksLikeCode(word) && !COMMON_WORDS.has(word)) return word;
  }
  return '';
}

export function buildMerchantIndex(known: KnownMerchant[]): MerchantIndex {
  const index: MerchantIndex = new Map();
  for (const entry of known) {
    if (isGenericMerchant(entry.merchant)) continue;
    const word = significantWord(entry.merchant);
    if (!word) continue;
    const bucket = index.get(word);
    if (bucket) bucket.push(entry);
    else index.set(word, [entry]);
  }
  return index;
}

function similarMerchant(title: string, index: MerchantIndex): CategorySuggestion | null {
  const word = significantWord(title);
  const bucket = word ? index.get(word) : undefined;
  if (!bucket) return null;

  const totals = new Map<string, number>();
  let all = 0;
  for (const entry of bucket) {
    totals.set(entry.category, (totals.get(entry.category) ?? 0) + entry.count);
    all += entry.count;
  }
  let category = '';
  let top = 0;
  for (const [name, count] of totals) {
    if (count > top) {
      category = name;
      top = count;
    }
  }
  if (!category || top / all <= 0.5) return null;

  const example = bucket
    .filter((entry) => entry.category === category)
    .sort((a, b) => b.count - a.count)[0];
  return { category, reason: { key: 'suggest.like', params: { merchant: example.merchant } } };
}

/**
 * Best guess for a merchant the classifier could not place, most reliable source first:
 * the user's earlier choices, a similar known merchant, a generic word in the bank text,
 * and finally the payment pattern.
 */
export function suggestCategory(
  group: SuggestionGroup,
  context: { learned: LearnedCategories; index: MerchantIndex }
): CategorySuggestion | null {
  const amount = group.rows[0]?.amount ?? -1;

  const learnt = lookupLearnedCategory(context.learned, { merchant: group.title, iban: group.iban, amount });
  if (learnt) return { category: learnt, reason: { key: 'suggest.learned' } };

  const similar = similarMerchant(group.title, context.index);
  if (similar) return similar;

  const mention = matchKeywords(group.sample, { allowNameOnly: true });
  if (mention) return { category: mention.category, reason: { key: 'suggest.mentions', params: { keyword: mention.keyword.toLowerCase() } } };

  const allDirectDebit = group.rows.length > 0 && group.rows.every((row) => row.txType === 'DIRECT_DEBIT');
  if (allDirectDebit) {
    for (const profile of buildMerchantProfiles(group.rows).values()) {
      if (profile.cadence === 'MONTHLY') {
        return { category: 'Utilities & Telecom', reason: { key: 'suggest.directDebit' } };
      }
    }
  }

  return null;
}
