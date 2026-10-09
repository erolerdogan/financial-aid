@AGENTS.md
# Financial Aid

React Native / Expo SDK 57, TypeScript, Expo Router, expo-sqlite. Local-first personal finance app. Features: `README.md`. Open work: `ROADMAP.md`. Feature internals: `docs/` (see Feature docs; read the matching file before changing a feature).

## Commands
- `npm run ios` / `npm run android`: development build (compiles native code). `npx expo start`: dev server only.
- `npx tsc --noEmit`: type check (also in CI). Run it after every step.
- `npm test`: every `src/**/*.test.ts` with tsx (`scripts/run-tests.js`). `npm test -- freedom` runs the files whose path contains that word; one file: `npx tsx src/utils/freedom.test.ts`.
- `npm run lint`: ESLint.
- `npm run perf`: times the database loaders of each screen against 20,000 made-up transactions (`scripts/perf-db.ts`; see `docs/navigation.md`, Performance). Run it after changing a query or an index.
- `npm run site`: builds the website into `site-dist/`.
- `npm run pdfhost`: rebuilds `assets/pdf/pdfhost.html` (pdf.js inlined, for PDF statement import) after changing the `pdfjs-dist` version or the page script.
- `npm run licenses`: rebuilds `src/constants/licenses.ts` (Personal Data & Privacy → Open-Source Licenses) after adding, removing or upgrading a dependency.
- `npm run currencies`: rebuilds `src/constants/currencies.ts` and `src/i18n/currencyNames.ts` from the currencies the exchange rate source offers (needs a connection).
- `npm run icons`: regenerates the app icon PNGs and SVG sources from `scripts/build-icons.js` (macOS, needs Google Chrome); then rebuild natively.
- `npx expo customize tsconfig.json`: after adding a route file, regenerates `.expo/types/router.d.ts` so `tsc` knows the new path.

## Hard rules
- IMPORTANT: Local-first. All data lives in SQLite via `src/db/database.ts`. No network calls with user data, no analytics; notifications are local only. The only `fetch` is the exchange rate request in `src/services/exchangeRates.ts`, which sends nothing about the user.
- IMPORTANT: Multi-profile. Every query is scoped by `profileId` (see ProfileContext).
- IMPORTANT: Schema changes go only in `initDatabase`, as `CREATE TABLE IF NOT EXISTS` plus a try/catch `ALTER TABLE`. Never run `execAsync` DDL from screens (causes "database is locked").
- IMPORTANT: No user-facing string literals in components: text via `t()`, numbers and dates via `format`, both from `useI18n()` (never `tNow` in a component). A new key goes into `en.ts` and all eight other locale files.
- IMPORTANT: Built-in category names stay English in the database (classifier, rules, budgets and backups depend on them); translate on display with `categoryName()`.
- IMPORTANT: An import change must not alter the dedup key of rows already stored (unique index `date, amount, rawDescription, profileId`); use `previousKeys` when a bank format reads a row differently.
- IMPORTANT: After editing `CATEGORY_KEYWORDS`, bump `CLASSIFIER_VERSION`. Category rules reclassify only rows with `userOverridden = 0`.
- Amount sign: expenses are negative, income positive.
- Period queries take a "period key": `YYYY-MM` or a range key from `makeRangeKey(from, to)`.
- Text built outside React is returned as a `Message` (`{ key, params }`), not a string.
- Theme via `useTheme()`; never hardcode light / dark colors (tokens `surface`, `track`, `field`, `raised` instead of `isDark ? grey : grey`). Haptics via `expo-haptics`. Money with the profile currency symbol; a screen that shows cents passes `currencyDecimals` from `useProfile()` to `format.money`, never a literal `2`.
- Pure modules with `tsx` tests (`src/utils/*`, `src/constants/*`) must not import `src/db/database.ts`: it pulls in `expo-sqlite`. DB loaders go in `src/services/`.
- Does not resolve under this tsconfig: importing Reanimated directly (use RN `Animated` / `PanResponder`) and `@noble/hashes` v2 (stay on v1).
- Any area with its own horizontal gesture must block the tab swipe (`useBlockTabSwipe()` or `TabSwipeBlocker`).
- Accessibility: every touchable has `accessibilityRole`, an icon-only one also an `accessibilityLabel`; a sheet's backdrop touchable and its `TouchableWithoutFeedback` have `accessible={false}` (see `docs/navigation.md`, Accessibility).
- Projections are labelled "est." with "Projection, not guaranteed. Not financial advice."; Budget Health with "Guidance, not financial advice."
- IMPORTANT: Real bank statements for tests live in `scripts/fixtures/private/` (gitignored). Never copy their content, or JSON made from them, into a committed file or a test fixture; tests use made-up data. A PDF statement whose totals do not match is never imported.
- Bank export guide steps come from the bank's help page (`sourceUrl`); never write them from memory.
- Strict TypeScript. Follow Apple HIG. Don't modify unrelated files.
- Start with a short plan; end with a summary of changed files and whether a native rebuild is needed.

## Subscription
- Tiers: Free and Pro. One entitlement "pro". Products later: monthly, yearly (7-day trial), lifetime.
- 100% local and private: no account, no login, no analytics.
- Never gate: backup/restore, export, delete, app lock, languages, data correctness (transfer detection, categorisation).
- Downgrade never deletes or hides data: items beyond free limits stay visible, read-only, with a "Renew to edit" note.
- IMPORTANT: All checks go through `useEntitlement()` and the `FEATURES` map (`src/constants/features.ts`). No scattered `isPro` checks. A new write path respects `useProfileAccess()` (read-only profile).
- No payment SDK yet. `src/services/purchases.ts` is the only file the store plugs into. The Pro testing switch (`pro_dev_override`) counts only when `PRO_TESTING_ENABLED` (`src/constants/buildConfig.ts`: `__DEV__` or `EXPO_PUBLIC_PRO_TESTING=1` at build time) is true.

## Map
- Source in `src/` (`@/` alias → `src/`). Routes in `src/app`, tabs in `src/app/(tabs)`.
- Schema and all queries: `src/db/database.ts` (debt math and payment linking at the bottom). Demo seed: `src/db/demoSeeder.ts`.
- Import: `src/hooks/useStatementImporter.ts` (picker and share sheet) → `src/services/importService.ts` → `src/utils/parser.ts`. Bank layouts: `src/utils/bankFormats.ts`. PDF statements: `src/services/pdfText.ts` + `src/components/PdfTextHost.tsx` (text, hidden WebView) → `src/utils/pdfStatements/` (parsers, totals check, chain check).
- Currency, demo mode, active profile: `src/contexts/ProfileContext.tsx`. Currency list (symbol, decimals): `src/constants/currencies.ts`, names: `src/i18n/currencyNames.ts`, both generated; picker: `src/components/CurrencyPickerSheet.tsx`. Rates: `src/services/exchangeRates.ts` (provider, cache in `app_meta`), pure part `src/utils/exchangeRates.ts`. Switching currency rewrites stored transaction, budget, debt and household amounts with the rate of the day (`switchProfileCurrency`; not `freedom_plans`); see `docs/navigation.md`, Currency.
- Picked period: `PeriodContext`. Theme and Home chart type: `ThemeContext`. Language: `LanguageContext`, `src/i18n/`.
- `app_meta`: key/value table (theme, language, last backup date, dismissals, intro flags). It survives "Reset" and is replaced by a restore.
- Passcode lock: `src/contexts/PasscodeContext.tsx`, `src/components/passcode/`, pure logic `src/utils/passcode.ts`. Its hash is in a file (`src/services/passcodeStore.ts`), on purpose not in the database, so it stays out of backups; see `docs/navigation.md`.
- Debt UI helpers: `src/utils/debt.ts`. Reminders and notifications: `src/utils/notifications.ts`.
- Legal: privacy policy, terms of use and disclaimer are in `src/content/legal/` (nine files plus `LEGAL_DOCUMENTS`), shown in the app by `src/app/legal.tsx` (Settings → About → Personal Data & Privacy, Welcome) and published by the website from the same text; `src/app/data-privacy.tsx` is the short version of the privacy policy. Licenses screen: `src/app/licenses.tsx`.
- FAQ: questions and answers are in `src/content/faq/` (nine files plus `FAQ_GROUPS`), shown in the app by `src/app/faq.tsx` (Settings → About) and published by the website from the same text. Answers follow `README.md` and `docs/`; update them when a feature they describe changes.
- Website: entry `scripts/build-site.ts`, page builders `scripts/site/pages/`, web-only copy `src/content/site/` (nine files, like the locales; legal texts in `src/content/legal/`, FAQ in `src/content/faq/`), images `site/`.
- Free / Pro: limits and flags `src/constants/features.ts`, pure rules `src/utils/entitlement.ts`, `src/contexts/EntitlementContext.tsx`, hooks `usePaywall` / `useProfileAccess` / `useBudgetGate` (`src/hooks/`), UI `src/components/pro/`, paywall `src/app/paywall.tsx` + `src/constants/paywall.ts`, purchase stub `src/services/purchases.ts`.
- Budget Health: engine `src/utils/budgetHealth.ts`, alerts `src/utils/healthAlerts.ts`, loaders `src/services/healthService.ts`, UI `src/components/health/`.

Naming traps:
- The "Plan" tab is the route `debts` (`src/app/(tabs)/debts.tsx`), with segments Health (Budget Health), Debts and Future Growth. "Debts tab" means its Debts segment.
- "Future Growth" in the UI is "Freedom" in code (`src/components/freedom/`, `freedom_plans`, `segment: 'freedom'`).
- Budgets is `src/app/goals.tsx`. Home is `src/app/(tabs)/index.tsx`. Transactions is `src/app/transactions.tsx`, a pushed screen, not a tab.
- Freedom keys keep old names: Outlook is `PESSIMISTIC | NEUTRAL | OPTIMISTIC`, the prices switch is `ValueMode` `NOMINAL | REAL`, Starting amount is `lumpSum`.
- Not wired up (exists, nothing calls it): `detectRecurringPatterns` / `getRecurringCandidates` in `database.ts`.

## Feature docs
| File | Covers |
| --- | --- |
| `docs/import.md` | Import flow, dedup, unsupported files, PDF statements, column detection, bank formats, merchant names, share sheet, export guides, website |
| `docs/classifier.md` | Categorisation precedence, custom rules, learned history, built-in keywords, review screen, fixed vs. flexible |
| `docs/debts.md` | Plan tab segments, payment linking, APR estimate, swipe rows, debt suggestions |
| `docs/freedom.md` | Future Growth: layout, inputs, scenarios, persistence, math, goal solvers, reference test vector |
| `docs/health.md` | Budget Health: benchmarks, tables, engine, pillars, alerts, UI, PDF report |
| `docs/backup.md` | Backup and restore, encrypted `.fabackup` format, transaction export |
| `docs/navigation.md` | Routes, headers, passcode lock, tab swipe, picked period, drill-down, Home chart, Trends, Transactions, For You inbox, themes, accessibility, performance |
| `docs/i18n.md` | Languages, keys and plurals, `format`, category names, `Message`, what stays English |
| `docs/subscription.md` | Free and Pro: limits and flags, read-only rules, every gated location, paywall, purchase stub, Pro offers |
| `docs/website.md` | Website pages, copy files, changelog, images, build settings, deployment |

## Definition of done
- `npx tsc --noEmit` passes and `npm test` passes; a change to a pure util comes with a check in its `*.test.ts`.
- New text exists in all nine locale files; no hardcoded colors, strings, month names or `toLocaleString('en-US')`.
- Queries are scoped by `profileId`; schema changes are in `initDatabase` only.
- Docs follow the code: the matching `docs/*.md` for behaviour and gotchas, `README.md` for the feature list (keep it updated), `ROADMAP.md` when an item is finished, this file only for rules and the map.
- The final message lists the changed files and says whether a native rebuild is needed. It is needed after adding or upgrading a native module or changing `app.json` plugins (today: the `expo-sharing` share target, `expo-crypto`, `expo-print`, `react-native-webview`).
