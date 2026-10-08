// The document around every page: head tags, header navigation, download block and footer.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { LANGUAGES } from '../../src/i18n';
import { APP_NAME, STATIC_DIR } from './config';
import { FEATURES, featurePath } from './features';
import {
  DEFAULT_LANGUAGE,
  PATHS,
  absolute,
  downloadButtons,
  escapeHtml,
  href,
  htmlLang,
  pageLink,
  pagePath,
  type Page,
  type SiteContext,
} from './html';

const STYLE = `
:root{--bg:#f5f6f8;--card:#fff;--text:#14171a;--muted:#5f6b7a;--border:#e3e6ea;--accent:#1570d1;--tint:#e6f1fc}
@media (prefers-color-scheme:dark){:root{--bg:#0f1114;--card:#1a1d21;--text:#f2f4f6;--muted:#9aa5b1;--border:#2b3036;--accent:#5aa9f5;--tint:#16283b}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main,header,footer{max-width:680px;margin:0 auto;padding:0 16px}
body.wide main,body.wide header,body.wide footer{max-width:960px}
header{padding-top:20px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px 16px}
header a{font-weight:700;color:var(--text);text-decoration:none}
.brand{display:flex;align-items:center;gap:8px}
.brand img{width:28px;height:28px;border-radius:7px}
header nav{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:.9rem}
header nav a{font-weight:500;color:var(--muted)}
header nav a[aria-current]{color:var(--text)}
a{color:var(--accent)}
h1{font-size:1.9rem;line-height:1.2;letter-spacing:-.02em;margin:28px 0 10px;text-wrap:balance}
h2,h3{font-size:1.15rem;margin:0 0 6px}
h2.section{font-size:1.4rem;letter-spacing:-.01em;margin:40px 0 4px}
p{margin:0 0 14px}
.muted{color:var(--muted)}
.small{font-size:.85rem}
main>p.small:first-child{margin:18px 0 0}
.lead{font-size:1.1rem;color:var(--muted)}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:4px 18px;margin:18px 0}
.pills{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 4px;padding:0;list-style:none}
.pills li{background:var(--tint);color:var(--accent);font-size:.8rem;font-weight:600;padding:4px 10px;border-radius:12px}
.pills a{text-decoration:none}
ol.steps{list-style:none;margin:0;padding:0;counter-reset:step}
ol.steps li{counter-increment:step;display:flex;gap:12px;padding:14px 0;border-top:1px solid var(--border)}
ol.steps li:first-child{border-top:0}
ol.steps li::before{content:counter(step);flex:none;width:26px;height:26px;border-radius:13px;background:var(--tint);color:var(--accent);font-size:.8rem;font-weight:700;display:flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums}
ul.banks{list-style:none;margin:0;padding:0}
ul.banks li{border-top:1px solid var(--border)}
ul.banks li:first-child{border-top:0}
ul.banks a{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 0;text-decoration:none;color:var(--text);font-weight:600}
ul.banks span{color:var(--muted);font-weight:400;font-size:.85rem;text-align:right}
ul.list{margin:0;padding:12px 0 12px 20px}
ul.list li{padding:3px 0}
.rows>div{padding:14px 0;border-top:1px solid var(--border)}
.rows>div:first-child{border-top:0}
.rows p{margin:0}
.hero{display:grid;gap:24px;align-items:center;margin:20px 0 8px}
.hero h1{font-size:2.3rem}
@media (min-width:760px){.hero.split{grid-template-columns:1.2fr .8fr}}
.shot{display:block;margin:18px 0}
.shot img{display:block;margin:0 auto;width:auto;max-width:100%;height:auto;max-height:560px;border-radius:24px;border:1px solid var(--border)}
.grid{display:grid;gap:14px;margin:18px 0;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.grid .card{margin:0;padding:16px 18px}
.grid .card p{margin:0}
a.card{display:block;text-decoration:none;color:var(--text)}
a.card .more{display:block;margin-top:10px;color:var(--accent);font-weight:600;font-size:.9rem}
.cta{padding:18px}
.entry{padding:16px 18px 4px}
.buttons{display:flex;flex-wrap:wrap;gap:10px;margin:0}
.button{display:inline-block;background:var(--accent);color:#fff;font-weight:700;text-decoration:none;padding:11px 18px;border-radius:12px}
@media (prefers-color-scheme:dark){.button{color:#0f1114}}
footer{margin-top:28px;padding-top:20px;padding-bottom:40px;border-top:1px solid var(--border)}
footer .cols{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-bottom:18px}
footer ul{display:flex;flex-wrap:wrap;gap:6px 14px;list-style:none;margin:6px 0 0;padding:0}
`.trim();

const NAV: { path: string; label: (ctx: SiteContext) => string }[] = [
  { path: PATHS.guides, label: (ctx) => ctx.s('nav.guides') },
  { path: PATHS.faq, label: (ctx) => ctx.s('nav.faq') },
  { path: PATHS.support, label: (ctx) => ctx.s('nav.support') },
];

const FOOTER_NAV: typeof NAV = [
  ...NAV,
  { path: PATHS.privacy, label: (ctx) => ctx.s('nav.privacy') },
  { path: PATHS.terms, label: (ctx) => ctx.s('nav.terms') },
  { path: PATHS.disclaimer, label: (ctx) => ctx.s('nav.disclaimer') },
  { path: PATHS.changelog, label: (ctx) => ctx.s('nav.changelog') },
];

/** Social preview: `site/og.png` once it exists, the app icon until then. */
const SHARE_IMAGE = existsSync(join(STATIC_DIR, 'og.png')) ? '/og.png' : '/icon.png';

export function renderPage(ctx: SiteContext, page: Page): string {
  const { code, t, s } = ctx;
  const path = pagePath(code, page.path);
  const alternates = LANGUAGES.map(
    (language) =>
      `<link rel="alternate" hreflang="${htmlLang(language.code)}" href="${absolute(pagePath(language.code, page.path))}">`
  ).join('\n');
  const languageLinks = LANGUAGES.map((language) =>
    language.code === code
      ? `<li aria-current="page">${escapeHtml(language.label)}</li>`
      : `<li><a href="${href(pagePath(language.code, page.path))}" lang="${htmlLang(language.code)}" hreflang="${htmlLang(language.code)}">${escapeHtml(language.label)}</a></li>`
  ).join('');
  // "<" must not end the script element early.
  const jsonLd = page.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(page.jsonLd).replace(/</g, '\\u003c')}</script>`
    : '';

  const navLink = (item: (typeof NAV)[number]): string =>
    `<a href="${href(pagePath(code, item.path))}"${page.path.startsWith(item.path) ? ' aria-current="page"' : ''}>${escapeHtml(item.label(ctx))}</a>`;
  const featuresLink = `<a href="${href(pagePath(code))}#features"${page.path.startsWith(PATHS.features) ? ' aria-current="page"' : ''}>${escapeHtml(s('nav.features'))}</a>`;
  const cta =
    page.cta === false
      ? ''
      : `<section class="card cta">
<h2>${escapeHtml(t('site.ctaTitle'))}</h2>
<p class="muted">${escapeHtml(t('site.ctaText'))}</p>
${downloadButtons(ctx)}
</section>`;

  return `<!doctype html>
<html lang="${htmlLang(code)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.title)} | ${APP_NAME}</title>
<meta name="description" content="${escapeHtml(page.description)}">
<link rel="canonical" href="${absolute(path)}">
${alternates}
<link rel="alternate" hreflang="x-default" href="${absolute(pagePath(DEFAULT_LANGUAGE, page.path))}">
<link rel="icon" href="${href('/favicon.png')}">
<link rel="apple-touch-icon" href="${href('/icon.png')}">
<meta property="og:type" content="${page.article ? 'article' : 'website'}">
<meta property="og:title" content="${escapeHtml(page.title)}">
<meta property="og:description" content="${escapeHtml(page.description)}">
<meta property="og:url" content="${absolute(path)}">
<meta property="og:site_name" content="${APP_NAME}">
<meta property="og:image" content="${absolute(SHARE_IMAGE)}">
<meta name="twitter:card" content="${SHARE_IMAGE === '/og.png' ? 'summary_large_image' : 'summary'}">
<style>${STYLE}</style>
${jsonLd}
</head>
<body${page.wide ? ' class="wide"' : ''}>
<header>
<a class="brand" href="${href(pagePath(code))}"><img src="${href('/icon.png')}" alt="" width="28" height="28">${APP_NAME}</a>
<nav aria-label="${escapeHtml(s('nav.label'))}">${featuresLink}${NAV.map(navLink).join('')}</nav>
</header>
<main>
${page.body}
${cta}
</main>
<footer class="small muted">
<div class="cols">
<nav aria-label="${escapeHtml(s('nav.features'))}"><strong>${escapeHtml(s('nav.features'))}</strong><ul>${FEATURES.map(
    (feature) => `<li>${pageLink(ctx, featurePath(feature), feature.name(ctx))}</li>`
  ).join('')}</ul></nav>
<nav aria-label="${APP_NAME}"><strong>${APP_NAME}</strong><ul>${FOOTER_NAV.map(
    (item) => `<li>${pageLink(ctx, item.path, item.label(ctx))}</li>`
  ).join('')}</ul></nav>
<nav aria-label="${escapeHtml(t('site.languages'))}"><strong>${escapeHtml(t('site.languages'))}</strong><ul>${languageLinks}</ul></nav>
</div>
<p>${escapeHtml(s('footer.tagline'))} ${escapeHtml(s('footer.disclaimer'))}</p>
</footer>
</body>
</html>
`;
}
