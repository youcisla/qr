import { describe, expect, test } from "bun:test"

import { contentTypes, withDefaults } from "./content"
import { hasOpenableUrl, isUrlPayload, parseQrPayload } from "./parse"

/** Encode a content type sample into its QR payload. */
function samplePayload(id: string): string {
  const type = contentTypes.find((candidate) => candidate.id === id)
  if (!type) throw new Error("Unknown content type " + id)
  return type.encode(withDefaults(type, type.sample))
}

describe("parseQrPayload - URLs", () => {
  test("parses a plain https URL", () => {
    const result = parseQrPayload("https://yopem.com/pricing?plan=pro")
    expect(result.kind).toBe("url")
    expect(result.title).toBe("yopem.com")
    expect(result.subtitle).toBe("/pricing")
    expect(result.url).toBe("https://yopem.com/pricing?plan=pro")
    expect(result.fields[0]).toMatchObject({ label: "Link", kind: "url" })
    expect(result.actions.map((action) => action.id)).toEqual(["open-link", "copy-link"])
    expect(hasOpenableUrl(result)).toBe(true)
    expect(isUrlPayload(result)).toBe(true)
  })

  test("parses bare domains and adds the scheme", () => {
    const result = parseQrPayload("www.example.com/shop")
    expect(result.kind).toBe("url")
    expect(result.url).toBe("https://www.example.com/shop")
    expect(result.title).toBe("example.com")
  })

  test("classifies whatsapp links", () => {
    const result = parseQrPayload("https://wa.me/15551234567?text=Hello%20there")
    expect(result.kind).toBe("whatsapp")
    expect(result.title).toBe("WhatsApp")
    expect(result.meta).toMatchObject({ phone: "15551234567", message: "Hello there" })
    expect(result.actions[0]).toMatchObject({ id: "open-whatsapp", kind: "open" })
  })

  test("classifies paypal.me links with amounts", () => {
    const result = parseQrPayload("https://paypal.me/yopem/25.00USD")
    expect(result.kind).toBe("paypal")
    expect(result.meta).toMatchObject({ handle: "yopem", amount: "25.00", currency: "USD" })
    expect(result.fields).toContainEqual({ label: "Amount", value: "25.00 USD", kind: "money" })
  })

  test("classifies app store links", () => {
    const apple = parseQrPayload("https://apps.apple.com/app/id1234567890")
    expect(apple.kind).toBe("app")
    expect(apple.meta).toMatchObject({ store: "ios", appId: "1234567890" })

    const play = parseQrPayload("https://play.google.com/store/apps/details?id=com.yopem.qr")
    expect(play.kind).toBe("app")
    expect(play.meta).toMatchObject({ store: "android", packageName: "com.yopem.qr" })
  })

  test("classifies social profiles", () => {
    const instagram = parseQrPayload("https://instagram.com/yopem")
    expect(instagram.kind).toBe("social")
    expect(instagram.title).toBe("Instagram")
    expect(instagram.meta).toMatchObject({ handle: "yopem" })

    const github = parseQrPayload("https://github.com/yopem/qr")
    expect(github.kind).toBe("social")
    expect(github.meta).toEqual({ network: "github", handle: "yopem" })

    const youtube = parseQrPayload("https://www.youtube.com/@yopem")
    expect(youtube.kind).toBe("social")
    expect(youtube.subtitle).toBe("@yopem")
  })
})

describe("parseQrPayload - text", () => {
  test("falls back to text for unrecognised payloads", () => {
    const result = parseQrPayload("Hello world")
    expect(result.kind).toBe("text")
    expect(result.title).toBe("Text")
    expect(result.fields[0]).toEqual({ label: "Text", value: "Hello world", kind: "multiline" })
    expect(result.actions).toContainEqual({
      id: "copy-text",
      label: "Copy text",
      kind: "copy",
      value: "Hello world",
    })
  })

  test("preserves multi-line text", () => {
    const result = parseQrPayload("Line 1\nLine 2")
    expect(result.kind).toBe("text")
    expect(result.fields[0].value).toBe("Line 1\nLine 2")
  })

  test("handles empty input", () => {
    const result = parseQrPayload("   ")
    expect(result.kind).toBe("text")
    expect(result.title).toBe("Empty QR code")
    expect(result.fields).toEqual([])
  })
})

describe("parseQrPayload - email, phone and SMS", () => {
  test("parses our mailto payload", () => {
    const result = parseQrPayload(samplePayload("email"))
    expect(result.kind).toBe("email")
    expect(result.title).toBe("Hello from Yopem QR")
    expect(result.meta).toMatchObject({
      to: "hello@yopem.com",
      subject: "Hello from Yopem QR",
      body: "I scanned your QR code and wanted to say hi!",
    })
    expect(result.fields.map((field) => field.label)).toEqual(["To", "Subject", "Message"])
    expect(result.actions[0]).toMatchObject({ id: "send-email", kind: "email" })
  })

  test("parses third-party mailto payloads", () => {
    const result = parseQrPayload(
      "mailto:info@example.com, sales@example.com?subject=Hi%20there&body=Hello+there",
    )
    expect(result.kind).toBe("email")
    expect(result.meta?.to).toBe("info@example.com, sales@example.com")
    expect(result.meta?.subject).toBe("Hi there")
    expect(result.meta?.body).toBe("Hello there")
  })

  test("parses tel payloads", () => {
    const result = parseQrPayload("tel:+15551234567")
    expect(result.kind).toBe("phone")
    expect(result.actions[0]).toMatchObject({ id: "call", kind: "call", href: "tel:+15551234567" })
    expect(result.meta?.number).toBe("+15551234567")
  })

  test("parses SMSTO payloads", () => {
    const result = parseQrPayload(samplePayload("sms"))
    expect(result.kind).toBe("sms")
    expect(result.title).toBe("+15551234567")
    expect(result.meta).toMatchObject({
      number: "+15551234567",
      message: "Hi! I scanned your QR code.",
    })
    expect(result.actions[0]).toMatchObject({
      id: "send-sms",
      kind: "sms",
      href: "sms:+15551234567?body=Hi!%20I%20scanned%20your%20QR%20code.",
    })
  })

  test("parses sms: URI variants", () => {
    const query = parseQrPayload("sms:+15551234567?body=Hello")
    expect(query.kind).toBe("sms")
    expect(query.meta).toMatchObject({ number: "+15551234567", message: "Hello" })

    const ampersand = parseQrPayload("sms:+15551234567&body=Hi%20there")
    expect(ampersand.kind).toBe("sms")
    expect(ampersand.meta?.message).toBe("Hi there")

    const colon = parseQrPayload("sms:+15551234567:On my way")
    expect(colon.kind).toBe("sms")
    expect(colon.meta?.message).toBe("On my way")
  })
})

describe("parseQrPayload - WiFi", () => {
  test("parses the encoded sample and exposes the password", () => {
    const result = parseQrPayload(samplePayload("wifi"))
    expect(result.kind).toBe("wifi")
    expect(result.title).toBe("Yopem Guest")
    expect(result.subtitle).toBe("WPA / WPA2")
    expect(result.meta).toMatchObject({
      ssid: "Yopem Guest",
      security: "WPA / WPA2",
      hidden: "false",
    })
    expect(result.fields).toContainEqual({
      label: "Password",
      value: "welcome2024",
      kind: "secret",
    })
    expect(result.actions.map((action) => action.id)).toEqual(["copy-password", "copy-ssid"])
  })

  test("round-trips escaped SSID and password", () => {
    const ssid = 'My;Net,work:"1"'
    const password = 'p;a,s:s"w'
    const payload = 'WIFI:T:WPA;S:My\\;Net\\,work\\:\\"1\\";P:p\\;a\\,s\\:s\\"w;;'
    const result = parseQrPayload(payload)
    expect(result.meta?.ssid).toBe(ssid)
    expect(result.meta?.password).toBe(password)
  })

  test("parses open, WEP and hidden networks", () => {
    const open = parseQrPayload("WIFI:T:nopass;S:Open Cafe;;")
    expect(open.subtitle).toBe("Open")
    expect(open.fields.find((field) => field.label === "Password")).toBeUndefined()

    const wep = parseQrPayload("WIFI:S:Old Router;T:WEP;P:abcde;H:true;;")
    expect(wep.subtitle).toBe("WEP - hidden network")
    expect(wep.fields).toContainEqual({ label: "Hidden network", value: "Yes" })

    const missingSsid = parseQrPayload("WIFI:garbage")
    expect(missingSsid.kind).toBe("wifi")
    expect(missingSsid.title).toBe("Wi-Fi Network")
  })
})

describe("parseQrPayload - vCard and MeCard", () => {
  test("parses our encoded vCard", () => {
    const result = parseQrPayload(samplePayload("vcard"))
    expect(result.kind).toBe("vcard")
    expect(result.title).toBe("Amine Benali")
    expect(result.meta).toMatchObject({
      name: "Amine Benali",
      organization: "Yopem",
      email: "amine@yopem.com",
    })
    expect(result.fields).toContainEqual({
      label: "Phone",
      value: "+212600000000",
      kind: "tel",
      href: "tel:+212600000000",
    })
    expect(result.actions[0]).toMatchObject({
      id: "save-contact",
      kind: "download",
      download: "amine-benali.vcf",
    })
    expect(result.actions[0].href?.startsWith("data:text/vcard;charset=utf-8,")).toBe(true)
    expect(result.url).toBe("https://yopem.com")
  })

  test("parses third-party vCards with different property order and formatting", () => {
    const payload = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Doe;John;;;",
      "FN:John Doe",
      "TEL;TYPE=CELL:+1 555 987 6543",
      "EMAIL;TYPE=INTERNET:john@example.com",
      "ADR;TYPE=HOME:;;1 Main St;Springfield;IL;62704;USA",
      "NOTE:Met at the conference",
      "END:VCARD",
    ].join("\n")
    const result = parseQrPayload(payload)
    expect(result.kind).toBe("vcard")
    expect(result.title).toBe("John Doe")
    expect(result.fields).toContainEqual({
      label: "Address",
      value: "1 Main St, Springfield, IL, 62704, USA",
    })
    expect(result.fields).toContainEqual({
      label: "Note",
      value: "Met at the conference",
      kind: "multiline",
    })
  })

  test("unfolds folded vCard lines", () => {
    const note = "a".repeat(120)
    const payload = samplePayload("vcard").replace("NOTE:Met at DevFest 2025", "")
    const longVcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Benali;Amine;;;",
      "FN:Amine Benali",
      "NOTE:" + note.slice(0, 70) + "\r\n " + note.slice(70),
      "END:VCARD",
    ].join("\r\n")
    const result = parseQrPayload(longVcard)
    expect(result.fields).toContainEqual({ label: "Note", value: note, kind: "multiline" })
    expect(payload.length).toBeGreaterThan(0)
  })

  test("survives an empty vCard", () => {
    const result = parseQrPayload("BEGIN:VCARD\r\nVERSION:3.0\r\nEND:VCARD")
    expect(result.kind).toBe("vcard")
    expect(result.title).toBe("Contact card")
    expect(result.fields).toEqual([])
  })

  test("parses our encoded MeCard", () => {
    const result = parseQrPayload(samplePayload("mecard"))
    expect(result.kind).toBe("mecard")
    expect(result.title).toBe("Amine Benali")
    expect(result.meta).toMatchObject({ name: "Amine Benali", phone: "+212600000000" })
    expect(result.fields).toContainEqual({
      label: "Address",
      value: "12 Rue de la Plage, Casablanca",
    })
    expect(result.actions[0].id).toBe("save-contact")
    expect(result.actions[0].href).toContain("data:text/vcard")
  })

  test("parses third-party MeCards", () => {
    const result = parseQrPayload(
      "MECARD:N:Doe,John;TEL:+15551234567;EMAIL:j@d.com;URL:example.com;;",
    )
    expect(result.kind).toBe("mecard")
    expect(result.title).toBe("John Doe")
    expect(result.actions.map((action) => action.id)).toEqual([
      "save-contact",
      "call",
      "email",
      "open-website",
    ])
  })
})

describe("parseQrPayload - geo", () => {
  test("parses coordinates with a label", () => {
    const result = parseQrPayload(samplePayload("geo"))
    expect(result.kind).toBe("geo")
    expect(result.title).toBe("Yopem HQ, Paris")
    expect(result.meta).toMatchObject({
      latitude: "48.8566",
      longitude: "2.3522",
      label: "Yopem HQ, Paris",
    })
    expect(result.url).toBe("https://www.google.com/maps?q=48.8566%2C2.3522&z=16")
    expect(result.actions[0]).toMatchObject({ id: "open-map", kind: "map" })
  })

  test("parses plain and extended geo URIs", () => {
    const plain = parseQrPayload("geo:37.7749,-122.4194")
    expect(plain.title).toBe("37.7749,-122.4194")

    const extended = parseQrPayload("geo:37.7749,-122.4194,15;u=35")
    expect(extended.fields).toContainEqual({ label: "Altitude", value: "15 m" })

    const searchQuery = parseQrPayload("geo:37.7,-122.4?q=37.7,-122.4")
    expect(searchQuery.meta?.label).toBe("")
  })
})

describe("parseQrPayload - events", () => {
  test("parses our encoded UTC event", () => {
    const result = parseQrPayload(samplePayload("event"))
    expect(result.kind).toBe("event")
    expect(result.title).toBe("Yopem Product Launch")
    expect(result.fields[0].label).toBe("When")
    expect(result.fields[0].value).toContain(" - ")
    expect(result.meta?.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    expect(result.meta?.end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    expect(result.actions[0].id).toBe("add-to-calendar")
    expect(result.actions[0].href).toContain("calendar.google.com")
  })

  test("parses a VCALENDAR wrapper and all-day dates", () => {
    const payload = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "SUMMARY:Anniversary",
      "DTSTART;VALUE=DATE:20260714",
      "DTEND;VALUE=DATE:20260715",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n")
    const result = parseQrPayload(payload)
    expect(result.kind).toBe("event")
    expect(result.title).toBe("Anniversary")
    expect(result.fields[0]).toEqual({ label: "When", value: "2026-07-14", kind: "datetime" })
    expect(result.actions[0].href).toContain("dates=20260714%2F20260715")
  })

  test("parses floating local times without a timezone", () => {
    const payload =
      "BEGIN:VEVENT\r\nSUMMARY:Call\r\nDTSTART:20261120T180000\r\nDTEND:20261120T190000\r\nEND:VEVENT"
    const result = parseQrPayload(payload)
    expect(result.meta?.start).toBe("2026-11-20 18:00:00")
    expect(result.meta?.end).toBe("2026-11-20 19:00:00")
  })
})

describe("parseQrPayload - crypto and EPC", () => {
  test("parses BIP21 payments", () => {
    const result = parseQrPayload(samplePayload("crypto"))
    expect(result.kind).toBe("crypto")
    expect(result.title).toBe("Bitcoin payment")
    expect(result.meta).toMatchObject({
      scheme: "bitcoin",
      address: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
      amount: "0.001",
      label: "Yopem",
    })
    expect(result.fields).toContainEqual({ label: "Amount", value: "0.001 BTC", kind: "money" })
    expect(result.actions[0]).toMatchObject({ id: "open-wallet", kind: "open" })
  })

  test("parses address-only and ethereum URIs", () => {
    const bitcoin = parseQrPayload("bitcoin:1BoatSLRHtKNngkdXEeobR76b53LETtpyT")
    expect(bitcoin.fields.find((field) => field.label === "Amount")).toBeUndefined()

    const ethereum = parseQrPayload("ethereum:0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B")
    expect(ethereum.kind).toBe("crypto")
    expect(ethereum.title).toBe("Ethereum payment")
  })

  test("parses EPC069-12 transfers", () => {
    const result = parseQrPayload(samplePayload("epc"))
    expect(result.kind).toBe("epc")
    expect(result.title).toBe("Yopem SARL")
    expect(result.meta).toMatchObject({
      iban: "DE89370400440532013000",
      bic: "COBADEFFXXX",
      amount: "49.99",
      remittance: "Invoice 2026-0042",
    })
    expect(result.fields).toContainEqual({ label: "Amount", value: "EUR 49.99", kind: "money" })
    expect(result.actions[0]).toMatchObject({ id: "copy-iban", kind: "copy" })
  })

  test("parses CRLF EPC payloads without optional lines", () => {
    const payload =
      "BCD\r\n002\r\n1\r\nSCT\r\nCOBADEFFXXX\r\nYopem SARL\r\nDE89370400440532013000\r\nEUR12.00"
    const result = parseQrPayload(payload)
    expect(result.kind).toBe("epc")
    expect(result.fields.find((field) => field.label === "Reference")).toBeUndefined()
  })
})

describe("parseQrPayload - full content type round-trip", () => {
  const expectedKinds: Record<string, string> = {
    url: "url",
    text: "text",
    email: "email",
    phone: "phone",
    sms: "sms",
    whatsapp: "whatsapp",
    wifi: "wifi",
    vcard: "vcard",
    mecard: "mecard",
    geo: "geo",
    event: "event",
    crypto: "crypto",
    epc: "epc",
    app: "app",
    social: "social",
    paypal: "paypal",
  }

  test("every content type sample decodes to its expected kind", () => {
    for (const type of contentTypes) {
      const result = parseQrPayload(samplePayload(type.id))
      expect({ id: type.id, kind: result.kind }).toEqual({
        id: type.id,
        kind: expectedKinds[type.id],
      })
      expect({ id: type.id, fields: result.fields.length > 0 }).toEqual({
        id: type.id,
        fields: true,
      })
      expect({ id: type.id, title: result.title.length > 0 }).toEqual({ id: type.id, title: true })
    }
  })
})

describe("parseQrPayload - robustness", () => {
  test("never throws on malformed input", () => {
    const inputs = [
      "",
      "   ",
      "WIFI:",
      "WIFI:T:WPA;S:",
      "BEGIN:VCARD",
      "BEGIN:VCARD\r\nN:;;;;",
      "MECARD:",
      "MECARD:N:;",
      "geo:",
      "geo:abc",
      "mailto:",
      "mailto:?subject=no-recipient",
      "tel:",
      "sms:",
      "SMSTO:",
      "BCD",
      "bitcoin:",
      "ethereum:",
      "http://",
      "javascript:alert(1)",
      "%%% not encoded %%%",
      "\u0000\u0001\u0002",
      "https://",
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "x".repeat(5000),
      "mailto:%E0%A4%A",
      "WIFI:S:a\\",
    ]
    for (const input of inputs) {
      expect(() => parseQrPayload(input)).not.toThrow()
      const result = parseQrPayload(input)
      expect(typeof result.kind).toBe("string")
      expect(typeof result.title).toBe("string")
      expect(Array.isArray(result.fields)).toBe(true)
      expect(Array.isArray(result.actions)).toBe(true)
    }
  })

  test("trims surrounding whitespace before decoding", () => {
    const result = parseQrPayload("  https://yopem.com  ")
    expect(result.kind).toBe("url")
    expect(result.url).toBe("https://yopem.com")
  })

  test("keeps the raw payload available", () => {
    const result = parseQrPayload("Hello")
    expect(result.raw).toBe("Hello")
  })

  test("URL payloads are flagged as openable and QR-generatable", () => {
    expect(hasOpenableUrl(parseQrPayload("https://yopem.com"))).toBe(true)
    expect(isUrlPayload(parseQrPayload("https://yopem.com"))).toBe(true)
    expect(hasOpenableUrl(parseQrPayload("hello"))).toBe(false)
    expect(isUrlPayload(parseQrPayload("hello"))).toBe(false)
    expect(hasOpenableUrl(parseQrPayload("tel:+15551234567"))).toBe(false)
  })
})
