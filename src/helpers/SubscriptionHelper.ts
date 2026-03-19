/**
 * @fileoverview RevenueCat API client for server-side subscription management.
 *
 * Provides the `SubscriptionHelper` class that calls the RevenueCat REST API v1
 * to fetch user entitlements and subscription information. Handles sandbox
 * filtering via the `testMode` parameter.
 */

import { NONE_ENTITLEMENT, SubscriptionPlatform } from "@sudobility/types";
import type { RevenueCatSubscriberResponse } from "../types/entitlements";
import type { RevenueCatApiKeys, SubscriptionInfo } from "../types/subscription";

/**
 * Configuration for SubscriptionHelper.
 */
export interface SubscriptionHelperConfig {
  /** RevenueCat secret API keys per platform */
  revenueCatApiKeys: RevenueCatApiKeys;
  /** Base URL for RevenueCat API. Defaults to https://api.revenuecat.com/v1 */
  baseUrl?: string;
  /** Request timeout in milliseconds. Defaults to 10000 (10 seconds). */
  timeoutMs?: number;
}

/** Maps RevenueCatApiKeys fields to SubscriptionPlatform values. */
const API_KEY_PLATFORM_MAP: {
  key: keyof RevenueCatApiKeys;
  platform: SubscriptionPlatform;
}[] = [
  { key: "web", platform: SubscriptionPlatform.Web },
  { key: "webSandbox", platform: SubscriptionPlatform.Web },
  { key: "ios", platform: SubscriptionPlatform.iOS },
  { key: "android", platform: SubscriptionPlatform.Android },
  { key: "macos", platform: SubscriptionPlatform.macOS },
];

/**
 * Helper class for interacting with RevenueCat API to get user entitlements
 * and subscription information.
 *
 * Uses the RevenueCat REST API v1 endpoint `GET /subscribers/{user_id}` to
 * fetch subscriber data, then filters entitlements by expiration and sandbox status.
 * Queries each configured platform API key and merges the results.
 */
export class SubscriptionHelper {
  private readonly apiKeys: RevenueCatApiKeys;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  /**
   * Creates a new SubscriptionHelper instance.
   *
   * @param config - Configuration containing the RevenueCat API keys and optional base URL.
   */
  constructor(config: SubscriptionHelperConfig) {
    this.apiKeys = config.revenueCatApiKeys;
    this.baseUrl = config.baseUrl ?? "https://api.revenuecat.com/v1";
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  /**
   * Get active entitlement names for a user.
   *
   * This is a convenience wrapper around `getSubscriptionInfo()` that returns
   * only the entitlements array.
   *
   * @param userId - The RevenueCat user identifier.
   * @param testMode - When true, includes sandbox purchases. Defaults to false.
   * @returns Array of active entitlement names, or `["none"]` if no active entitlements.
   */
  async getEntitlements(
    userId: string,
    testMode: boolean = false
  ): Promise<string[]> {
    if (!userId || typeof userId !== "string") {
      throw new Error("userId must be a non-empty string");
    }

    const info = await this.getSubscriptionInfo(userId, testMode);
    return info.entitlements;
  }

  /**
   * Get full subscription info including entitlements, subscription start date,
   * and platform.
   *
   * Queries each configured platform API key, filters out expired entitlements
   * and (optionally) sandbox purchases, and returns the active entitlement names
   * along with the earliest purchase date and the platform it came from.
   *
   * @param userId - The RevenueCat user identifier.
   * @param testMode - When true, includes sandbox purchases. Defaults to false.
   * @returns Subscription info with active entitlements, earliest purchase date, and platform.
   * @throws Error if the RevenueCat API returns a non-404, non-OK response.
   */
  async getSubscriptionInfo(
    userId: string,
    testMode: boolean = false
  ): Promise<SubscriptionInfo> {
    if (!userId || typeof userId !== "string") {
      throw new Error("userId must be a non-empty string");
    }

    const allEntitlements: string[] = [];
    let earliestPurchaseDate: Date | null = null;
    let resultPlatform: SubscriptionPlatform | null = null;

    for (const { key, platform } of API_KEY_PLATFORM_MAP) {
      const apiKey = this.apiKeys[key];
      if (!apiKey) continue;

      // In production mode, skip webSandbox key
      if (!testMode && key === "webSandbox") continue;
      // In test mode, skip web key (use webSandbox instead)
      if (testMode && key === "web" && this.apiKeys.webSandbox) continue;

      const result = await this.fetchSubscriberInfo(
        userId,
        apiKey,
        key,
        testMode
      );

      for (const name of result.entitlements) {
        if (!allEntitlements.includes(name)) {
          allEntitlements.push(name);
        }
      }

      if (result.purchaseDate) {
        if (!earliestPurchaseDate || result.purchaseDate < earliestPurchaseDate) {
          earliestPurchaseDate = result.purchaseDate;
          resultPlatform = platform;
        }
      }
    }

    if (allEntitlements.length === 0) {
      return {
        entitlements: [NONE_ENTITLEMENT],
        subscriptionStartedAt: null,
        platform: null,
      };
    }

    return {
      entitlements: allEntitlements,
      subscriptionStartedAt: earliestPurchaseDate,
      platform: resultPlatform,
    };
  }

  /**
   * Fetch subscriber info from RevenueCat for a single API key.
   *
   * For web/webSandbox keys, sandbox filtering is handled by key selection
   * in getSubscriptionInfo. For ios/android/macos keys, sandbox filtering
   * is done by checking the subscription's `environment` field.
   *
   * @returns Active entitlement names and earliest purchase date for this key.
   */
  private async fetchSubscriberInfo(
    userId: string,
    apiKey: string,
    keyName: keyof RevenueCatApiKeys,
    testMode: boolean
  ): Promise<{ entitlements: string[]; purchaseDate: Date | null }> {
    const url = `${this.baseUrl}/subscribers/${encodeURIComponent(userId)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 404) {
      return { entitlements: [], purchaseDate: null };
    }

    if (!response.ok) {
      throw new Error(
        `RevenueCat API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as RevenueCatSubscriberResponse;
    const entitlements = data.subscriber?.entitlements ?? {};
    const subscriptions = data.subscriber?.subscriptions ?? {};

    const now = new Date();
    const activeEntitlements: string[] = [];
    let earliestPurchaseDate: Date | null = null;

    // For ios/android/macos, filter by environment field
    const checkEnvironment =
      keyName === "ios" || keyName === "android" || keyName === "macos";

    for (const [name, entitlement] of Object.entries(entitlements)) {
      const isActive =
        !entitlement.expires_date || new Date(entitlement.expires_date) > now;

      if (!isActive) {
        continue;
      }

      const subscription = subscriptions[entitlement.product_identifier];

      if (checkEnvironment && !testMode && subscription?.environment === "sandbox") {
        continue;
      }

      activeEntitlements.push(name);

      const purchaseDate = new Date(entitlement.purchase_date);
      if (!earliestPurchaseDate || purchaseDate < earliestPurchaseDate) {
        earliestPurchaseDate = purchaseDate;
      }
    }

    return { entitlements: activeEntitlements, purchaseDate: earliestPurchaseDate };
  }
}
