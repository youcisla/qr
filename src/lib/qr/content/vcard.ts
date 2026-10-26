import {
  escapeVcardText,
  foldVcardLines,
  isEmail,
  isHttpUrl,
  isLikelyPhoneNumber,
  normalizeHttpUrl,
  normalizePhoneNumber,
  textValue,
} from "./helpers"
import type { ContentValues, QrContentTypeDefinition } from "./types"

/** Compose the N: and FN: lines of a vCard 3.0 card. */
function nameLines(values: ContentValues): { n: string; fn: string } {
  const first = textValue(values, "firstName")
  const last = textValue(values, "lastName")
  const fullName = [first, last].filter((part) => part.length > 0).join(" ")
  return {
    n: "N:" + escapeVcardText(last) + ";" + escapeVcardText(first) + ";;;",
    fn: "FN:" + escapeVcardText(fullName),
  }
}

/**
 * vCard 3.0 contact card (RFC 2426). Text values are escaped, content lines
 * folded at 75 octets and separated with CRLF, which every mainstream scanner
 * (iOS Camera, Google Lens, ZXing) understands.
 */
export const vcardContentType: QrContentTypeDefinition = {
  id: "vcard",
  name: "Contact Card",
  description: "Save your full contact details with name, phones, e-mail and address.",
  category: "contact",
  icon: "contact-round",
  supportsDynamic: false,
  fields: [
    {
      key: "firstName",
      label: "First name",
      type: "text",
      placeholder: "Amine",
      maxLength: 60,
    },
    {
      key: "lastName",
      label: "Last name",
      type: "text",
      placeholder: "Benali",
      maxLength: 60,
    },
    {
      key: "organization",
      label: "Company",
      type: "text",
      placeholder: "Yopem",
      maxLength: 100,
    },
    {
      key: "jobTitle",
      label: "Job title",
      type: "text",
      placeholder: "Product Designer",
      maxLength: 100,
    },
    {
      key: "phone",
      label: "Work phone",
      type: "tel",
      placeholder: "+1 555 123 4567",
      maxLength: 40,
    },
    {
      key: "mobile",
      label: "Mobile phone",
      type: "tel",
      placeholder: "+1 555 987 6543",
      maxLength: 40,
    },
    {
      key: "email",
      label: "E-mail",
      type: "email",
      placeholder: "amine@example.com",
      maxLength: 120,
    },
    {
      key: "website",
      label: "Website",
      type: "url",
      placeholder: "https://example.com",
      maxLength: 500,
    },
    {
      key: "street",
      label: "Street",
      type: "text",
      placeholder: "12 Rue de la Plage",
      maxLength: 120,
    },
    { key: "city", label: "City", type: "text", placeholder: "Casablanca", maxLength: 80 },
    {
      key: "region",
      label: "State / region",
      type: "text",
      placeholder: "Casablanca-Settat",
      maxLength: 80,
    },
    { key: "postalCode", label: "Postal code", type: "text", placeholder: "20000", maxLength: 20 },
    { key: "country", label: "Country", type: "text", placeholder: "Morocco", maxLength: 80 },
    {
      key: "note",
      label: "Note",
      type: "textarea",
      placeholder: "Where and when you met",
      rows: 3,
      maxLength: 500,
      fullWidth: true,
    },
  ],
  encode(values: ContentValues): string {
    const first = textValue(values, "firstName")
    const last = textValue(values, "lastName")
    if (!first && !last) throw new Error("A first or last name is required")

    const { n, fn } = nameLines(values)
    const organization = textValue(values, "organization")
    const jobTitle = textValue(values, "jobTitle")
    const phone = textValue(values, "phone")
    const mobile = textValue(values, "mobile")
    const email = textValue(values, "email")
    const website = textValue(values, "website")
    const street = textValue(values, "street")
    const city = textValue(values, "city")
    const region = textValue(values, "region")
    const postalCode = textValue(values, "postalCode")
    const country = textValue(values, "country")
    const note = textValue(values, "note")

    const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0", n, fn]
    if (organization) lines.push("ORG:" + escapeVcardText(organization))
    if (jobTitle) lines.push("TITLE:" + escapeVcardText(jobTitle))
    if (phone) lines.push("TEL;TYPE=WORK,VOICE:" + normalizePhoneNumber(phone))
    if (mobile) lines.push("TEL;TYPE=CELL:" + normalizePhoneNumber(mobile))
    if (email) lines.push("EMAIL;TYPE=INTERNET:" + email)
    if (website) lines.push("URL:" + normalizeHttpUrl(website))
    if (street || city || region || postalCode || country) {
      lines.push(
        "ADR;TYPE=WORK:;;" +
          escapeVcardText(street) +
          ";" +
          escapeVcardText(city) +
          ";" +
          escapeVcardText(region) +
          ";" +
          escapeVcardText(postalCode) +
          ";" +
          escapeVcardText(country),
      )
    }
    if (note) lines.push("NOTE:" + escapeVcardText(note))
    lines.push("END:VCARD")
    return foldVcardLines(lines)
  },
  validate(values: ContentValues) {
    const errors: Record<string, string> = {}
    const first = textValue(values, "firstName")
    const last = textValue(values, "lastName")
    if (!first && !last) errors.firstName = "Enter at least a first or last name"

    const phone = textValue(values, "phone")
    if (phone && !isLikelyPhoneNumber(phone)) errors.phone = "Enter a valid phone number"
    const mobile = textValue(values, "mobile")
    if (mobile && !isLikelyPhoneNumber(mobile)) errors.mobile = "Enter a valid phone number"
    const email = textValue(values, "email")
    if (email && !isEmail(email)) errors.email = "Enter a valid e-mail address"
    const website = textValue(values, "website")
    if (website && !isHttpUrl(website)) errors.website = "Enter a valid URL"

    return Object.keys(errors).length > 0 ? { valid: false, errors } : { valid: true }
  },
  sample: {
    firstName: "Amine",
    lastName: "Benali",
    organization: "Yopem",
    jobTitle: "Product Designer",
    phone: "+212 600 000 000",
    mobile: "",
    email: "amine@yopem.com",
    website: "https://yopem.com",
    street: "12 Rue de la Plage",
    city: "Casablanca",
    region: "",
    postalCode: "20000",
    country: "Morocco",
    note: "Met at DevFest 2025",
  },
  summarize(values: ContentValues): string {
    const name = [textValue(values, "firstName"), textValue(values, "lastName")]
      .filter((part) => part.length > 0)
      .join(" ")
    const organization = textValue(values, "organization")
    if (name && organization) return name + " - " + organization
    return name || organization || "Contact"
  },
}

export default vcardContentType
