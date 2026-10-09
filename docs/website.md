# Website

A static site about the app, in the app's nine languages: home, a page per feature, the bank export guides, FAQ, support, privacy policy, terms of use, disclaimer and changelog. No framework and no client-side script apart from the language redirect on the root page.

`npx tsx scripts/build-site.ts` (`npm run site`) writes it to `site-dist/` (git-ignored). `.github/workflows/site.yml` deploys it to GitHub Pages on pushes to `main`.

## Pages

Every page exists under each language code with the same path, so each version links to the others (`hreflang`, the language list in the footer).

| Path under `/<lang>/` | Builder in `scripts/site/pages/` | Notes |
| --- | --- | --- |
| `` (home) | `home.ts` | `SoftwareApplication` JSON-LD |
| `features/<slug>/` | `features.ts` | One per entry in `FEATURES` (`scripts/site/features.ts`) |
| `export-csv/`, `export-csv/<bank>/`, `export-csv/other-bank/` | `guides.ts` | From `BANK_GUIDES`; `HowTo` JSON-LD. See [import.md](import.md) |
| `faq/` | `faq.ts` | From `FAQ_GROUPS`, the questions the app shows too; `FAQPage` JSON-LD |
| `support/` | `support.ts` | Contact is `SUPPORT_EMAIL`, else the repository's issues |
| `privacy/`, `terms/`, `disclaimer/` | `legal.ts` | From `LEGAL_DOCUMENTS`, the documents the app shows too |
| `changelog/` | `changelog.ts` | From `CHANGELOG` |

- The root `index.html` sends the visitor to `/<lang>/` by browser language, English otherwise.
- `scripts/site/layout.ts` is the document around a page: head tags, header, download block, footer, and the whole stylesheet (`STYLE`).
- `scripts/site/html.ts` has the shared pieces: `PATHS`, `pagePath` / `href` / `absolute`, `escapeHtml`, `withLink`, `listOf`, `downloadButtons`, `screenshot`.
- A page builder returns a `Page` (`path`, `title`, `description`, `body`, optional `jsonLd`, `wide`, `cta: false`). To add a page: write the builder, add it to the list in `scripts/build-site.ts`, add its path to `PATHS` and, when it belongs in the navigation, to `NAV` or `FOOTER_NAV` in `layout.ts`.
- The build ends with a link check: an `href`, `src` or `og:image` that points into the site but at no written file fails the build.

## Copy

- Web-only text is in `src/content/site/<lang>.ts`, one file per language, typed as `SiteCopy` so a missing key fails `tsc`. The app never imports these files, so the text is not in the app bundle. Page builders read it with `ctx.s(key, params)`.
- Text the app already has comes from the app's locale files with `ctx.t(key)`: the guides, the feature names (`health.title`, `freedom.name`, `home.debts.title`, `settings.backup`), the outlook names and the two disclaimers (`health.disclaimer`, `freedom.disclaimer`), so the site cannot drift from the app. The older `site.*` keys in `src/i18n/locales` (guide titles, the download block) stay where they are.
- A sentence with a link in it has a `{link}` placeholder, filled by `withLink` with ready-made HTML. Everything else is escaped.
- Bank names in a sentence are joined per language with `listOf` (`Intl.ListFormat`).
- Feature claims come from `README.md` and these docs. Nothing from `ROADMAP.md` that is not built, and nothing about pricing.
- The Budget Health and Future Growth pages carry the same disclaimer line as their screens in the app.
- The legal texts (privacy policy, terms of use, disclaimer) are not web-only: they are in `src/content/legal/<lang>.ts`, typed `LegalCopy`, and the app shows them under Settings → About → Personal Data & Privacy (`src/app/legal.tsx`). `LEGAL_DOCUMENTS` in `src/content/legal/index.ts` lists each document's sections and its `updated` date; the site builder and the app screen both render from it, and `SITE_COPY` merges the legal keys in so `ctx.s` reads them. On the website the words that fill a `{link}` are a link (`links` in `pages/legal.ts`); in the app they are plain text.
- The FAQ is shared in the same way: `src/content/faq/<lang>.ts`, typed `FaqCopy`, with the groups and their order in `FAQ_GROUPS` (`src/content/faq/index.ts`). The app shows it under Settings → About (`src/app/faq.tsx`), and `SITE_COPY` merges its keys in. A `{name}` in an answer is `{banks}` (the recognised banks: `listOf` on the website, a comma list in the app, where `Intl.ListFormat` is not relied on) or a label of the app from `FAQ_APP_NAMES`, filled by `faqParams`, so an answer names a screen the way the app does in that language. To add a question: its `.q` and `.a` keys in all nine files and an entry in `FAQ_GROUPS`. Answers state what `README.md` and these docs state; change them with the feature.
- The privacy policy describes what the code does (local SQLite, no account, no analytics, no network calls with user data, local notifications). Section 6 names GitHub Pages as the host: change it, and `HOST_PRIVACY_URL`, when the site moves.
- The terms of use and the disclaimer follow the code as well: no account or server, backups whose password cannot be reset, automatic import and categorisation that can be wrong, exchange rates downloaded on the day of a currency switch (`src/services/exchangeRates.ts`; privacy section 2 names the request and the service). They name no company, address or governing law; add those to the copy when there is a legal entity. The translations are not legally reviewed.
- Change a document's `updated` date with any change to its text. A change reaches the app only with a release, the website on deploy.
- The site is live only when GitHub Pages is enabled for the repository (Settings → Pages → Source: GitHub Actions); without it the deploy job fails. The stores need the privacy policy at a public URL.
- Tests: `npx tsx src/content/faq/faq.test.ts` (every key in every language and used by a group, every placeholder has a value, every app label exists), `npx tsx src/content/legal/legal.test.ts` (every key in every language, every key used by a document, a `{link}` has its words) and `npx tsx src/content/site/site.test.ts` (every key in every language, placeholders kept, no sentence left in English, changelog keys exist).
- Translations have not been reviewed by native speakers.

## Changelog

`src/content/site/changelog.ts`, newest first. An entry is a version, an optional release date (`YYYY-MM-DD`, left out until the version is in the stores) and its items as `changelog.*` keys, which go into all nine copy files.

## Images

- The header icon and favicon are copied from `assets/images/icon.png` and `favicon.png` at build time.
- `site/` is copied to the site root as it is. Today it holds `og.png`, the 1200×630 social preview image (the app icon, name and one line on the dark background). Without it the icon is used.
- Screenshots go in `site/screenshots/<name>.png`, with an optional `<name>-dark.png` for dark mode. Names: `home` (home page hero) and the feature slugs `import`, `budget-health`, `debts`, `future-growth`, `backup`. A page without its file renders without an image. Take them in the demo workspace so no real data is shown; none exist yet.

## Settings

Read from the environment by `scripts/site/config.ts`; in the workflow they come from repository variables of the same name. All are optional.

| Variable | Default | Effect |
| --- | --- | --- |
| `SITE_URL` | `https://erolerdogan.github.io/financial-aid` | Canonical URLs, sitemap, and the base path of every link |
| `APP_URL` | The GitHub repository | Target of "Get Financial Aid" while there are no store links |
| `APP_STORE_URL`, `PLAY_STORE_URL` | None | A store button each; they replace the `APP_URL` button |
| `SUPPORT_EMAIL` | None | Shown on the support page instead of the link to the repository's issues |

- A custom domain is set in the repository's Pages settings (a `CNAME` file is ignored when Pages deploys from Actions); then set `SITE_URL` to it.
- Local preview: `SITE_URL=http://localhost:4173 npm run site`, then `python3 -m http.server 4173` inside `site-dist/`. With the default `SITE_URL` the links carry the `/financial-aid` base path and do not resolve on a local server.
