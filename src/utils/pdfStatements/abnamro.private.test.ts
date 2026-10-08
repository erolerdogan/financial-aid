// Run with: npx tsx src/utils/pdfStatements/abnamro.private.test.ts
//
// Compares the TypeScript parser with the Python reference on real statements in
// scripts/fixtures/private/ (gitignored). Skipped when the folder or pdfplumber is missing.
// Statements are private: differences are reported by row number and field, never by content.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { readPdfItems } from '../../../scripts/pdf-to-items';
import { detectAbnAmroPdf, parseAbnAmroPdf } from './abnamro';

const root = path.join(__dirname, '..', '..', '..');
const fixtures = path.join(root, 'scripts', 'fixtures', 'private');
const reference = path.join(root, 'scripts', 'reference');

const DUMP = `
import json, sys
sys.path.insert(0, sys.argv[1])
import abnamro_pdf_to_csv as ref
rows, s = ref.parse_statement(sys.argv[2])
print(json.dumps({"rows": rows, "summary": {k: s[k] for k in ("previous", "new", "debit", "credit", "iban", "date", "number")}}))
`;

interface ReferenceOutput {
  rows: Record<'Date' | 'Name' | 'Description' | 'Amount' | 'Counterparty IBAN', string>[];
  summary: { previous: number; new: number; debit: number; credit: number; iban: string; date: string; number: number };
}

function findPython(): string | null {
  for (const candidate of [process.env.PYTHON, 'python3', '/usr/bin/python3']) {
    if (!candidate) continue;
    const probe = spawnSync(candidate, ['-c', 'import pdfplumber'], { stdio: 'ignore' });
    if (probe.status === 0) return candidate;
  }
  return null;
}

async function main(): Promise<void> {
  const files = fs.existsSync(fixtures)
    ? fs.readdirSync(fixtures).filter((name) => name.toLowerCase().endsWith('.pdf')).sort()
    : [];
  if (files.length === 0) {
    console.log('SKIP  no statements in scripts/fixtures/private');
    return;
  }
  const python = findPython();
  if (!python) {
    console.log('SKIP  no python with pdfplumber (set PYTHON=/path/to/python3)');
    return;
  }

  let differences = 0;
  const differ = (file: string, what: string): void => {
    differences++;
    console.log(`DIFF  ${file}: ${what}`);
  };

  for (const [index, name] of files.entries()) {
    const label = `#${index + 1} (${name.match(/\d{8}/)?.[0] ?? 'statement'})`;
    const file = path.join(fixtures, name);

    const run = spawnSync(python, ['-c', DUMP, reference, file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (run.status !== 0) {
      console.log(`SKIP  ${label}: the reference could not read it`);
      continue;
    }
    const expected: ReferenceOutput = JSON.parse(run.stdout);

    const pages = await readPdfItems(file);
    if (!detectAbnAmroPdf(pages)) differ(label, 'not recognised as ABN AMRO');

    let actual;
    try {
      actual = parseAbnAmroPdf(pages);
    } catch (error) {
      differ(label, `parser threw ${(error as Error).name} ${String((error as Error).message).split(':')[0]}`);
      continue;
    }

    if (actual.rows.length !== expected.rows.length) {
      differ(label, `${actual.rows.length} rows, reference has ${expected.rows.length}`);
    }
    const before = differences;
    for (let i = 0; i < Math.min(actual.rows.length, expected.rows.length); i++) {
      const [mine, theirs] = [actual.rows[i], expected.rows[i]];
      if (mine.date !== theirs.Date) differ(label, `row ${i} date`);
      if (mine.name !== theirs.Name) differ(label, `row ${i} name`);
      if (mine.description !== theirs.Description) differ(label, `row ${i} description`);
      if (mine.amount.toFixed(2) !== theirs.Amount) differ(label, `row ${i} amount`);
      if (mine.counterpartyIban !== theirs['Counterparty IBAN']) differ(label, `row ${i} counterparty IBAN`);
    }

    const { meta } = actual;
    const { summary } = expected;
    const same = (a: number, b: number) => Math.abs(a - b) < 0.005;
    if (!same(meta.previousBalance, summary.previous)) differ(label, 'previous balance');
    if (!same(meta.newBalance, summary.new)) differ(label, 'new balance');
    if (!same(meta.totalDebit, summary.debit)) differ(label, 'total debit');
    if (!same(meta.totalCredit, summary.credit)) differ(label, 'total credit');
    if (meta.iban !== summary.iban) differ(label, 'IBAN');
    if (meta.date !== summary.date) differ(label, 'statement date');
    if (meta.number !== summary.number) differ(label, 'statement number');

    if (differences === before) console.log(`PASS  ${label}: ${actual.rows.length} rows, ${pages.length} pages`);
  }

  console.log(`\n${differences} differences on ${files.length} statements`);
  if (differences > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
