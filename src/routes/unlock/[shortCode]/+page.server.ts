import { error, redirect } from "@sveltejs/kit"
import { hasPassword, verifyPassword } from "$lib/server/qr/password"
import { getQrCodeByShortCode } from "$lib/server/qr/service"
import { hasUnlockCookie, setUnlockCookie } from "$lib/server/qr/unlock"

import type { Actions, PageServerLoad } from "./$types"

/** Resolve the protected dynamic code for this short code, or fail with 404/410. */
async function resolveProtectedQr(shortCode: string) {
  const qrCode = await getQrCodeByShortCode(shortCode)

  if (!qrCode || qrCode.type !== "dynamic" || !hasPassword(qrCode.passwordHash)) {
    error(404, "QR code not found")
  }

  return qrCode
}

function assertAvailable(qrCode: { status: string; expiresAt: Date | null }): void {
  if (qrCode.status === "archived") error(410, "This QR code has been archived")
  if (qrCode.status === "paused") error(410, "This QR code is paused")
  if (qrCode.expiresAt && qrCode.expiresAt.getTime() <= Date.now()) {
    error(410, "This QR code has expired")
  }
}

export const load: PageServerLoad = async ({ params, cookies }) => {
  const { shortCode } = params
  const qrCode = await resolveProtectedQr(shortCode)
  assertAvailable(qrCode)

  // Already unlocked in this browser: skip the form and continue to the redirect.
  if (hasUnlockCookie(cookies, shortCode, qrCode.id)) {
    redirect(303, `/${encodeURIComponent(shortCode)}`)
  }

  return {
    shortCode,
    title: qrCode.title,
  }
}

export const actions: Actions = {
  default: async ({ request, params, cookies }) => {
    const { shortCode } = params
    const qrCode = await resolveProtectedQr(shortCode)
    assertAvailable(qrCode)

    const formData = await request.formData()
    const password = String(formData.get("password") ?? "")

    // Validation errors are returned as normal action data so the page re-renders
    // with HTTP 200 and the inline error state (SvelteKit would turn fail() into a
    // 4xx response for plain, non-enhanced form submissions).
    if (!password) {
      return { error: "Enter the password to continue." }
    }

    const valid = await verifyPassword(password, qrCode.passwordHash)

    if (!valid) {
      return { error: "Incorrect password. Please try again." }
    }

    setUnlockCookie(cookies, shortCode, qrCode.id)

    redirect(303, `/${encodeURIComponent(shortCode)}`)
  },
}
