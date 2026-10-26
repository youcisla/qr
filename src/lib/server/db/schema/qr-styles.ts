import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import type { QrDesign } from "../../../qr/types"
import { createCustomId } from "../../../utils/custom-id"
import { qrCodesTable } from "./qr-codes"

/**
 * Visual design of a QR code, stored as a full QrDesign JSON document so the
 * engine can evolve additively without further migrations. One row per code.
 */
export const qrStylesTable = pgTable("qr_styles", {
  id: text()
    .primaryKey()
    .$defaultFn(() => createCustomId()),
  qrCodeId: text("qr_code_id")
    .notNull()
    .unique()
    .references(() => qrCodesTable.id, { onDelete: "cascade" }),
  design: jsonb("design").$type<QrDesign>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export type QrStyle = typeof qrStylesTable.$inferSelect
export type InsertQrStyle = typeof qrStylesTable.$inferInsert
