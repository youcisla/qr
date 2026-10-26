import { isEmail, splitEmailList, textValue } from "./helpers"
import type { ContentValues, QrContentTypeDefinition } from "./types"

/** mailto: payload with optional subject and body. */
export const emailContentType: QrContentTypeDefinition = {
  id: "email",
  name: "Email",
  description: "Open a pre-filled e-mail draft to any address.",
  category: "message",
  icon: "mail",
  supportsDynamic: false,
  fields: [
    {
      key: "to",
      label: "To",
      type: "email",
      placeholder: "hello@example.com",
      help: "Separate multiple recipients with commas.",
      required: true,
      fullWidth: true,
    },
    {
      key: "subject",
      label: "Subject",
      type: "text",
      placeholder: "Hello from Yopem QR",
      maxLength: 200,
    },
    {
      key: "body",
      label: "Message",
      type: "textarea",
      placeholder: "Write the e-mail body...",
      rows: 4,
      maxLength: 1000,
      fullWidth: true,
    },
  ],
  encode(values: ContentValues): string {
    const recipients = splitEmailList(textValue(values, "to"))
    if (recipients.length === 0) throw new Error("At least one recipient is required")
    const invalid = recipients.find((recipient) => !isEmail(recipient))
    if (invalid) throw new Error("Invalid e-mail address: " + invalid)

    const params: string[] = []
    const subject = textValue(values, "subject")
    const body = textValue(values, "body")
    if (subject) params.push("subject=" + encodeURIComponent(subject))
    if (body) params.push("body=" + encodeURIComponent(body))

    // Addresses are validated above, so they are safe to keep readable: a
    // literal "@" is friendlier across QR scanners than an encoded %40.
    const address = recipients.join(",")
    return "mailto:" + address + (params.length > 0 ? "?" + params.join("&") : "")
  },
  validate(values: ContentValues) {
    const recipients = splitEmailList(textValue(values, "to"))
    if (recipients.length === 0) {
      return { valid: false, errors: { to: "At least one recipient is required" } }
    }
    const invalid = recipients.find((recipient) => !isEmail(recipient))
    if (invalid) {
      return { valid: false, errors: { to: "Invalid e-mail address: " + invalid } }
    }
    return { valid: true }
  },
  sample: {
    to: "hello@yopem.com",
    subject: "Hello from Yopem QR",
    body: "I scanned your QR code and wanted to say hi!",
  },
  summarize(values: ContentValues): string {
    const subject = textValue(values, "subject")
    const recipients = textValue(values, "to")
    return subject ? recipients + " - " + subject : recipients
  },
}

export default emailContentType
