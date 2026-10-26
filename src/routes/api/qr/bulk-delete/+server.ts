import { error, json } from "@sveltejs/kit"
import { readJsonBody, requireUser, withQrErrors } from "$lib/server/http"
import { deleteQrCodes } from "$lib/server/qr/service"
import { z } from "zod"

import type { RequestHandler } from "./$types"

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
})

/**
 * POST /api/qr/bulk-delete - legacy bulk delete endpoint kept for backwards
 * compatibility. Prefer POST /api/qr/bulk with action "delete".
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  const user = requireUser(locals)
  const parsed = bulkDeleteSchema.safeParse(await readJsonBody(request))

  if (!parsed.success) {
    error(400, parsed.error.issues[0]?.message ?? "Invalid request body")
  }

  const result = await withQrErrors(() => deleteQrCodes(parsed.data.ids, user.id))

  return json({ succeeded: result.succeeded.length, failed: result.failed.length })
}
