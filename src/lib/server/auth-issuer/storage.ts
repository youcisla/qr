import type { StorageAdapter } from "@openauthjs/openauth/storage/storage"
import { joinKey, splitKey } from "@openauthjs/openauth/storage/storage"
import { sql } from "drizzle-orm"

import { db } from "$lib/server/db"

export function postgresStorage(): StorageAdapter {
  return {
    async get(key) {
      const rows = (await db.execute(sql`
        select value from auth_storage
        where key = ${joinKey(key)} and (expires_at is null or expires_at > now())
      `)) as unknown as Array<{ value: unknown }>
      return rows[0]?.value as Record<string, unknown> | undefined
    },
    async set(key, value, expiry) {
      await db.execute(sql`
        insert into auth_storage (key, value, expires_at)
        values (${joinKey(key)}, ${JSON.stringify(value)}::jsonb, ${expiry ? expiry.toISOString() : null}::timestamptz)
        on conflict (key) do update set value = excluded.value, expires_at = excluded.expires_at
      `)
    },
    async remove(key) {
      await db.execute(sql`delete from auth_storage where key = ${joinKey(key)}`)
    },
    async *scan(prefix) {
      const prefixStr = joinKey(prefix)
      const rows = (await db.execute(sql`
        select key, value from auth_storage
        where key like ${prefixStr + "%"} and (expires_at is null or expires_at > now())
      `)) as unknown as Array<{ key: string; value: unknown }>
      for (const row of rows) yield [splitKey(row.key), row.value]
    },
  }
}
