import { error, redirect } from "@sveltejs/kit"
import { recordScan } from "$lib/server/analytics/track"
import { getQrCodeByShortCode } from "$lib/server/qr/service"
import { hasUnlockCookie } from "$lib/server/qr/unlock"

import type { RequestHandler } from "./$types"

/**
 * Dynamic short-link redirect.
 *
 * Lifecycle gates are enforced before anything is served:
 * - missing / non-dynamic short code -> 404
 * - paused, archived or expired -> 410
 * - password protected and not unlocked -> 303 to /unlock/[shortCode]
 *
 * Scans are only recorded once the visitor actually reaches the destination,
 * and analytics failures never break the redirect.
 */
export const GET: RequestHandler = async ({ params, cookies, request }) => {
  const { shortCode } = params

  if (!shortCode) error(404, "QR code not found")

  const qrCode = await getQrCodeByShortCode(shortCode)

  if (!qrCode || qrCode.type !== "dynamic") error(404, "QR code not found")

  if (qrCode.status === "archived") error(410, "This QR code has been archived")
  if (qrCode.status === "paused") error(410, "This QR code is paused")

  if (qrCode.expiresAt && qrCode.expiresAt.getTime() <= Date.now()) {
    error(410, "This QR code has expired")
  }

  if (!qrCode.destinationUrl) {
    error(404, "This QR code has no destination yet")
  }

  if (qrCode.passwordHash && !hasUnlockCookie(cookies, shortCode, qrCode.id)) {
    redirect(303, `/unlock/${encodeURIComponent(shortCode)}`)
  }

  await recordScan(request, qrCode)

  redirect(307, qrCode.destinationUrl)
}
