# Subscription Service

Shared rate limiting library based on RevenueCat entitlements.

**npm**: `@sudobility/subscription_service` (public)

## Tech Stack

- **Language**: TypeScript
- **Build**: Dual ESM/CJS output
- **Runtime**: Bun
- **Peer Dependencies**: drizzle-orm, hono

## Project Structure

```
src/
├── index.ts                    # Main exports
├── types/
│   ├── index.ts                # Type re-exports
│   ├── rate-limits.ts          # RateLimits, RateLimitsConfig
│   ├── entitlements.ts         # RevenueCat types
│   └── responses.ts            # RateLimitCheckResult
├── schema/
│   └── rate-limits.ts          # Drizzle schema template
├── helpers/
│   ├── index.ts                # Helper exports
│   ├── RevenueCatHelper.ts     # Get entitlements from RC API
│   ├── EntitlementHelper.ts    # Resolve rate limits
│   └── RateLimitChecker.ts     # Check/increment counters
├── middleware/
│   └── hono.ts                 # Hono middleware factory
└── utils/
    └── time.ts                 # Reset time utilities
tests/
└── *.test.ts
```

## Commands

```bash
bun run build        # Build ESM + CJS
bun run clean        # Remove dist/
bun run dev          # Watch mode
bun test             # Run tests
bun run lint         # Run ESLint
bun run typecheck    # TypeScript check
bun run verify       # All checks + build
```

## Key Classes

### RevenueCatHelper
Gets user entitlements from RevenueCat API. Returns `["none"]` if no subscription.

### EntitlementHelper
Resolves rate limits from entitlements. Supports multiple entitlements with upper-bound logic.

### RateLimitChecker
Checks rate limits against database and increments counters. Handles automatic counter resets.

### createRateLimitMiddleware
Factory for Hono middleware that combines all helpers.

## Usage Example

```typescript
import { createRateLimitMiddleware } from "@sudobility/subscription_service/middleware/hono";
import type { RateLimitsConfig } from "@sudobility/subscription_service";

const config: RateLimitsConfig = {
  none: { hourly: 5, daily: 20, monthly: 100 },
  pro: { hourly: undefined, daily: undefined, monthly: undefined },
};

const middleware = createRateLimitMiddleware({
  revenueCatApiKey: process.env.REVENUECAT_API_KEY!,
  rateLimitsConfig: config,
  db,
  rateLimitsTable: rateLimits,
  getUserId: (c) => c.get("firebaseUser").uid,
});

app.use("/api/*", middleware);
```

## Database Schema

Consuming APIs must copy the schema template to their own database:

```typescript
// Copy from @sudobility/subscription_service/schema
export const rateLimits = pgTable("rate_limits", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: varchar("user_id", { length: 128 }).notNull().unique(),
  requests_this_hour: integer("requests_this_hour").notNull().default(0),
  requests_this_day: integer("requests_this_day").notNull().default(0),
  requests_this_month: integer("requests_this_month").notNull().default(0),
  hour_reset_at: timestamp("hour_reset_at"),
  day_reset_at: timestamp("day_reset_at"),
  month_reset_at: timestamp("month_reset_at"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});
```

## Consuming APIs

- sudojo_api
- shapeshyft_api
- whisperly_api
