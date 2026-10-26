import {
  escapeMecardValue,
  isEmail,
  isHttpUrl,
  isLikelyPhoneNumber,
  normalizeHttpUrl,
  normalizePhoneNumber,
  textValue,
} from "./helpers"
import type { ContentValues, QrContentTypeDefinition } from "./types"

/**
 * MeCard (DoCoMo) contact format. Compact alternative to vCard, widely read by
 * Android scanners: MECARD:N:Last,First;TEL:...;EMAIL:...;URL:...;; with the
 * special characters backslash, semicolon, colon and comma escaped.
 */
export const mecardContentType: QrContentTypeDefinition = {
  id: "mecard",
  name: "MeCard Contact",
  description: "A compact contact card that Android scanners read instantly.",
  category: "contact",
  icon: "contact",
  supportsDynamic: false,
  fields: [
    { key: "firstName", label: "First name", type: "text", placeholder: "Amine", maxLength: 60 },
    { key: "lastName", label: "Last name", type: "text", placeholder: "Benali", maxLength: 60 },
    {
      key: "phone",
      label: "Phone",
      type: "tel",
      placeholder: "+1 555 123 4567",
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
      maxLength: 300,
    },
    { key: "organization", label: "Company", type: "text", placeholder: "Yopem", maxLength: 100 },
    {
      key: "address",
      label: "Address",
      type: "text",
      placeholder: "12 Rue de la Plage, Casablanca",
      maxLength: 200,
      fullWidth: true,
    },
    {
      key: "note",
      label: "Note",
      type: "textarea",
      placeholder: "Where and when you met",
      rows: 2,
      maxLength: 300,
      fullWidth: true,
    },
  ],
  encode(values: ContentValues): string {
    const first = textValue(values, "firstName")
    const last = textValue(values, "lastName")
    if (!first && !last) throw new Error("A first or last name is required")

    let payload = "MECARD:N:" + escapeMecardValue(last) + "," + escapeMecardValue(first) + ";"
    const phone = textValue(values, "phone")
    const email = textValue(values, "email")
    const website = textValue(values, "website")
    const organization = textValue(values, "organization")
    const address = textValue(values, "address")
    const note = textValue(values, "note")

    if (phone) payload += "TEL:" + normalizePhoneNumber(phone) + ";"
    if (email) payload += "EMAIL:" + email + ";"
    if (website) payload += "URL:" + normalizeHttpUrl(website) + ";"
    if (organization) payload += "ORG:" + escapeMecardValue(organization) + ";"
    if (address) payload += "ADR:" + escapeMecardValue(address) + ";"
    if (note) payload += "NOTE:" + escapeMecardValue(note) + ";"
    payload += ";"
    return payload
  },
  validate(values: ContentValues) {
    const errors: Record<string, string> = {}
    const first = textValue(values, "firstName")
    const last = textValue(values, "lastName")
    if (!first && !last) errors.firstName = "Enter at least a first or last name"
    const phone = textValue(values, "phone")
    if (phone && !isLikelyPhoneNumber(phone)) errors.phone = "Enter a valid phone number"
    const email = textValue(values, "email")
    if (email && !isEmail(email)) errors.email = "Enter a valid e-mail address"
    const website = textValue(values, "website")
    if (website && !isHttpUrl(website)) errors.website = "Enter a valid URL"
    return Object.keys(errors).length > 0 ? { valid: false, errors } : { valid: true }
  },
  sample: {
    firstName: "Amine",
    lastName: "Benali",
    phone: "+212 600 000 000",
    email: "amine@yopem.com",
    website: "https://yopem.com",
    organization: "Yopem",
    address: "12 Rue de la Plage, Casablanca",
    note: "Met at DevFest 2025",
  },
  summarize(values: ContentValues): string {
    const name = [textValue(values, "firstName"), textValue(values, "lastName")]
      .filter((part) => part.length > 0)
      .join(" ")
    return name || "Contact"
  },
}

export default mecardContentType
