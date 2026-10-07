// Run with: npx tsx src/utils/statementFormat.test.ts
import {
  decodeStatementText,
  describeUnsupportedStatement,
  isSpreadsheetFile,
  UnsupportedFileError,
} from './statementFormat';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new Uint8Array(Array.from(value, (c) => c.charCodeAt(0)));

const PDF = text('%PDF-1.7');
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46);
const HEIC = bytes(0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70);
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00);
const OLE = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
const CSV = text('Date,Amo');
const XML = text('<?xml ve');
const EMPTY = bytes();

const rejects = (label: string, fileName: string, head: Uint8Array, fragment: string): void => {
  const message = describeUnsupportedStatement(fileName, head);
  check(label, message !== null && message.includes(fragment), `got ${JSON.stringify(message)}`);
};

const accepts = (label: string, fileName: string, head: Uint8Array, spreadsheet: boolean): void => {
  const message = describeUnsupportedStatement(fileName, head);
  check(label, message === null, `got ${JSON.stringify(message)}`);
  check(`${label}: spreadsheet route`, isSpreadsheetFile(fileName, head) === spreadsheet);
};

rejects('pdf by extension', 'statement.pdf', PDF, 'PDF statements');
rejects('pdf extension, unreadable head', 'statement.PDF', EMPTY, 'PDF statements');
rejects('pdf renamed to csv', 'statement.csv', PDF, 'PDF statements');
rejects('pdf renamed to xlsx', 'statement.xlsx', PDF, 'PDF statements');
rejects('pdf without extension', 'statement', PDF, 'PDF statements');

rejects('png screenshot', 'IMG_0012.png', PNG, 'Photos and screenshots');
rejects('jpeg named csv', 'export.csv', JPEG, 'Photos and screenshots');
rejects('heic photo', 'IMG_0013.HEIC', HEIC, 'Photos and screenshots');
rejects('image extension, unreadable head', 'scan.jpeg', EMPTY, 'Photos and screenshots');

rejects('camt xml', 'camt053.xml', XML, 'bank format');
rejects('mt940', 'statement.940', text(':20:STAR'), 'bank format');
rejects('ofx', 'export.ofx', text('OFXHEADE'), 'bank format');
rejects('json', 'export.json', text('{"transa'), 'bank format');

rejects('docx', 'letter.docx', ZIP, "isn't a statement");
rejects('numbers', 'budget.numbers', ZIP, "isn't a statement");
rejects('word doc', 'letter.doc', OLE, "isn't a statement");
rejects('zip named csv', 'export.csv', ZIP, "isn't a statement");
rejects('zip archive', 'statements.zip', ZIP, "isn't a statement");

accepts('xlsx', 'statement.xlsx', ZIP, true);
accepts('xls', 'statement.XLS', OLE, true);
accepts('xlsx without extension', 'statement', ZIP, true);
accepts('csv', 'statement.csv', CSV, false);
accepts('tab separated txt', 'TXT240101.TXT', text('12345678'), false);
accepts('tsv', 'export.tsv', CSV, false);
accepts('text without extension', 'export', CSV, false);
accepts('unknown text extension', 'export.dat', CSV, false);
accepts('dotted name', 'ing.2024.01.csv', CSV, false);
accepts('empty csv', 'empty.csv', EMPTY, false);

const error = new UnsupportedFileError('nope');
check('error is an UnsupportedFileError', error instanceof UnsupportedFileError);
check('error is an Error', error instanceof Error && error.message === 'nope');

const decodes = (label: string, input: Uint8Array, expected: string): void => {
  const actual = decodeStatementText(input);
  check(`decode ${label}`, actual === expected, `got ${JSON.stringify(actual)}`);
};

decodes('ascii', text('Date,Amount'), 'Date,Amount');
decodes('utf-8', bytes(0x69, 0x6e, 0x69, 0x74, 0x69, 0xc3, 0xab, 0x72, 0x65, 0x6e, 0x64, 0x65), 'initiërende');
decodes('utf-8 with byte order mark', bytes(0xef, 0xbb, 0xbf, 0x44, 0x61, 0x74, 0x75, 0x6d), 'Datum');
decodes('utf-8 euro and emoji', bytes(0xe2, 0x82, 0xac, 0x20, 0xf0, 0x9f, 0x92, 0xb6), '€ 💶');
decodes('windows-1252', bytes(0x45, 0x6d, 0x70, 0x66, 0xe4, 0x6e, 0x67, 0x65, 0x72, 0x20, 0x80), 'Empfänger €');
decodes('utf-16 little endian', bytes(0xff, 0xfe, 0x44, 0x00, 0xeb, 0x00), 'Dë');
decodes('utf-16 big endian', bytes(0xfe, 0xff, 0x00, 0x44, 0x00, 0xeb), 'Dë');
decodes('empty', EMPTY, '');
decodes('long text', text('a,b\n'.repeat(5000)), 'a,b\n'.repeat(5000));

console.log(failures === 0 ? '\nAll tests passed.' : `\n${failures} test(s) failed.`);
if (failures > 0) process.exit(1);
