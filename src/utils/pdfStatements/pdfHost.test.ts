// Run with: npx tsx src/utils/pdfStatements/pdfHost.test.ts
//
// The page of the PDF reader (assets/pdf/pdfhost.html) must work without the network:
// everything inlined, requests forbidden, and built from the installed pdfjs-dist.
import fs from 'node:fs';
import path from 'node:path';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const root = path.join(__dirname, '..', '..', '..');
const html = fs.readFileSync(path.join(root, 'assets', 'pdf', 'pdfhost.html'), 'utf8');

check(
  'Content-Security-Policy forbids every request',
  html.includes(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'">`)
);
check('the policy comes before the first script', html.indexOf('Content-Security-Policy') < html.indexOf('<script'));

const tags = html.match(/<(script|link|img|iframe|object|embed|source|video|audio|base|form)\b[^>]*>/gi) ?? [];
check('only inline scripts', tags.every((tag) => /^<script>$/i.test(tag)), tags.filter((tag) => !/^<script>$/i.test(tag)).join(' '));
check('three scripts: pdf.js, its worker, the host', tags.length === 3, String(tags.length));
check('no worker file is fetched', !/workerSrc\s*=\s*["'`]/.test(html.slice(html.lastIndexOf('<script>'))));
check('no fetch, XHR or socket in the host script', !/fetch\(|XMLHttpRequest|WebSocket|importScripts/.test(html.slice(html.lastIndexOf('<script>'))));

// The URLs inside pdf.js are XML namespaces and licence notices, never something it loads.
const KNOWN_HOSTS = new Set(['www.w3.org', 'www.xfa.org', 'ns.adobe.com', 'www.apache.org', 'github.com']);
const hosts = new Set(Array.from(html.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g), (match) => match[1]));
const unknown = [...hosts].filter((host) => !KNOWN_HOSTS.has(host));
check('no URL of an unknown host', unknown.length === 0, unknown.join(', '));

const installed = path.join(root, 'node_modules', 'pdfjs-dist', 'package.json');
const pinned = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).dependencies['pdfjs-dist'];
const built = html.match(/pdfjs-dist ([\d.]+)"/)?.[1];
check('pdfjs-dist is pinned to an exact version', /^\d+\.\d+\.\d+$/.test(pinned), pinned);
check('the page was built from the pinned version (npm run pdfhost)', built === pinned, `${built} vs ${pinned}`);
if (fs.existsSync(installed)) {
  check('the installed version is the pinned one', JSON.parse(fs.readFileSync(installed, 'utf8')).version === pinned);
}
check('eval is off and fonts are not loaded', html.includes('isEvalSupported: false') && html.includes('disableFontFace: true'));

if (failures > 0) {
  console.log(`\n${failures} checks failed`);
  process.exit(1);
}
console.log('\nAll checks passed');
