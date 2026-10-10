# Account

An optional, passwordless account. It exists for one reason: a Pro purchase has to belong to someone, so it can be restored on another device. The app works fully without it.

## Product rules

- The account stores a user id, an email address and a creation date. No financial data ever leaves the device: no transactions, balances, profiles, categories or payee names.
- Sign-in methods: Sign in with Apple (iOS), Sign in with Google, and a link sent by email. No passwords.
- Using the app never needs an account. Buying or restoring Pro does: the sign-in sheet comes right before the purchase.
- Tagline: "Your financial data never leaves your phone."
- The account is app-wide, not per profile. It is the same in the demo workspace.
- A build without the account service (`AUTH_CONFIGURED` false) has no account UI at all, and buying asks for none.

## The layer

| File | Role |
| --- | --- |
| `src/utils/auth.ts` | Pure. Types, `createAuthController(client, hooks)` (the state and every transition), `userFromSession`, `parseAuthCallback`, `chunkValue`. Tested in `auth.test.ts` with a fake client. |
| `src/services/auth.ts` | The real `AuthClient`: Apple, Google, email link, sign-out, delete, and `completeAuthLink(url)`. Every call returns an `AuthResult`; nothing throws. |
| `src/services/supabase.ts` | The Supabase client, created on first use; `null` without configuration. |
| `src/services/authStorage.ts` | Session storage in the Keychain / Keystore (`expo-secure-store`). |
| `src/contexts/AuthContext.tsx` | `AuthProvider`, `useAuth()`: `{ user, status, available, linkFailed, signInWithApple, signInWithGoogle, signInWithEmail, signOut, deleteAccount }`. |
| `src/hooks/useRequireAccount.ts` | `requireAccount(action)` and the props for `SignInSheet`. |
| `src/components/account/` | `SignInButtons` (the three methods and the privacy line), `SignInSheet`. |
| `src/components/profile/AccountStep.tsx` | The onboarding step. |
| `src/app/account.tsx` | You → Account. |
| `supabase/functions/delete-account/` | The edge function that deletes the account. |

`AuthProvider` sits between `ProfileProvider` and `EntitlementProvider` in `src/app/_layout.tsx`.

## State

- `status` is `loading` until the stored session is read, then `signedIn` or `signedOut`. Nothing waits for it.
- At launch the user is read straight from the Keychain (`restore` in `src/services/auth.ts`), not through the Supabase client. The client would first try to refresh an expired session, and offline that fails although the user is still signed in.
- Events from the client: a session means signed in; only `SIGNED_OUT` means signed out. The first event carries no session when the refresh failed offline, and that must not sign the user out.
- Sign-out is local (`scope: 'local'`) and works offline. When the client cannot finish, the stored session is removed directly.
- Signing in and deleting need a connection and answer `offline` without one.
- Tokens are refreshed only while the app is in front (`startAutoRefresh` / `stopAutoRefresh` on `AppState`).

## Session storage

- The session is in the Keychain (iOS) and the Keystore (Android), under `financial-aid-auth`, with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
- Never in `app_meta`: a backup is the whole database, so a session there would travel inside every backup file. Same reason as the passcode.
- A session is a few thousand characters and older iOS versions refuse an entry above about 2048 bytes, so the value is split into parts of 600 UTF-16 units (`<key>.0`, `<key>.1`, … and `<key>.n` for the count). `chunkValue` never splits a surrogate pair.
- "Reset" does not sign out: it clears the database, and the session is not in it. Deleting the app removes the session on Android; on iOS a Keychain entry can survive a reinstall.

## Email link

- `signInWithOtp` sends a link that redirects to `financial-aid://auth-callback?code=…` (PKCE). The code verifier is in the same secure storage, so the link must be opened on the device that asked for it.
- `src/app/+native-intent.ts` hands that URL to `completeAuthLink` and returns `/`. It is not a route on purpose: at a cold start the launch redirect to Welcome could replace a callback route before it ran.
- A link that cannot be used (expired, used before, another device) sets `linkFailed`, and `SignInButtons` asks to send a new one.
- In a development build the scheme `exp+financial-aid` exists too; the redirect always uses `financial-aid`.

## Purchases

- `src/services/purchases.ts` has `identify(userId)` and `reset()`. `AuthProvider` calls `identify` at launch with a stored session and after every sign-in, and `reset` when a signed-in user leaves. Both are no-ops today (`TODO(payments)`): RevenueCat `logIn` / `logOut` go there. Only the user id is passed, never the email address.
- `useRequireAccount` gates `handlePurchase` and `handleRestore` in the paywall and "Restore purchases" in the You tab. After signing in, the action continues by itself (300 ms later, once the sheet has closed). When the user signs in by email, it continues when they return through the link, as long as the sheet is still open.

## Screens

- **Onboarding.** `src/app/welcome.tsx` has the stage `account` between `questions` (or the Pro `offer` stage that follows them) and `import`. Whether it is shown is decided when "Get started" opens the questions (`accountStep`): only when the account service is configured and nobody is signed in. The progress dots count it. "Continue without account" and signing in both move on to the import step. Opening the import step directly (questions answered earlier) does not offer it again.
- **Paywall.** See Purchases.
- **You → Account.** A row in the "Account & subscription" group of the You tab (`src/app/(tabs)/you.tsx`), drawn only when `useAuth().available`: "Sign in or create account" when signed out, the email address when signed in. It opens `src/app/account.tsx`, which also holds sign out. Signed out: the sign-in buttons. Signed in: email, sign-in method, Sign out, Delete account. It renders nothing when `AUTH_CONFIGURED` is false.
- **Delete account.** One alert with "Delete Account" and "Delete Account and Erase Data". The first leaves everything on the phone as it is. The second also runs the same erase as You → Reset (`useEraseAllData`) and returns to Welcome; it is not offered in the demo workspace. The account is deleted first: when that fails, nothing is erased.
- The Apple button is Apple's own component (its label follows the device language, as Apple requires). The Google mark keeps Google's colours.

## Deleting an account: the edge function

`supabase/functions/delete-account/index.ts` runs on Supabase, with the user's session as the only input.

1. Resolves the caller from the `Authorization` header. The user id is never read from the request body.
2. Deletes the RevenueCat customer (`DELETE /v1/subscribers/{id}`; 404 counts as done). Skipped while `REVENUECAT_SECRET_KEY` is not set.
3. Deletes the auth user with the service role.

RevenueCat comes first: when it fails, the account is still there and the user can try again. Deleting the customer does not cancel a store subscription; the app says so in the confirmation.

Deploy:

```
npm install -g supabase            # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <project-ref>
supabase secrets set REVENUECAT_SECRET_KEY=<RevenueCat secret API key (sk_…)>
supabase functions deploy delete-account
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to the function by the platform. Neither secret is ever in the app or in `.env`. Try it locally with `supabase functions serve delete-account`.

`supabase/` is Deno code: it is excluded from `tsconfig.json` and ESLint.

## Configuration

`.env` (copy `.env.example`; gitignored). All four are public values, inlined at bundle time:

| Variable | From |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Same page (anon / publishable key) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google Cloud → Credentials → the Web client |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google Cloud → Credentials → the iOS client |

- `src/constants/buildConfig.ts` is the only place that reads them. `metro.config.js` puts them into `cacheVersion`, like the Pro testing flag.
- An EAS build does not see `.env` (it is gitignored): set the same names as EAS environment variables (`eas env:create`), also for the `build.yml` workflow. Without them the build simply has no accounts.
- Without the Google client ids the Google button is hidden; on iOS it needs both.

## Native setup and rebuild

Three native modules were added: `expo-secure-store`, `expo-apple-authentication`, `@react-native-google-signin/google-signin`. A new development build is needed (`npm run ios` / `npm run android`); Expo Go cannot run this.

- `app.json`: `ios.usesAppleSignIn: true` (adds the Sign in with Apple entitlement) and the plugins `expo-secure-store` and `expo-apple-authentication`.
- `app.config.ts` extends `app.json`: with `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` set, it adds the Google plugin with `iosUrlScheme` (the reversed client id). The plugin refuses to run without that value, so it is left out otherwise. **Changing the iOS client id needs a new native build**, because the URL scheme is in `Info.plist`.
- The Google package is an ES module, which this tsconfig cannot import statically; `src/services/auth.ts` loads it with `await import()`.
- Sign in with Apple needs a real device for a full test; the Simulator is limited.

## Dashboard checklist

Supabase
- [ ] Create the project (pick the region with care: it is where the email addresses are stored).
- [ ] Authentication → URL Configuration → Redirect URLs: add `financial-aid://auth-callback`.
- [ ] Authentication → Providers → Email: enabled, "Confirm email" on. No password sign-in is used.
- [ ] Authentication → Email Templates → Magic Link: the link must be `{{ .ConfirmationURL }}`; set the sender name and text.
- [ ] Authentication → Providers → Apple: enabled; Client IDs: `com.financialaid.mobile` (the iOS bundle id). No secret key is needed for the native flow.
- [ ] Authentication → Providers → Google: enabled; Client IDs: the Web client id first, then the iOS and Android client ids, comma separated; **"Skip nonce check" on** (the free Google library cannot pass a nonce, and iOS tokens carry one).
- [ ] Authentication → Rate limits and SMTP: the built-in mail service allows only a few emails per hour; set a custom SMTP provider before release.
- [ ] Deploy `delete-account` and set `REVENUECAT_SECRET_KEY` (above).
- [ ] No tables are needed. Keep the Data API closed to `anon` for anything you add later.

Apple Developer
- [ ] Identifiers → `com.financialaid.mobile` → enable "Sign in with Apple". EAS Build syncs the capability; a local build needs it enabled before signing.
- [ ] Before submission: revoke Apple tokens on account deletion (see Not done).

Google Cloud (APIs & Services)
- [ ] OAuth consent screen: app name, support email, scopes `email`, `profile`, `openid`; publish it.
- [ ] Credentials → OAuth client, type **Web**: its id is `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and the first id in Supabase.
- [ ] Credentials → OAuth client, type **iOS**, bundle id `com.financialaid.mobile`: its id is `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
- [ ] Credentials → OAuth client, type **Android**, package `com.financialaid.app`, one client per SHA-1: the debug keystore, the EAS / upload key (`eas credentials`), and the Play App Signing key (Play Console → App integrity). No id goes into the app; a missing SHA-1 shows as `DEVELOPER_ERROR`.

RevenueCat (when purchases are integrated)
- [ ] Project Settings → API keys → a secret key for `REVENUECAT_SECRET_KEY`.

## Not done

- **Apple token revocation.** App Review expects an app with Sign in with Apple to revoke the user's Apple token when the account is deleted. That needs the Apple client secret (a `.p8` key) on the server and the authorization code exchanged at sign-in. The edge function does not do it yet. Required before an App Store submission.
- RevenueCat itself (`identify` / `reset` are stubs), and naming it in the privacy policy once it receives the user id.
- The privacy policy names Supabase as the processor; it has not had a legal review.
- A six-digit code as a fallback for an email link opened on another device.
- No UI check at the "accessibility extra large" size for the new screens.
- Not run on a device: everything here was type-checked and unit-tested only.
