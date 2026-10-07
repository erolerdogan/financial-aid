import type { TranslationKey } from '@/i18n';

export class UnsupportedFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedFileError';
    Object.setPrototypeOf(this, UnsupportedFileError.prototype);
  }
}

/** Bytes of the file that are enough to recognise its format. */
export const STATEMENT_HEAD_BYTES = 8;

const PDF_MESSAGE =
  "PDF statements can't be imported. Download the statement from your bank as CSV or Excel and import that file.";
const IMAGE_MESSAGE =
  "Photos and screenshots can't be imported. Download the statement from your bank as CSV or Excel and import that file.";
const BANK_FORMAT_MESSAGE =
  "This bank format isn't supported yet. Choose CSV or Excel when you export from your bank.";
const GENERIC_MESSAGE =
  "This file isn't a statement the app can read. Import a CSV or Excel (.xlsx, .xls) file.";

/** Translation key for each message above, for the alert shown to the user. */
export const UNSUPPORTED_MESSAGE_KEYS: Record<string, TranslationKey> = {
  [PDF_MESSAGE]: 'import.unsupported.pdf',
  [IMAGE_MESSAGE]: 'import.unsupported.image',
  [BANK_FORMAT_MESSAGE]: 'import.unsupported.bankFormat',
  [GENERIC_MESSAGE]: 'import.unsupported.generic',
};

const SPREADSHEET_EXTENSIONS = new Set(['xlsx', 'xls']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'heic', 'heif', 'gif', 'webp']);
const BANK_FORMAT_EXTENSIONS = new Set(['xml', '940', 'sta', 'mt940', 'swi', 'ofx', 'qfx', 'qif', 'json']);
const DOCUMENT_EXTENSIONS = new Set(['doc', 'docx', 'pages', 'rtf', 'numbers', 'ods', 'zip']);

const extensionOf = (fileName: string): string => {
  const name = (fileName || '').trim().toLowerCase();
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1);
};

const startsWith = (head: Uint8Array, bytes: number[], offset = 0): boolean =>
  head.length >= offset + bytes.length && bytes.every((byte, i) => head[offset + i] === byte);

const isPdf = (head: Uint8Array) => startsWith(head, [0x25, 0x50, 0x44, 0x46]); // %PDF

const isImage = (head: Uint8Array) =>
  startsWith(head, [0xff, 0xd8, 0xff]) || // JPEG
  startsWith(head, [0x89, 0x50, 0x4e, 0x47]) || // PNG
  startsWith(head, [0x47, 0x49, 0x46, 0x38]) || // GIF8
  startsWith(head, [0x66, 0x74, 0x79, 0x70], 4); // ftyp (HEIC)

// Zip (xlsx, but also docx, numbers, ods) or OLE (xls, but also doc).
const isContainer = (head: Uint8Array) =>
  startsWith(head, [0x50, 0x4b, 0x03, 0x04]) || startsWith(head, [0xd0, 0xcf, 0x11, 0xe0]);

/** Excel files, including ones picked without an extension. */
export function isSpreadsheetFile(fileName: string, head: Uint8Array): boolean {
  const extension = extensionOf(fileName);
  return SPREADSHEET_EXTENSIONS.has(extension) || (extension === '' && isContainer(head));
}

/**
 * The message to show when the picked file cannot be a statement, or `null` when it should be parsed.
 * The first bytes are checked before the extension, so a renamed PDF is still caught.
 */
export function describeUnsupportedStatement(fileName: string, head: Uint8Array): string | null {
  const extension = extensionOf(fileName);

  if (isPdf(head) || extension === 'pdf') return PDF_MESSAGE;
  if (isImage(head) || IMAGE_EXTENSIONS.has(extension)) return IMAGE_MESSAGE;
  if (isSpreadsheetFile(fileName, head)) return null;
  if (BANK_FORMAT_EXTENSIONS.has(extension)) return BANK_FORMAT_MESSAGE;
  if (DOCUMENT_EXTENSIONS.has(extension) || isContainer(head)) return GENERIC_MESSAGE;

  return null;
}

// Windows-1252 differs from Latin-1 only in 0x80-0x9F.
const WINDOWS_1252_HIGH = [
  0x20ac, 0x81, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x8d,
  0x017d, 0x8f, 0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x9d, 0x017e, 0x0178,
];

const CHUNK = 8192;

function fromCodeUnits(length: number, unitAt: (index: number) => number): string {
  let out = '';
  for (let start = 0; start < length; start += CHUNK) {
    const units: number[] = [];
    for (let i = start; i < Math.min(length, start + CHUNK); i++) units.push(unitAt(i));
    out += String.fromCharCode(...units);
  }
  return out;
}

/** `null` when the bytes are not valid UTF-8. */
function decodeUtf8(bytes: Uint8Array, offset: number): string | null {
  const units: number[] = [];
  for (let i = offset; i < bytes.length; ) {
    const lead = bytes[i++];
    let extra: number;
    let point: number;
    if (lead < 0x80) [extra, point] = [0, lead];
    else if (lead >= 0xc2 && lead <= 0xdf) [extra, point] = [1, lead & 0x1f];
    else if (lead >= 0xe0 && lead <= 0xef) [extra, point] = [2, lead & 0x0f];
    else if (lead >= 0xf0 && lead <= 0xf4) [extra, point] = [3, lead & 0x07];
    else return null;

    for (; extra > 0; extra--) {
      const next = bytes[i++];
      if (next === undefined || (next & 0xc0) !== 0x80) return null;
      point = (point << 6) | (next & 0x3f);
    }

    if (point > 0xffff) {
      point -= 0x10000;
      units.push(0xd800 + (point >> 10), 0xdc00 + (point & 0x3ff));
    } else {
      units.push(point);
    }
  }
  return fromCodeUnits(units.length, (i) => units[i]);
}

/**
 * Text of a statement file. Banks export UTF-8 (with or without a byte order mark), UTF-16 or
 * Windows-1252; the last is assumed when the bytes are not valid UTF-8.
 */
export function decodeStatementText(bytes: Uint8Array): string {
  if (startsWith(bytes, [0xef, 0xbb, 0xbf])) {
    const utf8 = decodeUtf8(bytes, 3);
    if (utf8 !== null) return utf8;
  }

  const littleEndian = startsWith(bytes, [0xff, 0xfe]);
  if (littleEndian || startsWith(bytes, [0xfe, 0xff])) {
    return fromCodeUnits(Math.floor((bytes.length - 2) / 2), (i) => {
      const [a, b] = [bytes[2 + i * 2], bytes[3 + i * 2]];
      return littleEndian ? a | (b << 8) : (a << 8) | b;
    });
  }

  return (
    decodeUtf8(bytes, 0) ??
    fromCodeUnits(bytes.length, (i) => {
      const byte = bytes[i];
      return byte >= 0x80 && byte <= 0x9f ? WINDOWS_1252_HIGH[byte - 0x80] : byte;
    })
  );
}
