import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NONE_ENTITLEMENT, SubscriptionPlatform } from "@sudobility/types";
import { SubscriptionHelper } from "../src/helpers/SubscriptionHelper";

describe("NONE_ENTITLEMENT", () => {
  it("should be 'none'", () => {
    expect(NONE_ENTITLEMENT).toBe("none");
  });
});

describe("SubscriptionHelper", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("getSubscriptionInfo", () => {
    it("should return none entitlement when user not found (404)", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { web: "test-web-key" },
      });
      fetchMock.mockResolvedValueOnce({
        status: 404,
        ok: false,
      });

      const result = await helper.getSubscriptionInfo("user-123");

      expect(result.entitlements).toEqual([NONE_ENTITLEMENT]);
      expect(result.subscriptionStartedAt).toBeNull();
      expect(result.platform).toBeNull();
    });

    it("should throw error on API failure", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { web: "test-web-key" },
      });
      fetchMock.mockResolvedValueOnce({
        status: 500,
        ok: false,
        statusText: "Internal Server Error",
      });

      await expect(helper.getSubscriptionInfo("user-123")).rejects.toThrow(
        "RevenueCat API error: 500 Internal Server Error"
      );
    });

    it("should return active entitlements with platform", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { web: "test-web-key" },
      });
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_monthly",
                purchase_date: "2024-01-15T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_monthly: {
                expires_date: futureDate,
                purchase_date: "2024-01-15T00:00:00Z",
                sandbox: false,
                store: "stripe",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123");

      expect(result.entitlements).toEqual(["pro"]);
      expect(result.subscriptionStartedAt).toEqual(
        new Date("2024-01-15T00:00:00Z")
      );
      expect(result.platform).toBe(SubscriptionPlatform.Web);
    });

    it("should filter expired entitlements", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { web: "test-web-key" },
      });
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: pastDate,
                product_identifier: "pro_monthly",
                purchase_date: "2024-01-15T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_monthly: {
                expires_date: pastDate,
                purchase_date: "2024-01-15T00:00:00Z",
                sandbox: false,
                store: "stripe",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123");

      expect(result.entitlements).toEqual([NONE_ENTITLEMENT]);
      expect(result.subscriptionStartedAt).toBeNull();
      expect(result.platform).toBeNull();
    });

    it("should return earliest purchase date with multiple entitlements", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { web: "test-web-key" },
      });
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_monthly",
                purchase_date: "2024-03-15T00:00:00Z",
                grace_period_expires_date: null,
              },
              bandwidth: {
                expires_date: futureDate,
                product_identifier: "bandwidth_addon",
                purchase_date: "2024-01-10T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_monthly: {
                expires_date: futureDate,
                purchase_date: "2024-03-15T00:00:00Z",
                sandbox: false,
                store: "stripe",
              },
              bandwidth_addon: {
                expires_date: futureDate,
                purchase_date: "2024-01-10T00:00:00Z",
                sandbox: false,
                store: "stripe",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123");

      expect(result.entitlements).toContain("pro");
      expect(result.entitlements).toContain("bandwidth");
      expect(result.subscriptionStartedAt).toEqual(
        new Date("2024-01-10T00:00:00Z")
      );
      expect(result.platform).toBe(SubscriptionPlatform.Web);
    });

    it("should use web key in production and skip webSandbox", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { web: "prod-key", webSandbox: "sandbox-key" },
      });
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_monthly",
                purchase_date: "2024-01-15T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_monthly: {
                expires_date: futureDate,
                purchase_date: "2024-01-15T00:00:00Z",
                sandbox: false,
                store: "stripe",
              },
            },
          },
        }),
      });

      await helper.getSubscriptionInfo("user-123", false);

      // Should call with prod key, not sandbox key
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
        "Bearer prod-key"
      );
    });

    it("should use webSandbox key in test mode and skip web", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { web: "prod-key", webSandbox: "sandbox-key" },
      });
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_monthly",
                purchase_date: "2024-01-15T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_monthly: {
                expires_date: futureDate,
                purchase_date: "2024-01-15T00:00:00Z",
                sandbox: true,
                store: "stripe",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123", true);

      // Should call with sandbox key, not prod key
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
        "Bearer sandbox-key"
      );
      expect(result.entitlements).toEqual(["pro"]);
    });

    it("should filter sandbox environment on iOS in production mode", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { ios: "ios-key" },
      });
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_monthly",
                purchase_date: "2024-01-15T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_monthly: {
                expires_date: futureDate,
                purchase_date: "2024-01-15T00:00:00Z",
                sandbox: true,
                store: "app_store",
                environment: "sandbox",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123", false);

      expect(result.entitlements).toEqual([NONE_ENTITLEMENT]);
      expect(result.subscriptionStartedAt).toBeNull();
      expect(result.platform).toBeNull();
    });

    it("should include sandbox environment on iOS in test mode", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { ios: "ios-key" },
      });
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_monthly",
                purchase_date: "2024-01-15T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_monthly: {
                expires_date: futureDate,
                purchase_date: "2024-01-15T00:00:00Z",
                sandbox: true,
                store: "app_store",
                environment: "sandbox",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123", true);

      expect(result.entitlements).toEqual(["pro"]);
      expect(result.subscriptionStartedAt).toEqual(
        new Date("2024-01-15T00:00:00Z")
      );
      expect(result.platform).toBe(SubscriptionPlatform.iOS);
    });

    it("should filter sandbox environment on Android in production mode", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { android: "android-key" },
      });
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_monthly",
                purchase_date: "2024-01-15T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_monthly: {
                expires_date: futureDate,
                purchase_date: "2024-01-15T00:00:00Z",
                sandbox: true,
                store: "play_store",
                environment: "sandbox",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123", false);

      expect(result.entitlements).toEqual([NONE_ENTITLEMENT]);
      expect(result.platform).toBeNull();
    });

    it("should query multiple platforms and merge results", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { web: "web-key", ios: "ios-key" },
      });
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      // Web returns no entitlements (404)
      fetchMock.mockResolvedValueOnce({
        status: 404,
        ok: false,
      });
      // iOS returns active entitlement
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_annual",
                purchase_date: "2024-02-01T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_annual: {
                expires_date: futureDate,
                purchase_date: "2024-02-01T00:00:00Z",
                sandbox: false,
                store: "app_store",
                environment: "production",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123");

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.entitlements).toEqual(["pro"]);
      expect(result.subscriptionStartedAt).toEqual(
        new Date("2024-02-01T00:00:00Z")
      );
      expect(result.platform).toBe(SubscriptionPlatform.iOS);
    });

    it("should include sandbox environment on Android in test mode", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { android: "android-key" },
      });
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_monthly",
                purchase_date: "2024-01-15T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_monthly: {
                expires_date: futureDate,
                purchase_date: "2024-01-15T00:00:00Z",
                sandbox: true,
                store: "play_store",
                environment: "sandbox",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123", true);

      expect(result.entitlements).toEqual(["pro"]);
      expect(result.platform).toBe(SubscriptionPlatform.Android);
    });

    it("should include production environment on Android in production mode", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { android: "android-key" },
      });
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_monthly",
                purchase_date: "2024-06-01T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_monthly: {
                expires_date: futureDate,
                purchase_date: "2024-06-01T00:00:00Z",
                sandbox: false,
                store: "play_store",
                environment: "production",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123", false);

      expect(result.entitlements).toEqual(["pro"]);
      expect(result.subscriptionStartedAt).toEqual(
        new Date("2024-06-01T00:00:00Z")
      );
      expect(result.platform).toBe(SubscriptionPlatform.Android);
    });

    it("should filter sandbox environment on macOS in production mode", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { macos: "macos-key" },
      });
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_monthly",
                purchase_date: "2024-01-15T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_monthly: {
                expires_date: futureDate,
                purchase_date: "2024-01-15T00:00:00Z",
                sandbox: true,
                store: "mac_app_store",
                environment: "sandbox",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123", false);

      expect(result.entitlements).toEqual([NONE_ENTITLEMENT]);
      expect(result.platform).toBeNull();
    });

    it("should include sandbox environment on macOS in test mode", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { macos: "macos-key" },
      });
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_monthly",
                purchase_date: "2024-01-15T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_monthly: {
                expires_date: futureDate,
                purchase_date: "2024-01-15T00:00:00Z",
                sandbox: true,
                store: "mac_app_store",
                environment: "sandbox",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123", true);

      expect(result.entitlements).toEqual(["pro"]);
      expect(result.platform).toBe(SubscriptionPlatform.macOS);
    });

    it("should include production environment on macOS in production mode", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { macos: "macos-key" },
      });
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_annual",
                purchase_date: "2024-04-20T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_annual: {
                expires_date: futureDate,
                purchase_date: "2024-04-20T00:00:00Z",
                sandbox: false,
                store: "mac_app_store",
                environment: "production",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123", false);

      expect(result.entitlements).toEqual(["pro"]);
      expect(result.platform).toBe(SubscriptionPlatform.macOS);
    });

    it("should include production environment on iOS in production mode", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { ios: "ios-key" },
      });
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_annual",
                purchase_date: "2024-05-10T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_annual: {
                expires_date: futureDate,
                purchase_date: "2024-05-10T00:00:00Z",
                sandbox: false,
                store: "app_store",
                environment: "production",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123", false);

      expect(result.entitlements).toEqual(["pro"]);
      expect(result.platform).toBe(SubscriptionPlatform.iOS);
    });

    it("should use web key in test mode when no webSandbox key exists", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { web: "web-key" },
      });
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_monthly",
                purchase_date: "2024-01-15T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_monthly: {
                expires_date: futureDate,
                purchase_date: "2024-01-15T00:00:00Z",
                sandbox: true,
                store: "stripe",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123", true);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
        "Bearer web-key"
      );
      expect(result.entitlements).toEqual(["pro"]);
    });

    it("should pick platform from earliest purchase across platforms", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { web: "web-key", ios: "ios-key" },
      });
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      // Web returns entitlement with later purchase date
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              premium: {
                expires_date: futureDate,
                product_identifier: "premium_monthly",
                purchase_date: "2024-06-01T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              premium_monthly: {
                expires_date: futureDate,
                purchase_date: "2024-06-01T00:00:00Z",
                sandbox: false,
                store: "stripe",
              },
            },
          },
        }),
      });
      // iOS returns entitlement with earlier purchase date
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_annual",
                purchase_date: "2024-01-01T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_annual: {
                expires_date: futureDate,
                purchase_date: "2024-01-01T00:00:00Z",
                sandbox: false,
                store: "app_store",
                environment: "production",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123");

      expect(result.entitlements).toContain("premium");
      expect(result.entitlements).toContain("pro");
      expect(result.subscriptionStartedAt).toEqual(
        new Date("2024-01-01T00:00:00Z")
      );
      expect(result.platform).toBe(SubscriptionPlatform.iOS);
    });

    it("should deduplicate entitlements across platforms", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { web: "web-key", ios: "ios-key" },
      });
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      // Both platforms return the same "pro" entitlement
      const subscriberData = {
        subscriber: {
          entitlements: {
            pro: {
              expires_date: futureDate,
              product_identifier: "pro_monthly",
              purchase_date: "2024-03-01T00:00:00Z",
              grace_period_expires_date: null,
            },
          },
          subscriptions: {
            pro_monthly: {
              expires_date: futureDate,
              purchase_date: "2024-03-01T00:00:00Z",
              sandbox: false,
              store: "stripe",
            },
          },
        },
      };
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => subscriberData,
      });
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_annual",
                purchase_date: "2024-03-01T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_annual: {
                expires_date: futureDate,
                purchase_date: "2024-03-01T00:00:00Z",
                sandbox: false,
                store: "app_store",
                environment: "production",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123");

      // "pro" should appear only once
      expect(result.entitlements).toEqual(["pro"]);
    });

    it("should return none when all platforms return 404", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: {
          web: "web-key",
          ios: "ios-key",
          android: "android-key",
        },
      });

      fetchMock.mockResolvedValue({
        status: 404,
        ok: false,
      });

      const result = await helper.getSubscriptionInfo("user-123");

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(result.entitlements).toEqual([NONE_ENTITLEMENT]);
      expect(result.subscriptionStartedAt).toBeNull();
      expect(result.platform).toBeNull();
    });

    it("should query all configured platforms with correct keys", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: {
          web: "web-key",
          ios: "ios-key",
          android: "android-key",
          macos: "macos-key",
        },
      });

      fetchMock.mockResolvedValue({
        status: 404,
        ok: false,
      });

      await helper.getSubscriptionInfo("user-123");

      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
        "Bearer web-key"
      );
      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(
        "Bearer ios-key"
      );
      expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe(
        "Bearer android-key"
      );
      expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe(
        "Bearer macos-key"
      );
    });

    it("should query all platforms including webSandbox in test mode", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: {
          web: "web-key",
          webSandbox: "web-sandbox-key",
          ios: "ios-key",
        },
      });

      fetchMock.mockResolvedValue({
        status: 404,
        ok: false,
      });

      await helper.getSubscriptionInfo("user-123", true);

      // Should skip web (because webSandbox exists), use webSandbox + ios
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
        "Bearer web-sandbox-key"
      );
      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(
        "Bearer ios-key"
      );
    });

    it("should return none when no API keys are configured", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: {},
      });

      const result = await helper.getSubscriptionInfo("user-123");

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.entitlements).toEqual([NONE_ENTITLEMENT]);
      expect(result.platform).toBeNull();
    });
  });

  describe("getEntitlements", () => {
    it("should return just the entitlements array", async () => {
      const helper = new SubscriptionHelper({
        revenueCatApiKeys: { web: "test-web-key" },
      });
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_monthly",
                purchase_date: "2024-01-15T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_monthly: {
                expires_date: futureDate,
                purchase_date: "2024-01-15T00:00:00Z",
                sandbox: false,
                store: "stripe",
              },
            },
          },
        }),
      });

      const result = await helper.getEntitlements("user-123");

      expect(result).toEqual(["pro"]);
    });
  });
});
