// Copy for the website only (`scripts/build-site.ts`). The app never imports these files, so the text
// does not ship in the app bundle. The legal texts are in `src/content/legal`, which the app shows too. Names the app already has (Budget Health, Future Growth, the
// disclaimers) come from `src/i18n/locales` instead, so both stay the same.
export const en = {
  'nav.features': 'Features',
  'nav.guides': 'Bank guides',
  'nav.faq': 'FAQ',
  'nav.support': 'Support',
  'nav.privacy': 'Privacy',
  'nav.terms': 'Terms',
  'nav.disclaimer': 'Disclaimer',
  'nav.changelog': "What's new",
  'nav.label': 'Site',
  'footer.tagline': 'A personal finance app that keeps your data on your device.',
  'footer.disclaimer': 'Financial Aid is a budgeting tool. It does not give financial advice.',
  'cta.appStore': 'Download on the App Store',
  'cta.playStore': 'Get it on Google Play',
  'common.learnMore': 'Learn more',
  'common.screenshotAlt': '{screen} in Financial Aid',

  'home.title': 'A private budget app for your bank statements',
  'home.description':
    'Import the CSV or Excel statement from your bank. Financial Aid sorts your transactions, tracks budgets and debts, and keeps everything on your device.',
  'home.heading': 'See where your money goes, without handing over your bank login',
  'home.lead':
    'Import the statement your bank lets you download. Financial Aid sorts the transactions, tracks budgets and debts, and keeps everything on your phone.',
  'home.screen': 'Home screen',
  'home.point1Title': 'No account needed',
  'home.point1Text': 'Open the app and start. Signing up is optional.',
  'home.point2Title': 'No bank connection',
  'home.point2Text': 'You import a CSV or Excel file yourself. The app never asks for your bank login.',
  'home.point3Title': 'Nothing uploaded',
  'home.point3Text': 'Your data stays in a database on your device. No analytics, no ads.',
  'home.featuresTitle': 'What it does',
  'home.banksTitle': "Works with your bank's export",
  'home.banksText':
    'The exports of {banks} are recognised automatically. Files from other banks are read by detecting the columns.',
  'home.banksLink': 'How to export your statement',
  'home.moreTitle': 'Also in the app',
  'home.more1': 'Automatic categories that learn from your corrections',
  'home.more2': 'A monthly budget per category',
  'home.more3': 'Trends per month, with last year for comparison',
  'home.more4': 'Fixed and flexible costs split automatically',
  'home.more5': 'Separate profiles, each with its own currency',
  'home.more6': 'Nine languages and six colour themes, in light and dark',

  'feature.import.name': 'Statement import',
  'feature.import.title': 'Import your bank statement as CSV or Excel',
  'feature.import.summary':
    'Download the statement from your bank, open it in Financial Aid, and your transactions are sorted in seconds.',
  'feature.import.p1Title': 'Reads the file your bank gives you',
  'feature.import.p1Text':
    'CSV, text and Excel files are supported. The date, amount, name and description columns are found automatically, and the exports of {banks} are recognised.',
  'feature.import.p2Title': 'Safe to import twice',
  'feature.import.p2Text':
    'Duplicates are skipped, so overlapping statements do no harm. After each import you see what was added, the dates covered and what was skipped.',
  'feature.import.p3Title': 'Straight from your bank app',
  'feature.import.p3Text':
    'Export the statement in your bank app, choose Share and pick Financial Aid. PDF statements and photos are not supported; the app tells you which file to use instead.',

  'feature.health.title': 'A health score for your budget',
  'feature.health.summary':
    'One score from 0 to 100 that shows whether your money is in good shape, and the one change that would help most.',
  'feature.health.p1Title': 'Five pillars',
  'feature.health.p1Text':
    'Savings rate, housing, fixed costs, debt payments and a safety buffer, each compared with a common rule of thumb.',
  'feature.health.p2Title': 'Ranges that fit your household',
  'feature.health.p2Text':
    'Typical spending ranges adapt to the number of adults and children and to renting or owning. You can accept a level that is right for you.',
  'feature.health.p3Title': 'Alerts and a monthly report',
  'feature.health.p3Text':
    'After an import the app can point out a missed debt payment, a new recurring charge or a price increase. The monthly report is saved as a PDF made on your device.',

  'feature.debts.title': 'Track your loans and see when you are debt-free',
  'feature.debts.summary':
    'Add a loan or mortgage once. Payments are picked up from your statements and the remaining balance updates itself.',
  'feature.debts.p1Title': 'Payments linked automatically',
  'feature.debts.p1Text':
    'A keyword links the matching statement payments to a debt after every import. Near misses are listed so you can add them by hand.',
  'feature.debts.p2Title': 'Principal and interest',
  'feature.debts.p2Text':
    'Each payment is split into principal and interest. You see the remaining balance, the interest paid so far and the estimated debt-free month.',
  'feature.debts.p3Title': 'Suggested from your statements',
  'feature.debts.p3Text':
    'A steady monthly payment to a lender that no debt covers yet is suggested as a new debt, with the details filled in.',

  'feature.growth.title': 'See how your savings could grow',
  'feature.growth.summary':
    'Enter a monthly amount, a number of years and a starting amount, and see an estimate of the balance at the end.',
  'feature.growth.p1Title': 'Three outlooks',
  'feature.growth.p1Text':
    '{cautious}, {expected} and {optimistic} use a yearly return of 5%, 7% and 9%, shown side by side. You can also enter your own return, fee and inflation.',
  'feature.growth.p2Title': 'Year by year',
  'feature.growth.p2Text':
    "A chart and a table show each year split into what you paid in and what growth added, in future prices or in today's prices.",
  'feature.growth.p3Title': 'Work towards a goal',
  'feature.growth.p3Text':
    'Set a target balance or a monthly income and see whether you are on track, and the monthly amount needed to get there.',

  'feature.backup.title': 'Back up your data to a place you choose',
  'feature.backup.summary':
    'One file holds all your profiles. You decide where it is saved; the app does not upload it.',
  'feature.backup.p1Title': 'Optional password',
  'feature.backup.p1Text':
    'A backup with a password is encrypted with AES-256. A forgotten password cannot be recovered, so keep it somewhere safe.',
  'feature.backup.p2Title': 'Restore with a preview',
  'feature.backup.p2Text':
    'Before anything changes you see what is in the backup and what is on the device. The replaced data is kept, so the last restore can be undone.',
  'feature.backup.p3Title': 'Export your transactions',
  'feature.backup.p3Text':
    'Save the transactions of a profile as a CSV or Excel file to use elsewhere. This file is readable and not encrypted.',

  'support.title': 'Support',
  'support.description': 'Help with Financial Aid: export guides, common questions and how to reach us.',
  'support.lead': 'Most questions are about getting a statement file out of the bank. Start here.',
  'support.guidesTitle': 'Export your statement',
  'support.guidesText': "Step-by-step guides per bank, taken from each bank's own help pages.",
  'support.faqTitle': 'Common questions',
  'support.faqText': 'Privacy, supported files, duplicates and backups.',
  'support.contactTitle': 'Contact',
  'support.contactEmail': 'Send an email to {link} and describe what you did and what happened.',
  'support.contactIssues': 'Open an issue on {link} and describe what you did and what happened.',
  'support.noFiles':
    'Please do not send statement files or backups: they contain personal data. A description of the columns in the file is enough.',

  'changelog.title': "What's new",
  'changelog.description': 'The changes in each version of Financial Aid.',
  'changelog.version': 'Version {version}',
  'changelog.v100.1': 'Statement import for CSV, text and Excel files, with bank format detection',
  'changelog.v100.2': 'Automatic categories, budgets and trends',
  'changelog.v100.3': 'Budget Health score, alerts and a monthly PDF report',
  'changelog.v100.4': 'Debts with automatic payment linking',
  'changelog.v100.5': 'Future Growth calculator',
  'changelog.v100.6': 'Encrypted backups and transaction export',
  'changelog.v100.7': 'Nine languages',
};

export type SiteKey = keyof typeof en;
export type SiteCopy = Record<SiteKey, string>;
