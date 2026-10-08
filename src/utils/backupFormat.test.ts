// Run with: npx tsx src/utils/backupFormat.test.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import {
  BackupError,
  DEFAULT_KDF,
  deriveKey,
  encodeHeader,
  encryptedBody,
  HEADER_LENGTH,
  isEncryptedBackup,
  joinBackup,
  NONCE_LENGTH,
  parseHeader,
  SALT_LENGTH,
  TAG_LENGTH,
} from './backupFormat';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

const errorCode = (run: () => unknown): string | null => {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof BackupError ? error.code : 'OTHER';
  }
};

// Same layout as the service, with Node's AES-256-GCM standing in for expo-crypto. A low cost keeps the test fast.
const TEST_KDF = { logN: 10, r: 8, p: 1 };

async function seal(plain: Uint8Array, password: string): Promise<Uint8Array> {
  const salt = new Uint8Array(randomBytes(SALT_LENGTH));
  const nonce = new Uint8Array(randomBytes(NONCE_LENGTH));
  const header = encodeHeader({ ...TEST_KDF, salt, nonce });
  const cipher = createCipheriv('aes-256-gcm', await deriveKey(password, { ...TEST_KDF, salt }), nonce);
  cipher.setAAD(header);
  const body = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
  return joinBackup(header, new Uint8Array(body));
}

async function open(bytes: Uint8Array, password: string): Promise<Uint8Array | null> {
  const header = parseHeader(bytes);
  if (!header) return null;
  const body = encryptedBody(bytes);
  const decipher = createDecipheriv('aes-256-gcm', await deriveKey(password, header), header.nonce);
  decipher.setAAD(encodeHeader(header));
  decipher.setAuthTag(body.subarray(body.length - TAG_LENGTH));
  try {
    return new Uint8Array(Buffer.concat([decipher.update(body.subarray(0, body.length - TAG_LENGTH)), decipher.final()]));
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const salt = Uint8Array.from({ length: SALT_LENGTH }, (_, i) => i);
  const nonce = Uint8Array.from({ length: NONCE_LENGTH }, (_, i) => 100 + i);
  const header = encodeHeader({ ...DEFAULT_KDF, salt, nonce });

  check('header length', header.length === HEADER_LENGTH && HEADER_LENGTH === 41, String(header.length));
  check('header is recognised', isEncryptedBackup(header));

  const file = joinBackup(header, new Uint8Array(TAG_LENGTH + 5));
  const parsed = parseHeader(file);
  check(
    'header round trip',
    parsed !== null &&
      parsed.logN === DEFAULT_KDF.logN &&
      parsed.r === DEFAULT_KDF.r &&
      parsed.p === DEFAULT_KDF.p &&
      hex(parsed.salt) === hex(salt) &&
      hex(parsed.nonce) === hex(nonce)
  );
  check('body is what follows the header', encryptedBody(file).length === TAG_LENGTH + 5);

  const sqlite = new TextEncoder().encode('SQLite format 3\u0000 and the rest of a plain backup file');
  check('plain SQLite file is not an encrypted backup', !isEncryptedBackup(sqlite) && parseHeader(sqlite) === null);
  check('empty file is not an encrypted backup', parseHeader(new Uint8Array(0)) === null);

  check('truncated header is damaged', errorCode(() => parseHeader(file.subarray(0, 20))) === 'DAMAGED');
  check('file without a tag is damaged', errorCode(() => parseHeader(header)) === 'DAMAGED');

  const newer = file.slice();
  newer[8] = 2;
  check('unknown format version is refused as newer', errorCode(() => parseHeader(newer)) === 'NEWER_VERSION');
  const otherKdf = file.slice();
  otherKdf[9] = 2;
  check('unknown key derivation is refused as newer', errorCode(() => parseHeader(otherKdf)) === 'NEWER_VERSION');
  check('truncated newer file is still reported as newer', errorCode(() => parseHeader(newer.subarray(0, 12))) === 'NEWER_VERSION');

  const heavy = file.slice();
  heavy[10] = 30;
  check('absurd cost is refused', errorCode(() => parseHeader(heavy)) === 'DAMAGED');
  const zeroCost = file.slice();
  zeroCost[11] = 0;
  check('zero block size is refused', errorCode(() => parseHeader(zeroCost)) === 'DAMAGED');

  // RFC 7914 section 12, second vector.
  const rfcKey = await deriveKey('password', { logN: 10, r: 8, p: 16, salt: new TextEncoder().encode('NaCl') });
  check(
    'scrypt matches the RFC 7914 vector',
    hex(rfcKey) === 'fdbabe1c9d3472007856e7190d01e9fe7c6ad7cbc8237830e77376634b373162',
    hex(rfcKey)
  );

  const composed = await deriveKey('café', { ...TEST_KDF, salt });
  const decomposed = await deriveKey('café', { ...TEST_KDF, salt });
  check('password is normalised before derivation', hex(composed) === hex(decomposed));

  const plain = new Uint8Array(randomBytes(5000));
  const sealed = await seal(plain, 'correct horse');
  check('ciphertext does not contain the plaintext start', !hex(sealed).includes(hex(plain.subarray(0, 16))));
  check('size is header + data + tag', sealed.length === HEADER_LENGTH + plain.length + TAG_LENGTH);

  const opened = await open(sealed, 'correct horse');
  check('round trip with the right password', opened !== null && hex(opened) === hex(plain));
  check('wrong password does not open', (await open(sealed, 'correct horsf')) === null);

  const flipped = sealed.slice();
  flipped[HEADER_LENGTH + 100] ^= 1;
  check('changed ciphertext does not open', (await open(flipped, 'correct horse')) === null);

  const cheaper = sealed.slice();
  cheaper[12] = 2;
  check('changed header does not open', (await open(cheaper, 'correct horse')) === null);

  const again = await seal(plain, 'correct horse');
  check('same data and password give a different file', hex(again) !== hex(sealed));

  console.log(failures === 0 ? '\nAll tests passed.' : `\n${failures} test(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
