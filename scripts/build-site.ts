// Renders the bank export guides to a static website.
// Run with: npx tsx scripts/build-site.ts   (output in site-dist/)
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  BANK_GUIDES,
  CHANNEL_KEYS,
  GENERIC_STEPS,
  guideName,
  labelLanguage,
  languageName,
  stepParts,
  type BankGuide,
  type GuideStep,
} from '../src/content/bankGuides';
import { LANGUAGES, translate, type LanguageCode, type TranslationKey, type TranslationParams } from '../src/i18n';
import { createFormatters } from '../src/i18n/format';

/** Where the site is served; a custom domain only changes this. */
const SITE_URL = (process.env.SITE_URL ?? 'https://erolerdogan.github.io/financial-aid').replace(/\/+$/, '');
/** Where "Get Financial Aid" leads until there are store links. */
const APP_URL = process.env.APP_URL ?? 'https://github.com/erolerdogan/financial-aid';
const APP_NAME = 'Financial Aid';
const OUT_DIR = join(__dirname, '..', 'site-dist');
const SECTION = 'export-csv';
const OTHER_SLUG = 'other-bank';
const DEFAULT_LANGUAGE: LanguageCode = 'en';

const BASE_PATH = new URL(SITE_URL).pathname.replace(/\/+$/, '');
const ORIGIN = new URL(SITE_URL).origin;

/** `pt` is Brazilian wording in the app. */
const htmlLang = (code: LanguageCode): string => (code === 'pt' ? 'pt-BR' : code);

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Path of a page under the site root; `slug` is a bank, the general guide, or empty for the index. */
const pagePath = (code: LanguageCode, slug = ''): string => `/${code}/${SECTION}/${slug ? `${slug}/` : ''}`;
const href = (path: string): string => `${BASE_PATH}${path}`;
const absolute = (path: string): string => `${ORIGIN}${BASE_PATH}${path}`;

const STYLE = `
:root{--bg:#f5f6f8;--card:#fff;--text:#14171a;--muted:#5f6b7a;--border:#e3e6ea;--accent:#1570d1;--tint:#e6f1fc}
@media (prefers-color-scheme:dark){:root{--bg:#0f1114;--card:#1a1d21;--text:#f2f4f6;--muted:#9aa5b1;--border:#2b3036;--accent:#5aa9f5;--tint:#16283b}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main,header,footer{max-width:680px;margin:0 auto;padding:0 16px}
header{padding-top:20px;display:flex;justify-content:space-between;align-items:center;gap:12px}
header a{font-weight:700;color:var(--text);text-decoration:none}
a{color:var(--accent)}
h1{font-size:1.9rem;line-height:1.2;letter-spacing:-.02em;margin:28px 0 10px;text-wrap:balance}
h2{font-size:1.15rem;margin:0 0 6px}
p{margin:0 0 14px}
.muted{color:var(--muted)}
.small{font-size:.85rem}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:4px 18px;margin:18px 0}
.pills{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 4px;padding:0;list-style:none}
.pills li{background:var(--tint);color:var(--accent);font-size:.8rem;font-weight:600;padding:4px 10px;border-radius:12px}
ol.steps{list-style:none;margin:0;padding:0;counter-reset:step}
ol.steps li{counter-increment:step;display:flex;gap:12px;padding:14px 0;border-top:1px solid var(--border)}
ol.steps li:first-child{border-top:0}
ol.steps li::before{content:counter(step);flex:none;width:26px;height:26px;border-radius:13px;background:var(--tint);color:var(--accent);font-size:.8rem;font-weight:700;display:flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums}
ul.banks{list-style:none;margin:0;padding:0}
ul.banks li{border-top:1px solid var(--border)}
ul.banks li:first-child{border-top:0}
ul.banks a{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 0;text-decoration:none;color:var(--text);font-weight:600}
ul.banks span{color:var(--muted);font-weight:400;font-size:.85rem;text-align:right}
.cta{padding:18px}
.button{display:inline-block;background:var(--accent);color:#fff;font-weight:700;text-decoration:none;padding:11px 18px;border-radius:12px}
@media (prefers-color-scheme:dark){.button{color:#0f1114}}
footer{padding-top:8px;padding-bottom:40px}
footer ul{display:flex;flex-wrap:wrap;gap:6px 14px;list-style:none;margin:6px 0 0;padding:0}
`.trim();

interface Page {
  /** Same in every language, so each version can point at the others. */
  slug: string;
  title: string;
  description: string;
  body: string;
  jsonLd?: object;
}

function renderPage(code: LanguageCode, page: Page, t: Translate): string {
  const path = pagePath(code, page.slug);
  const alternates = LANGUAGES.map(
    (language) =>
      `<link rel="alternate" hreflang="${htmlLang(language.code)}" href="${absolute(pagePath(language.code, page.slug))}">`
  ).join('\n');
  const languageLinks = LANGUAGES.map((language) =>
    language.code === code
      ? `<li aria-current="page">${escapeHtml(language.label)}</li>`
      : `<li><a href="${href(pagePath(language.code, page.slug))}" lang="${htmlLang(language.code)}" hreflang="${htmlLang(language.code)}">${escapeHtml(language.label)}</a></li>`
  ).join('');
  // "<" must not end the script element early.
  const jsonLd = page.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(page.jsonLd).replace(/</g, '\\u003c')}</script>`
    : '';

  return `<!doctype html>
<html lang="${htmlLang(code)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.title)} | ${APP_NAME}</title>
<meta name="description" content="${escapeHtml(page.description)}">
<link rel="canonical" href="${absolute(path)}">
${alternates}
<link rel="alternate" hreflang="x-default" href="${absolute(pagePath(DEFAULT_LANGUAGE, page.slug))}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(page.title)}">
<meta property="og:description" content="${escapeHtml(page.description)}">
<meta property="og:url" content="${absolute(path)}">
<meta property="og:site_name" content="${APP_NAME}">
<style>${STYLE}</style>
${jsonLd}
</head>
<body>
<header><a href="${href(pagePath(code))}">${APP_NAME}</a></header>
<main>
${page.body}
<section class="card cta">
<h2>${escapeHtml(t('site.ctaTitle'))}</h2>
<p class="muted">${escapeHtml(t('site.ctaText'))}</p>
<a class="button" href="${escapeHtml(APP_URL)}">${escapeHtml(t('site.cta'))}</a>
</section>
</main>
<footer class="small muted">
<nav aria-label="${escapeHtml(t('site.languages'))}">${escapeHtml(t('site.languages'))}<ul>${languageLinks}</ul></nav>
</footer>
</body>
</html>
`;
}

type Translate = (key: TranslationKey, params?: TranslationParams) => string;

const stepHtml = (step: GuideStep, guide: BankGuide | null, code: LanguageCode, t: Translate): string =>
  stepParts(step, guide, code, t)
    .map((part) => (part.label ? `<strong>${escapeHtml(part.text)}</strong>` : escapeHtml(part.text)))
    .join('');

const stepText = (step: GuideStep, guide: BankGuide | null, code: LanguageCode, t: Translate): string =>
  stepParts(step, guide, code, t)
    .map((part) => part.text)
    .join('');

function guidePage(code: LanguageCode, guide: BankGuide | null, t: Translate, tag: string): Page {
  const bank = guide ? guideName(guide) : t('guide.otherBankTitle');
  const steps = guide ? guide.steps : GENERIC_STEPS;
  const title = guide ? t('site.guideTitle', { bank, format: guide.format }) : t('site.indexTitle');
  const description = guide
    ? t('site.guideDescription', { bank, format: guide.format })
    : `${t('guide.otherBankSub')}. ${t('guide.generic.step3')}`;
  const heading = guide ? title : `${title}: ${bank}`;
  const menuLanguage = guide ? labelLanguage(guide, code) : code;

  const pills = guide
    ? `<ul class="pills"><li>${escapeHtml(t(CHANNEL_KEYS[guide.channel]))}</li><li>${escapeHtml(
        t('guide.fileType', { format: guide.format })
      )}</li></ul>`
    : '';
  const notes = [guide?.note ? t(guide.note) : null, t('guide.shareTip')]
    .filter((note): note is string => note !== null)
    .map((note) => `<p class="muted">${escapeHtml(note)}</p>`)
    .join('\n');
  const footnotes = guide
    ? [
        menuLanguage !== code ? t('guide.labelsNote', { language: languageName(menuLanguage) }) : null,
        t('guide.checked', { bank, date: createFormatters(tag).monthYear(guide.verified) }),
      ]
        .filter((note): note is string => note !== null)
        .map(escapeHtml)
        .join(' ') +
      ` <a href="${escapeHtml(guide.sourceUrl)}" rel="nofollow noopener">${escapeHtml(t('site.source', { bank }))}</a>`
    : '';

  const body = `<p class="small"><a href="${href(pagePath(code))}">← ${escapeHtml(t('guide.allBanks'))}</a></p>
<h1>${escapeHtml(heading)}</h1>
${pills}
<section class="card">
<ol class="steps">
${steps.map((step) => `<li><span>${stepHtml(step, guide, code, t)}</span></li>`).join('\n')}
</ol>
</section>
${notes}
${footnotes ? `<p class="small muted">${footnotes}</p>` : ''}
<p class="muted">${escapeHtml(t('site.intro'))}</p>`;

  return {
    slug: guide ? guide.slug : OTHER_SLUG,
    title: heading,
    description,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: heading,
      description,
      inLanguage: htmlLang(code),
      step: steps.map((step, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        text: stepText(step, guide, code, t),
      })),
    },
  };
}

function indexPage(code: LanguageCode, t: Translate): Page {
  const banks = BANK_GUIDES.map(guideName).join(', ');
  const rows = BANK_GUIDES.map(
    (guide) =>
      `<li><a href="${href(pagePath(code, guide.slug))}">${escapeHtml(guideName(guide))}<span>${escapeHtml(
        t(CHANNEL_KEYS[guide.channel])
      )}</span></a></li>`
  ).join('\n');

  return {
    slug: '',
    title: t('site.indexTitle'),
    description: t('site.indexDescription', { banks }),
    body: `<h1>${escapeHtml(t('site.indexTitle'))}</h1>
<p class="muted">${escapeHtml(t('guide.subtitle'))}</p>
<section class="card">
<ul class="banks">
${rows}
<li><a href="${href(pagePath(code, OTHER_SLUG))}">${escapeHtml(t('guide.otherBank'))}<span>${escapeHtml(
      t('guide.otherBankSub')
    )}</span></a></li>
</ul>
</section>
<p class="muted">${escapeHtml(t('site.intro'))}</p>`,
  };
}

function write(path: string, content: string): void {
  const file = join(OUT_DIR, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

rmSync(OUT_DIR, { recursive: true, force: true });

const paths: string[] = [];
for (const { code, tag } of LANGUAGES) {
  const t: Translate = (key, params) => translate(code, key, params, tag);
  const pages = [indexPage(code, t), ...BANK_GUIDES.map((guide) => guidePage(code, guide, t, tag)), guidePage(code, null, t, tag)];
  for (const page of pages) {
    const path = pagePath(code, page.slug);
    write(join(path, 'index.html'), renderPage(code, page, t));
    paths.push(path);
  }
}

// The root sends people to their language where there is one, else to English.
const supported = JSON.stringify(LANGUAGES.map((language) => language.code));
write(
  'index.html',
  `<!doctype html>
<html lang="${DEFAULT_LANGUAGE}">
<head>
<meta charset="utf-8">
<title>${APP_NAME}</title>
<link rel="canonical" href="${absolute(pagePath(DEFAULT_LANGUAGE))}">
<script>var l=(navigator.language||'').slice(0,2).toLowerCase();location.replace('${BASE_PATH}/'+(${supported}.indexOf(l)===-1?'${DEFAULT_LANGUAGE}':l)+'/${SECTION}/');</script>
<noscript><meta http-equiv="refresh" content="0; url=${href(pagePath(DEFAULT_LANGUAGE))}"></noscript>
</head>
<body><a href="${href(pagePath(DEFAULT_LANGUAGE))}">${APP_NAME}</a></body>
</html>
`
);

write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((path) => `<url><loc>${absolute(path)}</loc></url>`).join('\n')}
</urlset>
`
);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${absolute('/sitemap.xml')}\n`);
// GitHub Pages: serve the files as they are.
write('.nojekyll', '');

console.log(`Wrote ${paths.length} pages to ${OUT_DIR}`);
