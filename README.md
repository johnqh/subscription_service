# @sudobility/subscription_service

Shared backend library for subscription management using RevenueCat. Provides a `SubscriptionHelper` class that calls the RevenueCat REST API v1 to fetch user entitlements and subscription information. Server-side only.

## Installation

```bash
bun add @sudobility/subscription_service
```

### Peer Dependencies

- `@sudobility/types` ^1.9.53

## Usage

```typescript
import { SubscriptionHelper } from '@sudobility/subscription_service';
import { NONE_ENTITLEMENT } from '@sudobility/types';

const helper = new SubscriptionHelper({
  revenueCatApiKey: process.env.REVENUECAT_API_KEY!,
});

// Get active entitlement names
const entitlements = await helper.getEntitlements(userId);
// Returns: ["pro"] or ["none"]

// Get full subscription info
const info = await helper.getSubscriptionInfo(userId);
// Returns: { entitlements: ["pro"], subscriptionStartedAt: Date | null }

// Check subscription status
if (!info.entitlements.includes(NONE_ENTITLEMENT)) {
  // User has active subscription
}
```

## API

### SubscriptionHelper

| Method | Signature | Description |
|--------|-----------|-------------|
| `getEntitlements` | `(userId, testMode?) => Promise<string[]>` | Get active entitlement names |
| `getSubscriptionInfo` | `(userId, testMode?) => Promise<SubscriptionInfo>` | Entitlements + subscription start date |

### Configuration

```typescript
interface SubscriptionHelperConfig {
  revenueCatApiKey: string;
  baseUrl?: string; // Default: https://api.revenuecat.com/v1
}
```

### Type Exports

| Export | Description |
|--------|-------------|
| `SubscriptionHelper` | Main API client class |
| `SubscriptionHelperConfig` | Config interface |
| `SubscriptionInfo` | Return type: `{ entitlements, subscriptionStartedAt }` |
| `RevenueCatEntitlement` | Raw entitlement from RevenueCat API |
| `RevenueCatSubscription` | Raw subscription from RevenueCat API |
| `RevenueCatSubscriberResponse` | Full subscriber response shape |
| `NONE_ENTITLEMENT` | Re-exported from `@sudobility/types` |

## Development

```bash
bun run verify       # All checks + build (typecheck -> lint -> test -> build)
bun run build        # Build ESM (tsc)
bun test             # Run tests (vitest run)
bun run typecheck    # TypeScript check
bun run lint         # ESLint
bun run format       # Prettier
```

## License

BUSL-1.1
