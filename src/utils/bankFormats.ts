export type BankId = 'ING' | 'ABN_AMRO' | 'RABOBANK' | 'BUNQ' | 'REVOLUT' | 'WISE' | 'N26';

/** Brand names, shown as they are in every language. */
export const BANK_LABELS: Record<BankId, string> = {
  ING: 'ING',
  ABN_AMRO: 'ABN AMRO',
  RABOBANK: 'Rabobank',
  BUNQ: 'bunq',
  REVOLUT: 'Revolut',
  WISE: 'Wise',
  N26: 'N26',
};

/** Where each field of a statement row sits; `-1` means the file has no such column. */
export interface ColumnMap {
  date: number;
  amount: number;
  debit: number;
  credit: number;
  sign: number;
  iban: number;
  type: number;
  name: number;
  memos: number[];
  legacyDesc: number;
  /** Name columns to try for money going out / coming in, when the file has one per side. */
  nameOut?: number[];
  nameIn?: number[];
  /** Pulls the counterparty out of the memo when the name columns are empty. */
  nameFromMemo?: RegExp;
  /** Charged on top of the amount. */
  fee?: number;
  /** Rows whose status cell does not match `keepStatus` never moved money and are skipped. */
  status?: number;
  keepStatus?: RegExp;
  /** `IN` / `OUT` column: `amount` is what left the account, `amountIn` what arrived. */
  direction?: number;
  amountIn?: number;
  /** Dates are known to be day first, so 03-04-2024 is not ambiguous. */
  dayFirst?: boolean;
}

type Alias = string | RegExp;

interface BankFormat {
  bank: BankId;
  /** Every entry needs one of its headers in the file for the format to match. */
  signature: Alias[][];
  date: Alias[];
  amount: Alias[];
  sign?: Alias[];
  iban?: Alias[];
  type?: Alias[];
  name?: Alias[];
  memos?: Alias[];
  nameOut?: Alias[];
  nameIn?: Alias[];
  nameFromMemo?: RegExp;
  fee?: Alias[];
  status?: Alias[];
  keepStatus?: RegExp;
  direction?: Alias[];
  amountIn?: Alias[];
  dayFirst?: boolean;
}

const COMPLETED = /^completed$/i;
// "Amount (EUR)", "Bedrag (EUR)", "Betrag (EUR)"
const AMOUNT_WITH_CURRENCY = /^(amount|bedrag|betrag)( \(\w{3}\))?$/;

const BANK_FORMATS: BankFormat[] = [
  {
    bank: 'ING',
    signature: [
      ['naam / omschrijving', 'name / description'],
      ['af bij', 'debit/credit'],
      ['mededelingen', 'notifications'],
    ],
    date: ['datum', 'date'],
    amount: [AMOUNT_WITH_CURRENCY],
    sign: ['af bij', 'debit/credit'],
    iban: ['tegenrekening', 'counterparty'],
    type: ['code'],
    name: ['naam / omschrijving', 'name / description'],
    memos: ['mededelingen', 'notifications'],
  },
  {
    bank: 'RABOBANK',
    signature: [['iban/bban'], ['volgnr'], ['naam tegenpartij'], ['omschrijving-1']],
    date: ['datum'],
    amount: ['bedrag'],
    iban: ['tegenrekening iban/bban'],
    type: ['code'],
    name: ['naam tegenpartij'],
    memos: ['omschrijving-1', 'omschrijving-2', 'omschrijving-3'],
  },
  {
    // "mutationcode" / "Muntsoort" is the currency, not a payment type.
    bank: 'ABN_AMRO',
    signature: [
      ['accountnumber', 'rekeningnummer'],
      ['mutationcode', 'muntsoort'],
      ['transactiondate', 'transactiedatum'],
      ['startsaldo', 'beginsaldo'],
    ],
    date: ['transactiondate', 'transactiedatum'],
    amount: ['amount', 'transactiebedrag'],
    memos: ['description', 'omschrijving'],
  },
  {
    bank: 'BUNQ',
    signature: [['interest date'], ['account'], ['counterparty'], ['name'], ['description']],
    date: ['date'],
    amount: ['amount'],
    iban: ['counterparty'],
    name: ['name'],
    memos: ['description'],
  },
  {
    bank: 'REVOLUT',
    signature: [['started date'], ['completed date'], ['state'], ['fee']],
    date: ['started date'],
    amount: ['amount'],
    type: ['type'],
    memos: ['description'],
    fee: ['fee'],
    status: ['state'],
    keepStatus: COMPLETED,
  },
  {
    // Balance statement.
    bank: 'WISE',
    signature: [[/^(transfer)?wise id$/], ['payer name'], ['payee name'], ['merchant']],
    date: ['date'],
    amount: ['amount'],
    nameOut: ['merchant', 'payee name'],
    nameIn: ['payer name', 'merchant'],
    nameFromMemo: /(?:issued by|sent money to|received money from)\s+(.+?)(?:\s+with reference\b.*)?$/i,
    memos: ['description', 'payment reference', 'note'],
    dayFirst: true,
  },
  {
    // Transfer history.
    bank: 'WISE',
    signature: [['direction'], ['source name'], ['target name'], [/^target amount/]],
    date: ['created on'],
    amount: [/^source amount/],
    amountIn: [/^target amount/],
    direction: ['direction'],
    fee: ['source fee amount'],
    status: ['status'],
    keepStatus: COMPLETED,
    nameOut: ['target name'],
    nameIn: ['source name'],
    memos: ['reference'],
  },
  {
    bank: 'N26',
    signature: [['booking date', 'buchungsdatum'], ['partner name', 'partnername'], ['partner iban']],
    date: ['booking date', 'buchungsdatum'],
    amount: [AMOUNT_WITH_CURRENCY],
    iban: ['partner iban'],
    type: ['type', 'typ'],
    name: ['partner name', 'partnername'],
    memos: ['payment reference', 'verwendungszweck'],
  },
  {
    // Export layout before 2023.
    bank: 'N26',
    signature: [['payee', 'empfanger'], ['account number', 'kontonummer'], [/^(amount|betrag) \(\w{3}\)$/]],
    date: ['date', 'datum'],
    amount: [AMOUNT_WITH_CURRENCY],
    iban: ['account number', 'kontonummer'],
    type: ['transaction type', 'transaktionstyp'],
    name: ['payee', 'empfanger'],
    memos: ['payment reference', 'verwendungszweck'],
  },
];

/** Header cell as the formats above spell it: lower case, no quotes or accents, single spaces. */
export function normalizeHeaderCell(value: unknown): string {
  const cell = String(value ?? '')
    .replace(/["\\\uFEFF]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  // Header cells are short labels; long cells are data or preamble text.
  return cell.length <= 40 ? cell : '';
}

const matches = (cell: string, alias: Alias): boolean =>
  typeof alias === 'string' ? cell === alias : alias.test(cell);

/** Column of the first alias the file has. */
function find(cells: string[], aliases: Alias[] | undefined): number {
  for (const alias of aliases ?? []) {
    const index = cells.findIndex((cell) => matches(cell, alias));
    if (index !== -1) return index;
  }
  return -1;
}

const findAll = (cells: string[], aliases: Alias[] | undefined): number[] =>
  (aliases ?? []).map((alias) => find(cells, [alias])).filter((index) => index !== -1);

const optional = (index: number): number | undefined => (index === -1 ? undefined : index);

export interface DetectedBank {
  bank: BankId;
  /** `legacyDesc` is left for the caller, which knows what earlier versions stored. */
  columns: ColumnMap;
}

/** The bank whose export has this header row (cells from `normalizeHeaderCell`), or `null`. */
export function detectBankFormat(cells: string[]): DetectedBank | null {
  for (const format of BANK_FORMATS) {
    if (!format.signature.every((aliases) => find(cells, aliases) !== -1)) continue;

    const date = find(cells, format.date);
    const amount = find(cells, format.amount);
    if (date === -1 || amount === -1) continue;

    const directional = format.nameOut !== undefined || format.nameIn !== undefined;
    return {
      bank: format.bank,
      columns: {
        date,
        amount,
        debit: -1,
        credit: -1,
        sign: find(cells, format.sign),
        iban: find(cells, format.iban),
        type: find(cells, format.type),
        name: find(cells, format.name),
        memos: findAll(cells, format.memos).sort((a, b) => a - b),
        legacyDesc: -1,
        nameOut: directional ? findAll(cells, format.nameOut) : undefined,
        nameIn: directional ? findAll(cells, format.nameIn) : undefined,
        nameFromMemo: format.nameFromMemo,
        fee: optional(find(cells, format.fee)),
        status: optional(find(cells, format.status)),
        keepStatus: format.keepStatus,
        direction: optional(find(cells, format.direction)),
        amountIn: optional(find(cells, format.amountIn)),
        dayFirst: format.dayFirst,
      },
    };
  }
  return null;
}

const text = (value: unknown): string => String(value ?? '').replace(/["\\]/g, '').trim();

/**
 * ABN AMRO's tab-separated TXT export has no header row:
 * account, currency, date, balance before, balance after, value date, amount, description.
 */
export function detectHeaderlessBank(rows: unknown[][]): DetectedBank | null {
  const first = (rows ?? []).find((row) => row && row.length > 0);
  if (!first || first.length !== 8) return null;

  const isAbnAmro =
    /^\d{6,10}$/.test(text(first[0])) &&
    /^[A-Z]{3}$/.test(text(first[1])) &&
    /^\d{8}$/.test(text(first[2])) &&
    /^\d{8}$/.test(text(first[5]));
  if (!isAbnAmro) return null;

  return {
    bank: 'ABN_AMRO',
    columns: {
      date: 2, amount: 6, debit: -1, credit: -1, sign: -1, iban: -1, type: -1, name: -1,
      memos: [7], legacyDesc: 7,
    },
  };
}
