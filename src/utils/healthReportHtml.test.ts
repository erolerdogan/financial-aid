// Run with: npx tsx src/utils/healthReportHtml.test.ts
import { buildHealthReportHtml, escapeHtml, type ReportHtmlData } from './healthReportHtml';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const data: ReportHtmlData = {
  title: 'Monthly report',
  subtitle: 'September 2026 · Personal',
  scoreLabel: 'Health score',
  score: '72',
  scoreNote: '4 higher than August 2026',
  improvement: 'Raise savings to 15% of income (score +9)',
  sections: [
    { heading: 'Summary', rows: [['Net income', '€4,000'], ['Expenses', '€2,400']] },
    {
      heading: 'Categories',
      columns: ['Category', 'Amount', '% of income', 'vs your normal', 'Status'],
      rows: [['Housing', '€1,200', '30%', '0%', 'In range']],
    },
    { heading: 'Debts', rows: [], empty: 'No debts tracked.' },
  ],
  disclaimer: 'Guidance, not financial advice.',
  footer: 'Created on this device with Financial Aid.',
  lang: 'en-US',
};

const html = buildHealthReportHtml(data);

check('escape: all five characters', escapeHtml(`<a href="x">Tom & 'Jerry'</a>`) === '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;');
check('starts with a doctype', html.startsWith('<!DOCTYPE html>'));
check('language attribute', html.includes('<html lang="en-US">'));
check('title and subtitle', html.includes('<h1>Monthly report</h1>') && html.includes('September 2026 · Personal'));
check('score block', html.includes('<div class="value">72</div>') && html.includes('4 higher than August 2026'));
check('improvement line', html.includes('Raise savings to 15% of income (score +9)'));
check('one heading per section', (html.match(/<h2>/g) ?? []).length === 3);
check('column titles', html.includes('<th>% of income</th>'));
check('label / value section has no header row', (html.match(/<thead>/g) ?? []).length === 1);
check('table cells', html.includes('<td>Housing</td><td>€1,200</td>'));
check('empty section shows its message', html.includes('<p class="empty">No debts tracked.</p>'));
check('disclaimer and footer', html.includes('Guidance, not financial advice.') && html.includes('Created on this device'));

// Merchant and category names come from bank files: they must never become markup.
const hostile = buildHealthReportHtml({
  ...data,
  title: '<script>alert(1)</script>',
  sections: [{ heading: 'Alerts', rows: [['<img src=x onerror=alert(1)>', 'New "charge" & more']] }],
});
check('markup in text is escaped', !hostile.includes('<script>alert(1)') && !hostile.includes('<img'));
check('escaped text is still there', hostile.includes('&lt;img src=x onerror=alert(1)&gt;') && hostile.includes('New &quot;charge&quot; &amp; more'));

// Made on the device: nothing in the page may load from the network.
check('no script tags', !/<script/i.test(html));
check('no remote resources', !/https?:\/\//i.test(html) && !/src=/i.test(html) && !/@import/i.test(html) && !/url\(/i.test(html));

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
if (failures > 0) process.exit(1);
