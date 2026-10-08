import {
  getDebtPlan,
  getDebtSummaries,
  getSavedDebtPlan,
  syncDebtPayments,
  type DebtSummary,
  type SQLiteDatabase,
} from '@/db/database';
import {
  currentMonthKey,
  DEFAULT_DEBT_PLAN,
  planToInput,
  simulateDebts,
  toSimDebts,
  type DebtPlan,
  type SimResult,
} from '@/utils/debtSimulator';

export interface DebtOutlook {
  /** Estimated debt-free month (`YYYY-MM`); null when the debts are never cleared. */
  debtFreeMonth: string | null;
  /** True when the month comes from the saved plan, not from the current payments alone. */
  fromPlan: boolean;
  result: SimResult;
}

/**
 * The debt-free estimate for cards outside the simulator. `usePlan` is the Pro check: without it,
 * or without a saved plan, the estimate is what the current payments give.
 */
export const buildDebtOutlook = (
  debts: readonly DebtSummary[],
  plan: DebtPlan | null,
  usePlan: boolean,
  startMonth: string = currentMonthKey()
): DebtOutlook => {
  const fromPlan = usePlan && plan !== null;
  const input = planToInput(toSimDebts(debts), fromPlan && plan ? plan : DEFAULT_DEBT_PLAN, startMonth);
  const result = simulateDebts({ ...input, strategy: fromPlan && plan ? plan.strategy : 'NONE' });
  return { debtFreeMonth: result.debtFreeMonth, fromPlan, result };
};

/** Debts with their payments synced, plus the saved plan (null when there is none). */
export async function loadDebtsWithPlan(
  db: SQLiteDatabase,
  profileId: number
): Promise<{ debts: DebtSummary[]; savedPlan: DebtPlan | null; plan: DebtPlan }> {
  await syncDebtPayments(db, profileId);
  const debts = await getDebtSummaries(db, profileId);
  const savedPlan = await getSavedDebtPlan(db, profileId);
  return { debts, savedPlan, plan: savedPlan ?? (await getDebtPlan(db, profileId)) };
}
