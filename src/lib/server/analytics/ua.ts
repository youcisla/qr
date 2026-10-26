/**
 * Dependency-free user-agent parsing used by scan tracking.
 *
 * Values are intentionally coarse: analytics only needs stable, low-cardinality
 * buckets, not exact browser versions.
 */

export type DeviceType = "desktop" | "mobile" | "tablet" | "bot" | "other"

export interface ParsedUserAgent {
  deviceType: DeviceType
  os: string
  browser: string
  isBot: boolean
}

const BOT_PATTERN =
  /bot|crawler|spider|crawling|preview|facebookexternalhit|slackbot|telegrambot|discordbot|twitterbot|linkedinbot|embedly|pinterest|vkshare|w3c_validator|google-inspectiontool|headlesschrome|phantomjs|curl\/|wget\/|python-requests|python-urllib|go-http-client|okhttp|axios\/|node-fetch|libwww-perl|httpclient/i

const IPAD_PATTERN = /ipad|tablet|playbook|silk|kindle/i
const MOBILE_PATTERN =
  /mobile|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|iemobile/i
const TV_PATTERN = /smart-tv|smarttv|googletv|appletv|hbbtv|netcast|viera|bravia/i

function detectOs(ua: string): string {
  if (/windows nt|windows phone|win64|win32/i.test(ua)) return "Windows"
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS"
  if (/android/i.test(ua)) return "Android"
  if (/cros/i.test(ua)) return "ChromeOS"
  if (/macintosh|mac os x|macos/i.test(ua)) return "macOS"
  if (/linux/i.test(ua)) return "Linux"
  if (/freebsd|openbsd|netbsd/i.test(ua)) return "BSD"
  return "Other"
}

function detectBrowser(ua: string): string {
  if (/edg(e|a|ios)?\//i.test(ua)) return "Edge"
  if (/opr\/|opera/i.test(ua)) return "Opera"
  if (/samsungbrowser/i.test(ua)) return "Samsung Internet"
  if (/firefox|fxios/i.test(ua)) return "Firefox"
  if (/chrome|crios|chromium/i.test(ua) && !/edg|opr|samsungbrowser/i.test(ua)) return "Chrome"
  if (/safari/i.test(ua) && !/chrome|crios|android/i.test(ua)) return "Safari"
  if (/msie|trident/i.test(ua)) return "Internet Explorer"
  return "Other"
}

export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  const ua = (userAgent ?? "").trim()
  if (!ua) return { deviceType: "other", os: "Other", browser: "Other", isBot: false }

  const isBot = BOT_PATTERN.test(ua)
  if (isBot) {
    return { deviceType: "bot", os: detectOs(ua), browser: detectBrowser(ua), isBot: true }
  }

  let deviceType: DeviceType = "desktop"
  if (TV_PATTERN.test(ua)) deviceType = "other"
  else if (IPAD_PATTERN.test(ua)) deviceType = "tablet"
  else if (MOBILE_PATTERN.test(ua)) deviceType = "mobile"

  return { deviceType, os: detectOs(ua), browser: detectBrowser(ua), isBot: false }
}
