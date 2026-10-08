# Debts

Debt math and payment linking: bottom of `src/db/database.ts`. UI helpers: `src/utils/debt.ts`.

## The Plan tab

- The tab is labelled "Plan" but the route is still `debts` (`src/app/(tabs)/debts.tsx`). "Debts tab" in these docs means its Debts segment; the other segments are Health ([health.md](health.md)), which the tab opens on, and Future Growth ([freedom.md](freedom.md)).
- The segment is local state. Links into it navigate with `params: { segment: 'health' | 'debts' | 'freedom' }`, which the screen applies and clears.
- Debts `load` writes without bumping `dataVersion`, so it calls `refreshInbox` itself.

## Covered

- Installment loans, auto-linked payments, interest estimates. Types: `DEBT_TYPE_OPTIONS` in `src/utils/debt.ts`; term units: `DEBT_TERM_UNITS`. Both hold a translation key in `label`.

## Payment linking

- Debt keyword matching runs in JS (`evaluateDebtKeyword` in `src/utils/debt.ts`; case, accent, punctuation and space insensitive), not SQL `LIKE`.
- Only `EXACT` matches (whole words, or word start for keywords of 5+ chars) within 50% of the monthly payment auto-link.
- Near-misses are `POSSIBLE` and linked one by one via `linkDebtTransaction`. They also show up in the For You inbox.
- `syncDebtPayments` runs on Debts focus, on debt save and after import.
- Removing a debt keyword deletes the auto payments it linked. Auto payments whose transaction is gone are removed on sync.
- A debt-linked payment counts as fixed in the fixed / flexible resolver ([classifier.md](classifier.md)).

## APR estimate

- `estimateApr(originalAmount, payment, termMonths)` in `src/utils/debt.ts`: bisection on the annuity formula, nominal rate. Returns `null` when the numbers do not add up or the rate is over 100%.
- `debts.termMonths` is optional and only feeds this estimate.
- `DebtFormModal` shows the estimate as a "Use" suggestion under the APR field and never writes it on its own.

## Debt cards

- Cards on the Debts tab are wrapped in `ReanimatedSwipeable`: swipe left for Edit (opens `DebtFormModal`) and Delete (confirms, then `deleteDebt`). One row is open at a time.
- `GestureHandlerRootView` wraps the app in `src/app/_layout.tsx`.
- The `Swipeable` rows block the tab swipe (see [navigation.md](navigation.md)).
- The live detail modal is `src/components/modals/DebtDetailModal.tsx`. `src/components/components/modals/DebtDetailModal.tsx` is a stray duplicate.

## Suggestions

- `buildDebtSuggestions` in `src/utils/debtSuggestion.ts`: unlinked expenses grouped by `merchantKey`. A group needs a `DEBT_SIGNALS` word, no insurance / credit-card word, 2+ months, a steady amount, to be recent, and no existing debt keyword match.
- `getDebtSuggestions` / `dismissDebtSuggestion` in `src/db/database.ts`. Dismissals are a JSON list in `app_meta` (`debt_suggestions_dismissed:<profileId>`).
- The Debts tab passes a suggestion to `DebtFormModal` as `prefill` (name, type, keyword); the form's keyword effect fills the rest.
- In the For You inbox the suggestions are always one row ([navigation.md](navigation.md)).

## Currency

- Switching currency rewrites stored debt amounts (and transaction amounts) using hardcoded `DEFAULT_EXCHANGE_RATES`.
