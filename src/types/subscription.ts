/**
 * Subscription information returned by SubscriptionHelper.
 */
export interface SubscriptionInfo {
  /** Array of active entitlement names */
  entitlements: string[];
  /** When the subscription started (earliest purchase date), or null if no subscription */
  subscriptionStartedAt: Date | null;
}
