# Navigation, screens and themes

## Routes

- Routes in `src/app`, tabs in `src/app/(tabs)`: Home (`index.tsx`), Trends, Plan.
- Transactions is not a tab: `src/app/transactions.tsx` is a card pushed on the root `Stack` (own header with a back button, iOS edge swipe goes back). It is opened with `router.push('/transactions')` from the header search icon, "See all" on Home and "Review" in the import summary. Back falls back to `router.replace('/(tabs)')` when nothing is underneath (opened by a link).
- The Plan tab's route is `debts` (`src/app/(tabs)/debts.tsx`) with three segments, Debts, Health and Future Growth; see [debts.md](debts.md), [health.md](health.md) and [freedom.md](freedom.md).
- Budgets is `src/app/goals.tsx`. Review is `src/app/review.tsx`. Modal routes in the root `Stack` include `export-guide`, `health-report`, `data-privacy`, `legal`, `faq` and `licenses`.
- Typed routes: after adding a route file, `npx expo customize tsconfig.json` regenerates `.expo/types/router.d.ts` so `tsc` knows the new path.

## Legal pages

- Settings ends with an About section with one row, Personal Data & Privacy, and the app version from `expo-constants` below it.
- Settings → About → Frequently asked questions is the modal route `faq` (`src/app/faq.tsx`): the groups of `FAQ_GROUPS` (`src/content/faq`), each a card of questions that open one at a time, with links to the export guides and to Personal Data & Privacy at the bottom. The row and the header use `faq.title` from that copy, so the app locale files have no FAQ keys. Screen and row names in an answer are placeholders filled from the app's own labels (`FAQ_APP_NAMES`); when a label's key is renamed, change it there. The website renders the same questions ([website.md](website.md)).
- That row is the modal route `data-privacy` (`src/app/data-privacy.tsx`). It starts with a short answer to what is stored, where, what is collected and how to delete it: the four blocks are sections 1, 2, 3 and 5 of the privacy policy, read from `src/content/legal` (`FACTS`), so the screen cannot say something the policy does not. Below, "Legal documents" holds the rows for Privacy Policy, Terms of Use, Disclaimer and Open-Source Licenses; Settings has no rows of its own for them.
- Privacy Policy, Terms of Use and Disclaimer push the modal route `legal` with a `page` param (`privacy | terms | disclaimer`; `src/app/legal.tsx`). The text is in the app (`src/content/legal`), so it opens offline and does not depend on the website, which publishes the same documents; see [website.md](website.md).
- Welcome shows "By continuing, you accept…" with links to the terms and the privacy policy. There is no checkbox and nothing is stored.
- Open-Source Licenses is the modal route `licenses` (`src/app/licenses.tsx`): the packages in `dependencies` with their license text, from the generated `src/constants/licenses.ts`. Run `npm run licenses` after adding, removing or upgrading a dependency. It lists direct dependencies only, not the packages they pull in.
- `app.json` sets `ios.config.usesNonExemptEncryption: false`: backups are encrypted with AES from `expo-crypto`, which is Apple's CryptoKit on iOS, and the key derivation is a hash. Revisit it when encryption is added that does not come from the operating system.

## Passcode lock

- Optional, app-wide (not per profile), six digits (`PASSCODE_LENGTH`). Settings → Security: a switch (set / remove) and, once set, "Change Passcode". All three run in `src/components/modals/PasscodeModal.tsx`; remove and change ask for the current passcode first.
- Stored in `passcode.json` in the document directory (`src/services/passcodeStore.ts`), not in `app_meta`: a backup is the whole database, so a row would travel inside every backup file, and a restore would replace this device's passcode with the backup's. The file survives "Reset" and is read synchronously on launch, so the first frame is locked.
- The file holds a salted scrypt hash (`@noble/hashes` v1, salt from `expo-crypto`), the wrong tries so far and `lockedUntil`. Pure logic and its tests: `src/utils/passcode.ts`, `npx tsx src/utils/passcode.test.ts`. The cost is low on purpose: six digits can be tried exhaustively at any cost. The lock keeps someone holding the unlocked phone out of the app; it does not encrypt the database.
- An unreadable file counts as "no passcode" (`parsePasscodeRecord` returns null): failing closed would lock the user out for good.
- `PasscodeProvider` (`src/contexts/PasscodeContext.tsx`, inside `ThemeProvider`) gives `enabled`, `locked`, `covered`, `attempt`, `waitSeconds`, `setPasscode`, `removePasscode`. `attempt` is the only way to unlock: it checks the code, counts a wrong try and writes the count before answering.
- Locked on launch and on every `AppState` `background`. On `inactive` (iOS: app switcher, Control Centre, system prompts) `covered` shows a blank cover without asking for the passcode. Android has no `inactive`, so its recents picture is not covered (that needs `FLAG_SECURE`, a native change).
- On Android the system file and folder pickers are other activities: picking a statement or a backup folder sends the app to `background`, so the passcode is asked on the way back. The flow underneath carries on after unlocking.
- Wrong tries: four are free, then a wait of 1, 5, 15 and 60 minutes (`lockoutSeconds`). The count is cleared by the right passcode only.
- `PasscodeLockHost` (`src/components/passcode/`) is mounted in the root layout next to the Stack. It must sit above modal routes and open sheets: `FullWindowOverlay` from `react-native-screens` on iOS (a second `Modal` cannot present while one is up), a `Modal` on Android (a dialog; a later one stacks on top, and back leaves the app).
- `SharedImportHost` waits while `locked`, so a file shared into a locked app is imported after the passcode.
- There is no recovery: the setup step says to keep a backup. Deleting the app removes the file; Welcome → "Restore backup" brings the data back.

## Headers

- Tab headers use `HeaderActions` (profile, search, "For You" bell, settings). The bell is in every tab header; search is on Home and Trends only (the Plan tab passes `showSearch={false}`: it is not about transactions and its header also holds the add-debt button).
- The search icon pushes `/transactions` with `focusSearch: '1'`. The screen reads the param once, passes it as `autoFocus` to the search field and clears it with `router.setParams`. It does not change the picked period.
- `HeaderActions` needs `InboxProvider`, which wraps the tabs only, so screens outside the tabs (Transactions) cannot use it.
- `ImportSummaryHost` is mounted in the tabs layout and in Settings. Its "Review" button dismisses any modal route first (`router.dismissAll`), then pushes `/transactions`.

## Tab swipe

- `TabSwipeProvider` (`src/contexts/TabSwipeContext.tsx`) wraps `<Tabs>` in a `View` with a `PanResponder`. It is not RNGH: Reanimated cannot be imported directly under this tsconfig.
- It claims only clearly horizontal drags and navigates along `TAB_ORDER` (`/`, `/trends`, `/debts`).
- It wraps the tabs only: pushed screens (Transactions) are outside it, and `useBlockTabSwipe()` is a no-op there.
- Tabs use `animation: 'shift'` with a custom `sceneStyleInterpolator` (full-width slide, no fade). The stock one fades both screens and flashes the backdrop.
- Forward into `/debts` passes `segment: 'debts'` (the first segment).
- A focused screen can take the swipe first with `useTabSwipeInterceptor` (the Plan tab steps Debts → Health → Future Growth).
- Any area with its own horizontal gesture must block it: `onTouchStart={useBlockTabSwipe()}` or a `TabSwipeBlocker` wrapper. Current blockers: Trends chart and pills, `CategoryFilterBar`, debt `Swipeable` rows.
- The flag is cleared in the root's `onStartShouldSetPanResponderCapture`, so the responder is never claimed for a touch that started there.

## Picked period

- Home and Transactions share the picked period through `PeriodContext` (`ALL | MONTH | RANGE`, per profile).
- `ALL` means nothing picked: Home shows the latest month, Transactions the full list.
- "See all" on Home therefore pins the month Home is showing (`setPeriod`) before it pushes Transactions, so both show the same period. The search icon leaves the period alone.
- Trends keeps its own year / range and follows the picked month's year.
- Period queries take a "period key": `YYYY-MM` or a range key from `makeRangeKey(from, to)`.
- The Custom Range sheet (`DateRangeModal`, on Home, Transactions and Trends) has three levels: days, the months of a year, and the list of years. Tapping the title zooms out (month → year → year list); tapping a year or month cell zooms back in. Month and year cells only move the calendar: the range is always two tapped days. The arrows step one month on the day grid and one year on the month grid. Bounds and overlap helpers are in `src/utils/calendarNav.ts`.

## Drill-down

- Home cards and Trends ("Inspect items") drill down into `TransactionListModal`, a bottom sheet, then `TransactionDetailModal`. They do not navigate to the Transactions screen.
- The fixed vs. flexible split is shown inside the sheet, not on Home.

## Home

- Category rows in `AllocationChart` expand inline to their transactions (state in `src/app/(tabs)/index.tsx`), straight to `TransactionDetailModal`, no sheet.
- Home has no attention rows any more; those are in the For You inbox.
- `RecentActivityCard` (`src/components/dashboard/`) sits below the allocation chart: the 5 newest transactions of the shown period (`getRecentTransactions`, loaded in `loadDashboardData`), in the same `TransactionRow` as the Transactions list. A row opens `TransactionDetailModal`; "See all" pushes `/transactions`. Hidden when the period has no rows.
- Cards below it: `DebtsCard`, then `FreedomCard` ([freedom.md](freedom.md)). Budget Health has no card on Home; it lives in the Plan tab ([health.md](health.md)).

### Allocation chart type

- `allocationChart` / `setAllocationChart` on `useTheme()`: `donut | bars | stacked | treemap`, `app_meta` key `allocation_chart`, app-wide, read synchronously like the theme.
- There is no Settings row. The icon button in the card header steps to the next type on each tap (`handleNextChart`; icons and labels in `CHART_OPTIONS` in `AllocationChart.tsx`).
- `AllocationChart` keeps the donut inline and renders `ColumnsChart` / `StackedChart` / `TreemapChart` from `src/components/dashboard/allocation/`, with the total above the chart. Those are plain `View`s whose segments call `onCategoryPress`; the donut is not tappable.
- All draw the displayed categories only (top 4 until "view all").
- Treemap layout: `layoutTreemap` in `src/utils/treemap.ts`. Tests: `npx tsx src/utils/treemap.test.ts`.

## Trends

- The year view can draw up to four other years next to the selected one (`data2`..`data5` on the `LineChart` in `src/app/(tabs)/trends.tsx`, cap `MAX_COMPARE_YEARS`). All lines are solid; the selected year keeps its area fill.
- The years are picked with the chips above the chart, which are also the legend. The selected year's chip is always on and cannot be toggled. A year without spending for the category, and every off chip once four are on, is disabled.
- `pickedCompareYears` is `null` until a chip is tapped, which shows the previous year when it has spending. After that the picked set is kept for the session (not persisted) and survives a change of year, minus the newly selected year. The rules are in `src/utils/yearComparison.ts` (`resolveCompareYears`, `toggleCompareYear`).
- Line colours come from `COMPARE_SERIES_COLORS` (`src/constants/colors.ts`) through `pickSeriesColors`, which skips the colour of the selected year's line (the accent or the category colour).
- `yearTotals` holds the monthly totals of every year except the selected one, from a single `getYearlyExpenseTotals` query, so toggling a chip does not refetch. It is empty for ranges and the daily view, which show no chips and no comparison.
- Scrubbing follows the selected year only (`hidePointer2`..`hidePointer5`).
- While a month is selected, a card under the chart lists each compared year with that month's amount and the difference (display only, not tappable). Years with nothing spent in that month are left out.
- `getNiceScale` (`src/utils/chartScale.ts`) is shared with the Future Growth chart.

## Transactions

- Search is live: every keystroke queries, no debounce. `requestRef` in `src/app/transactions.tsx` drops superseded results.
- The list query runs in its own focus effect, so typing does not reload the filter options.
- Filters: date range and category. There is no type filter (the unused `type` argument is noted in [classifier.md](classifier.md)).
- Search and filters compare the stored English category name ([i18n.md](i18n.md)).

## For You inbox

- `getInboxItems` in `src/services/inboxService.ts` aggregates:
  - Budget Health alerts: one row per `new` alert of the latest month, first in the list. Tap opens the Plan tab's Health segment; dismissing sets the alert to `seen` ("Got it"). Their state lives in `health_alerts`, not in the dismissal map;
  - debt suggestions: always one row. A single suggestion opens the prefilled form, several navigate to the Debts tab; dismissing the row dismisses them all.
  - the uncategorised count,
  - `POSSIBLE` debt payment matches,
  - partial past months (not in demo mode),
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

## Copyable text

- Static, read-only text is rendered with `SelectableText` (`src/components/SelectableText.tsx`, a `Text` with `selectable`): a long-press shows Copy on iOS and selection handles on Android. No clipboard module is involved.
- Use it only as the outermost text; nested spans stay plain `Text`.
- Never inside a touchable, a swipeable row, a row with `onLongPress` or a view with pan handlers (transaction rows, debt cards, Settings rows, buttons, chips): the long-press would fight the tap or swipe. Those stay plain `Text`, as do chart tick labels.
- Sheet content inside the attribute-less `TouchableWithoutFeedback` that keeps taps from closing the sheet does use it.
- Alert messages (`Alert.alert`) cannot be copied.
