import { error, json } from "@sveltejs/kit"
import { revokeApiKey } from "$lib/server/api-keys/service"
import { requireUser } from "$lib/server/http"

import type { RequestHandler } from "./$types"

/** DELETE /api/keys/[id] - revoke an owned API key. */
export const DELETE: RequestHandler = async ({ params, locals }) => {
  const user = requireUser(locals)
  const revoked = await revokeApiKey(params.id, user.id)

  if (!revoked) error(404, "API key not found")

  return json({ success: true })
}
