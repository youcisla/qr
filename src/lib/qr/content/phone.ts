import { isLikelyPhoneNumber, normalizePhoneNumber, textValue } from "./helpers"
import type { ContentValues, QrContentTypeDefinition } from "./types"

/** tel: payload that opens the dialler with a number pre-filled. */
export const phoneContentType: QrContentTypeDefinition = {
  id: "phone",
  name: "Phone Call",
  description: "Start a phone call with one tap.",
  category: "contact",
  icon: "phone",
  supportsDynamic: false,
  fields: [
    {
      key: "number",
      label: "Phone number",
      type: "tel",
      placeholder: "+1 555 123 4567",
      help: "Include the country code so the number works everywhere.",
      required: true,
      fullWidth: true,
    },
  ],
  encode(values: ContentValues): string {
    const raw = textValue(values, "number")
    if (!raw) throw new Error("A phone number is required")
    if (!isLikelyPhoneNumber(raw)) throw new Error("Enter a valid phone number")
    return "tel:" + normalizePhoneNumber(raw)
  },
  validate(values: ContentValues) {
    const raw = textValue(values, "number")
    if (!raw) return { valid: false, errors: { number: "A phone number is required" } }
    if (!isLikelyPhoneNumber(raw)) {
      return { valid: false, errors: { number: "Enter a valid phone number" } }
    }
    return { valid: true }
  },
  sample: { number: "+1 555 123 4567" },
  summarize(values: ContentValues): string {
    return textValue(values, "number")
  },
}

export default phoneContentType
