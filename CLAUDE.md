# Subscription Service

Shared backend library for subscription management using RevenueCat.

**npm**: `@sudobility/subscription_service` (public)

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: Bun
- **Package Manager**: Bun (do not use npm/yarn/pnpm for installing dependencies)
- **Build**: TypeScript compiler (ESM)
- **Test**: vitest

## Project Structure

```
src/
├── index.ts                    # Main exports
├── types/
│   ├── index.ts                # Type re-exports
│   ├── entitlements.ts         # RevenueCat API types
│   └── subscription.ts         # SubscriptionInfo type
└── helpers/
    ├── index.ts                # Helper re-exports
    └── SubscriptionHelper.ts   # RevenueCat API client
tests/
└── *.test.ts
```

## Commands

```bash
bun run build        # Build ESM
bun run clean        # Remove dist/
bun run dev          # Watch mode
bun test             # Run tests
bun run lint         # Run ESLint
bun run typecheck    # TypeScript check
bun run verify       # All checks + build (use before commit)
```

## Key Concepts

### SubscriptionHelper

Fetches user entitlements from RevenueCat API v1.

- Uses RevenueCat secret API key (server-side only)
- Supports testMode to include/exclude sandbox purchases
- Returns `["none"]` if user has no active entitlements

### testMode Parameter

- `testMode=true`: Accept sandbox purchases (for testing)
- `testMode=false` (default): Reject sandbox purchases (production)

The helper checks each subscription's `sandbox` flag and filters accordingly.

## Usage

```typescript
import { SubscriptionHelper, NONE_ENTITLEMENT } from "@sudobility/subscription_service";

const helper = new SubscriptionHelper({
  revenueCatApiKey: process.env.REVENUECAT_API_KEY!,
});

// Get entitlements (production mode - no sandbox)
const entitlements = await helper.getEntitlements(userId);
// Returns: ["pro"] or ["none"]

// Get entitlements (test mode - includes sandbox)
const entitlements = await helper.getEntitlements(userId, true);

// Get full subscription info
const info = await helper.getSubscriptionInfo(userId, testMode);
// Returns: { entitlements: ["pro"], subscriptionStartedAt: Date | null }

// Check if user has a subscription
if (!info.entitlements.includes(NONE_ENTITLEMENT)) {
  // User has active subscription
}
```

## Architecture

```
subscription_service (this package)
    ↑
ratelimit_service (depends on this)
    ↑
shapeshyft_api, sudojo_api, etc.
```

## Consuming APIs

APIs using this library:
- shapeshyft_api
- sudojo_api
- whisperly_api
- ratelimit_service

## Publishing

```bash
bun run verify       # All checks
npm publish          # Publish to npm
```
