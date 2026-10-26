import { normalizeHttpUrl, parseHttpUrl, textValue } from "./helpers"
import type { ContentValues, QrContentTypeDefinition } from "./types"

/**
 * Plain web link. The canonical "everything is a URL" QR code: every payload
 * that is not a structured format is opened by a scanner as a link.
 */
export const urlContentType: QrContentTypeDefinition = {
  id: "url",
  name: "Website",
  description: "Open a web page, landing page or file download.",
  category: "link",
  icon: "link",
  supportsDynamic: true,
  fields: [
    {
      key: "url",
      label: "Website URL",
      type: "url",
      placeholder: "https://example.com",
      help: "Any http(s) link. If you omit the scheme we add https:// for you.",
      required: true,
      maxLength: 2048,
      fullWidth: true,
    },
  ],
  encode(values: ContentValues): string {
    const url = normalizeHttpUrl(textValue(values, "url"))
    if (!url) throw new Error("A website URL is required")
    if (!parseHttpUrl(url)) throw new Error("Enter a valid URL, e.g. https://example.com")
    return url
  },
  validate(values: ContentValues) {
    const raw = textValue(values, "url")
    if (!raw) return { valid: false, errors: { url: "A website URL is required" } }
    if (!parseHttpUrl(raw)) {
      return { valid: false, errors: { url: "Enter a valid URL, e.g. https://example.com" } }
    }
    return { valid: true }
  },
  sample: { url: "https://yopem.com" },
  summarize(values: ContentValues): string {
    return textValue(values, "url")
  },
}

export default urlContentType
