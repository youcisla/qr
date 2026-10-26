import { boolValue, escapeWifiValue, textValue } from "./helpers"
import type { ContentValidationResult, ContentValues, QrContentTypeDefinition } from "./types"

export type WifiEncryption = "WPA" | "WEP" | "nopass"

export interface WifiPayload {
  ssid: string
  password: string
  encryption: WifiEncryption
  hidden: boolean
}

/** Build a WIFI: payload, escaping the characters that break the grammar. */
export function buildWifiPayload(payload: WifiPayload): string {
  const ssid = payload.ssid.trim()
  const password = payload.password
  const encryption: WifiEncryption =
    payload.encryption === "WEP" || payload.encryption === "nopass" ? payload.encryption : "WPA"

  let result = "WIFI:"
  result += "T:" + encryption + ";"
  result += "S:" + escapeWifiValue(ssid) + ";"
  if (encryption !== "nopass") result += "P:" + escapeWifiValue(password) + ";"
  if (payload.hidden) result += "H:true;"
  result += ";"
  return result
}

function readEncryption(values: ContentValues): WifiEncryption {
  const value = textValue(values, "encryption")
  return value === "WEP" || value === "nopass" ? value : "WPA"
}

export const wifiContentType: QrContentTypeDefinition = {
  id: "wifi",
  name: "Wi-Fi",
  description: "Let guests join your network without typing the password.",
  category: "wifi",
  icon: "wifi",
  supportsDynamic: false,
  fields: [
    {
      key: "ssid",
      label: "Network name (SSID)",
      type: "text",
      placeholder: "Yopem Guest",
      help: "The exact name shown in the Wi-Fi list.",
      required: true,
      maxLength: 64,
      fullWidth: true,
    },
    {
      key: "encryption",
      label: "Security",
      type: "select",
      required: true,
      defaultValue: "WPA",
      options: [
        { label: "WPA / WPA2", value: "WPA" },
        { label: "WEP", value: "WEP" },
        { label: "Open (no password)", value: "nopass" },
      ],
    },
    {
      key: "password",
      label: "Password",
      type: "text",
      placeholder: "Network password",
      help: "Not needed for open networks.",
      showIf: { key: "encryption", values: ["WPA", "WEP"] },
    },
    {
      key: "hidden",
      label: "Hidden network",
      type: "checkbox",
      defaultValue: false,
      help: "Enable when the SSID is not broadcast.",
    },
  ],
  encode(values: ContentValues): string {
    const ssid = textValue(values, "ssid")
    if (!ssid) throw new Error("A network name (SSID) is required")
    const encryption = readEncryption(values)
    const password = textValue(values, "password")
    if (encryption !== "nopass" && !password) {
      throw new Error("A password is required for secured networks")
    }
    return buildWifiPayload({ ssid, password, encryption, hidden: boolValue(values, "hidden") })
  },
  validate(values: ContentValues): ContentValidationResult {
    const ssid = textValue(values, "ssid")
    if (!ssid) return { valid: false, errors: { ssid: "A network name (SSID) is required" } }
    if (ssid.length > 64) {
      return { valid: false, errors: { ssid: "SSIDs cannot be longer than 64 characters" } }
    }
    const encryption = readEncryption(values)
    const password = textValue(values, "password")
    if (
      encryption === "WPA" &&
      password.length > 0 &&
      (password.length < 8 || password.length > 64)
    ) {
      return {
        valid: false,
        errors: { password: "WPA passwords are usually 8 to 63 characters (64 for hex keys)" },
      }
    }
    if (encryption !== "nopass" && !password) {
      return { valid: false, errors: { password: "A password is required for secured networks" } }
    }
    return { valid: true }
  },
  sample: { ssid: "Yopem Guest", encryption: "WPA", password: "welcome2024", hidden: false },
  summarize(values: ContentValues): string {
    const ssid = textValue(values, "ssid")
    return ssid ? "Wi-Fi: " + ssid : "Wi-Fi"
  },
}

export default wifiContentType
