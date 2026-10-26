import { error, fail, redirect } from "@sveltejs/kit"
import {
  encodeContent,
  getContentType,
  validateContent,
  withDefaults,
  type ContentValues,
} from "$lib/qr/content"
import { resolveDesign, type QrDesign } from "$lib/qr/types"
import {
  buildEncodeTarget,
  createQrCode,
  getPublicOrigin,
  getQrCodeForUser,
  QrServiceError,
  updateQrCode,
  updateQrDesign,
} from "$lib/server/qr/service"
import { z } from "zod"

import type { Actions, PageServerLoad } from "./$types"

const MAX_PREFILL_LENGTH = 2048
const MAX_PAYLOAD_LENGTH = 3_000_000

const fillSchema = z.union([
  z.object({ type: z.literal("solid"), color: z.string().min(1).max(64) }),
  z.object({
    type: z.literal("gradient"),
    gradient: z.object({
      type: z.enum(["linear", "radial"]),
      angle: z.number().min(0).max(360).optional(),
      stops: z
        .array(
          z.object({
            color: z.string().min(1).max(64),
            offset: z.number().min(0).max(1),
          }),
        )
        .min(1)
        .max(5),
    }),
  }),
])

const designSchema = z.object({
  version: z.literal(1).optional(),
  dotStyle: z
    .enum([
      "square",
      "rounded",
      "dots",
      "diamond",
      "star",
      "cross",
      "leaf",
      "classy",
      "hexagon",
      "squircle",
    ])
    .optional(),
  moduleGap: z.number().min(0).max(0.4).optional(),
  eyeFrameStyle: z.enum(["square", "rounded", "circle", "leaf", "octagon", "squircle"]).optional(),
  eyeBallStyle: z.enum(["square", "rounded", "dots", "leaf", "squircle"]).optional(),
  foreground: fillSchema.optional(),
  background: fillSchema.optional(),
  eyeFrameColor: z.string().min(1).max(64).nullable().optional(),
  eyeBallColor: z.string().min(1).max(64).nullable().optional(),
  quietZone: z.number().min(0).max(8).optional(),
  errorCorrection: z.enum(["L", "M", "Q", "H"]).optional(),
  transparentBackground: z.boolean().optional(),
  logo: z
    .object({
      src: z.string().min(1).max(1_500_000),
      size: z.number().min(0.05).max(0.5),
      padding: z.number().min(0).max(0.6),
      radius: z.number().min(0).max(0.6),
      backgroundColor: z.string().min(1).max(64),
      clearModules: z.boolean(),
    })
    .nullable()
    .optional(),
  frame: z
    .object({
      style: z.enum(["none", "simple", "rounded", "banner", "top", "badge", "ticket", "double"]),
      label: z.string().max(64),
      labelColor: z.string().min(1).max(64),
      frameColor: z.string().min(1).max(64),
      backgroundColor: z.string().min(1).max(64),
      fontSize: z.number().min(0.02).max(0.2),
    })
    .nullable()
    .optional(),
})

const savePayloadSchema = z.object({
  id: z.string().min(1).max(64).optional().nullable(),
  contentType: z.string().min(1).max(32),
  contentData: z.record(z.string(), z.unknown()).default({}),
  title: z.string().max(100).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).default([]),
  type: z.enum(["static", "dynamic"]).default("static"),
  design: designSchema.optional().nullable(),
})

/** Pick sensible prefill values for a scanned payload. */
function prefillFor(payload: string, hint: string | null): { type: string; values: ContentValues } {
  const trimmed = payload.trim()
  const hinted = hint ? getContentType(hint) : undefined
  if (hinted) {
    const values = withDefaults(hinted, hinted.sample)
    const textKeys = ["url", "text", "email", "phone", "ssid", "title", "data"]
    const key = hinted.fields.find((field) => textKeys.includes(field.key))?.key
    if (key) return { type: hinted.id, values: { ...values, [key]: trimmed } }
    return { type: hinted.id, values }
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return { type: "url", values: { url: trimmed } }
  }
  return { type: "text", values: { text: trimmed } }
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = locals.session ?? null
  const origin = getPublicOrigin(url)
  const editId = url.searchParams.get("edit")?.trim() || null

  let qr: {
    id: string
    contentType: string
    contentData: ContentValues
    title: string | null
    description: string | null
    tags: string[]
    type: "static" | "dynamic"
    status: string
    shortCode: string | null
    shortUrl: string | null
    design: QrDesign
    encodeTarget: string
  } | null = null

  if (editId) {
    if (!user) redirect(303, "/auth/login")
    try {
      const found = await getQrCodeForUser(editId, user.id)
      qr = {
        id: found.id,
        contentType: found.contentType,
        contentData: found.contentData as ContentValues,
        title: found.title,
        description: found.description,
        tags: found.tags,
        type: found.type,
        status: found.status,
        shortCode: found.shortCode,
        shortUrl: found.shortCode ? origin + "/" + found.shortCode : null,
        design: resolveDesign(found.design),
        encodeTarget: buildEncodeTarget(found, origin),
      }
    } catch (caught) {
      if (caught instanceof QrServiceError) {
        error(caught.status, caught.message)
      }
      throw caught
    }
  }

  const prefillData = url.searchParams.get("data")
  const prefillType = url.searchParams.get("type")
  const prefillPayload =
    typeof prefillData === "string" && prefillData.trim().length > 0
      ? prefillData.slice(0, MAX_PREFILL_LENGTH)
      : null

  return {
    user,
    origin,
    qr,
    prefill: prefillPayload ? prefillFor(prefillPayload, prefillType) : null,
  }
}

export const actions: Actions = {
  save: async ({ request, locals, url }) => {
    const user = locals.session
    if (!user) {
      return fail(401, { error: "Sign in to save your QR code" })
    }

    let raw: unknown
    try {
      const formData = await request.formData()
      const payload = formData.get("payload")
      if (typeof payload !== "string" || payload.length === 0) {
        return fail(400, { error: "Missing QR data" })
      }
      if (payload.length > MAX_PAYLOAD_LENGTH) {
        return fail(413, { error: "This QR code is too large to save" })
      }
      raw = JSON.parse(payload)
    } catch {
      return fail(400, { error: "Could not read the QR data" })
    }

    const parsed = savePayloadSchema.safeParse(raw)
    if (!parsed.success) {
      return fail(400, {
        error: "Some fields are invalid",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      })
    }

    const data = parsed.data
    const typeDef = getContentType(data.contentType)
    if (!typeDef) {
      return fail(400, { error: "Unknown content type" })
    }
    if (!typeDef.supportsDynamic && data.type === "dynamic") {
      return fail(400, { error: typeDef.name + " QR codes cannot be dynamic" })
    }

    const contentData = data.contentData as ContentValues
    const validation = validateContent(typeDef.id, contentData)
    if (!validation.valid) {
      return fail(400, {
        error: Object.values(validation.errors ?? {})[0] ?? "Please check the QR content",
        errors: validation.errors ?? {},
      })
    }

    let encoded: string
    try {
      encoded = encodeContent(typeDef.id, contentData)
    } catch (caught) {
      return fail(400, {
        error: caught instanceof Error ? caught.message : "Invalid QR content",
      })
    }

    const dynamic = data.type === "dynamic"
    if (dynamic) {
      try {
        const destination = new URL(encoded)
        if (destination.protocol !== "http:" && destination.protocol !== "https:") {
          return fail(400, { error: "Dynamic QR codes need an http(s) destination" })
        }
      } catch {
        return fail(400, { error: "Dynamic QR codes need an http(s) destination" })
      }
    }

    const title = data.title?.trim() ? data.title.trim() : null
    const description = data.description?.trim() ? data.description.trim() : null
    const design = (data.design ?? undefined) as Partial<QrDesign> | undefined
    const origin = getPublicOrigin(url)

    try {
      if (data.id) {
        const existing = await getQrCodeForUser(data.id, user.id)
        const patch = {
          contentType: typeDef.id,
          contentData: contentData as Record<string, unknown>,
          title,
          description,
          tags: data.tags,
        }
        if (existing.type === "static") {
          // Static codes freeze their payload; the destination column cannot be
          // patched once created (the service rejects it), so only re-encode.
          await updateQrCode(data.id, user.id, { ...patch, encodedData: encoded })
        } else {
          await updateQrCode(data.id, user.id, { ...patch, destinationUrl: encoded })
        }
        const storedDesign = await updateQrDesign(data.id, user.id, design ?? {})
        return {
          saved: true,
          updated: true,
          id: existing.id,
          shortCode: existing.shortCode,
          shortUrl: existing.shortCode ? origin + "/" + existing.shortCode : null,
          encodeTarget: buildEncodeTarget(
            {
              type: existing.type,
              shortCode: existing.shortCode,
              encodedData: encoded,
              destinationUrl: dynamic ? encoded : typeDef.id === "url" ? encoded : null,
            },
            origin,
          ),
          design: storedDesign,
        }
      }

      const created = await createQrCode({
        userId: user.id,
        type: data.type,
        contentType: typeDef.id,
        contentData: contentData as Record<string, unknown>,
        encodedData: dynamic ? "" : encoded,
        destinationUrl: dynamic ? encoded : typeDef.id === "url" ? encoded : null,
        title,
        description,
        tags: data.tags,
        design: design ?? null,
      })

      return {
        saved: true,
        updated: false,
        id: created.id,
        shortCode: created.shortCode,
        shortUrl: created.shortCode ? origin + "/" + created.shortCode : null,
        encodeTarget: buildEncodeTarget(created, origin),
        design: created.design,
      }
    } catch (caught) {
      if (caught instanceof QrServiceError) {
        return fail(caught.status, { error: caught.message, code: caught.code })
      }
      console.error("[studio] save failed", caught)
      return fail(500, { error: "Could not save your QR code. Please try again." })
    }
  },
}
