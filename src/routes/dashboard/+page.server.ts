import { redirect } from "@sveltejs/kit"
import { getUserOverview } from "$lib/server/analytics/stats"
import { getPublicOrigin, listQrCodesForUser } from "$lib/server/qr/service"

import type { PageServerLoad } from "./$types"

/** Upper bound for the client-side manager; the API can page beyond this later. */
const MAX_DASHBOARD_CODES = 500

export const load: PageServerLoad = async (event) => {
  if (!event.locals.session) {
    redirect(303, "/auth/login")
  }

  const userId = event.locals.session.id
  const [overview, list] = await Promise.all([
    getUserOverview(userId),
    listQrCodesForUser(userId, {
      limit: MAX_DASHBOARD_CODES,
      sort: "created",
      direction: "desc",
    }),
  ])

  const tags = [...new Set(list.items.flatMap((qrCode) => qrCode.tags))].sort((a, b) =>
    a.localeCompare(b),
  )

  return {
    title: "QR code dashboard",
    description: "Manage your QR codes, track scans and open per-code analytics.",
    keywords: "qr codes, dashboard, qr analytics",
    user: event.locals.session,
    origin: getPublicOrigin(event.url),
    qrCodes: list.items,
    totalCodes: list.total,
    overview,
    tags,
  }
}
