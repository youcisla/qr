import { error } from "@sveltejs/kit"
import { QrServiceError, type QrCodeWithDesign } from "$lib/server/qr/service"

export type SessionUser = NonNullable<App.Locals["session"]>

/** Ensure the request is authenticated; throws a 401 HTTP error otherwise. */
export function requireUser(locals: App.Locals): SessionUser {
  if (!locals.session) error(401, "Authentication required")
  return locals.session
}

/** Public QR representation: password hash stripped, protection exposed as a boolean. */
export type PublicQrCode = Omit<QrCodeWithDesign, "passwordHash"> & { hasPassword: boolean }

export function toPublicQrCode(qrCode: QrCodeWithDesign): PublicQrCode {
  const { passwordHash, ...publicFields } = qrCode
  return { ...publicFields, hasPassword: passwordHash !== null }
}

/** Parse a JSON request body, turning invalid JSON into a 400 HTTP error. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    error(400, "Invalid JSON body")
  }
}

/** Convert QrServiceError into the matching HTTP error (404/403/400/409/500). */
export function rethrowQrError(cause: unknown): never {
  if (cause instanceof QrServiceError) error(cause.status, cause.message)
  throw cause
}

/** Run a service call and translate its domain errors into HTTP errors. */
export async function withQrErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (cause) {
    rethrowQrError(cause)
  }
}
