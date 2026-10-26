import {
  compactLines,
  formatEpcAmount,
  isValidBic,
  isValidIban,
  normalizeIban,
  textValue,
} from "./helpers"
import type { ContentValues, QrContentTypeDefinition } from "./types"

export interface EpcPayloadInput {
  beneficiaryName: string
  iban: string
  bic: string
  amount: string
  remittance?: string
}

/**
 * EPC069-12 (SEPA Credit Transfer QR) payload. Each field is a line separated
 * by LF: service tag, version, character set, identification, BIC, beneficiary
 * name, IBAN, amount and the optional remittance information.
 */
export function buildEpcPayload(input: EpcPayloadInput): string {
  const name = input.beneficiaryName.trim()
  if (!name) throw new Error("A beneficiary name is required")
  if (name.length > 70) throw new Error("The beneficiary name is limited to 70 characters")
  const iban = normalizeIban(input.iban)
  if (!isValidIban(iban)) throw new Error("Enter a valid IBAN")
  const bic = input.bic.trim().toUpperCase()
  if (!isValidBic(bic)) throw new Error("Enter a valid BIC (8 or 11 characters)")
  const amount = formatEpcAmount(input.amount)
  if (!amount) throw new Error("Enter a valid amount, e.g. 49.99")
  const remittance = (input.remittance ?? "").trim()
  if (remittance.length > 140) {
    throw new Error("The remittance information is limited to 140 characters")
  }

  const lines = compactLines(["BCD", "002", "1", "SCT", bic, name, iban, amount, remittance])
  return lines.join("\n")
}

/** SEPA credit transfer payload used by European banking apps. */
export const epcContentType: QrContentTypeDefinition = {
  id: "epc",
  name: "SEPA Bank Transfer",
  description: "Pre-fill a SEPA credit transfer with IBAN, BIC and amount.",
  category: "payment",
  icon: "landmark",
  supportsDynamic: false,
  fields: [
    {
      key: "beneficiaryName",
      label: "Beneficiary name",
      type: "text",
      placeholder: "Yopem SARL",
      required: true,
      maxLength: 70,
      fullWidth: true,
    },
    {
      key: "iban",
      label: "IBAN",
      type: "text",
      placeholder: "DE89 3704 0044 0532 0130 00",
      help: "Spaces are ignored. The checksum is validated.",
      required: true,
      maxLength: 34,
      fullWidth: true,
    },
    {
      key: "bic",
      label: "BIC / SWIFT",
      type: "text",
      placeholder: "COBADEFFXXX",
      help: "8 or 11 characters.",
      required: true,
      maxLength: 11,
    },
    {
      key: "amount",
      label: "Amount (EUR)",
      type: "number",
      placeholder: "49.99",
      help: "Leave empty to let the payer choose the amount.",
      required: true,
      maxLength: 12,
    },
    {
      key: "remittance",
      label: "Payment reference / note",
      type: "textarea",
      placeholder: "Invoice 2026-0042",
      help: "Shown to the payer. Max 140 characters.",
      rows: 2,
      maxLength: 140,
      fullWidth: true,
    },
  ],
  encode(values: ContentValues): string {
    return buildEpcPayload({
      beneficiaryName: textValue(values, "beneficiaryName"),
      iban: textValue(values, "iban"),
      bic: textValue(values, "bic"),
      amount: textValue(values, "amount"),
      remittance: textValue(values, "remittance"),
    })
  },
  validate(values: ContentValues) {
    const errors: Record<string, string> = {}
    const name = textValue(values, "beneficiaryName")
    if (!name) errors.beneficiaryName = "A beneficiary name is required"
    else if (name.length > 70) errors.beneficiaryName = "Limited to 70 characters"
    const iban = textValue(values, "iban")
    if (!iban) errors.iban = "An IBAN is required"
    else if (!isValidIban(iban)) errors.iban = "Enter a valid IBAN (checksum failed)"
    const bic = textValue(values, "bic")
    if (!bic) errors.bic = "A BIC is required"
    else if (!isValidBic(bic)) errors.bic = "Enter a valid BIC (8 or 11 characters)"
    const amount = textValue(values, "amount")
    if (!amount) errors.amount = "An amount is required"
    else if (!formatEpcAmount(amount)) errors.amount = "Enter a valid amount, e.g. 49.99"
    const remittance = textValue(values, "remittance")
    if (remittance.length > 140) errors.remittance = "Limited to 140 characters"
    return Object.keys(errors).length > 0 ? { valid: false, errors } : { valid: true }
  },
  sample: {
    beneficiaryName: "Yopem SARL",
    iban: "DE89370400440532013000",
    bic: "COBADEFFXXX",
    amount: "49.99",
    remittance: "Invoice 2026-0042",
  },
  summarize(values: ContentValues): string {
    const name = textValue(values, "beneficiaryName")
    const amount = textValue(values, "amount")
    return name + (amount ? " - EUR " + amount : "")
  },
}

export default epcContentType
