import { NONE_ENTITLEMENT } from "@sudobility/types";
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
}

/**
 * Helper class for interacting with RevenueCat API to get user entitlements
 * and subscription information.
 */
export class SubscriptionHelper {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: SubscriptionHelperConfig) {
    this.apiKey = config.revenueCatApiKey;
    this.baseUrl = config.baseUrl ?? "https://api.revenuecat.com/v1";
  }

  /**
   * Get active entitlement names for a user.
   */
  async getEntitlements(
    userId: string,
    testMode: boolean = false
  ): Promise<string[]> {
    const info = await this.getSubscriptionInfo(userId, testMode);
    return info.entitlements;
  }

  /**
   * Get full subscription info including entitlements and subscription start date.
   */
  async getSubscriptionInfo(
    userId: string,
    testMode: boolean = false
  ): Promise<SubscriptionInfo> {
    const url = `${this.baseUrl}/subscribers/${encodeURIComponent(userId)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 404) {
      return {
        entitlements: [NONE_ENTITLEMENT],
        subscriptionStartedAt: null,
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

    for (const [name, entitlement] of Object.entries(entitlements)) {
      const isActive =
        !entitlement.expires_date || new Date(entitlement.expires_date) > now;

      if (!isActive) {
        continue;
      }

      const subscription = subscriptions[entitlement.product_identifier];
      if (!testMode && subscription?.sandbox === true) {
        continue;
      }

      activeEntitlements.push(name);

      const purchaseDate = new Date(entitlement.purchase_date);
      if (!earliestPurchaseDate || purchaseDate < earliestPurchaseDate) {
        earliestPurchaseDate = purchaseDate;
      }
    }

    if (activeEntitlements.length === 0) {
      return {
        entitlements: [NONE_ENTITLEMENT],
        subscriptionStartedAt: null,
      };
    }

    return {
      entitlements: activeEntitlements,
      subscriptionStartedAt: earliestPurchaseDate,
    };
  }
}
