import { textValue } from "./helpers"
import type { ContentValues, QrContentTypeDefinition } from "./types"

const PAYPAL_HANDLE_PATTERN = /^[A-Za-z0-9._-]{2,30}$/
const PAYPAL_URL_PATTERN = /(?:paypal\.me\/|paypal\.com\/paypalme\/)([A-Za-z0-9._-]+)/i

export const PAYPAL_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "CHF",
  "MXN",
  "BRL",
  "SGD",
  "HKD",
  "NZD",
  "PLN",
  "SEK",
  "NOK",
  "DKK",
] as const

/** Accept a plain PayPal.Me username or a pasted profile URL. */
export function normalizePaypalHandle(input: string): string {
  const trimmed = input.trim()
  const urlMatch = PAYPAL_URL_PATTERN.exec(trimmed)
  if (urlMatch) return urlMatch[1]
  return trimmed.replace(/^@+/, "")
}

/** Format a PayPal amount: positive, at most two decimals, no currency symbol. */
export function formatPaypalAmount(value: string): string | null {
  const cleaned = value
    .trim()
    .replace(/[\s\u00a0]/g, "")
    .replace(/[€$£]/g, "")
    .replace(",", ".")
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!match) return null
  const whole = match[1].replace(/^0+(?=\d)/, "")
  const decimals = match[2] ?? ""
  if (Number(whole + (decimals ? "." + decimals : "")) <= 0) return null
  return decimals ? whole + "." + decimals : whole
}

/**
 * PayPal.Me payment link: https://paypal.me/<handle>[/<amount>[/<CURRENCY>]].
 * The currency is only appended when one is explicitly selected, otherwise the
 * currency of the receiving PayPal account applies.
 */
export function buildPaypalUrl(handle: string, amount?: string, currency?: string): string {
  const username = normalizePaypalHandle(handle)
  if (!username) throw new Error("A PayPal.Me username is required")
  if (!PAYPAL_HANDLE_PATTERN.test(username)) {
    throw new Error("Enter a valid PayPal.Me username")
  }
  const url = "https://paypal.me/" + username
  const rawAmount = (amount ?? "").trim()
  if (!rawAmount) return url
  const formatted = formatPaypalAmount(rawAmount)
  if (!formatted) throw new Error("Enter a valid amount, e.g. 25.00")
  const code = (currency ?? "").trim().toUpperCase()
  if (code && !/^[A-Z]{3}$/.test(code)) throw new Error("Enter a valid currency code")
  return url + "/" + formatted + code
}

/** PayPal.Me payment request. */
export const paypalContentType: QrContentTypeDefinition = {
  id: "paypal",
  name: "PayPal",
  description: "Get paid fast with a PayPal.Me link and optional fixed amount.",
  category: "payment",
  icon: "wallet",
  supportsDynamic: true,
  fields: [
    {
      key: "handle",
      label: "PayPal.Me username",
      type: "text",
      placeholder: "yopem",
      help: "The username from your paypal.me link (without paypal.me/).",
      required: true,
      maxLength: 100,
      fullWidth: true,
    },
    {
      key: "amount",
      label: "Amount (optional)",
      type: "number",
      placeholder: "25.00",
      help: "Leave empty to let the payer choose.",
      maxLength: 16,
    },
    {
      key: "currency",
      label: "Currency",
      type: "select",
      defaultValue: "",
      options: [
        { label: "Receiver's account currency", value: "" },
        { label: "USD - US Dollar", value: "USD" },
        { label: "EUR - Euro", value: "EUR" },
        { label: "GBP - British Pound", value: "GBP" },
        { label: "CAD - Canadian Dollar", value: "CAD" },
        { label: "AUD - Australian Dollar", value: "AUD" },
        { label: "CHF - Swiss Franc", value: "CHF" },
        { label: "MXN - Mexican Peso", value: "MXN" },
        { label: "BRL - Brazilian Real", value: "BRL" },
        { label: "SGD - Singapore Dollar", value: "SGD" },
        { label: "HKD - Hong Kong Dollar", value: "HKD" },
        { label: "PLN - Polish Zloty", value: "PLN" },
        { label: "SEK - Swedish Krona", value: "SEK" },
        { label: "NOK - Norwegian Krone", value: "NOK" },
        { label: "DKK - Danish Krone", value: "DKK" },
      ],
    },
  ],
  encode(values: ContentValues): string {
    return buildPaypalUrl(
      textValue(values, "handle"),
      textValue(values, "amount"),
      textValue(values, "currency"),
    )
  },
  validate(values: ContentValues) {
    const errors: Record<string, string> = {}
    const handle = normalizePaypalHandle(textValue(values, "handle"))
    if (!handle) errors.handle = "A PayPal.Me username is required"
    else if (!PAYPAL_HANDLE_PATTERN.test(handle)) errors.handle = "Enter a valid PayPal.Me username"
    const amount = textValue(values, "amount")
    if (amount && !formatPaypalAmount(amount)) errors.amount = "Enter a valid amount, e.g. 25.00"
    const currency = textValue(values, "currency")
    if (currency && !/^[A-Z]{3}$/.test(currency.toUpperCase())) {
      errors.currency = "Enter a valid currency code"
    }
    return Object.keys(errors).length > 0 ? { valid: false, errors } : { valid: true }
  },
  sample: { handle: "yopem", amount: "25.00", currency: "USD" },
  summarize(values: ContentValues): string {
    const handle = normalizePaypalHandle(textValue(values, "handle"))
    const amount = textValue(values, "amount")
    return "paypal.me/" + handle + (amount ? " - " + amount : "")
  },
}

export default paypalContentType
