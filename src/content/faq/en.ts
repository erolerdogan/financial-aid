// The frequently asked questions. The app shows them under Settings → About (`src/app/faq.tsx`) and the
// website publishes the same text (`scripts/site/pages/faq.ts`), so there is one copy.
// A `{name}` other than `{banks}` stands for a label the app already has (`FAQ_APP_NAMES` in `index.ts`).
export const en = {
  'faq.title': 'Frequently asked questions',
  'faq.description':
    'Answers about importing statements, categories, Budget Health, privacy and backups in Financial Aid.',
  'faq.intro': 'Short answers about how Financial Aid works. Tap a question to read its answer.',

  'faq.start.title': 'Getting started',
  'faq.start.what.q': 'What does Financial Aid do?',
  'faq.start.what.a':
    'It reads the statements you download from your bank, puts every transaction in a category and shows where your money goes: income, spending, budgets, debts and trends. To begin, import a statement with {settings} → {importRow}.',
  'faq.start.bank.q': 'Does the app connect to my bank?',
  'faq.start.bank.a':
    'No. You download a statement from your bank yourself and import that file. The app never asks for your bank login and has no connection to your bank.',
  'faq.start.statement.q': 'How do I get a statement from my bank?',
  'faq.start.statement.a':
    "Download it in your bank's app or on its website as a CSV or Excel file. {settings} → {guide} shows the steps per bank, taken from each bank's own help pages, and general steps for any other bank.",
  'faq.start.demo.q': 'Can I try the app without my own data?',
  'faq.start.demo.a':
    'Yes. The welcome screen offers {demo}: a separate profile with three months of sample transactions and two sample debts. Import, backup, reset, profile switching and import reminders are switched off there. The Future Growth plan cannot be changed there. Leave it with {exitDemo}.',

  'faq.import.title': 'Importing statements',
  'faq.import.files.q': 'Which files can I import?',
  'faq.import.files.a':
    'CSV files, tab or semicolon separated text files (.txt, .tsv) and Excel files (.xlsx, .xls). Photos, screenshots and bank formats such as CAMT XML, MT940 and OFX are refused, with a hint to use the CSV or Excel export.',
  'faq.import.banks.q': 'Which banks are supported?',
  'faq.import.banks.a':
    'The exports of {banks} are recognised automatically. Other banks work when they offer a CSV or Excel download; the app detects the columns from the header row.',
  'faq.import.pdf.q': 'Can I import a PDF statement?',
  'faq.import.pdf.a':
    'Only PDF statements from ABN AMRO. They are read on your device, and each one is checked against its own printed totals and balances; a statement that does not add up is not imported. For scanned PDFs and for other banks, use the CSV or Excel export.',
  'faq.import.twice.q': 'What happens when I import the same statement twice?',
  'faq.import.twice.a':
    'Transactions that are already in the app are skipped, so importing overlapping statements is safe.',
  'faq.import.share.q': 'Can I import straight from my bank app?',
  'faq.import.share.a':
    'Yes. Export the statement in your bank app, choose Share and pick Financial Aid. The file is imported into the active profile, the same way as a file you pick yourself.',
  'faq.import.coverage.q': 'How do I know whether a month is complete?',
  'faq.import.coverage.a':
    'The statement label on {home} shows how much of the selected month your statements cover: no data yet, the current month in progress, a past month with days missing, or the whole month. A past month with days missing is also listed under {forYou}.',

  'faq.categories.title': 'Categories and budgets',
  'faq.categories.how.q': 'How are transactions categorised?',
  'faq.categories.how.a':
    'On import, in this order: your own rules, what you chose before for the same merchant, then built-in keywords in the merchant name and in the rest of the bank text. If nothing matches, money coming in becomes {income} and spending becomes {uncategorised}. The built-in keywords are tuned for Dutch banks and merchants.',
  'faq.categories.fix.q': 'A transaction is in the wrong category. How do I fix it?',
  'faq.categories.fix.a':
    'Open the transaction and tap its category. Your choice is remembered and is not overwritten later. Once you have corrected a merchant at least twice, mostly the same way, its new transactions follow your choice.',
  'faq.categories.review.q': 'What do I do with uncategorised transactions?',
  'faq.categories.review.a':
    'The {transactions} screen shows at the top how many there are. The review list groups them per merchant, largest first, and suggests a category where it can. Picking a category once applies it to all transactions of that merchant and to future imports. You can also open a category on {home}, in {health}, in {trends} or under {categories} and add uncategorised transactions to it there: tick several at once, and a merchant you select completely is remembered for future imports.',
  'faq.categories.fixed.q': 'What are fixed and flexible costs?',
  'faq.categories.fixed.a':
    'Fixed costs are bills that come back, such as rent, utilities and subscriptions; the rest is flexible. The app detects them from how a merchant behaves: a regular rhythm, stable amounts and direct debits. In the detail of a transaction you can mark its merchant as {fixed} or {flexible}, or go back with {resetAuto}.',
  'faq.categories.budget.q': 'How do I set a budget?',
  'faq.categories.budget.a':
    'Open {settings} → {budgets} and set a monthly limit per category. Progress bars on {home} and on the budgets screen show what you spent against the limit. A limit can also be set from the chart on {trends}.',
  'faq.categories.own.q': 'Can I add my own categories and rules?',
  'faq.categories.own.a':
    'Yes. Under {settings} → {categories} you create, rename, recolour and delete categories and add keyword rules to them. When a rule changes, the transactions you have not categorised by hand are sorted again.',

  'faq.plan.score.q': 'How is the health score calculated?',
  'faq.plan.score.a':
    'The score runs from 0 to 100 and combines five pillars: savings rate (30%), housing (20%), fixed costs (15%), debt payments without the mortgage (20%) and a safety buffer (15%). Each pillar is compared with a common rule of thumb. A buffer you have not entered is left out, and the other pillars share its weight.',
  'faq.plan.income.q': 'Which income does the health score use?',
  'faq.plan.income.a':
    'The average of the last three complete months of income in your statements, or the amount you type in yourself. Until there is a month with income, no score is shown. A loan that is paid out, or another large one-off payment, is not counted as income.',
  'faq.plan.debts.q': 'How does the app find my debt payments?',
  'faq.plan.debts.a':
    'Every debt has keywords. After each import, a transaction is linked when a keyword matches a whole word and the amount is close to the monthly payment. Near-misses are listed as possible matches that you can add by hand, and a linked payment can be unlinked again. In the debt form you can also choose a payment from your transactions: every payment to the same lender is selected with it, and its keyword is added for you.',
  'faq.plan.growth.q': 'What does {growth} show?',
  'faq.plan.growth.a':
    'How a starting amount and a monthly contribution could grow over the years. The three outlooks use a yearly return of 5%, 7% and 9%; you can also enter your own return, fee and inflation. The result is a projection, not a promise.',
  'faq.plan.advice.q': 'Is the health score or the growth calculator financial advice?',
  'faq.plan.advice.a':
    'No. The health score compares your spending with common rules of thumb, and the growth calculator shows a projection that is not guaranteed. Neither is financial advice.',

  'faq.privacy.title': 'Privacy and backups',
  'faq.privacy.where.q': 'Where is my data stored?',
  'faq.privacy.where.a':
    'In a database on your device. There is no account and no server that receives your data, and the app contains no analytics or ads.',
  'faq.privacy.lost.q': 'What if I lose my phone or delete the app?',
  'faq.privacy.lost.a':
    'Your data exists only on your device, so without a backup it cannot be recovered. Make a backup regularly and keep it somewhere safe; the app reminds you after 30 days.',
  'faq.privacy.backup.q': 'How do I make a backup or move to a new phone?',
  'faq.privacy.backup.a':
    '{settings} → {backup} saves one file with all your profiles, and you choose where it goes. On the new phone, choose {restore} on the welcome screen. A restore replaces everything on the device, nothing is merged, and the app first shows what will change. {undo} brings the replaced data back.',
  'faq.privacy.password.q': 'I forgot the password of my backup. Can it be reset?',
  'faq.privacy.password.a':
    'No. A backup with a password is encrypted, and without the password nobody can open it, not even us. Keep the password somewhere safe, or make a new backup while the data is still on your device.',
  'faq.privacy.delete.q': 'How do I delete all my data?',
  'faq.privacy.delete.a':
    '{settings} → {reset} removes all data and profiles from the device. Deleting the app removes its database as well. Backup files you saved somewhere else have to be deleted by you.',

  'faq.profiles.title': 'Profiles and settings',
  'faq.profiles.what.q': 'What are profiles?',
  'faq.profiles.what.a':
    'Separate ledgers in one app, for example personal, business and household. Each profile has its own transactions, categories, rules, budgets and debts, and its own name, colour and currency. A statement is imported into the profile that is active.',
  'faq.profiles.currency.q': 'What happens when I change the currency?',
  'faq.profiles.currency.a':
    'The app downloads the exchange rate of the day, shows it and, after you confirm, converts the amounts already stored in the profile (transactions, budgets, debts and household amounts). Future Growth plans are not converted. The request contains none of your data. Changing the currency needs an internet connection. Converted amounts are rounded, so the result is approximate.',
  'faq.profiles.languages.q': 'Which currencies and languages are available?',
  'faq.profiles.languages.a':
    'Currencies: more than 150, among them EUR, USD, GBP, JPY, CHF, CAD and AUD. Languages: English, Dutch, German, Turkish, Spanish, French, Italian, Portuguese and Russian.',
  'faq.profiles.notifications.q': 'When does the app send notifications?',
  'faq.profiles.notifications.a':
    'Import reminders on the 15th and 28th of each month, which are cancelled once you import a statement, and the {health} alerts you have switched on. All of them are scheduled on your device. The reminders are turned off under {settings} → {reminders}.',
};

export type FaqCopy = typeof en;
export type FaqKey = keyof FaqCopy;
