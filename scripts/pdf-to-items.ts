/**
 * Reads a PDF with the same pdf.js the app bundles and writes the `PdfPage[]` JSON the app's
 * WebView host produces, for tests of the statement parsers.
 *
 *   npx tsx scripts/pdf-to-items.ts statement.pdf            (JSON on stdout)
 *   npx tsx scripts/pdf-to-items.ts statement.pdf out.json
 *
 * Statements are private: never commit the output of a real one.
 */
import fs from 'node:fs';
import { toPdfPage } from '../src/utils/pdfStatements/pdfItems';
import type { PdfPage, RawPdfItem } from '../src/utils/pdfStatements/types';

// pdf.js warns on load that it cannot render without `canvas`; only text is read here.
const log = console.log;
console.log = () => {};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
console.log = log;

export async function readPdfItems(file: string): Promise<PdfPage[]> {
  const task = pdfjs.getDocument({
    data: new Uint8Array(fs.readFileSync(file)),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
    verbosity: 0,
  });
  const doc = await task.promise;

  try {
    const pages: PdfPage[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: RawPdfItem[] = [];
      for (const item of content.items) {
        if (typeof item.str !== 'string') continue;
        items.push({
          str: item.str,
          transform: item.transform,
          width: item.width,
          height: item.height,
          fontName: item.fontName,
        });
      }
      pages.push(toPdfPage({ width: viewport.width, height: viewport.height, transform: viewport.transform, items }));
      page.cleanup();
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}

if (require.main === module) {
  const [input, output] = process.argv.slice(2);
  if (!input) {
    console.error('Usage: npx tsx scripts/pdf-to-items.ts <statement.pdf> [out.json]');
    process.exit(1);
  }
  readPdfItems(input)
    .then((pages) => {
      const json = JSON.stringify(pages);
      if (output) {
        fs.writeFileSync(output, json);
        console.error(`Wrote ${pages.length} pages, ${pages.reduce((sum, p) => sum + p.items.length, 0)} items to ${output}`);
      } else {
        process.stdout.write(json);
      }
    })
    .catch((error) => {
      console.error(String(error?.message ?? error));
      process.exit(1);
    });
}
