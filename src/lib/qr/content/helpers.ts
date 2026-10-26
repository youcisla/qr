/**
 * Shared payload helpers for the QR content type codecs.
 *
 * Everything here is dependency-free and DOM-free so the codecs stay
 * isomorphic: they are imported by SvelteKit server actions, by the studio's
 * client-side preview and by the Bun test suite (relative imports only).
 */

import type { ContentValues } from "./types"

/* -------------------------------------------------------------------------- */
/*                                    Values                                  */
/* -------------------------------------------------------------------------- */

/**
 * Read a field as a trimmed string. Tolerates numbers because some form
 * renderers coerce number inputs before writing them into the values object.
 */
export function textValue(values: ContentValues, key: string): string {
  const value = values[key]
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

/** Read a checkbox-like field as a boolean. */
export function boolValue(values: ContentValues, key: string): boolean {
  const value = values[key]
  return value === true || value === "true"
}

/* -------------------------------------------------------------------------- */
/*                              WiFi / MeCard escapes                         */
/* -------------------------------------------------------------------------- */

const WIFI_ESCAPE = /[\\;:,"]/g

/**
 * Escape a value for the "WIFI:" payload dialect. The spec requires the
 * characters backslash, semicolon, colon, comma and double quote to be
 * backslash-escaped.
 */
export function escapeWifiValue(value: string): string {
  return value.replace(WIFI_ESCAPE, (character) => "\\" + character)
}

/** Inverse of {@link escapeWifiValue}. */
export function unescapeWifiValue(value: string): string {
  return value.replace(/\\(.)/g, "$1")
}

const MECARD_ESCAPE = /[\\;:,]/g

/** Escape a value for the "MECARD:" payload dialect. Newlines are flattened. */
export function escapeMecardValue(value: string): string {
  return value.replace(/\r\n|\r|\n/g, " ").replace(MECARD_ESCAPE, (character) => "\\" + character)
}

/** Inverse of {@link escapeMecardValue}. */
export function unescapeMecardValue(value: string): string {
  return value.replace(/\\([\\;:,])/g, "$1")
}

/* -------------------------------------------------------------------------- */
/*                                  vCard                                     */
/* -------------------------------------------------------------------------- */

/**
 * Escape a vCard 3.0 text value (RFC 2426 / RFC 6350): backslash, comma,
 * semicolon are escaped and newlines become the two character sequence "\n".
 */
export function escapeVcardText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
}

/** Inverse of {@link escapeVcardText}. */
export function unescapeVcardText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_match, character: string) => {
    if (character === "n" || character === "N") return "\n"
    return character
  })
}

/** UTF-8 octet length of a single code point. */
function utf8Length(character: string): number {
  const codePoint = character.codePointAt(0) ?? 0
  if (codePoint <= 0x7f) return 1
  if (codePoint <= 0x7ff) return 2
  if (codePoint <= 0xffff) return 3
  return 4
}

/**
 * Fold a single vCard / iCalendar content line at 75 octets, using CRLF plus a
 * single space as the continuation marker (RFC 2426 section 2.6, RFC 5545
 * section 3.1). Folding never splits a multi-byte UTF-8 code point.
 */
export function foldVcardLine(line: string, maxOctets = 75): string {
  const segments: string[] = []
  let segment = ""
  let octets = 0
  let limit = maxOctets

  for (const character of Array.from(line)) {
    const size = utf8Length(character)
    if (octets + size > limit) {
      segments.push(segment)
      segment = ""
      octets = 0
      // Continuation lines carry a leading space that counts towards the limit.
      limit = maxOctets - 1
    }
    segment += character
    octets += size
  }

  segments.push(segment)
  return segments.join("\r\n ")
}

/** Fold and join content lines with CRLF line endings. */
export function foldVcardLines(lines: string[], maxOctets = 75): string {
  return lines.map((line) => foldVcardLine(line, maxOctets)).join("\r\n")
}

/* -------------------------------------------------------------------------- */
/*                              Phone and e-mail                              */
/* -------------------------------------------------------------------------- */

/** Keep only the decimal digits of a phone number. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "")
}

/** Normalise a phone number to an optional leading plus sign plus digits. */
export function normalizePhoneNumber(value: string): string {
  const trimmed = value.trim()
  const digits = digitsOnly(trimmed)
  return (trimmed.startsWith("+") ? "+" : "") + digits
}

/** Loose but useful phone number validation (E.164 caps the digits at 15). */
export function isLikelyPhoneNumber(value: string, minDigits = 5, maxDigits = 15): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return false
  const digits = digitsOnly(trimmed)
  return digits.length >= minDigits && digits.length <= maxDigits
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Basic e-mail validation: one @, a dot in the domain, no whitespace. */
export function isEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

/** Split a comma separated e-mail list into trimmed, non-empty entries. */
export function splitEmailList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

/* -------------------------------------------------------------------------- */
/*                                     URLs                                   */
/* -------------------------------------------------------------------------- */

/** Add an explicit https:// scheme when the input has none. */
export function normalizeHttpUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
  return "https://" + trimmed
}

/** Parse an http(s) URL, returning null for invalid or non-web values. */
export function parseHttpUrl(value: string): URL | null {
  const normalized = normalizeHttpUrl(value)
  if (!normalized) return null
  try {
    const url = new URL(normalized)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    if (!url.hostname) return null
    if (url.hostname !== "localhost" && !url.hostname.includes(".")) return null
    if (/\s/.test(url.hostname)) return null
    return url
  } catch {
    return null
  }
}

/** True when the value is a well formed absolute http(s) URL. */
export function isHttpUrl(value: string): boolean {
  return parseHttpUrl(value) !== null
}

/* -------------------------------------------------------------------------- */
/*                              Dates and times                               */
/* -------------------------------------------------------------------------- */

interface DateParts {
  year: number
  month: number
  day: number
}

interface ClockParts {
  hours: number
  minutes: number
}

/** Zero pad a positive integer. */
export function padNumber(value: number, length = 2): string {
  return String(value).padStart(length, "0")
}

/** True when the Y/M/D triple is a real Gregorian calendar date. */
export function isValidDateParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

/** Parse a YYYY-MM-DD string into calendar parts. */
export function parseIsoDate(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!isValidDateParts(year, month, day)) return null
  return { year, month, day }
}

/** Parse an HH:MM (24h) string into clock parts. */
export function parseClockTime(value: string): ClockParts | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return { hours, minutes }
}

/**
 * Combine a local date and time into a Date in the runtime's time zone. This is
 * the interpretation users expect: they type the wall clock time of the event.
 */
export function localDateTime(date: string, time: string): Date | null {
  const dateParts = parseIsoDate(date)
  const clockParts = parseClockTime(time)
  if (!dateParts || !clockParts) return null
  return new Date(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    clockParts.hours,
    clockParts.minutes,
    0,
    0,
  )
}

/** Format a Date as an iCalendar UTC timestamp: YYYYMMDDTHHMMSSZ. */
export function formatUtcDateTime(date: Date): string {
  return (
    String(date.getUTCFullYear()) +
    padNumber(date.getUTCMonth() + 1) +
    padNumber(date.getUTCDate()) +
    "T" +
    padNumber(date.getUTCHours()) +
    padNumber(date.getUTCMinutes()) +
    padNumber(date.getUTCSeconds()) +
    "Z"
  )
}

/** Format a YYYY-MM-DD string as an iCalendar DATE value: YYYYMMDD. */
export function formatIsoDateValue(value: string): string | null {
  const parts = parseIsoDate(value)
  if (!parts) return null
  return String(parts.year) + padNumber(parts.month) + padNumber(parts.day)
}

/** Add days to a YYYY-MM-DD date, returning a YYYY-MM-DD string. */
export function addDaysToIsoDate(value: string, days: number): string | null {
  const parts = parseIsoDate(value)
  if (!parts) return null
  const date = new Date(parts.year, parts.month - 1, parts.day)
  date.setDate(date.getDate() + days)
  return (
    String(date.getFullYear()) +
    "-" +
    padNumber(date.getMonth() + 1) +
    "-" +
    padNumber(date.getDate())
  )
}

/* -------------------------------------------------------------------------- */
/*                                 SEPA / EPC                                 */
/* -------------------------------------------------------------------------- */

/** Official IBAN lengths for the countries most likely to use SEPA QRs. */
const IBAN_COUNTRY_LENGTHS: Record<string, number> = {
  AD: 24,
  AL: 28,
  AT: 20,
  AZ: 28,
  BA: 20,
  BE: 16,
  BG: 22,
  BH: 22,
  BR: 29,
  BY: 28,
  CH: 21,
  CR: 22,
  CY: 28,
  CZ: 24,
  DE: 22,
  DK: 18,
  DO: 28,
  DZ: 26,
  EE: 20,
  EG: 29,
  ES: 24,
  FI: 18,
  FO: 18,
  FR: 27,
  GB: 22,
  GE: 22,
  GI: 23,
  GL: 18,
  GR: 27,
  GT: 28,
  HR: 21,
  HU: 28,
  IE: 22,
  IL: 23,
  IQ: 23,
  IS: 26,
  IT: 27,
  JO: 30,
  KW: 30,
  KZ: 20,
  LB: 28,
  LC: 32,
  LI: 21,
  LT: 20,
  LU: 20,
  LV: 21,
  MA: 28,
  MC: 27,
  MD: 24,
  ME: 22,
  MK: 19,
  MR: 27,
  MT: 31,
  MU: 30,
  NL: 18,
  NO: 15,
  PK: 24,
  PL: 28,
  PS: 29,
  PT: 25,
  QA: 29,
  RO: 24,
  RS: 22,
  SA: 24,
  SC: 31,
  SE: 24,
  SI: 19,
  SK: 24,
  SM: 27,
  ST: 25,
  SV: 28,
  TL: 23,
  TN: 24,
  TR: 26,
  UA: 29,
  VA: 22,
  VG: 24,
  XK: 20,
}

/** Strip spaces and hyphens and upper-case an IBAN. */
export function normalizeIban(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase()
}

/**
 * Validate an IBAN: structure, country-specific length and the ISO 7064
 * MOD 97-10 checksum (the rearranged IBAN must leave a remainder of 1).
 */
export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  const expectedLength = IBAN_COUNTRY_LENGTHS[iban.slice(0, 2)]
  if (expectedLength !== undefined && iban.length !== expectedLength) return false

  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const character of rearranged) {
    const code = character.charCodeAt(0)
    if (code >= 48 && code <= 57) {
      remainder = (remainder * 10 + (code - 48)) % 97
    } else {
      if (code < 65 || code > 90) return false
      remainder = (remainder * 100 + (code - 55)) % 97
    }
  }
  return remainder === 1
}

/** Validate a business identifier code (BIC / SWIFT): 8 or 11 characters. */
export function isValidBic(value: string): boolean {
  return /^[A-Z]{6}[A-Z2-9][A-Z2-9]([A-Z0-9]{3})?$/.test(value.trim().toUpperCase())
}

/** Normalise an amount input: strip currency symbols and spaces, comma to dot. */
function cleanAmount(value: string): string {
  return value
    .trim()
    .replace(/[\s\u00a0]/g, "")
    .replace(/[€$£]/g, "")
    .replace(",", ".")
}

/**
 * Format an amount for EPC069-12: EUR prefix plus exactly two decimals, e.g.
 * "12,5" becomes "EUR12.50". Returns null for invalid or out-of-range values.
 */
export function formatEpcAmount(value: string): string | null {
  const cleaned = cleanAmount(value)
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!match) return null
  const whole = match[1].replace(/^0+(?=\d)/, "")
  const decimals = (match[2] ?? "").padEnd(2, "0")
  const amount = Number(whole + "." + decimals)
  if (!(amount > 0) || amount > 999999999.99) return null
  return "EUR" + whole + "." + decimals
}

/** Format an amount for a BIP21 payment URI (up to 8 decimals, no trailing zeros). */
export function formatBip21Amount(value: string): string | null {
  const cleaned = cleanAmount(value)
  const match = /^(\d{1,12})(?:\.(\d{1,8}))?$/.exec(cleaned)
  if (!match) return null
  const whole = match[1].replace(/^0+(?=\d)/, "")
  const decimals = (match[2] ?? "").replace(/0+$/, "")
  const amount = Number(whole + (decimals ? "." + decimals : ""))
  if (!(amount > 0)) return null
  return decimals ? whole + "." + decimals : whole
}

/* -------------------------------------------------------------------------- */
/*                                 Collections                                */
/* -------------------------------------------------------------------------- */

/** Drop empty strings so optional payload lines can be skipped. */
export function compactLines(lines: Array<string | null | undefined>): string[] {
  return lines.filter((line): line is string => typeof line === "string" && line.length > 0)
}
