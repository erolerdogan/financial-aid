// The privacy policy, the terms of use and the disclaimer. The app shows them under Settings → Personal Data & Privacy
// (`src/app/legal.tsx`) and the website publishes the same text (`scripts/site/pages/`), so there is one copy.
export const en = {
  'legal.supportPage': 'Support',

  'privacy.title': 'Privacy policy',
  'privacy.description':
    'Financial Aid stores your data on your device and does not collect it. This page explains what that means.',
  'privacy.updated': 'Last updated: {date}',
  'privacy.summary':
    'In short: Financial Aid does not collect, upload or share your financial data. It stays on your device.',
  'privacy.s1Title': 'Data the app stores',
  'privacy.s1Text':
    'The statements you import and the categories, budgets, debts, plans and settings you create are stored in a database on your device. The app has no accounts and no server that receives this data.',
  'privacy.s2Title': 'Data the app collects',
  'privacy.s2Text':
    'None. The app contains no analytics, no advertising and no tracking, and it makes no network requests with your data.',
  'privacy.s3Title': 'Files you import, save and share',
  'privacy.s3Text':
    'Statement files are read on the device. Backups, exported transactions and PDF reports are created on the device and saved or shared only where you choose. If you keep them in a cloud service, the privacy policy of that service applies.',
  'privacy.s4Title': 'Notifications',
  'privacy.s4Text': 'Import reminders and alerts are scheduled on the device. They are not sent from a server.',
  'privacy.s5Title': 'Deleting your data',
  'privacy.s5Text':
    'Settings has an option to reset all data and profiles. Deleting the app removes its database from the device. Backup files you saved elsewhere have to be deleted by you.',
  'privacy.s6Title': 'This website',
  'privacy.s6Text':
    'This website uses no cookies and no analytics. It is hosted on GitHub Pages, which may log technical data such as IP addresses; see the {link}.',
  'privacy.s6Link': 'GitHub privacy statement',
  'privacy.s7Title': 'Changes',
  'privacy.s7Text': 'When this policy changes, the new version is published on this page with a new date.',
  'privacy.s8Title': 'Contact',
  'privacy.s8Text': 'For questions about this policy, use the contact details on the {link} page.',

  'terms.title': 'Terms of use',
  'terms.description':
    'The terms for using the Financial Aid app: what it is, what it is not and who is responsible for what.',
  'terms.summary':
    'In short: Financial Aid is a tool for your own budgeting. You keep your data and your backups, the figures can be wrong, and nothing in the app is financial advice.',
  'terms.s1Title': 'Accepting these terms',
  'terms.s1Text': 'By using Financial Aid you accept these terms. If you do not accept them, do not use the app.',
  'terms.s2Title': 'What the app is',
  'terms.s2Text':
    'Financial Aid sorts the statement files you import into categories, budgets, debts and projections. It is not a bank or a payment service: it does not connect to your accounts and it cannot move money.',
  'terms.s3Title': 'No financial advice',
  'terms.s3Text':
    'Nothing in the app is financial, investment, tax or legal advice. Scores, projections and suggestions are general information. See the {link}.',
  'terms.s3Link': 'disclaimer',
  'terms.s4Title': 'Your data and backups',
  'terms.s4Text':
    'Your data is stored on your device only, as described in the {link}. We cannot see it, restore it or recover it. Making backups and keeping them safe is up to you. A password you set on a backup cannot be reset: without it, the backup cannot be opened.',
  'terms.s4Link': 'privacy policy',
  'terms.s5Title': 'Accuracy',
  'terms.s5Text':
    'The app reads files from many banks and sorts transactions automatically. Amounts, categories, linked debt payments and totals can be wrong or incomplete. Check important figures against the statements from your bank, which remain the record that counts.',
  'terms.s6Title': 'Open-source software',
  'terms.s6Text': 'The app includes open-source software. Its licenses are listed in the app under Settings.',
  'terms.s7Title': 'No warranty',
  'terms.s7Text':
    'As far as the law allows, the app is provided as it is, without a warranty of any kind. We do not promise that it is free of errors, that it reads every file or that it stays available.',
  'terms.s8Title': 'Liability',
  'terms.s8Text':
    'As far as the law allows, we are not liable for losses that result from using the app, including decisions based on its figures and data that is lost. Nothing in these terms limits rights that the consumer law of your country gives you and that cannot be excluded.',
  'terms.changesText':
    'When these terms change, the new version is published on this page with a new date. If you keep using the app after that, you accept the new version.',
  'terms.contactText': 'For questions about these terms, use the contact details on the {link} page.',

  'disclaimer.title': 'Disclaimer',
  'disclaimer.description':
    'Financial Aid is a budgeting tool, not a financial adviser. What its scores, projections and estimates mean and where their limits are.',
  'disclaimer.summary':
    'In short: Financial Aid shows information about your own money. It does not give financial advice, and its estimates are not guaranteed.',
  'disclaimer.s1Title': 'Not financial advice',
  'disclaimer.s1Text':
    'Financial Aid is not a financial adviser. Nothing in the app or on this website is financial, investment, tax or legal advice. The app does not know your full situation. For decisions that matter, talk to a qualified adviser.',
  'disclaimer.healthText':
    'Budget Health compares your spending with general rules of thumb. The score and the alerts are guidance, not a verdict on your finances.',
  'disclaimer.freedomText':
    'Future Growth calculates projections from the amounts and the outlook you choose. They are estimates: returns and prices change, investments can lose value, and no result is guaranteed.',
  'disclaimer.debtsText':
    'Payoff dates, interest and estimated rates for debts are calculated from what you enter and from the payments you import. The figures from your lender are the ones that count.',
  'disclaimer.s5Title': 'Currencies',
  'disclaimer.s5Text':
    'When you change the currency, the app converts your amounts with fixed exchange rates that are built into the app. They are not live rates and can differ from the real ones.',
  'disclaimer.s6Title': 'Your decisions',
  'disclaimer.s6Text': 'You decide what to do with your money, and you are responsible for those decisions.',
};

export type LegalKey = keyof typeof en;
export type LegalCopy = Record<LegalKey, string>;
