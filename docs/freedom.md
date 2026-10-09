# Future Growth (Freedom calculator)

Plan tab (Debts | Health | Future Growth) with a compound-growth investment projection. 100% local, no network calls, no user data leaves the device.

## Naming

- The user sees "Future Growth" (segment label, Home card, intro). Code, files, the `freedom_plans` table and the `segment: 'freedom'` param keep the old name. "Freedom" in these docs means this feature.
- The route is `debts` (`src/app/(tabs)/debts.tsx`); see [debts.md](debts.md) for the segment mechanics. Freedom renders `src/components/freedom/FreedomScreen.tsx` inside that screen's `ScreenContainer`: do not wrap it again.
- Wording: Starting amount (`lumpSum`), Years, Outlook Cautious / Expected / Optimistic (keys still `PESSIMISTIC | NEUTRAL | OPTIMISTIC`), Future prices / Today's prices (`ValueMode` still `NOMINAL | REAL`; "Nominal / Real" below means this switch).
- `SCENARIOS` keeps its English `label` for the tests; the UI uses `SCENARIO_LABELS`. Field configs hold a translation key in `label`; field errors (`FreedomErrors`) are `Message`s ([i18n.md](i18n.md)).

## Rules

- Label projections "est." and show the disclaimer "Projection, not guaranteed. Not financial advice."
- Use the profile currency symbol.

## Free and Pro

- The whole feature is Pro (`futureGrowth`, [subscription.md](subscription.md)).
- Without Pro the full screen is shown read-only (`locked`), never the explainer: the saved plan, or `DEFAULT_FREEDOM_PLAN` as an example when the profile has none (the note then reads `pro.locked.examplePlan`; "Renew" only fits a saved plan). The first-visit intro is skipped; "How it works" still opens it.
- Read-only means: the note on top, inputs take no focus (`editable()`), `applyDraft` saves nothing, and a tap on an input opens the paywall. Details and the prices switch still work: they only change the view.
- On a read-only profile the same wrapper shows the read-only sheet instead.
- In the Demo Workspace (`isDemoMode`) the plan cannot be changed either: `editable()` grays the inputs out (opacity 0.4, no touches), `applyDraft` saves nothing and a note on top (`freedom.demoNote`) says why. No sheet and no paywall there. Details and the prices switch still work.

## Layout

Layered, top to bottom: basic inputs → `CashComparison` → `ResultCards` → outlook (`ScenarioSelector`) → `GrowthChart` → `GoalSection` → "More options" → "Details".

- `DisclosureRow` is a card-shaped toggle; the cards it reveals are rendered after it by `FreedomScreen` (`optionsOpen`, `detailsOpen`; local state, collapsed by default).
- More options is forced open while one of `ADVANCED_FIELD_KEYS` has an error, so an invalid field never blocks saving unseen.
- Details holds `ImpactSection` (prices switch + fee comparison, no input) and `YearlyTable`.

## Inputs and result

- `FreedomInputs` with `fields="BASIC"`: monthly, years, starting amount. With `fields="ADVANCED"`: return, yearly increase, fee, inflation.
- `GOAL_FIELDS` are rendered by `GoalSection` via `FreedomField` and go through the same draft / parse / save path.
- `planToDraft` / `parseDraft` convert between field text and `FreedomInput`. Percents are typed as `9` and stored as `0.09`.
- Limits: years 1-60, no negatives, return max 30%, inflation max 30%.
- Field text is the source of truth. While a field is invalid nothing is saved and the cards show the last valid plan dimmed.
- `ResultCards` is one hero card: final balance plus a "You pay in X, growth adds Y" line.

## Intro

- `FreedomIntro` / `FreedomIntroModal` in `src/components/freedom/FreedomIntro.tsx`.
- Until `app_meta` has `freedom_intro_seen` (app-wide, not per profile) `FreedomScreen` renders the intro instead of the calculator; "Start Planning" sets the key.
- Afterwards the "How it works" link at the top of the scroll view opens the same content as a page sheet.
- The example card is computed with `projectGrowth`.

## Scenarios

- `SCENARIOS` in `src/utils/freedom.ts`: Cautious 5%, Expected 7%, Optimistic 9%.
- `ScenarioSelector` sits under the basic inputs. A tap goes through `handleChange('returnPct', ...)` and changes nothing else.
- The selected segment is derived from the return field text (`matchScenario`), so a custom return selects none.
- The comparison row is `compareScenarios(lastValid)`: `projectGrowth` per scenario with only `returnPct` swapped (the fee still applies).

## Cash vs. invested (`CashComparison`)

- Always visible, between the basic inputs and the result card. No input and nothing saved, so it is not wrapped in `editable()`.
- `cashComparison(input)` in `src/utils/freedom.ts`: `invested` is the plan's final balance, `cash` is the same payments with 0% return and 0% fee (cash has no fund fee), `gain` is the difference.
- A fee above the return makes `gain` negative; the row then reads "Investing costs" with a positive amount.
- In Real mode `FreedomScreen` deflates all three with `toReal`, like the fee figures.
- The note is shown only when inflation is above 0. Future prices: what the cash buys in today's money (`cashToday`). Today's prices: the cash row is already deflated, so the note only names the inflation.
- Overlap, on purpose: `cash` equals "You pay in" on the result card and `gain` equals its "growth adds". The note is what this block adds.

## Persistence

- `getFreedomPlan` on mount / profile / `dataVersion`.
- `saveFreedomPlan` 500 ms after the last valid edit, flushed on unmount (segment switch), tab blur, profile change and app background.
- A currency switch does not convert `freedom_plans`.
- `getSavedFreedomPlan` returns `null` when the profile has no row; `getFreedomPlan` falls back to `DEFAULT_FREEDOM_PLAN`.

## Home card

- `FreedomCard` (`src/components/dashboard/FreedomCard.tsx`, under `DebtsCard`): nominal final balance at the plan's end year, and goal progress when a goal is set.
- Hidden until a plan is saved (`getSavedFreedomPlan`). Reloads on focus, profile and `dataVersion`.
- A tap navigates with `params: { segment: 'freedom' }`.

## Math

Per year `y`:

- `contrib = monthly * 12 * (1 + annualIncrease)^(y - 1)`
- `profit = (returnPct - feePct) * (start + contrib / 2)`
- `end = start + contrib + profit`; next `start = end`
- `totalInvested = lumpSum + sum(contrib)`; `finalBalance` = last `end`

Reference test vector: years 35, lumpSum 10000, monthly 250, annualIncrease 0.05, return 0.09, fee 0 => totalInvested 280960.92, finalBalance 1371766.71.

## Chart and table

- `GrowthChart` bars are cumulative: contributions = `min(cumulativeInvested, end)`, profit = `max(0, end - cumulativeInvested)`. So the last bar equals the Final balance card.
- `YearlyTable` shows the per-year `YearRow` figures.
- Cards, chart and table share one `rows` memo in `FreedomScreen`. The chart waits for `loadedSignature` (profile + `dataVersion`).
- `getNiceScale` lives in `src/utils/chartScale.ts` (shared with Trends).

## Impact (`ImpactSection`)

- Fee comparison from `feeImpact`: final balance at 0% fee vs the entered fee.
- Nominal / Real toggle: local state in `FreedomScreen`, not saved.
- Real = `toReal(value, inflationPct, years)` = `value / (1 + inflation)^years`.
- `toRealRows` deflates each `YearRow` by its own year: `start` by `year - 1` so it equals the previous `end`; `profit` is the remainder.
- In Real mode the `rows` memo, scenario balances and fee figures are all deflated, so the last bar still equals the Final balance card.

## Goal (`GoalSection`)

- Sits under the chart. It is an "Add a goal" row until a goal exists or it is tapped; then it stays open for that mount, keyed by profile.
- `goalType` (`BALANCE | INCOME`), `goalBalance` and `goalIncome` are part of `FreedomPlan` (columns `goal_type`, `goal_balance`, `goal_income`; 0 = no goal).
- `goalType` sits in the draft as is; `handleGoalType` resets an invalid hidden goal field.
- Income target = `incomeToBalance` = `income * 12 / SAFE_WITHDRAWAL_RATE` (4% rule, labelled as an assumption).
- On track = final balance (in the selected mode) >= target.

Solvers in `src/utils/freedom.ts`:

- `balanceAfter(input, years)`: fractional years, not capped at 60; whole years equal the `projectGrowth` rows.
- `yearsToReach(input, target, inflationPct = 0)`: year scan, then bisection inside the crossing year; `null` past `MAX_GOAL_YEARS` = 100.
- `monthlyNeeded(input, target, years, inflationPct = 0)`: bisection on the first-year monthly amount; `null` when no amount gets there.
- In Real mode `FreedomScreen` passes the plan's inflation, so the target is in today's money.

Tests: `npx tsx src/utils/freedom.test.ts`.

## Debt-free first (TODO)

There is no "debt-free first" option yet. When one is added, take the debt-free month from the payoff simulator (`buildDebtOutlook` in `src/services/debtPlanService.ts`) and add the freed-up payments (the debts' monthly payments plus the plan's `extraMonthly`) to the monthly contribution from that month on. See [debts.md](debts.md), "Payoff simulator".
