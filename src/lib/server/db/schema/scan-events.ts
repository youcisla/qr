import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { createCustomId } from "../../../utils/custom-id"
import { qrCodesTable } from "./qr-codes"

/**
 * One row per scan of a dynamic QR code. Aggregations are computed on demand
 * (see src/lib/server/analytics/stats.ts); a retention policy can prune old
 * rows without touching the counters on qr_codes.
 */
export const scanEventsTable = pgTable(
  "scan_events",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => createCustomId()),
    qrCodeId: text("qr_code_id")
      .notNull()
      .references(() => qrCodesTable.id, { onDelete: "cascade" }),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).defaultNow().notNull(),
    country: text(),
    region: text(),
    city: text(),
    deviceType: text("device_type"),
    os: text(),
    browser: text(),
    referer: text(),
    userAgent: text("user_agent"),
    /** Salted hash of the client IP. Never store the raw address. */
    ipHash: text("ip_hash"),
    /** Salted hash of (ip + user agent), used for the unique-scan heuristic. */
    visitorHash: text("visitor_hash"),
    isUnique: boolean("is_unique").notNull().default(true),
  },
  (table) => [index("scan_events_qr_code_scanned_at_idx").on(table.qrCodeId, table.scannedAt)],
)

export type ScanEvent = typeof scanEventsTable.$inferSelect
export type InsertScanEvent = typeof scanEventsTable.$inferInsert
