import { error, json } from "@sveltejs/kit"
import { readJsonBody, requireUser, withQrErrors } from "$lib/server/http"
import {
  deleteQrCodes,
  duplicateQrCode,
  updateQrStatuses,
  type BulkResult,
} from "$lib/server/qr/service"
import { z } from "zod"

import type { RequestHandler } from "./$types"

const bulkSchema = z.object({
  action: z.enum(["delete", "archive", "activate", "pause", "duplicate"]),
  ids: z.array(z.string().min(1)).min(1).max(500),
})

function countResult(result: BulkResult): { succeeded: number; failed: number } {
  return { succeeded: result.succeeded.length, failed: result.failed.length }
}

/**
 * POST /api/qr/bulk - apply a lifecycle action to many owned QR codes at once.
 * Response: { success, succeeded, failed, duplicatedIds? }
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  const user = requireUser(locals)
  const parsed = bulkSchema.safeParse(await readJsonBody(request))

  if (!parsed.success) {
    error(400, parsed.error.issues[0]?.message ?? "Invalid request body")
  }

  const { action, ids } = parsed.data

  if (action === "duplicate") {
    const duplicatedIds: string[] = []
    let failed = 0
    for (const id of ids) {
      try {
        const copy = await duplicateQrCode(id, user.id)
        duplicatedIds.push(copy.id)
      } catch {
        failed += 1
      }
    }
    return json({ success: true, succeeded: duplicatedIds.length, failed, duplicatedIds })
  }

  const statusByAction = {
    archive: "archived",
    activate: "active",
    pause: "paused",
  } as const

  const result = await withQrErrors(() => {
    if (action === "delete") return deleteQrCodes(ids, user.id)
    return updateQrStatuses(ids, user.id, statusByAction[action])
  })

  return json({ success: true, ...countResult(result) })
}
