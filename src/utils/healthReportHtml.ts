// Printable monthly report. Pure: the screen passes text that is already translated and formatted.

export interface ReportSection {
  heading: string;
  /** Column titles; left out for two-column label / value sections. */
  columns?: string[];
  rows: string[][];
  /** Shown instead of the table when there are no rows. */
  empty?: string;
}

export interface ReportHtmlData {
  title: string;
  /** Month and profile, e.g. "September 2026 · Personal". */
  subtitle: string;
  scoreLabel: string;
  /** "72" or "–". */
  score: string;
  scoreNote: string;
  improvement: string;
  sections: ReportSection[];
  disclaimer: string;
  footer: string;
  /** BCP 47 tag for the `lang` attribute. */
  lang: string;
}

export const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderSection = (section: ReportSection): string => {
  const heading = `<h2>${escapeHtml(section.heading)}</h2>`;
  if (section.rows.length === 0) {
    return `<section>${heading}<p class="empty">${escapeHtml(section.empty ?? '')}</p></section>`;
  }

  const head = section.columns
    ? `<thead><tr>${section.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>`
    : '';
  const body = section.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');
  return `<section>${heading}<table>${head}<tbody>${body}</tbody></table></section>`;
};

// No scripts, no remote fonts or images: the PDF is made on the device from this string alone.
const STYLE = `
  @page { margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Roboto, Arial, sans-serif; color: #14172b; font-size: 11pt; line-height: 1.4; margin: 0; }
  h1 { font-size: 20pt; margin: 0; }
  .subtitle { color: #6b7088; margin: 2pt 0 14pt; }
  .score { display: flex; align-items: center; gap: 14pt; border: 1px solid #d9dce8; border-radius: 8pt; padding: 10pt 14pt; margin-bottom: 6pt; }
  .score .value { font-size: 30pt; font-weight: 700; }
  .score .label { font-weight: 600; }
  .score .note, .improvement { color: #6b7088; }
  h2 { font-size: 12pt; margin: 16pt 0 5pt; }
  section { page-break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9pt; color: #6b7088; font-weight: 600; border-bottom: 1px solid #d9dce8; padding: 4pt 6pt 4pt 0; }
  td { border-bottom: 1px solid #eceef5; padding: 5pt 6pt 5pt 0; vertical-align: top; }
  td:not(:first-child), th:not(:first-child) { text-align: right; }
  .empty { color: #6b7088; margin: 0; }
  footer { margin-top: 20pt; font-size: 9pt; color: #6b7088; }
`;

export function buildHealthReportHtml(data: ReportHtmlData): string {
  return `<!DOCTYPE html>
<html lang="${escapeHtml(data.lang)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(data.title)}</title>
<style>${STYLE}</style>
</head>
<body>
<h1>${escapeHtml(data.title)}</h1>
<p class="subtitle">${escapeHtml(data.subtitle)}</p>
<div class="score">
  <div class="value">${escapeHtml(data.score)}</div>
  <div>
    <div class="label">${escapeHtml(data.scoreLabel)}</div>
    <div class="note">${escapeHtml(data.scoreNote)}</div>
    <div class="improvement">${escapeHtml(data.improvement)}</div>
  </div>
</div>
${data.sections.map(renderSection).join('\n')}
<footer>
  <div>${escapeHtml(data.disclaimer)}</div>
  <div>${escapeHtml(data.footer)}</div>
</footer>
</body>
</html>`;
}
