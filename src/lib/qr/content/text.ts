import { textValue } from "./helpers"
import type { ContentValues, QrContentTypeDefinition } from "./types"

/** Free-form text payload: notes, instructions, identifiers. */
export const textContentType: QrContentTypeDefinition = {
  id: "text",
  name: "Text",
  description: "Show a plain text message, note or coupon code.",
  category: "text",
  icon: "type",
  supportsDynamic: false,
  fields: [
    {
      key: "text",
      label: "Text",
      type: "textarea",
      placeholder: "Write anything you want the scan to reveal",
      help: "Plain text. Line breaks are preserved.",
      required: true,
      rows: 5,
      maxLength: 1000,
      fullWidth: true,
    },
  ],
  encode(values: ContentValues): string {
    const text = textValue(values, "text")
    if (!text) throw new Error("Text is required")
    return text
  },
  validate(values: ContentValues) {
    const text = textValue(values, "text")
    if (!text) return { valid: false, errors: { text: "Text is required" } }
    if (text.length > 1000) {
      return { valid: false, errors: { text: "Keep text under 1000 characters" } }
    }
    return { valid: true }
  },
  sample: { text: "Hello from Yopem QR!" },
  summarize(values: ContentValues): string {
    const text = textValue(values, "text")
    if (text.length <= 64) return text
    return text.slice(0, 61) + "..."
  },
}

export default textContentType
