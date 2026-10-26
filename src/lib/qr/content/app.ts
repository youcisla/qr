import { normalizeHttpUrl, parseHttpUrl, textValue } from "./helpers"
import type { ContentValues, QrContentTypeDefinition } from "./types"

export type AppStore = "ios" | "android" | "custom"

const IOS_APP_ID_PATTERN = /^id(\d{6,12})$/i
const ANDROID_PACKAGE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/
const IOS_STORE_URL_PATTERN = /apps\.apple\.com\/(?:[a-z]{2}\/)?app\/(?:[^/]+\/)?id(\d+)/i
const ANDROID_STORE_URL_PATTERN = /play\.google\.com\/store\/apps\/details\?id=([A-Za-z0-9._]+)/i

/** Extract a numeric App Store id from an id, "id123" or a store URL. */
function extractIosAppId(value: string): string | null {
  const trimmed = value.trim()
  const urlMatch = IOS_STORE_URL_PATTERN.exec(trimmed)
  if (urlMatch) return urlMatch[1]
  const idMatch = IOS_APP_ID_PATTERN.exec(trimmed)
  if (idMatch) return idMatch[1]
  const digits = /^\d{6,12}$/.exec(trimmed)
  return digits ? digits[0] : null
}

/** Extract an Android package name from a package name or a Play Store URL. */
function extractAndroidPackage(value: string): string | null {
  const trimmed = value.trim()
  const urlMatch = ANDROID_STORE_URL_PATTERN.exec(trimmed)
  if (urlMatch) return urlMatch[1]
  return ANDROID_PACKAGE_PATTERN.test(trimmed) ? trimmed : null
}

/** Build the canonical store link for an app id or a full URL. */
export function buildAppUrl(store: AppStore, appId: string, customUrl?: string): string {
  if (store === "ios") {
    const id = extractIosAppId(appId)
    if (!id) throw new Error("Enter a numeric App Store ID, e.g. 1234567890")
    return "https://apps.apple.com/app/id" + id
  }
  if (store === "android") {
    const packageName = extractAndroidPackage(appId)
    if (!packageName) throw new Error("Enter a package name, e.g. com.example.app")
    return "https://play.google.com/store/apps/details?id=" + packageName
  }
  const url = normalizeHttpUrl(customUrl ?? appId)
  if (!url || !parseHttpUrl(url)) throw new Error("Enter a valid app URL")
  return url
}

function readStore(values: ContentValues): AppStore {
  const value = textValue(values, "store")
  return value === "android" || value === "custom" ? value : "ios"
}

/** App store deep link: App Store, Google Play or any custom URL. */
export const appContentType: QrContentTypeDefinition = {
  id: "app",
  name: "App Store",
  description: "Send people straight to your iOS or Android app listing.",
  category: "app",
  icon: "smartphone",
  supportsDynamic: true,
  fields: [
    {
      key: "store",
      label: "Store",
      type: "select",
      required: true,
      defaultValue: "ios",
      options: [
        { label: "Apple App Store", value: "ios" },
        { label: "Google Play", value: "android" },
        { label: "Custom URL", value: "custom" },
      ],
    },
    {
      key: "appId",
      label: "App ID / package name",
      type: "text",
      placeholder: "1234567890",
      help: "iOS: numeric App Store ID. Android: package name like com.example.app.",
      showIf: { key: "store", values: ["ios", "android"] },
      maxLength: 200,
      fullWidth: true,
    },
    {
      key: "customUrl",
      label: "Custom app URL",
      type: "url",
      placeholder: "https://example.com/app",
      showIf: { key: "store", values: ["custom"] },
      maxLength: 500,
      fullWidth: true,
    },
  ],
  encode(values: ContentValues): string {
    return buildAppUrl(
      readStore(values),
      textValue(values, "appId"),
      textValue(values, "customUrl"),
    )
  },
  validate(values: ContentValues) {
    const store = readStore(values)
    const appId = textValue(values, "appId")
    const customUrl = textValue(values, "customUrl")
    try {
      buildAppUrl(store, appId, customUrl)
      return { valid: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid app link"
      const field = store === "custom" ? "customUrl" : "appId"
      const errors: Record<string, string> = {}
      errors[field] = message
      return { valid: false, errors }
    }
  },
  sample: { store: "ios", appId: "1234567890", customUrl: "" },
  summarize(values: ContentValues): string {
    const store = readStore(values)
    if (store === "custom") return textValue(values, "customUrl")
    return (store === "ios" ? "App Store: " : "Google Play: ") + textValue(values, "appId")
  },
}

export default appContentType
