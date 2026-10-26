import { createHmac, timingSafeEqual } from "node:crypto"
import type { Cookies } from "@sveltejs/kit"
import { dev } from "$app/environment"
import { env } from "$env/dynamic/private"

/** Lifetime of a signed unlock cookie (matches the product spec: 30 minutes). */
export const UNLOCK_COOKIE_TTL_SECONDS = 30 * 60

let cachedSecret: string | null = null

function getSecret(): string {
  if (cachedSecret) return cachedSecret
  cachedSecret = env.UNLOCK_SECRET || env.SCAN_SALT || `yopem-unlock-${env.DATABASE_URL ?? "local"}`
  return cachedSecret
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url")
}

/**
 * Create a signed, self-expiring unlock token for one QR code.
 * Format: <expiresAtMs>.<hmac> (the HMAC covers the qr id and the expiry).
 */
export function createUnlockToken(
  qrCodeId: string,
  ttlSeconds: number = UNLOCK_COOKIE_TTL_SECONDS,
): string {
  const expiresAt = Date.now() + ttlSeconds * 1000
  const payload = `${qrCodeId}.${expiresAt}`
  return `${expiresAt}.${sign(payload)}`
}

export function verifyUnlockToken(token: string | undefined | null, qrCodeId: string): boolean {
  if (!token) return false
  const separator = token.lastIndexOf(".")
  if (separator <= 0) return false
  const expiresAt = Number(token.slice(0, separator))
  const signature = token.slice(separator + 1)
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false
  const expected = sign(`${qrCodeId}.${expiresAt}`)
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(actualBuffer, expectedBuffer)
}

/** Cookie name is derived from the short code so several protected codes can coexist. */
export function unlockCookieName(shortCode: string): string {
  return `yopem_unlock_${shortCode}`
}

export function setUnlockCookie(cookies: Cookies, shortCode: string, qrCodeId: string): void {
  cookies.set(unlockCookieName(shortCode), createUnlockToken(qrCodeId), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: UNLOCK_COOKIE_TTL_SECONDS,
    secure: !dev,
  })
}

export function clearUnlockCookie(cookies: Cookies, shortCode: string): void {
  cookies.delete(unlockCookieName(shortCode), { path: "/" })
}

export function hasUnlockCookie(cookies: Cookies, shortCode: string, qrCodeId: string): boolean {
  return verifyUnlockToken(cookies.get(unlockCookieName(shortCode)), qrCodeId)
}
