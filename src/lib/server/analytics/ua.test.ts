import { describe, expect, test } from "bun:test"

import { parseUserAgent } from "./ua"

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
const IPAD_SAFARI =
  "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
const WINDOWS_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
const WINDOWS_EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0"
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
const LINUX_FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0"
const ANDROID_SAMSUNG =
  "Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36"
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
const CURL = "curl/8.5.0"

describe("parseUserAgent", () => {
  test("detects iPhone Safari", () => {
    expect(parseUserAgent(IPHONE_SAFARI)).toEqual({
      deviceType: "mobile",
      os: "iOS",
      browser: "Safari",
      isBot: false,
    })
  })

  test("detects iPad as a tablet", () => {
    const parsed = parseUserAgent(IPAD_SAFARI)
    expect(parsed.deviceType).toBe("tablet")
    expect(parsed.os).toBe("iOS")
  })

  test("detects Android Chrome", () => {
    expect(parseUserAgent(ANDROID_CHROME)).toEqual({
      deviceType: "mobile",
      os: "Android",
      browser: "Chrome",
      isBot: false,
    })
  })

  test("detects desktop Windows Chrome", () => {
    expect(parseUserAgent(WINDOWS_CHROME)).toEqual({
      deviceType: "desktop",
      os: "Windows",
      browser: "Chrome",
      isBot: false,
    })
  })

  test("detects Edge instead of Chrome", () => {
    const parsed = parseUserAgent(WINDOWS_EDGE)
    expect(parsed.browser).toBe("Edge")
    expect(parsed.os).toBe("Windows")
  })

  test("detects macOS Safari", () => {
    expect(parseUserAgent(MAC_SAFARI)).toEqual({
      deviceType: "desktop",
      os: "macOS",
      browser: "Safari",
      isBot: false,
    })
  })

  test("detects Linux Firefox", () => {
    const parsed = parseUserAgent(LINUX_FIREFOX)
    expect(parsed.os).toBe("Linux")
    expect(parsed.browser).toBe("Firefox")
  })

  test("detects Samsung Internet before Chrome", () => {
    const parsed = parseUserAgent(ANDROID_SAMSUNG)
    expect(parsed.browser).toBe("Samsung Internet")
  })

  test("flags bots", () => {
    const googlebot = parseUserAgent(GOOGLEBOT)
    expect(googlebot.isBot).toBe(true)
    expect(googlebot.deviceType).toBe("bot")
    expect(parseUserAgent(CURL).isBot).toBe(true)
  })

  test("handles empty user agents", () => {
    expect(parseUserAgent(null)).toEqual({
      deviceType: "other",
      os: "Other",
      browser: "Other",
      isBot: false,
    })
  })
})
