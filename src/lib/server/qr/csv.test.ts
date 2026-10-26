import { describe, expect, test } from "bun:test"

import { DEFAULT_DESIGN } from "../../qr/types"
import { buildQrCodesCsv } from "./csv"
import type { QrCodeWithDesign } from "./service"

function fakeCode(overrides: Partial<QrCodeWithDesign> = {}): QrCodeWithDesign {
  return {
    id: "code-1",
    userId: "user-1",
    shortCode: "abc23456",
    contentType: "url",
    contentData: { url: "https://example.com" },
    encodedData: "https://example.com",
    destinationUrl: "https://example.com",
    title: "Example",
    description: null,
    type: "dynamic",
    status: "active",
    expiresAt: null,
    passwordHash: null,
    tags: ["marketing", "spring"],
    scanCount: 12,
    uniqueScanCount: 5,
    lastScannedAt: new Date("2025-02-03T10:20:30Z"),
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-02-03T00:00:00Z"),
    design: DEFAULT_DESIGN,
    ...overrides,
  }
}

function parse(csv: string): string[] {
  return csv
    .replace(/^\uFEFF/, "")
    .trimEnd()
    .split("\r\n")
}

describe("buildQrCodesCsv", () => {
  test("starts with a BOM and a header row", () => {
    const csv = buildQrCodesCsv([fakeCode()], "https://yopem.test")
    expect(csv.startsWith("\uFEFF")).toBe(true)
    const lines = parse(csv)
    expect(lines[0]).toContain("id")
    expect(lines[0]).toContain("short_url")
    expect(lines[0]).toContain("design_json")
    expect(lines.length).toBe(2)
  })

  test("builds short URLs for dynamic codes and leaves static ones empty", () => {
    const dynamic = parse(buildQrCodesCsv([fakeCode()], "https://yopem.test"))[1]
    expect(dynamic).toContain('"https://yopem.test/abc23456"')
    const staticCode = parse(
      buildQrCodesCsv([fakeCode({ type: "static", shortCode: null })], "https://yopem.test"),
    )[1]
    expect(staticCode).not.toContain("yopem.test/")
  })

  test("escapes quotes, separators and newlines", () => {
    const csv = buildQrCodesCsv(
      [fakeCode({ title: 'He said "hi", twice', description: "line one\nline two" })],
      "https://yopem.test",
    )
    expect(csv).toContain('"He said ""hi"", twice"')
    expect(csv).toContain('"line one line two"')
  })

  test("neutralises spreadsheet formula injection", () => {
    const csv = buildQrCodesCsv([fakeCode({ title: "=SUM(A1:A2)" })], "https://yopem.test")
    expect(csv).toContain('"' + "'" + "=SUM(A1:A2)" + '"')
  })

  test("summarises the design and joins tags", () => {
    const csv = buildQrCodesCsv([fakeCode()], "https://yopem.test")
    expect(csv).toContain('"marketing; spring"')
    expect(csv).toContain('"square / square / square / M / 4"')
  })

  test("handles an empty code list", () => {
    const csv = buildQrCodesCsv([], "https://yopem.test")
    const lines = parse(csv)
    expect(lines.length).toBe(1)
  })
})
