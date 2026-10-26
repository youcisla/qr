/**
 * Decode a scanned QR payload into a friendly, structured result.
 *
 * The scanner UI uses this to render a result card with copy/open actions
 * instead of dumping a raw string. It is deliberately defensive: every payload
 * is untrusted input, parsers never throw and anything unrecognised falls back
 * to a plain text result.
 *
 * Isomorphic and dependency-free (relative imports only) so it also runs in
 * Bun tests.
 */

import {
  addDaysToIsoDate,
  digitsOnly,
  escapeVcardText,
  isEmail,
  isHttpUrl,
  normalizeHttpUrl,
  normalizeIban,
  normalizePhoneNumber,
  parseHttpUrl,
  unescapeMecardValue,
  unescapeVcardText,
  unescapeWifiValue,
} from "./content/helpers"

export type ParsedQrKind =
  | "url"
  | "text"
  | "email"
  | "phone"
  | "sms"
  | "whatsapp"
  | "wifi"
  | "vcard"
  | "mecard"
  | "geo"
  | "event"
  | "crypto"
  | "epc"
  | "app"
  | "social"
  | "paypal"

export type ParsedFieldKind =
  | "text"
  | "url"
  | "email"
  | "tel"
  | "datetime"
  | "secret"
  | "money"
  | "multiline"

export interface ParsedQrField {
  label: string
  value: string
  /** Rendering hint for the result card. */
  kind?: ParsedFieldKind
  /** Ready to use href for url / email / tel fields. */
  href?: string
}

export type ParsedQrActionKind =
  | "open"
  | "copy"
  | "call"
  | "sms"
  | "email"
  | "map"
  | "add-contact"
  | "add-event"
  | "download"

export interface ParsedQrAction {
  id: string
  label: string
  kind: ParsedQrActionKind
  href?: string
  /** Value copied by "copy" actions. */
  value?: string
  /** Suggested file name for download actions. */
  download?: string
}

export interface ParsedQrPayload {
  /** Structured type of the decoded payload. */
  kind: ParsedQrKind
  title: string
  subtitle?: string
  fields: ParsedQrField[]
  /** Primary actionable URL, when the payload points somewhere. */
  url?: string
  actions: ParsedQrAction[]
  /** Raw scanned payload, verbatim. */
  raw: string
  /** Extra structured data for programmatic use (e.g. the WiFi SSID). */
  meta?: Record<string, string>
}

/* -------------------------------------------------------------------------- */
/*                                  Utilities                                 */
/* -------------------------------------------------------------------------- */

function truncate(value: string, max = 160): string {
  if (value.length <= max) return value
  return value.slice(0, max - 1) + "\u2026"
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "qr-code"
  )
}

function safeDecodeUri(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function dataUrl(mimeType: string, content: string): string {
  return "data:" + mimeType + ";charset=utf-8," + encodeURIComponent(content)
}

/** Split on a separator while honouring backslash escapes. */
function splitEscaped(value: string, separator: string): string[] {
  const parts: string[] = []
  let current = ""
  for (let index = 0; index < value.length; index++) {
    const character = value[index]
    if (character === "\\" && index + 1 < value.length) {
      current += character + value[index + 1]
      index++
      continue
    }
    if (character === separator) {
      parts.push(current)
      current = ""
      continue
    }
    current += character
  }
  parts.push(current)
  return parts
}

function indexOfUnescaped(value: string, target: string): number {
  for (let index = 0; index < value.length; index++) {
    if (value[index] === "\\") {
      index++
      continue
    }
    if (value[index] === target) return index
  }
  return -1
}

/** Unfold RFC 2426 / RFC 5545 content lines into logical lines. */
function unfoldLines(raw: string): string[] {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
}

interface ContentProperty {
  name: string
  params: Record<string, string[]>
  value: string
}

/** Parse a single vCard / iCalendar content line into name, params and value. */
function parseContentLine(line: string): ContentProperty | null {
  const colonIndex = line.indexOf(":")
  if (colonIndex <= 0) return null
  const header = line.slice(0, colonIndex)
  const value = line.slice(colonIndex + 1)
  const headerParts = header.split(";")
  const name = headerParts[0].trim().toUpperCase()
  if (!name) return null
  const params: Record<string, string[]> = {}
  for (const part of headerParts.slice(1)) {
    const equalsIndex = part.indexOf("=")
    if (equalsIndex < 0) {
      const typeList = params.TYPE ?? []
      typeList.push(part.trim().toUpperCase())
      params.TYPE = typeList
      continue
    }
    const key = part.slice(0, equalsIndex).trim().toUpperCase()
    const rawValue = part.slice(equalsIndex + 1).trim()
    const values = rawValue.split(",").map((entry) => entry.trim())
    params[key] = (params[key] ?? []).concat(values)
  }
  return { name, params, value }
}

function findProperty(properties: ContentProperty[], name: string): ContentProperty | undefined {
  return properties.find((property) => property.name === name)
}

function findProperties(properties: ContentProperty[], name: string): ContentProperty[] {
  return properties.filter((property) => property.name === name)
}

function firstValue(properties: ContentProperty[], name: string): string {
  const property = findProperty(properties, name)
  return property ? unescapeVcardText(property.value).trim() : ""
}

/* -------------------------------------------------------------------------- */
/*                                  Fallback                                  */
/* -------------------------------------------------------------------------- */

function textResult(raw: string): ParsedQrPayload {
  const value = raw.trim()
  const fields: ParsedQrField[] = []
  if (value.length > 0) {
    fields.push({ label: "Text", value: truncate(value, 2000), kind: "multiline" })
  }
  const actions: ParsedQrAction[] = []
  if (value.length > 0) {
    actions.push({ id: "copy-text", label: "Copy text", kind: "copy", value })
  }
  return {
    kind: "text",
    title: value.length > 0 ? "Text" : "Empty QR code",
    subtitle: value.length > 0 ? truncate(value.replace(/\s+/g, " "), 80) : undefined,
    fields,
    actions,
    raw,
  }
}

/* -------------------------------------------------------------------------- */
/*                                    WiFi                                    */
/* -------------------------------------------------------------------------- */

function parseWifi(raw: string): ParsedQrPayload {
  const payload = raw.trim().slice(raw.trim().indexOf(":") + 1)
  const entries: Record<string, string> = {}
  for (const part of splitEscaped(payload, ";")) {
    const separatorIndex = indexOfUnescaped(part, ":")
    if (separatorIndex <= 0) continue
    const key = part.slice(0, separatorIndex).trim().toUpperCase()
    const value = unescapeWifiValue(part.slice(separatorIndex + 1))
    if (key) entries[key] = value
  }

  const ssid = entries.S ?? ""
  const rawType = (entries.T ?? "").toLowerCase()
  const hidden = (entries.H ?? "").toLowerCase() === "true"
  const password = entries.P ?? ""
  const security =
    rawType === "wep" ? "WEP" : rawType === "nopass" || rawType === "" ? "Open" : "WPA / WPA2"

  const fields: ParsedQrField[] = []
  fields.push({ label: "Network", value: ssid || "Hidden network" })
  fields.push({ label: "Security", value: security })
  if (password && security !== "Open") {
    fields.push({ label: "Password", value: password, kind: "secret" })
  }
  if (hidden) fields.push({ label: "Hidden network", value: "Yes" })

  const actions: ParsedQrAction[] = []
  if (password && security !== "Open") {
    actions.push({ id: "copy-password", label: "Copy password", kind: "copy", value: password })
  }
  if (ssid) actions.push({ id: "copy-ssid", label: "Copy network name", kind: "copy", value: ssid })

  return {
    kind: "wifi",
    title: ssid || "Wi-Fi Network",
    subtitle: security + (hidden ? " - hidden network" : ""),
    fields,
    actions,
    raw,
    meta: { ssid, security, hidden: String(hidden), password },
  }
}

/* -------------------------------------------------------------------------- */
/*                                vCard/MeCard                                */
/* -------------------------------------------------------------------------- */

function formatAddress(parts: string[]): string {
  return parts.filter((part) => part.trim().length > 0).join(", ")
}

function parseVcard(raw: string): ParsedQrPayload {
  const lines = unfoldLines(raw)
  const properties = lines
    .map(parseContentLine)
    .filter((property): property is ContentProperty => property !== null)

  const fullName = firstValue(properties, "FN")
  const nProperty = findProperty(properties, "N")
  const nameParts = nProperty ? splitEscaped(nProperty.value, ";").map(unescapeVcardText) : []
  const lastName = (nameParts[0] ?? "").trim()
  const firstName = (nameParts[1] ?? "").trim()
  const composedName = [firstName, lastName].filter((part) => part.length > 0).join(" ")
  const name = fullName || composedName

  const organization = firstValue(properties, "ORG")
  const jobTitle = firstValue(properties, "TITLE")
  const note = firstValue(properties, "NOTE")
  const birthday = firstValue(properties, "BDAY")
  const website =
    findProperties(properties, "URL")
      .map((property) => property.value.trim())
      .find((value) => value.length > 0) ?? ""
  const email =
    findProperties(properties, "EMAIL")
      .map((property) => unescapeVcardText(property.value).trim())
      .find((value) => value.length > 0) ?? ""
  const phoneNumbers = findProperties(properties, "TEL")
    .map((property) => {
      const rawValue = unescapeVcardText(property.value).trim()
      return rawValue.replace(/^tel:/i, "")
    })
    .filter((value) => value.length > 0)
  const addressProperty = findProperty(properties, "ADR")
  const address = addressProperty
    ? formatAddress(splitEscaped(addressProperty.value, ";").map(unescapeVcardText))
    : ""

  const fields: ParsedQrField[] = []
  if (name) fields.push({ label: "Name", value: name })
  if (organization) fields.push({ label: "Company", value: organization })
  if (jobTitle) fields.push({ label: "Job title", value: jobTitle })
  if (phoneNumbers[0]) {
    fields.push({
      label: "Phone",
      value: phoneNumbers[0],
      kind: "tel",
      href: "tel:" + normalizePhoneNumber(phoneNumbers[0]),
    })
  }
  for (const phone of phoneNumbers.slice(1)) {
    fields.push({
      label: "Phone",
      value: phone,
      kind: "tel",
      href: "tel:" + normalizePhoneNumber(phone),
    })
  }
  if (email) fields.push({ label: "E-mail", value: email, kind: "email", href: "mailto:" + email })
  if (website) fields.push({ label: "Website", value: website, kind: "url", href: website })
  if (address) fields.push({ label: "Address", value: address })
  if (note) fields.push({ label: "Note", value: note, kind: "multiline" })
  if (birthday) fields.push({ label: "Birthday", value: birthday })

  const actions: ParsedQrAction[] = []
  actions.push({
    id: "save-contact",
    label: "Save contact",
    kind: "download",
    href: dataUrl("text/vcard", raw.trim()),
    download: slugify(name || "contact") + ".vcf",
  })
  if (phoneNumbers[0]) {
    actions.push({
      id: "call",
      label: "Call",
      kind: "call",
      href: "tel:" + normalizePhoneNumber(phoneNumbers[0]),
    })
  }
  if (email) actions.push({ id: "email", label: "E-mail", kind: "email", href: "mailto:" + email })
  if (website && isHttpUrl(website)) {
    actions.push({ id: "open-website", label: "Open website", kind: "open", href: website })
  }

  return {
    kind: "vcard",
    title: name || "Contact card",
    subtitle: [jobTitle, organization].filter((part) => part.length > 0).join(" - ") || "Contact",
    fields,
    url: website || undefined,
    actions,
    raw,
    meta: { name, organization, email, phone: phoneNumbers[0] ?? "" },
  }
}

function mecardToVcard(entries: Record<string, string>, byName: Array<[string, string]>): string {
  const first = entries["FIRSTNAME"] ?? ""
  const last = entries["LASTNAME"] ?? ""
  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"]
  lines.push("N:" + escapeVcardText(last) + ";" + escapeVcardText(first) + ";;;")
  const fullName = [first, last].filter((part) => part.length > 0).join(" ")
  if (fullName) lines.push("FN:" + escapeVcardText(fullName))
  for (const [property, value] of byName) {
    if (value) lines.push(property + ":" + escapeVcardText(value))
  }
  lines.push("END:VCARD")
  return lines.join("\r\n")
}

function parseMecard(raw: string): ParsedQrPayload {
  const trimmed = raw.trim()
  const payload = trimmed.slice(trimmed.indexOf(":") + 1)
  const entries: Record<string, string> = {}
  for (const part of splitEscaped(payload, ";")) {
    const separatorIndex = indexOfUnescaped(part, ":")
    if (separatorIndex <= 0) continue
    const key = part.slice(0, separatorIndex).trim().toUpperCase()
    const value = unescapeMecardValue(part.slice(separatorIndex + 1))
    if (key && !(key in entries)) entries[key] = value
  }

  const nameParts = splitEscaped(entries.N ?? "", ",").map(unescapeMecardValue)
  const lastName = (nameParts[0] ?? "").trim()
  const firstName = (nameParts[1] ?? "").trim()
  const name = [firstName, lastName].filter((part) => part.length > 0).join(" ")
  const phone = entries.TEL ?? entries["TEL-AV"] ?? ""
  const email = entries.EMAIL ?? ""
  const website = entries.URL ?? ""
  const organization = entries.ORG ?? ""
  const address = entries.ADR ?? ""
  const note = entries.NOTE ?? ""

  entries.FIRSTNAME = firstName
  entries.LASTNAME = lastName

  const fields: ParsedQrField[] = []
  if (name) fields.push({ label: "Name", value: name })
  if (organization) fields.push({ label: "Company", value: organization })
  if (phone) {
    fields.push({
      label: "Phone",
      value: phone,
      kind: "tel",
      href: "tel:" + normalizePhoneNumber(phone),
    })
  }
  if (email) fields.push({ label: "E-mail", value: email, kind: "email", href: "mailto:" + email })
  if (website) fields.push({ label: "Website", value: website, kind: "url", href: website })
  if (address) fields.push({ label: "Address", value: address })
  if (note) fields.push({ label: "Note", value: note, kind: "multiline" })

  const contactVcard = mecardToVcard(entries, [
    ["TEL", phone],
    ["EMAIL", email],
    ["URL", website],
    ["ORG", organization],
    ["ADR", address],
    ["NOTE", note],
  ])
  const actions: ParsedQrAction[] = [
    {
      id: "save-contact",
      label: "Save contact",
      kind: "download",
      href: dataUrl("text/vcard", contactVcard),
      download: slugify(name || "contact") + ".vcf",
    },
  ]
  if (phone) {
    actions.push({
      id: "call",
      label: "Call",
      kind: "call",
      href: "tel:" + normalizePhoneNumber(phone),
    })
  }
  if (email) actions.push({ id: "email", label: "E-mail", kind: "email", href: "mailto:" + email })
  if (website && isHttpUrl(website)) {
    actions.push({ id: "open-website", label: "Open website", kind: "open", href: website })
  }

  return {
    kind: "mecard",
    title: name || "MeCard contact",
    subtitle: organization || "Contact",
    fields,
    url: website || undefined,
    actions,
    raw,
    meta: { name, organization, email, phone },
  }
}

/* -------------------------------------------------------------------------- */
/*                               Email / phone                                */
/* -------------------------------------------------------------------------- */

function parseMailto(raw: string): ParsedQrPayload {
  const trimmed = raw.trim()
  const withoutScheme = trimmed.slice(trimmed.indexOf(":") + 1)
  const queryIndex = withoutScheme.indexOf("?")
  const addressPart = queryIndex >= 0 ? withoutScheme.slice(0, queryIndex) : withoutScheme
  const queryPart = queryIndex >= 0 ? withoutScheme.slice(queryIndex + 1) : ""
  const recipients = safeDecodeUri(addressPart)
    .split(",")
    .map((address) => address.trim())
    .filter((address) => address.length > 0)
  const params = new URLSearchParams(queryPart)
  const subject = params.get("subject") ?? ""
  const body = params.get("body") ?? ""
  const cc = params.get("cc") ?? ""

  const fields: ParsedQrField[] = []
  if (recipients.length > 0) fields.push({ label: "To", value: recipients.join(", ") })
  if (cc) fields.push({ label: "CC", value: cc })
  if (subject) fields.push({ label: "Subject", value: subject })
  if (body) fields.push({ label: "Message", value: body, kind: "multiline" })

  const actions: ParsedQrAction[] = [
    { id: "send-email", label: "Compose e-mail", kind: "email", href: trimmed },
  ]
  if (recipients[0]) {
    actions.push({
      id: "copy-address",
      label: "Copy address",
      kind: "copy",
      value: recipients.join(", "),
    })
  }

  return {
    kind: "email",
    title: subject || "E-mail",
    subtitle: recipients.join(", ") || "E-mail",
    fields,
    actions,
    raw,
    meta: { to: recipients.join(", "), subject, body, cc },
  }
}

function parseTel(raw: string): ParsedQrPayload {
  const trimmed = raw.trim()
  const number = trimmed.slice(trimmed.indexOf(":") + 1).trim()
  const href = "tel:" + normalizePhoneNumber(number)
  return {
    kind: "phone",
    title: number || "Phone number",
    subtitle: "Phone call",
    fields: [{ label: "Phone number", value: number, kind: "tel", href }],
    actions: [
      { id: "call", label: "Call", kind: "call", href },
      { id: "copy-number", label: "Copy number", kind: "copy", value: number },
    ],
    raw,
    meta: { number },
  }
}

function parseSms(raw: string): ParsedQrPayload {
  const trimmed = raw.trim()
  const lower = trimmed.toLowerCase()
  let number = ""
  let message = ""

  if (lower.startsWith("smsto:")) {
    const rest = trimmed.slice("smsto:".length)
    const separatorIndex = rest.indexOf(":")
    number = separatorIndex >= 0 ? rest.slice(0, separatorIndex) : rest
    message = separatorIndex >= 0 ? rest.slice(separatorIndex + 1) : ""
  } else {
    const rest = trimmed.slice(trimmed.indexOf(":") + 1)
    const queryIndex = rest.search(/[?&]/)
    if (queryIndex >= 0) {
      number = rest.slice(0, queryIndex)
      const params = new URLSearchParams(rest.slice(queryIndex + 1))
      message = params.get("body") ?? params.get("message") ?? ""
    } else if (rest.includes(":")) {
      const separatorIndex = rest.indexOf(":")
      number = rest.slice(0, separatorIndex)
      message = rest.slice(separatorIndex + 1)
    } else {
      number = rest
    }
  }

  number = safeDecodeUri(number).trim()
  message = safeDecodeUri(message).trim()

  const fields: ParsedQrField[] = []
  if (number) fields.push({ label: "Phone number", value: number, kind: "tel" })
  if (message) fields.push({ label: "Message", value: message, kind: "multiline" })

  const smsHref =
    "sms:" + normalizePhoneNumber(number) + (message ? "?body=" + encodeURIComponent(message) : "")
  const actions: ParsedQrAction[] = [
    { id: "send-sms", label: "Send SMS", kind: "sms", href: smsHref },
  ]
  if (message)
    actions.push({ id: "copy-message", label: "Copy message", kind: "copy", value: message })

  return {
    kind: "sms",
    title: number || "SMS",
    subtitle: message ? truncate(message, 80) : "Text message",
    fields,
    actions,
    raw,
    meta: { number, message },
  }
}

/* -------------------------------------------------------------------------- */
/*                                    Geo                                     */
/* -------------------------------------------------------------------------- */

const SOCIAL_HOSTS: Record<string, { label: string; handlePrefix?: string }> = {
  "instagram.com": { label: "Instagram" },
  "facebook.com": { label: "Facebook" },
  "fb.com": { label: "Facebook" },
  "tiktok.com": { label: "TikTok" },
  "x.com": { label: "X (Twitter)" },
  "twitter.com": { label: "X (Twitter)" },
  "linkedin.com": { label: "LinkedIn" },
  "youtube.com": { label: "YouTube" },
  "youtu.be": { label: "YouTube" },
  "snapchat.com": { label: "Snapchat" },
  "pinterest.com": { label: "Pinterest" },
  "t.me": { label: "Telegram" },
  "telegram.me": { label: "Telegram" },
  "github.com": { label: "GitHub" },
}

const WALLET_COINS: Record<string, { label: string; unit: string }> = {
  bitcoin: { label: "Bitcoin", unit: "BTC" },
  litecoin: { label: "Litecoin", unit: "LTC" },
  dogecoin: { label: "Dogecoin", unit: "DOGE" },
  bitcoincash: { label: "Bitcoin Cash", unit: "BCH" },
  ethereum: { label: "Ethereum", unit: "ETH" },
}

function parseGeo(raw: string): ParsedQrPayload {
  const trimmed = raw.trim()
  const remainder = trimmed.slice(trimmed.indexOf(":") + 1)
  const queryIndex = remainder.indexOf("?")
  const coordinatePart = (queryIndex >= 0 ? remainder.slice(0, queryIndex) : remainder)
    .split(";")[0]
    .trim()
  const query = queryIndex >= 0 ? new URLSearchParams(remainder.slice(queryIndex + 1)) : null
  const coordinates = coordinatePart.split(",")
  const latitude = (coordinates[0] ?? "").trim()
  const longitude = (coordinates[1] ?? "").trim()
  const altitude = (coordinates[2] ?? "").trim()
  const labelParam = query?.get("q") ?? ""
  const label = labelParam
    .replace(/^[-\d.,]+\s*/, "")
    .replace(/^\(|\)$/g, "")
    .trim()

  const fields: ParsedQrField[] = []
  if (latitude) fields.push({ label: "Latitude", value: latitude })
  if (longitude) fields.push({ label: "Longitude", value: longitude })
  if (altitude) fields.push({ label: "Altitude", value: altitude + " m" })
  if (label) fields.push({ label: "Place", value: label })

  const coordinatesText = latitude + "," + longitude
  const mapsHref = "https://www.google.com/maps?q=" + encodeURIComponent(coordinatesText) + "&z=16"
  const actions: ParsedQrAction[] = [
    { id: "open-map", label: "Open in maps", kind: "map", href: mapsHref },
    { id: "copy-coordinates", label: "Copy coordinates", kind: "copy", value: coordinatesText },
  ]
  if (label) actions.push({ id: "copy-place", label: "Copy place", kind: "copy", value: label })

  return {
    kind: "geo",
    title: label || coordinatesText,
    subtitle: "Location",
    fields,
    url: mapsHref,
    actions,
    raw,
    meta: { latitude, longitude, label },
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Event                                    */
/* -------------------------------------------------------------------------- */

interface IcalDate {
  /** ISO-ish string: "2026-11-20T18:00:00Z", "2026-11-20 18:00:00" or "2026-11-20". */
  iso: string
  /** Basic iCalendar value used by calendar links ("20261120T180000Z"). */
  basic: string
  allDay: boolean
}

function parseIcalDate(value: string): IcalDate | null {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim())
  if (!match) return null
  const year = match[1]
  const month = match[2]
  const day = match[3]
  const hours = match[4]
  const minutes = match[5]
  const seconds = match[6]
  const utc = match[7] === "Z"
  const datePart = year + "-" + month + "-" + day
  if (hours === undefined) {
    return { iso: datePart, basic: year + month + day, allDay: true }
  }
  const timePart = hours + ":" + minutes + ":" + seconds
  const basic = year + month + day + "T" + hours + minutes + seconds + (utc ? "Z" : "")
  return {
    iso: datePart + (utc ? "T" + timePart + "Z" : " " + timePart),
    basic,
    allDay: false,
  }
}

function parseEvent(raw: string): ParsedQrPayload {
  const lines = unfoldLines(raw)
  const properties = lines
    .map(parseContentLine)
    .filter((property): property is ContentProperty => property !== null)

  const summary = firstValue(properties, "SUMMARY") || "Calendar event"
  const location = firstValue(properties, "LOCATION")
  const description = firstValue(properties, "DESCRIPTION")
  const startProperty = findProperty(properties, "DTSTART")
  const endProperty = findProperty(properties, "DTEND")
  const start = startProperty ? parseIcalDate(startProperty.value) : null
  const end = endProperty ? parseIcalDate(endProperty.value) : null

  let when = ""
  if (start) {
    if (start.allDay) {
      let lastDay = start.iso
      if (end && end.iso > start.iso) {
        const inclusive = addDaysToIsoDate(end.iso.slice(0, 10), -1)
        lastDay = inclusive ?? end.iso.slice(0, 10)
      }
      when = lastDay && lastDay !== start.iso ? start.iso + " to " + lastDay : start.iso
    } else {
      when = end ? start.iso + " - " + end.iso : start.iso
    }
  }

  const fields: ParsedQrField[] = []
  if (when) fields.push({ label: "When", value: when, kind: "datetime" })
  if (location) fields.push({ label: "Where", value: location })
  if (description) fields.push({ label: "Description", value: description, kind: "multiline" })

  const actions: ParsedQrAction[] = []
  if (start) {
    const startBasic = start.basic
    const endBasic = end?.basic ?? (start.allDay ? addDaysToIsoDate(start.iso, 1) : start.basic)
    const calendarUrl =
      "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" +
      encodeURIComponent(summary) +
      "&dates=" +
      encodeURIComponent(startBasic + "/" + (endBasic ?? startBasic)) +
      (location ? "&location=" + encodeURIComponent(location) : "") +
      (description ? "&details=" + encodeURIComponent(description) : "")
    actions.push({
      id: "add-to-calendar",
      label: "Add to calendar",
      kind: "add-event",
      href: calendarUrl,
    })
  }
  actions.push({ id: "copy-event", label: "Copy event details", kind: "copy", value: raw.trim() })

  return {
    kind: "event",
    title: summary,
    subtitle: when || "Calendar event",
    fields,
    actions,
    raw,
    meta: {
      title: summary,
      location,
      description,
      start: start?.iso ?? "",
      end: end?.iso ?? "",
      allDay: String(start?.allDay ?? false),
    },
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Crypto                                    */
/* -------------------------------------------------------------------------- */

function parseCrypto(raw: string): ParsedQrPayload {
  const trimmed = raw.trim()
  const colonIndex = trimmed.indexOf(":")
  const scheme = trimmed.slice(0, colonIndex).toLowerCase()
  const coin = WALLET_COINS[scheme] ?? { label: scheme, unit: scheme.toUpperCase() }
  const rest = trimmed.slice(colonIndex + 1)
  const queryIndex = rest.indexOf("?")
  const address = safeDecodeUri(queryIndex >= 0 ? rest.slice(0, queryIndex) : rest).trim()
  const params = queryIndex >= 0 ? new URLSearchParams(rest.slice(queryIndex + 1)) : null
  const amount = params?.get("amount") ?? params?.get("value") ?? ""
  const label = params?.get("label") ?? params?.get("message") ?? ""

  const fields: ParsedQrField[] = [
    { label: "Coin", value: coin.label },
    { label: "Address", value: address, kind: "text" },
  ]
  if (amount) fields.push({ label: "Amount", value: amount + " " + coin.unit, kind: "money" })
  if (label) fields.push({ label: "Label", value: label })

  const actions: ParsedQrAction[] = [
    { id: "open-wallet", label: "Open in wallet", kind: "open", href: trimmed },
    { id: "copy-address", label: "Copy address", kind: "copy", value: address },
  ]
  if (amount) actions.push({ id: "copy-amount", label: "Copy amount", kind: "copy", value: amount })

  return {
    kind: "crypto",
    title: coin.label + " payment",
    subtitle: amount ? amount + " " + coin.unit : label || coin.label,
    fields,
    actions,
    raw,
    meta: { scheme, address, amount, label },
  }
}

/* -------------------------------------------------------------------------- */
/*                                    EPC                                     */
/* -------------------------------------------------------------------------- */

function parseEpc(raw: string): ParsedQrPayload {
  const lines = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())

  const version = lines[1] ?? ""
  const bonus = lines[4] ?? ""
  const name = lines[5] ?? ""
  const iban = normalizeIban(lines[6] ?? "")
  const rawAmount = lines[7] ?? ""
  const amountValue = rawAmount.replace(/^EUR/i, "").trim()
  const remittance = lines[8] ?? ""
  const purpose = lines[9] ?? ""
  const reference = lines[10] ?? ""

  const fields: ParsedQrField[] = []
  if (name) fields.push({ label: "Beneficiary", value: name })
  if (iban) fields.push({ label: "IBAN", value: iban })
  if (bonus) fields.push({ label: "BIC", value: bonus })
  if (amountValue) fields.push({ label: "Amount", value: "EUR " + amountValue, kind: "money" })
  if (remittance) fields.push({ label: "Reference", value: remittance, kind: "multiline" })
  if (purpose) fields.push({ label: "Purpose code", value: purpose })
  if (reference) fields.push({ label: "Mandate reference", value: reference })

  const actions: ParsedQrAction[] = [
    { id: "copy-iban", label: "Copy IBAN", kind: "copy", value: iban },
  ]
  if (amountValue) {
    actions.push({ id: "copy-amount", label: "Copy amount", kind: "copy", value: amountValue })
  }

  return {
    kind: "epc",
    title: name || "SEPA transfer",
    subtitle: amountValue ? "EUR " + amountValue : "SEPA credit transfer",
    fields,
    actions,
    raw,
    meta: { version, bic: bonus, name, iban, amount: amountValue, remittance },
  }
}

/* -------------------------------------------------------------------------- */
/*                                   URLs                                     */
/* -------------------------------------------------------------------------- */

function normalizeInputUrl(raw: string): { url: URL; normalized: string } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/\s/.test(trimmed)) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
      ? trimmed
      : "https://" + trimmed.replace(/^\/\//, "")
  const url = parseHttpUrl(withScheme)
  return url ? { url, normalized: normalizeHttpUrl(withScheme) } : null
}

function looksLikeBareDomain(value: string): boolean {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\.[a-z]{2,})?(\/[^\s]*)?$/i.test(value) && !value.includes("@")
}

/** Format a URL without the noisy trailing slash that URL#toString adds. */
function formatUrl(url: URL): string {
  const path = url.pathname === "/" ? "" : url.pathname
  return url.origin + path + url.search + url.hash
}

function socialResult(raw: string, url: URL, network: { label: string }): ParsedQrPayload {
  const segments = url.pathname.split("/").filter((segment) => segment.length > 0)
  const handle = (segments[0] ?? "").replace(/^@/, "")
  const profileUrl = formatUrl(url)
  const fields: ParsedQrField[] = [
    { label: "Profile", value: profileUrl, kind: "url", href: profileUrl },
  ]
  if (handle) fields.push({ label: "Username", value: handle })
  return {
    kind: "social",
    title: network.label,
    subtitle: handle ? "@" + handle : url.hostname,
    fields,
    url: profileUrl,
    actions: [
      { id: "open-profile", label: "Open profile", kind: "open", href: profileUrl },
      { id: "copy-link", label: "Copy link", kind: "copy", value: profileUrl },
    ],
    raw,
    meta: { network: network.label.toLowerCase(), handle },
  }
}

function parseUrlPayload(raw: string, url: URL): ParsedQrPayload {
  const normalized = formatUrl(url)
  const hostname = url.hostname.replace(/^www\./i, "").toLowerCase()
  const path = safeDecodeUri(url.pathname)
  const host = url.hostname.toLowerCase()

  // WhatsApp click-to-chat links.
  if (host === "wa.me" || host.endsWith(".whatsapp.com") || host === "api.whatsapp.com") {
    const segments = url.pathname.split("/").filter((segment) => segment.length > 0)
    const phone = (segments[0] ?? "").replace(/\D/g, "")
    const message = url.searchParams.get("text") ?? ""
    const fields: ParsedQrField[] = []
    if (phone) fields.push({ label: "WhatsApp number", value: phone, kind: "tel" })
    if (message) fields.push({ label: "Message", value: message, kind: "multiline" })
    return {
      kind: "whatsapp",
      title: "WhatsApp",
      subtitle: message ? truncate(message, 80) : phone,
      fields,
      url: normalized,
      actions: [
        { id: "open-whatsapp", label: "Open WhatsApp", kind: "open", href: normalized },
        ...(phone
          ? [{ id: "copy-number", label: "Copy number", kind: "copy" as const, value: phone }]
          : []),
      ],
      raw,
      meta: { phone, message },
    }
  }

  // PayPal.Me payment links.
  if (host === "paypal.me" || (host === "paypal.com" && /^\/paypalme\//i.test(url.pathname))) {
    const segments = url.pathname.split("/").filter((segment) => segment.length > 0)
    const startIndex = segments[0]?.toLowerCase() === "paypalme" ? 1 : 0
    const handle = segments[startIndex] ?? ""
    const amountPart = segments[startIndex + 1] ?? ""
    const amountMatch = /^([\d.]+)([A-Za-z]{3})?$/.exec(amountPart)
    const fields: ParsedQrField[] = []
    if (handle) fields.push({ label: "PayPal.Me username", value: handle })
    if (amountMatch) {
      fields.push({
        label: "Amount",
        value: amountMatch[2] ? amountMatch[1] + " " + amountMatch[2] : amountMatch[1],
        kind: "money",
      })
    }
    return {
      kind: "paypal",
      title: "PayPal",
      subtitle: handle ? "paypal.me/" + handle : "Payment request",
      fields,
      url: normalized,
      actions: [
        { id: "open-paypal", label: "Open PayPal", kind: "open", href: normalized },
        { id: "copy-link", label: "Copy link", kind: "copy", value: normalized },
      ],
      raw,
      meta: { handle, amount: amountMatch?.[1] ?? "", currency: amountMatch?.[2] ?? "" },
    }
  }

  // App store links.
  if (host === "apps.apple.com") {
    const idMatch = /\/id(\d+)/.exec(url.pathname)
    const fields: ParsedQrField[] = [{ label: "Store", value: "Apple App Store" }]
    if (idMatch) fields.push({ label: "App ID", value: idMatch[1] })
    return {
      kind: "app",
      title: "App Store",
      subtitle: idMatch ? "App ID " + idMatch[1] : url.hostname,
      fields,
      url: normalized,
      actions: [
        { id: "open-app", label: "Open in App Store", kind: "open", href: normalized },
        { id: "copy-link", label: "Copy link", kind: "copy", value: normalized },
      ],
      raw,
      meta: { store: "ios", appId: idMatch?.[1] ?? "" },
    }
  }
  if (host === "play.google.com" && /^\/store\/apps\/details/.test(url.pathname)) {
    const packageName = url.searchParams.get("id") ?? ""
    return {
      kind: "app",
      title: "Google Play",
      subtitle: packageName || "App listing",
      fields: [
        { label: "Store", value: "Google Play" },
        ...(packageName ? [{ label: "Package", value: packageName }] : []),
      ],
      url: normalized,
      actions: [
        { id: "open-app", label: "Open in Google Play", kind: "open", href: normalized },
        { id: "copy-link", label: "Copy link", kind: "copy", value: normalized },
      ],
      raw,
      meta: { store: "android", packageName },
    }
  }

  const socialNetwork = SOCIAL_HOSTS[hostname] ?? SOCIAL_HOSTS[host]
  if (socialNetwork) return socialResult(raw, url, socialNetwork)

  const fields: ParsedQrField[] = [
    { label: "Link", value: normalized, kind: "url", href: normalized },
  ]
  const displayPath = path === "/" ? "" : truncate(path, 80)
  return {
    kind: "url",
    title: hostname,
    subtitle: displayPath || "Website",
    fields,
    url: normalized,
    actions: [
      { id: "open-link", label: "Open link", kind: "open", href: normalized },
      { id: "copy-link", label: "Copy link", kind: "copy", value: normalized },
    ],
    raw,
    meta: { hostname, path },
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Dispatch                                  */
/* -------------------------------------------------------------------------- */

/**
 * Decode any QR payload into a structured, render-ready result. Never throws:
 * malformed payloads degrade to a plain text result.
 */
export function parseQrPayload(raw: string): ParsedQrPayload {
  const data = typeof raw === "string" ? raw.trim() : ""
  if (!data) return textResult("")

  try {
    const upper = data.toUpperCase()

    if (upper.startsWith("WIFI:")) return parseWifi(data)
    if (upper.startsWith("BEGIN:VCARD")) return parseVcard(data)
    if (upper.startsWith("MECARD:")) return parseMecard(data)
    if (
      upper.startsWith("BEGIN:VEVENT") ||
      (upper.startsWith("BEGIN:VCALENDAR") && upper.includes("BEGIN:VEVENT"))
    ) {
      return parseEvent(data)
    }
    if (upper.startsWith("MAILTO:")) return parseMailto(data)
    if (upper.startsWith("TEL:")) return parseTel(data)
    if (upper.startsWith("SMSTO:") || upper.startsWith("SMS:") || upper.startsWith("MMS:")) {
      return parseSms(data)
    }
    if (upper.startsWith("GEO:")) return parseGeo(data)

    const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(data)
    const scheme = schemeMatch ? schemeMatch[1].toLowerCase() : ""
    if (scheme && WALLET_COINS[scheme]) return parseCrypto(data)

    if (data === "BCD" || data.startsWith("BCD\n") || data.startsWith("BCD\r\n")) {
      return parseEpc(data)
    }

    if (/^https?:\/\//i.test(data) || /^\/\//.test(data)) {
      const parsed = normalizeInputUrl(data)
      if (parsed) return parseUrlPayload(data, parsed.url)
    }

    if (looksLikeBareDomain(data)) {
      const parsed = normalizeInputUrl(data)
      if (parsed) return parseUrlPayload(data, parsed.url)
    }

    return textResult(data)
  } catch {
    return textResult(data)
  }
}

/** True when the parsed payload is safe to open as a web link. */
export function hasOpenableUrl(result: ParsedQrPayload): boolean {
  if (!result.url) return false
  return isHttpUrl(result.url)
}

/** Convenience predicate used by the scanner to allow "Generate QR". */
export function isUrlPayload(result: ParsedQrPayload): boolean {
  return (
    result.kind === "url" ||
    result.kind === "social" ||
    result.kind === "app" ||
    result.kind === "paypal"
  )
}

/** Re-export the raw helpers that are handy for callers. */
export { digitsOnly, isEmail }
