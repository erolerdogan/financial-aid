import type { PdfItem, PdfPage, RawPdfPage } from './types';

const round = (value: number): number => Math.round(value * 100) / 100;

/** `a` after `b`, both as PDF matrices `[a, b, c, d, e, f]`. */
function multiply(a: number[], b: number[]): number[] {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

/**
 * pdf.js text items in top-left coordinates. The app (WebView) and the Node script both pass raw
 * items through here, so a test fixture made in Node equals what the device produces.
 */
export function toPdfPage(raw: RawPdfPage): PdfPage {
  const items: PdfItem[] = [];

  for (const item of raw.items) {
    const full = String(item.str ?? '');
    const str = full.trim();
    if (!str) continue;

    const matrix = multiply(raw.transform, item.transform);
    const fontSize = Math.hypot(matrix[2], matrix[3]);
    // Spaces at either end are part of the run's width; take their share off.
    const perChar = full.length > 0 ? item.width / full.length : 0;
    const lead = full.length - full.trimStart().length;
    const trail = full.length - full.trimEnd().length;

    items.push({
      str,
      x0: round(matrix[4] + lead * perChar),
      x1: round(matrix[4] + item.width - trail * perChar),
      top: round(matrix[5] - fontSize),
      bottom: round(matrix[5]),
      fontName: item.fontName,
      fontSize: round(fontSize),
      ...(Math.abs(matrix[1]) > 0.01 || matrix[0] < 0 ? { rotated: true } : {}),
    });
  }

  return { width: round(raw.width), height: round(raw.height), items };
}
