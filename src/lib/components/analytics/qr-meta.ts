/**
 * Presentation helpers shared by the dashboard management pages and the
 * per-QR analytics page (labels, badges, display titles).
 *
 * Kept next to the other shared management-UI helpers so the QR card, list
 * view, analytics page and edit page all render the same wording.
 */

import type { BadgeVariant } from "$lib/components/ui/badge"
import { describeQrTarget } from "$lib/qr"
import type { QrCodeStatus } from "$lib/server/db/schema/qr-codes"

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  app: "App",
  crypto: "Crypto",
  email: "Email",
  epc: "Bank transfer",
  event: "Event",
  geo: "Location",
  mecard: "MeCard",
  paypal: "PayPal",
  phone: "Phone",
  sms: "SMS",
  social: "Social",
  text: "Text",
  url: "URL",
  vcard: "vCard",
  whatsapp: "WhatsApp",
  wifi: "Wi-Fi",
}

export function contentTypeLabel(contentType: string | null | undefined): string {
  if (!contentType) return "Unknown"
  return CONTENT_TYPE_LABELS[contentType] ?? contentType.replace(/[-_]/g, " ")
}

export const STATUS_LABELS: Record<QrCodeStatus, string> = {
  active: "Active",
  paused: "Paused",
  archived: "Archived",
}

export function statusLabel(status: QrCodeStatus | string): string {
  return STATUS_LABELS[status as QrCodeStatus] ?? String(status)
}

export function statusBadgeVariant(status: QrCodeStatus | string): BadgeVariant {
  if (status === "active") return "success"
  if (status === "paused") return "warning"
  if (status === "archived") return "outline"
  return "secondary"
}

interface DisplayableQr {
  type: "static" | "dynamic"
  shortCode: string | null
  encodedData: string
  destinationUrl: string | null
  contentType: string
  title: string | null
  description: string | null
}

/** Human label for a code: the explicit title, else its content type. */
export function qrDisplayTitle(qr: DisplayableQr): string {
  return qr.title?.trim() || contentTypeLabel(qr.contentType)
}

/** Secondary line: description, else a readable target (short link or payload). */
export function qrDisplaySubtitle(qr: DisplayableQr): string {
  return qr.description?.trim() || qrTargetLabel(qr)
}

/** A useful target string for copying: short URL for dynamic, payload otherwise. */
export function qrTargetLabel(qr: DisplayableQr): string {
  return describeQrTarget(qr) || contentTypeLabel(qr.contentType)
}
