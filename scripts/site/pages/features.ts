import { BANK_GUIDES, guideName } from '../../../src/content/bankGuides';
import { FEATURES, featurePath, type Feature } from '../features';
import { PATHS, listOf, escapeHtml, href, pageLink, pagePath, screenshot, type Page, type SiteContext } from '../html';

const POINTS = ['p1', 'p2', 'p3'] as const;

function featurePage(ctx: SiteContext, feature: Feature): Page {
  const { code, t, s } = ctx;
  const params = {
    banks: listOf(ctx, BANK_GUIDES.map(guideName)),
    cautious: t('freedom.scenario.cautious'),
    expected: t('freedom.scenario.expected'),
    optimistic: t('freedom.scenario.optimistic'),
  };
  const name = feature.name(ctx);
  const title = s(`feature.${feature.copy}.title`);
  const summary = s(`feature.${feature.copy}.summary`);
  const points = POINTS.map(
    (point) =>
      `<div><h2>${escapeHtml(s(`feature.${feature.copy}.${point}Title`))}</h2><p class="muted">${escapeHtml(
        s(`feature.${feature.copy}.${point}Text`, params)
      )}</p></div>`
  ).join('\n');
  const others = FEATURES.filter((other) => other !== feature)
    .map((other) => `<li>${pageLink(ctx, featurePath(other), other.name(ctx))}</li>`)
    .join('');

  return {
    path: featurePath(feature),
    title: `${name}: ${title}`,
    description: summary,
    body: `<p class="small"><a href="${href(pagePath(code))}#features">← ${escapeHtml(s('nav.features'))}</a></p>
<ul class="pills"><li>${escapeHtml(name)}</li></ul>
<h1>${escapeHtml(title)}</h1>
<p class="lead">${escapeHtml(summary)}</p>
${screenshot(feature.slug, s('common.screenshotAlt', { screen: name }))}
<section class="card rows">
${points}
</section>
${feature.slug === 'import' ? `<p>${pageLink(ctx, PATHS.guides, s('home.banksLink'))}</p>` : ''}
${feature.disclaimer ? `<p class="small muted">${escapeHtml(t(feature.disclaimer))}</p>` : ''}
<ul class="pills">${others}</ul>`,
  };
}

export const featurePages = (ctx: SiteContext): Page[] => FEATURES.map((feature) => featurePage(ctx, feature));
