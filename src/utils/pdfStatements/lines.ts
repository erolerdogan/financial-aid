import type { PdfItem } from './types';

export interface PdfWord {
  text: string;
  x0: number;
  x1: number;
  top: number;
  fontName: string;
}

export interface PdfLine {
  top: number;
  words: PdfWord[];
}

/**
 * The words of the upright items. Inside a run, a word's position is its share of the run's
 * width by character count; the start of the first word and the end of the last are exact.
 */
export function toWords(items: PdfItem[]): PdfWord[] {
  const words: PdfWord[] = [];
  for (const item of items) {
    if (item.rotated) continue;
    const perChar = item.str.length > 0 ? (item.x1 - item.x0) / item.str.length : 0;
    for (const match of item.str.matchAll(/\S+/g)) {
      const start = match.index ?? 0;
      words.push({
        text: match[0],
        x0: item.x0 + start * perChar,
        x1: item.x0 + (start + match[0].length) * perChar,
        top: item.top,
        fontName: item.fontName,
      });
    }
  }
  return words;
}

/** Words on the same height (within `tolerance` of the line's first word), left to right. */
export function groupLines(words: PdfWord[], tolerance = 3): PdfLine[] {
  const sorted = [...words].sort((a, b) => Math.round(a.top) - Math.round(b.top) || a.x0 - b.x0);
  const lines: PdfLine[] = [];
  for (const word of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.top - word.top) <= tolerance) last.words.push(word);
    else lines.push({ top: word.top, words: [word] });
  }
  for (const line of lines) line.words.sort((a, b) => a.x0 - b.x0);
  return lines;
}

export const lineText = (line: PdfLine): string => line.words.map((word) => word.text).join(' ');

export const linesText = (lines: PdfLine[]): string => lines.map(lineText).join('\n');

/** The first word sequence on the page that matches, as pdfplumber's `page.search` reports it. */
export function findOnLines(lines: PdfLine[], pattern: RegExp): { x0: number; top: number } | null {
  for (const line of lines) {
    const match = pattern.exec(lineText(line));
    if (!match) continue;
    let offset = 0;
    for (const word of line.words) {
      if (match.index < offset + word.text.length) return { x0: word.x0, top: line.top };
      offset += word.text.length + 1;
    }
  }
  return null;
}
