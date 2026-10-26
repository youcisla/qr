import { error, json } from "@sveltejs/kit"
import type { QrDesign } from "$lib/qr/types"
import { readJsonBody, requireUser, toPublicQrCode, withQrErrors } from "$lib/server/http"
import {
  buildEncodeTarget,
  deleteQrCode,
  getPublicOrigin,
  getQrCodeForUser,
  updateQrCode,
  updateQrDesign,
  type UpdateQrCodePatch,
} from "$lib/server/qr/service"
import { z } from "zod"

import type { RequestHandler } from "./$types"

const designSchema = z.record(z.string(), z.unknown())

const patchSchema = z.object({
  title: z.string().max(100).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  destinationUrl: z.string().nullable().optional(),
  contentType: z.string().max(32).optional(),
  contentData: z.record(z.string(), z.unknown()).nullable().optional(),
  encodedData: z.string().max(4096).nullable().optional(),
  status: z.enum(["active", "paused", "archived"]).optional(),
  expiresAt: z.union([z.string(), z.null()]).optional(),
  password: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  design: designSchema.optional(),
})

/** GET /api/qr/[id] - full detail plus the exact payload to render into the QR image. */
export const GET: RequestHandler = async ({ params, locals, url }) => {
  const user = requireUser(locals)
  const qrCode = await withQrErrors(() => getQrCodeForUser(params.id, user.id))
  return json({
    qrCode: toPublicQrCode(qrCode),
    encodeTarget: buildEncodeTarget(qrCode, getPublicOrigin(url)),
  })
}

/**
 * PATCH /api/qr/[id] - update metadata, content, lifecycle, password or design.
 * `password: null` or "" clears password protection; `expiresAt: null` clears the expiry.
 */
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
  const user = requireUser(locals)
  const parsed = patchSchema.safeParse(await readJsonBody(request))

  if (!parsed.success) {
    error(400, parsed.error.issues[0]?.message ?? "Invalid request body")
  }

  const { design, ...metadata } = parsed.data
  const patch = metadata as UpdateQrCodePatch

  let qrCode = await withQrErrors(() => updateQrCode(params.id, user.id, patch))

  if (design) {
    const updatedDesign = await withQrErrors(() =>
      updateQrDesign(params.id, user.id, design as Partial<QrDesign>),
    )
    qrCode = { ...qrCode, design: updatedDesign }
  }

  return json({ success: true, qrCode: toPublicQrCode(qrCode) })
}

/** DELETE /api/qr/[id] - remove an owned QR code (styles + scan events cascade). */
export const DELETE: RequestHandler = async ({ params, locals }) => {
  const user = requireUser(locals)
  await withQrErrors(() => deleteQrCode(params.id, user.id))
  return json({ success: true })
}
