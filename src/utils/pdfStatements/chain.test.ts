// Run with: npx tsx src/utils/pdfStatements/chain.test.ts
import { checkChain } from './chain';
import { fakeMeta } from './fixtures';
import type { PdfStatementMeta } from './types';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const statement = (overrides: Partial<PdfStatementMeta>, file = '') => ({ meta: fakeMeta(overrides), file });
const kinds = (result: ReturnType<typeof checkChain>) => result.problems.map((problem) => problem.kind).join();

const january = statement({ date: '2025-01-31', number: 1, previousBalance: 100, newBalance: 250.1 }, 'jan');
const february = statement({ date: '2025-02-28', number: 2, previousBalance: 250.1, newBalance: 80 }, 'feb');
const march = statement({ date: '2025-03-31', number: 3, previousBalance: 80, newBalance: 300 }, 'mar');
const april = statement({ date: '2025-04-30', number: 4, previousBalance: 300, newBalance: 10 }, 'apr');

const complete = checkChain([march, january, february]);
check('complete chain: no problems', complete.problems.length === 0, kinds(complete));
check('sorted by date', complete.kept.map((s) => s.file).join() === 'jan,feb,mar');

const duplicate = checkChain([january, february, { ...february, file: 'feb-copy' }, march]);
check('duplicate reported', kinds(duplicate) === 'DUPLICATE', kinds(duplicate));
check('second copy left out', duplicate.kept.map((s) => s.file).join() === 'jan,feb,mar');
const duplicateProblem = duplicate.problems[0];
check('duplicate names the statement', duplicateProblem.kind === 'DUPLICATE' && duplicateProblem.number === 2 && duplicateProblem.year === 2025);

const gap = checkChain([january, march]);
check('missing statement: balance gap', kinds(gap) === 'GAP', kinds(gap));
const gapProblem = gap.problems[0];
check(
  'gap carries both statements and the difference',
  gapProblem.kind === 'GAP' &&
    gapProblem.after.number === 1 &&
    gapProblem.next.number === 3 &&
    gapProblem.next.date === '2025-03-31' &&
    gapProblem.difference === -170.1,
  JSON.stringify(gapProblem)
);
check('statements around a gap are still kept', gap.kept.length === 2);

const numbering = checkChain([january, february, { meta: { ...april.meta, previousBalance: 80 }, file: 'apr' }]);
check('skipped number with matching balances: numbering', kinds(numbering) === 'NUMBERING', kinds(numbering));

const newYear = checkChain([
  statement({ date: '2024-12-31', year: 2024, number: 12, previousBalance: 5, newBalance: 100 }),
  january,
]);
check('number restarts in a new year: no problem', newYear.problems.length === 0, kinds(newYear));

const otherAccount = statement({ iban: 'NL99ABNA0987654321', date: '2025-02-15', number: 7, previousBalance: 1, newBalance: 2 });
const twoAccounts = checkChain([january, otherAccount, february]);
check('accounts are checked separately', twoAccounts.problems.length === 0, kinds(twoAccounts));
check('all statements of both accounts kept', twoAccounts.kept.length === 3);

check('float balances compare in cents', checkChain([
  statement({ date: '2025-01-31', number: 1, previousBalance: 0, newBalance: 0.1 + 0.2 }),
  statement({ date: '2025-02-28', number: 2, previousBalance: 0.3, newBalance: 1 }),
]).problems.length === 0);

check('no statements', checkChain([]).kept.length === 0);

if (failures > 0) {
  console.log(`\n${failures} checks failed`);
  process.exit(1);
}
console.log('\nAll checks passed');
