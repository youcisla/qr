import { digitsOnly, isLikelyPhoneNumber, textValue } from "./helpers"
import type { ContentValues, QrContentTypeDefinition } from "./types"

/**
 * WhatsApp click-to-chat link: https://wa.me/<international digits>?text=<text>
 * The number must be in full international format without "+" or leading zeros.
 */
export function buildWhatsAppUrl(phone: string, message?: string): string {
  const digits = digitsOnly(phone).replace(/^0+/, "")
  const url = "https://wa.me/" + digits
  const text = (message ?? "").trim()
  return text ? url + "?text=" + encodeURIComponent(text) : url
}

export const whatsappContentType: QrContentTypeDefinition = {
  id: "whatsapp",
  name: "WhatsApp",
  description: "Open a WhatsApp chat with a pre-filled message.",
  category: "message",
  icon: "message-circle",
  supportsDynamic: false,
  fields: [
    {
      key: "phone",
      label: "WhatsApp number",
      type: "tel",
      placeholder: "+1 555 123 4567",
      help: "Full international number with country code.",
      required: true,
      fullWidth: true,
    },
    {
      key: "message",
      label: "Pre-filled message",
      type: "textarea",
      placeholder: "Hi! I'd like to know more about...",
      rows: 3,
      maxLength: 500,
      fullWidth: true,
    },
  ],
  encode(values: ContentValues): string {
    const phone = textValue(values, "phone")
    if (!phone) throw new Error("A WhatsApp number is required")
    const digits = digitsOnly(phone).replace(/^0+/, "")
    if (digits.length < 7 || digits.length > 15) {
      throw new Error("Enter a valid international phone number")
    }
    return buildWhatsAppUrl(phone, textValue(values, "message"))
  },
  validate(values: ContentValues) {
    const phone = textValue(values, "phone")
    if (!phone) return { valid: false, errors: { phone: "A WhatsApp number is required" } }
    if (!isLikelyPhoneNumber(phone, 7, 15)) {
      return { valid: false, errors: { phone: "Enter a valid international phone number" } }
    }
    return { valid: true }
  },
  sample: { phone: "+1 555 123 4567", message: "Hello! I'd like to know more." },
  summarize(values: ContentValues): string {
    return digitsOnly(textValue(values, "phone")).replace(/^0+/, "")
  },
}

export default whatsappContentType
