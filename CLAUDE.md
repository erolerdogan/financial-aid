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
Categories screen, Review screen (uncategorised merchants), Goals, fixed vs. flexible detection,
Debts tab (installment loans, auto-linked payments, interest estimates),
statement import (CSV/XLSX), demo workspace, import reminders, backup & restore. Full list in `README.md`; keep it updated.

## Where things live
- Import: `src/hooks/useStatementImporter.ts` → `src/services/importService.ts` → `src/utils/parser.ts`.
- Currency, demo mode, active profile: `src/contexts/ProfileContext.tsx`. Demo seed: `src/db/demoSeeder.ts`.
- Debt math and payment linking: bottom of `src/db/database.ts`; UI helpers in `src/utils/debt.ts`.
- Reminders: `src/utils/notifications.ts`.

## Behaviours to know
- Amount sign: expenses are negative, income positive.
- Import dedup relies on the unique index `(date, amount, rawDescription, profileId)`.
- Category rules reclassify only rows with `userOverridden = 0`.
- Classifier fallback is `Uncategorised` (expenses) or `Income` (positive amounts), never `Shopping & Retail`. Uncategorised rows feed the review screen (`src/app/review.tsx`, `getUncategorisedGroups` / `categoriseMerchantGroup`).
- A `category_rules` keyword is either a text fragment or a counterparty IBAN. `transactions.counterpartyIban` is only stored when it identifies the merchant (see `extractBankDetails` in `src/utils/parser.ts`); `txType` is `DIRECT_DEBIT | CARD | ONLINE | TRANSFER` and direct debit adds to the fixed-cost score.
- Merchant titles come from `deriveMerchant` in `src/utils/merchantName.ts` (name column → tagged name in the bank text → memo → whole text; codes stripped; `MERCHANT_ALIASES` for canonical brand names; falls back to a payment-type label, never a code). Stored merchants are not backfilled.
- `parseMatrixData` detects name, memo (several), sign (`Af Bij`) and split debit/credit columns. `rawDescription` is name + memo cells joined; `legacyRawDescription` (the single cell older versions stored) is only used by `processBatchImport` for dedup and is not stored.
- `classifyTransaction({ merchant, rawDescription }, rules, { iban, amount, learned })` runs both at import and in `reclassifyAllUnoverriddenTransactions`. Precedence: custom rules → learned history → built-in keywords in the merchant name → built-in keywords in the bank text → fallback.
- Custom rules: IBAN rule wins; text rules match `classificationText(merchant, rawDescription)` as whole words (word start for 5+ chars), longest keyword wins.
- Learned history: `getLearnedCategories` / `buildLearnedCategories` use `userOverridden = 1` rows, keyed by sign + IBAN or sign + `merchantRuleKeyword(merchant)`; a key needs 2+ rows with two thirds agreeing.
- `NAME_ONLY_KEYWORDS` (generic words like MARKET, SHOP, TRANSFER) only count in the merchant name, not the memo. For positive amounts built-in keywords can only return `Financial Transfers` (`INCOMING_CATEGORIES`), otherwise `Income`.
- Custom rules and learned categories are passed to the parser at import (`useStatementImporter` → `parseFileToTransactions`).
- Review suggestions: `suggestCategory` in `src/utils/categorySuggestion.ts` (learned → similar merchant by first significant word → name-only keyword in the text → monthly direct debit), attached to each group by `getUncategorisedGroups`.
- Built-in categorisation: `CATEGORY_KEYWORDS` in `src/utils/parser.ts` (`parts` match anywhere, `words` whole-word only; longest match wins; shared scan is `matchKeywords`). After editing keywords bump `CLASSIFIER_VERSION`; `initDatabase` then reclassifies non-overridden rows once (tracked in `PRAGMA user_version`).
- Fixed/flexible override is per merchant keyword (`fixed_cost_rules`), not per transaction; it rewrites `is_fixed` on all matching rows.
- Fixed/flexible detection: scoring in `src/utils/fixedCost.ts` (cadence, amount stability, day of month, category, keywords; fixed at score >= 0.6). All queries go through `getFixedResolver` in `src/db/database.ts`. Precedence: row `is_fixed` → `fixed_cost_rules` (longest whole-word match) → debt-linked payment → score.
- The resolver is cached per profile and keyed on SQLite `total_changes()`, so any write on the connection refreshes it; no manual invalidation.
- Switching currency rewrites stored transaction and debt amounts using hardcoded `DEFAULT_EXCHANGE_RATES`.
- Debt keyword matching runs in JS (`evaluateDebtKeyword` in `src/utils/debt.ts`, case/accent/punctuation/space-insensitive), not SQL `LIKE`. Only `EXACT` matches (whole words, or word start for keywords of 5+ chars) within 50% of the monthly payment auto-link; near-misses are `POSSIBLE` and linked one by one via `linkDebtTransaction`. `syncDebtPayments` runs on Debts focus, debt save and after import.
- Removing a debt keyword deletes the auto payments it linked; auto payments whose transaction is gone are removed on sync.
- Debt suggestions: `buildDebtSuggestions` in `src/utils/debtSuggestion.ts` (unlinked expenses grouped by `merchantKey`; needs a `DEBT_SIGNALS` word, no insurance/credit-card word, 2+ months, steady amount, recent, no existing debt keyword match). `getDebtSuggestions` / `dismissDebtSuggestion` in `src/db/database.ts`; dismissals are a JSON list in `app_meta` (`debt_suggestions_dismissed:<profileId>`). The Debts tab passes a suggestion to `DebtFormModal` as `prefill` (name, type, keyword); the form's keyword effect fills the rest.
- Backup/restore: `src/services/backupService.ts` + `src/components/modals/BackupRestoreModal.tsx` (opened from Settings). Backup is the whole SQLite file via `serializeAsync` (WAL header bytes 18/19 normalised to 1, otherwise `deserializeDatabaseAsync` cannot read it), shared with RN `Share` on iOS and a directory picker on Android (no `expo-sharing`). Restore validates an in-memory copy, writes `pre-restore.db` to the document directory (used by "Undo Last Restore"), then `replaceDatabaseContents` (`backupDatabaseAsync` + `initDatabase`) and `reloadAfterRestore` in ProfileContext. Backups with `user_version > CLASSIFIER_VERSION` are refused.
- `app_meta` is a key/value table (last backup date, backup notice seen); it survives "Reset" and is replaced by a restore.
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