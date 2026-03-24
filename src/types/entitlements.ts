/**
 * @fileoverview RevenueCat API response types for the subscriber endpoint.
 *
 * These interfaces model the JSON response from RevenueCat's
 * `GET /v1/subscribers/{user_id}` endpoint.
 */

/**
 * RevenueCat entitlement information from the subscriber API.
 */
export interface RevenueCatEntitlement {
  /** Expiration date in ISO format, or null if lifetime */
  expires_date: string | null;
  /** Grace period expiration date */
  grace_period_expires_date: string | null;
  /** Product identifier in the app store */
  product_identifier: string;
  /** Purchase date in ISO format */
  purchase_date: string;
}

/**
 * RevenueCat subscription information from the subscriber API.
 */
export interface RevenueCatSubscription {
  /** Expiration date in ISO format, or null if lifetime */
  expires_date: string | null;
  /** Purchase date in ISO format */
  purchase_date: string;
  /** Whether this is a sandbox purchase */
  sandbox: boolean;
  /** Store where the purchase was made */
  store: string;
  /** Environment: "sandbox" or "production" (present on iOS/Android/macOS subscriptions) */
  environment?: string;
  /** When unsubscribe was detected, null if still subscribed */
  unsubscribe_detected_at: string | null;
}

/**
 * Response shape from RevenueCat's GET /subscribers/{user_id} endpoint.
 */
export interface RevenueCatSubscriberResponse {
  subscriber: {
    entitlements: {
      [key: string]: RevenueCatEntitlement;
    };
    subscriptions: {
      [key: string]: RevenueCatSubscription;
    };
    /** URL for managing the subscription (e.g., Stripe billing portal) */
    management_url: string | null;
  };
}
