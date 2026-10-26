import { createHash } from "node:crypto"
import { env } from "$env/dynamic/private"
import { db } from "$lib/server/db"
import { qrCodesTable, scanEventsTable } from "$lib/server/db/schema"
import { and, eq, gt, sql } from "drizzle-orm"

import { parseUserAgent } from "./ua"

/** Time window in which a repeat visit from the same visitor is not a unique scan. */
const UNIQUE_WINDOW_MS = 24 * 60 * 60 * 1000

const REFERER_MAX_LENGTH = 1024
const USER_AGENT_MAX_LENGTH = 512

export interface ScanContext {
  country: string | null
  region: string | null
  city: string | null
  deviceType: string
  os: string
  browser: string
  referer: string | null
  userAgent: string | null
  ipHash: string | null
  visitorHash: string | null
  isBot: boolean
}

export interface RecordScanResult {
  recorded: boolean
  isUnique: boolean
}

let cachedSalt: string | null = null

function getSalt(): string {
  if (cachedSalt) return cachedSalt
  cachedSalt = env.SCAN_SALT || env.UNLOCK_SECRET || `yopem-scan-${env.DATABASE_URL ?? "local"}`
  return cachedSalt
}

/** One-way salted hash; the raw IP address is never stored. */
function hashValue(value: string): string {
  return createHash("sha256").update(`${getSalt()}:${value}`).digest("hex")
}

function firstHeader(headers: Headers, names: string[]): string | null {
  for (const name of names) {
    const value = headers.get(name)?.trim()
    if (value) return value
  }
  return null
}

function decodeHeader(value: string | null): string | null {
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function getClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return firstHeader(headers, ["x-real-ip", "cf-connecting-ip", "true-client-ip"])
}

/**
 * Build the analytics context for a scan request from request headers only
 * (Vercel/Cloudflare geo headers, x-forwarded-for, user-agent, referer).
 */
export function buildScanContext(request: Request): ScanContext {
  const headers = request.headers
  const userAgent = headers.get("user-agent")?.slice(0, USER_AGENT_MAX_LENGTH) ?? null
  const parsed = parseUserAgent(userAgent)
  const ip = getClientIp(headers)
  const ipHash = ip ? hashValue(`ip:${ip}`) : null
  const visitorHash = hashValue(`visitor:${ip ?? "unknown"}:${userAgent ?? ""}`)
  const referer = headers.get("referer")?.slice(0, REFERER_MAX_LENGTH) ?? null

  return {
    country: decodeHeader(firstHeader(headers, ["x-vercel-ip-country", "cf-ipcountry"])),
    region: decodeHeader(firstHeader(headers, ["x-vercel-ip-region", "cf-region", "cf-ipregion"])),
    city: decodeHeader(firstHeader(headers, ["x-vercel-ip-city", "cf-ipcity", "cf-ip-city"])),
    deviceType: parsed.deviceType,
    os: parsed.os,
    browser: parsed.browser,
    referer,
    userAgent,
    ipHash,
    visitorHash,
    isBot: parsed.isBot,
  }
}
async function isFirstVisit(qrCodeId: string, visitorHash: string | null): Promise<boolean> {
  if (!visitorHash) return true
  const since = new Date(Date.now() - UNIQUE_WINDOW_MS)
  const [previous] = await db
    .select({ id: scanEventsTable.id })
    .from(scanEventsTable)
    .where(
      and(
        eq(scanEventsTable.qrCodeId, qrCodeId),
        eq(scanEventsTable.visitorHash, visitorHash),
        gt(scanEventsTable.scannedAt, since),
      ),
    )
    .limit(1)
  return !previous
}

/**
 * Record one scan: inserts a scan_event row and bumps the denormalised
 * counters on qr_codes inside the same transaction.
 *
 * Analytics must never break the redirect, so this function never throws;
 * failures are logged and reported through the boolean return value.
 */
export async function recordScan(
  request: Request,
  qrCode: { id: string },
): Promise<RecordScanResult> {
  try {
    const context = buildScanContext(request)
    const isUnique = context.isBot ? false : await isFirstVisit(qrCode.id, context.visitorHash)
    const scannedAt = new Date()

    await db.transaction(async (tx) => {
      await tx.insert(scanEventsTable).values({
        qrCodeId: qrCode.id,
        scannedAt,
        country: context.country,
        region: context.region,
        city: context.city,
        deviceType: context.deviceType,
        os: context.os,
        browser: context.browser,
        referer: context.referer,
        userAgent: context.userAgent,
        ipHash: context.ipHash,
        visitorHash: context.visitorHash,
        isUnique,
      })

      await tx
        .update(qrCodesTable)
        .set({
          scanCount: sql`${qrCodesTable.scanCount} + 1`,
          uniqueScanCount: isUnique
            ? sql`${qrCodesTable.uniqueScanCount} + 1`
            : sql`${qrCodesTable.uniqueScanCount}`,
          lastScannedAt: scannedAt,
        })
        .where(eq(qrCodesTable.id, qrCode.id))
    })

    return { recorded: true, isUnique }
  } catch (error) {
    console.error("[analytics] Failed to record scan:", error)
    return { recorded: false, isUnique: false }
  }
}
