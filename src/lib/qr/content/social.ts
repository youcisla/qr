import { normalizeHttpUrl, parseHttpUrl, textValue } from "./helpers"
import type { ContentValues, QrContentTypeDefinition } from "./types"

export type SocialNetwork =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "x"
  | "linkedin"
  | "youtube"
  | "snapchat"
  | "pinterest"
  | "telegram"
  | "github"
  | "custom"

interface SocialNetworkDefinition {
  label: string
  placeholder: string
  /** Build the canonical profile URL from a bare handle. */
  build: (handle: string) => string
}

export const SOCIAL_NETWORKS: Record<Exclude<SocialNetwork, "custom">, SocialNetworkDefinition> = {
  instagram: {
    label: "Instagram",
    placeholder: "@yopem",
    build: (handle) => "https://instagram.com/" + handle,
  },
  facebook: {
    label: "Facebook",
    placeholder: "@yopem",
    build: (handle) => "https://facebook.com/" + handle,
  },
  tiktok: {
    label: "TikTok",
    placeholder: "@yopem",
    build: (handle) => "https://www.tiktok.com/@" + handle,
  },
  x: {
    label: "X (Twitter)",
    placeholder: "@yopem",
    build: (handle) => "https://x.com/" + handle,
  },
  linkedin: {
    label: "LinkedIn",
    placeholder: "yopem",
    build: (handle) => "https://www.linkedin.com/in/" + handle,
  },
  youtube: {
    label: "YouTube",
    placeholder: "@yopem",
    build: (handle) => "https://www.youtube.com/@" + handle,
  },
  snapchat: {
    label: "Snapchat",
    placeholder: "yopem",
    build: (handle) => "https://www.snapchat.com/add/" + handle,
  },
  pinterest: {
    label: "Pinterest",
    placeholder: "yopem",
    build: (handle) => "https://www.pinterest.com/" + handle,
  },
  telegram: {
    label: "Telegram",
    placeholder: "yopem",
    build: (handle) => "https://t.me/" + handle,
  },
  github: {
    label: "GitHub",
    placeholder: "yopem",
    build: (handle) => "https://github.com/" + handle,
  },
}

const HANDLE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/

/**
 * Normalise a social handle. Accepts "@yopem", "yopem", a full profile URL or
 * even a pasted URL with a trailing slash - all become the bare handle.
 */
export function normalizeSocialHandle(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(normalizeHttpUrl(trimmed))) {
    const url = parseHttpUrl(trimmed)
    if (url) {
      const segments = url.pathname.split("/").filter((segment) => segment.length > 0)
      const last = segments.length > 0 ? segments[segments.length - 1] : ""
      return last.replace(/^@/, "")
    }
  }
  return trimmed.replace(/^@+/, "").replace(/\/+$/, "")
}

/** Build a profile URL from a network and a handle or full URL. */
export function buildSocialUrl(network: SocialNetwork, handle: string): string {
  if (network === "custom") {
    const url = normalizeHttpUrl(handle)
    if (!url || !parseHttpUrl(url)) throw new Error("Enter a valid social profile URL")
    return url
  }
  const definition = SOCIAL_NETWORKS[network]
  const normalized = normalizeSocialHandle(handle)
  if (!normalized) throw new Error("A username or profile URL is required")
  if (!HANDLE_PATTERN.test(normalized)) {
    throw new Error("Usernames can only contain letters, numbers, dots, dashes and underscores")
  }
  return definition.build(normalized)
}

function readNetwork(values: ContentValues): SocialNetwork {
  const value = textValue(values, "network")
  if (value === "custom") return "custom"
  if (value && value in SOCIAL_NETWORKS) return value as SocialNetwork
  return "instagram"
}

/** Social profile payload with smart URL builders for ten networks. */
export const socialContentType: QrContentTypeDefinition = {
  id: "social",
  name: "Social Profile",
  description: "Grow your audience with a link to any social profile.",
  category: "social",
  icon: "share-2",
  supportsDynamic: true,
  fields: [
    {
      key: "network",
      label: "Network",
      type: "select",
      required: true,
      defaultValue: "instagram",
      options: [
        { label: "Instagram", value: "instagram" },
        { label: "Facebook", value: "facebook" },
        { label: "TikTok", value: "tiktok" },
        { label: "X (Twitter)", value: "x" },
        { label: "LinkedIn", value: "linkedin" },
        { label: "YouTube", value: "youtube" },
        { label: "Snapchat", value: "snapchat" },
        { label: "Pinterest", value: "pinterest" },
        { label: "Telegram", value: "telegram" },
        { label: "GitHub", value: "github" },
        { label: "Custom URL", value: "custom" },
      ],
    },
    {
      key: "handle",
      label: "Username",
      type: "text",
      placeholder: "@yopem",
      help: "Just the username, or paste the full profile URL.",
      showIf: {
        key: "network",
        values: [
          "instagram",
          "facebook",
          "tiktok",
          "x",
          "linkedin",
          "youtube",
          "snapchat",
          "pinterest",
          "telegram",
          "github",
        ],
      },
      maxLength: 200,
      fullWidth: true,
    },
    {
      key: "customUrl",
      label: "Profile URL",
      type: "url",
      placeholder: "https://example.com/profile",
      showIf: { key: "network", values: ["custom"] },
      maxLength: 500,
      fullWidth: true,
    },
  ],
  encode(values: ContentValues): string {
    const network = readNetwork(values)
    const input =
      network === "custom" ? textValue(values, "customUrl") : textValue(values, "handle")
    return buildSocialUrl(network, input)
  },
  validate(values: ContentValues) {
    const network = readNetwork(values)
    const input =
      network === "custom" ? textValue(values, "customUrl") : textValue(values, "handle")
    const field = network === "custom" ? "customUrl" : "handle"
    if (!input) {
      const errors: Record<string, string> = {}
      errors[field] = network === "custom" ? "A profile URL is required" : "A username is required"
      return { valid: false, errors }
    }
    try {
      buildSocialUrl(network, input)
      return { valid: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid profile"
      const errors: Record<string, string> = {}
      errors[field] = message
      return { valid: false, errors }
    }
  },
  sample: { network: "instagram", handle: "@yopem", customUrl: "" },
  summarize(values: ContentValues): string {
    const network = readNetwork(values)
    if (network === "custom") return textValue(values, "customUrl")
    const definition = SOCIAL_NETWORKS[network]
    return definition.label + ": " + normalizeSocialHandle(textValue(values, "handle"))
  },
}

export default socialContentType
