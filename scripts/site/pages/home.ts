import { BANK_GUIDES, guideName } from '../../../src/content/bankGuides';
import type { SiteKey } from '../../../src/content/site';
import { APP_NAME } from '../config';
import { FEATURES, featurePath } from '../features';
import { PATHS, listOf, downloadButtons, escapeHtml, href, htmlLang, pageLink, pagePath, screenshot, type Page, type SiteContext } from '../html';
import { guidePath } from './guides';

const POINTS: [SiteKey, SiteKey][] = [
  ['home.point1Title', 'home.point1Text'],
  ['home.point2Title', 'home.point2Text'],
  ['home.point3Title', 'home.point3Text'],
];

const MORE: SiteKey[] = ['home.more1', 'home.more2', 'home.more3', 'home.more4', 'home.more5', 'home.more6'];

export function homePage(ctx: SiteContext): Page {
  const { code, s } = ctx;
  const banks = listOf(ctx, BANK_GUIDES.map(guideName));
  const shot = screenshot('home', s('common.screenshotAlt', { screen: s('home.screen') }));

  const points = POINTS.map(
    ([title, text]) =>
      `<div class="card"><h2>${escapeHtml(s(title))}</h2><p class="muted">${escapeHtml(s(text))}</p></div>`
  ).join('\n');
  const features = FEATURES.map(
    (feature) =>
      `<a class="card" href="${href(pagePath(code, featurePath(feature)))}"><h2>${escapeHtml(feature.name(ctx))}</h2><p class="muted">${escapeHtml(
        s(`feature.${feature.copy}.summary`)
      )}</p><span class="more">${escapeHtml(s('common.learnMore'))}</span></a>`
  ).join('\n');
  const bankLinks = BANK_GUIDES.map(
    (guide) => `<li>${pageLink(ctx, guidePath(guide.slug), guideName(guide))}</li>`
  ).join('');

  return {
    path: PATHS.home,
    title: s('home.title'),
    description: s('home.description'),
    wide: true,
    body: `<section class="hero${shot ? ' split' : ''}">
<div>
<h1>${escapeHtml(s('home.heading'))}</h1>
<p class="lead">${escapeHtml(s('home.lead'))}</p>
${downloadButtons(ctx)}
</div>
${shot}
</section>
<div class="grid">
${points}
</div>
<h2 class="section" id="features">${escapeHtml(s('home.featuresTitle'))}</h2>
<div class="grid">
${features}
</div>
<h2 class="section">${escapeHtml(s('home.banksTitle'))}</h2>
<p class="muted">${escapeHtml(s('home.banksText', { banks }))}</p>
<ul class="pills">${bankLinks}</ul>
<p>${pageLink(ctx, PATHS.guides, s('home.banksLink'))}</p>
<h2 class="section">${escapeHtml(s('home.moreTitle'))}</h2>
<section class="card">
<ul class="list">
${MORE.map((key) => `<li>${escapeHtml(s(key))}</li>`).join('\n')}
</ul>
</section>`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: APP_NAME,
      description: s('home.description'),
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'iOS, Android',
      inLanguage: htmlLang(code),
    },
  };
}
