import { containsWord, normalizeMerchantName } from '@/utils/parser';

export type Cadence = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'IRREGULAR';

export interface FixedCostRow {
  date: string;
  amount: number;
  merchant: string;
  rawDescription: string;
  category: string;
}

export interface MerchantProfile {
  key: string;
  category: string;
  count: number;
  monthsSeen: number;
  chargesPerMonth: number;
  cadence: Cadence;
  amountDeviation: number;
  daySpread: number;
}

export interface FixedScore {
  isFixed: boolean;
  confidence: number;
  reason: string;
}

export interface FixedRule {
  keyword: string;
  overrideState: string;
}

const FIXED_THRESHOLD = 0.6;

const STRONG_FIXED_CATEGORIES = new Set(['Housing', 'Loan & Insurance']);
const FIXED_CATEGORIES = new Set(['Utilities & Telecom', 'Childcare', 'Taxes & Municipal Fees']);
// Day-to-day spending: an identical monthly charge is still not enough on its own.
const STRONG_FLEXIBLE_CATEGORIES = new Set(['Groceries', 'Dining Out']);
const FLEXIBLE_CATEGORIES = new Set(['Transportation']);

const FIXED_EXPENSE_KEYWORDS = [
  // NL
  'HUUR', 'HYPOTHEEK', 'ZORGVERZEKERING', 'VERZEKERING', 'PREMIE', 'ENERGIE', 'ABONNEMENT',
  'CONTRIBUTIE', 'KINDEROPVANG', 'GEMEENTEBELASTING', 'WATERSCHAP', 'AFLOSSING',
  // EN
  'RENT', 'MORTGAGE', 'INSURANCE', 'SUBSCRIPTION', 'MEMBERSHIP', 'DAYCARE', 'TUITION',
  'INSTALLMENT', 'LEASE',
  // TR
  'KIRA', 'KİRA', 'AIDAT', 'AİDAT', 'SIGORTA', 'SİGORTA', 'ABONELIK', 'ABONELİK',
  // Telecom, streaming, energy, water, gym
  'ZIGGO', 'KPN', 'ODIDO', 'VODAFONE', 'T-MOBILE', 'TELE2', 'NETFLIX', 'SPOTIFY', 'ICLOUD',
  'DISNEY', 'HBO', 'VIDEOLAND', 'YOUTUBE PREMIUM', 'STEDIN', 'ENECO', 'ESSENT', 'VATTENFALL',
  'GREENCHOICE', 'BRABANT WATER', 'VITENS', 'EVIDES', 'HEALTHCITY', 'BASIC-FIT',
];

const FIXED_INCOME_KEYWORDS = [
  'SALARIS', 'SALARY', 'LOON', 'PAYROLL', 'MAAS', 'MAAŞ', 'PENSIOEN', 'PENSION',
  'TOESLAG', 'KINDERBIJSLAG', 'UITKERING',
];

const CADENCE_BANDS: { cadence: Cadence; min: number; max: number; label: string }[] = [
  { cadence: 'WEEKLY', min: 6, max: 8, label: 'Weekly' },
  { cadence: 'BIWEEKLY', min: 13, max: 15, label: 'Every 2 weeks' },
  { cadence: 'MONTHLY', min: 26, max: 33, label: 'Monthly' },
  { cadence: 'QUARTERLY', min: 83, max: 97, label: 'Quarterly' },
  { cadence: 'YEARLY', min: 350, max: 380, label: 'Yearly' },
];

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const toDayNumber = (date: string): number => {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  return Date.UTC(y, m - 1, d) / 86400000;
};

export function fixedMatchText(tx: Pick<FixedCostRow, 'merchant' | 'rawDescription'>): string {
  return (tx.merchant && tx.merchant !== 'Unknown' ? tx.merchant : tx.rawDescription || '')
    .toUpperCase()
    .trim();
}

/** Groups charges of the same merchant; reference numbers are stripped so they do not split a merchant. */
export function merchantKey(tx: Pick<FixedCostRow, 'merchant' | 'rawDescription' | 'amount'>): string {
  const name = normalizeMerchantName(fixedMatchText(tx))
    .replace(/\d{4,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `${tx.amount > 0 ? '+' : '-'}|${name}`;
}

function detectCadence(days: number[]): Cadence {
  if (days.length < 2) return 'IRREGULAR';
  const intervals = days.slice(1).map((day, i) => day - days[i]);
  const mid = median(intervals);
  const band = CADENCE_BANDS.find((b) => mid >= b.min && mid <= b.max);
  if (!band) return 'IRREGULAR';
  const inBand = intervals.filter((v) => v >= band.min && v <= band.max).length;
  return inBand / intervals.length >= 0.6 ? band.cadence : 'IRREGULAR';
}

function dayOfMonthSpread(daysOfMonth: number[]): number {
  if (daysOfMonth.length < 2) return 0;
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
  // Charges around the month boundary (30, 1, 31) are close together.
  const wrapped = daysOfMonth.map((d) => (d < 15 ? d + 30 : d));
  return Math.min(spread(daysOfMonth), spread(wrapped));
}

export function buildMerchantProfiles(rows: FixedCostRow[]): Map<string, MerchantProfile> {
  const groups = new Map<string, FixedCostRow[]>();
  for (const row of rows) {
    if (!row.amount || !row.date) continue;
    const key = merchantKey(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  const profiles = new Map<string, MerchantProfile>();
  for (const [key, group] of groups) {
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
    const days = Array.from(new Set(sorted.map((r) => toDayNumber(r.date)))).filter((d) => !isNaN(d));

    const perMonth = new Map<string, number>();
    for (const row of sorted) {
      const month = row.date.slice(0, 7);
      perMonth.set(month, (perMonth.get(month) ?? 0) + 1);
    }

    const amounts = sorted.map((r) => Math.abs(r.amount));
    const mid = median(amounts);
    const deviation = mid > 0 ? median(amounts.map((a) => Math.abs(a - mid))) / mid : 0;

    profiles.set(key, {
      key,
      category: sorted[sorted.length - 1].category,
      count: days.length,
      monthsSeen: perMonth.size,
      chargesPerMonth: median(Array.from(perMonth.values())),
      cadence: detectCadence(days),
      amountDeviation: deviation,
      daySpread: dayOfMonthSpread(sorted.map((r) => Number(r.date.slice(8, 10)))),
    });
  }
  return profiles;
}

export function hasFixedKeyword(text: string, isIncome: boolean): boolean {
  const upper = text.toUpperCase();
  const keywords = isIncome ? FIXED_INCOME_KEYWORDS : FIXED_EXPENSE_KEYWORDS;
  return keywords.some((kw) => containsWord(upper, kw));
}

/**
 * Weighted signals: cadence, amount stability, day of month, category and keywords.
 * `text` is the merchant plus raw description of the transaction being scored.
 */
export function scoreFixed(
  profile: MerchantProfile | undefined,
  category: string,
  text: string,
  isIncome: boolean = false,
  isDirectDebit: boolean = false
): FixedScore {
  let score = 0;
  const positives: string[] = [];
  let negative = '';

  const hasHistory = !!profile && profile.count >= 2;
  const regular =
    hasHistory &&
    profile.cadence !== 'IRREGULAR' &&
    profile.chargesPerMonth <= (profile.cadence === 'WEEKLY' ? 5 : profile.cadence === 'BIWEEKLY' ? 3 : 1) &&
    (profile.count >= 3 || profile.amountDeviation <= 0.05);

  if (regular) {
    score += 0.45;
    positives.push(CADENCE_BANDS.find((b) => b.cadence === profile.cadence)?.label ?? 'Recurring');
  }

  if (hasHistory) {
    if (profile.amountDeviation <= 0.05) {
      score += 0.3;
      positives.push('same amount');
    } else if (profile.amountDeviation <= 0.2) {
      score += 0.15;
      positives.push('similar amounts');
    }

    if (regular && profile.cadence === 'MONTHLY' && profile.daySpread <= 4) {
      score += 0.1;
    }

    if (profile.chargesPerMonth >= 2 && profile.amountDeviation > 0.2) {
      score -= 0.4;
      negative = 'Several charges per month, varying amounts';
    }
  }

  if (hasFixedKeyword(text, isIncome)) {
    score += isIncome ? 0.6 : 0.4;
    positives.push(isIncome ? 'regular income' : 'known recurring bill');
  }

  if (isDirectDebit && !isIncome) {
    score += 0.2;
    positives.push('direct debit');
  }

  if (!isIncome) {
    if (STRONG_FIXED_CATEGORIES.has(category)) {
      score += 0.6;
      positives.push(`${category} category`);
    } else if (FIXED_CATEGORIES.has(category)) {
      score += 0.35;
      positives.push(`${category} category`);
    } else if (STRONG_FLEXIBLE_CATEGORIES.has(category) || FLEXIBLE_CATEGORIES.has(category)) {
      score -= STRONG_FLEXIBLE_CATEGORIES.has(category) ? 0.45 : 0.25;
      if (!negative) negative = `${category} category, no fixed pattern`;
    }
  }

  const isFixed = score >= FIXED_THRESHOLD;
  const reason = isFixed
    ? capitalize(positives.slice(0, 2).join(', '))
    : negative || (hasHistory ? 'No regular pattern' : 'Not enough history');

  return { isFixed, confidence: Math.max(0, Math.min(1, score)), reason };
}

const capitalize = (value: string): string => (value ? value[0].toUpperCase() + value.slice(1) : value);

/** Most specific (longest) user rule whose keyword appears as a whole word in `text`. */
export function matchRule<T extends FixedRule>(text: string, rules: T[]): T | undefined {
  const upper = text.toUpperCase();
  let best: T | undefined;
  for (const rule of rules) {
    const keyword = rule.keyword.toUpperCase().trim();
    if (!containsWord(upper, keyword)) continue;
    if (!best || keyword.length > best.keyword.trim().length) best = rule;
  }
  return best;
}
