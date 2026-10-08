# Budget Health

Purpose: answer "Is our money in good shape, and what's the one thing to fix?"

## Rules

- 100% local and private. No network calls, no analytics. Local notifications only.
- Always labelled "Guidance, not financial advice." (`health.disclaimer`).
- Tone: warm and factual, never shaming. Include positive messages too.
- Respect the `dataVersion` refresh.
- Pro items (score history on the Health screen, "Export PDF" in the report) are enabled for everyone: there is no `useEntitlement()` / `FEATURES` yet, and each gate is marked `// TODO(pro)`.

## Benchmarks

- `src/constants/benchmarks.ts`: `BENCHMARK_GROUPS`, typical ranges as % of net monthly income; `DEFAULT_CATEGORY_GROUPS` for the built-in categories.
- `getRangesForHousehold`: +2 points per child on the Groceries and Childcare max, -2 on Groceries min / max for a single adult. Housing is shared by renters and owners.
- `categories.benchmark_group` holds the group per category: NULL = never chosen, `none` = "No benchmark" chosen. `ensureCategoriesSeeded` fills built-in rows that are still NULL.
- "Loan & Insurance" and "Credit Card Payments" map to the Debt group, "Financial Transfers" to Savings.

## Tables

- `household_profile` (one row per profile), `category_range_overrides`, `health_alerts` (unique `profile_id, month, type, key`), `alert_settings`.
- `clearAllData` and `deleteProfile` clear them (`clearHealthTables`).
- Renaming or deleting a category carries or drops its override.
- A currency switch converts `net_income_override` and `safety_savings` (`convertHouseholdAmounts`).

## Engine

- `src/utils/budgetHealth.ts` is pure: no DB, no UI. Tests: `npx tsx src/utils/budgetHealth.test.ts`.
- It cannot import `src/db/database.ts` (that pulls `expo-sqlite` into the `tsx` tests). The loaders live in `src/services/healthService.ts` (`loadHealthInput`, `loadHealth`, `loadNewAlerts`, `runHealthAlerts`) on top of `getHealthData` in `database.ts` (transactions with fixed / flexible already resolved, debts, debt payments).

### Net income and spending

- `detectNetIncome`: `net_income_override` wins; otherwise the average income of the last three complete months with data.
- Money coming in from a Savings-group category is not income.
- A month that is still running takes its income from the months before it and is only used itself when it is all there is.
- Spending leaves out money sent to a Savings-group category.
- Savings rate = (net income - spending) / net income. Every percentage is of net income, not of the month's actual income.

### Category statuses

- `categoryStatuses`: green within range (below the minimum is still green), yellow up to 20% above the max, red beyond, grey without a range or without income. Savings is reversed.
- "Your normal" = average of the three months before, months without data left out.
- Range order: the user's override, then the household range of the category's group.

### Pillars

`PILLAR_WEIGHTS`, `PILLAR_THRESHOLDS`, linear in between:

| Pillar | Weight | Full → zero |
| --- | --- | --- |
| Savings | 30 | >= 15% is full |
| Housing | 20 | 30% → 45% |
| Fixed costs | 15 | 55% → 75%, from the fixed / flexible resolver |
| Debt payments without mortgages | 20 | 10% → 30%, from `debt_payments` |
| Buffer | 15 | `safety_savings` >= 3 months of usual fixed costs |

- Debt pillar: while the month runs, a payment still to come counts at its usual amount.
- An unknown buffer has no score and the other pillars share its weight.
- No income or no data for the month: `enough` is false and there is no score.
- `biggestImprovement` returns a `Message` (`health.improve.<pillar>`, params `target`, `points`), not a string, like other text built outside React.

## Alerts

- `src/utils/healthAlerts.ts` is pure. Tests: `npx tsx src/utils/healthAlerts.test.ts`.
- `buildHealthAlerts(input, month)` returns every candidate, most severe first. `selectAlerts` drops disabled types and muted keys and keeps three.
- Types: `missed_debt_payment`, `new_recurring`, `price_increase`, `category_pace`, `unusual_transaction`, `savings_drop`, `positive_category`.
- Pace, unusual and positive only look at flexible spending (rent on the 1st is never "ahead of pace").
- The reference day of a running month is the last imported transaction date, so a statement that stops before a debt's due day (+3 days) does not report it as missed.

### Switches

- `alert_settings`, Health segment → ⋯ button: one switch per type decides both the in-app alert (Health segment and For You inbox) and the notification.
- Without a saved row a type follows `DEFAULT_ENABLED_ALERTS` (missed debt payment, new recurring charge), so good-news alerts only appear after their type is turned on.
- Permission is requested only when a switch is turned on (`requestHealthAlertPermission`).

### After import

- `runHealthAlerts(db, profileId)` runs in `useStatementImporter.runImport` after `cancelCurrentMonthReminders()` and before `refreshProfiles()`, so the screens reload with the alerts stored.
- It stores new alerts with `INSERT OR IGNORE` and calls `notifyHealthAlerts`, which shows them at once (`trigger: null`; scheduled ones would be cancelled by the import flow) and never asks for permission.
- The demo workspace gets no alerts (nothing is imported).

### Stored alerts

- `health_alerts.message` is a `Message` as JSON, so stored alerts follow the app language.
- Render with `alertText` (`src/utils/healthAlertText.ts`): params `amount` / `usual` become money, `category` a display name.
- "Don't alert me about this" (`muteAlertKey`) sets every alert of that type and key to `muted`; `getMutedAlertKeys` feeds `selectAlerts`.

## UI

In `src/components/health/`:

- `HealthScreen`: the Health segment of the Plan tab (see Placement). Nothing renders on Home.
- `AlertsStrip`: the latest month's `new` alerts at the top of the Health segment, each with "Got it" and "Don't alert me about this".
- `HealthIntro` / `HealthIntroModal`: the "How it works" page (see Intro).
- `ScoreRing`: `react-native-svg` + RN `Animated`, not Reanimated. The sweep is skipped when `AccessibilityInfo.isReduceMotionEnabled()`.
- `PillarRow`, `CategoryRangeRow`, `HouseholdSheet`, `BenchmarkGroupSheet`, `ScoreHistoryChart`.
- `HealthOptions` / `HealthOptionsSheet`: the bottom sheet opened from the ⋯ button in the top row of the segment (right of "How it works"): household profile, a switch per alert type, "Reset all range overrides". The household row closes the sheet before `HouseholdSheet` is presented. Budget Health has nothing in Settings.

## Placement

- Health is the second segment of the Plan tab (Debts | Health | Future Growth); the tab opens on Debts. `HealthScreen` renders inside that screen's `ScreenContainer`, like `FreedomScreen`: do not wrap it again. See [debts.md](debts.md) for the segment mechanics; links use `params: { segment: 'health' }`.
- It follows the month picked in `PeriodContext` (Home and Transactions); with a range or nothing picked it shows the latest month with data.
- In the segment:
  - tap a category → `TransactionListModal` → `TransactionDetailModal`;
  - long-press → action sheet: "This is fine for us" saves an override of ±20% around the current share, "Reset range", "Change benchmark group" (Android alerts take three buttons, so there is no Cancel button there);
  - opens `HouseholdSheet` once per visit while the profile has no household row;
  - asks once per custom category without a group, tracked in `app_meta` `health_group_prompt:<profileId>`.
- Alerts show in two places that stay in step: `AlertsStrip` in the segment and one row per `new` alert in the For You inbox ([navigation.md](navigation.md)). The strip calls `refreshInbox(true)` after an answer and reloads when the inbox's alert rows change.
- The only route is `src/app/health-report.tsx` (modal in the root `Stack`, optional `month` param, opened from the segment): `MonthStepper`, score and change, summary, pillars, categories, fixed vs. flexible, debts and debt-free month, the month's alerts and their status.

## Intro

- `src/components/health/HealthIntro.tsx`, same pattern as `FreedomIntro`.
- Until `app_meta` has `health_intro_seen` (app-wide, not per profile) `HealthScreen` renders the intro instead of the score; "See My Score" sets the key.
- Afterwards the "How it works" link at the top of the scroll view opens the same content as a page sheet.
- The example card's score and improvement line come from `pillarScores` / `healthScore` / `biggestImprovement`.
- The household sheet and the group prompt wait until the intro has been read.

## PDF

- `buildHealthReportHtml` in `src/utils/healthReportHtml.ts` (pure, every value HTML-escaped, no scripts or remote resources; tests: `npx tsx src/utils/healthReportHtml.test.ts`) → `expo-print` `printToFileAsync` → `expo-sharing` `shareAsync`.
- `expo-print` is native: it needs a new native build.
