import { sql } from "drizzle-orm"
import { integer, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { createCustomId } from "../../../utils/custom-id"

export const qrTypeEnum = pgEnum("qr_type", ["static", "dynamic"])
export const qrStatusEnum = pgEnum("qr_status", ["active", "paused", "archived"])

/**
 * A stored QR code.
 *
 * `encodedData` is the exact payload written into the QR image (computed from
 * `contentType` + `contentData` by the content codecs). For dynamic codes the
 * image encodes origin/shortCode instead and `destinationUrl` holds the current
 * redirect target, which may be edited at any time without reprinting the code.
 */
export const qrCodesTable = pgTable("qr_codes", {
  id: text()
    .primaryKey()
    .$defaultFn(() => createCustomId()),
  userId: text("user_id"),
  shortCode: text("short_code").unique(),
  contentType: text("content_type").notNull().default("url"),
  contentData: jsonb("content_data").$type<Record<string, unknown>>().notNull().default({}),
  encodedData: text("encoded_data").notNull().default(""),
  destinationUrl: text("destination_url"),
  title: text(),
  description: text(),
  type: qrTypeEnum().notNull().default("static"),
  status: qrStatusEnum().notNull().default("active"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  passwordHash: text("password_hash"),
  tags: text("tags")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  scanCount: integer("scan_count").notNull().default(0),
  uniqueScanCount: integer("unique_scan_count").notNull().default(0),
  lastScannedAt: timestamp("last_scanned_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export type QrCode = typeof qrCodesTable.$inferSelect
export type InsertQrCode = typeof qrCodesTable.$inferInsert
export type QrCodeStatus = QrCode["status"]
export type QrCodeType = QrCode["type"]
