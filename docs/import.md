# Statement import

Path: `src/hooks/useStatementImporter.ts` (picker and share sheet) → `src/services/importService.ts` → `src/utils/parser.ts`.

Categorisation of the imported rows is in [classifier.md](classifier.md). Debt payment linking after import is in [debts.md](debts.md), health alerts after import in [health.md](health.md).

## Flow

- Custom rules and learned categories are passed to the parser at import (`useStatementImporter` → `readStatementFile`).
- `readStatementFile` returns `{ kind: 'table', parsed }` for CSV / Excel or `{ kind: 'pdf', statement }` for a PDF statement (see [PDF statements](#pdf-statements)).
- The picker allows several files. `runImport` reads them one after the other, then makes one `processBatchImport` call and shows one summary. With one file an error is an alert, as before; with several, a file that fails is left out and listed in the summary (`ImportResultSummary.failedFiles`, reasons from `src/utils/importFailure.ts`).
- While several files are read, `ImportProgressOverlay` shows "Reading statement 12 of 45" (`progress` in `ImportResultContext`). It is a `View`, rendered by `ImportSummaryHost` (tabs, Settings) and by Welcome and the export guide.
- `parseCSVContent` / `parseExcelContent` return `{ transactions, bank }`. The bank ends up on `ImportResultSummary.bank` and as a "Recognised as" row in `ImportSummaryModal` (`BANK_LABELS`, not translated).
- After the rows are stored, `runImport` calls `cancelCurrentMonthReminders()`, then `runHealthAlerts(db, profileId)`, then `refreshProfiles()` (so Home reloads with the alerts stored). `syncDebtPayments` also runs after import.
- `ImportSummaryHost` is mounted in the tabs layout and in Settings.
- Import reminders: `src/utils/notifications.ts`.

## Dedup

- Import dedup relies on the unique index `(date, amount, rawDescription, profileId)`.
- `rawDescription` is name + memo cells joined. `legacyRawDescription` (the single cell older versions stored) is only used by `processBatchImport` for dedup and is not stored.
- A bank format must not change the dedup key of rows already stored. Where its amount, date or text differs from what the generic header guess produced, the row carries `previousKeys` (date, amount, text as the generic guess read them) and `processBatchImport` treats a stored match as a duplicate.
- ING, Rabobank, bunq, ABN AMRO and N26 read the same text as before (the tests assert no `previousKeys`).
- PDF rows carry `crossKeys` (see [PDF statements](#pdf-statements)): a PDF row that misses the exact key is still skipped when a stored row has the same date and amount and the same counterparty IBAN, card terminal reference (`NR:…`) or card time stamp. These are counted apart, as `possibleDuplicateCount` ("N possible duplicates skipped").

## Unsupported files

- `readStatementFile` reads the first 8 bytes and calls `describeUnsupportedStatement(fileName, head)` in `src/utils/statementFormat.ts`: magic bytes first, then extension (images, bank formats like XML / MT940 / OFX, other documents).
- A file that starts with `%PDF` (`isPdfFile`) is not refused, whatever it is called; it goes to the PDF readers. A PDF is refused later with its own message when it has no text (scan or photo), is not a layout the app knows, cannot be opened (also: named `.pdf` without PDF content) or has a password.
- A message throws `UnsupportedFileError`, which `useStatementImporter` shows as "File Not Supported".
- The messages in `statementFormat.ts` stay English (the tests match on them); `UNSUPPORTED_MESSAGE_KEYS` maps each to its translation key for the alert.
- Unknown plain-text files still go to `parseCSVContent`; `isSpreadsheetFile` picks the Excel route. The picker keeps `*/*`.
- Text statements are read as bytes and decoded by `decodeStatementText` in `src/utils/statementFormat.ts`: UTF-8 with or without BOM, UTF-16 with BOM, otherwise Windows-1252.
- Tests: `npx tsx src/utils/statementFormat.test.ts`.

## PDF statements

On the device only: no file or text leaves the app.

- **Text extraction.** `extractPdfText(fileUri | base64)` in `src/services/pdfText.ts` returns `PdfPage[]` (`{ width, height, items: { str, x0, x1, top, bottom, fontName, fontSize }[] }`, top-left origin). pdf.js runs in the hidden WebView of `PdfTextHost` (`src/components/PdfTextHost.tsx`, mounted once in the root layout next to `SharedImportHost`, and only while a PDF is being read).
  - The page is `assets/pdf/pdfhost.html`, built by `npm run pdfhost` (`scripts/build-pdf-host.js`) with pdf.js and its worker inlined, and committed. Run it again after changing the `pdfjs-dist` version or the page script. Metro treats `.html` as an asset (`metro.config.js`).
  - No network: the page's Content-Security-Policy is `default-src 'none'; script-src 'unsafe-inline'`, the WebView refuses every navigation except the page itself, and file access is off. `pdfHost.test.ts` checks the page.
  - `pdfjs-dist` is pinned to 3.11.174, the last version with a non-module build that runs in a WebView script tag and in Node. That line has CVE-2024-4367 (script execution while rendering fonts); the app never renders, and `isEvalSupported: false` and `disableFontFace: true` are set. Do not start rendering pages with this version.
  - The file goes in as base64 in 256 KB messages, pages come back one message each. One PDF at a time (queue). Time limits: 20 s without an answer, or 20 s + 2 s per page in total; then the WebView is remounted and the file fails with "took too long".
  - The WebView and `scripts/pdf-to-items.ts` (Node, same pdf.js) both pass raw pdf.js items through `toPdfPage` (`src/utils/pdfStatements/pdfItems.ts`), so JSON made in Node equals what the device produces.
- **Parsers.** `PDF_STATEMENT_PARSERS` in `src/utils/pdfStatements/registry.ts` (`detect` + `parse` per bank, tried in order). Today: ABN AMRO.
- **ABN AMRO** (`abnamro.ts`): a port of `scripts/reference/abnamro_pdf_to_csv.py`, layouts 2023 to 2026, Dutch and English headers.
  - Per page it finds the `Bookdate` / `Boekdatum` and debit / credit headers and reads only the font most of the body is set in (older PDFs print labels over values in another font).
  - A booking line starts with `dd-mm` at the left margin (also printed as `d d-mm`). The amount is a debit when its right edge is at most 5 pt past the start of the credit header; amounts left of the debit header belong to the description. The year comes from the Bkdatum column, else from the statement date (a month after the statement month is the year before).
  - Follow-up lines are the fields `IBAN`, `BIC`, `Naam`, `Omschrijving`, `Kenmerk`, `Incassant`, `Machtiging`, `Voor`, `Betalingskenm.`; a line without a key continues the field before it, glued without a space when that line was 31 characters or longer. Card payments take the first free line, without `,PASnnn`, as the name.
  - The statement is checked against what it prints: total debit, total credit, and previous balance − debit + credit = new balance. A mismatch throws `PdfStatementError` and **nothing of that file is imported**.
- **Same rows as CSV.** `pdfRowsToTransactions` sends the rows through `parseStatementRows` in `parser.ts`: the same reading as a CSV with the columns Date, Name, Description, Amount, Counterparty IBAN. That is the file the reference script writes, so rows imported earlier from its CSV dedup exactly.
- **Across files** (`runImport`): `checkChain` (`chain.ts`) sorts the statements per IBAN, leaves out a statement given twice, and reports a balance that does not carry over (a statement is probably missing) and a skipped statement number. `numberIdenticalRows` then adds ` (2)`, ` (3)` to identical same-day bookings so the dedup key does not collapse them.
- **Summary.** `ImportSummaryModal` shows statements read with the period, "Checked against statement totals", possible duplicates, and each chain problem and left-out file with its reason.
- **Share sheet.** `application/pdf` is in the Android share types in `app.json`; iOS accepts any single file.
- **Pro gate.** PDF statements need the `pdfImport` flag ([subscription.md](subscription.md)). `runImport` passes `allowPdf` to `readStatementFile`, which throws `ProRequiredError` as soon as the first bytes say PDF, before any text is extracted. Those files are left out without a failure row; CSV / Excel files of the same pick are imported; the paywall opens (on top of the summary, which shows once it is closed). An import into a read-only profile is stopped before the picker by `guardWrite`.
- Tests: `npm test -- pdfStatements`. `abnamro.test.ts` uses made-up pages from `fixtures.ts`. `abnamro.private.test.ts` compares the parser row by row with the Python reference on real statements in `scripts/fixtures/private/` (gitignored; it is skipped when the folder or `pdfplumber` is missing, and reports differences by row number and field only). Never commit a real statement or JSON made from one.

Known limits:

- Rows without an IBAN or card reference (bank fees, interest) have nothing to compare across formats: a month imported from both the CSV and the PDF can show those twice.
- Identical same-day bookings are numbered per import. If such a pair is split over two statements that are imported separately, the second one is taken for a duplicate.
- Word positions inside one pdf.js text run are estimated from the character count; the start of a run's first word and the end of its last are exact, which is what the date and amount checks use.
- A layout outside 2023 to 2026 fails its totals check or is not recognised; either way nothing is imported.
- The WebView path (loading the page, message size, time limits, memory with many files) has not been run on a device yet.

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

- The same guide data becomes the `export-csv/` section of the website: a page per bank per language with `hreflang` and `HowTo` JSON-LD (`scripts/site/pages/guides.ts`).
- `site.*` translation keys are web only.
- Build, the other pages and deployment: [website.md](website.md).

## Demo workspace

- Demo seed: `src/db/demoSeeder.ts`. Demo mode lives in `src/contexts/ProfileContext.tsx`.
- Nothing is imported into the demo workspace, so it gets no health alerts, no backup reminder and no partial-month row in For You (`getInboxItems` with `isDemo`).
- Import is blocked in `useStatementImporter` itself: `importStatement` returns, `importSharedFile` (share sheet) shows an alert. The hook returns `importDisabled`; every Import button uses it to gray out.
- Also off in demo mode (grayed, opacity 0.4, with `settings.demoNote` under the Data card): Settings rows Import, Backup & Restore, Reset, the active profile row and the Import Reminders switch; the profile pill in `HeaderActions`. Reminders are not scheduled at launch. The export guide stays readable.
- Why profiles and Reset are off: the demo profile is found by its name, a profile added there would be a real one inside demo mode, and Reset would leave `isDemoMode` on. "Exit Demo" is the only way out.
