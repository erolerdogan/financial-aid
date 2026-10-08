import { ISSUES_URL, SUPPORT_EMAIL } from '../config';
import { PATHS, escapeHtml, externalLink, href, pagePath, withLink, type Page, type SiteContext } from '../html';

export function supportPage(ctx: SiteContext): Page {
  const { code, s } = ctx;
  const card = (path: string, title: string, text: string): string =>
    `<a class="card" href="${href(pagePath(code, path))}"><h2>${escapeHtml(title)}</h2><p class="muted">${escapeHtml(text)}</p></a>`;
  const contact = SUPPORT_EMAIL
    ? withLink(s('support.contactEmail'), `<a href="mailto:${escapeHtml(SUPPORT_EMAIL)}">${escapeHtml(SUPPORT_EMAIL)}</a>`)
    : withLink(s('support.contactIssues'), externalLink(ISSUES_URL, 'GitHub'));

  return {
    path: PATHS.support,
    title: s('support.title'),
    description: s('support.description'),
    cta: false,
    body: `<h1>${escapeHtml(s('support.title'))}</h1>
<p class="lead">${escapeHtml(s('support.lead'))}</p>
<div class="grid">
${card(PATHS.guides, s('support.guidesTitle'), s('support.guidesText'))}
${card(PATHS.faq, s('support.faqTitle'), s('support.faqText'))}
</div>
<section class="card rows">
<div><h2>${escapeHtml(s('support.contactTitle'))}</h2><p>${contact}</p></div>
<div><p class="muted">${escapeHtml(s('support.noFiles'))}</p></div>
</section>`,
  };
}
