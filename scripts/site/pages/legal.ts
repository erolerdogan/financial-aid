import { LEGAL_DOCUMENTS, type LegalKey, type LegalPage } from '../../../src/content/legal';
import { createFormatters } from '../../../src/i18n/format';
import { PATHS, escapeHtml, externalLink, pageLink, withLink, type Page, type SiteContext } from '../html';

/** The host of the website; section 6 of the privacy policy names it. */
const HOST_PRIVACY_URL = 'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement';

const DESCRIPTIONS: Record<LegalPage, LegalKey> = {
  privacy: 'privacy.description',
  terms: 'terms.description',
  disclaimer: 'disclaimer.description',
};

/** The privacy policy, terms of use and disclaimer: the same documents the app shows (`src/app/legal.tsx`). */
export function legalPages(ctx: SiteContext): Page[] {
  const { tag, t, s } = ctx;
  // Where the words that fill a `{link}` lead.
  const links: Partial<Record<LegalKey, (label: string) => string>> = {
    'privacy.s6Link': (label) => externalLink(HOST_PRIVACY_URL, label),
    'legal.supportPage': (label) => pageLink(ctx, PATHS.support, label),
    'terms.s3Link': (label) => pageLink(ctx, PATHS.disclaimer, label),
    'terms.s4Link': (label) => pageLink(ctx, PATHS.privacy, label),
  };

  return (Object.keys(LEGAL_DOCUMENTS) as LegalPage[]).map((page) => {
    const document = LEGAL_DOCUMENTS[page];
    const [year, month, day] = document.updated.split('-').map(Number);
    const date = createFormatters(tag).date(new Date(year, month - 1, day), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const sections = document.sections.map((section) => {
      const title = typeof section.title === 'string' ? s(section.title) : t(section.title.app);
      const link = section.link ? (links[section.link]?.(s(section.link)) ?? escapeHtml(s(section.link))) : '';
      return `<div><h2>${escapeHtml(title)}</h2><p class="muted">${withLink(s(section.text), link)}</p></div>`;
    });

    return {
      path: PATHS[page],
      title: s(document.title),
      description: s(DESCRIPTIONS[page]),
      cta: false,
      body: `<h1>${escapeHtml(s(document.title))}</h1>
<p class="small muted">${escapeHtml(s('privacy.updated', { date }))}</p>
<p class="lead">${escapeHtml(s(document.summary))}</p>
<section class="card rows">
${sections.join('\n')}
</section>`,
    };
  });
}
