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
```

On first launch the welcome screen offers two paths: import a statement, or open the demo workspace to explore the app with sample data.

## Features

### Statement import

- Imports CSV (`.csv`) and Excel (`.xlsx`, `.xls`) bank statements.
- Detects the date, amount and description columns automatically.
- Parses amounts in different locale formats and flags dates that could be read two ways.
- Skips duplicates, so importing overlapping statements is safe.
- Cleans up merchant names by removing payment processor prefixes, IBANs and dates.
- Tags every imported row with the active profile.

### Automatic categorisation

- Each transaction is categorised on import in three steps: your own keyword rules first, then built-in keyword matching, then a default category.
- The built-in keywords are tuned for Dutch banks and merchants.
- Changing a transaction's category by hand is remembered and is not overwritten by later rule changes.

### Dashboard

- Total income, total expenses and net cash flow for the selected period.
- Spending allocation donut chart by category; tap a category to see its transactions.
- Month stepper, plus custom date ranges with presets (last 7 days, last 30 days, year to date).
- Statement coverage indicator for the selected month:
  - **Statement Pending**: no data yet.
  - **In Progress**: the current month, partway through.
  - **Partial Statement**: a past month with incomplete date coverage.
  - **Full Statement**: the whole month is covered.
- Ranked lists of income, expenses, fixed costs and flexible costs.
- Profile switcher and settings in the header.

### Transactions

- Search by merchant, description or category.
- Filter by date range and by category chips.
- Detail view with the raw bank description and the fixed/flexible classification.

### Fixed vs. flexible costs

- Splits spending into fixed bills and flexible spending, with totals and percentages.
- Recognises common fixed costs (rent, utilities, subscriptions) by keyword.
- Mark any merchant as Fixed, Flexible or Auto from the transaction detail view. The choice applies to all of that merchant's transactions.

### Trends

- Line chart of spending over a year, a range of months, or day by day.
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

### Budget goals

- Set a monthly spending limit per category.
- Progress bars show spent versus limit.

### Debts

- Track loans, mortgages, student loans and personal loans.
- Record the original amount, interest rate, monthly payment, payment day and start date.
- Payments are linked automatically from imported transactions by keyword, and can also be added by hand.
- Each payment is split into principal and interest.
- Shows the remaining balance, progress, interest paid so far, estimated future interest and estimated debt-free month.

### Profiles

- Keep separate ledgers in one app (for example Personal, Business, Household).
- All transactions, rules, goals, categories and debts belong to a profile.
- Each profile has its own name, avatar colour and currency.

### Settings

- Currency: EUR, USD, GBP, JPY, CHF, CAD or AUD. Switching currency converts existing amounts using fixed built-in rates.
- Dark mode toggle; follows the system setting at launch.
- Import reminders: local notifications on the 15th and 28th of each month. Importing a statement cancels the pending reminders.
- Reset all data and profiles.

### Demo workspace

- A separate demo profile with three months of sample transactions and two sample debts.

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
| File import | expo-document-picker, expo-file-system, papaparse, xlsx |
| Notifications | expo-notifications |
| State | React Context (`ProfileContext`, `ThemeContext`) |

## Project structure

```
src/
  app/            Routes (Expo Router)
    (tabs)/       Dashboard, Transactions, Trends, Debts
    welcome.tsx   First-launch screen
    settings.tsx  Settings (modal)
    goals.tsx     Budget goals (modal)
    categories.tsx  Categories (modal)
  components/     Shared components, dashboard cards and modals
  contexts/       Profile and theme contexts
  db/             Schema, queries and demo seed data
  services/       Statement import
  hooks/          Shared hooks
  utils/          Parsing, notifications and debt helpers
```

## Roadmap

- Category lists driven by the `categories` table everywhere.
- Debts: credit cards, payoff simulator, due-date reminders.
- Recurring subscription detection (the detection logic exists but is not shown in the app yet).
- Live exchange rates, as an optional network call that sends no user data.
