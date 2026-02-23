# subscription_service - Improvement Plans

## Priority 1: Code Quality

### 1.1 Remove unused `tsconfig.cjs.json`
- **File**: `tsconfig.cjs.json`
- **Issue**: A CJS tsconfig exists but the build script only uses `tsconfig.esm.json`. The dead config file creates confusion.
- **Fix**: Delete `tsconfig.cjs.json` or add a CJS build step if dual output is desired.

### 1.2 Add response caching / rate limiting
- **File**: `src/helpers/SubscriptionHelper.ts`
- **Issue**: Every call to `getEntitlements()` or `getSubscriptionInfo()` makes a fresh HTTP request to RevenueCat. In high-traffic scenarios, this could be excessive and slow.
- **Fix**: Add an optional in-memory cache with configurable TTL (e.g., 60 seconds). The cache key would be `userId + testMode`.

### 1.3 Add input validation
- **File**: `src/helpers/SubscriptionHelper.ts`
- **Issue**: No validation on `userId` parameter. Empty strings, null, or undefined could produce unexpected API calls or errors.
- **Fix**: Validate that `userId` is a non-empty string and throw a descriptive error early.

## Priority 2: Testing

### 2.1 Add edge case tests
- **File**: `tests/SubscriptionHelper.test.ts`
- **Issue**: Tests cover the main flows but miss edge cases like: empty entitlements object, entitlements without matching subscriptions, lifetime entitlements (null `expires_date`), malformed dates, network errors (fetch rejection).
- **Fix**: Add test cases for these scenarios.

### 2.2 Add integration test infrastructure
- **Issue**: All tests mock `fetch`. There is no way to run tests against the actual RevenueCat API (even in sandbox mode).
- **Fix**: Add an optional integration test suite that runs against RevenueCat sandbox with a test API key from environment variables.

### 2.3 Add custom `baseUrl` test
- **Issue**: The `baseUrl` configuration option is not tested. The test always uses the default URL.
- **Fix**: Add a test that provides a custom `baseUrl` and verifies the fetch URL matches.

## Priority 3: Architecture

### 3.1 Support multiple entitlement sources
- **Issue**: The helper only supports RevenueCat. If a future project uses a different payment provider, a new helper would be needed.
- **Fix**: Consider extracting an `EntitlementProvider` interface similar to subscription_lib's adapter pattern, making RevenueCat one implementation.

### 3.2 Add subscription tier/level information
- **Issue**: The helper returns entitlement names but no information about the subscription tier or level. Consuming APIs often need to know if a user is on "basic" vs "pro".
- **Fix**: Consider adding an optional `tier` or `level` field to `SubscriptionInfo` derived from the entitlement name or product identifier.

### 3.3 Export `NONE_ENTITLEMENT` constant directly
- **Issue**: Consumers must import `NONE_ENTITLEMENT` from `@sudobility/types` separately. Since this library always uses it, re-exporting would be more convenient.
- **Fix**: Add `export { NONE_ENTITLEMENT } from "@sudobility/types"` to the barrel export.

## Priority 4: Developer Experience

### 4.1 Add CHANGELOG.md
- **Issue**: No changelog exists for tracking version history and breaking changes.
- **Fix**: Add a CHANGELOG.md following Keep a Changelog format.

### 4.2 Improve error messages
- **File**: `src/helpers/SubscriptionHelper.ts`
- **Issue**: The error thrown on non-OK responses includes status and statusText but not the response body, which often contains useful diagnostic information from RevenueCat.
- **Fix**: Parse and include the response body in the error message (truncated to a reasonable length).

### 4.3 Add request timeout
- **File**: `src/helpers/SubscriptionHelper.ts`
- **Issue**: No timeout is configured for the RevenueCat API call. A slow or unresponsive API could hang indefinitely.
- **Fix**: Add an `AbortController` with a configurable timeout (defaulting to 10 seconds).

### 4.4 Add structured logging
- **Issue**: No logging exists in the helper. Failed requests are thrown as errors but there is no debug-level logging for successful operations.
- **Fix**: Add optional structured logging (e.g., accepting a logger interface in config) for request/response details.
