# Roadmap

Status notes were checked against the code on 2026-10-07.

## Open

- **Debts: credit cards, payoff simulator, due-date reminders.** Not started. `DEBT_TYPE_OPTIONS` has no credit card type, there is no simulator (only the estimated debt-free month from `projectDebtPayoff`), and no reminder is scheduled before a due date. The `missed_debt_payment` health alert reports a payment after it was missed, which is a different thing.
- **Live exchange rates** (optional network call only; no user data sent). Not started. A currency switch still uses the hardcoded `DEFAULT_EXCHANGE_RATES`.

## Partly done

- **Recurring subscription detection.** The `new_recurring` Budget Health alert already reports a new recurring charge after an import. There is no dedicated flow: `detectRecurringPatterns` and `getRecurringCandidates` exist in `database.ts` but nothing calls them, and the unfinished `RecurringSuggestionsModal` was removed. Decide whether the alert is enough or a suggestions screen should be built on those queries.

## Looks done (confirm, then remove)

- **Make category lists dynamic (Trends pills, Goals) from the `categories` table.** Both named screens already read the table: Trends pills come from `getExpenseCategoryNames`, Budgets (`goals.tsx`) from `getCategoryGoalsWithProgress`. Not checked: whether any other list still uses a hardcoded category set.

## Known gaps noted in the docs

- Pro gating: score history, "Export PDF" and PDF statement import are enabled for everyone; there is no `useEntitlement()` / `FEATURES`, and each gate is marked `// TODO(pro)`.
- PDF statement import: only ABN AMRO, verified against three real statements (2023, 2024, 2025) and not yet run on a device. See the limits in `docs/import.md`.
- Bank layouts in `src/utils/bankFormats.ts` come from the banks' documented exports and have not been checked against live files.
- Translations have not been reviewed by native speakers.
- Stored merchant names are not backfilled when `deriveMerchant` changes.
