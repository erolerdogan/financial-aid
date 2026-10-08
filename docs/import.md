# Statement import

Path: `src/hooks/useStatementImporter.ts` (picker and share sheet) → `src/services/importService.ts` → `src/utils/parser.ts`.

Categorisation of the imported rows is in [classifier.md](classifier.md). Debt payment linking after import is in [debts.md](debts.md), health alerts after import in [health.md](health.md).

## Flow

- Custom rules and learned categories are passed to the parser at import (`useStatementImporter` → `parseFileToTransactions`).
- `parseCSVContent` / `parseExcelContent` return `{ transactions, bank }`. The bank ends up on `ImportResultSummary.bank` and as a "Recognised as" row in `ImportSummaryModal` (`BANK_LABELS`, not translated).
- After the rows are stored, `runImport` calls `cancelCurrentMonthReminders()`, then `runHealthAlerts(db, profileId)`, then `refreshProfiles()` (so Home reloads with the alerts stored). `syncDebtPayments` also runs after import.
- `ImportSummaryHost` is mounted in the tabs layout and in Settings.
- Import reminders: `src/utils/notifications.ts`.

## Dedup

- Import dedup relies on the unique index `(date, amount, rawDescription, profileId)`.
- `rawDescription` is name + memo cells joined. `legacyRawDescription` (the single cell older versions stored) is only used by `processBatchImport` for dedup and is not stored.
- A bank format must not change the dedup key of rows already stored. Where its amount, date or text differs from what the generic header guess produced, the row carries `previousKeys` (date, amount, text as the generic guess read them) and `processBatchImport` treats a stored match as a duplicate.
- ING, Rabobank, bunq, ABN AMRO and N26 read the same text as before (the tests assert no `previousKeys`).

## Unsupported files

- `parseFileToTransactions` reads the first 8 bytes and calls `describeUnsupportedStatement(fileName, head)` in `src/utils/statementFormat.ts`: magic bytes first, then extension (PDF, images, bank formats like XML / MT940 / OFX, other documents).
- A message throws `UnsupportedFileError`, which `useStatementImporter` shows as "File Not Supported".
- The messages in `statementFormat.ts` stay English (the tests match on them); `UNSUPPORTED_MESSAGE_KEYS` maps each to its translation key for the alert.
- Unknown plain-text files still go to `parseCSVContent`; `isSpreadsheetFile` picks the Excel route. The picker keeps `*/*`.
- Text statements are read as bytes and decoded by `decodeStatementText` in `src/utils/statementFormat.ts`: UTF-8 with or without BOM, UTF-16 with BOM, otherwise Windows-1252.
- Tests: `npx tsx src/utils/statementFormat.test.ts`.

## Column detection

- `parseMatrixData` tries, in order: `detectBankFormat` on the first 20 rows, the generic `detectColumns`, `detectHeaderlessBank` (ABN AMRO TXT), then fixed positions.
- It detects name, memo (several), sign (`Af Bij`) and split debit/credit columns.

## Bank formats

- `src/utils/bankFormats.ts`, `BANK_FORMATS`: ING, ABN AMRO, Rabobank, bunq, Revolut, Wise statement and transfer history, N26 current and older layout. The layouts are taken from the banks' documented exports, not checked against live files.
- `detectBankFormat` matches a `signature` of headers that must all be present, then exact header aliases per column.
- A bank's `ColumnMap` can carry rules:
  - `status` / `keepStatus`: Revolut and Wise rows that are not `COMPLETED` are skipped.
  - `fee`: taken off the amount.
  - `direction` + `amountIn`: Wise history; `NEUTRAL` rows are skipped.
  - `nameOut` / `nameIn` / `nameFromMemo`: Wise.
  - `dayFirst`: no ambiguous-date flag.
- Tests: `npx tsx src/utils/bankFormats.test.ts`.

## Bank details and merchant names

- `transactions.counterpartyIban` is only stored when it identifies the merchant (see `extractBankDetails` in `src/utils/parser.ts`).
- `txType` is `DIRECT_DEBIT | CARD | ONLINE | TRANSFER`; direct debit adds to the fixed-cost score.
- Merchant titles come from `deriveMerchant` in `src/utils/merchantName.ts`: name column → tagged name in the bank text → memo → whole text. Codes are stripped, `MERCHANT_ALIASES` gives canonical brand names, and the fallback is a payment-type label, never a code.
- Stored merchants are not backfilled.

## Share sheet import

- The `expo-sharing` config plugin in `app.json` makes the app a share target: iOS share extension + app group, one file; Android `ACTION_SEND` for the CSV / Excel MIME types listed there. Changing it needs a new native build.
- `src/app/+native-intent.ts` sends the `expo-sharing` link to Home.
- `SharedImportHost` (`src/components/SharedImportHost.tsx`, next to the root `Stack`) reads `useIncomingShare`, clears the payload, dismisses modal routes and calls `importSharedFile` from `useStatementImporter` (same `runImport` path as the picker, active profile).
- Its progress overlay is a `View`, not a `Modal`, so the summary sheet and alerts can present.

## Bank export guides

- `BANK_GUIDES` in `src/content/bankGuides.ts`: one per `BankId`, so only banks the parser recognises.
- Steps are taken from the bank's help page in `sourceUrl`; `verified` is the month they were checked. Never write steps from memory.
- A step is a shared sentence key (`guide.step.*`) plus `labels`: placeholder → entry in the guide's `labels`, the bank's own menu names per language. Lookup order: reader's language → English → the bank's language; a note says so when it is not the reader's.
- `stepParts` returns the sentence in pieces so the names render bold.
- Screen: `src/app/export-guide.tsx` (modal route; list with search → steps → import button; the optional `bank` param is a slug). Opened from Welcome, the empty Home card, Settings and the "File Not Supported" / "No Transactions Found" alerts (`wrongFileButtons` in `useStatementImporter`).
- Tests: `npx tsx src/content/bankGuides.test.ts`.

## Website

- The same guide data becomes a static site with `npx tsx scripts/build-site.ts` (`npm run site`), written to `site-dist/`: a page per bank per language with `hreflang` and `HowTo` JSON-LD.
- `site.*` translation keys are web only.
- Deployed by `.github/workflows/site.yml`.

## Demo workspace

- Demo seed: `src/db/demoSeeder.ts`. Demo mode lives in `src/contexts/ProfileContext.tsx`.
- Nothing is imported into the demo workspace, so it gets no health alerts and no backup reminder.
