// Run with: npx tsx src/utils/auth.test.ts
import {
  type AuthClient,
  type AuthEvent,
  type AuthResult,
  type AuthUser,
  type SignInOutcome,
  chunkValue,
  createAuthController,
  isValidEmail,
  parseAuthCallback,
  userFromSession,
} from './auth';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const ANNA: AuthUser = { id: 'user-1', email: 'anna@example.com', method: 'apple' };
const BEN: AuthUser = { id: 'user-2', email: 'ben@example.com', method: 'email' };

/** A client whose answers the test sets, and that records what was asked of it. */
function fakeClient(stored: AuthUser | null = null) {
  let listener: ((event: AuthEvent) => void) | null = null;
  const fake = {
    stored,
    restoreFails: false,
    apple: { result: 'success', user: ANNA } as SignInOutcome,
    google: { result: 'success', user: ANNA } as SignInOutcome,
    email: 'emailSent' as AuthResult,
    remove: 'success' as AuthResult,
    signOutFails: false,
    sentTo: [] as string[],
    signOuts: 0,
    emit: (event: AuthEvent) => listener?.(event),
    listening: () => listener !== null,
  };
  const client: AuthClient = {
    restore: async () => {
      if (fake.restoreFails) throw new Error('storage');
      return fake.stored;
    },
    subscribe: (next) => {
      listener = next;
      return () => {
        listener = null;
      };
    },
    signInWithApple: async () => fake.apple,
    signInWithGoogle: async () => fake.google,
    sendEmailLink: async (email) => {
      fake.sentTo.push(email);
      return fake.email;
    },
    signOut: async () => {
      fake.signOuts++;
      if (fake.signOutFails) throw new Error('network');
    },
    deleteAccount: async () => fake.remove,
  };
  return { fake, client };
}

function setup(stored: AuthUser | null = null) {
  const { fake, client } = fakeClient(stored);
  const calls: string[] = [];
  const controller = createAuthController(client, {
    onSignedIn: (id) => calls.push(`in:${id}`),
    onSignedOut: () => calls.push('out'),
  });
  let notified = 0;
  controller.subscribe(() => notified++);
  return { fake, controller, calls, notifications: () => notified };
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function main() {
  // Launch
  {
    const { controller, calls } = setup(ANNA);
    check('starts as loading', controller.getState().status === 'loading');
    controller.start();
    await settle();
    check('a stored session signs the user in', controller.getState().status === 'signedIn');
    check('with the stored user', controller.getState().user?.email === 'anna@example.com');
    check('the purchase service learns the user at launch', calls.join() === 'in:user-1', calls.join());
  }
  {
    const { controller, calls } = setup(null);
    controller.start();
    await settle();
    check('no stored session is signed out', controller.getState().status === 'signedOut');
    check('nobody was signed in, so nobody is signed out of purchases', calls.length === 0, calls.join());
  }
  {
    const { fake, controller } = setup(ANNA);
    fake.restoreFails = true;
    controller.start();
    await settle();
    check('storage that cannot be read is signed out, not stuck on loading', controller.getState().status === 'signedOut');
  }
  {
    const { fake, controller, calls } = setup(null);
    controller.start();
    fake.emit({ type: 'user', user: BEN });
    await settle();
    check('an event during the first read wins over the stored value', controller.getState().user?.id === 'user-2');
    check('and is reported once', calls.join() === 'in:user-2', calls.join());
  }

  // Apple and Google
  for (const method of ['signInWithApple', 'signInWithGoogle'] as const) {
    const key = method === 'signInWithApple' ? 'apple' : 'google';
    {
      const { controller, calls } = setup();
      controller.start();
      await settle();
      const result = await controller[method]();
      check(`${key}: success signs in`, result === 'success' && controller.getState().status === 'signedIn');
      check(`${key}: success is reported once`, calls.join() === 'in:user-1', calls.join());
    }
    for (const result of ['cancelled', 'offline', 'unavailable', 'failed'] as const) {
      const { fake, controller, calls } = setup();
      controller.start();
      await settle();
      fake[key] = { result };
      const got = await controller[method]();
      check(`${key}: ${result} stays signed out`, got === result && controller.getState().status === 'signedOut');
      check(`${key}: ${result} reports nothing`, calls.length === 0, calls.join());
    }
  }
  {
    const { fake, controller, calls, notifications } = setup();
    controller.start();
    await settle();
    await controller.signInWithApple();
    const before = notifications();
    fake.emit({ type: 'user', user: ANNA });
    check('the same user again changes nothing', notifications() === before && calls.length === 1, calls.join());
    fake.emit({ type: 'user', user: { ...ANNA, email: 'new@example.com' } });
    check('a changed email is taken over', controller.getState().user?.email === 'new@example.com');
    check('without a second sign-in report', calls.length === 1, calls.join());
  }

  // Email link
  {
    const { fake, controller, calls } = setup();
    controller.start();
    await settle();
    const result = await controller.signInWithEmail('  Ben@Example.com ');
    check('email: the link is sent', result === 'emailSent');
    check('email: to the trimmed, lower-case address', fake.sentTo.join() === 'ben@example.com', fake.sentTo.join());
    check('email: still signed out until the link is opened', controller.getState().status === 'signedOut');
    fake.emit({ type: 'user', user: BEN });
    check('email: opening the link signs in', controller.getState().user?.id === 'user-2');
    check('email: reported once', calls.join() === 'in:user-2', calls.join());
  }
  {
    const { fake, controller } = setup();
    controller.start();
    await settle();
    const result = await controller.signInWithEmail('not an address');
    check('email: an invalid address is refused', result === 'invalidEmail');
    check('email: and never sent', fake.sentTo.length === 0);
    fake.email = 'offline';
    check('email: offline is passed on', (await controller.signInWithEmail('ben@example.com')) === 'offline');
  }
  {
    const { fake, controller } = setup();
    controller.start();
    await settle();
    await controller.signInWithEmail('ben@example.com');
    fake.emit({ type: 'linkFailed' });
    check('email: a link that did not work is flagged', controller.getState().linkFailed);
    check('email: and the user stays signed out', controller.getState().status === 'signedOut');
    await controller.signInWithEmail('ben@example.com');
    check('email: a new attempt clears the flag', !controller.getState().linkFailed);
    fake.emit({ type: 'linkFailed' });
    fake.emit({ type: 'user', user: BEN });
    check('email: signing in clears the flag', !controller.getState().linkFailed);
  }
  {
    const { fake, controller } = setup(ANNA);
    controller.start();
    await settle();
    fake.emit({ type: 'linkFailed' });
    check('a failed link does not sign a user out', controller.getState().status === 'signedIn');
  }

  // Sign out
  {
    const { fake, controller, calls } = setup(ANNA);
    controller.start();
    await settle();
    await controller.signOut();
    check('sign out: signed out', controller.getState().status === 'signedOut' && controller.getState().user === null);
    check('sign out: the client was asked', fake.signOuts === 1);
    check('sign out: reported once', calls.join() === 'in:user-1,out', calls.join());
    fake.emit({ type: 'signedOut' });
    check('sign out: the echo from the client is not reported again', calls.length === 2, calls.join());
  }
  {
    const { fake, controller, calls } = setup(ANNA);
    controller.start();
    await settle();
    fake.signOutFails = true;
    await controller.signOut();
    check('sign out: works when the client fails (offline)', controller.getState().status === 'signedOut');
    check('sign out: still reported', calls.join() === 'in:user-1,out', calls.join());
  }
  {
    const { fake, controller, calls } = setup(ANNA);
    controller.start();
    await settle();
    fake.emit({ type: 'signedOut' });
    check('a revoked session signs out', controller.getState().status === 'signedOut');
    check('and is reported', calls.join() === 'in:user-1,out', calls.join());
    await controller.signInWithGoogle();
    check('signing in again is reported again', calls.join() === 'in:user-1,out,in:user-1', calls.join());
  }
  {
    const { fake, controller, calls } = setup(ANNA);
    controller.start();
    await settle();
    fake.emit({ type: 'user', user: BEN });
    check('another user replaces the first', controller.getState().user?.id === 'user-2');
    check('and is reported to purchases', calls.join() === 'in:user-1,in:user-2', calls.join());
  }

  // Delete
  {
    const { controller, calls } = setup(ANNA);
    controller.start();
    await settle();
    const result = await controller.deleteAccount();
    check('delete: success signs out', result === 'success' && controller.getState().status === 'signedOut');
    check('delete: reported', calls.join() === 'in:user-1,out', calls.join());
  }
  for (const result of ['offline', 'failed', 'unavailable'] as const) {
    const { fake, controller, calls } = setup(ANNA);
    controller.start();
    await settle();
    fake.remove = result;
    const got = await controller.deleteAccount();
    check(`delete: ${result} keeps the user signed in`, got === result && controller.getState().user?.id === 'user-1');
    check(`delete: ${result} reports nothing`, calls.join() === 'in:user-1', calls.join());
  }

  // Stopping
  {
    const { fake, controller } = setup(null);
    const stop = controller.start();
    await settle();
    stop();
    check('stop: no longer listening to the client', !fake.listening());
  }
  {
    const { controller } = setup(ANNA);
    const stop = controller.start();
    stop();
    await settle();
    check('stop: a read that finishes later is ignored', controller.getState().status === 'loading');
  }

  // Email addresses
  check('a plain address is valid', isValidEmail('a@b.co'));
  check('spaces around it are fine', isValidEmail('  a@b.co  '));
  check('no @ is invalid', !isValidEmail('a.b.co'));
  check('no domain dot is invalid', !isValidEmail('a@b'));
  check('a space inside is invalid', !isValidEmail('a b@c.de'));
  check('empty is invalid', !isValidEmail(''));

  // Stored session
  const session = { access_token: 'x', user: { id: 'u', email: 'a@b.co', app_metadata: { provider: 'google' } } };
  check('session: user is read', JSON.stringify(userFromSession(session)) === '{"id":"u","email":"a@b.co","method":"google"}');
  check('session: an unknown provider has no method', userFromSession({ user: { id: 'u', app_metadata: { provider: 'github' } } })?.method === null);
  check('session: a missing email is null', userFromSession({ user: { id: 'u' } })?.email === null);
  check('session: no user is null', userFromSession({ access_token: 'x' }) === null);
  check('session: no id is null', userFromSession({ user: { email: 'a@b.co' } }) === null);
  check('session: null is null', userFromSession(null) === null);
  check('session: text is null', userFromSession('{}') === null);

  // The link back into the app
  const code = parseAuthCallback('financial-aid://auth-callback?code=abc-123');
  check('callback: code is read', code?.kind === 'code' && code.code === 'abc-123');
  const dev = parseAuthCallback('exp+financial-aid://auth-callback/?code=a%2Bb');
  check('callback: any scheme, decoded', dev?.kind === 'code' && dev.code === 'a+b');
  const expired = parseAuthCallback('financial-aid://auth-callback#error=access_denied&error_code=otp_expired&error_description=Link+expired');
  check('callback: an error in the fragment', expired?.kind === 'error' && expired.reason === 'otp_expired');
  const bare = parseAuthCallback('financial-aid://auth-callback');
  check('callback: without a code it is an error', bare?.kind === 'error' && bare.reason === 'missing_code');
  check('callback: a shared file is not a callback', parseAuthCallback('financial-aid://expo-sharing') === null);
  check('callback: a route is not a callback', parseAuthCallback('/transactions') === null);
  check('callback: the host must match exactly', parseAuthCallback('financial-aid://auth-callback-x?code=1') === null);
  check('callback: broken encoding is an error, not a crash', parseAuthCallback('financial-aid://auth-callback?code=%E0%A4%A')?.kind === 'error');

  // Storage parts
  check('chunks: short value is one part', chunkValue('abc', 5).join('|') === 'abc');
  check('chunks: exact fit', chunkValue('abcdef', 3).join('|') === 'abc|def');
  check('chunks: remainder', chunkValue('abcdefg', 3).join('|') === 'abc|def|g');
  check('chunks: empty value has no parts', chunkValue('', 3).length === 0);
  const emoji = 'ab😀cd😀';
  const parts = chunkValue(emoji, 3);
  check('chunks: join gives the value back', parts.join('') === emoji);
  check('chunks: none longer than the size', parts.every((part) => part.length <= 3));
  check(
    'chunks: a surrogate pair is never split',
    parts.every((part) => !/[\ud800-\udbff]$/.test(part) && !/^[\udc00-\udfff]/.test(part)),
    parts.map((part) => part.length).join(',')
  );
  check('chunks: size one still ends', chunkValue('😀', 1).join('') === '😀');
  const long = 'x'.repeat(2500);
  check('chunks: a long token round-trips', chunkValue(long, 600).length === 5 && chunkValue(long, 600).join('') === long);

  if (failures > 0) {
    console.log(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\nAll checks passed');
}

main();
