import { BANK_GUIDES, guideName } from '../../../src/content/bankGuides';
import { FAQ_GROUPS, faqParams } from '../../../src/content/faq';
import { PATHS, listOf, escapeHtml, htmlLang, type Page, type SiteContext } from '../html';

/** The questions the app shows under Settings → About, from `src/content/faq`. */
export function faqPage(ctx: SiteContext): Page {
  const { s, t } = ctx;
  const params = faqParams(t, listOf(ctx, BANK_GUIDES.map(guideName)));
  const groups = FAQ_GROUPS.map((group) => ({
    title: typeof group.title === 'string' ? s(group.title) : t(group.title.app),
    entries: group.items.map((item) => ({ question: s(item.q, params), answer: s(item.a, params) })),
  }));

  return {
    path: PATHS.faq,
    title: s('faq.title'),
    description: s('faq.description'),
    body: `<h1>${escapeHtml(s('faq.title'))}</h1>
${groups
  .map(
    (group) => `<h2 class="section">${escapeHtml(group.title)}</h2>
<section class="card rows">
${group.entries
  .map((entry) => `<div><h3>${escapeHtml(entry.question)}</h3><p class="muted">${escapeHtml(entry.answer)}</p></div>`)
  .join('\n')}
</section>`
  )
  .join('\n')}`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: htmlLang(ctx.code),
      mainEntity: groups
        .flatMap((group) => group.entries)
        .map((entry) => ({
          '@type': 'Question',
          name: entry.question,
          acceptedAnswer: { '@type': 'Answer', text: entry.answer },
        })),
    },
  };
}
