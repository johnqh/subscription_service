/**
 * @fileoverview Domain types for subscription information returned by SubscriptionHelper.
 */

import { SubscriptionPlatform } from "@sudobility/types";

/**
 * RevenueCat API keys per platform. All fields are optional —
 * only platforms the app supports need to be provided.
 */
export interface RevenueCatApiKeys {
  /** RevenueCat secret API key for web (Stripe) */
  web?: string;
  /** RevenueCat secret API key for web sandbox */
  webSandbox?: string;
  /** RevenueCat secret API key for iOS (App Store) */
  ios?: string;
  /** RevenueCat secret API key for Android (Play Store) */
  android?: string;
  /** RevenueCat secret API key for macOS (Mac App Store) */
  macos?: string;
}

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
}
