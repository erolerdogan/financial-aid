// Run with: npx tsx src/utils/passcode.test.ts
import { randomBytes } from 'node:crypto';
import {
  createPasscodeRecord,
  FREE_ATTEMPTS,
  isValidPasscode,
  lockoutSeconds,
  parsePasscodeRecord,
  PasscodeRecord,
  registerFailure,
  registerSuccess,
  remainingLockSeconds,
  SALT_LENGTH,
  verifyPasscode,
} from './passcode';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const salt = (): Uint8Array => new Uint8Array(randomBytes(SALT_LENGTH));

const rejects = async (run: () => Promise<unknown>): Promise<boolean> => {
  try {
    await run();
    return false;
  } catch {
    return true;
  }
};

async function main(): Promise<void> {
  // Shape of a passcode
  check('six digits are valid', isValidPasscode('012345'));
  check('five digits are not', !isValidPasscode('12345'));
  check('seven digits are not', !isValidPasscode('1234567'));
  check('letters are not', !isValidPasscode('12a456'));
  check('empty is not', !isValidPasscode(''));

  // Hash and verify
  const record = await createPasscodeRecord('246810', salt());
  check('right passcode verifies', await verifyPasscode(record, '246810'));
  check('wrong passcode does not', !(await verifyPasscode(record, '246811')));
  check('short input does not', !(await verifyPasscode(record, '2468')));
  check('record does not contain the passcode', !JSON.stringify(record).includes('246810'));
  check('new record starts clean', record.failedAttempts === 0 && record.lockedUntil === null);

  const other = await createPasscodeRecord('246810', salt());
  check('same passcode, new salt, different hash', other.hash !== record.hash);

  check('creating with a bad passcode throws', await rejects(() => createPasscodeRecord('12', salt())));
  check('creating with a bad salt throws', await rejects(() => createPasscodeRecord('246810', new Uint8Array(4))));

  // Stored form
  const restored = parsePasscodeRecord(JSON.stringify(record));
  check('round trip keeps the record', JSON.stringify(restored) === JSON.stringify(record));
  check('round-tripped record verifies', restored !== null && (await verifyPasscode(restored, '246810')));
  check('not JSON is rejected', parsePasscodeRecord('{oops') === null);
  check('empty text is rejected', parsePasscodeRecord('') === null);
  check('null is rejected', parsePasscodeRecord('null') === null);
  check('unknown version is rejected', parsePasscodeRecord(JSON.stringify({ ...record, version: 2 })) === null);
  check('short hash is rejected', parsePasscodeRecord(JSON.stringify({ ...record, hash: 'abcd' })) === null);
  check('non-hex salt is rejected', parsePasscodeRecord(JSON.stringify({ ...record, salt: 'z'.repeat(32) })) === null);
  check('huge cost is rejected', parsePasscodeRecord(JSON.stringify({ ...record, logN: 40 })) === null);
  const sloppy = parsePasscodeRecord(JSON.stringify({ ...record, failedAttempts: -3, lockedUntil: 'soon' }));
  check('bad counters fall back to clean', sloppy?.failedAttempts === 0 && sloppy.lockedUntil === null);

  // Wrong tries
  check('no wait within the free tries', lockoutSeconds(0) === 0 && lockoutSeconds(FREE_ATTEMPTS) === 0);
  check('5th wrong try: 1 minute', lockoutSeconds(5) === 60);
  check('6th wrong try: 5 minutes', lockoutSeconds(6) === 300);
  check('7th wrong try: 15 minutes', lockoutSeconds(7) === 900);
  check('8th wrong try: 1 hour', lockoutSeconds(8) === 3600);
  check('later tries stay at 1 hour', lockoutSeconds(50) === 3600);

  const now = 1_700_000_000_000;
  let current: PasscodeRecord = record;
  for (let i = 0; i < FREE_ATTEMPTS; i++) current = registerFailure(current, now);
  check('free tries are counted', current.failedAttempts === FREE_ATTEMPTS);
  check('free tries do not lock', remainingLockSeconds(current, now) === 0);

  current = registerFailure(current, now);
  check('next wrong try locks for a minute', remainingLockSeconds(current, now) === 60);
  check('wait counts down', remainingLockSeconds(current, now + 45_500) === 15);
  check('wait ends', remainingLockSeconds(current, now + 60_000) === 0);
  check('wait is capped when the clock goes back', remainingLockSeconds(current, now - 86_400_000) === 3600);

  current = registerFailure(current, now + 60_000);
  check('wrong try after the wait locks longer', remainingLockSeconds(current, now + 60_000) === 300);

  const cleared = registerSuccess(current);
  check('right passcode clears the count', cleared.failedAttempts === 0 && cleared.lockedUntil === null);
  check('clearing keeps the hash', cleared.hash === record.hash && cleared.salt === record.salt);
  check('clean record is returned as is', registerSuccess(record) === record);
  check('registering a failure does not change the input', record.failedAttempts === 0);

  if (failures > 0) {
    console.log(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\nAll checks passed');
}

main();
