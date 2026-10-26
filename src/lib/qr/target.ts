/** Shared helper to derive the string that gets encoded into a QR code. */
export interface QrTargetSource {
  type: "static" | "dynamic"
  shortCode?: string | null
  encodedData?: string | null
  destinationUrl?: string | null
}

export function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "")
}

export function buildShortUrl(shortCode: string, origin: string): string {
  return `${normalizeOrigin(origin)}/${shortCode}`
}

/**
 * Target payload for a stored QR code:
 * - dynamic: the short URL (redirects to editable destination/content)
 * - static: the encoded payload captured when the code was created
 */
export function buildQrTarget(source: QrTargetSource, origin: string): string {
  if (source.type === "dynamic" && source.shortCode) {
    return buildShortUrl(source.shortCode, origin)
  }
  const encoded = source.encodedData?.trim()
  if (encoded) return encoded
  return source.destinationUrl?.trim() ?? ""
}

/** Display label for a stored QR code (used in lists/cards). */
export function describeQrTarget(source: QrTargetSource): string {
  if (source.type === "dynamic" && source.shortCode) return `/${source.shortCode}`
  return source.encodedData?.trim() || source.destinationUrl?.trim() || ""
}
