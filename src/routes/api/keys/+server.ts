import { error, json } from "@sveltejs/kit"
import { createApiKey, listApiKeys, toPublicApiKey } from "$lib/server/api-keys/service"
import { readJsonBody, requireUser } from "$lib/server/http"
import { z } from "zod"

import type { RequestHandler } from "./$types"

const createSchema = z.object({
  name: z.string().max(60).optional(),
})

/** GET /api/keys - list API keys (secrets are never returned, only prefixes). */
export const GET: RequestHandler = async ({ locals }) => {
  const user = requireUser(locals)
  const apiKeys = await listApiKeys(user.id)
  return json({ apiKeys: apiKeys.map(toPublicApiKey) })
}

/** POST /api/keys - create a key. The full secret is returned exactly once. */
export const POST: RequestHandler = async ({ locals, request }) => {
  const user = requireUser(locals)
  const parsed = createSchema.safeParse(await readJsonBody(request))

  if (!parsed.success) {
    error(400, parsed.error.issues[0]?.message ?? "Invalid request body")
  }

  const { apiKey, secret } = await createApiKey(user.id, parsed.data.name ?? "API key")

  return json(
    {
      apiKey: toPublicApiKey(apiKey),
      secret,
      notice: "Store this secret securely; it is shown only once.",
    },
    { status: 201 },
  )
}
