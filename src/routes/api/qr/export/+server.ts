import { error } from "@sveltejs/kit"
import { requireUser, withQrErrors } from "$lib/server/http"
import { buildQrCodesCsv } from "$lib/server/qr/csv"
import { getPublicOrigin, getQrCodesForExport } from "$lib/server/qr/service"

import type { RequestHandler } from "./$types"

/**
 * GET /api/qr/export?ids=id1,id2&format=csv
 *
 * Exports the given owned QR codes (or all of them when `ids` is omitted) as a
 * CSV attachment. Includes counters and a design summary/JSON so the export can
 * also act as a backup.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = requireUser(locals)

  const format = url.searchParams.get("format") ?? "csv"
  if (format !== "csv") error(400, "Only format=csv is supported")

  const idsParam = url.searchParams.get("ids")
  const ids = idsParam
    ? idsParam
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : undefined

  const codes = await withQrErrors(() => getQrCodesForExport(user.id, ids))
  const csv = buildQrCodesCsv(codes, getPublicOrigin(url))

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="qr-codes.csv"',
      "cache-control": "no-store",
    },
  })
}
