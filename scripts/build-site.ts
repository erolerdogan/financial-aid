// Renders the website: the pages about the app and the bank export guides.
// Run with: npx tsx scripts/build-site.ts   (output in site-dist/)
// Page builders are in scripts/site/pages, the copy in src/content/site, the guides in src/content/bankGuides.
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { siteTranslate } from '../src/content/site';
import { LANGUAGES, translate } from '../src/i18n';
import { APP_NAME, BASE_PATH, ORIGIN, OUT_DIR, ROOT_DIR, STATIC_DIR } from './site/config';
import { DEFAULT_LANGUAGE, absolute, href, pagePath, type Page, type SiteContext } from './site/html';
import { renderPage } from './site/layout';
import { changelogPage } from './site/pages/changelog';
import { faqPage } from './site/pages/faq';
import { featurePages } from './site/pages/features';
import { guidePages } from './site/pages/guides';
import { homePage } from './site/pages/home';
import { legalPages } from './site/pages/legal';
import { supportPage } from './site/pages/support';

function write(path: string, content: string): void {
  const file = join(OUT_DIR, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

// The app's own icon, so the site follows it when it changes.
copyFileSync(join(ROOT_DIR, 'assets', 'images', 'icon.png'), join(OUT_DIR, 'icon.png'));
copyFileSync(join(ROOT_DIR, 'assets', 'images', 'favicon.png'), join(OUT_DIR, 'favicon.png'));
if (existsSync(STATIC_DIR)) cpSync(STATIC_DIR, OUT_DIR, { recursive: true });

const paths: string[] = [];
const documents: { path: string; html: string }[] = [];
for (const { code, tag } of LANGUAGES) {
  const ctx: SiteContext = {
    code,
    tag,
    t: (key, params) => translate(code, key, params, tag),
    s: (key, params) => siteTranslate(code, key, params),
  };
  const pages: Page[] = [
    homePage(ctx),
    ...featurePages(ctx),
    ...guidePages(ctx),
    faqPage(ctx),
    supportPage(ctx),
    ...legalPages(ctx),
    changelogPage(ctx),
  ];
  for (const page of pages) {
    const path = pagePath(code, page.path);
    const html = renderPage(ctx, page);
    write(join(path, 'index.html'), html);
    paths.push(path);
    documents.push({ path, html });
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
<script>var l=(navigator.language||'').slice(0,2).toLowerCase();location.replace('${BASE_PATH}/'+(${supported}.indexOf(l)===-1?'${DEFAULT_LANGUAGE}':l)+'/');</script>
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

// Every link and image that points into the site must lead to a file that was written.
const broken: string[] = [];
for (const { path, html } of documents) {
  for (const [, url] of html.matchAll(/(?:href|src|srcset|content)="([^"]+)"/g)) {
    const local = url.startsWith(`${ORIGIN}${BASE_PATH}/`)
      ? url.slice(ORIGIN.length + BASE_PATH.length)
      : url.startsWith(`${BASE_PATH}/`) && !url.startsWith('//')
        ? url.slice(BASE_PATH.length)
        : null;
    if (local === null) continue;
    const target = local.split('#')[0];
    if (!existsSync(join(OUT_DIR, target.endsWith('/') ? `${target}index.html` : target))) {
      broken.push(`${path} → ${url}`);
    }
  }
}
if (broken.length > 0) {
  console.error(`Broken links:\n${broken.join('\n')}`);
  process.exit(1);
}

console.log(`Wrote ${paths.length} pages to ${OUT_DIR}`);
