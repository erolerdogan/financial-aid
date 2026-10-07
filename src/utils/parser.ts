import type { CategoryRule, Transaction } from '@/db/database';
import {
  type BankId,
  type ColumnMap,
  detectBankFormat,
  detectHeaderlessBank,
  normalizeHeaderCell,
} from '@/utils/bankFormats';
import {
  classificationText,
  containsWord,
  containsWordStart,
  deriveMerchant,
  isGenericMerchant,
  splitJoinedWords,
} from '@/utils/merchantName';
import Papa from 'papaparse';
import XLSX from 'xlsx';

/**
 * Normalizes merchant names by stripping noisy transaction codes, dates,
 * card IDs, and common Dutch payment processor prefixes.
 */
 export function normalizeMerchantName(rawDescription: string): string {
  if (!rawDescription) return '';
  return rawDescription
    .toUpperCase()
    // Strips third-party Dutch/EU payment aggregators
    .replace(/(STG\s+MOLLIE\s+PAYMENTS|MOLLIE|PAY\.NL|MTA\*|CCV\*|SUMUP|IZETTLE|PAYPAL|STRIPE|\*)/g, '')
    .replace(/(NL\d{2}[A-Z]{4}\d{10}|PAS\d+|NR\d+|BSK\d+)/g, '')
    .replace(/\b\d{2}[/-]\d{2}[/-]\d{2,4}\b/g, '')
    .replace(/\b\d{4}[/-]\d{2}[/-]\d{2}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export { containsWord };

/** Bump when the built-in keywords change; stored rows are reclassified once on the next launch. */
export const CLASSIFIER_VERSION = 5;

/** No rule or keyword matched; these rows show up in the review list. */
export const UNCATEGORISED = 'Uncategorised';
/** Money coming in that no rule or keyword matched. */
export const INCOME_CATEGORY = 'Income';

export type TxType = 'DIRECT_DEBIT' | 'CARD' | 'ONLINE' | 'TRANSFER';

export interface BankDetails {
  /** Only set when the IBAN identifies the merchant (not a payment processor or iDEAL collector). */
  counterpartyIban: string | null;
  txType: TxType | null;
}

const PAYMENT_PROCESSORS =
  /MOLLIE|ADYEN|BUCKAROO|DERDENGELDEN|PAY\.NL|STRIPE|PAYPAL|KLARNA|MULTISAFEPAY|SUMUP|CCV|WORLDLINE|TIKKIE/i;

function detectTxType(text: string): TxType | null {
  if (/INCASSO|DIRECT DEBIT|DOMICILIER|\/CSID\//i.test(text)) return 'DIRECT_DEBIT';
  if (/\bIDEAL\b|\bWERO\b|ONLINE PAYMENT/i.test(text)) return 'ONLINE';
  if (/\b(BEA|GEA)\b|BETAALAUTOMAAT|GELDAUTOMAAT|BETAALPAS|APPLE PAY|GOOGLE PAY|CARD[ _]PAYMENT/i.test(text)) {
    return 'CARD';
  }
  if (/OVERBOEKING|OVERSCHRIJVING|ONLINE BANKIEREN|PERIODIEKE|TRANSFER|HAVALE|\bEFT\b/i.test(text)) {
    return 'TRANSFER';
  }
  return null;
}

// Bank type-code columns (ING "Code", Rabobank "Code").
const TX_TYPE_CODES: Record<string, TxType> = {
  IC: 'DIRECT_DEBIT', EI: 'DIRECT_DEBIT',
  BA: 'CARD', GM: 'CARD', BC: 'CARD', GA: 'CARD',
  ID: 'ONLINE',
  GT: 'TRANSFER', OV: 'TRANSFER', VZ: 'TRANSFER', CB: 'TRANSFER', TB: 'TRANSFER', SB: 'TRANSFER',
};

/** Counterparty IBAN and payment type, from dedicated columns when the bank has them, else from the text. */
export function extractBankDetails(
  description: string,
  columns: { iban?: string; type?: string } = {}
): BankDetails {
  const text = String(description ?? '');
  const typeCell = String(columns.type ?? '').trim();
  const txType =
    TX_TYPE_CODES[typeCell.toUpperCase()] ?? detectTxType(typeCell) ?? detectTxType(text);

  const ibanCell = String(columns.iban ?? '').replace(/\s+/g, '').toUpperCase();
  const fromText = text.match(/(?:\/IBAN\/|IBAN:\s*)([A-Z]{2}\d{2}[A-Z0-9]{8,30})/i);
  const iban = /^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(ibanCell)
    ? ibanCell
    : fromText
      ? fromText[1].toUpperCase()
      : null;

  const identifiesMerchant = iban && txType !== 'ONLINE' && txType !== 'CARD' && !PAYMENT_PROCESSORS.test(text);

  return { counterpartyIban: identifiesMerchant ? iban : null, txType };
}

/** Rule keyword for a merchant name: normalized, cut before any reference number. */
export function merchantRuleKeyword(name: string): string {
  const normalized = normalizeMerchantName(name);
  const prefix = normalized.split(/\s*\d{4,}/)[0].trim();
  return prefix.length >= 3 ? prefix : normalized;
}

/**
 * `parts` match anywhere (Dutch compounds: KREDIET in KREDIETEN, VERZEKER in ZORGVERZEKERING).
 * `words` must stand alone, for short or ambiguous tokens (NS, AH, BAR, GAS).
 */
const CATEGORY_KEYWORDS: { category: string; parts: string[]; words: string[] }[] = [
  {
    category: 'Childcare',
    parts: [
      'KINDEROPVANG', 'KINDERDAGVERBLIJF', 'GASTOUDER', 'PEUTERSPEELZAAL', 'BUITENSCHOOLSE',
      'KOREIN', 'BABYPARK', 'PAMPERS', 'PRENATAL', 'DAYCARE', 'NURSERY',
      'KINDERGARDEN', 'PARTOU', 'SMALLSTEPS', 'KIBEO', 'HUMANKIND', 'KINDERCENTR',
    ],
    words: ['BSO', 'BABY', 'CRECHE', 'KRES', 'KREŞ'],
  },
  {
    category: 'Housing',
    parts: [
      'HYPOTHEEK', 'MORTGAGE', 'VESTEDA', 'TULPENHUIS', 'WONINGSTICHTING', 'WOONSTICHTING',
      'WOONBEDRIJF', 'SERVICEKOSTEN',
      'YMERE', 'VESTIA', 'WOONINC', 'WOONBRON', 'STADGENOOT', 'HAVENSTEDER', 'HOLLAND2STAY',
      'HUURPENNINGEN', 'WOONCORPORATIE',
    ],
    words: ['HUUR', 'RENT', 'HOA', 'VVE', 'KIRA', 'KİRA', 'AIDAT', 'AİDAT'],
  },
  {
    category: 'Credit Card Payments',
    parts: [
      'CREDIT CARD', 'CREDITCARD', 'INT CARD SERVICES', 'AMERICAN EXPRESS', 'REMITLY',
      'KREDI KARTI', 'KREDİ KARTI',
    ],
    words: ['ICS', 'WISE'],
  },
  {
    category: 'Loan & Insurance',
    parts: [
      'KREDIET', 'LENING', 'LENDING', 'FINANCIERING', 'FINANCE', 'AFLOSSING', 'VERZEKER',
      'INSURANCE', 'ASSURANTIE', 'NEDASCO', 'ALLIANZ', 'AEGON', 'NATIONALE NEDERLANDEN',
      'CENTRAAL BEHEER', 'INTERPOLIS', 'ZILVEREN KRUIS', 'MENZIS', 'SIGORTA', 'SİGORTA',
      'KREDI', 'KREDİ',
      'CZ GROEP', 'ANDERZORG', 'ZORG EN ZEKERHEID', 'INSHARED', 'UNIGARANT', 'MONUTA',
      'RECHTSBIJSTAND', 'ACHMEA', 'DIENST UITVOERING ONDERWIJS', 'SANTANDER CONSUMER',
      'BNP PARIBAS PERSONAL',
    ],
    words: [
      'DSW', 'ONVZ', 'DELA', 'ARAG', 'FREO', 'DITZO', 'REAAL', 'LOAN', 'DUO', 'FBTO', 'OHRA',
      'UNIVE', 'VGZ', 'ASR',
    ],
  },
  {
    category: 'Groceries',
    parts: [
      'ALBERT HEIJN', 'JUMBO', 'LIDL', 'SUPERMARKT', 'SUPERMARKET', 'EKOPLAZA', 'DEKAMARKT',
      'HOOGVLIET', 'NETTORAMA', 'PICNIC', 'MIGROS', 'CARREFOUR',
      'AH TO GO', 'DIRK VDBROEK', 'JAN LINDERS', 'POIESZ', 'AMAZING ORIENTAL', 'SLAGERIJ',
      'BAKKERIJ', 'GROENTE', 'SOK MARKET', 'ŞOK MARKET', 'TESCO', 'EDEKA', 'DELHAIZE', 'COLRUYT',
      'KAUFLAND', 'AVANTAGE', 'KAASHANDEL', 'KAASBOER', 'MEATUPP', 'MEAT UPP', 'SLAGER', 'VLAAI',
      'VISHANDEL', 'NOTENSHOP',
    ],
    words: [
      'BONI', 'MARQT', 'FLINK', 'GETIR', 'GETİR', 'REWE', 'MARKT', 'MARKET', 'BAKKER', 'AH', 'ALDI',
      'SPAR', 'PLUS', 'COOP', 'DIRK', 'VOMAR', 'CRISP', 'BIM', 'A101', 'TOKO', 'BUTCHER',
    ],
  },
  {
    category: 'Dining Out',
    parts: [
      'RESTAURANT', 'UBER EATS', 'DELIVEROO', 'THUISBEZORGD', 'TAKEAWAY', 'MCDONALD', 'MC DONALD',
      'BURGER KING', 'STARBUCKS', 'DOMINOS', 'PIZZ', 'SUSHI', 'KEBAB', 'EETCAFE', 'BRASSERIE',
      'LUNCHROOM', 'LS DODO',
      'CAFETARIA', 'SNACKBAR', 'SMULLERS', 'LA PLACE', 'WAGAMAMA', 'VAPIANO', 'FIVE GUYS',
      'JUST EAT', 'YEMEKSEPETI', 'YEMEKSEPETİ', 'LOKANTA', 'RESTORAN', 'KOFFIE', 'COFFEE',
      'ESPRESSO', 'IJSSALON', 'PANNENKOEK', 'SHOARMA', 'EETHUIS', 'HMSHOST', 'FRIET', 'FRITES',
      'FRITUUR', 'MOVENPICK', 'MÖVENPICK', 'HAPPY ITALY', 'OLIEBOLLEN', 'SIMON LEVELT', 'PAVILJOEN',
      'TRATTORIA', 'RISTORANTE', 'STEAKHOUSE', 'BURGER', 'GELATO', 'CATERING', 'KANTINE',
    ],
    words: [
      'FEBO', 'DONER', 'DÖNER', 'PUB', 'CAFE', 'CAFÉ', 'BAR', 'BISTRO', 'KFC', 'SUBWAY', 'GRILL',
      'FOOD', 'FOODS', 'LUNCH', 'DINER', 'TEA', 'TEDS', 'RAMEN', 'TAPAS', 'CANON',
    ],
  },
  {
    category: 'Health & Care',
    parts: [
      'APOTHEEK', 'PHARMACY', 'ETOS', 'KRUIDVAT', 'HOSPITAL', 'ZIEKENHUIS', 'HUISARTS', 'TANDARTS',
      'FYSIO', 'CATHARINA', 'DOCTOR', 'DENTIST', 'OPTICIEN', 'SPECSAVERS', 'ECZANE', 'HASTANE',
      'DROGIST', 'HOLLAND & BARRETT', 'TANDHEELKUND', 'ORTHODONT', 'KLINIEK', 'CLINIC', 'PSYCHOLO',
      'INFOMEDICS', 'MEDISCH', 'PEARLE', 'HANS ANDERS', 'EYE WISH', 'KAPSALON', 'BASIC-FIT',
      'BASIC FIT', 'BASICFIT', 'FITNESS', 'SPORTSCHOOL', 'LACTATIEKUNDIGE', 'VERLOSKUND',
    ],
    words: ['BENU', 'FAMED', 'KAPPER', 'BARBER', 'GYM', 'GGD', 'MMC'],
  },
  {
    category: 'Financial Transfers',
    parts: [
      'TRANSFER', 'SAVINGS', 'SPAARREKENING', 'INVESTMENT', 'BELEGG', 'DEGIRO', 'MEESMAN',
      'BRAND NEW DAY', 'TRADE REPUBLIC', 'CANON PRODUCTION', 'OVERBOEKING', 'HAVALE',
      'SPAARGELD', 'EIGEN REKENING', 'OWN ACCOUNT', 'BITVAVO', 'COINBASE', 'BINANCE', 'ETORO',
      'FLATEX', 'SCALABLE CAPITAL', 'BIRIKIM', 'BİRİKİM', 'TRADING 212', 'REVOLUT', 'GELDMAAT',
      'GELDAUTOMAAT', 'STORTEN',
    ],
    words: ['PEAKS', 'VIRMAN', 'VİRMAN', 'TOPUP', 'TOP-UP', 'SPAREN', 'BUX', 'EFT', 'ATM'],
  },
  {
    category: 'Utilities & Telecom',
    parts: [
      'ELECTRICITY', 'ENERGIE', 'ENERGY', 'ZIGGO', 'VATTENFALL', 'ESSENT', 'ENECO', 'GREENCHOICE',
      'STEDIN', 'ENEXIS', 'LIANDER', 'BRABANT WATER', 'VITENS', 'EVIDES', 'WATERNET', 'DUNEA',
      'VODAFONE', 'T-MOBILE', 'ODIDO', 'TELE2', 'SIMYO', 'LEBARA', 'NETFLIX', 'SPOTIFY',
      'VIDEOLAND', 'DISNEY PLUS', 'DISNEY+', 'ICLOUD', 'YOUTUBE PREMIUM',
      'PURE ENERGIE', 'DELTA FIBER', 'YOUFONE', 'HOLLANDSNIEUWE', 'WATERBEDRIJF', 'AMAZON PRIME',
      'PRIME VIDEO', 'APPLE.COM/BILL', 'GOOGLE ONE', 'GOOGLE STORAGE', 'OPENAI', 'CHATGPT',
      'VIAPLAY', 'TURKCELL', 'TURK TELEKOM', 'TÜRK TELEKOM', 'ELEKTRIK', 'ELEKTRİK', 'DOGALGAZ',
      'DOĞALGAZ', 'BUDGET MOBIEL', 'BUDGET THUIS', 'BEN NEDERLAND', 'ESIM',
    ],
    words: [
      'OXXIO', 'ENGIE', 'SIMPEL', 'PWN', 'WML', 'OASEN', 'DAZN', 'IGDAS', 'İGDAŞ', 'ISKI', 'İSKİ',
      'GAS', 'WATER', 'KPN', 'HBO',
    ],
  },
  {
    category: 'Transportation',
    parts: [
      'SHELL', 'QWELLO', 'PARKING', 'PARKEREN', 'Q-PARK', 'NS-REIZEN', 'NS REIZIGERS', 'NS GROEP',
      'OV-CHIPKAART', 'OV CHIPKAART', 'TANKSTATION', 'TOTALENERGIES', 'TEXACO', 'FASTNED', 'ALLEGO',
      'ARRIVA', 'CONNEXXION', 'SWAPFIETS', 'GREENWHEELS', 'CHARGING',
      'OV-PAY', 'OVPAY', 'TRANSAVIA', 'RYANAIR', 'EASYJET', 'SCHIPHOL', 'FLIXBUS', 'EUROSTAR',
      'THALYS', 'TRANSLINK', 'PARKMOBILE', 'YELLOWBRICK', 'EASYPARK', 'PARKBEE', 'SHELL RECHARGE',
      'BLABLACAR', 'EUROPCAR', 'KWIK-FIT', 'KWIK FIT', 'AUTOBEDRIJF', 'CARWASH', 'WASSTRAAT',
      'QBUZZ', 'KEOLIS', 'PETROL OFISI', 'AKARYAKIT', 'ISTANBULKART', 'İSTANBULKART', 'OTOPARK',
      'AIRPORT', 'TANKSTELLE', 'PARKNCHARGE', 'TMCP', 'BETAALD PARK', 'BANDEN', 'VIGNET', 'PEGASUS',
      'TURKISH AIRLINES', 'LUFTHANSA', 'SUNEXPRESS', 'CORENDON', 'WIZZ AIR', 'BAGGAGE', 'ROAD B.V.',
    ],
    words: [
      'KLM', 'ANWB', 'HTM', 'RDW', 'AVIA', 'GULF', 'SIXT', 'HERTZ', 'TAXI', 'TAKSI', 'TAKSİ',
      'OPET', 'TAMOIL', 'TESLA', 'FELYX', 'GARAGE', 'BRENG', 'NS', 'EV', 'BP', 'ESSO', 'TINQ',
      'TANGO', 'GVB', 'RET', 'UBER', 'BOLT', 'CHARGE', 'ARAL', 'IATA',
    ],
  },
  {
    category: 'Taxes & Municipal Fees',
    parts: [
      'BELASTING', 'GEMEENTE', 'WATERSCHAP', 'HOOGHEEMRAADSCHAP', 'COCENSUS', 'CJIB', 'VERGI',
      'IMMIGRATIE EN NATURALISATIE',
    ],
    words: ['BSGR', 'SVHW', 'GBLT', 'TAX'],
  },
  {
    category: 'Shopping & Retail',
    parts: [
      'BOL.COM', 'AMAZON', 'COOLBLUE', 'MEDIAMARKT', 'MEDIA MARKT', 'ZALANDO', 'DECATHLON',
      'PRIMARK', 'WEHKAMP', 'BLOKKER', 'PRAXIS', 'KARWEI', 'HORNBACH', 'INTERTOYS', 'BIJENKORF',
      'ALIEXPRESS', 'SHEIN', 'VINTED', 'MARKTPLAATS', 'RITUALS', 'APPLE STORE',
      'WE FASHION', 'JACK & JONES', 'UNIQLO', 'ADIDAS', 'FOOT LOCKER', 'JD SPORTS', 'INTERSPORT',
      'PERRY SPORT', 'KWANTUM', 'LEEN BAKKER', 'FLYING TIGER', 'SOSTRENE', 'BIG BAZAR', 'SCAPINO',
      'VAN HAREN', 'BOEKHANDEL', 'ALLEKABELS', 'BAX MUSIC', 'ABOUT YOU', 'TRENDYOL', 'HEPSIBURADA',
      'LC WAIKIKI', 'BOYNER', 'TEKNOSA', 'INTRATUIN', 'TUINCENTRUM', 'WELKOOP', 'PETS PLACE',
      'BOUWMARKT', 'BERSHKA', 'PULL&BEAR', 'STRADIVARIUS', 'KLARNA', 'RIVERTY', 'AFTERPAY',
      'CORPORATE BENEFITS', 'JUWELIER', 'GSMPUNT', 'JOYBUY', 'BAUHAUS', 'LIFEGOODS', 'GROENRIJK',
      'TUINEN', 'COPPELMANS', 'FRUUGO', 'OUTLET', 'SOLOW', 'WOOLRICH', 'CK STORES', 'ZONWERING',
      'FIYO', 'RETAIL', 'WEBSHOP',
    ],
    words: [
      'C&A', 'BCC', 'EBAY', 'ETSY', 'NIKE', 'JYSK', 'ASOS', 'LEGO', 'MANGO', 'ZEEMAN', 'WIBRA',
      'BRUNA', 'BEVER', 'SNIPES', 'N11', 'HEMA', 'ACTION', 'IKEA', 'ZARA', 'GAMMA', 'H&M', 'TEMU',
      'XENOS', 'DOUGLAS', 'STORE', 'STORES', 'SHOP',
    ],
  },
];

/** Generic words that say something in a merchant name ("Shell Shop") but not in a memo. */
const NAME_ONLY_KEYWORDS = new Set([
  'TRANSFER', 'MARKET', 'MARKT', 'SHOP', 'STORE', 'STORES', 'RETAIL', 'FOOD', 'FOODS', 'BAR', 'TEA',
  'LUNCH', 'DINER', 'WATER', 'GAS', 'PLUS', 'CHARGE', 'FINANCE', 'BABY', 'OUTLET', 'WEBSHOP',
]);

/** Money coming in only keeps a built-in category when it is one of these; everything else is income. */
const INCOMING_CATEGORIES = new Set(['Financial Transfers']);
/** Payment-method words: on incoming money they describe how it arrived, not what it is. */
const INCOMING_IGNORED_KEYWORDS = new Set(['TRANSFER', 'OVERBOEKING', 'HAVALE', 'EFT']);

export interface KeywordMatch {
  category: string;
  keyword: string;
}

/**
 * Longest built-in keyword found in `text`, so "UBER EATS" beats "UBER" and "DISNEY PLUS" beats "PLUS".
 * Joined names are also tried split ("JD3001GammaEindhoven", "TeslaMotorsBV").
 */
export function matchKeywords(
  rawText: string,
  options: { allowNameOnly: boolean; incoming?: boolean }
): KeywordMatch | null {
  const base = normalizeMerchantName(rawText || '');
  if (!base) return null;
  const split = normalizeMerchantName(splitJoinedWords(rawText || ''));
  const text = split === base ? base : `${base} ${split}`;

  const allowed = (keyword: string): boolean =>
    (options.allowNameOnly || !NAME_ONLY_KEYWORDS.has(keyword)) &&
    !(options.incoming && INCOMING_IGNORED_KEYWORDS.has(keyword));

  let best: KeywordMatch | null = null;
  for (const { category, parts, words } of CATEGORY_KEYWORDS) {
    if (options.incoming && !INCOMING_CATEGORIES.has(category)) continue;
    for (const part of parts) {
      if (part.length > (best?.keyword.length ?? 0) && allowed(part) && text.includes(part)) {
        best = { category, keyword: part };
      }
    }
    for (const word of words) {
      if (word.length > (best?.keyword.length ?? 0) && allowed(word) && containsWord(text, word)) {
        best = { category, keyword: word };
      }
    }
  }
  return best;
}

/** Categories the user confirmed before, keyed by `learnedKey`. */
export interface LearnedCategories {
  byIban: Map<string, string>;
  byMerchant: Map<string, string>;
}

export interface ConfirmedRow {
  merchant: string | null;
  category: string;
  amount: number;
  counterpartyIban: string | null;
}

const MIN_CONFIRMED_ROWS = 2;
const MIN_AGREEMENT = 2 / 3;

/** Income and expenses of one merchant are learned separately. */
const learnedKey = (amount: number, value: string): string => `${amount > 0 ? '+' : '-'}|${value}`;

const learnedMerchantKeyword = (merchant: string | null | undefined): string => {
  if (isGenericMerchant(merchant)) return '';
  const keyword = merchantRuleKeyword(merchant ?? '');
  return keyword.length >= 3 ? keyword : '';
};

/**
 * What the user's own confirmed rows say about an IBAN or merchant. A key only counts with at least
 * two confirmed rows that mostly agree, so a one-off edit does not recategorise a whole merchant.
 */
export function buildLearnedCategories(rows: ConfirmedRow[]): LearnedCategories {
  const ibanVotes = new Map<string, Map<string, number>>();
  const merchantVotes = new Map<string, Map<string, number>>();
  const vote = (votes: Map<string, Map<string, number>>, key: string, category: string) => {
    const tally = votes.get(key) ?? new Map<string, number>();
    tally.set(category, (tally.get(category) ?? 0) + 1);
    votes.set(key, tally);
  };

  for (const row of rows) {
    if (!row.category || row.category === UNCATEGORISED) continue;
    if (row.counterpartyIban) {
      vote(ibanVotes, learnedKey(row.amount, row.counterpartyIban.toUpperCase()), row.category);
    }
    const keyword = learnedMerchantKeyword(row.merchant);
    if (keyword) vote(merchantVotes, learnedKey(row.amount, keyword), row.category);
  }

  const settle = (votes: Map<string, Map<string, number>>): Map<string, string> => {
    const settled = new Map<string, string>();
    for (const [key, tally] of votes) {
      let total = 0;
      let top = '';
      let topCount = 0;
      for (const [category, count] of tally) {
        total += count;
        if (count > topCount) {
          top = category;
          topCount = count;
        }
      }
      if (total >= MIN_CONFIRMED_ROWS && topCount / total >= MIN_AGREEMENT) settled.set(key, top);
    }
    return settled;
  };

  return { byIban: settle(ibanVotes), byMerchant: settle(merchantVotes) };
}

/** The IBAN is the stronger signal; the merchant name is the fallback. */
export function lookupLearnedCategory(
  learned: LearnedCategories | undefined,
  tx: { merchant?: string | null; iban?: string | null; amount: number }
): string | null {
  if (!learned) return null;
  if (tx.iban) {
    const byIban = learned.byIban.get(learnedKey(tx.amount, tx.iban.toUpperCase()));
    if (byIban) return byIban;
  }
  const keyword = learnedMerchantKeyword(tx.merchant);
  return (keyword && learned.byMerchant.get(learnedKey(tx.amount, keyword))) || null;
}

/** An IBAN rule wins; otherwise the longest text rule that matches a whole word (or a word start for 5+ chars). */
function matchCustomRule(text: string, iban: string, rules: CategoryRule[]): string | null {
  let best: string | null = null;
  let bestLength = 0;
  for (const rule of rules) {
    const keyword = rule.keyword.toUpperCase().trim();
    if (!keyword) continue;
    if (keyword === iban) return rule.category;
    if (keyword.length <= bestLength) continue;
    const matches = keyword.length >= 5 ? containsWordStart(text, keyword) : containsWord(text, keyword);
    if (matches) {
      best = rule.category;
      bestLength = keyword.length;
    }
  }
  return best;
}

/**
 * Multi-Tiered Classification Engine:
 * 1. Custom User Rules (category_rules); a rule keyword can be a text fragment or a counterparty IBAN
 * 2. What the user confirmed before for the same IBAN or merchant
 * 3. Built-in keywords in the merchant name
 * 4. Built-in keywords in the whole bank text, without the name-only words
 * 5. Fallback: 'Income' for money coming in, otherwise 'Uncategorised'
 */
export function classifyTransaction(
  source: { merchant?: string | null; rawDescription: string },
  customRules: CategoryRule[] = [],
  details: { iban?: string | null; amount?: number; learned?: LearnedCategories } = {}
): string {
  const amount = details.amount ?? 0;
  const incoming = amount > 0;
  const fallback = incoming ? INCOME_CATEGORY : UNCATEGORISED;
  const iban = details.iban ? details.iban.toUpperCase() : '';
  const merchant = isGenericMerchant(source.merchant) ? '' : (source.merchant ?? '');
  const rawDescription = source.rawDescription || '';
  if (!merchant && !rawDescription && !iban) return fallback;

  const ruled = matchCustomRule(
    normalizeMerchantName(classificationText(merchant, rawDescription)),
    iban,
    customRules
  );
  if (ruled) return ruled;

  const learnt = lookupLearnedCategory(details.learned, { merchant, iban, amount });
  if (learnt) return learnt;

  const byName = merchant ? matchKeywords(merchant, { allowNameOnly: true, incoming }) : null;
  const byText = matchKeywords(rawDescription, { allowNameOnly: false, incoming });
  // The bank text may be more specific than the name: "AMAZON PRIME" for the merchant "Amazon".
  if (byName && byText && byText.keyword.length > byName.keyword.length && byText.keyword.includes(byName.keyword)) {
    return byText.category;
  }
  return (byName ?? byText)?.category ?? fallback;
}

function parseLocaleAmount(raw: any): { magnitude: number; isNegative: boolean } | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'number') {
    if (isNaN(raw)) return null;
    return {
      magnitude: Math.abs(raw),
      isNegative: raw < 0,
    };
  }

  let str = String(raw).replace(/\\/g, '').replace(/["']/g, '').trim();
  if (!str) return null;

  const parenNegative = /^\(.*\)$/.test(str);
  if (parenNegative) str = str.slice(1, -1);

  let explicitNegative = false;
  if (/^-/.test(str)) {
    explicitNegative = true;
    str = str.slice(1);
  } else if (/^\+/.test(str)) {
    str = str.slice(1);
  }

  str = str.replace(/[^0-9.,]/g, '');
  if (!str) return null;

  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');

  let normalized: string;

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      normalized = str.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = str.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    const decimalDigits = str.length - lastComma - 1;
    normalized = decimalDigits === 1 || decimalDigits === 2
      ? str.replace(',', '.')
      : str.replace(/,/g, '');
  } else if (lastDot !== -1) {
    const decimalDigits = str.length - lastDot - 1;
    normalized = decimalDigits === 1 || decimalDigits === 2
      ? str
      : str.replace(/\./g, '');
  } else {
    normalized = str;
  }

  const magnitude = Number(parseFloat(normalized).toFixed(2));
  if (isNaN(magnitude)) return null;

  return { magnitude, isNegative: parenNegative || explicitNegative };
}

function resolveDate(raw: any, dayFirst = false): { iso: string; ambiguous: boolean } | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw)
    .replace(/\\/g, '')
    .replace(/["']/g, '')
    .trim()
    // Drop a time part: "2024-02-01 10:11:12", "2024-02-01T10:11:12Z"
    .replace(/[T ]\d{1,2}:\d{2}.*$/, '');

  if (/^\d{8}$/.test(str)) {
    const y = str.substring(0, 4);
    const m = str.substring(4, 6);
    const d = str.substring(6, 8);
    return { iso: `${y}-${m}-${d}`, ambiguous: false };
  }

  if (!isNaN(Number(str)) && Number(str) > 30000 && Number(str) < 60000) {
    const parsedDate = XLSX.SSF.parse_date_code(Number(str));
    if (parsedDate) {
      const y = parsedDate.y;
      const m = String(parsedDate.m).padStart(2, '0');
      const d = String(parsedDate.d).padStart(2, '0');
      return { iso: `${y}-${m}-${d}`, ambiguous: false };
    }
  }

  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return { iso: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`, ambiguous: false };
  }

  const yearLastMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (yearLastMatch) {
    const [, a, b, y] = yearLastMatch;
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);

    if (numA > 12 && numB <= 12) {
      return { iso: `${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`, ambiguous: false };
    }
    if (numB > 12 && numA <= 12) {
      return { iso: `${y}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`, ambiguous: false };
    }
    if (numA <= 12 && numB <= 12) {
      return { iso: `${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`, ambiguous: !dayFirst };
    }
    return null;
  }

  return null;
}

/** How a row was stored before its bank's format was recognised; only used to detect duplicates. */
export interface PreviousKey {
  date: string;
  amount: number;
  rawDescription: string;
}

export type ParsedTransaction = Omit<Transaction, 'id'> & {
  /** The single cell older versions stored as rawDescription; only used to detect duplicates. */
  legacyRawDescription?: string;
  previousKeys?: PreviousKey[];
};

export interface ParsedStatement {
  transactions: ParsedTransaction[];
  /** The bank whose export layout was recognised, `null` when the columns were guessed. */
  bank: BankId | null;
}

const DATE_HEADER = /transactiondate|trans_date|datum|date|tarih/i;
const SECONDARY_DATE_HEADER = /rente|interest|valu|completed/i;
const AMOUNT_HEADER = /amount|bedrag|tutar|miktar/i;
const NOT_AMOUNT_HEADER = /saldo|balance|bakiye|fee|foreign|vreemde/i;
const DEBIT_HEADER = /^(debit|debet|af|bor[çc]|withdrawals?|paid out|money out|uitgaven|debit amount|[çc][ıi]kan)$/i;
const CREDIT_HEADER = /^(credit|bij|alacak|deposits?|paid in|money in|inkomsten|credit amount|giren)$/i;
// ING "Af Bij": amounts are unsigned and this column says which way the money went.
const SIGN_HEADER = /^(af ?\/? ?bij|debit ?\/ ?credit|credit ?\/ ?debit|debit credit|d\/c|dc|bor[çc] ?\/ ?alacak|b\/a)$/i;
const DEBIT_MARK = /^(af|debit|debet|d|dr|bor[çc]|b|-)$/i;
const IBAN_HEADER = /tegenrekening|counterparty (iban|account)|iban tegenpartij|counter account|^counterparty$/i;
const TYPE_HEADER = /^(code|mutatiesoort|mutationcode|transaction type|type|soort)$/i;
const NAME_HEADER = /naam|name|payee|merchant|tegenpartij|al[ıi]c[ıi]|beneficiary/i;
const NOT_NAME_HEADER = /account|rekening|iban/i;
const MEMO_HEADER = /omschrijving|mededeling|description|notifications|payment reference|^reference$|a[çc][ıi]klama|details|memo|^notes?$/i;

// Column choice of earlier versions, kept so re-imported statements still match stored rows.
const LEGACY_IBAN_HEADER = /tegenrekening|counterparty (iban|account)|iban tegenpartij|counter account/i;
const LEGACY_DESC_HEADER = /description|omschrijving|naam|details|açıklama|aciklama|memo|payee|merchant/i;

const cleanCell = (value: any): string =>
  String(value ?? '').replace(/\\/g, '').replace(/\s+/g, ' ').trim();

function detectColumns(cells: string[]): ColumnMap | null {
  let date = cells.findIndex((c) => DATE_HEADER.test(c) && !SECONDARY_DATE_HEADER.test(c));
  if (date === -1) date = cells.findIndex((c) => DATE_HEADER.test(c));

  const debit = cells.findIndex((c) => DEBIT_HEADER.test(c));
  const credit = cells.findIndex((c) => CREDIT_HEADER.test(c));
  const split = debit !== -1 && credit !== -1;
  const amount = split
    ? -1
    : cells.findIndex((c, i) => i !== date && AMOUNT_HEADER.test(c) && !NOT_AMOUNT_HEADER.test(c));

  if (date === -1 || (amount === -1 && !split)) return null;

  const iban = cells.findIndex((c) => IBAN_HEADER.test(c));
  const used = new Set([date, amount, debit, credit, iban]);
  const name = cells.findIndex((c, i) => !used.has(i) && NAME_HEADER.test(c) && !NOT_NAME_HEADER.test(c));
  const memos = cells.flatMap((c, i) => (i !== name && !used.has(i) && MEMO_HEADER.test(c) ? [i] : []));

  let legacyDesc = -1;
  let legacyIban = -1;
  cells.forEach((c, i) => {
    if (LEGACY_IBAN_HEADER.test(c) && legacyIban === -1) legacyIban = i;
    else if (LEGACY_DESC_HEADER.test(c) && legacyDesc === -1) legacyDesc = i;
  });
  if (legacyDesc === -1) legacyDesc = cells.length > 2 ? 1 : 0;
  if (name === -1 && memos.length === 0) memos.push(legacyDesc);

  return {
    date,
    amount,
    debit: split ? debit : -1,
    credit: split ? credit : -1,
    sign: cells.findIndex((c) => SIGN_HEADER.test(c)),
    iban,
    type: cells.findIndex((c) => TYPE_HEADER.test(c)),
    name,
    memos,
    legacyDesc,
  };
}

/** Column positions for a file without a recognisable header row. */
function positionalColumns(rows: any[][]): ColumnMap {
  const maxCols = Math.max(...rows.slice(0, 10).map((r) => r?.length || 0));
  const [date, amount, desc] = maxCols >= 8 ? [2, 6, 7] : [0, 1, 2];
  return {
    date, amount, debit: -1, credit: -1, sign: -1, iban: -1, type: -1, name: -1,
    memos: [desc], legacyDesc: desc,
  };
}

function readAmount(row: any[], cols: ColumnMap): number | null {
  const fee = cols.fee !== undefined ? parseLocaleAmount(row[cols.fee])?.magnitude ?? 0 : 0;

  if (cols.direction !== undefined) {
    const direction = cleanCell(row[cols.direction]).toUpperCase();
    if (direction === 'OUT') {
      const sent = parseLocaleAmount(row[cols.amount]);
      return sent ? -(sent.magnitude + fee) : null;
    }
    if (direction === 'IN') {
      const received = parseLocaleAmount(row[cols.amountIn ?? cols.amount]);
      return received ? received.magnitude : null;
    }
    // Anything else is a conversion between the user's own balances.
    return null;
  }

  if (cols.amount !== -1) {
    const amountResult = parseLocaleAmount(row[cols.amount]);
    if (!amountResult) return null;
    const isDebit =
      amountResult.isNegative || (cols.sign !== -1 && DEBIT_MARK.test(cleanCell(row[cols.sign])));
    return (isDebit ? -amountResult.magnitude : amountResult.magnitude) - fee;
  }

  const debit = parseLocaleAmount(row[cols.debit]);
  const credit = parseLocaleAmount(row[cols.credit]);
  if (!debit && !credit) return null;
  return (credit?.magnitude ?? 0) - (debit?.magnitude ?? 0);
}

interface RowReading {
  date: { iso: string; ambiguous: boolean };
  amount: number;
  name: string;
  memo: string;
  description: string;
  legacyDesc: string;
}

/** One statement row read through a column map, or `null` when it is not a transaction. */
function readRow(row: any[], cols: ColumnMap): RowReading | null {
  const rawDate = row[cols.date];
  if (rawDate === undefined) return null;

  const cleanedHeaderCheck = String(rawDate).replace(/[\"\\]/g, '').trim();
  if (DATE_HEADER.test(cleanedHeaderCheck) || AMOUNT_HEADER.test(cleanedHeaderCheck)) return null;

  if (cols.status !== undefined && cols.keepStatus) {
    const status = cleanCell(row[cols.status]);
    if (status && !cols.keepStatus.test(status)) return null;
  }

  const signedAmount = readAmount(row, cols);
  if (signedAmount === null) return null;
  const amount = Number(signedAmount.toFixed(2));

  const date = resolveDate(rawDate, cols.dayFirst);
  if (!date) return null;

  const memoCells = cols.memos.map((idx) => cleanCell(row[idx])).filter(Boolean);
  const sideColumns = amount < 0 ? cols.nameOut : cols.nameIn;
  // Columns in file order, or the counterparty of this row's side in front of the memo.
  const textColumns = sideColumns
    ? [sideColumns.find((idx) => cleanCell(row[idx])) ?? -1, ...cols.memos]
    : [cols.name, ...cols.memos].sort((a, b) => a - b);

  let name = cleanCell(row[sideColumns ? textColumns[0] : cols.name]);
  if (!name && cols.nameFromMemo) {
    for (const memo of memoCells) {
      name = memo.match(cols.nameFromMemo)?.[1]?.trim() ?? '';
      if (name) break;
    }
  }

  const texts: string[] = [];
  for (const idx of textColumns) {
    const text = idx === -1 ? '' : cleanCell(row[idx]);
    if (text && !texts.some((t) => t.toUpperCase() === text.toUpperCase())) texts.push(text);
  }

  return {
    date,
    amount,
    name,
    memo: memoCells.join(' '),
    description: texts.join(' '),
    legacyDesc: cleanCell(row[cols.legacyDesc]),
  };
}

function parseMatrixData(
  rows: any[][],
  customRules: CategoryRule[] = [],
  learned?: LearnedCategories
): ParsedStatement {
  if (!rows || rows.length === 0) return { transactions: [], bank: null };

  let cols: ColumnMap | null = null;
  // What the header guess of earlier versions made of a bank's file, to recognise rows they stored.
  let previousCols: ColumnMap | null = null;
  let bank: BankId | null = null;
  let startRowIndex = 0;

  const headerRows = Math.min(rows.length, 20);
  const genericCells = (r: number) =>
    // Header cells are short labels; long cells are data or preamble text.
    Array.from(rows[r] || [], (c) => {
      const cell = String(c ?? '').replace(/[\"\\]/g, '').toLowerCase().replace(/\u0307/g, '').trim();
      return cell.length <= 40 ? cell : '';
    });

  for (let r = 0; r < headerRows; r++) {
    const detected = detectBankFormat(Array.from(rows[r] || [], normalizeHeaderCell));
    if (detected) {
      previousCols = detectColumns(genericCells(r)) ?? positionalColumns(rows);
      cols = { ...detected.columns, legacyDesc: previousCols.legacyDesc };
      bank = detected.bank;
      startRowIndex = r + 1;
      break;
    }
  }

  for (let r = 0; !cols && r < headerRows; r++) {
    cols = detectColumns(genericCells(r));
    if (cols) startRowIndex = r + 1;
  }

  if (!cols) {
    const headerless = detectHeaderlessBank(rows);
    cols = headerless?.columns ?? positionalColumns(rows);
    bank = headerless?.bank ?? null;
  }

  const transactions: ParsedTransaction[] = [];

  for (let i = startRowIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const reading = readRow(row, cols);
    if (!reading) continue;

    const { amount, name } = reading;
    const originalDesc = reading.description;
    const dateResult = reading.date;

    const previous = previousCols ? readRow(row, previousCols) : null;
    const previousKeys: PreviousKey[] = [];
    if (
      previous &&
      (previous.amount !== amount ||
        previous.description !== originalDesc ||
        previous.date.iso !== dateResult.iso)
    ) {
      for (const rawDescription of new Set([previous.description, previous.legacyDesc])) {
        previousKeys.push({ date: previous.date.iso, amount: previous.amount, rawDescription });
      }
    }

    const monthName = dateResult.iso.substring(0, 7);
    const bankDetails = extractBankDetails(originalDesc, {
      iban: cols.iban !== -1 ? row[cols.iban] : undefined,
      type: cols.type !== -1 ? row[cols.type] : undefined,
    });
    const merchant = deriveMerchant({
      description: originalDesc,
      name,
      memo: reading.memo,
      txType: bankDetails.txType,
    });
    const category = classifyTransaction({ merchant, rawDescription: originalDesc }, customRules, {
      iban: bankDetails.counterpartyIban,
      amount,
      learned,
    });

    transactions.push({
      date: dateResult.iso,
      amount,
      rawDescription: originalDesc,
      legacyRawDescription: reading.legacyDesc,
      ...(previousKeys.length > 0 ? { previousKeys } : {}),
      merchant,
      category,
      monthName,
      counterpartyIban: bankDetails.counterpartyIban,
      txType: bankDetails.txType,
      isZeroFlagged: amount === 0 ? 1 : 0,
      dateAmbiguous: dateResult.ambiguous ? 1 : 0,
    });
  }

  return { transactions, bank };
}

export function parseExcelContent(
  fileData: ArrayBuffer | string,
  customRules: CategoryRule[] = [],
  learned?: LearnedCategories
): ParsedStatement {
  const empty: ParsedStatement = { transactions: [], bank: null };
  if (!fileData) return empty;

  let workbook: XLSX.WorkBook | null = null;

  try {
    if (fileData instanceof ArrayBuffer) {
      const dataArray = new Uint8Array(fileData);
      workbook = XLSX.read(dataArray, { type: 'array' });
    } else {
      let cleanData = String(fileData).trim();
      if (cleanData.includes(',')) {
        cleanData = cleanData.split(',')[1];
      }
      cleanData = cleanData.replace(/[\r\n\s]/g, '');
      workbook = XLSX.read(cleanData, { type: 'base64' });
    }
  } catch (e) {
    console.error('Failed to parse Excel workbook:', e);
    return empty;
  }

  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) return empty;

  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) return empty;

  const rawMatrixRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: true });
  return parseMatrixData(rawMatrixRows, customRules, learned);
}

export function parseCSVContent(
  csvText: string,
  customRules: CategoryRule[] = [],
  learned?: LearnedCategories
): ParsedStatement {
  if (!csvText) return { transactions: [], bank: null };

  let cleaned = csvText
    .replace(/[\uFEFF\uFFFD\0]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  const parsed = Papa.parse<string[]>(cleaned, {
    header: false,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
  });

  return parseMatrixData(parsed.data || [], customRules, learned);
}
