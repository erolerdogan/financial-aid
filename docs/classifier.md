# Categorisation and fixed vs. flexible

## Classifier

- `classifyTransaction({ merchant, rawDescription }, rules, { iban, amount, learned })` runs both at import and in `reclassifyAllUnoverriddenTransactions`.
- Precedence: custom rules → learned history → built-in keywords in the merchant name → built-in keywords in the bank text → fallback.
- Fallback is `Uncategorised` (expenses) or `Income` (positive amounts), never `Shopping & Retail`.
- Category rules reclassify only rows with `userOverridden = 0`.
- Built-in category names stay English in the database (classifier, rules, budgets and backups depend on them); see [i18n.md](i18n.md).

## Custom rules

- A `category_rules` keyword is either a text fragment or a counterparty IBAN.
- An IBAN rule wins.
- Text rules match `classificationText(merchant, rawDescription)` as whole words (word start for keywords of 5+ chars); the longest keyword wins.

## Learned history

- `getLearnedCategories` / `buildLearnedCategories` use `userOverridden = 1` rows, keyed by sign + IBAN or sign + `merchantRuleKeyword(merchant)`.
- A key needs 2+ rows with two thirds agreeing.

## Built-in keywords

- `CATEGORY_KEYWORDS` in `src/utils/parser.ts`: `parts` match anywhere, `words` whole-word only; the longest match wins. The shared scan is `matchKeywords`.
- `NAME_ONLY_KEYWORDS` (generic words like MARKET, SHOP, TRANSFER) only count in the merchant name, not the memo.
- For positive amounts built-in keywords can only return `Financial Transfers` (`INCOMING_CATEGORIES`), otherwise `Income`.
- After editing keywords bump `CLASSIFIER_VERSION`. `initDatabase` then reclassifies non-overridden rows once (tracked in `PRAGMA user_version`).

## Review screen

- Uncategorised rows feed the review screen: `src/app/review.tsx`, `getUncategorisedGroups` / `categoriseMerchantGroup`.
- Suggestions: `suggestCategory` in `src/utils/categorySuggestion.ts`, in this order: learned → similar merchant by first significant word → name-only keyword in the text → monthly direct debit. `getUncategorisedGroups` attaches one to each group.
- `CategorySuggestion.reason` is a `Message`, not a string (see [i18n.md](i18n.md)).

## Fixed vs. flexible

- Scoring in `src/utils/fixedCost.ts`: cadence, amount stability, day of month, category, keywords. Fixed at score >= 0.6. A `DIRECT_DEBIT` `txType` adds to the score.
- All queries go through `getFixedResolver` in `src/db/database.ts`.
- Precedence: row `is_fixed` → `fixed_cost_rules` (longest whole-word match) → debt-linked payment → score.
- The override is per merchant keyword (`fixed_cost_rules`), not per transaction; it rewrites `is_fixed` on all matching rows.
- The resolver is cached per profile and keyed on SQLite `total_changes()`, so any write on the connection refreshes it. There is no manual invalidation.
- Reasons are `Message`s: `scoreFixed`, `getFixedResolver`; `FixedExplanation.reason` is a `Message[]`.
- `getAllTransactionsByDate` has a `type` argument (`FIXED | FLEXIBLE`, resolved in JS, paged after filtering) that is currently unused: the Transactions screen has no type filter.
