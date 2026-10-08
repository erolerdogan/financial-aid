# Navigation, screens and themes

## Routes

- Routes in `src/app`, tabs in `src/app/(tabs)`: Home (`index.tsx`), Transactions, Trends, Plan.
- The Plan tab's route is `debts` (`src/app/(tabs)/debts.tsx`) with three segments, Health, Debts and Future Growth; see [health.md](health.md), [debts.md](debts.md) and [freedom.md](freedom.md).
- Budgets is `src/app/goals.tsx`. Review is `src/app/review.tsx`. Modal routes in the root `Stack` include `export-guide` and `health-report`.
- Typed routes: after adding a route file, `npx expo customize tsconfig.json` regenerates `.expo/types/router.d.ts` so `tsc` knows the new path.

## Headers

- Headers use `HeaderActions` (profile, "For You" bell, settings); the bell is in every tab header.
- `ImportSummaryHost` is mounted in the tabs layout and in Settings.

## Tab swipe

- `TabSwipeProvider` (`src/contexts/TabSwipeContext.tsx`) wraps `<Tabs>` in a `View` with a `PanResponder`. It is not RNGH: Reanimated cannot be imported directly under this tsconfig.
- It claims only clearly horizontal drags and navigates along `TAB_ORDER`.
- Tabs use `animation: 'shift'` with a custom `sceneStyleInterpolator` (full-width slide, no fade). The stock one fades both screens and flashes the backdrop.
- Forward into `/debts` passes `segment: 'health'` (the first segment).
- A focused screen can take the swipe first with `useTabSwipeInterceptor` (the Plan tab steps Health → Debts → Future Growth).
- Any area with its own horizontal gesture must block it: `onTouchStart={useBlockTabSwipe()}` or a `TabSwipeBlocker` wrapper. Current blockers: Trends chart and pills, `CategoryFilterBar`, debt `Swipeable` rows.
- The flag is cleared in the root's `onStartShouldSetPanResponderCapture`, so the responder is never claimed for a touch that started there.

## Picked period

- Home and Transactions share the picked period through `PeriodContext` (`ALL | MONTH | RANGE`, per profile).
- `ALL` means nothing picked: Home shows the latest month, Transactions the full list.
- Trends keeps its own year / range and follows the picked month's year.
- Period queries take a "period key": `YYYY-MM` or a range key from `makeRangeKey(from, to)`.

## Drill-down

- Home cards and Trends ("Inspect items") drill down into `TransactionListModal`, a bottom sheet, then `TransactionDetailModal`. They do not navigate to the Transactions tab.
- The fixed vs. flexible split is shown inside the sheet, not on Home.

## Home

- Category rows in `AllocationChart` expand inline to their transactions (state in `src/app/(tabs)/index.tsx`), straight to `TransactionDetailModal`, no sheet.
- Home has no attention rows any more; those are in the For You inbox.
- Cards below the allocation chart: `DebtsCard`, then `FreedomCard` ([freedom.md](freedom.md)). Budget Health has no card on Home; it lives in the Plan tab ([health.md](health.md)).

### Allocation chart type

- `allocationChart` / `setAllocationChart` on `useTheme()`: `donut | bars | stacked | treemap`, `app_meta` key `allocation_chart`, app-wide, read synchronously like the theme.
- There is no Settings row. The icon button in the card header steps to the next type on each tap (`handleNextChart`; icons and labels in `CHART_OPTIONS` in `AllocationChart.tsx`).
- `AllocationChart` keeps the donut inline and renders `ColumnsChart` / `StackedChart` / `TreemapChart` from `src/components/dashboard/allocation/`, with the total above the chart. Those are plain `View`s whose segments call `onCategoryPress`; the donut is not tappable.
- All draw the displayed categories only (top 4 until "view all").
- Treemap layout: `layoutTreemap` in `src/utils/treemap.ts`. Tests: `npx tsx src/utils/treemap.test.ts`.

## Trends

- The year view draws the previous year as a second, dashed line (`data2` on the `LineChart` in `src/app/(tabs)/trends.tsx`).
- `previousYearValues` comes from a second `getAnnualTrendWithBudget` call for `selectedYear - 1`. It is empty when that year has no spending for the category, and is never shown for ranges or the daily view.
- Scrubbing follows the current year only (`hidePointer2`).
- While a month is selected, a "vs last year" card under the chart shows the difference with the same month of the previous year (display only, not tappable).
- `getNiceScale` (`src/utils/chartScale.ts`) is shared with the Future Growth chart.

## Transactions

- Search is live: every keystroke queries, no debounce. `requestRef` in `src/app/(tabs)/transactions.tsx` drops superseded results.
- The list query runs in its own focus effect, so typing does not reload the filter options.
- Filters: date range and category. There is no type filter (the unused `type` argument is noted in [classifier.md](classifier.md)).
- Search and filters compare the stored English category name ([i18n.md](i18n.md)).

## For You inbox

- `getInboxItems` in `src/services/inboxService.ts` aggregates:
  - Budget Health alerts: one row per `new` alert of the latest month, first in the list. Tap opens the Plan tab's Health segment; dismissing sets the alert to `seen` ("Got it"). Their state lives in `health_alerts`, not in the dismissal map;
  - debt suggestions: always one row. A single suggestion opens the prefilled form, several navigate to the Debts tab; dismissing the row dismisses them all.
  - the uncategorised count,
  - `POSSIBLE` debt payment matches,
  - partial past months,
  - the backup reminder (not in demo mode).
- `InboxProvider` / `InboxHost` (`src/contexts/InboxContext.tsx`) wrap the tabs layout. The host owns `InboxModal` plus the `DebtFormModal` and `BackupRestoreModal` its rows open.
- `InboxModal` is not a bottom sheet: `HeaderActions` measures the bell (`measureInWindow`) and passes it to `openInbox(anchor)`, and the panel scales out of that point (`transformOrigin`).
- Refresh: `HeaderActions` calls `refreshInbox` on focus. It is skipped while profile, `dataVersion`, `total_changes()` and day are unchanged. Screens that write without bumping `dataVersion` call `refreshInbox` themselves (Debts `load`).
- Dismissals: a JSON map in `app_meta` (`inbox_dismissed:<profileId>`, key → number). An item stays hidden while the stored number is >= its threshold: max transaction id for uncategorised / debt matches, snooze timestamp for backup. Debt suggestions use `dismissDebtSuggestion`.
- The bell badge counts everything except quiet items (`isQuietInboxItem`: backup and good-news health alerts), which show a dot.

## Themes

- `THEMES` in `src/contexts/ThemeContext.tsx`: Aurora, Midnight Gold, Sunset, Forest Mint, Orchid, Classic (default), each with light and dark `ThemeColors`. Theme names are not translated.
- Besides the base tokens there are `surface`, `track`, `field`, `raised` (use these instead of `isDark ? grey : grey`) and `gradient` / `onGradient` for hero surfaces (`LinearGradient`).
- Theme name and mode are saved in `app_meta` (`theme_name`, `theme_mode`) and read synchronously on launch. With no saved mode the system scheme is followed.
- Never hardcode light / dark colors; take them from `useTheme()`.
