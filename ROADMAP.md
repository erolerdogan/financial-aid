# Roadmap

Status notes were checked against the code on 2026-10-07.

## Open

- **Debts: credit cards, due-date reminders.** Not started. `DEBT_TYPE_OPTIONS` has no credit card type and no reminder is scheduled before a due date. The `missed_debt_payment` health alert reports a payment after it was missed, which is a different thing. The payoff simulator is done (`docs/debts.md`); still open there: a "debt-free first" option in Future Growth (TODO in `docs/freedom.md`), and FAQ, website and legal texts do not mention it.

- **Named in the navigation plan, not built.** The You tab has no rows for them: Monthly Wrap (only the unused `wrapPro` flag exists), bank accounts (the "Banks & import" group holds the import and the export guides), emoji avatars (a profile has a colour and shows its initial), home-screen quick actions (no module installed).
- **Manual entry: edit.** A hand-entered transaction can be added and deleted (`docs/navigation.md`, Manual entry), not edited; and a statement imported later does not recognise it as the same payment.

## Partly done

- **Recurring subscription detection.** The `new_recurring` Budget Health alert already reports a new recurring charge after an import. There is no dedicated flow: `detectRecurringPatterns` and `getRecurringCandidates` exist in `database.ts` but nothing calls them, and the unfinished `RecurringSuggestionsModal` was removed. Decide whether the alert is enough or a suggestions screen should be built on those queries.

## Looks done (confirm, then remove)

- **Make category lists dynamic (Trends pills, Goals) from the `categories` table.** Both named screens already read the table: Trends pills come from `getExpenseCategoryNames`, Budgets (`goals.tsx`) from `getCategoryGoalsWithProgress`. Not checked: whether any other list still uses a hardcoded category set.

## Known gaps noted in the docs

- Free / Pro: the gating layer and the paywall exist (`docs/subscription.md`), but nothing can be bought: `src/services/purchases.ts` is a stub, prices and the Terms / Privacy links in `src/constants/paywall.ts` are placeholders, and the legal texts, FAQ and website do not mention Pro. RevenueCat `logIn` / `logOut` have their place already (`identify` / `reset`). Score history and "Export PDF" are not gated yet (placeholder flags, marked `// TODO(pro)`).
- Account (`docs/account.md`): written and unit-tested, not yet run on a device or against a Supabase project. Before an App Store submission the delete-account function must revoke the Apple token; the privacy policy now names a processor and needs a legal read; the new texts in eight languages are unreviewed.
- PDF statement import: only ABN AMRO, verified against three real statements (2023, 2024, 2025) and not yet run on a device. See the limits in `docs/import.md`.
- Bank layouts in `src/utils/bankFormats.ts` come from the banks' documented exports and have not been checked against live files.
- Translations have not been reviewed by native speakers. That includes the name of the You tab (Jij, Du, Siz, Tú, Vous, Tu, Você, Вы), which was translated literally.
- The tab bar with the add button, the You tab, the new header and manual entry (2026-10-10) pass `tsc`, lint and the tests but have not been run on a device.
- Stored merchant names are not backfilled when `deriveMerchant` changes.
