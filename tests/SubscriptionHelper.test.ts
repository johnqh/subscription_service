import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NONE_ENTITLEMENT } from "../src/types";
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
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123");

      expect(result.entitlements).toEqual(["pro"]);
      expect(result.subscriptionStartedAt).toEqual(new Date("2024-01-15T00:00:00Z"));
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
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123");

      expect(result.entitlements).toEqual([NONE_ENTITLEMENT]);
      expect(result.subscriptionStartedAt).toBeNull();
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
              },
            },
          },
        }),
      });

      // testMode = false (production) - should filter sandbox
      const result = await helper.getSubscriptionInfo("user-123", false);

      expect(result.entitlements).toEqual([NONE_ENTITLEMENT]);
      expect(result.subscriptionStartedAt).toBeNull();
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
              },
            },
          },
        }),
      });

      // testMode = true - should include sandbox
      const result = await helper.getSubscriptionInfo("user-123", true);

      expect(result.entitlements).toEqual(["pro"]);
      expect(result.subscriptionStartedAt).toEqual(new Date("2024-01-15T00:00:00Z"));
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
              },
              bandwidth_addon: {
                expires_date: futureDate,
                purchase_date: "2024-01-10T00:00:00Z",
                sandbox: false,
                store: "app_store",
              },
            },
          },
        }),
      });

      const result = await helper.getSubscriptionInfo("user-123");

      expect(result.entitlements).toContain("pro");
      expect(result.entitlements).toContain("bandwidth");
      expect(result.subscriptionStartedAt).toEqual(new Date("2024-01-10T00:00:00Z"));
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
