// The only file that talks to the store. Today it is a stub: no payment SDK is installed.
// RevenueCat plugs in here later (entitlement "pro"; products monthly, yearly with a 7-day trial,
// lifetime), and `EntitlementContext` then reads the tier from it instead of the developer switch.
// A purchase belongs to the account (`AuthContext`): the store is told the user id and nothing else,
// so Pro follows the user to another device. The screens ask for an account before buying or restoring.

import { PLACEHOLDER_CURRENCY_SYMBOL, PLANS, type PlanDefinition, type PlanId } from '@/constants/paywall';
import { setAppMeta } from '@/db/database';
import { PRO_DEV_OVERRIDE_KEY } from '@/utils/entitlement';
import type { SQLiteDatabase } from 'expo-sqlite';

export type PurchaseResult = 'success' | 'comingSoon';
export type RestoreResult = 'success' | 'nothingToRestore' | 'comingSoon';

export interface Offering extends PlanDefinition {
  currencySymbol: string;
}

/** The plans on sale. Placeholder prices until the store provides them. */
export async function getOfferings(): Promise<Offering[]> {
  return PLANS.map((plan) => ({ ...plan, currencySymbol: PLACEHOLDER_CURRENCY_SYMBOL }));
}

/** Buys a plan. A development build turns the developer switch on instead; a release build cannot buy yet. */
export async function purchase(db: SQLiteDatabase, plan: PlanId): Promise<PurchaseResult> {
  if (!__DEV__) return 'comingSoon';
  console.log(`Purchase stub: ${plan}`);
  await setAppMeta(db, PRO_DEV_OVERRIDE_KEY, '1');
  return 'success';
}

/** Brings back an earlier purchase. Nothing can have been bought yet. */
export async function restore(): Promise<RestoreResult> {
  return __DEV__ ? 'nothingToRestore' : 'comingSoon';
}

/**
 * Tells the store which account buys and owns purchases. Called at launch with a stored session and
 * after every sign-in. Only the user id is passed, never the email address.
 */
export async function identify(userId: string): Promise<void> {
  // TODO(payments): await Purchases.logIn(userId), then let `EntitlementContext` read the tier again.
  if (__DEV__) console.log(`Purchase stub: identify ${userId}`);
}

/** The account was left (sign-out, deleted account): the store goes back to an anonymous customer. */
export async function reset(): Promise<void> {
  // TODO(payments): await Purchases.logOut(), then let `EntitlementContext` read the tier again.
  if (__DEV__) console.log('Purchase stub: reset');
}
