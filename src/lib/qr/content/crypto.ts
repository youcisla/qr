import { formatBip21Amount, textValue } from "./helpers"
import type { ContentValues, QrContentTypeDefinition } from "./types"

export type CryptoCoin = "bitcoin" | "litecoin" | "dogecoin"

interface CoinDefinition {
  label: string
  scheme: string
  placeholder: string
  validateAddress: (address: string) => boolean
}

/** Bech32 style addresses: all lower-case or all upper-case, never mixed. */
function isBech32Address(address: string, humanReadablePart: string): boolean {
  const isAllLower = address === address.toLowerCase()
  const isAllUpper = address === address.toUpperCase()
  if (!isAllLower && !isAllUpper) return false
  const value = address.toLowerCase()
  if (!value.startsWith(humanReadablePart + "1")) return false
  const data = value.slice(humanReadablePart.length + 1)
  return /^[ac-hj-np-z02-9]{11,71}$/.test(data)
}

export const CRYPTO_COINS: Record<CryptoCoin, CoinDefinition> = {
  bitcoin: {
    label: "Bitcoin (BTC)",
    scheme: "bitcoin",
    placeholder: "bc1q... or 1... / 3...",
    validateAddress(address: string): boolean {
      if (isBech32Address(address, "bc")) return true
      return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)
    },
  },
  litecoin: {
    label: "Litecoin (LTC)",
    scheme: "litecoin",
    placeholder: "ltc1q... or L... / M... / 3...",
    validateAddress(address: string): boolean {
      if (isBech32Address(address, "ltc")) return true
      return /^[LM3][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)
    },
  },
  dogecoin: {
    label: "Dogecoin (DOGE)",
    scheme: "dogecoin",
    placeholder: "D...",
    validateAddress(address: string): boolean {
      return /^[DA9][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)
    },
  },
}

export interface CryptoPayloadInput {
  coin: CryptoCoin
  address: string
  amount?: string
  label?: string
  message?: string
}

/**
 * Build a BIP21 style payment URI: bitcoin:<address>?amount=...&label=...&message=...
 * Amounts use up to eight decimals, trailing zeros trimmed. Label and message
 * are percent encoded.
 */
export function buildCryptoUri(input: CryptoPayloadInput): string {
  const coin = CRYPTO_COINS[input.coin] ? input.coin : "bitcoin"
  const definition = CRYPTO_COINS[coin]
  const address = input.address.trim()
  if (!address) throw new Error("A wallet address is required")
  if (!definition.validateAddress(address)) {
    throw new Error("Enter a valid " + definition.label + " address")
  }

  const params: string[] = []
  const rawAmount = (input.amount ?? "").trim()
  if (rawAmount) {
    const amount = formatBip21Amount(rawAmount)
    if (!amount) throw new Error("Enter a valid amount, e.g. 0.001")
    params.push("amount=" + amount)
  }
  const label = (input.label ?? "").trim()
  if (label) params.push("label=" + encodeURIComponent(label))
  const message = (input.message ?? "").trim()
  if (message) params.push("message=" + encodeURIComponent(message))

  const uri = definition.scheme + ":" + address
  return params.length > 0 ? uri + "?" + params.join("&") : uri
}

function readCoin(values: ContentValues): CryptoCoin {
  const value = textValue(values, "coin")
  return value === "litecoin" || value === "dogecoin" ? value : "bitcoin"
}

/** Crypto payment payload: BIP21 for Bitcoin, Litecoin and Dogecoin. */
export const cryptoContentType: QrContentTypeDefinition = {
  id: "crypto",
  name: "Crypto Payment",
  description: "Accept Bitcoin, Litecoin or Dogecoin at a wallet address.",
  category: "payment",
  icon: "bitcoin",
  supportsDynamic: false,
  fields: [
    {
      key: "coin",
      label: "Coin",
      type: "select",
      required: true,
      defaultValue: "bitcoin",
      options: [
        { label: "Bitcoin (BTC)", value: "bitcoin" },
        { label: "Litecoin (LTC)", value: "litecoin" },
        { label: "Dogecoin (DOGE)", value: "dogecoin" },
      ],
    },
    {
      key: "address",
      label: "Wallet address",
      type: "text",
      placeholder: "bc1q...",
      help: "Double check the address: crypto payments cannot be reversed.",
      required: true,
      maxLength: 120,
      fullWidth: true,
    },
    {
      key: "amount",
      label: "Amount (optional)",
      type: "number",
      placeholder: "0.001",
      help: "Leave empty to let the payer choose.",
      maxLength: 24,
    },
    {
      key: "label",
      label: "Label (optional)",
      type: "text",
      placeholder: "Yopem",
      maxLength: 100,
    },
    {
      key: "message",
      label: "Message (optional)",
      type: "text",
      placeholder: "Thanks for the coffee!",
      maxLength: 200,
      fullWidth: true,
    },
  ],
  encode(values: ContentValues): string {
    return buildCryptoUri({
      coin: readCoin(values),
      address: textValue(values, "address"),
      amount: textValue(values, "amount"),
      label: textValue(values, "label"),
      message: textValue(values, "message"),
    })
  },
  validate(values: ContentValues) {
    const errors: Record<string, string> = {}
    const coin = readCoin(values)
    const address = textValue(values, "address")
    if (!address) {
      errors.address = "A wallet address is required"
    } else if (!CRYPTO_COINS[coin].validateAddress(address)) {
      errors.address = "Enter a valid " + CRYPTO_COINS[coin].label + " address"
    }
    const amount = textValue(values, "amount")
    if (amount && !formatBip21Amount(amount)) {
      errors.amount = "Enter a valid amount, e.g. 0.001"
    }
    return Object.keys(errors).length > 0 ? { valid: false, errors } : { valid: true }
  },
  sample: {
    coin: "bitcoin",
    address: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
    amount: "0.001",
    label: "Yopem",
    message: "Thanks for the coffee!",
  },
  summarize(values: ContentValues): string {
    const coin = readCoin(values)
    const amount = textValue(values, "amount")
    return CRYPTO_COINS[coin].label + (amount ? " " + amount : "")
  },
}

export default cryptoContentType
