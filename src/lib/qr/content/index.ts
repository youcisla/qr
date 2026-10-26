/**
 * Content type registry.
 *
 * The studio UI renders structured forms from this registry, the server encodes
 * the resulting payload and the scanner decodes scanned payloads back into a
 * friendly summary (see src/lib/qr/parse.ts).
 *
 * All imports here are relative on purpose: the registry is imported by Bun
 * tests and must not depend on the SvelteKit "$lib" alias.
 */

import { appContentType } from "./app"
import { cryptoContentType } from "./crypto"
import { emailContentType } from "./email"
import { epcContentType } from "./epc"
import { eventContentType } from "./event"
import { geoContentType } from "./geo"
import { mecardContentType } from "./mecard"
import { paypalContentType } from "./paypal"
import { phoneContentType } from "./phone"
import { smsContentType } from "./sms"
import { socialContentType } from "./social"
import { textContentType } from "./text"
import {
  withDefaults,
  type ContentValidationResult,
  type ContentValues,
  type QrContentCategory,
  type QrContentTypeDefinition,
} from "./types"
import { urlContentType } from "./url"
import { vcardContentType } from "./vcard"
import { whatsappContentType } from "./whatsapp"
import { wifiContentType } from "./wifi"

export * from "./types"
export { buildAppUrl, type AppStore } from "./app"
export { buildCryptoUri, CRYPTO_COINS, type CryptoCoin, type CryptoPayloadInput } from "./crypto"
export { buildEpcPayload, type EpcPayloadInput } from "./epc"
export { buildEventPayload, type EventPayloadInput } from "./event"
export {
  buildSocialUrl,
  normalizeSocialHandle,
  SOCIAL_NETWORKS,
  type SocialNetwork,
} from "./social"
export {
  buildPaypalUrl,
  formatPaypalAmount,
  normalizePaypalHandle,
  PAYPAL_CURRENCIES,
} from "./paypal"
export { buildWhatsAppUrl } from "./whatsapp"
export { buildWifiPayload, type WifiEncryption, type WifiPayload } from "./wifi"
export {
  addDaysToIsoDate,
  boolValue,
  compactLines,
  digitsOnly,
  escapeMecardValue,
  escapeVcardText,
  escapeWifiValue,
  foldVcardLine,
  foldVcardLines,
  formatBip21Amount,
  formatEpcAmount,
  formatIsoDateValue,
  formatUtcDateTime,
  isEmail,
  isHttpUrl,
  isLikelyPhoneNumber,
  isValidBic,
  isValidIban,
  localDateTime,
  normalizeHttpUrl,
  normalizeIban,
  normalizePhoneNumber,
  padNumber,
  parseClockTime,
  parseHttpUrl,
  parseIsoDate,
  splitEmailList,
  textValue,
  unescapeMecardValue,
  unescapeVcardText,
  unescapeWifiValue,
} from "./helpers"

/** Every supported content type, in picker order. */
export const contentTypes: QrContentTypeDefinition[] = [
  urlContentType,
  textContentType,
  emailContentType,
  phoneContentType,
  smsContentType,
  whatsappContentType,
  wifiContentType,
  vcardContentType,
  mecardContentType,
  geoContentType,
  eventContentType,
  cryptoContentType,
  epcContentType,
  appContentType,
  socialContentType,
  paypalContentType,
]

/** Id of the content type used when nothing else matches. */
export const defaultContentTypeId = "url"

/** Stable list of content type ids in picker order. */
export const contentTypeIds: string[] = contentTypes.map((type) => type.id)

const contentTypeMap = new Map<string, QrContentTypeDefinition>(
  contentTypes.map((type) => [type.id, type]),
)

/** Display labels for the picker's category groups. */
export const CONTENT_CATEGORY_LABELS: Record<QrContentCategory, string> = {
  link: "Links",
  text: "Text",
  contact: "Contacts",
  message: "Messages",
  wifi: "Wi-Fi",
  event: "Events",
  location: "Location",
  payment: "Payments",
  social: "Social",
  app: "Apps",
}

/** Category order used by the type picker. */
export const CONTENT_CATEGORY_ORDER: QrContentCategory[] = [
  "link",
  "text",
  "contact",
  "message",
  "wifi",
  "event",
  "location",
  "payment",
  "social",
  "app",
]

/** Look up a content type by id. */
export function getContentType(id?: string | null): QrContentTypeDefinition | undefined {
  if (!id) return undefined
  return contentTypeMap.get(id)
}

/** Look up a content type, falling back to the default URL type. */
export function getContentTypeOrDefault(id?: string | null): QrContentTypeDefinition {
  return getContentType(id) ?? contentTypeMap.get(defaultContentTypeId) ?? urlContentType
}

/** True when the id belongs to a known content type. */
export function isContentTypeId(id?: string | null): boolean {
  return !!id && contentTypeMap.has(id)
}

/** Filter the registry by category. */
export function getContentTypesByCategory(category: QrContentCategory): QrContentTypeDefinition[] {
  return contentTypes.filter((type) => type.category === category)
}

export interface ContentTypeGroup {
  category: QrContentCategory
  label: string
  types: QrContentTypeDefinition[]
}

/** Grouped registry, ready to render as the studio's type picker. */
export function contentTypeGroups(): ContentTypeGroup[] {
  return CONTENT_CATEGORY_ORDER.map((category) => ({
    category,
    label: CONTENT_CATEGORY_LABELS[category],
    types: getContentTypesByCategory(category),
  })).filter((group) => group.types.length > 0)
}

/**
 * Validate values for a content type. Unknown ids are reported as invalid so
 * callers never encode against a missing definition.
 */
export function validateContent(
  id: string | null | undefined,
  values: ContentValues,
): ContentValidationResult {
  const type = getContentType(id)
  if (!type) {
    return { valid: false, errors: { _type: "Unknown content type: " + String(id) } }
  }
  const merged = withDefaults(type, values)
  if (!type.validate) return { valid: true }
  return type.validate(merged)
}

/** Encode values with an explicit definition, throwing on invalid input. */
export function encodeWithType(type: QrContentTypeDefinition, values: ContentValues): string {
  const merged = withDefaults(type, values)
  const validation = type.validate ? type.validate(merged) : { valid: true }
  if (!validation.valid) {
    const firstError = validation.errors ? Object.values(validation.errors)[0] : undefined
    throw new Error(firstError ?? "Invalid " + type.name + " values")
  }
  return type.encode(merged)
}

/**
 * Encode values for a content type id. Throws with the first field error when
 * the values are invalid, so server actions can surface a useful message.
 */
export function encodeContent(id: string | null | undefined, values: ContentValues): string {
  return encodeWithType(getContentTypeOrDefault(id), values)
}
