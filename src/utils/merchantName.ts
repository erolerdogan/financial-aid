const isWordChar = (ch: string): boolean =>
  ch.toUpperCase() !== ch.toLowerCase() || (ch >= '0' && ch <= '9');

/** True when `word` occurs in `text` and is not part of a longer word. Both must be uppercase. */
export function containsWord(text: string, word: string): boolean {
  if (!word) return false;
  let from = 0;
  while (true) {
    const index = text.indexOf(word, from);
    if (index === -1) return false;
    const before = index > 0 ? text[index - 1] : '';
    const after = text[index + word.length] ?? '';
    if (!(before && isWordChar(before)) && !(after && isWordChar(after))) return true;
    from = index + 1;
  }
}

/** "JD3001GammaEindhoven" -> "JD3001 Gamma Eindhoven", "TeslaMotorsBV" -> "Tesla Motors BV". */
export function splitJoinedWords(text: string): string {
  return text
    .replace(/([\p{Ll}\d])(\p{Lu}\p{Ll})/gu, '$1 $2')
    .replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2');
}

export interface MerchantSource {
  /** Full bank text of the row. */
  description: string;
  /** Counterparty name column, when the bank has one. */
  name?: string;
  /** Memo / reference columns, when separate from the name. */
  memo?: string;
  txType?: string | null;
}

const TX_TYPE_LABELS: Record<string, string> = {
  CARD: 'Card payment',
  DIRECT_DEBIT: 'Direct debit',
  ONLINE: 'Online payment',
  TRANSFER: 'Transfer',
};

const FALLBACK_LABEL = 'Bank Transaction';
const GENERIC_NAMES = new Set([...Object.values(TX_TYPE_LABELS), FALLBACK_LABEL, 'Unknown']);
const MAX_LENGTH = 40;

/** `words` must stand alone, `parts` match anywhere. The longest match wins. */
const MERCHANT_ALIASES: { name: string; words?: string[]; parts?: string[] }[] = [
  { name: 'Albert Heijn', words: ['AH'], parts: ['ALBERT HEIJN'] },
  { name: 'AH to go', parts: ['AH TO GO', 'AH TOGO'] },
  { name: 'Jumbo', parts: ['JUMBO'] },
  { name: 'Lidl', words: ['LIDL'] },
  { name: 'Aldi', words: ['ALDI'] },
  { name: 'Dirk', parts: ['DIRK VDBROEK', 'DIRK VAN DEN BROEK'] },
  { name: 'Picnic', words: ['PICNIC'] },
  { name: 'Ekoplaza', parts: ['EKOPLAZA'] },
  { name: 'Hema', words: ['HEMA'] },
  { name: 'Kruidvat', parts: ['KRUIDVAT'] },
  { name: 'Etos', words: ['ETOS'] },
  { name: 'Action', words: ['ACTION'] },
  { name: 'IKEA', words: ['IKEA'] },
  { name: 'Bol.com', parts: ['BOL.COM', 'BOL COM'] },
  { name: 'Coolblue', parts: ['COOLBLUE'] },
  { name: 'MediaMarkt', parts: ['MEDIAMARKT', 'MEDIA MARKT'] },
  { name: 'Zalando', parts: ['ZALANDO'] },
  { name: 'Amazon', parts: ['AMAZON', 'AMZN'] },
  { name: 'Decathlon', parts: ['DECATHLON'] },
  { name: 'Primark', parts: ['PRIMARK'] },
  { name: 'H&M', words: ['H&M', 'H & M'], parts: ['HENNES'] },
  { name: 'Zara', words: ['ZARA'] },
  { name: 'Gamma', words: ['GAMMA'] },
  { name: 'Praxis', words: ['PRAXIS'] },
  { name: 'Karwei', words: ['KARWEI'] },
  { name: 'Hornbach', parts: ['HORNBACH'] },
  { name: 'Blokker', parts: ['BLOKKER'] },
  { name: 'Xenos', words: ['XENOS'] },
  { name: 'Rituals', words: ['RITUALS'] },
  { name: 'Wehkamp', parts: ['WEHKAMP'] },
  { name: 'AliExpress', parts: ['ALIEXPRESS'] },
  { name: 'Temu', words: ['TEMU'] },
  { name: 'Shein', words: ['SHEIN'] },
  { name: 'Vinted', words: ['VINTED'] },
  { name: 'Marktplaats', parts: ['MARKTPLAATS'] },
  { name: 'Shell', words: ['SHELL'] },
  { name: 'Esso', words: ['ESSO'] },
  { name: 'TinQ', words: ['TINQ'] },
  { name: 'TotalEnergies', parts: ['TOTALENERGIES'] },
  { name: 'Fastned', parts: ['FASTNED'] },
  { name: 'Q-Park', parts: ['Q-PARK', 'Q PARK'] },
  { name: 'NS', parts: ['NS GROEP', 'NS REIZIGERS', 'NS-REIZIGERS', 'NS-REIZEN', 'NS INTERNATIONAL'] },
  { name: 'OV-chipkaart', parts: ['OV-CHIPKAART', 'OV CHIPKAART'] },
  { name: 'Swapfiets', parts: ['SWAPFIETS'] },
  { name: 'Greenwheels', parts: ['GREENWHEELS'] },
  { name: 'Uber', words: ['UBER'] },
  { name: 'Uber Eats', parts: ['UBER EATS', 'UBEREATS'] },
  { name: 'Thuisbezorgd', parts: ['THUISBEZORGD'] },
  { name: 'Deliveroo', parts: ['DELIVEROO'] },
  { name: "McDonald's", parts: ['MCDONALD', 'MC DONALD'] },
  { name: 'Burger King', parts: ['BURGER KING'] },
  { name: 'Starbucks', parts: ['STARBUCKS'] },
  { name: 'KFC', words: ['KFC'] },
  { name: "Domino's", parts: ['DOMINOS', "DOMINO'S", 'DOMINO S '] },
  { name: 'Netflix', parts: ['NETFLIX'] },
  { name: 'Spotify', parts: ['SPOTIFY'] },
  { name: 'Disney+', parts: ['DISNEY PLUS', 'DISNEY+', 'DISNEYPLUS'] },
  { name: 'Videoland', parts: ['VIDEOLAND'] },
  { name: 'Apple', parts: ['APPLE.COM/BILL', 'APPLE.COM', 'APPLE STORE', 'ITUNES'] },
  { name: 'Google', words: ['GOOGLE'] },
  { name: 'Ziggo', words: ['ZIGGO'] },
  { name: 'KPN', words: ['KPN'] },
  { name: 'Vodafone', parts: ['VODAFONE'] },
  { name: 'Odido', words: ['ODIDO'] },
  { name: 'T-Mobile', parts: ['T-MOBILE'] },
  { name: 'Vattenfall', parts: ['VATTENFALL'] },
  { name: 'Essent', words: ['ESSENT'] },
  { name: 'Eneco', words: ['ENECO'] },
  { name: 'Greenchoice', parts: ['GREENCHOICE'] },
  { name: 'Basic-Fit', parts: ['BASIC-FIT', 'BASIC FIT', 'BASICFIT'] },
  { name: 'Booking.com', parts: ['BOOKING.COM'] },
  { name: 'Airbnb', parts: ['AIRBNB'] },
  { name: 'Ryanair', parts: ['RYANAIR'] },
  { name: 'Transavia', parts: ['TRANSAVIA'] },
  { name: 'KLM', words: ['KLM'] },
  { name: 'Geldmaat', parts: ['GELDMAAT'] },
  { name: 'Trading 212', parts: ['TRADING 212'] },
  { name: 'Revolut', parts: ['REVOLUT'] },
  { name: 'Klarna', parts: ['KLARNA'] },
  { name: 'Migros', parts: ['MIGROS'] },
  { name: 'Carrefour', parts: ['CARREFOUR'] },
  { name: 'BİM', words: ['BIM', 'BİM'] },
  { name: 'A101', words: ['A101'] },
  { name: 'Şok', parts: ['SOK MARKET', 'ŞOK MARKET'], words: ['ŞOK'] },
  { name: 'Trendyol', parts: ['TRENDYOL'] },
  { name: 'Hepsiburada', parts: ['HEPSIBURADA'] },
  { name: 'Getir', words: ['GETIR', 'GETİR'] },
  { name: 'Yemeksepeti', parts: ['YEMEKSEPETI', 'YEMEKSEPETİ'] },
];

const PROCESSOR_NAMES = 'MOLLIE|ADYEN|BUCKAROO|TIKKIE|MULTISAFEPAY|PAY\\.NL|WORLDLINE|SUMUP|KLARNA|STRIPE';

const NOISE_PATTERNS: RegExp[] = [
  // "CCV*Bakkerij", "SumUp *Kapper", "ZETTLE_*Markt", "PAYPAL *SPOTIFY"
  /(?:^|\s)(?:CCV|SUMUP|I?ZETTLE|PAYPAL|MTA|SQ|PAY\.NL|MOLLIE|ADYEN|BCK|MSP|TMC)\s*[_*]+\s*/gi,
  // "Coolblue via Mollie", "Shop by Adyen"
  new RegExp(`\\s+(?:VIA|BY)\\s+(?:(?:STICHTING|STG)\\s+)?(?:${PROCESSOR_NAMES})\\b.*$`, 'gi'),
  // "Stichting Mollie Payments", "Stg Derdengelden Buckaroo"
  new RegExp(
    `(?:STICHTING|STG)\\.?\\s+(?:DERDENGELDEN\\s+)?(?:${PROCESSOR_NAMES})(?:\\s+PAYMENTS?)?`,
    'gi'
  ),
  /(?:STICHTING|STG)\.?\s+DERDENGELDEN/gi,
  // Labelled references: "PAS123", "NR:AB12CD", "Kenmerk: 123", "Term: XY12"
  /\bPAS\s*\d+/gi,
  /\b(?:NR|PASVOLGNR|TRANSACTIE|TERM|KENMERK|MACHTIGING(?:\s+ID)?|INCASSANT(?:\s+ID)?|VALUTADATUM|LAND|IBAN|BIC|REF|EREF|MARF|CSID)\s*:\s*\S+/gi,
  // Masked card numbers
  /\b\d{4,6}[*xX]{2,}\d{2,4}\b/g,
  /\*{2,}\d{2,4}\b/g,
  // Dates with an optional time: "01.02.24/12:34", "01-02-2024 12:34", "2024-02-01"
  /\b\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}(?:[/ ]\d{1,2}[:.]\d{2}(?::\d{2})?)?/g,
  /\b\d{4}[.\-/]\d{2}[.\-/]\d{2}\b/g,
  /\b\d{1,2}:\d{2}(?::\d{2})?\b/g,
  // Payment method words
  /\b(?:SEPA|INCASSO|ALGEMEEN|DOORLOPENDE?|OVERBOEKING|BEA|GEA|ECOM|TERUGKEREND|APPLE PAY|GOOGLE PAY|BETAALPAS|IDEAL|WERO|NOTPROVIDED)\b/gi,
  /^\s*POS\s+(?:HARCAMA|ALISVERIS|ALIŞVERİŞ)?/i,
];

const VOWELS = /[AEIOUYİIÖÜÄËÏÉÈÁÀÓÒÚÙ]/i;

/** Reference numbers, terminal IDs, store numbers: tokens that say nothing about who was paid. */
export function looksLikeCode(token: string): boolean {
  const core = token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  if (!core) return true;
  const digits = (core.match(/\d/g) ?? []).length;
  const letters = (core.match(/\p{L}/gu) ?? []).length;
  if (digits >= 4) return true;
  if (letters === 0) return digits >= 3;
  if (digits >= 2 && core.length >= 6) return true;
  if (digits > 0 && core.length >= 8) return true;
  if (digits === 0 && letters >= 6 && !VOWELS.test(core)) return true;
  return false;
}

function stripNoise(text: string): string {
  let cleaned = ` ${text.replace(/[\\"]/g, '')} `;
  for (const pattern of NOISE_PATTERNS) cleaned = cleaned.replace(pattern, ' ');
  cleaned = cleaned.replace(/\*/g, ' ');

  // A code glued to a name ("JD3001GammaEindhoven") keeps its readable pieces.
  const tokens = cleaned.split(/\s+/).flatMap((token) => {
    if (!token) return [];
    if (!looksLikeCode(token)) return [token];
    return splitJoinedWords(token).split(' ').filter((piece) => !looksLikeCode(piece));
  });
  cleaned = tokens
    .join(' ')
    // Trailing country code: "EINDHOVEN NLD", "Amsterdam, NL"
    .replace(/\s+(?:NLD|DEU|BEL|GBR|IRL|LUX|USA|FRA|ESP|ITA|TUR)$/i, '')
    .replace(/,\s*[A-Z]{2}$/i, '')
    .replace(/\s+(?:by|via)$/i, '')
    .replace(/^[\s,;:\-–|/.]+|[\s,;:\-–|/]+$/g, '')
    .replace(/\s+,/g, ',')
    .trim();

  return cleaned;
}

const CARD_TEXT =
  /\b(?:BEA|GEA|ECOM)\b,?\s*(?:TERUGKEREND\s+)?(?:Apple Pay|Google Pay|Betaalpas|Pin)?\s*(.*?)(?=,\s*PAS\s*\d+|\s+NR:|\s+\d{2}\.\d{2}\.\d{2}\/|$)/i;

const isReadable = (text: string): boolean => (text.match(/\p{L}/gu) ?? []).length >= 2;

/** Candidate names from tagged bank text, most trustworthy first. */
function taggedCandidates(text: string): string[] {
  const found: string[] = [];
  const push = (value?: string) => {
    const trimmed = (value ?? '').trim();
    if (trimmed) found.push(trimmed);
  };

  // ISO 20022 slash tags: /TRTP/SEPA OVERBOEKING/IBAN/NL..../NAME/J JANSEN/REMI/...
  push(text.match(/\/NAME\/([^/]+)/i)?.[1]);

  // "Naam: VATTENFALL N.V. Machtiging: ..."
  push(
    text.match(
      /\bNaam:\s*(.+?)(?=\s+(?:Machtiging(?:\s+ID)?|Omschrijving|IBAN|BIC|Kenmerk|Incassant(?:\s+ID)?|Voor|Valutadatum):|$)/i
    )?.[1]
  );

  // Card payments: "BEA, Apple Pay ALBERT HEIJN 1234,PAS123 NR:CT123456, 01.02.24/12:34 EINDHOVEN",
  // "eCom, Betaalpas PARKnCHARGE B.V. 24.07.26/19.14 Veenendaal"
  const pos = text.match(CARD_TEXT);
  if (pos) {
    push(pos[1]);
    // Older layout: "BEA NR:AB12CD 01.02.24/12.34 ALBERT HEIJN 1234 EINDHOVEN,PAS123"
    if (!pos[1].trim()) {
      push(text.match(/\d{2}\.\d{2}\.\d{2}\/\d{2}[.:]\d{2}\s+(.+?)(?=,\s*PAS\s*\d+|$)/i)?.[1]);
    }
  }

  const remi = text.match(/\/REMI\/([^/]+)/i)?.[1];
  if (remi && !/^(NOTPROVIDED|REF-)/i.test(remi.trim())) push(remi);

  const omschrijving = text.match(
    /\bOmschrijving:\s*(.+?)(?=\s+(?:IBAN|BIC|Kenmerk|Machtiging(?:\s+ID)?|Incassant(?:\s+ID)?|Valutadatum):|$)/i
  )?.[1];
  if (omschrijving && !/^(NOTPROVIDED|REF-)/i.test(omschrijving.trim())) push(omschrijving);

  return found;
}

function canonicalName(cleaned: string): string | null {
  const upper = cleaned.toUpperCase();
  let best: string | null = null;
  let bestLength = 0;
  for (const alias of MERCHANT_ALIASES) {
    for (const part of alias.parts ?? []) {
      if (part.length > bestLength && upper.includes(part)) {
        best = alias.name;
        bestLength = part.length;
      }
    }
    for (const word of alias.words ?? []) {
      if (word.length > bestLength && containsWord(upper, word)) {
        best = alias.name;
        bestLength = word.length;
      }
    }
  }
  return best;
}

function titleCase(text: string): string {
  const hasLower = text !== text.toUpperCase();
  const hasUpper = text !== text.toLowerCase();
  if (hasLower && hasUpper) return text;

  return text
    .split(' ')
    .map((word) => {
      const letters = word.replace(/[^\p{L}]/gu, '');
      // Abbreviations: "KPN", "B.V.", "NS"
      if (letters.length <= 3 && (!VOWELS.test(letters) || word.includes('.'))) return word.toUpperCase();
      const lower = word.replace(/İ/g, 'i').toLowerCase();
      return lower.replace(/\p{L}/u, (ch) => ch.toUpperCase());
    })
    .join(' ');
}

function truncate(text: string): string {
  if (text.length <= MAX_LENGTH) return text;
  const cut = text.slice(0, MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 12 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:\-–|/]+$/, '');
}

/**
 * Readable merchant name for a statement row. Tries the counterparty name column, then names tagged
 * in the bank text, then the memo, then the whole text; reference codes are stripped from each.
 * Falls back to a payment-type label, never to a code.
 */
export function deriveMerchant(source: MerchantSource): string {
  const description = String(source.description ?? '');
  // On a card row the text around the terminal name is only the city, so a coded name gets the label.
  const isCardText = CARD_TEXT.test(description);
  const candidates = [
    source.name ?? '',
    ...taggedCandidates(description),
    ...(isCardText ? [] : [source.memo ?? '', description]),
  ];

  for (const candidate of candidates) {
    if (!candidate.trim()) continue;
    const cleaned = stripNoise(candidate);
    if (!isReadable(cleaned)) continue;
    return canonicalName(cleaned) ?? truncate(titleCase(cleaned));
  }

  return TX_TYPE_LABELS[source.txType ?? ''] ?? FALLBACK_LABEL;
}

/** Text the classifier should see: the merchant name (unless it is a generic label) plus the bank text. */
export function classificationText(merchant: string | null | undefined, rawDescription: string): string {
  const name = merchant && !GENERIC_NAMES.has(merchant) ? merchant : '';
  return `${name} ${rawDescription ?? ''}`.trim();
}
