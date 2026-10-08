import { CHANGELOG, type ChangelogEntry } from '../../../src/content/site/changelog';
import { createFormatters } from '../../../src/i18n/format';
import { PATHS, escapeHtml, type Page, type SiteContext } from '../html';

export function changelogPage(ctx: SiteContext): Page {
  const { tag, s } = ctx;
  const format = createFormatters(tag);
  const released = (entry: ChangelogEntry): string => {
    if (!entry.date) return '';
    const [year, month, day] = entry.date.split('-').map(Number);
    const date = format.date(new Date(year, month - 1, day), { day: 'numeric', month: 'long', year: 'numeric' });
    return `<p class="small muted">${escapeHtml(date)}</p>`;
  };

  return {
    path: PATHS.changelog,
    title: s('changelog.title'),
    description: s('changelog.description'),
    body: `<h1>${escapeHtml(s('changelog.title'))}</h1>
${CHANGELOG.map(
  (entry) => `<section class="card entry">
<h2>${escapeHtml(s('changelog.version', { version: entry.version }))}</h2>
${released(entry)}
<ul class="list">
${entry.items.map((item) => `<li>${escapeHtml(s(item))}</li>`).join('\n')}
</ul>
</section>`
).join('\n')}`,
  };
}
