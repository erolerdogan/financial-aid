import type { PdfStatementMeta } from './types';

interface StatementRef {
  year: number;
  number: number;
  /** Statement date, `YYYY-MM-DD`. */
  date: string;
}

export type ChainProblem =
  /** The same statement was given twice; the second copy is left out. */
  | ({ kind: 'DUPLICATE'; iban: string } & StatementRef)
  /** The balance does not carry over: a statement in between is probably missing. */
  | { kind: 'GAP'; iban: string; after: StatementRef; next: StatementRef; difference: number }
  /** Balances match but a statement number is skipped (likely a statement without transactions). */
  | { kind: 'NUMBERING'; iban: string; after: StatementRef; next: StatementRef };

const cents = (value: number): number => Math.round(value * 100);
const ref = (meta: PdfStatementMeta): StatementRef => ({ year: meta.year, number: meta.number, date: meta.date });

/**
 * Per account: sorts the statements, drops exact duplicates and reports gaps (a balance that does
 * not carry over to the next statement) and skipped statement numbers within a year.
 */
export function checkChain<T extends { meta: PdfStatementMeta }>(
  statements: T[]
): { kept: T[]; problems: ChainProblem[] } {
  const kept: T[] = [];
  const problems: ChainProblem[] = [];

  const byAccount = new Map<string, T[]>();
  for (const statement of statements) {
    const list = byAccount.get(statement.meta.iban) ?? [];
    list.push(statement);
    byAccount.set(statement.meta.iban, list);
  }

  for (const [iban, items] of byAccount) {
    const sorted = items
      .map((item, index) => ({ item, index }))
      .sort(
        (a, b) =>
          (a.item.meta.date < b.item.meta.date ? -1 : a.item.meta.date > b.item.meta.date ? 1 : 0) ||
          a.item.meta.number - b.item.meta.number ||
          a.index - b.index
      )
      .map(({ item }) => item);

    const seen = new Set<string>();
    let previous: PdfStatementMeta | null = null;
    for (const statement of sorted) {
      const { meta } = statement;
      const key = `${meta.year}/${meta.number}`;
      if (seen.has(key)) {
        problems.push({ kind: 'DUPLICATE', iban, ...ref(meta) });
        continue;
      }
      seen.add(key);

      if (previous) {
        const difference = cents(meta.previousBalance) - cents(previous.newBalance);
        if (difference !== 0) {
          problems.push({ kind: 'GAP', iban, after: ref(previous), next: ref(meta), difference: difference / 100 });
        } else if (meta.year === previous.year && meta.number !== previous.number + 1) {
          problems.push({ kind: 'NUMBERING', iban, after: ref(previous), next: ref(meta) });
        }
      }
      kept.push(statement);
      previous = meta;
    }
  }

  return { kept, problems };
}
