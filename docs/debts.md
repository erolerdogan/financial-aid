# Debts

Debt math and payment linking: bottom of `src/db/database.ts`. UI helpers and `projectDebtPayoff`: `src/utils/debt.ts`. Payoff simulator: `src/utils/debtSimulator.ts`.

## The Plan tab

- The tab is labelled "Plan" but the route is still `debts` (`src/app/(tabs)/debts.tsx`). "Debts tab" in these docs means its Debts segment, the first one and the one the tab opens on; the other segments are Health ([health.md](health.md)) and Future Growth ([freedom.md](freedom.md)).
- The segment is local state. Links into it navigate with `params: { segment: 'health' | 'debts' | 'freedom' }`, which the screen applies and clears.
- Debts `load` writes without bumping `dataVersion`, so it calls `refreshInbox` itself.
- The Debts segment opens with `DebtFreeHero` (`src/components/debts/`): estimated debt-free month, total remaining, a ring with the share paid, and "Make a plan" / "View plan", which pushes `/debt-plan`. It replaced the old summary card.

## Free and Pro

- Free has two debts ([subscription.md](subscription.md)). `guardAdd` in `debts.tsx` covers the add button ("Add debt" under the debt cards of the Debts segment; the tab header has no icon for it), the empty state and the suggestion cards; `InboxHost` applies the same check to its shortcuts.
- Debts beyond the limit (the list is by `id`, oldest first) show a lock: no edit, no payment form, no linking; delete stays. `DebtDetailModal` takes `readOnly`.

## Covered

- Installment loans, auto-linked payments, interest estimates. Types: `DEBT_TYPE_OPTIONS` in `src/utils/debt.ts`; term units: `DEBT_TERM_UNITS`. Both hold a translation key in `label`.

## Payment linking

- Debt keyword matching runs in JS (`evaluateDebtKeyword` in `src/utils/debt.ts`; case, accent, punctuation and space insensitive), not SQL `LIKE`.
- Only `EXACT` matches (whole words, or word start for keywords of 5+ chars) within 50% of the monthly payment auto-link.
- Near-misses are `POSSIBLE` and linked one by one via `linkDebtTransaction`. They also show up in the For You inbox.
- `syncDebtPayments` runs on Debts focus, on debt save and after import.
- Removing a debt keyword deletes the auto payments it linked. Auto payments whose transaction is gone are removed on sync.
- A debt-linked payment counts as fixed in the fixed / flexible resolver ([classifier.md](classifier.md)).

## Picking payments from transactions

- "Choose from transactions" in `DebtFormModal` (new and edit) opens `DebtTransactionPickerSheet` (`src/components/modals/`): the expenses no debt has claimed yet (`getUnlinkedExpenses`), with a search.
- Tapping a row selects every related row. Related means: `keywordForTransaction` (`src/utils/debtPicker.ts`) derives a keyword from the row, the same way a statement suggestion does, and `relatedIds` takes every row that keyword matches as `EXACT`. Tapping a selected row leaves only that one out; a row of another lender adds a second group.
- A row whose name gives no keyword of 3+ characters cannot be picked; an alert says so.
- Confirming does not link anything. It hands the form the keywords, the ticked ids (into `addedIds`, so a payment the amount check turns into `POSSIBLE` is still linked on save) and the related rows left out (into `excludedIds`), and fills an empty name. The keyword effect and `handleSave` then work as for a typed keyword, so later imports keep linking.
- The sheet is rendered inside the form's `Modal`; outside it, it would open behind the page sheet on iOS.
- Tests: `npx tsx src/utils/debtPicker.test.ts`.

## APR estimate

- `estimateApr(originalAmount, payment, termMonths)` in `src/utils/debt.ts`: bisection on the annuity formula, nominal rate. Returns `null` when the numbers do not add up or the rate is over 100%.
- `debts.termMonths` is optional and only feeds this estimate.
- `DebtFormModal` shows the estimate as a "Use" suggestion under the APR field and never writes it on its own.

## Debt cards

- Cards on the Debts tab are wrapped in `ReanimatedSwipeable`: swipe left for Edit (opens `DebtFormModal`) and Delete (confirms, then `deleteDebt`). One row is open at a time.
- `GestureHandlerRootView` wraps the app in `src/app/_layout.tsx`.
- The `Swipeable` rows block the tab swipe (see [navigation.md](navigation.md)).
- The detail modal is `src/components/modals/DebtDetailModal.tsx`.

## Suggestions

- `buildDebtSuggestions` in `src/utils/debtSuggestion.ts`: unlinked expenses grouped by `merchantKey`. A group needs a `DEBT_SIGNALS` word, no insurance / credit-card word, 2+ months, a steady amount, to be recent, and no existing debt keyword match.
- `getDebtSuggestions` / `dismissDebtSuggestion` in `src/db/database.ts`. Dismissals are a JSON list in `app_meta` (`debt_suggestions_dismissed:<profileId>`).
- The Debts tab passes a suggestion to `DebtFormModal` as `prefill` (name, type, keyword); the form's keyword effect fills the rest.
- In the For You inbox the suggestions are always one row ([navigation.md](navigation.md)).

## Payoff simulator

Product rules:

- Answers: "When are we debt-free, and how do we get there faster?"
- Projection only, labelled "est.", with the disclaimer "Estimate based on your balances and interest rates. Not financial advice." (`debt.plan.disclaimer`; this feature does not use the Future Growth disclaimer).
- 100% local. All text via `t()` in all nine locales (`debt.plan.*`).
- Free: the current debt-free date and the payoff order. Pro (flag `debtSimulator`, paywall reason `debtSimulator`): extra monthly amount, one-off payments, strategy choice, comparison and the chart. The demo workspace counts as Pro.

Engine (`src/utils/debtSimulator.ts`, pure; tests: `npx tsx src/utils/debtSimulator.test.ts`):

- `simulateDebts(input)` runs month by month, at most `MAX_SIM_MONTHS` (600). Month `i` is `startMonth + i`, the same convention as `payoffMonth` on the debt cards.
- Per month: interest `balance * apr / 12` on every open debt; then each debt gets its `minPayment`, capped at what is owed; then the extra pool (`extraMonthly` + this month's one-off payments + rollover) goes to the target debt and spills over to the next one when a debt is cleared.
- Rollover is the `minPayment` of every debt cleared in an earlier month. In the month a debt is cleared, the unused part of its payment is not reused.
- Target: `AVALANCHE` highest rate, tie smallest balance; `SNOWBALL` smallest balance, tie highest rate. `NONE` is the baseline: no extra, no one-off payments, no rollover.
- So with extra 0 a strategy equals the baseline only for a single debt; with several debts the rollover alone already shortens it.
- Amounts are not rounded per month; a debt is cleared at a balance of 0.005 or less. A single debt under `NONE` gives the same month count as `projectDebtPayoff`; its interest is a little lower, because the formula counts a full last payment.
- `apr` is a decimal here (`0.065`) and may be `null`; `debts.apr` is a percent. `toSimDebts` converts, leaves out paid-off debts and maps a stored rate of 0 to `null` ("not entered"; the form calls the field optional). A real 0% loan gets the same hint and the same numbers.
- Warnings are codes with a `debtId`: `RATE_UNKNOWN`, `NO_PAYMENT`, `PAYMENT_BELOW_INTEREST` (only while the debt is not cleared by extra payments) and `OVER_LIMIT` (not debt-free within 600 months; `debtFreeMonth` and `months` are then `null`). The screen maps them to text.
- `compareStrategies` returns the baseline, both strategies and, per strategy, months saved, interest saved (both `null` when either path never ends) and the first debt cleared.
- `buildChartSeries` puts both paths on one month axis, thinned to 48 points; `extraSliderMax` / `extraSliderStep` size the slider (twice the current payments, at least 200, never more than is owed; step 10, larger for currencies with big numbers).

Persistence:

- Table `debt_plan`: one row per profile (`profile_id` unique), `extra_monthly`, `strategy`, `lump_sums` (JSON list of `{ month: 'YYYY-MM', amount }`), `updated_at`. `getSavedDebtPlan` returns `null` without a row; `getDebtPlan` falls back to `DEFAULT_DEBT_PLAN`; stored values pass through `sanitizeDebtPlan`.
- One-off payments are stored by calendar month and turned into month numbers by `planToInput`; months that are not in the future are ignored and dropped on the next save.
- Cleared by `clearAllData` and `deleteProfile`. It is in backups without extra code (the backup is the whole file); an older backup simply has no row.
- A currency switch also converts the plan's amounts (`convertDebtAmounts`, called by `switchProfileCurrency`), unlike `freedom_plans`.
- The demo workspace seeds a plan (extra 100 a month, avalanche).
- `src/services/debtPlanService.ts`: `loadDebtsWithPlan` (sync, summaries, saved plan) and `buildDebtOutlook(debts, plan, usePlan)`, the debt-free estimate for the hero and the Home `DebtsCard`. `usePlan` is `can('debtSimulator')`: without Pro, or without a saved row, the estimate is the baseline, and a saved plan is kept untouched.

Screen (`src/app/debt-plan.tsx`, a card pushed on the root `Stack` like Transactions):

- Top to bottom: result card → extra per month (`ExtraSlider` + field) → strategy → one-off payments (`LumpSumRows`) → payoff order (`PayoffTimeline`) → chart (`PayoffChart`) → Avalanche vs Snowball sentence → warnings → disclaimer.
- Field text is the source of truth and the plan is parsed from it. An edit marks the plan dirty; it is saved 500 ms later and flushed on blur, unmount and app background. A plan that was only loaded is never written, so opening the screen does not create a row.
- Every focus reloads debts and plan (debt edits do not bump `dataVersion`). The save moves `total_changes()`, which makes the Debts segment reload on its next focus.
- The controls, the chart and the comparison sit in `ProGate`; without Pro the screen shows the baseline. Writes also go through `guardWrite()` (read-only profile).
- A warning row opens the screen's own `DebtFormModal` for that debt; the rate hint passes `focusApr`, which scrolls the form to the rate field. Debts beyond the free limit show the read-only sheet instead.
- `ExtraSlider` uses the plain responder props (no native slider, no Reanimated) and refuses termination, so the scroll view cannot take a drag back. `CountUpText` and the hero ring skip their animation under Reduce Motion.
- `PayoffChart`: plan solid (`data`), current payments dashed (`data2`, `strokeDashArray2`); the only dashed data series in the app. X labels are drawn by hand, as in `GrowthChart`.
- Not linked to Future Growth yet; see the TODO in [freedom.md](freedom.md).

## Currency

- Switching currency rewrites stored debt amounts, payments and the payoff plan with the rate of the day, rounded to the new currency's decimals (`switchProfileCurrency`; see [navigation.md](navigation.md), Currency).
