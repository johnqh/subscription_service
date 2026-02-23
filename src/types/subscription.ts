/**
 * @fileoverview Domain types for subscription information returned by SubscriptionHelper.
 */

/**
 * Subscription information returned by SubscriptionHelper.
 */
export interface SubscriptionInfo {
  /** Array of active entitlement names, or ["none"] if no active entitlements */
  entitlements: string[];
  /** When the subscription started (earliest purchase date), or null if no subscription */
  subscriptionStartedAt: Date | null;
}
