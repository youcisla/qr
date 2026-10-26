import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { createCustomId } from "../../../utils/custom-id"

/** Programmatic API key. Only a hash of the secret is stored. */
export const apiKeysTable = pgTable(
  "api_keys",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => createCustomId()),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    /** Public prefix shown in the UI and used to look the key up. */
    prefix: text("prefix").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [index("api_keys_user_id_idx").on(table.userId)],
)

export type ApiKey = typeof apiKeysTable.$inferSelect
export type InsertApiKey = typeof apiKeysTable.$inferInsert
