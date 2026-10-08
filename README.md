# Financial Aid

A local-first personal finance app for iOS and Android. Import your bank statements as CSV or Excel files and the app categorises your transactions, tracks budgets and debts, and shows where your money goes. All data stays in a SQLite database on the device; nothing is sent to a server.

Built with React Native, Expo SDK 57, TypeScript, Expo Router and expo-sqlite.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Run the app in a development build

   ```bash
   npm run ios      # or: npm run android
   ```

3. Or start the dev server on its own

   ```bash
   npx expo start
   ```

Other commands:

```bash
npm run lint       # ESLint
npx tsc --noEmit   # type check (also run in CI)
npm test           # every src/**/*.test.ts with tsx; "npm test -- freedom" runs matching files
```

On first launch the welcome screen offers two paths: import a statement, or open the demo workspace to explore the app with sample data.

### Website

The bank export guides are also published as a small static website (one page per bank per language, for search traffic). The pages are generated from the same data and translations as the in-app guides:

```bash
npm run site       # writes site-dist/
```

`.github/workflows/site.yml` deploys it to GitHub Pages on pushes to `main` (enable Pages with "GitHub Actions" as the source). Set `SITE_URL` and `APP_URL` when building for another address or once there are store links. To add a bank, add its export layout to `src/utils/bankFormats.ts`, then a guide to `src/content/bankGuides.ts` with the steps from the bank's own help page.

## Features

### Statement import

- Imports CSV (`.csv`), tab or semicolon separated text (`.txt`, `.tsv`) and Excel (`.xlsx`, `.xls`) bank statements.
- Imports ABN AMRO PDF statements, read on the device (nothing is uploaded). Pick one or a whole year at once. Each statement is checked against its own printed totals and balances, and a statement that does not add up is not imported. The summary lists missing or doubled statements and files that could not be read, and rows already imported from a CSV are skipped as possible duplicates.
- Other files are refused with a hint to use the bank's CSV or Excel export: PDFs that are scans or from another bank, photos and screenshots, bank formats such as CAMT XML, MT940 and OFX, and other documents. The file's contents are checked as well as its name, so a renamed file is still recognised.
- Detects the date, amount, counterparty name and memo columns automatically, including layouts with a debit/credit indicator (ING "Af Bij") or separate debit and credit columns.
- Parses amounts in different locale formats and flags dates that could be read two ways.
- Import from the share sheet: export the statement in your bank app, choose Share and pick Financial Aid. The file is imported into the active profile, the same way as a picked file.
- Recognises the export layouts of ING, ABN AMRO, Rabobank, bunq, Revolut, Wise and N26 from the header row and reads each with its own column map: pending, reverted and cancelled rows are left out, fees are included in the amount, and day-first dates are not flagged. The summary sheet names the recognised bank. Files from other banks are read by guessing the columns from their headers.
- Reads text files in UTF-8, UTF-16 or Windows-1252.
- Export guides: "How do I get my statement?" on the welcome screen, the empty Home screen and in Settings opens a short, numbered guide per bank (ING, Rabobank, ABN AMRO, bunq, Revolut, N26, Wise, plus general steps for any other bank) showing where the bank keeps its CSV or Excel download. The bank's menu names are shown as the bank spells them. The "File Not Supported" and "No Transactions Found" alerts link to the same guides.
- Skips duplicates, so importing overlapping statements is safe.
- Shows a summary sheet after each import: transactions added, date range covered, income and spending totals, duplicates skipped, dates that need checking and debt payments linked.
- Builds a readable merchant name per transaction: prefers the counterparty name, strips payment processor prefixes, card and terminal codes, reference numbers, IBANs and dates, and shows well-known shops under one name (for example "Albert Heijn" for every store). A row with nothing readable gets its payment type as title instead of a code.
- Tags every imported row with the active profile.

### Automatic categorisation

- Each transaction is categorised on import in this order: your own rules, what you chose before for the same merchant or IBAN, built-in keywords in the merchant name, then built-in keywords in the rest of the bank text. If nothing matches, money coming in becomes "Income" and spending becomes "Uncategorised".
- Learns from your corrections: once you have categorised a merchant (or its IBAN) by hand at least twice and mostly the same way, new transactions of that merchant follow it.
- The merchant name counts for more than the memo: generic words such as "market", "shop" or "transfer" only decide the category when they are part of the name.
- Money coming in is never filed under a spending category by the built-in keywords; it is "Income", or "Financial Transfers" for savings and investment accounts.
- Your own rules match whole words (or the start of a word for keywords of 5 or more characters); when several match, the longest wins.
- Review screen: the Transactions tab shows how many transactions are uncategorised at the top of the list. The review list groups them per merchant, largest first; picking a category once applies it to all of that merchant's transactions and to future imports.
- The review list suggests a category where it can (your earlier choices, a similar merchant, a word in the bank text, or a monthly direct debit) and shows why; one tap accepts it.
- Reads the counterparty IBAN and payment type (direct debit, card, online, transfer) from the bank's columns or from the description text. A merchant is recognised by its IBAN when it has one of its own (not for card payments, iDEAL or payment processors).
- The built-in keywords are tuned for Dutch banks and merchants, with some English and Turkish terms. The most specific (longest) keyword wins, and short names such as NS or AH only match as whole words.
- When the built-in keywords change in an update, existing transactions you have not categorised by hand are re-categorised once on launch.
- Changing a transaction's category by hand is remembered and is not overwritten by later rule changes.
- Change a single transaction's category from its detail sheet (tap the category pill), from Home, Transactions or Trends.

### Home

- Total income, total expenses and net cash flow for the selected period.
- Spending allocation chart by category, with budget progress per category when a single month is selected. The chart is a donut by default; the chart icon in the card header steps through bars, one stacked bar and a treemap, where tapping a bar or tile expands that category. The choice is remembered.
- Tapping income or expenses opens a bottom sheet with those transactions (fixed vs. flexible split, search, fixed/flexible and category filters).
- Tapping a category in the allocation card expands its transactions inline; tapping one opens its detail.
- Debts summary card.
- Month stepper, plus custom date ranges with presets (last 7 days, last 30 days, year to date).
- Statement coverage indicator for the selected month:
  - **Statement Pending**: no data yet.
  - **In Progress**: the current month, partway through.
  - **Partial Statement**: a past month with incomplete date coverage.
  - **Full Statement**: the whole month is covered.
- Profile switcher, "For You" bell and settings in the header of every tab.

### For You (bell)

- One list of things found in your statements that you can act on, opened from the bell in any tab header.
- Budget Health alerts (tap to open the Health segment, dismiss for "Got it"), possible debts (one row: a single one opens the debt form prefilled, several open the Debts tab), uncategorised transactions (opens Review), possible payments for an existing debt, past months with a partial statement (import), and a backup reminder after 30 days.
- The bell shows a count for items that need a decision and a dot when only a reminder is left.
- Every item can be dismissed; it comes back only when there is something new (a later import, a new month, 30 days for backups).

### Transactions

- Live search by merchant, description or category; results update while typing.
- Filter by date range and by category chips.
- The month or range you pick is shared with Home.
- Detail view with the raw bank description and the fixed/flexible classification.

### Fixed vs. flexible costs

- Splits spending into fixed bills and flexible spending, with totals and percentages.
- Detects fixed costs from how a merchant behaves: regular cadence (weekly, monthly, quarterly, yearly), stable amounts, a consistent day of the month, direct debit payments, its category and known bill keywords. Monthly groceries stay flexible; rent and utilities are fixed from the first import.
- Payments linked to a debt always count as fixed.
- The transaction detail view shows the detected result and why (for example "Detected automatically · Monthly, same amount").
- Mark any merchant as Fixed or Flexible from the transaction detail view; "Reset to automatic" returns it to detection. The choice applies to all of that merchant's transactions.

### Trends

- Line chart of spending over a year, a range of months, or day by day.
- In the year view a dashed grey line shows the same months of the previous year when there is data for it; selecting a month shows how much more or less was spent than in the same month a year earlier.
- View all expenses or a single category.
- Shows the category's budget goal as a reference line and highlights points over the limit.
- Set or change a category's monthly goal directly from the chart.
- Average, highest and lowest month for the period.
- Shows which months of the year have statement data.
- Drill down into the transactions behind any point.

### Categories

- Built-in categories plus your own, each with a colour.
- Create, rename, recolour and delete categories.
- Deleting a category can move its transactions into another one.
- Add keyword rules to a category; existing transactions are reclassified to match.

### Budgets

- Set a monthly spending limit per category (Home → Budgets, or Settings).
- Progress bars show spent versus limit, on the Budgets screen and on Home.

### Debts

- Track loans, mortgages, student loans and personal loans.
- Record the original amount, interest rate, monthly payment, term (in months or years), payment day and start date.
- With the amount, monthly payment and term filled in, the form estimates the interest rate and offers it under the rate field.
- Payments are linked automatically from imported transactions by keyword, and can also be added by hand.
- Keyword matching ignores case, accents, punctuation and spaces, and runs after every import.
- Only whole-word matches with an amount close to the monthly payment are linked automatically; near-misses are listed as possible matches to add by hand.
- The debt form previews the statement payments each keyword matches before saving; unwanted ones can be unlinked there or from the payment history.
- Swipe a debt left on the Debts tab for Edit and Delete.
- Payment history shows the merchant and the keyword that linked each payment.
- Removing a keyword removes the payments it linked; deleted transactions drop out of the history.
- Each payment is split into principal and interest.
- Shows the remaining balance, progress, interest paid so far, estimated future interest and estimated debt-free month.
- Suggests debts from your statements: a steady monthly payment to a lender (mortgage, student loan, credit) that no debt covers yet appears as a card on the Debts tab. Add opens the form with name, type and keyword prefilled; monthly payment, payment day and start date follow from the matching payments. Dismissed suggestions stay hidden.

### Future Growth Calculator

- Plan tab, Future Growth segment: see how a starting amount and a monthly contribution could grow over time.
- Three questions up front: monthly amount, years (1 to 60) and starting amount. "More options" (collapsed) holds your own yearly return (up to 30%), yearly increase, fee and inflation.
- One answer: the final balance with a line saying how much you pay in and how much growth adds, updating as you type, in the profile currency.
- Growth chart: one stacked bar per year showing the balance split into contributions and profit; the last bar is the final balance.
- Outlook: Cautious / Expected / Optimistic set the yearly return to 5% / 7% / 9%, with the final balance of all three side by side. Typing your own return under "More options" deselects the outlook.
- Details (collapsed): a Future prices / Today's prices switch (today's prices shows the final balance, chart, outlooks and table after inflation), what the fee costs (final balance at 0% fee vs your fee, and the difference) and the yearly breakdown table (year, start, contributions, profit, end).
- Goal (opt-in, an "Add a goal" row until one is set): a target balance or a target passive income per month (converted with the 4% rule, an assumption: income × 12 ÷ 0.04). Shows an on-track / behind status with a progress bar, the years needed at your current monthly amount and the monthly amount needed for your timeframe. Follows the prices switch.
- The plan is saved per profile on the device and restored on the next launch.
- Introduction: the first visit shows a short page explaining the calculator with a worked example; "How it works" at the top reopens it.
- Home card: once a plan is saved, Home shows the estimated balance at the plan's end year and, if a goal is set, the progress towards it. Tapping it opens the Future Growth segment.
- Projection, not guaranteed. Not financial advice.

### Budget Health

- A health score from 0 to 100 that answers "is our money in good shape, and what is the one thing to fix?". It combines five pillars: savings rate (30%), housing (20%), fixed costs (15%), debt payments without the mortgage (20%) and a safety buffer (15%). Each pillar is compared with a common rule of thumb; a buffer you have not entered is left out and the other pillars share its weight.
- Net monthly income is the average of the last three complete months of income in your statements, or the figure you type yourself.
- Where it lives: the Plan tab opens on its Health segment (Health | Debts | Future Growth). Home is unchanged. Until there is a month with income the segment shows "Import at least one month to see your health score", or asks for your income.
- The Health segment shows the score ring, how the score moved since the previous month, the single change that would add the most points, the five pillars, and every category against a typical range (as a share of net income) with your own average of the previous three months marked. Green is within the range, yellow up to 20% above, red beyond that; for savings it is the other way round. It follows the month picked on Home.
- Introduction: the first visit shows a short page explaining the score with a worked example; "How it works" at the top reopens it.
- Options (the ⋯ button at the top of the segment): household profile, a switch per alert type, and a reset for the category ranges you accepted.
- Typical ranges adapt to your household (adults, children, rent or own), asked once in a short sheet. Hold a category to accept its current level ("This is fine for us"), reset it, or compare it with a different group. Custom categories are compared once you pick a group for them.
- Alerts after each import, at most three, shown at the top of the Health segment with "Got it" and "Don't alert me about this", and as rows under the For You bell: a debt payment that did not come through, a new recurring charge, a price increase, a category ahead of its usual pace, an unusually large purchase, a drop in the savings rate, and good news when a category comes in clearly below your normal. Missed debt payments and new recurring charges are on by default; the others are switched on from the ⋯ button at the top of the Health segment. Alerts that are on also arrive as a local notification when notifications are allowed.
- Monthly report: score and change, income, expenses, saved and savings rate, pillars, the category table, fixed vs. flexible, debts with the estimated debt-free month, and the month's alerts. "Export PDF" creates the file on the device and opens the share sheet.
- Score history: a line chart of the last 12 months.
- Guidance, not financial advice. Nothing leaves the device.

### Swipe between tabs

- Swipe left or right anywhere on a screen to move to the next or previous tab: Home, Transactions, Trends, Plan. On the Plan tab the swipe steps through Health, Debts and Future Growth first.
- Areas with their own horizontal gesture keep it: the Trends chart, the category filter rows and the debt cards.

### Profiles

- Keep separate ledgers in one app (for example Personal, Business, Household).
- All transactions, rules, goals, categories and debts belong to a profile.
- Each profile has its own name, avatar colour and currency.

### Settings

- Currency: EUR, USD, GBP, JPY, CHF, CAD or AUD. Switching currency converts existing amounts using fixed built-in rates.
- Language: English, Dutch, German, Turkish, Spanish, French, Italian, Portuguese and Russian. The app follows the device language until you pick one in Settings → Language; the choice is remembered. Built-in category names, numbers, dates and reminder notifications follow the language. Translations have not been reviewed by native speakers yet.
- Six colour themes (Aurora, Midnight Gold, Sunset, Forest Mint, Orchid, Classic; Classic is the default) with gradient accents, each in light and dark; the choice is remembered. Dark mode follows the system until you toggle it.
- Import reminders: local notifications on the 15th and 28th of each month. Importing a statement cancels the pending reminders.
- Reset all data and profiles.

### Demo workspace

- A separate demo profile with three months of sample transactions and two sample debts.

### Backup and restore

- Settings → Backup & Restore saves one file with all profiles (transactions, categories, rules, goals, debts). You choose where it goes (Files, iCloud Drive, AirDrop); the app does not upload it.
- A backup can be protected with a password (at least 8 characters): the file (`.fabackup`) is then encrypted with AES-256-GCM, the key derived from the password with scrypt. A forgotten password cannot be recovered. Without a password the backup is a plain, unencrypted `.db` file.
- Restore replaces all data on the device with the backup; nothing is merged. Before anything changes, the app shows what is in the backup, what is on the device, and whether the device has newer transactions that would be removed.
- The data replaced by a restore is kept as a safety copy; "Undo Last Restore" brings it back.
- Backups from older app versions are upgraded on restore. Files that are damaged, not a backup, or from a newer app version are refused and nothing is changed.
- Export Transactions (same sheet) saves all transactions of the active profile as a CSV or Excel file (date, merchant, category, amount, bank text). It is a readable file, not a backup, and is never encrypted.

## Privacy

The app makes no network calls with user data. Statements are read on the device, and everything is stored in a local SQLite database.

## Tech stack

| Area | Library |
| --- | --- |
| Framework | React Native 0.86, Expo SDK 57 |
| Language | TypeScript (strict) |
| Navigation | Expo Router |
| Database | expo-sqlite (WAL mode) |
| Charts | react-native-gifted-charts, react-native-svg |
| File import | expo-document-picker, expo-sharing (share sheet), expo-file-system, papaparse, xlsx |
| PDF statements | pdfjs-dist (bundled, runs offline in a hidden react-native-webview) |
| Notifications | expo-notifications |
| PDF report | expo-print, expo-sharing |
| Languages | expo-localization, own dictionary in `src/i18n` |
| State | React Context (`ProfileContext`, `ThemeContext`, `LanguageContext`) |

## Project structure

```
src/
  app/            Routes (Expo Router)
    (tabs)/       Home, Transactions, Trends, Plan (Health | Debts | Future Growth)
    welcome.tsx   First-launch screen
    settings.tsx  Settings (modal)
    goals.tsx     Budgets (modal)
    categories.tsx  Categories (modal)
    health-report.tsx  Monthly health report (modal)
  components/     Shared components, dashboard cards and modals
  contexts/       Profile, period, theme and language contexts
  db/             Schema, queries and demo seed data
  services/       Statement import
  hooks/          Shared hooks
  i18n/           Translations (`locales/*.ts`), number and date formatting
  utils/          Parsing, notifications and debt helpers
docs/             How each feature works inside (import, classifier, debts, freedom, health, backup, navigation, i18n)
scripts/          Website build, test runner
```

## Documentation

- `docs/`: how each feature works and what to watch out for when changing it.
- `CLAUDE.md` / `AGENTS.md`: rules and a map of the code for coding agents.
- `ROADMAP.md`: what is planned.

## Roadmap

See [ROADMAP.md](ROADMAP.md).
