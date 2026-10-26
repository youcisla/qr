import { error, json } from "@sveltejs/kit"
import type { QrDesign } from "$lib/qr/types"
import { authenticateApiRequest } from "$lib/server/api-keys/service"
import type { QrCodeStatus, QrCodeType } from "$lib/server/db/schema"
import { readJsonBody, toPublicQrCode, withQrErrors } from "$lib/server/http"
import {
  buildEncodeTarget,
  createQrCode,
  getPublicOrigin,
  listQrCodesForUser,
} from "$lib/server/qr/service"
import { z } from "zod"

import type { RequestHandler } from "./$types"

const STATUSES = ["active", "paused", "archived", "all"] as const
const TYPES = ["static", "dynamic", "all"] as const

const createSchema = z.object({
  type: z.enum(["static", "dynamic"]).optional(),
  contentType: z.string().max(32).optional(),
  contentData: z.record(z.string(), z.unknown()).optional(),
  encodedData: z.string().max(4096).optional(),
  destinationUrl: z.string().optional(),
  title: z.string().max(100).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  status: z.enum(["active", "paused", "archived"]).optional(),
  expiresAt: z.string().nullable().optional(),
  password: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  design: z.record(z.string(), z.unknown()).optional(),
  shortCode: z.string().optional(),
})

async function requireApiKey(request: Request) {
  const authenticated = await authenticateApiRequest(request)
  if (!authenticated) error(401, "Invalid or missing API key")
  return authenticated
}

/** GET /api/v1/qr - list the authenticated user's QR codes (bearer auth). */
export const GET: RequestHandler = async ({ request, url }) => {
  const authenticated = await requireApiKey(request)

  const statusParam = url.searchParams.get("status") ?? "all"
  const typeParam = url.searchParams.get("type") ?? "all"
  if (!STATUSES.includes(statusParam as (typeof STATUSES)[number])) {
    error(400, "status must be active, paused, archived or all")
  }
  if (!TYPES.includes(typeParam as (typeof TYPES)[number])) {
    error(400, "type must be static, dynamic or all")
  }

  const limit = Number.parseInt(url.searchParams.get("limit") ?? "25", 10)
  const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10)

  const result = await withQrErrors(() =>
    listQrCodesForUser(authenticated.userId, {
      search: url.searchParams.get("search") ?? undefined,
      status: statusParam as QrCodeStatus | "all",
      type: typeParam as QrCodeType | "all",
      limit: Number.isFinite(limit) ? limit : 25,
      offset: Number.isFinite(offset) ? offset : 0,
    }),
  )

  return json({
    items: result.items.map(toPublicQrCode),
    total: result.total,
    limit: Number.isFinite(limit) ? limit : 25,
    offset: Number.isFinite(offset) ? offset : 0,
  })
}

/** POST /api/v1/qr - create a QR code (bearer auth). */
export const POST: RequestHandler = async ({ request, url }) => {
  const authenticated = await requireApiKey(request)
  const parsed = createSchema.safeParse(await readJsonBody(request))

  if (!parsed.success) {
    error(400, parsed.error.issues[0]?.message ?? "Invalid request body")
  }

  const qrCode = await withQrErrors(() =>
    createQrCode({
      ...parsed.data,
      userId: authenticated.userId,
      design: parsed.data.design as Partial<QrDesign> | undefined,
    }),
  )

  return json(
    {
      qrCode: toPublicQrCode(qrCode),
      encodeTarget: buildEncodeTarget(qrCode, getPublicOrigin(url)),
    },
    { status: 201 },
  )
}
