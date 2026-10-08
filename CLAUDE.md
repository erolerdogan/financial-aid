@AGENTS.md
# Financial Aid

React Native / Expo SDK 57, TypeScript, Expo Router, expo-sqlite. Local-first personal finance app. Features: `README.md`. Open work: `ROADMAP.md`. Feature internals: `docs/` (see Feature docs; read the matching file before changing a feature).

## Commands
- `npm run ios` / `npm run android`: development build (compiles native code). `npx expo start`: dev server only.
- `npx tsc --noEmit`: type check (also in CI). Run it after every step.
- `npm test`: every `src/**/*.test.ts` with tsx (`scripts/run-tests.js`). `npm test -- freedom` runs the files whose path contains that word; one file: `npx tsx src/utils/freedom.test.ts`.
- `npm run lint`: ESLint.
- `npm run site`: builds the website into `site-dist/`.
- `npm run pdfhost`: rebuilds `assets/pdf/pdfhost.html` (pdf.js inlined, for PDF statement import) after changing the `pdfjs-dist` version or the page script.
- `npm run licenses`: rebuilds `src/constants/licenses.ts` (Personal Data & Privacy → Open-Source Licenses) after adding, removing or upgrading a dependency.
- `npm run icons`: regenerates the app icon PNGs and SVG sources from `scripts/build-icons.js` (macOS, needs Google Chrome); then rebuild natively.
- `npx expo customize tsconfig.json`: after adding a route file, regenerates `.expo/types/router.d.ts` so `tsc` knows the new path.

## Hard rules
- IMPORTANT: Local-first. All data lives in SQLite via `src/db/database.ts`. No network calls with user data, no analytics; notifications are local only.
- IMPORTANT: Multi-profile. Every query is scoped by `profileId` (see ProfileContext).
- IMPORTANT: Schema changes go only in `initDatabase`, as `CREATE TABLE IF NOT EXISTS` plus a try/catch `ALTER TABLE`. Never run `execAsync` DDL from screens (causes "database is locked").
- IMPORTANT: No user-facing string literals in components: text via `t()`, numbers and dates via `format`, both from `useI18n()` (never `tNow` in a component). A new key goes into `en.ts` and all eight other locale files.
- IMPORTANT: Built-in category names stay English in the database (classifier, rules, budgets and backups depend on them); translate on display with `categoryName()`.
- IMPORTANT: An import change must not alter the dedup key of rows already stored (unique index `date, amount, rawDescription, profileId`); use `previousKeys` when a bank format reads a row differently.
- IMPORTANT: After editing `CATEGORY_KEYWORDS`, bump `CLASSIFIER_VERSION`. Category rules reclassify only rows with `userOverridden = 0`.
- Amount sign: expenses are negative, income positive.
- Period queries take a "period key": `YYYY-MM` or a range key from `makeRangeKey(from, to)`.
- Text built outside React is returned as a `Message` (`{ key, params }`), not a string.
- Theme via `useTheme()`; never hardcode light / dark colors (tokens `surface`, `track`, `field`, `raised` instead of `isDark ? grey : grey`). Haptics via `expo-haptics`. Money with the profile currency symbol.
- Pure modules with `tsx` tests (`src/utils/*`, `src/constants/*`) must not import `src/db/database.ts`: it pulls in `expo-sqlite`. DB loaders go in `src/services/`.
- Does not resolve under this tsconfig: importing Reanimated directly (use RN `Animated` / `PanResponder`) and `@noble/hashes` v2 (stay on v1).
- Any area with its own horizontal gesture must block the tab swipe (`useBlockTabSwipe()` or `TabSwipeBlocker`).
- Projections are labelled "est." with "Projection, not guaranteed. Not financial advice."; Budget Health with "Guidance, not financial advice."
- IMPORTANT: Real bank statements for tests live in `scripts/fixtures/private/` (gitignored). Never copy their content, or JSON made from them, into a committed file or a test fixture; tests use made-up data. A PDF statement whose totals do not match is never imported.
- Bank export guide steps come from the bank's help page (`sourceUrl`); never write them from memory.
- Strict TypeScript. Follow Apple HIG. Don't modify unrelated files.
- Start with a short plan; end with a summary of changed files and whether a native rebuild is needed.

## Map
- Source in `src/` (`@/` alias → `src/`). Routes in `src/app`, tabs in `src/app/(tabs)`.
- Schema and all queries: `src/db/database.ts` (debt math and payment linking at the bottom). Demo seed: `src/db/demoSeeder.ts`.
- Import: `src/hooks/useStatementImporter.ts` (picker and share sheet) → `src/services/importService.ts` → `src/utils/parser.ts`. Bank layouts: `src/utils/bankFormats.ts`. PDF statements: `src/services/pdfText.ts` + `src/components/PdfTextHost.tsx` (text, hidden WebView) → `src/utils/pdfStatements/` (parsers, totals check, chain check).
- Currency, demo mode, active profile: `src/contexts/ProfileContext.tsx`. Switching currency rewrites stored transaction, debt and household amounts with hardcoded `DEFAULT_EXCHANGE_RATES` (not `freedom_plans`).
- Picked period: `PeriodContext`. Theme and Home chart type: `ThemeContext`. Language: `LanguageContext`, `src/i18n/`.
- `app_meta`: key/value table (theme, language, last backup date, dismissals, intro flags). It survives "Reset" and is replaced by a restore.
- Passcode lock: `src/contexts/PasscodeContext.tsx`, `src/components/passcode/`, pure logic `src/utils/passcode.ts`. Its hash is in a file (`src/services/passcodeStore.ts`), on purpose not in the database, so it stays out of backups; see `docs/navigation.md`.
- Debt UI helpers: `src/utils/debt.ts`. Reminders and notifications: `src/utils/notifications.ts`.
- Legal: privacy policy, terms of use and disclaimer are in `src/content/legal/` (nine files plus `LEGAL_DOCUMENTS`), shown in the app by `src/app/legal.tsx` (Settings → About → Personal Data & Privacy, Welcome) and published by the website from the same text; `src/app/data-privacy.tsx` is the short version of the privacy policy. Licenses screen: `src/app/licenses.tsx`.
- FAQ: questions and answers are in `src/content/faq/` (nine files plus `FAQ_GROUPS`), shown in the app by `src/app/faq.tsx` (Settings → About) and published by the website from the same text. Answers follow `README.md` and `docs/`; update them when a feature they describe changes.
- Website: entry `scripts/build-site.ts`, page builders `scripts/site/pages/`, web-only copy `src/content/site/` (nine files, like the locales; legal texts in `src/content/legal/`, FAQ in `src/content/faq/`), images `site/`.
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
| `docs/navigation.md` | Routes, headers, passcode lock, tab swipe, picked period, drill-down, Home chart, Trends, Transactions, For You inbox, themes |
| `docs/i18n.md` | Languages, keys and plurals, `format`, category names, `Message`, what stays English |
| `docs/website.md` | Website pages, copy files, changelog, images, build settings, deployment |

## Definition of done
- `npx tsc --noEmit` passes and `npm test` passes; a change to a pure util comes with a check in its `*.test.ts`.
- New text exists in all nine locale files; no hardcoded colors, strings, month names or `toLocaleString('en-US')`.
- Queries are scoped by `profileId`; schema changes are in `initDatabase` only.
- Docs follow the code: the matching `docs/*.md` for behaviour and gotchas, `README.md` for the feature list (keep it updated), `ROADMAP.md` when an item is finished, this file only for rules and the map.
- The final message lists the changed files and says whether a native rebuild is needed. It is needed after adding or upgrading a native module or changing `app.json` plugins (today: the `expo-sharing` share target, `expo-crypto`, `expo-print`, `react-native-webview`).
