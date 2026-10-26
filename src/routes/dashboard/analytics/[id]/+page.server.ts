import { error, redirect } from "@sveltejs/kit"
import { getQrAnalytics, parseAnalyticsRange } from "$lib/server/analytics/stats"
import { getPublicOrigin, getQrCodeForUser, QrServiceError } from "$lib/server/qr/service"

import type { PageServerLoad } from "./$types"

type UiRange = "7d" | "30d" | "90d" | "all"

function toUiRange(range: ReturnType<typeof parseAnalyticsRange>): UiRange {
  return range === "all" ? "all" : `${range}d`
}

export const load: PageServerLoad = async (event) => {
  if (!event.locals.session) {
    redirect(303, "/auth/login")
  }

  let qrCode
  try {
    qrCode = await getQrCodeForUser(event.params.id, event.locals.session.id)
  } catch (caught) {
    if (caught instanceof QrServiceError) {
      error(caught.status as 403 | 404, caught.message)
    }
    throw caught
  }

  const serviceRange = parseAnalyticsRange(event.url.searchParams.get("range"))
  const analytics = await getQrAnalytics(qrCode.id, serviceRange)
  const { passwordHash, ...safeQrCode } = qrCode
  const label = safeQrCode.title ?? safeQrCode.shortCode ?? "QR code"

  return {
    title: `${label} · Analytics`,
    description:
      "Scan analytics for this QR code: scans over time, devices, operating systems, countries and referrers.",
    keywords: "qr code analytics, scans, referrers, devices",
    user: event.locals.session,
    origin: getPublicOrigin(event.url),
    qrCode: safeQrCode,
    design: safeQrCode.design,
    range: toUiRange(serviceRange),
    analytics,
    hasPassword: Boolean(passwordHash),
  }
}
