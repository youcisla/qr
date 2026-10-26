import { describe, expect, test } from "bun:test"

import {
  buildAppUrl,
  buildCryptoUri,
  buildEpcPayload,
  buildEventPayload,
  buildPaypalUrl,
  buildSocialUrl,
  buildWhatsAppUrl,
  buildWifiPayload,
  CONTENT_CATEGORY_ORDER,
  contentTypeGroups,
  contentTypeIds,
  contentTypes,
  defaultContentTypeId,
  defaultValuesFor,
  encodeContent,
  encodeWithType,
  escapeMecardValue,
  escapeVcardText,
  escapeWifiValue,
  foldVcardLine,
  formatBip21Amount,
  formatEpcAmount,
  formatUtcDateTime,
  getContentType,
  getContentTypeOrDefault,
  getContentTypesByCategory,
  isContentTypeId,
  isEmail,
  isHttpUrl,
  isLikelyPhoneNumber,
  isValidBic,
  isValidIban,
  normalizeHttpUrl,
  normalizeIban,
  normalizeSocialHandle,
  unescapeMecardValue,
  unescapeVcardText,
  unescapeWifiValue,
  validateContent,
  withDefaults,
} from "./index"

const encode = (id: string, values: Record<string, string | boolean | undefined>): string =>
  encodeContent(id, values)

const words = (count: number): string => "a".repeat(count)

describe("registry", () => {
  test("exposes exactly the 16 supported content types in picker order", () => {
    expect(contentTypeIds).toEqual([
      "url",
      "text",
      "email",
      "phone",
      "sms",
      "whatsapp",
      "wifi",
      "vcard",
      "mecard",
      "geo",
      "event",
      "crypto",
      "epc",
      "app",
      "social",
      "paypal",
    ])
    expect(contentTypes).toHaveLength(16)
    expect(new Set(contentTypeIds).size).toBe(16)
  })

  test("only URL-like content types support dynamic short links", () => {
    const dynamic = contentTypes
      .filter((type) => type.supportsDynamic)
      .map((type) => type.id)
      .sort()
    expect(dynamic).toEqual(["app", "paypal", "social", "url"])
  })

  test("every type has metadata, fields, defaults and an encodable sample", () => {
    for (const type of contentTypes) {
      expect({ id: type.id, icon: type.icon.length > 0 }).toEqual({ id: type.id, icon: true })
      expect(type.name.length).toBeGreaterThan(2)
      expect(type.description.length).toBeGreaterThan(10)
      expect(type.fields.length).toBeGreaterThan(0)
      expect(CONTENT_CATEGORY_ORDER).toContain(type.category)

      const defaults = defaultValuesFor(type)
      for (const field of type.fields) {
        expect(Object.prototype.hasOwnProperty.call(defaults, field.key)).toBe(true)
        expect(field.label.length).toBeGreaterThan(0)
      }

      const values = withDefaults(type, type.sample)
      const validation = type.validate ? type.validate(values) : { valid: true }
      expect({ id: type.id, validation }).toEqual({ id: type.id, validation: { valid: true } })

      const payload = type.encode(values)
      expect(typeof payload).toBe("string")
      expect(payload.length).toBeGreaterThan(0)
      expect(type.summarize ? type.summarize(values) : type.name).toBeTruthy()
    }
  })

  test("lookups and fallbacks", () => {
    expect(getContentType("wifi")?.id).toBe("wifi")
    expect(getContentType("nope")).toBeUndefined()
    expect(getContentTypeOrDefault("nope").id).toBe(defaultContentTypeId)
    expect(getContentTypeOrDefault(null).id).toBe("url")
    expect(isContentTypeId("epc")).toBe(true)
    expect(isContentTypeId("bogus")).toBe(false)
    expect(defaultContentTypeId).toBe("url")
  })

  test("groups cover every type exactly once", () => {
    const groups = contentTypeGroups()
    const groupedIds = groups.flatMap((group) => group.types.map((type) => type.id))
    expect(groupedIds.sort()).toEqual([...contentTypeIds].sort())
    expect(groups.every((group) => group.label.length > 0)).toBe(true)
    expect(getContentTypesByCategory("payment").map((type) => type.id)).toEqual([
      "crypto",
      "epc",
      "paypal",
    ])
    expect(getContentTypesByCategory("contact").map((type) => type.id)).toEqual([
      "phone",
      "vcard",
      "mecard",
    ])
  })

  test("encodeContent validates, merges defaults and normalises", () => {
    expect(encode("url", { url: "example.com" })).toBe("https://example.com")
    expect(encode("url", { url: "https://example.com/path?q=1" })).toBe(
      "https://example.com/path?q=1",
    )
    expect(encode("wifi", { ssid: "Cafe", password: "password123" })).toBe(
      "WIFI:T:WPA;S:Cafe;P:password123;;",
    )
    expect(() => encode("url", {})).toThrow("A website URL is required")
    expect(() => encode("url", { url: "not a url" })).toThrow()
    expect(() => encode("unknown-type", {})).toThrow()
    expect(encode("unknown-type", { url: "https://example.com" })).toBe("https://example.com")
    expect(validateContent("unknown-type", {})).toEqual({
      valid: false,
      errors: { _type: "Unknown content type: unknown-type" },
    })
  })

  test("encodeWithType never mutates the caller's values", () => {
    const type = getContentTypeOrDefault("url")
    const values = { url: "example.com" }
    encodeWithType(type, values)
    expect(values).toEqual({ url: "example.com" })
  })
})

describe("helpers", () => {
  test("WiFi escaping round-trips every special character", () => {
    const input = 'My;Net,work:"1"'
    const escaped = escapeWifiValue(input)
    expect(escaped).toBe('My\\;Net\\,work\\:\\"1\\"')
    expect(unescapeWifiValue(escaped)).toBe(input)
  })

  test("MeCard escaping round-trips and flattens newlines", () => {
    const escaped = escapeMecardValue("A;B,C:D\nE")
    expect(escaped).toBe("A\\;B\\,C\\:D E")
    expect(unescapeMecardValue(escaped)).toBe("A;B,C:D E")
  })

  test("vCard escaping round-trips text values", () => {
    const input = "Line 1\nLine 2; with, separators \\ and more"
    const escaped = escapeVcardText(input)
    expect(escaped).toBe("Line 1\\nLine 2\\; with\\, separators \\\\ and more")
    expect(unescapeVcardText(escaped)).toBe(input)
  })

  test("vCard folding respects the 75 octet budget", () => {
    expect(foldVcardLine(words(10))).toBe(words(10))
    expect(foldVcardLine(words(75))).toBe(words(75))
    expect(foldVcardLine(words(76))).toBe(words(75) + "\r\n " + "a")
    expect(foldVcardLine(words(200))).toBe(words(75) + "\r\n " + words(74) + "\r\n " + words(51))
  })

  test("vCard folding never splits a multi-byte code point", () => {
    const folded = foldVcardLine("\u00e9".repeat(40))
    const segments = folded.split("\r\n ")
    for (const segment of segments) {
      expect(new TextEncoder().encode(segment).length).toBeLessThanOrEqual(75)
    }
    expect(segments.join("")).toBe("\u00e9".repeat(40))
  })

  test("phone, e-mail and URL validators", () => {
    expect(isLikelyPhoneNumber("+1 (555) 123-4567")).toBe(true)
    expect(isLikelyPhoneNumber("call me")).toBe(false)
    expect(isLikelyPhoneNumber("123")).toBe(false)
    expect(isEmail("hello@yopem.com")).toBe(true)
    expect(isEmail("hello@yopem")).toBe(false)
    expect(isEmail("hello yopem.com")).toBe(false)
    expect(isHttpUrl("example.com")).toBe(true)
    expect(isHttpUrl("https://example.com/a?b=1")).toBe(true)
    expect(isHttpUrl("javascript:alert(1)")).toBe(false)
    expect(isHttpUrl("hello world")).toBe(false)
    expect(normalizeHttpUrl("example.com")).toBe("https://example.com")
  })

  test("IBAN and BIC validation", () => {
    expect(isValidIban("DE89370400440532013000")).toBe(true)
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true)
    expect(isValidIban("de89370400440532013000")).toBe(true)
    expect(isValidIban("DE89370400440532013001")).toBe(false)
    expect(isValidIban("FR1420041010050500013M02606")).toBe(true)
    expect(isValidIban("GB82WEST12345698765432")).toBe(true)
    expect(isValidIban("not-an-iban")).toBe(false)
    expect(normalizeIban(" de89 3704 0044 0532 0130 00 ")).toBe("DE89370400440532013000")

    expect(isValidBic("COBADEFFXXX")).toBe(true)
    expect(isValidBic("COBADEFF")).toBe(true)
    expect(isValidBic("cobadeffxxx")).toBe(true)
    expect(isValidBic("COBADEFF12")).toBe(false)
    expect(isValidBic("COBADEFFXXX1")).toBe(false)
  })

  test("amount formatting for EPC and BIP21", () => {
    expect(formatEpcAmount("49.99")).toBe("EUR49.99")
    expect(formatEpcAmount("49,9")).toBe("EUR49.90")
    expect(formatEpcAmount(" 12 ")).toBe("EUR12.00")
    expect(formatEpcAmount("\u20ac0.01")).toBe("EUR0.01")
    expect(formatEpcAmount("0")).toBeNull()
    expect(formatEpcAmount("1.234")).toBeNull()
    expect(formatEpcAmount("abc")).toBeNull()
    expect(formatEpcAmount("999999999.99")).toBe("EUR999999999.99")
    expect(formatEpcAmount("1000000000")).toBeNull()

    expect(formatBip21Amount("0.001")).toBe("0.001")
    expect(formatBip21Amount("1,5")).toBe("1.5")
    expect(formatBip21Amount("1.50000000")).toBe("1.5")
    expect(formatBip21Amount("0.00000001")).toBe("0.00000001")
    expect(formatBip21Amount("0")).toBeNull()
    expect(formatBip21Amount("1.123456789")).toBeNull()
  })

  test("UTC timestamp formatting", () => {
    expect(formatUtcDateTime(new Date(Date.UTC(2026, 0, 2, 3, 4, 5)))).toBe("20260102T030405Z")
  })
})

describe("url", () => {
  test("encodes exact payloads", () => {
    expect(encode("url", { url: "yopem.com" })).toBe("https://yopem.com")
    expect(encode("url", { url: "http://yopem.com" })).toBe("http://yopem.com")
  })

  test("rejects invalid URLs", () => {
    expect(validateContent("url", { url: "" })).toEqual({
      valid: false,
      errors: { url: "A website URL is required" },
    })
    expect(validateContent("url", { url: "not a url" }).valid).toBe(false)
    expect(() => encode("url", { url: "not a url" })).toThrow()
  })
})

describe("text", () => {
  test("encodes exact payloads and preserves line breaks", () => {
    expect(encode("text", { text: "Hello" })).toBe("Hello")
    expect(encode("text", { text: "  Line 1\nLine 2  " })).toBe("Line 1\nLine 2")
    expect(encode("text", { text: "Code: SAVE20" })).toBe("Code: SAVE20")
  })

  test("rejects empty text", () => {
    expect(validateContent("text", { text: "" }).valid).toBe(false)
    expect(() => encode("text", { text: " " })).toThrow("Text is required")
  })
})

describe("email", () => {
  test("encodes exact mailto payloads", () => {
    expect(encode("email", { to: "hello@yopem.com" })).toBe("mailto:hello@yopem.com")
    expect(
      encode("email", {
        to: "hello@yopem.com",
        subject: "Hello from Yopem QR",
        body: "Line 1\nLine 2",
      }),
    ).toBe("mailto:hello@yopem.com?subject=Hello%20from%20Yopem%20QR&body=Line%201%0ALine%202")
    expect(encode("email", { to: "a@b.com, c@d.com" })).toBe("mailto:a@b.com,c@d.com")
    expect(encode("email", { to: " a@b.com ", subject: "Hi" })).toBe("mailto:a@b.com?subject=Hi")
  })

  test("validates recipients", () => {
    expect(validateContent("email", { to: "hello@yopem" }).valid).toBe(false)
    expect(validateContent("email", { to: "" }).valid).toBe(false)
    expect(() => encode("email", { to: "hello@yopem" })).toThrow("Invalid e-mail address")
    expect(encode("email", { to: "a@b.com, c@d.com" })).toBe("mailto:a@b.com,c@d.com")
  })
})

describe("phone", () => {
  test("encodes an exact tel payload", () => {
    expect(encode("phone", { number: "+1 (555) 123-4567" })).toBe("tel:+15551234567")
    expect(encode("phone", { number: "555 123 4567" })).toBe("tel:5551234567")
  })

  test("validates the number", () => {
    expect(validateContent("phone", { number: "call me" }).valid).toBe(false)
    expect(() => encode("phone", { number: "123" })).toThrow("Enter a valid phone number")
  })
})

describe("sms", () => {
  test("encodes an exact SMSTO payload", () => {
    expect(encode("sms", { number: "+1 555 123 4567", message: "Hello" })).toBe(
      "SMSTO:+15551234567:Hello",
    )
    expect(encode("sms", { number: "+1 555 123 4567" })).toBe("SMSTO:+15551234567:")
    expect(encode("sms", { number: "+1555123", message: "Hi: there" })).toBe(
      "SMSTO:+1555123:Hi: there",
    )
  })

  test("validates the number", () => {
    expect(validateContent("sms", { number: "abc" }).valid).toBe(false)
    expect(() => encode("sms", {})).toThrow("A phone number is required")
  })
})

describe("whatsapp", () => {
  test("builds wa.me links", () => {
    expect(buildWhatsAppUrl("+1 555 123 4567", "Hi there")).toBe(
      "https://wa.me/15551234567?text=Hi%20there",
    )
    expect(buildWhatsAppUrl("+1 555 123 4567")).toBe("https://wa.me/15551234567")
    expect(buildWhatsAppUrl("0044 7700 900123")).toBe("https://wa.me/447700900123")
    expect(encode("whatsapp", { phone: "+1 555 123 4567", message: "Hello & welcome" })).toBe(
      "https://wa.me/15551234567?text=Hello%20%26%20welcome",
    )
  })

  test("validates the number", () => {
    expect(validateContent("whatsapp", { phone: "123" }).valid).toBe(false)
    expect(() => encode("whatsapp", { phone: "+1555" })).toThrow()
  })
})

describe("wifi", () => {
  test("encodes exact WIFI payloads", () => {
    expect(
      buildWifiPayload({
        ssid: "Yopem Guest",
        password: "welcome2024",
        encryption: "WPA",
        hidden: false,
      }),
    ).toBe("WIFI:T:WPA;S:Yopem Guest;P:welcome2024;;")
    expect(
      buildWifiPayload({ ssid: "Open Cafe", password: "", encryption: "nopass", hidden: false }),
    ).toBe("WIFI:T:nopass;S:Open Cafe;;")
    expect(
      buildWifiPayload({ ssid: "Hidden", password: "secret-123", encryption: "WEP", hidden: true }),
    ).toBe("WIFI:T:WEP;S:Hidden;P:secret-123;H:true;;")
    expect(
      buildWifiPayload({ ssid: "Hidden", password: "", encryption: "nopass", hidden: true }),
    ).toBe("WIFI:T:nopass;S:Hidden;H:true;;")
  })

  test("escapes the special characters in SSID and password", () => {
    const payload = encode("wifi", {
      ssid: 'My;Net,work:"1"',
      password: 'p;a,s:s"w',
      encryption: "WPA",
      hidden: true,
    })
    expect(payload).toBe('WIFI:T:WPA;S:My\\;Net\\,work\\:\\"1\\";P:p\\;a\\,s\\:s\\"w;H:true;;')
  })

  test("validates SSID, network type and password", () => {
    expect(validateContent("wifi", { ssid: "" }).valid).toBe(false)
    expect(validateContent("wifi", { ssid: "Net", encryption: "WPA" }).valid).toBe(false)
    expect(validateContent("wifi", { ssid: "Net", encryption: "nopass" }).valid).toBe(true)
    expect(
      validateContent("wifi", { ssid: "Net", encryption: "WPA", password: "short" }).valid,
    ).toBe(false)
    expect(() => encode("wifi", { ssid: "Net", encryption: "WPA" })).toThrow(
      "A password is required for secured networks",
    )
  })
})

describe("vcard", () => {
  const simple = {
    firstName: "Amine",
    lastName: "Benali",
    organization: "Yopem",
    phone: "+212 600 000 000",
    email: "amine@yopem.com",
    website: "https://yopem.com",
  }

  test("encodes a canonical vCard 3.0 payload with CRLF endings", () => {
    expect(encode("vcard", simple)).toBe(
      [
        "BEGIN:VCARD",
        "VERSION:3.0",
        "N:Benali;Amine;;;",
        "FN:Amine Benali",
        "ORG:Yopem",
        "TEL;TYPE=WORK,VOICE:+212600000000",
        "EMAIL;TYPE=INTERNET:amine@yopem.com",
        "URL:https://yopem.com",
        "END:VCARD",
      ].join("\r\n"),
    )
  })

  test("encodes the structured address line", () => {
    const payload = encode("vcard", {
      firstName: "Amine",
      street: "12 Rue de la Plage",
      city: "Casablanca",
      postalCode: "20000",
      country: "Morocco",
    })
    expect(payload).toContain(
      "\r\nADR;TYPE=WORK:;;12 Rue de la Plage;Casablanca;;20000;Morocco\r\n",
    )
  })

  test("escapes and folds long notes", () => {
    const payload = encode("vcard", {
      firstName: "A",
      note: "a".repeat(80) + ";,=",
    })
    expect(payload).toContain("NOTE:" + words(70) + "\r\n " + words(10) + "\\;\\,=")
    const lines = payload.split("\r\n")
    for (const line of lines) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
    const unfolded = payload.replace(/\r\n /g, "")
    expect(unfolded).toContain("NOTE:" + "a".repeat(80) + "\\;\\,=")
  })

  test("handles escaped names and newlines in the note", () => {
    const payload = encode("vcard", {
      firstName: "Am;ine",
      lastName: "Ben,ali",
      note: "Line 1\nLine 2",
    })
    expect(payload).toContain("\r\nN:Ben\\,ali;Am\\;ine;;;\r\n")
    expect(payload).toContain("\r\nFN:Am\\;ine Ben\\,ali\r\n")
    expect(payload).toContain("\r\nNOTE:Line 1\\nLine 2\r\n")
  })

  test("validates the name, e-mail, website and phones", () => {
    expect(validateContent("vcard", {}).valid).toBe(false)
    expect(validateContent("vcard", { firstName: "A", email: "nope" }).valid).toBe(false)
    expect(validateContent("vcard", { firstName: "A", website: "nope" }).valid).toBe(false)
    expect(validateContent("vcard", { firstName: "A", phone: "abc" }).valid).toBe(false)
    expect(() => encode("vcard", {})).toThrow("Enter at least a first or last name")
  })
})

describe("mecard", () => {
  test("encodes an exact MeCard payload", () => {
    expect(
      encode("mecard", {
        firstName: "Amine",
        lastName: "Benali",
        phone: "+212 600 000 000",
        email: "amine@yopem.com",
        website: "https://yopem.com",
        organization: "Yopem",
        address: "12 Rue de la Plage, Casablanca",
        note: "Met at DevFest 2025",
      }),
    ).toBe(
      "MECARD:N:Benali,Amine;TEL:+212600000000;EMAIL:amine@yopem.com;URL:https://yopem.com;ORG:Yopem;ADR:12 Rue de la Plage\\, Casablanca;NOTE:Met at DevFest 2025;;",
    )
    expect(encode("mecard", { firstName: "Amine" })).toBe("MECARD:N:,Amine;;")
  })

  test("escapes the special characters", () => {
    expect(
      encode("mecard", {
        lastName: "Ben;ali",
        organization: "Yo:pe,m",
        note: "Line 1\nLine 2",
      }),
    ).toBe("MECARD:N:Ben\\;ali,;ORG:Yo\\:pe\\,m;NOTE:Line 1 Line 2;;")
  })

  test("validates the name", () => {
    expect(validateContent("mecard", {}).valid).toBe(false)
    expect(() => encode("mecard", {})).toThrow("Enter at least a first or last name")
  })
})

describe("geo", () => {
  test("encodes exact geo payloads", () => {
    expect(encode("geo", { latitude: "48.8566", longitude: "2.3522" })).toBe("geo:48.8566,2.3522")
    expect(encode("geo", { latitude: "+48.8566", longitude: "-2.3522" })).toBe(
      "geo:48.8566,-2.3522",
    )
    expect(
      encode("geo", { latitude: "48.8566", longitude: "2.3522", label: "Yopem HQ, Paris" }),
    ).toBe("geo:48.8566,2.3522?q=Yopem%20HQ%2C%20Paris")
  })

  test("validates coordinate ranges", () => {
    expect(validateContent("geo", { latitude: "91", longitude: "2" }).valid).toBe(false)
    expect(validateContent("geo", { latitude: "48", longitude: "181" }).valid).toBe(false)
    expect(validateContent("geo", { latitude: "abc", longitude: "2" }).valid).toBe(false)
    expect(validateContent("geo", { latitude: "-90", longitude: "-180" }).valid).toBe(true)
    expect(() => encode("geo", { latitude: "91", longitude: "2" })).toThrow()
  })
})

describe("event", () => {
  test("encodes timed events in UTC", () => {
    const payload = buildEventPayload({
      title: "Yopem Product Launch",
      location: "Casablanca, Morocco",
      description: "Join us",
      startDate: "2026-11-20",
      startTime: "18:00",
      endDate: "2026-11-20",
      endTime: "21:00",
    })
    const expectedStart =
      new Date(2026, 10, 20, 18, 0, 0, 0).toISOString().slice(0, 19).replace(/[-:]/g, "") + "Z"
    const expectedEnd =
      new Date(2026, 10, 20, 21, 0, 0, 0).toISOString().slice(0, 19).replace(/[-:]/g, "") + "Z"

    expect(payload.startsWith("BEGIN:VEVENT\r\nSUMMARY:Yopem Product Launch\r\n")).toBe(true)
    expect(payload).toContain("\r\nLOCATION:Casablanca\\, Morocco\r\n")
    expect(payload).toContain("\r\nDTSTART:" + expectedStart + "\r\n")
    expect(payload).toContain("\r\nDTEND:" + expectedEnd + "\r\n")
    expect(payload.endsWith("\r\nEND:VEVENT")).toBe(true)
  })

  test("defaults the end to one hour after the start", () => {
    const payload = buildEventPayload({
      title: "Quick call",
      startDate: "2026-03-01",
      startTime: "09:30",
    })
    const expectedStart = new Date(2026, 2, 1, 9, 30)
    const expectedEnd = new Date(2026, 2, 1, 10, 30)
    const start = expectedStart.toISOString().slice(0, 19).replace(/[-:]/g, "") + "Z"
    const end = expectedEnd.toISOString().slice(0, 19).replace(/[-:]/g, "") + "Z"
    expect(payload).toContain("DTSTART:" + start)
    expect(payload).toContain("DTEND:" + end)
  })

  test("encodes all-day events with an exclusive end date", () => {
    expect(
      encode("event", {
        title: "Yopem Anniversary",
        startDate: "2026-07-14",
        allDay: true,
      }),
    ).toBe(
      "BEGIN:VEVENT\r\nSUMMARY:Yopem Anniversary\r\nDTSTART;VALUE=DATE:20260714\r\nDTEND;VALUE=DATE:20260715\r\nEND:VEVENT",
    )
  })

  test("escapes text and validates dates", () => {
    const payload = encode("event", {
      title: "Launch, Day 1; Paris",
      startDate: "2026-07-14",
      allDay: true,
    })
    expect(payload).toContain("SUMMARY:Launch\\, Day 1\\; Paris")
    expect(validateContent("event", { title: "X", startDate: "2026-02-30" }).valid).toBe(false)
    expect(validateContent("event", { title: "", startDate: "2026-02-28" }).valid).toBe(false)
    expect(validateContent("event", { title: "X", startDate: "2026-02-28" }).valid).toBe(true)
    expect(() =>
      buildEventPayload({
        title: "Backwards",
        startDate: "2026-03-01",
        startTime: "12:00",
        endTime: "11:00",
      }),
    ).toThrow("The end must be after the start")
  })
})

describe("crypto", () => {
  const address = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"

  test("encodes an exact BIP21 payload", () => {
    expect(
      buildCryptoUri({
        coin: "bitcoin",
        address,
        amount: "0.001",
        label: "Yopem",
        message: "Thanks for the coffee!",
      }),
    ).toBe("bitcoin:" + address + "?amount=0.001&label=Yopem&message=Thanks%20for%20the%20coffee!")
    expect(buildCryptoUri({ coin: "bitcoin", address })).toBe("bitcoin:" + address)
  })

  test("supports legacy and alternative coins", () => {
    const legacy = "1BoatSLRHtKNngkdXEeobR76b53LETtpyT"
    expect(buildCryptoUri({ coin: "bitcoin", address: legacy })).toBe("bitcoin:" + legacy)
    const litecoin = "ltc1q" + "q".repeat(40)
    expect(buildCryptoUri({ coin: "litecoin", address: litecoin, amount: "1,5" })).toBe(
      "litecoin:" + litecoin + "?amount=1.5",
    )
    const dogecoin = "D" + "A".repeat(33)
    expect(buildCryptoUri({ coin: "dogecoin", address: dogecoin })).toBe("dogecoin:" + dogecoin)
  })

  test("validates addresses and amounts", () => {
    expect(validateContent("crypto", { address: "nope" }).valid).toBe(false)
    expect(validateContent("crypto", { address, amount: "0" }).valid).toBe(false)
    expect(validateContent("crypto", { address, amount: "1.123456789" }).valid).toBe(false)
    expect(validateContent("crypto", { address, amount: "0.001" }).valid).toBe(true)
    expect(() => buildCryptoUri({ coin: "bitcoin", address: "nope" })).toThrow()
  })
})

describe("epc", () => {
  const sample = {
    beneficiaryName: "Yopem SARL",
    iban: "DE89370400440532013000",
    bic: "COBADEFFXXX",
    amount: "49.99",
    remittance: "Invoice 2026-0042",
  }

  test("encodes the exact EPC069-12 line structure", () => {
    expect(encode("epc", sample)).toBe(
      "BCD\n002\n1\nSCT\nCOBADEFFXXX\nYopem SARL\nDE89370400440532013000\nEUR49.99\nInvoice 2026-0042",
    )
    expect(buildEpcPayload({ ...sample, remittance: "" })).toBe(
      "BCD\n002\n1\nSCT\nCOBADEFFXXX\nYopem SARL\nDE89370400440532013000\nEUR49.99",
    )
  })

  test("normalises IBAN, BIC and amount formatting", () => {
    expect(
      encode("epc", {
        beneficiaryName: " Yopem SARL ",
        iban: "DE89 3704 0044 0532 0130 00",
        bic: "cobadeffxxx",
        amount: "49,9",
      }),
    ).toBe("BCD\n002\n1\nSCT\nCOBADEFFXXX\nYopem SARL\nDE89370400440532013000\nEUR49.90")
  })

  test("validates IBAN checksum, BIC, amount and name", () => {
    expect(validateContent("epc", { ...sample, iban: "DE89370400440532013001" }).valid).toBe(false)
    expect(validateContent("epc", { ...sample, bic: "COBADEFF12" }).valid).toBe(false)
    expect(validateContent("epc", { ...sample, amount: "1.234" }).valid).toBe(false)
    expect(validateContent("epc", { ...sample, amount: "0" }).valid).toBe(false)
    expect(validateContent("epc", { ...sample, beneficiaryName: "" }).valid).toBe(false)
    expect(validateContent("epc", { ...sample, beneficiaryName: "x".repeat(71) }).valid).toBe(false)
    expect(validateContent("epc", sample).valid).toBe(true)
    expect(() => buildEpcPayload({ ...sample, iban: "nope" })).toThrow("Enter a valid IBAN")
  })
})

describe("app", () => {
  test("builds canonical store links", () => {
    expect(buildAppUrl("ios", "1234567890")).toBe("https://apps.apple.com/app/id1234567890")
    expect(buildAppUrl("ios", "id1234567890")).toBe("https://apps.apple.com/app/id1234567890")
    expect(buildAppUrl("ios", "https://apps.apple.com/us/app/yopem/id1234567890")).toBe(
      "https://apps.apple.com/app/id1234567890",
    )
    expect(buildAppUrl("android", "com.yopem.qr")).toBe(
      "https://play.google.com/store/apps/details?id=com.yopem.qr",
    )
    expect(
      buildAppUrl("android", "https://play.google.com/store/apps/details?id=com.yopem.qr&hl=en"),
    ).toBe("https://play.google.com/store/apps/details?id=com.yopem.qr")
    expect(buildAppUrl("custom", "", "example.com/app")).toBe("https://example.com/app")
    expect(encode("app", { store: "android", appId: "com.yopem.qr" })).toBe(
      "https://play.google.com/store/apps/details?id=com.yopem.qr",
    )
  })

  test("validates the app id per store", () => {
    expect(validateContent("app", { store: "ios", appId: "abc" }).valid).toBe(false)
    expect(validateContent("app", { store: "android", appId: "nodot" }).valid).toBe(false)
    expect(validateContent("app", { store: "custom", customUrl: "nope" }).valid).toBe(false)
    expect(validateContent("app", { store: "ios", appId: "1234567890" }).valid).toBe(true)
    expect(() => buildAppUrl("ios", "abc")).toThrow()
  })
})

describe("social", () => {
  test("builds smart profile URLs for every network", () => {
    expect(buildSocialUrl("instagram", "@yopem")).toBe("https://instagram.com/yopem")
    expect(buildSocialUrl("facebook", "yopem")).toBe("https://facebook.com/yopem")
    expect(buildSocialUrl("tiktok", "@yopem")).toBe("https://www.tiktok.com/@yopem")
    expect(buildSocialUrl("x", "@yopem")).toBe("https://x.com/yopem")
    expect(buildSocialUrl("linkedin", "@yopem")).toBe("https://www.linkedin.com/in/yopem")
    expect(buildSocialUrl("youtube", "@yopem")).toBe("https://www.youtube.com/@yopem")
    expect(buildSocialUrl("snapchat", "yopem")).toBe("https://www.snapchat.com/add/yopem")
    expect(buildSocialUrl("pinterest", "yopem")).toBe("https://www.pinterest.com/yopem")
    expect(buildSocialUrl("telegram", "yopem")).toBe("https://t.me/yopem")
    expect(buildSocialUrl("github", "yopem")).toBe("https://github.com/yopem")
    expect(buildSocialUrl("custom", "example.com/profile")).toBe("https://example.com/profile")
  })

  test("normalises handles pasted as URLs", () => {
    expect(normalizeSocialHandle("@yopem")).toBe("yopem")
    expect(normalizeSocialHandle("instagram.com/yopem/")).toBe("yopem")
    expect(normalizeSocialHandle("https://www.instagram.com/yopem/?hl=en")).toBe("yopem")
    expect(buildSocialUrl("instagram", "https://instagram.com/yopem/")).toBe(
      "https://instagram.com/yopem",
    )
  })

  test("encodes and validates", () => {
    expect(encode("social", { network: "instagram", handle: "@yopem" })).toBe(
      "https://instagram.com/yopem",
    )
    expect(validateContent("social", { network: "instagram", handle: "" }).valid).toBe(false)
    expect(validateContent("social", { network: "instagram", handle: "yopem!" }).valid).toBe(false)
    expect(validateContent("social", { network: "custom", customUrl: "" }).valid).toBe(false)
    expect(validateContent("social", { network: "custom", customUrl: "example.com" }).valid).toBe(
      true,
    )
    expect(() => buildSocialUrl("instagram", "yopem!")).toThrow()
  })
})

describe("paypal", () => {
  test("builds PayPal.Me payment links", () => {
    expect(buildPaypalUrl("yopem")).toBe("https://paypal.me/yopem")
    expect(buildPaypalUrl("@yopem")).toBe("https://paypal.me/yopem")
    expect(buildPaypalUrl("https://paypal.me/yopem")).toBe("https://paypal.me/yopem")
    expect(buildPaypalUrl("yopem", "25.00", "USD")).toBe("https://paypal.me/yopem/25.00USD")
    expect(buildPaypalUrl("yopem", "25")).toBe("https://paypal.me/yopem/25")
    expect(encode("paypal", { handle: "yopem", amount: "25.00", currency: "USD" })).toBe(
      "https://paypal.me/yopem/25.00USD",
    )
  })

  test("validates the handle and amount", () => {
    expect(validateContent("paypal", { handle: "y!" }).valid).toBe(false)
    expect(validateContent("paypal", { handle: "yopem", amount: "0" }).valid).toBe(false)
    expect(validateContent("paypal", { handle: "yopem", amount: "12.345" }).valid).toBe(false)
    expect(validateContent("paypal", { handle: "yopem" }).valid).toBe(true)
    expect(
      validateContent("paypal", { handle: "yopem", amount: "12.5", currency: "EUR" }).valid,
    ).toBe(true)
    expect(() => buildPaypalUrl("y!", "1")).toThrow()
  })
})
