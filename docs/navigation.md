# Navigation, screens and themes

## Routes

- Routes in `src/app`, tabs in `src/app/(tabs)`: Home (`index.tsx`), Trends, Plan.
- Transactions is not a tab: `src/app/transactions.tsx` is a card pushed on the root `Stack` (own header with a back button, iOS edge swipe goes back). It is opened with `router.push('/transactions')` from the header search icon, "See all" on Home and "Review" in the import summary. Back falls back to `router.replace('/(tabs)')` when nothing is underneath (opened by a link).
- The Plan tab's route is `debts` (`src/app/(tabs)/debts.tsx`) with three segments, Debts, Health and Future Growth; see [debts.md](debts.md), [health.md](health.md) and [freedom.md](freedom.md).
- The payoff plan is `src/app/debt-plan.tsx`, a pushed card like Transactions, opened from the hero card of the Debts segment; back falls back to the Plan tab. See [debts.md](debts.md).
- Budgets is `src/app/goals.tsx`. Review is `src/app/review.tsx`. Modal routes in the root `Stack` include `export-guide`, `health-report`, `data-privacy`, `legal`, `faq`, `licenses` and `paywall` ([subscription.md](subscription.md)).
- Typed routes: after adding a route file, `npx expo customize tsconfig.json` regenerates `.expo/types/router.d.ts` so `tsc` knows the new path.

## Welcome

- The root layout sends the app to `/welcome` once per launch when the active profile has no transactions (`hasData`). "Reset" and leaving the demo go there too. Until that route is decided (and Welcome is on top), the root layout keeps the splash screen and a plain background cover over the stack, and the redirect is not animated: Home is mounted underneath and would otherwise show its empty state ("Import Bank Statement") for a moment, most visibly on a reload, which has no splash screen.
- Before the screen, `WelcomeIntro` (`src/components/welcome/`) plays seven animated scenes (`scenes/`, one file per scene; about 23 seconds in all, the three questions get the longest); Welcome itself is the eighth. A tap moves to the next scene, "Skip" ends it. Scene order and durations, the donut split and the dot positions are in the pure `src/utils/welcomeIntro.ts` (`npx tsx src/utils/welcomeIntro.test.ts`).
- It plays once: `welcome_intro_seen` in `app_meta` is written when the intro ends or is skipped. The flag survives "Reset", so later visits open on Welcome directly; a restore replaces it. "Replay intro" at the top of Welcome plays it again without touching the flag. A failed read counts as seen.
- Scenes use RN `Animated` with the native driver (`useSceneValues` in `scenes/shared.tsx`): every value runs 0 → 1 and 1 is the finished picture. `PACE` there stretches every step; how long a scene stays is `INTRO_SCENE_DURATIONS_MS`. In the questions scene the newest question is enlarged (a scale, so it stays on the native driver) and drawn in the theme's `accent`; the earlier ones shrink back and fade to a dimmed `text` colour (two stacked texts cross-fade, since a colour cannot run on the native driver). With Reduce Motion the values start at 1, so each scene appears finished and scenes only cross-fade.
- The intro waits while the passcode lock or the app switcher covers the app (`locked`, `covered`, `AppState` not active): the scene is unmounted and starts again afterwards. With a screen reader on it does not advance by itself; captions are announced.
- Everything in the scenes is drawn (placeholder bars, plain cards, no bank names); the milestone dates are example values with an "Example" note. Colours come from the theme and `CATEGORY_COLORS`.
- The buttons are "Get started" (the profile questions and the import step; `welcome.getStarted`) and "Explore With Demo" (`welcome.tryDemo`). `welcome.import` is still the label of the import buttons on Home and in the export guide.

### Profile questions

- `src/components/profile/ProfileSetup.tsx`: three steps per profile (profile: name, avatar colour, currency; household: adults, children, rent / own; money: net monthly income, savings buffer). Every step has "Skip"; a skipped step keeps the defaults (`DEFAULT_HOUSEHOLD`, the profile's name and colour, the device region's currency when the app supports it, else EUR). Pure logic in `src/utils/profileSetup.ts` (`npx tsx src/utils/profileSetup.test.ts`); `setupSteps(withAppSteps)` gives the steps in order.
- With `appSteps` (Welcome only) two app-wide steps follow, `APP_SETUP_STEPS`: appearance (`ThemeSwatches` wrapped onto lines, plus the Dark Mode switch) and security (the passcode lock). Theme and passcode are not per profile, so "+ Add New" does not ask them, and they are not part of `SetupAnswers`: each is saved by its own context as it is picked.
  - Appearance: a tap applies the theme at once, as a preview. "Skip" on that step and closing the questions put back the theme and mode that were active when the questions opened (a mode that followed the system is then stored as that mode). A Pro theme is tried out instead of opening the paywall (`ThemeSwatches previewLocked`): it is shown through `setPreviewTheme` on `useTheme()`, which is state only and never written to `app_meta`, so a free user cannot keep it by closing the app. While it is shown, a note names it and the button reads "See Pro" and opens the paywall; the step is left by subscribing (the theme is then saved on "Next"), by picking a free theme, or by "Skip". The preview is cleared when the questions unmount.
  - Security: the button reads "Set a Passcode" and opens `PasscodeModal` in `set` mode; "Skip" moves on without one. Once a passcode exists (also one that survived "Reset") the step says so, has no "Skip" and the button moves on. A passcode set here stays when the questions are closed afterwards.
- It is a plain view hosted inline, not a `Modal` or a route, so it can sit inside the profile switcher sheet.
- Welcome: "Get started" shows it in place of the screen while the profile has no `household_profile` row. Finishing (also with every step skipped) saves that row and moves on to the last step, `FirstStatementStep` (`src/components/profile/`): "Import Bank Statement" opens the picker, with the export guide, the demo and "Restore backup" (the same `restoreOnly` sheet as on Welcome) as links. The picker never opens by itself. The row is what marks the questions as asked: from then on "Get started" opens the import step directly, and "Reset" clears the row and asks again. The close button of a question step saves no answers (a passcode that was set stays).
- Going back: every step after the first has a back button in place of the close button, and the Android back button does the same (`BackHandler` in `ProfileSetup` and `FirstStatementStep`; it does not fire inside the profile sheet, a `Modal`). On the import step it returns to the last question: Welcome keeps `ProfileSetup` mounted but hidden behind that step (`questionsOpen`, `paused`), so the answers are as they were typed, and "Continue" saves them again. When the import step is opened directly (questions answered in an earlier session, or `resume=1`) there is nothing to go back to: it has the close button, which returns to Welcome with the answers kept. "Explore With Demo", "Restore backup" and a first statement that arrives through the share sheet do not ask.
- Leaving the demo removes only the demo profile and its data (`setIsDemoMode(false)` in `ProfileContext`), so the user's own profile keeps its name, currency and household answers. "Exit Demo" opens Welcome with `resume=1`: when the questions are already answered, Welcome continues on the import step instead of starting over.
- Welcome reads the household row only while `loadingProfiles` is false and again on `dataVersion`: "Exit Demo" navigates to Welcome before the demo data is removed.
- Profile switcher: "+ Add New" shows it in place of the list; the name is required there (no "Skip" on the first step). The profile is created with its currency (`createProfile`) and its household row. Renaming a profile keeps the small name and colour form.
- Existing profiles without a household row are never asked: Budget Health uses the defaults and the answers are edited from its ⋯ options ([health.md](health.md)).

## Legal pages

- Settings ends with an About section: Frequently asked questions, Personal Data & Privacy, Rate the App, Write a Review and a Version row (the app version from `expo-constants`, not tappable, so its value can be copied).
- Rate the App and Write a Review open the app's own store page with `Linking.openURL`; the links come from `getStoreLinks(Platform.OS)` in `src/utils/storeLinks.ts`. iOS: the App Store page and the same page with `?action=write-review`. Android: the Play Store page and the same page with `&showAllReviews=true`. Both rows are hidden when the platform's ID in `STORE_IDS` is missing; `appStoreId` is null until the app exists in App Store Connect, so iOS shows no rows yet. The system star prompt (`expo-store-review`) is not used: it may show nothing when called from a button.
- Settings → About → Frequently asked questions is the modal route `faq` (`src/app/faq.tsx`): the groups of `FAQ_GROUPS` (`src/content/faq`), each a card of questions that open one at a time, with links to the export guides and to Personal Data & Privacy at the bottom. The row and the header use `faq.title` from that copy, so the app locale files have no FAQ keys. Screen and row names in an answer are placeholders filled from the app's own labels (`FAQ_APP_NAMES`); when a label's key is renamed, change it there. The website renders the same questions ([website.md](website.md)).
- The Personal Data & Privacy row is the modal route `data-privacy` (`src/app/data-privacy.tsx`). It starts with a short answer to what is stored, where, what is collected and how to delete it: the four blocks are sections 1, 2, 3 and 5 of the privacy policy, read from `src/content/legal` (`FACTS`), so the screen cannot say something the policy does not. Below, "Legal documents" holds the rows for Privacy Policy, Terms of Use, Disclaimer and Open-Source Licenses; Settings has no rows of its own for them.
- Privacy Policy, Terms of Use and Disclaimer push the modal route `legal` with a `page` param (`privacy | terms | disclaimer`; `src/app/legal.tsx`). The text is in the app (`src/content/legal`), so it opens offline and does not depend on the website, which publishes the same documents; see [website.md](website.md).
- Welcome shows "By continuing, you accept…" with links to the terms and the privacy policy. There is no checkbox and nothing is stored.
- Open-Source Licenses is the modal route `licenses` (`src/app/licenses.tsx`): the packages in `dependencies` with their license text, from the generated `src/constants/licenses.ts`. Run `npm run licenses` after adding, removing or upgrading a dependency. It lists direct dependencies only, not the packages they pull in.
- `app.json` sets `ios.config.usesNonExemptEncryption: false`: backups are encrypted with AES from `expo-crypto`, which is Apple's CryptoKit on iOS, and the key derivation is a hash. Revisit it when encryption is added that does not come from the operating system.

## Passcode lock

- Optional, app-wide (not per profile), six digits (`PASSCODE_LENGTH`). Settings → Security: a switch (set / remove) and, once set, "Change Passcode". All three run in `src/components/modals/PasscodeModal.tsx`; remove and change ask for the current passcode first. The first-launch questions offer to set one with the same sheet (see Profile questions).
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

- `direction` (`TrendDirection`: `EXPENSE | INCOME`, local state, not persisted) switches the whole tab with the two-segment control under the header. It is part of the load signature and of the chart `key`, and switching resets the category to All.
- Income is every positive amount, the same rule as `getMonthlySummary` on Home, so refunds and incoming transfers count. The trend queries (`getAnnualTrendWithBudget`, `getRangeTrendWithBudget`, `getDailyTrend`, `getYearlyExpenseTotals`, `getTransactionsByMonthAndCategory`) take `direction` as their last argument, default `EXPENSE`.
- In Income: the pills come from `getIncomeCategoryNames` (only categories that received money in the period), the All line is the income green, there is no budget (no goal card, no reference line, `budgetLimit` 0), the comparison colours flip (more than the other year is green), and the month sheet is `TransactionListModal` with `listType="INCOME"` and `getIncomeFixedVsFlexibleSummary`.
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
- Filters: date range and category. There is no type filter.
- Search and filters compare the stored English category name ([i18n.md](i18n.md)).

## For You inbox

- `getInboxItems` in `src/services/inboxService.ts` aggregates:
  - Budget Health alerts: one row per `new` alert of the latest month, first in the list. Tap opens the Plan tab's Health segment; dismissing sets the alert to `seen` ("Got it"). Their state lives in `health_alerts`, not in the dismissal map;
  - debt suggestions: always one row. A single suggestion opens the prefilled form, several navigate to the Debts tab; dismissing the row dismisses them all.
  - the uncategorised count,
  - `POSSIBLE` debt payment matches,
  - partial past months (not in demo mode),
  - the backup reminder (not in demo mode),
  - the Pro offer (`PRO_OFFER`): last, for a free user whose profile has transactions; once dismissed it stays away ([subscription.md](subscription.md)).
- `InboxProvider` / `InboxHost` (`src/contexts/InboxContext.tsx`) wrap the tabs layout. The host owns `InboxModal` plus the `DebtFormModal` and `BackupRestoreModal` its rows open.
- `InboxModal` is not a bottom sheet: `HeaderActions` measures the bell (`measureInWindow`) and passes it to `openInbox(anchor)`, and the panel scales out of that point (`transformOrigin`).
- Refresh: `HeaderActions` calls `refreshInbox` on focus. It is skipped while profile, `dataVersion`, `total_changes()` and day are unchanged. Screens that write without bumping `dataVersion` call `refreshInbox` themselves (Debts `load`).
- Dismissals: a JSON map in `app_meta` (`inbox_dismissed:<profileId>`, key → number). An item stays hidden while the stored number is >= its threshold: max transaction id for uncategorised / debt matches, snooze timestamp for backup. Debt suggestions use `dismissDebtSuggestion`.
- The bell badge counts everything except quiet items (`isQuietInboxItem`: backup, the Pro offer and good-news health alerts), which show a dot.

## Themes

- `THEMES` in `src/contexts/ThemeContext.tsx`: Aurora (default, the palette of the app icon), Classic, Midnight Gold, Sunset, Forest Mint, Orchid, each with light and dark `ThemeColors`. Theme names are not translated.
- Besides the base tokens there are `surface`, `track`, `field`, `raised` (use these instead of `isDark ? grey : grey`) and `gradient` / `onGradient` for hero surfaces (`LinearGradient`).
- Theme name and mode are saved in `app_meta` (`theme_name`, `theme_mode`) and read synchronously on launch. With no saved mode the system scheme is followed.
- Never hardcode light / dark colors; take them from `useTheme()`.
- Aurora, Classic and Sunset are free; the others show a lock (Settings and the first-launch questions, `ThemeSwatches`) and open the paywall, or are previewed without being saved in the questions (`isThemeLocked`, [subscription.md](subscription.md)). `ThemeProvider` itself does not check the tier, so a Pro theme that is active at a downgrade stays.

## Copyable text

- Static, read-only text is rendered with `SelectableText` (`src/components/SelectableText.tsx`, a `Text` with `selectable`): a long-press shows Copy on iOS and selection handles on Android. No clipboard module is involved.
- Use it only as the outermost text; nested spans stay plain `Text`.
- Never inside a touchable, a swipeable row, a row with `onLongPress` or a view with pan handlers (transaction rows, debt cards, Settings rows, buttons, chips): the long-press would fight the tap or swipe. Those stay plain `Text`, as do chart tick labels.
- Sheet content inside the `TouchableWithoutFeedback` that keeps taps from closing the sheet does use it.
- Alert messages (`Alert.alert`) cannot be copied.

## Profiles

- Deleting a profile (`deleteProfile`, from the profile switcher) removes everything it owns: transactions, rules, budgets, categories, debts with their payments and keywords, plans, household and alert rows, and its `app_meta` settings. Per-profile settings are stored under `<name>:<profileId>`; a new one must follow that form to be removed with the profile.

## Accessibility

- Every touchable has `accessibilityRole`; an icon-only one also has `accessibilityLabel` from `t()`. Shared labels are the `a11y.*` keys (previous, next, clear search, remove / edit / delete `{name}`, `a11y.colorOption`) and `common.close` / `common.back`.
- A control that shows a selected style (chips, segments, picker rows, colour swatches) also sets `accessibilityState={{ selected }}`.
- Bottom sheets built as backdrop `TouchableOpacity` → `TouchableWithoutFeedback` → sheet `View`: both touchables need `accessible={false}`. Without it React Native marks them as one accessible element and VoiceOver cannot reach anything inside the sheet. The sheet `View` has `onAccessibilityEscape` and the `Modal` has `onRequestClose` (Android back), both calling the same close handler.
- Large text: money amounts in a fixed-width card use `numberOfLines={1}` with `adjustsFontSizeToFit` so they shrink instead of breaking inside the number; a label / value row wraps (`flexWrap`); text in a fixed-size circle (avatar letter, badge count) has `allowFontScaling={false}`; the tab screen titles are capped with `maxFontSizeMultiplier`. A list row lets its label shrink and wrap (`flex: 1` on the left side, `flexShrink: 1` on the text) and a card header with a value on the right wraps (`flexWrap`). Checked at the "accessibility extra large" size (`xcrun simctl ui booted content_size accessibility-extra-large`) on the top of Home, Transactions, Settings, Budgets, Categories, Review, Trends, Plan, the payoff plan, the paywall, FAQ, Personal Data & Privacy and the export guide; not checked: anything below the first screenful, the sheets and Welcome.
- Animations that count or draw (`CountUpText`, `ScoreRing`, the Welcome scenes) skip to the end with Reduce Motion.

## Performance

- `npm run perf` (`scripts/perf-db.ts`) fills an in-memory SQLite database with 20,000 made-up transactions and times the loaders of each screen through the real `src/db/database.ts`. Node's SQLite and V8 stand in for expo-sqlite and Hermes, so compare runs with each other, not with a phone. The "calls" column is the number of round trips to the native side.
- Indexes on `transactions`: `(profileId, date DESC)` for lists and ranges, `(profileId, monthName)` for month queries, `(profileId, category)` for category counts and the review list.
- A range period is queried as `date >= from AND date < dayAfter(to)`; `substr(date, 1, 10)` in a `WHERE` cannot use the date index.
- Loops over many rows must not issue one statement per row: `insertTransactions` inserts 50 rows per statement, `reclassifyAllUnoverriddenTransactions` only writes rows whose category changes, `ensureCategoriesSeeded` is three statements.
- Still proportional to the number of transactions, in JavaScript: classifying (import, reclassify after a rule change), the fixed / flexible resolver (rebuilt after any write), `getHealthData`, `getDebtKeywordMatches` (once per debt) and `getDebtSuggestions`.

