/**
 * @fileoverview Domain types for subscription information returned by SubscriptionHelper.
 */

import { SubscriptionPlatform } from "@sudobility/types";

/**
 * Subscription information returned by SubscriptionHelper.
 */
export interface SubscriptionInfo {
  /** Array of active entitlement names, or ["none"] if no active entitlements */
  entitlements: string[];
  /** When the subscription started (earliest purchase date), or null if no subscription */
  subscriptionStartedAt: Date | null;
  /** Platform where the subscription was purchased, or null if no subscription */
  platform: SubscriptionPlatform | null;
  /** Product identifier (e.g., "pro_monthly"), or null if no subscription */
  productIdentifier: string | null;
  /** When the subscription expires (ISO date), or null if lifetime/no subscription */
  expiresDate: Date | null;
  /** Whether this is a sandbox purchase */
  sandbox: boolean;
  /** Raw store identifier (e.g., "stripe", "app_store", "play_store"), or null if no subscription */
  store: string | null;
}
