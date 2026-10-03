@AGENTS.md
# Financial Aid: React Native / Expo (SDK 57), TypeScript, Expo Router, expo-sqlite

## Conventions
- Source lives in `src/` (`@/` alias → `src/`). Routes in `src/app`, tabs in `src/app/(tabs)`.
- Local-first. All data in SQLite via `src/db/database.ts`. No cloud calls with user data.
- Multi-profile: every query is scoped by `profileId` (see ProfileContext).
- Theme via `useTheme()`; never hardcode light/dark colors. Haptics via `expo-haptics`.
- Strict TypeScript. Follow Apple HIG. No explanations in answers, just do the change.
- Never run `execAsync` DDL from screens (causes "database is locked"). Schema lives in `initDatabase`.
- Period queries take a "period key": `YYYY-MM` or a range key from `makeRangeKey(from, to)`.

## Features built
Dashboard, Transactions (search, date range, category chips), Trends (year / monthly / daily range),
Categories screen, Goals, Debts tab (installment loans, auto-linked payments, interest estimates),
statement import (CSV/XLSX), demo workspace, import reminders. Full list in `README.md`; keep it updated.

## Where things live
- Import: `src/hooks/useStatementImporter.ts` → `src/services/importService.ts` → `src/utils/parser.ts`.
- Currency, demo mode, active profile: `src/contexts/ProfileContext.tsx`. Demo seed: `src/db/demoSeeder.ts`.
- Debt math and payment linking: bottom of `src/db/database.ts`; UI helpers in `src/utils/debt.ts`.
- Reminders: `src/utils/notifications.ts`.

## Behaviours to know
- Amount sign: expenses are negative, income positive.
- Import dedup relies on the unique index `(date, amount, rawDescription, profileId)`.
- Category rules reclassify only rows with `userOverridden = 0`.
- Fixed/flexible override is per merchant keyword (`fixed_cost_rules`), not per transaction; it rewrites `is_fixed` on all matching rows.
- Switching currency rewrites stored transaction and debt amounts using hardcoded `DEFAULT_EXCHANGE_RATES`.
- Theme choice is not persisted; it resets to the system scheme on launch.
- Schema changes go in `initDatabase` as `CREATE TABLE IF NOT EXISTS` plus a try/catch `ALTER TABLE`.

## Not wired up (exists, but nothing renders or calls it)
- `RecurringSuggestionsModal`, `detectRecurringPatterns`, `getRecurringCandidates`.
- `dashboard/DebtsCard`, `dashboard/CommitmentLink`, `CategoryDetailModal`, `EditCategoryModal`, `MonthSelector`.
- `src/components/components/modals/DebtDetailModal.tsx` is a stray duplicate; the live one is `src/components/modals/DebtDetailModal.tsx`.

## Next
- Make category lists dynamic (Trends pills, Goals) from the `categories` table.
- Debts: credit cards, payoff simulator, due-date reminders.
- Wire up recurring subscription detection.
- Live exchange rates (optional network call only; no user data sent).