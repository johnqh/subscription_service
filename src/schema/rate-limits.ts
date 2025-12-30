/**
 * Drizzle schema template for rate limit tracking with history.
 *
 * USAGE: Copy this schema definition into your API's db/schema.ts file.
 * The consuming API owns this table and is responsible for migrations.
 *
 * You may need to adjust:
 * - The schema name (if using PostgreSQL schemas)
 * - Foreign key references to your users table
 * - Index names to avoid conflicts
 */

import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/**
 * Rate limit counters table for tracking per-user request counts with history.
 *
 * Each row represents a specific time period's counter:
 * - period_type: 'hourly' | 'daily' | 'monthly'
 * - period_start: Start timestamp of the period
 * - request_count: Number of requests in this period
 *
 * History is preserved - old periods are NOT deleted.
 * This allows showing usage history on UI.
 *
 * Period calculation:
 * - Hourly: top of hour (e.g., 10:00:00, 11:00:00)
 * - Daily: UTC midnight (e.g., 2025-01-15T00:00:00Z)
 * - Monthly: based on subscription start date
 *   (e.g., if subscription started 3/5, months are 3/5-4/4, 4/5-5/4, etc.)
 */
export const rateLimitCounters = pgTable(
  "rate_limit_counters",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /**
     * User identifier. This should match your auth system's user ID.
     * Examples: Firebase UID, RevenueCat app_user_id, etc.
     */
    user_id: varchar("user_id", { length: 128 }).notNull(),

    /**
     * Type of time period: 'hourly', 'daily', or 'monthly'
     */
    period_type: varchar("period_type", { length: 16 }).notNull(),

    /**
     * Start timestamp of this period.
     * - For hourly: top of hour in UTC
     * - For daily: midnight UTC
     * - For monthly: subscription month start date
     */
    period_start: timestamp("period_start", { withTimezone: true }).notNull(),

    /**
     * Number of requests made in this period.
     */
    request_count: integer("request_count").notNull().default(0),

    // Audit timestamps
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  table => ({
    // Unique constraint: one row per user per period type per period start
    userPeriodUniqueIdx: uniqueIndex("rate_limit_counters_user_period_idx").on(
      table.user_id,
      table.period_type,
      table.period_start
    ),
    // Index for history queries
    userTypeIdx: index("rate_limit_counters_user_type_idx").on(
      table.user_id,
      table.period_type
    ),
  })
);

/**
 * TypeScript type for the rate_limit_counters table row (select)
 */
export type RateLimitCounterRecord = typeof rateLimitCounters.$inferSelect;

/**
 * TypeScript type for inserting into rate_limit_counters table
 */
export type NewRateLimitCounterRecord = typeof rateLimitCounters.$inferInsert;
