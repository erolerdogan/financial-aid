// The same booking reads differently in a bank's PDF statement and in its CSV / TXT export, so the
// import's dedup key (date, amount, text) does not match across the two. These keys recognise it by
// what both carry: the counterparty IBAN, or for card payments the terminal reference or time stamp.

export interface CrossFormatRow {
  date: string;
  amount: number;
  rawDescription: string;
  counterpartyIban?: string | null;
}

const IBAN_IN_TEXT = /(?:\/IBAN\/|IBAN:\s*)([A-Z]{2}\d{2}[A-Z0-9]{8,30})/gi;
const TERMINAL = /\bNR:\s*([A-Z0-9]{4,})/gi;
// "02.01.25/12:34", in older statements "02.01.25/12.34"
const CARD_TIME = /\b(\d{2})\.(\d{2})\.(\d{2})\/(\d{2})[.:](\d{2})\b/g;
const IBAN = /^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/;

export function crossFormatKeys(row: CrossFormatRow): string[] {
  const base = `${(row.date || '').slice(0, 10)}|${Number(row.amount).toFixed(2)}`;
  const text = String(row.rawDescription ?? '');
  const keys = new Set<string>();

  const column = String(row.counterpartyIban ?? '').replace(/\s+/g, '').toUpperCase();
  if (IBAN.test(column)) keys.add(`${base}|iban:${column}`);
  for (const match of text.matchAll(IBAN_IN_TEXT)) keys.add(`${base}|iban:${match[1].toUpperCase()}`);
  for (const match of text.matchAll(TERMINAL)) keys.add(`${base}|nr:${match[1].toUpperCase()}`);
  for (const match of text.matchAll(CARD_TIME)) keys.add(`${base}|at:${match.slice(1, 6).join('')}`);

  return [...keys];
}

/**
 * Stored rows a PDF row can be matched against. One stored row absorbs one PDF row, so the second
 * of two identical bookings is not lost; a stored row that already matched a row exactly is taken
 * out with `use`.
 */
export class CrossFormatPool {
  private readonly used: boolean[];
  private readonly byKey = new Map<string, number[]>();

  constructor(stored: CrossFormatRow[]) {
    this.used = stored.map(() => false);
    stored.forEach((row, index) => {
      for (const key of crossFormatKeys(row)) {
        const list = this.byKey.get(key);
        if (list) list.push(index);
        else this.byKey.set(key, [index]);
      }
    });
  }

  /** Marks the stored row at `index` as matched. */
  use(index: number): void {
    if (index >= 0 && index < this.used.length) this.used[index] = true;
  }

  /** `true` when an unmatched stored row shares one of the keys; that row is then matched. */
  take(keys: string[]): boolean {
    for (const key of keys) {
      const index = (this.byKey.get(key) ?? []).find((candidate) => !this.used[candidate]);
      if (index !== undefined) {
        this.used[index] = true;
        return true;
      }
    }
    return false;
  }
}
