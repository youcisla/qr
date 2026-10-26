import { isLikelyPhoneNumber, normalizePhoneNumber, textValue } from "./helpers"
import type { ContentValues, QrContentTypeDefinition } from "./types"

/**
 * SMSTO: payload (the widely supported SMS format used by ZXing based
 * scanners, iOS and Android): SMSTO:<number>:<message>
 */
export const smsContentType: QrContentTypeDefinition = {
  id: "sms",
  name: "SMS",
  description: "Open a text message draft to any number.",
  category: "message",
  icon: "message-square",
  supportsDynamic: false,
  fields: [
    {
      key: "number",
      label: "Phone number",
      type: "tel",
      placeholder: "+1 555 123 4567",
      help: "Include the country code.",
      required: true,
      fullWidth: true,
    },
    {
      key: "message",
      label: "Message",
      type: "textarea",
      placeholder: "Hi! I scanned your QR code.",
      rows: 3,
      maxLength: 500,
      fullWidth: true,
    },
  ],
  encode(values: ContentValues): string {
    const raw = textValue(values, "number")
    if (!raw) throw new Error("A phone number is required")
    if (!isLikelyPhoneNumber(raw)) throw new Error("Enter a valid phone number")
    const message = textValue(values, "message")
    return "SMSTO:" + normalizePhoneNumber(raw) + ":" + message
  },
  validate(values: ContentValues) {
    const raw = textValue(values, "number")
    if (!raw) return { valid: false, errors: { number: "A phone number is required" } }
    if (!isLikelyPhoneNumber(raw)) {
      return { valid: false, errors: { number: "Enter a valid phone number" } }
    }
    return { valid: true }
  },
  sample: { number: "+1 555 123 4567", message: "Hi! I scanned your QR code." },
  summarize(values: ContentValues): string {
    const message = textValue(values, "message")
    const number = textValue(values, "number")
    return message ? number + " - " + message : number
  },
}

export default smsContentType
