import { error, fail, redirect } from "@sveltejs/kit"
import { MIN_PASSWORD_LENGTH } from "$lib/server/qr/password"
import {
  getPublicOrigin,
  getQrCodeForUser,
  QrServiceError,
  updateQrCode,
} from "$lib/server/qr/service"
import { z } from "zod"

import type { Actions, PageServerLoad } from "./$types"

const saveSchema = z.object({
  title: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional(),
  destinationUrl: z.string().trim().max(2048).optional(),
  status: z.enum(["active", "paused", "archived"]),
  expiresAt: z.string().trim().optional(),
  tags: z.string().trim().optional(),
  passwordAction: z.enum(["keep", "set", "clear"]).default("keep"),
  password: z.string().optional(),
})

/** Format a Date as the local value expected by <input type="datetime-local">. */
function toLocalInputValue(value: Date | null): string {
  if (!value) return ""
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(
    value.getHours(),
  )}:${pad(value.getMinutes())}`
}

function toRedirectTarget(caught: unknown): never {
  if (caught instanceof QrServiceError) {
    error(caught.status as 404 | 403, caught.message)
  }
  throw caught
}

export const load: PageServerLoad = async (event) => {
  if (!event.locals.session) {
    redirect(303, "/auth/login")
  }

  let qrCode
  try {
    qrCode = await getQrCodeForUser(event.params.id, event.locals.session.id)
  } catch (caught) {
    toRedirectTarget(caught)
  }

  const { passwordHash, ...safeQrCode } = qrCode

  return {
    title: `Edit ${safeQrCode.title ?? "QR code"}`,
    description: "Edit QR code details, status, expiry, tags and password protection.",
    keywords: "qr code, edit, manage",
    user: event.locals.session,
    origin: getPublicOrigin(event.url),
    qrCode: safeQrCode,
    design: safeQrCode.design,
    hasPassword: Boolean(passwordHash),
    expiresAtLocal: toLocalInputValue(safeQrCode.expiresAt),
  }
}

export const actions: Actions = {
  save: async ({ request, locals, params }) => {
    if (!locals.session) {
      return fail(401, { error: "Authentication required" })
    }

    const formData = await request.formData()
    const parsed = saveSchema.safeParse({
      title: formData.get("title") ?? undefined,
      description: formData.get("description") ?? undefined,
      destinationUrl: formData.get("destinationUrl") ?? undefined,
      status: formData.get("status") ?? undefined,
      expiresAt: formData.get("expiresAt") ?? undefined,
      tags: formData.get("tags") ?? undefined,
      passwordAction: formData.get("passwordAction") ?? "keep",
      password: formData.get("password") ?? undefined,
    })

    if (!parsed.success) {
      return fail(400, { error: parsed.error.issues[0]?.message ?? "Invalid form data" })
    }

    const input = parsed.data
    const tags = [
      ...new Set(
        (input.tags ?? "")
          .split(",")
          .map((tag) => tag.trim().replace(/^#/, ""))
          .filter(Boolean),
      ),
    ].slice(0, 20)

    const patch: Parameters<typeof updateQrCode>[2] = {
      title: input.title || null,
      description: input.description || null,
      status: input.status,
      tags,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    }

    if (input.destinationUrl !== undefined) {
      patch.destinationUrl = input.destinationUrl || null
    }
    if (input.passwordAction === "clear") {
      patch.password = null
    } else if (input.passwordAction === "set") {
      const password = input.password ?? ""
      if (password.length < MIN_PASSWORD_LENGTH) {
        return fail(400, {
          error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        })
      }
      patch.password = password
    }

    try {
      await updateQrCode(params.id, locals.session.id, patch)
    } catch (caught) {
      if (caught instanceof QrServiceError) {
        return fail(caught.status, { error: caught.message })
      }
      throw caught
    }

    return { success: true, message: "QR code updated" }
  },
}
