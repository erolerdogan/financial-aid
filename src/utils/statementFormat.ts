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
