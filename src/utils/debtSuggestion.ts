import type { DebtType } from '@/db/database';
import {
  debtKeywordLength,
  evaluateDebtKeyword,
  MIN_DEBT_KEYWORD_LENGTH,
  normalizeMatchText,
  suggestDebtTerms,
} from '@/utils/debt';
import { buildMerchantProfiles, type FixedCostRow, fixedMatchText, merchantKey } from '@/utils/fixedCost';
import { containsWord, containsWordStart } from '@/utils/merchantName';
import { merchantRuleKeyword } from '@/utils/parser';

export interface DebtSuggestion {
  /** Merchant group key; also what a dismissal is stored under. */
  key: string;
  name: string;
  type: DebtType;
  keyword: string;
  payment: number;
  count: number;
  firstDate: string;
  lastDate: string;
}

// Checked in order, so the specific types win over the generic LOAN words.
// `starts` may begin a longer word (HYPOTHEEK -> HYPOTHEEKRENTE), `words` must stand alone.
const DEBT_SIGNALS: { type: DebtType; starts: string[]; words: string[] }[] = [
  {
    type: 'MORTGAGE',
    starts: ['HYPOTHEEK', 'HYPOTHEKEN', 'MORTGAGE'],
    words: ['KONUT KREDISI'],
  },
  {
    type: 'STUDENT',
    starts: ['STUDIESCHULD'],
    words: ['DUO', 'DIENST UITVOERING ONDERWIJS', 'STUDENT LOAN', 'KYK'],
  },
  {
    type: 'PERSONAL',
    starts: [],
    words: ['PERSONAL LOAN', 'PERSOONLIJKE LENING', 'IHTIYAC KREDISI'],
  },
  {
    type: 'LOAN',
    starts: ['KREDIET', 'AFLOSSING', 'FINANCIERING', 'TAKSIT', 'INSTALLMENT', 'KREDI'],
    words: ['LENING', 'AUTOLENING', 'LOAN', 'FREO', 'SANTANDER CONSUMER', 'BNP PARIBAS PERSONAL'],
  },
];

// Insurance premiums and credit card bills share words (and a category) with loans.
const NOT_DEBT_PARTS = ['VERZEKER', 'INSURANCE', 'SIGORTA', 'PREMIE', 'KARTI', 'CREDIT CARD', 'CREDITCARD'];

const MAX_AMOUNT_DEVIATION = 0.1;
// A loan whose last payment is older than this has most likely ended.
const MAX_DAYS_SINCE_LAST = 62;
const MAX_NAME_LENGTH = 40;

const dayNumber = (date: string): number =>
  Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86400000;

function findSignal(row: FixedCostRow): { type: DebtType; phrase: string } | null {
  const text = normalizeMatchText(`${row.merchant ?? ''} ${row.rawDescription ?? ''}`);
  if (NOT_DEBT_PARTS.some((part) => text.includes(part))) return null;
  for (const signal of DEBT_SIGNALS) {
    const phrase =
      signal.starts.find((s) => containsWordStart(text, s)) ?? signal.words.find((w) => containsWord(text, w));
    if (phrase) return { type: signal.type, phrase };
  }
  return null;
}

/**
 * Recurring monthly payments to a lender that no debt covers yet.
 * `rows` are the expense transactions not linked to any debt, `latestDate` the newest transaction date.
 */
export function buildDebtSuggestions(
  rows: FixedCostRow[],
  existingKeywords: string[],
  dismissedKeys: string[],
  latestDate: string | null
): DebtSuggestion[] {
  const groups = new Map<string, FixedCostRow[]>();
  for (const row of rows) {
    if (!row.date || !(row.amount < 0)) continue;
    const key = merchantKey(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  const profiles = buildMerchantProfiles(rows);
  const suggestions: DebtSuggestion[] = [];

  for (const [key, group] of groups) {
    if (dismissedKeys.includes(key)) continue;

    const profile = profiles.get(key);
    if (!profile || profile.monthsSeen < 2 || profile.chargesPerMonth > 1) continue;
    if (profile.amountDeviation > MAX_AMOUNT_DEVIATION) continue;
    if (profile.count >= 3 && profile.cadence !== 'MONTHLY') continue;

    const sorted = [...group].sort((a, b) => b.date.localeCompare(a.date));
    const latest = sorted[0];
    if (latestDate && dayNumber(latestDate) - dayNumber(latest.date) > MAX_DAYS_SINCE_LAST) continue;

    const signals = sorted.map(findSignal);
    const signal = signals.find((s) => s !== null);
    if (!signal || signals.filter((s) => s !== null).length * 2 < sorted.length) continue;

    if (
      existingKeywords.length > 0 &&
      sorted.some((row) => evaluateDebtKeyword(row.merchant, row.rawDescription, existingKeywords))
    ) {
      continue;
    }

    // The keyword has to link every payment of the group, or the prefilled form would miss some.
    const keyword = [merchantRuleKeyword(fixedMatchText(latest)), signal.phrase].find(
      (candidate) =>
        debtKeywordLength(candidate) >= MIN_DEBT_KEYWORD_LENGTH &&
        sorted.every(
          (row) => evaluateDebtKeyword(row.merchant, row.rawDescription, [candidate])?.strength === 'EXACT'
        )
    );
    if (!keyword) continue;

    const terms = suggestDebtTerms(sorted.map((row) => ({ date: row.date, amount: Math.abs(row.amount) })));
    if (!terms) continue;

    const title = latest.merchant && latest.merchant !== 'Unknown' ? latest.merchant : keyword;
    suggestions.push({
      key,
      name: title.trim().slice(0, MAX_NAME_LENGTH),
      type: signal.type,
      keyword: keyword.toUpperCase(),
      payment: Number(terms.payment),
      count: terms.count,
      firstDate: terms.startDate,
      lastDate: latest.date.slice(0, 10),
    });
  }

  return suggestions.sort((a, b) => b.payment - a.payment);
}
