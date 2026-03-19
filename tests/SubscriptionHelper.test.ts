import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NONE_ENTITLEMENT, SubscriptionPlatform } from "@sudobility/types";
import { SubscriptionHelper } from "../src/helpers/SubscriptionHelper";

describe("NONE_ENTITLEMENT", () => {
  it("should be 'none'", () => {
    expect(NONE_ENTITLEMENT).toBe("none");
  });
});

describe("SubscriptionHelper", () => {
  let helper: SubscriptionHelper;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    helper = new SubscriptionHelper({
      revenueCatApiKey: "test-api-key",
    });
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("getSubscriptionInfo", () => {
    it("should return none entitlement when user not found (404)", async () => {
      fetchMock.mockResolvedValueOnce({
        status: 404,
        ok: false,
      });

      const result = await helper.getSubscriptionInfo("user-123");

      expect(result.entitlements).toEqual([NONE_ENTITLEMENT]);
      expect(result.subscriptionStartedAt).toBeNull();
      expect(result.platform).toBeNull();
      expect(result.productIdentifier).toBeNull();
      expect(result.expiresDate).toBeNull();
      expect(result.sandbox).toBe(false);
      expect(result.store).toBeNull();
    });

    it("should throw error on API failure", async () => {
      fetchMock.mockResolvedValueOnce({
        status: 500,
        ok: false,
        statusText: "Internal Server Error",
      });

      await expect(helper.getSubscriptionInfo("user-123")).rejects.toThrow(
        "RevenueCat API error: 500 Internal Server Error"
      );
    });

    it("should return active entitlements", async () => {
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
                store: "app_store",
                environment: "production",
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
      expect(result.productIdentifier).toBe("pro_monthly");
      expect(result.expiresDate).toEqual(new Date(futureDate));
      expect(result.sandbox).toBe(false);
      expect(result.store).toBe("app_store");
    });

    it("should filter expired entitlements", async () => {
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
                store: "app_store",
                environment: "production",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123");

      expect(result.entitlements).toEqual([NONE_ENTITLEMENT]);
      expect(result.subscriptionStartedAt).toBeNull();
      expect(result.platform).toBeNull();
      expect(result.productIdentifier).toBeNull();
      expect(result.expiresDate).toBeNull();
      expect(result.sandbox).toBe(false);
      expect(result.store).toBeNull();
    });

    it("should filter sandbox purchases in production mode", async () => {
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
      expect(result.productIdentifier).toBeNull();
      expect(result.expiresDate).toBeNull();
      expect(result.sandbox).toBe(false);
      expect(result.store).toBeNull();
    });

    it("should include sandbox purchases in test mode", async () => {
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
      expect(result.productIdentifier).toBe("pro_monthly");
      expect(result.sandbox).toBe(true);
      expect(result.store).toBe("app_store");
    });

    it("should return earliest purchase date with multiple entitlements", async () => {
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
                store: "app_store",
                environment: "production",
              },
              bandwidth_addon: {
                expires_date: futureDate,
                purchase_date: "2024-01-10T00:00:00Z",
                sandbox: false,
                store: "app_store",
                environment: "production",
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
    });

    // --- Platform detection tests ---

    it("should detect Web platform from stripe store", async () => {
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
                environment: "production",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123");

      expect(result.platform).toBe(SubscriptionPlatform.Web);
    });

    it("should detect Web platform from rc_billing store", async () => {
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
                store: "rc_billing",
                environment: "production",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123");

      expect(result.platform).toBe(SubscriptionPlatform.Web);
    });

    it("should detect iOS platform from app_store", async () => {
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
                store: "app_store",
                environment: "production",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123");

      expect(result.platform).toBe(SubscriptionPlatform.iOS);
    });

    it("should detect Android platform from play_store", async () => {
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
                store: "play_store",
                environment: "production",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123");

      expect(result.platform).toBe(SubscriptionPlatform.Android);
    });

    it("should detect macOS platform from mac_app_store", async () => {
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
                store: "mac_app_store",
                environment: "production",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123");

      expect(result.platform).toBe(SubscriptionPlatform.macOS);
    });

    it("should return null platform for unknown store", async () => {
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
                store: "amazon",
                environment: "production",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123");

      expect(result.entitlements).toEqual(["pro"]);
      expect(result.platform).toBeNull();
    });

    it("should detect platform from earliest subscription across mixed stores", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_web",
                purchase_date: "2024-06-01T00:00:00Z",
                grace_period_expires_date: null,
              },
              premium: {
                expires_date: futureDate,
                product_identifier: "premium_ios",
                purchase_date: "2024-01-01T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_web: {
                expires_date: futureDate,
                purchase_date: "2024-06-01T00:00:00Z",
                sandbox: false,
                store: "stripe",
                environment: "production",
              },
              premium_ios: {
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

      expect(result.entitlements).toContain("pro");
      expect(result.entitlements).toContain("premium");
      // Platform should be iOS since it has the earliest purchase
      expect(result.subscriptionStartedAt).toEqual(
        new Date("2024-01-01T00:00:00Z")
      );
      expect(result.platform).toBe(SubscriptionPlatform.iOS);
    });

    it("should filter sandbox from some entitlements while keeping production ones", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_prod",
                purchase_date: "2024-03-01T00:00:00Z",
                grace_period_expires_date: null,
              },
              beta: {
                expires_date: futureDate,
                product_identifier: "beta_test",
                purchase_date: "2024-01-01T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_prod: {
                expires_date: futureDate,
                purchase_date: "2024-03-01T00:00:00Z",
                sandbox: false,
                store: "app_store",
                environment: "production",
              },
              beta_test: {
                expires_date: futureDate,
                purchase_date: "2024-01-01T00:00:00Z",
                sandbox: true,
                store: "app_store",
                environment: "sandbox",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123", false);

      // Only production entitlement should remain
      expect(result.entitlements).toEqual(["pro"]);
      expect(result.subscriptionStartedAt).toEqual(
        new Date("2024-03-01T00:00:00Z")
      );
      expect(result.platform).toBe(SubscriptionPlatform.iOS);
    });

    it("should include all entitlements including sandbox in test mode", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          subscriber: {
            entitlements: {
              pro: {
                expires_date: futureDate,
                product_identifier: "pro_prod",
                purchase_date: "2024-03-01T00:00:00Z",
                grace_period_expires_date: null,
              },
              beta: {
                expires_date: futureDate,
                product_identifier: "beta_test",
                purchase_date: "2024-01-01T00:00:00Z",
                grace_period_expires_date: null,
              },
            },
            subscriptions: {
              pro_prod: {
                expires_date: futureDate,
                purchase_date: "2024-03-01T00:00:00Z",
                sandbox: false,
                store: "play_store",
                environment: "production",
              },
              beta_test: {
                expires_date: futureDate,
                purchase_date: "2024-01-01T00:00:00Z",
                sandbox: true,
                store: "play_store",
                environment: "sandbox",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123", true);

      expect(result.entitlements).toContain("pro");
      expect(result.entitlements).toContain("beta");
      expect(result.subscriptionStartedAt).toEqual(
        new Date("2024-01-01T00:00:00Z")
      );
      expect(result.platform).toBe(SubscriptionPlatform.Android);
    });
  });

  describe("getEntitlements", () => {
    it("should return just the entitlements array", async () => {
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
                store: "app_store",
                environment: "production",
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
