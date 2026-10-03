@AGENTS.md
# Financial Aid: React Native / Expo (SDK 57), TypeScript, Expo Router, expo-sqlite

## Conventions
- Source lives in `src/` (`@/` alias → `src/`). Routes in `src/app`, tabs in `src/app/(tabs)`.
- Local-first. All data in SQLite via `src/db/database.ts`. No cloud calls with user data.
- Multi-profile: every query is scoped by `profileId` (see ProfileContext).
- Theme via `useTheme()`; never hardcode light/dark colors. Haptics via `expo-haptics`.
- Strict TypeScript. Follow Apple HIG. No explanations in answers, just do the change.
- Never run `execAsync` DDL from screens (causes "database is locked"). Schema lives in `initDatabase`.
- Period queries take a "period key": `YYYY-MM` or a range key from `makeRangeKey(from, to)`.

## Features built
Dashboard, Transactions (search, date range, category chips), Trends (year / monthly / daily range),
Categories screen, Debts tab (installment loans, auto-linked payments, interest estimates).

## Next
- Make category lists dynamic (Trends pills, EditCategoryModal, Goals) from the `categories` table.
- Debts: demo seed data, credit cards, payoff simulator, due-date reminders.
- Live exchange rates (optional network call only; no user data sent).