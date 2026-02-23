# Subscription Service - AI Development Guide

## Overview

Shared backend library for subscription management using RevenueCat. Provides a `SubscriptionHelper` class that calls the RevenueCat REST API v1 to fetch user entitlements and subscription information. Designed for server-side use only (requires a secret API key).

- **Package**: `@sudobility/subscription_service`
- **Version**: 1.0.5
- **License**: BUSL-1.1
- **Package Manager**: Bun (do not use npm/yarn/pnpm for installing dependencies)
- **Registry**: npm (public, `@sudobility` scope)

## Project Structure

```
src/
├── index.ts                    # Main barrel exports
├── types/
│   ├── index.ts                # Type re-exports
│   ├── entitlements.ts         # RevenueCat API response types
│   └── subscription.ts         # SubscriptionInfo type
└── helpers/
    ├── index.ts                # Helper re-exports
    └── SubscriptionHelper.ts   # RevenueCat API client class
tests/
└── SubscriptionHelper.test.ts  # Vitest tests (mocked fetch)
```

## Key Exports

| Export | Type | Description |
|---|---|---|
| `SubscriptionHelper` | class | Main API client for RevenueCat entitlements |
| `SubscriptionHelperConfig` | interface | Config with `revenueCatApiKey` and optional `baseUrl` |
| `SubscriptionInfo` | interface | Return type with `entitlements` and `subscriptionStartedAt` |
| `RevenueCatEntitlement` | interface | Raw entitlement from RevenueCat API |
| `RevenueCatSubscription` | interface | Raw subscription from RevenueCat API |
| `RevenueCatSubscriberResponse` | interface | Full subscriber response shape |

## Development Commands

```bash
bun run build        # Build ESM (tsc -p tsconfig.esm.json)
bun run clean        # Remove dist/
bun run dev          # Watch mode (tsc --watch)
bun test             # Run tests (vitest run)
bun run test:watch   # Watch mode tests (vitest)
bun run lint         # Run ESLint (eslint src/)
bun run lint:fix     # ESLint auto-fix
bun run typecheck    # TypeScript check (tsc --noEmit)
bun run format       # Prettier format
bun run format:check # Prettier check
bun run verify       # All checks + build (typecheck -> lint -> test -> build)
npm publish          # Publish to npm (public @sudobility scope)
```

## Key Concepts

### SubscriptionHelper

Fetches user entitlements from RevenueCat API v1 (`GET /subscribers/{user_id}`).

- Uses RevenueCat secret API key (server-side only)
- Supports `testMode` to include/exclude sandbox purchases
- Returns `["none"]` (the `NONE_ENTITLEMENT` constant from `@sudobility/types`) if user has no active entitlements
- Tracks the earliest `purchase_date` across all active entitlements as `subscriptionStartedAt`

### Methods

| Method | Signature | Description |
|---|---|---|
| `getEntitlements` | `(userId, testMode?) => Promise<string[]>` | Get active entitlement names |
| `getSubscriptionInfo` | `(userId, testMode?) => Promise<SubscriptionInfo>` | Get entitlements + subscription start date |

### testMode Parameter

- `testMode=true`: Accept sandbox purchases (for testing)
- `testMode=false` (default): Reject sandbox purchases (production)

The helper checks each subscription's `sandbox` flag and filters accordingly.

## Usage

```typescript
import { SubscriptionHelper } from "@sudobility/subscription_service";
import { NONE_ENTITLEMENT } from "@sudobility/types";

const helper = new SubscriptionHelper({
  revenueCatApiKey: process.env.REVENUECAT_API_KEY!,
});

// Get entitlements (production mode - no sandbox)
const entitlements = await helper.getEntitlements(userId);
// Returns: ["pro"] or ["none"]

// Get entitlements (test mode - includes sandbox)
const testEntitlements = await helper.getEntitlements(userId, true);

// Get full subscription info
const info = await helper.getSubscriptionInfo(userId, testMode);
// Returns: { entitlements: ["pro"], subscriptionStartedAt: Date | null }

// Check if user has a subscription
if (!info.entitlements.includes(NONE_ENTITLEMENT)) {
  // User has active subscription
}
```

## Architecture

### TypeScript Configuration

- Base `tsconfig.json`: strict mode, ES2020 target, bundler module resolution, `noEmit: true`
- `tsconfig.esm.json`: extends base, adds ESNext module output to `./dist`, declaration + declarationMap + sourceMap
- `tsconfig.cjs.json`: exists but build script uses ESM config only

### Build Output

- ESM-only output to `./dist/`
- Declaration files (`.d.ts`) and declaration maps (`.d.ts.map`) included
- Source maps enabled
- Published files: `dist/**/*` and `CLAUDE.md`

### Dependency Graph

```
@sudobility/types (peer dependency - provides NONE_ENTITLEMENT)
    |
subscription_service (this package)
    ^
ratelimit_service (depends on this)
    ^
shapeshyft_api, sudojo_api, whisperly_api
```

## Consuming APIs

APIs using this library:
- shapeshyft_api
- sudojo_api
- whisperly_api
- ratelimit_service

## Testing

- Framework: Vitest (vitest run)
- Tests located in `tests/` directory (not alongside source)
- Uses `vi.fn()` and `vi.stubGlobal("fetch", ...)` to mock HTTP calls
- Tests cover: 404 handling, API errors, active entitlements, expired entitlements, sandbox filtering, test mode, multiple entitlements with earliest date

## Publishing

```bash
bun run verify       # All checks (typecheck -> lint -> test -> build)
npm publish          # Publish to npm
```

## Local Dev Workflow

```bash
# In this project:
bun link

# In consuming API:
bun link @sudobility/subscription_service

# Rebuild after changes:
bun run build

# When done, unlink:
bun unlink @sudobility/subscription_service && bun install
```

## Peer / Key Dependencies

### Peer Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@sudobility/types` | `^1.9.53` | Provides `NONE_ENTITLEMENT` constant |

### Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| `typescript` | ^5.9.0 | Compiler |
| `vitest` | ^4.0.4 | Test runner |
| `eslint` | ^9.39.0 | Linter |
| `prettier` | ^3.7.0 | Formatter |
| `@typescript-eslint/eslint-plugin` | ^8.50.0 | TS-aware ESLint rules |
| `@typescript-eslint/parser` | ^8.50.0 | TS ESLint parser |
| `eslint-plugin-import` | ^2.32.0 | Import order/validation rules |
| `@types/bun` | latest | Bun runtime types |
| `@types/node` | ^24.0.0 | Node.js type definitions |

## Workspace Context

This project is part of the Sudobility multi-project workspace at the parent directory. See `../CLAUDE.md` for the full architecture, dependency graph, and build order.

## Pre-Commit Checklist

```bash
bun run verify    # Runs: typecheck -> lint -> test -> build
```

## Gotchas

- **No runtime dependencies** -- Only `@sudobility/types` as a peer dependency (for `NONE_ENTITLEMENT`). All HTTP calls use native `fetch`.
- **RevenueCat API key is a server-side secret** -- never expose it to the client.
- **`testMode` controls sandbox filtering** -- in production, always pass `false`. Passing `true` includes sandbox purchases with fake entitlements.
- **`NONE_ENTITLEMENT` is the string `"none"`** -- it is a constant imported from `@sudobility/types`, not null/undefined. Always compare with `NONE_ENTITLEMENT`.
- **ESM-only output** -- no CJS build. The `tsconfig.cjs.json` exists but is unused by the build script.
- **404 from RevenueCat returns `["none"]`** -- Not an error; it means the user has never been seen by RevenueCat.
- **`baseUrl` defaults to `https://api.revenuecat.com/v1`** -- Override for testing with a mock server.
- **User ID is URL-encoded** -- `encodeURIComponent(userId)` is applied before constructing the API URL.
