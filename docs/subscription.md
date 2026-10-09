# Free and Pro

Two tiers, one entitlement (`pro`). There is no payment SDK yet: the paywall is real, buying is a stub. Still 100% local: no account, no login, no analytics.

## Product rules

- Products later: monthly, yearly (7-day trial), lifetime.
- Never gated: backup and restore, export, delete, the passcode lock, languages, and data correctness (transfer detection, categorisation).
- A downgrade never deletes or hides data. What is beyond a free limit stays visible and read-only, with "Renew to edit". Deleting it stays possible.
- Every check goes through `useEntitlement()` and the `FEATURES` map. No `isPro` flags of a screen's own.
- The Demo Workspace shows everything: `isPro` is true there, and the "Pro" badges stay (without the lock) because `source` is still `free`, and the demo profile is never read-only.

## The layer

- `src/constants/features.ts`: `FEATURES`.
  - `limits`: `maxProfiles` 1, `maxBudgets` 3, `maxDebts` 2.
  - `freeThemes`: Aurora, Classic, Sunset.
  - `flags`: `pdfImport`, `trendsCustomRange`, `trendsDaily`, `trendsLastYear`, `budgetHealth`, `futureGrowth`, `allThemes`, `debtSimulator`. Placeholders that gate nothing yet: `healthFull`, `wrapPro`, `reportPdf`, `multiAccount`.
  - `PaywallFeature`: why the paywall was opened.
- `src/utils/entitlement.ts` (pure, tested in `entitlement.test.ts`): `resolveSource`, `can`, `limit`, `canAdd`, `editableIds`, `isItemReadOnly`, `isProfileReadOnly`, `isThemeLocked`, `shouldOfferPro`.
- `src/contexts/EntitlementContext.tsx`: `useEntitlement()` gives `isPro`, `can(flag)`, `limit(key)`, `source` (`free | pro | dev`), `setDevOverride`, `refresh`, and the read-only notice (`showReadOnly`, `hideReadOnly`). The provider sits inside `ProfileProvider` (it needs `isDemoMode`).
- Today the tier is the Pro testing switch: `app_meta` key `pro_dev_override`, read synchronously like the theme. **It counts only when `PRO_TESTING_ENABLED` is true** (`src/constants/buildConfig.ts`: `__DEV__`, or a release build bundled with `EXPO_PUBLIC_PRO_TESTING=1`; see Testing Pro in a release build). In any other build the provider does not read the key and `resolveSource` returns `free` whatever is stored. `app_meta` travels inside backups and stays on the device across an update, so a value left by a test build, or restored from a backup made by one, can never unlock Pro in a production build.
- `isPro` includes the demo; `source` does not. Use `source` for "what did the user buy" (Settings status, the paywall, the offers).

## Building blocks

- `usePaywall()` (`src/hooks/usePaywall.ts`): `openPaywall(feature?)`.
- `useProfileAccess()` (`src/hooks/useProfileAccess.ts`): `readOnly` for the active profile and `guardWrite(action)`, which runs the action or shows the read-only sheet.
- `useBudgetGate()` (`src/hooks/useBudgetGate.ts`): `isReadOnly(category)`, `guardBudget(category, edit, onRemove)`, `reload()`.
- `src/components/pro/`:
  - `ProBadge`: the "Pro" pill.
  - `ProGate`: wraps a Pro feature. Without Pro the children are dimmed, a badge sits on top and a tap anywhere opens the paywall. It never renders nothing.
  - `ReadOnlySheetHost`: the sheet with "See Pro" / "Not now" (and "Remove budget" for a budget). Like `ImportSummaryHost`, it is rendered inside each screen that can be on top and only while focused: a sheet mounted at the root cannot present over a native modal screen. It is in the tabs layout, Settings, Budgets, Categories, Review and the export guide. A new screen with a guarded write needs it too.
  - `ReadOnlyNote`: the inline note for controls inside an RN `Modal`, where the sheet cannot present. Those controls are disabled instead.
  - `ReadOnlyBanner`: shown by `ScreenContainer` while the active profile is read-only.
- A screen (the paywall) cannot present while a `Modal` is still closing. Callers close their sheet first and open the paywall after about 300 ms.

## What stays editable

The oldest items, so nothing changes under the user when they add something:

- Profiles: by `id`. A read-only profile can still be switched to, exported, backed up and deleted.
- Debts: by `id`, which is the order of the list.
- Budgets: `getBudgetOrder` (`category_goals` with a limit above 0, by `rowid`). A cleared budget keeps its row, so it returns to its old place when it is set again.

Removing an old item makes the next one editable.

## Gated locations

| Area | Where | What happens without Pro |
| --- | --- | --- |
| Second profile | `ProfileSwitcherModal` "+ Add New" | Badge; closes the sheet and opens the paywall. Extra profiles are listed with "Read-only · Renew to edit", no rename, delete stays |
| Read-only profile: import | `useStatementImporter` (`importStatement`, `importSharedFile`) | Read-only sheet |
| Read-only profile: category and fixed / flexible | `TransactionDetailModal` (Home, Trends, Transactions, Health) | Controls off, inline note |
| Read-only profile: review | `review.tsx` | Read-only sheet |
| Read-only profile: categories and rules | `categories.tsx` (create, edit) | Read-only sheet |
| Read-only profile: budgets | `goals.tsx`, Trends inline budget (through `useBudgetGate`) | Read-only sheet |
| Read-only profile: debts | `(tabs)/debts.tsx`, `DebtDetailModal`, `InboxHost` | Read-only sheet; the detail sheet has no Edit, no payment form, no remove buttons. Delete stays |
| Read-only profile: Future Growth | `FreedomScreen` | Inputs take no focus; a tap shows the sheet; nothing is saved |
| Read-only profile: Budget Health | `HealthScreen` (household, long-press actions), `HealthOptions` | Read-only sheet; options off with the inline note |
| Read-only profile: currency | `settings.tsx` | Read-only sheet |
| Budgets beyond 3 | `goals.tsx`, Trends inline budget | A fourth budget opens the paywall. Extra budgets show a lock and "Renew to edit"; the sheet offers "Remove budget" |
| Debts beyond 2 | `(tabs)/debts.tsx` (add button, empty state, suggestion cards), `InboxHost` (single suggestion, payment matches) | A third debt opens the paywall. Extra debts show a lock; swipe keeps Delete only |
| PDF import | `readStatementFile(..., { allowPdf })` → `ProRequiredError`, caught in `runImport` | The PDF is not read; CSV / Excel files of the same pick are imported; the paywall opens, then the summary. Picker and share sheet |
| Debt payoff plan | `debt-plan.tsx`: extra per month, strategy, one-off payments, chart and strategy comparison in `ProGate` (paywall reason `debtSimulator`); `buildDebtOutlook` for the hero and Home card | Dimmed with a badge. The debt-free date and payoff order follow the current payments; a saved plan is kept but not applied |
| Read-only profile: debt payoff plan | `debt-plan.tsx` | Controls take no touches; a tap shows the sheet; nothing is saved |
| Trends custom range | Period sheet row, `handleOpenRangePicker` (Expenses and Income alike, as for the two rows below) | Badge; opens the paywall |
| Trends daily view | `isDailyMode` | Off (it only exists inside a custom range) |
| Trends year comparison | `compareSeries`, the year chips (`ProGate`) | No comparison line; chips dimmed with a badge |
| Future Growth (whole segment, `futureGrowth`) | `FreedomScreen`; lock on the segment label in `(tabs)/debts.tsx` | Always the full screen, read-only. No saved plan for the profile: the default plan as an example, with the note `pro.locked.examplePlan`. A saved plan (`getSavedFreedomPlan`): the full screen, read-only, with the note on top; a tap on an input opens the paywall and nothing is saved. The Home card only exists for a saved plan |
| Budget Health (whole segment, `budgetHealth`) | `HealthScreen`, `HealthOptions`; lock on the segment label | Always the full screen, read-only, so the score is visible for free. No household saved: the note reads `pro.locked.note`. With or without a household: read-only (household, long-press actions and options off) |
| Budget Health alerts | `runImport` in `useStatementImporter` | `runHealthAlerts` is not called, so no alert rows and no notifications are created. Alerts stored earlier stay under the bell |
| Themes | `src/components/ThemeSwatches.tsx` (Settings → Appearance; in the appearance step of the first-launch questions a locked theme is previewed, not saved, and "Next" becomes "See Pro") | Lock on every theme except Aurora, Classic and Sunset. A Pro theme that is still active stays until another one is picked |

Not gated yet (placeholder flags): Health score history (`healthFull`) and the report's "Export PDF" (`reportPdf`); both carry a `TODO(pro)`.

## Paywall

- `src/app/paywall.tsx`, a modal route with the optional param `feature`. The group of benefits that answers the feature comes first and is outlined; a line on top says why the paywall opened.
- Content: `src/constants/paywall.ts` (`PLANS` with placeholder prices, `DEFAULT_PLAN` yearly, `BENEFIT_GROUPS`, `TERMS_URL`, `PRIVACY_URL`). The two links are placeholders (`example.com`): replace them before the paywall goes live.
- With `source !== 'free'` the screen shows "You have Pro" and no plans.
- Settings → Subscription: plan (Free / Pro / Developer), "See Pro", "Restore purchases", and with `PRO_TESTING_ENABLED` the "Pro (testing)" switch. Such a build also shows a "TEST BUILD" label at the bottom of Settings.

## Purchases

- `src/services/purchases.ts` is the only file that talks to the store: `getOfferings()`, `purchase(db, plan)`, `restore()`.
- Today: in `__DEV__`, `purchase` turns the developer switch on and returns `success`; in a release build it returns `comingSoon`. `restore` finds nothing.
- Later RevenueCat goes into this file, and `EntitlementProvider` takes the tier from it (`source: 'pro'`) instead of the developer switch. The real entitlement must not be stored in `app_meta` (backups).

## Testing Pro in a release build

- `EXPO_PUBLIC_PRO_TESTING` is a build-time flag. Expo inlines it into the JavaScript bundle, so it cannot change after the build. It is listed in `.env.example`.
- `PRO_TESTING_ENABLED` (`src/constants/buildConfig.ts`) is the only place that reads it; nothing else checks the variable or `__DEV__` for the switch.
- Test release build (switch and "TEST BUILD" label shown):
  - iOS: `EXPO_PUBLIC_PRO_TESTING=1 npx expo run:ios --configuration Release`
  - Android: `EXPO_PUBLIC_PRO_TESTING=1 npx expo run:android --variant release`
- Normal release build (switch hidden, stored override ignored):
  - iOS: `npx expo run:ios --configuration Release`
  - Android: `npx expo run:android --variant release`
- Pass the flag on the command line. Do not put `EXPO_PUBLIC_PRO_TESTING=1` in `.env`: Expo CLI loads that file for every build, a production one included. `eas.json` sets no `env`, so an EAS build is a normal build unless the variable is added to a profile.
- Check before shipping: Settings shows no "TEST BUILD" label.
- The purchase stub still follows `__DEV__`: in a test release build "Buy" answers "coming soon", and Pro is turned on with the switch.

## Offers

Shown to free users only; never in the demo, never on a read-only profile, never at launch.

- **One-time paywall.** `useStatementImporter` counts imports that stored at least one row (`app_meta` `pro_offer_imports`). When an import summary is closed (`ImportSummaryHost`) and `shouldOfferPro` is true (at least one such import, `PRO_OFFER_AFTER_IMPORTS`, and not shown before), `pro_offer_shown` is written and the paywall opens with `feature: 'offer'`. Both keys are app-wide and survive "Reset". In a development build, turning the "Pro (developer)" switch off clears `pro_offer_shown`, so the offer can be tested again.
- **For You item.** `PRO_OFFER` in `getInboxItems` (`options.offerPro`), last in the list and quiet (a dot, not a count), once the profile has transactions. Dismissing it stores `pro-offer` in the `inbox_dismissed:<profileId>` map and it does not come back for that profile.

## Not done

- Real payments, prices from the store, trial handling, restoring a purchase.
- The legal texts, the FAQ and the website do not mention Pro yet.
