/**
 * @fileoverview RevenueCat API client for server-side subscription management.
 *
 * Provides the `SubscriptionHelper` class that calls the RevenueCat REST API v1
 * to fetch user entitlements and subscription information. Handles sandbox
 * filtering via the `testMode` parameter.
 */

import { NONE_ENTITLEMENT, SubscriptionPlatform } from "@sudobility/types";
import type { RevenueCatSubscriberResponse } from "../types/entitlements";
import type { SubscriptionInfo } from "../types/subscription";

/**
 * Configuration for SubscriptionHelper.
 */
export interface SubscriptionHelperConfig {
  /** RevenueCat secret API key (for server-side use) */
  revenueCatApiKey: string;
  /** Base URL for RevenueCat API. Defaults to https://api.revenuecat.com/v1 */
  baseUrl?: string;
  /** Request timeout in milliseconds. Defaults to 10000 (10 seconds). */
  timeoutMs?: number;
}

/** Maps RevenueCat store identifiers to SubscriptionPlatform values. */
const STORE_PLATFORM_MAP: Record<string, SubscriptionPlatform> = {
  stripe: SubscriptionPlatform.Web,
  rc_billing: SubscriptionPlatform.Web,
  app_store: SubscriptionPlatform.iOS,
  play_store: SubscriptionPlatform.Android,
  mac_app_store: SubscriptionPlatform.macOS,
};

/**
 * Helper class for interacting with RevenueCat API to get user entitlements
 * and subscription information.
 *
 * Uses the RevenueCat REST API v1 endpoint `GET /subscribers/{user_id}` to
 * fetch subscriber data, then filters entitlements by expiration and sandbox status.
 * Detects the subscription platform from the store field in the response.
 */
export class SubscriptionHelper {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  /**
   * Creates a new SubscriptionHelper instance.
   *
   * @param config - Configuration containing the RevenueCat API key and optional base URL.
   */
  constructor(config: SubscriptionHelperConfig) {
    this.apiKey = config.revenueCatApiKey;
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
   * Fetches the subscriber data from RevenueCat, filters out expired entitlements
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

    const url = `${this.baseUrl}/subscribers/${encodeURIComponent(userId)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 404) {
      return {
        entitlements: [NONE_ENTITLEMENT],
        subscriptionStartedAt: null,
        platform: null,
        productIdentifier: null,
        expiresDate: null,
        sandbox: false,
        store: null,
      };
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
    let resultPlatform: SubscriptionPlatform | null = null;
    let resultProductIdentifier: string | null = null;
    let resultExpiresDate: Date | null = null;
    let resultSandbox = false;
    let resultStore: string | null = null;

    for (const [name, entitlement] of Object.entries(entitlements)) {
      const isActive =
        !entitlement.expires_date || new Date(entitlement.expires_date) > now;

      if (!isActive) {
        continue;
      }

      const subscription = subscriptions[entitlement.product_identifier];

      // Filter sandbox purchases in production mode
      if (!testMode && subscription?.environment === "sandbox") {
        continue;
      }

      activeEntitlements.push(name);

      const purchaseDate = new Date(entitlement.purchase_date);
      if (!earliestPurchaseDate || purchaseDate < earliestPurchaseDate) {
        earliestPurchaseDate = purchaseDate;
        resultPlatform =
          STORE_PLATFORM_MAP[subscription?.store ?? ""] ?? null;
        resultProductIdentifier = entitlement.product_identifier;
        resultExpiresDate = entitlement.expires_date
          ? new Date(entitlement.expires_date)
          : null;
        resultSandbox = subscription?.sandbox ?? false;
        resultStore = subscription?.store ?? null;
      }
    }

    if (activeEntitlements.length === 0) {
      return {
        entitlements: [NONE_ENTITLEMENT],
        subscriptionStartedAt: null,
        platform: null,
        productIdentifier: null,
        expiresDate: null,
        sandbox: false,
        store: null,
      };
    }

    return {
      entitlements: activeEntitlements,
      subscriptionStartedAt: earliestPurchaseDate,
      platform: resultPlatform,
      productIdentifier: resultProductIdentifier,
      expiresDate: resultExpiresDate,
      sandbox: resultSandbox,
      store: resultStore,
    };
  }
}
