import { CATEGORY_COLOR_PALETTE } from '@/constants/colors';
import {
  createDebt,
  DebtInput,
  getSavedDebtPlan,
  insertTransactions,
  saveDebtPlan,
  SQLiteDatabase,
  syncDebtPayments,
  Transaction,
} from '@/db/database';

const DEMO_MONTHS = ['2026-07', '2026-08', '2026-09'];

const DEMO_DEBTS: DebtInput[] = [
  {
    name: 'Car Loan',
    type: 'LOAN',
    originalAmount: 9500,
    apr: 6.5,
    paymentAmount: 320,
    paymentDay: 3,
    startDate: '2026-06-03',
    color: CATEGORY_COLOR_PALETTE[0],
    keywords: ['AUTOFINANCE'],
  },
  {
    name: 'Personal Loan',
    type: 'PERSONAL',
    originalAmount: 1500,
    apr: 0,
    paymentAmount: 250,
    paymentDay: 15,
    startDate: '2026-07-01',
    color: CATEGORY_COLOR_PALETTE[1],
    keywords: ['PERSONAL LOAN'],
  },
];

export async function seedDemoDebts(
  db: SQLiteDatabase,
  profileId: number,
  months: string[] = DEMO_MONTHS
): Promise<void> {
  const debtTransactions: Omit<Transaction, 'id'>[] = months.flatMap((monthName) => [
    {
      profileId,
      date: `${monthName}-03`,
      amount: -320.0,
      rawDescription: 'AUTOFINANCE CAR LOAN',
      merchant: 'AutoFinance',
      category: 'Loan & Insurance',
      monthName,
      is_fixed: 1,
    },
    {
      profileId,
      date: `${monthName}-15`,
      amount: -250.0,
      rawDescription: 'PERSONAL LOAN REPAYMENT',
      merchant: 'Personal Loan',
      category: 'Loan & Insurance',
      monthName,
      is_fixed: 1,
    },
    // Not tracked as a debt, so the Debts tab has a suggestion to show.
    {
      profileId,
      date: `${monthName}-24`,
      amount: -85.0,
      rawDescription: 'DIENST UITVOERING ONDERWIJS STUDIESCHULD',
      merchant: 'DUO',
      category: 'Loan & Insurance',
      monthName,
      is_fixed: 1,
    },
  ]);

  await insertTransactions(db, debtTransactions, profileId);

  for (const debt of DEMO_DEBTS) {
    const existing = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM debts WHERE profileId = ? AND name = ?;`,
      [profileId, debt.name]
    );
    if (!existing) await createDebt(db, profileId, debt);
  }

  await syncDebtPayments(db, profileId);

  // A plan with an extra payment, so the debt-free card and the simulator have a result to show.
  if (!(await getSavedDebtPlan(db, profileId))) {
    await saveDebtPlan(db, profileId, { extraMonthly: 100, strategy: 'AVALANCHE', lumpSums: [] });
  }
}

export async function seedExpandedDemoData(db: SQLiteDatabase, profileId: number): Promise<void> {
  const demoTransactions: Omit<Transaction, 'id'>[] = [
    // --- Month 1: 2026-07 ---
    {
      profileId,
      date: '2026-07-01',
      amount: 3400.0,
      rawDescription: 'SALARY ACME CORP',
      merchant: 'Acme Corp',
      category: 'Income',
      monthName: '2026-07',
      is_fixed: 1,
    },
    {
      profileId,
      date: '2026-07-02',
      amount: -1250.0,
      rawDescription: 'MORTGAGE / HUUR PAYMENT',
      merchant: 'Housing Corp',
      category: 'Housing',
      monthName: '2026-07',
      is_fixed: 1,
    },
    {
      profileId,
      date: '2026-07-05',
      amount: -142.5,
      rawDescription: 'ALBERT HEIJN EINDHOVEN',
      merchant: 'Albert Heijn',
      category: 'Groceries',
      monthName: '2026-07',
      is_fixed: 0,
    },
    {
      profileId,
      date: '2026-07-12',
      amount: -85.0,
      rawDescription: 'ENECO ENERGY UTILITIES',
      merchant: 'Eneco',
      category: 'Utilities & Telecom',
      monthName: '2026-07',
      is_fixed: 1,
    },
    {
      profileId,
      date: '2026-07-18',
      amount: -64.2,
      rawDescription: 'DINING OUT RESTAURANT',
      merchant: 'Local Bistro',
      category: 'Dining Out',
      monthName: '2026-07',
      is_fixed: 0,
    },

    // --- Month 2: 2026-08 ---
    {
      profileId,
      date: '2026-08-01',
      amount: 3400.0,
      rawDescription: 'SALARY ACME CORP',
      merchant: 'Acme Corp',
      category: 'Income',
      monthName: '2026-08',
      is_fixed: 1,
    },
    {
      profileId,
      date: '2026-08-02',
      amount: -1250.0,
      rawDescription: 'MORTGAGE / HUUR PAYMENT',
      merchant: 'Housing Corp',
      category: 'Housing',
      monthName: '2026-08',
      is_fixed: 1,
    },
    {
      profileId,
      date: '2026-08-06',
      amount: -168.3,
      rawDescription: 'ALBERT HEIJN EINDHOVEN',
      merchant: 'Albert Heijn',
      category: 'Groceries',
      monthName: '2026-08',
      is_fixed: 0,
    },
    {
      profileId,
      date: '2026-08-10',
      amount: -450.0,
      rawDescription: 'DAYCARE / CHILDCARE SERVICES',
      merchant: 'KINDEROPVANG',
      category: 'Childcare',
      monthName: '2026-08',
      is_fixed: 1,
    },
    {
      profileId,
      date: '2026-08-15',
      amount: -12.99,
      rawDescription: 'NETFLIX SUBSCRIPTION',
      merchant: 'Netflix',
      category: 'Utilities & Telecom',
      monthName: '2026-08',
      is_fixed: 1,
    },
    {
      profileId,
      date: '2026-08-22',
      amount: -110.0,
      rawDescription: 'SHOPPING CLOTHES STORE',
      merchant: 'Retail Store',
      category: 'Shopping & Retail',
      monthName: '2026-08',
      is_fixed: 0,
    },

    // --- Month 3: 2026-09 ---
    {
      profileId,
      date: '2026-09-01',
      amount: 3400.0,
      rawDescription: 'SALARY ACME CORP',
      merchant: 'Acme Corp',
      category: 'Income',
      monthName: '2026-09',
      is_fixed: 1,
    },
    {
      profileId,
      date: '2026-09-02',
      amount: -1250.0,
      rawDescription: 'MORTGAGE / HUUR PAYMENT',
      merchant: 'Housing Corp',
      category: 'Housing',
      monthName: '2026-09',
      is_fixed: 1,
    },
    {
      profileId,
      date: '2026-09-04',
      amount: -185.4,
      rawDescription: 'ALBERT HEIJN EINDHOVEN',
      merchant: 'Albert Heijn',
      category: 'Groceries',
      monthName: '2026-09',
      is_fixed: 0,
    },
    {
      profileId,
      date: '2026-09-08',
      amount: -450.0,
      rawDescription: 'DAYCARE / CHILDCARE SERVICES',
      merchant: 'KINDEROPVANG',
      category: 'Childcare',
      monthName: '2026-09',
      is_fixed: 1,
    },
    {
      profileId,
      date: '2026-09-14',
      amount: -78.5,
      rawDescription: 'DINING OUT PIZZERIA',
      merchant: 'Pizzeria',
      category: 'Dining Out',
      monthName: '2026-09',
      is_fixed: 0,
    },
    {
      profileId,
      date: '2026-09-20',
      amount: -55.0,
      rawDescription: 'PUBLIC TRANSPORT PASS',
      merchant: 'NS Railway',
      category: 'Transportation',
      monthName: '2026-09',
      is_fixed: 0,
    },
  ];

  await insertTransactions(db, demoTransactions, profileId);
  await seedDemoDebts(db, profileId);
}
