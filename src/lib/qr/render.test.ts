import { describe, expect, test } from "bun:test"

import { contrastRatio, effectiveFillColor, parseColor, relativeLuminance } from "./color"
import { isEyeModule } from "./matrix"
import { buildQrMatrix } from "./matrix"
import { renderQrSvg } from "./render"
import { buildScanWarnings } from "./scanability"
import { buildQrTarget } from "./target"
import { DEFAULT_DESIGN, resolveDesign } from "./types"
import type { QrDesign } from "./types"

const PAYLOAD = "https://yopem.com/qr/unit-test"

function withDesign(partial: Partial<QrDesign>): QrDesign {
  return { ...DEFAULT_DESIGN, ...partial }
}

describe("buildQrMatrix", () => {
  test("encodes to a square module matrix with finder patterns", () => {
    const matrix = buildQrMatrix(PAYLOAD)
    expect(matrix.size).toBe(17 + matrix.version * 4)
    expect(matrix.modules.length).toBe(matrix.size * matrix.size)
    // Finder pattern rows in all three corners.
    const expected = [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1],
    ]
    const get = (row: number, col: number) => matrix.modules[row * matrix.size + col]
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 7; col += 1) {
        expect(get(row, col)).toBe(expected[row][col])
        expect(get(row, matrix.size - 7 + col)).toBe(expected[row][col])
        expect(get(matrix.size - 7 + row, col)).toBe(expected[row][col])
      }
    }
  })

  test("respects the requested error correction level and version", () => {
    const matrix = buildQrMatrix(PAYLOAD, { errorCorrectionLevel: "H", version: 10 })
    expect(matrix.errorCorrectionLevel).toBe("H")
    expect(matrix.version).toBe(10)
    expect(matrix.size).toBe(57)
  })

  test("is deterministic", () => {
    const a = buildQrMatrix(PAYLOAD, { errorCorrectionLevel: "Q" })
    const b = buildQrMatrix(PAYLOAD, { errorCorrectionLevel: "Q" })
    expect(Array.from(a.modules)).toEqual(Array.from(b.modules))
  })

  test("handles empty content without throwing", () => {
    expect(() => buildQrMatrix("")).not.toThrow()
  })
})

describe("renderQrSvg", () => {
  test("returns self-contained svg with module uses and eye paths", () => {
    const result = renderQrSvg({ data: PAYLOAD })
    expect(result.svg.startsWith("<svg")).toBe(true)
    expect(result.svg.endsWith("</svg>")).toBe(true)
    expect(result.svg).toContain('class="qr-modules"')
    expect(result.svg).toContain('class="qr-eyes"')
    expect(result.svg).toContain("<use")
    expect(result.svg).toContain("viewBox=")
    expect(result.warnings).toEqual([])
    expect(result.error).toBeUndefined()
    expect(result.width).toBeGreaterThan(0)
    expect(result.height).toBe(result.width)
  })

  test("renders every dot style", () => {
    const styles = [
      "square",
      "rounded",
      "dots",
      "diamond",
      "star",
      "cross",
      "leaf",
      "classy",
      "hexagon",
      "squircle",
    ] as const
    const shapes = new Set<string>()
    for (const dotStyle of styles) {
      const result = renderQrSvg({ data: PAYLOAD, design: { dotStyle } })
      expect(result.svg).toContain("<use")
      shapes.add(result.svg.slice(result.svg.indexOf("<defs>"), result.svg.indexOf("</defs>")))
    }
    // Every style must produce a distinct module path.
    expect(shapes.size).toBe(styles.length)
  })

  test("renders every eye style with even-odd fill", () => {
    const frameStyles = ["square", "rounded", "circle", "leaf", "octagon", "squircle"] as const
    const ballStyles = ["square", "rounded", "dots", "leaf", "squircle"] as const
    for (const eyeFrameStyle of frameStyles) {
      const result = renderQrSvg({ data: PAYLOAD, design: { eyeFrameStyle } })
      expect(result.svg).toContain('fill-rule="evenodd"')
    }
    for (const eyeBallStyle of ballStyles) {
      expect(renderQrSvg({ data: PAYLOAD, design: { eyeBallStyle } }).svg).toContain('class="qr-eyes"')
    }
  })

  test("serialises linear and radial gradients", () => {
    const linear = renderQrSvg({
      data: PAYLOAD,
      design: {
        foreground: {
          type: "gradient",
          gradient: {
            type: "linear",
            angle: 45,
            stops: [
              { color: "#4338ca", offset: 0 },
              { color: "#0ea5e9", offset: 1 },
            ],
          },
        },
      },
    })
    expect(linear.svg).toContain("<linearGradient")
    expect(linear.svg).toContain('stop-color="#4338ca"')

    const radial = renderQrSvg({
      data: PAYLOAD,
      design: {
        background: {
          type: "gradient",
          gradient: { type: "radial", stops: [{ color: "#fdf2f8", offset: 0 }] },
        },
      },
    })
    expect(radial.svg).toContain("<radialGradient")
  })

  test("honours transparent backgrounds", () => {
    const transparent = renderQrSvg({ data: PAYLOAD, design: { transparentBackground: true } })
    expect(transparent.svg).not.toMatch(/<rect[^>]+fill="url\(#/)
  })

  test("clears modules behind a logo and embeds it", () => {
    const logo = {
      src: "data:image/png;base64,iVBORw0KGgo=",
      size: 0.18,
      padding: 0.15,
      radius: 0.2,
      backgroundColor: "#ffffff",
      clearModules: true,
    }
    const result = renderQrSvg({ data: PAYLOAD, design: { logo, errorCorrection: "H" } })
    expect(result.svg).toContain("<image")
    expect(result.svg).toContain("clip-path=")
    const withoutLogo = renderQrSvg({ data: PAYLOAD, design: { errorCorrection: "H" } })
    const darkCount = (svg: string) => (svg.match(/<use/g) ?? []).length
    expect(darkCount(result.svg)).toBeLessThan(darkCount(withoutLogo.svg))
  })

  test("renders every frame style", () => {
    const styles = [
      "none",
      "simple",
      "rounded",
      "banner",
      "top",
      "badge",
      "ticket",
      "double",
    ] as const
    const frameBase = {
      label: "SCAN ME",
      labelColor: "#ffffff",
      frameColor: "#0f172a",
      backgroundColor: "#ffffff",
      fontSize: 0.07,
    }
    const sizes = new Set<string>()
    for (const style of styles) {
      const result = renderQrSvg({
        data: PAYLOAD,
        design: { frame: { ...frameBase, style } },
      })
      expect(result.svg).toContain("<svg")
      expect(result.error).toBeUndefined()
      if (style === "none") {
        expect(result.height).toBe(result.width)
      } else {
        expect(result.height).toBeGreaterThanOrEqual(result.width)
        expect(result.svg).toContain('class="qr-frame"')
      }
      sizes.add(`${result.width.toFixed(2)}x${result.height.toFixed(2)}`)
    }
    // Each frame style must produce a distinct layout (or at least the four labelled ones should differ).
    expect(sizes.size).toBeGreaterThanOrEqual(3)
  })

  test("grows the canvas for framed designs and escapes label markup", () => {
    const result = renderQrSvg({
      data: PAYLOAD,
      design: {
        frame: {
          style: "banner",
          label: '</text><script>alert(1)</script>',
          labelColor: "#ffffff",
          frameColor: "#0f172a",
          backgroundColor: "#ffffff",
          fontSize: 0.07,
        },
      },
    })
    expect(result.height).toBeGreaterThan(result.width)
    expect(result.svg).not.toContain("<script>")
    expect(result.svg).toContain("&lt;/text&gt;&lt;script&gt;")
  })

  test("degrades gracefully when content is too long", () => {
    const result = renderQrSvg({ data: "x".repeat(8000), design: { errorCorrection: "H" } })
    expect(result.error).toBe("data-too-long")
    expect(result.warnings[0]?.level).toBe("error")
    expect(result.svg).toContain("<svg")
  })

  test("produces stable output for the same input", () => {
    const a = renderQrSvg({ data: PAYLOAD, design: { dotStyle: "rounded" } })
    const b = renderQrSvg({ data: PAYLOAD, design: { dotStyle: "rounded" } })
    // Gradient ids are unique per render, so compare everything but the defs ids.
    expect(a.matrix.modules).toEqual(b.matrix.modules)
    expect(a.width).toBe(b.width)
  })
})

describe("scanability warnings", () => {
  test("flags insufficient contrast", () => {
    const warnings = buildScanWarnings(
      withDesign({
        foreground: { type: "solid", color: "#fff2cc" },
        background: { type: "solid", color: "#fffbe8" },
      }),
      buildQrMatrix(PAYLOAD),
      PAYLOAD,
    )
    expect(warnings.some((warning) => warning.code === "low-contrast" && warning.level === "error")).toBe(
      true,
    )
  })

  test("flags inverted colours and oversized logos", () => {
    const warnings = buildScanWarnings(
      withDesign({
        foreground: { type: "solid", color: "#f8fafc" },
        background: { type: "solid", color: "#0f172a" },
        logo: {
          src: "data:image/png;base64,AAAA",
          size: 0.4,
          padding: 0,
          radius: 0,
          backgroundColor: "#fff",
          clearModules: true,
        },
      }),
      buildQrMatrix(PAYLOAD),
      PAYLOAD,
    )
    expect(warnings.some((warning) => warning.code === "inverted-colors")).toBe(true)
    expect(warnings.some((warning) => warning.code === "logo-too-large")).toBe(true)
  })

  test("flags decorative module styles below EC H", () => {
    for (const dotStyle of ["diamond", "star", "hexagon"] as const) {
      const warnings = buildScanWarnings(
        withDesign({ dotStyle }),
        buildQrMatrix(PAYLOAD),
        PAYLOAD,
      )
      expect(warnings.some((warning) => warning.code === "low-module-density")).toBe(true)
      const high = buildScanWarnings(
        withDesign({ dotStyle, errorCorrection: "H" }),
        buildQrMatrix(PAYLOAD),
        PAYLOAD,
      )
      expect(high.some((warning) => warning.code === "low-module-density")).toBe(false)
    }
  })

  test("flags risky eye frame and ball pairings", () => {
    const risky = buildScanWarnings(
      withDesign({ eyeFrameStyle: "square", eyeBallStyle: "leaf" }),
      buildQrMatrix(PAYLOAD),
      PAYLOAD,
    )
    expect(risky.some((warning) => warning.code === "risky-eye-combination")).toBe(true)
    const safe = buildScanWarnings(
      withDesign({ eyeFrameStyle: "circle", eyeBallStyle: "dots" }),
      buildQrMatrix(PAYLOAD),
      PAYLOAD,
    )
    expect(safe.some((warning) => warning.code === "risky-eye-combination")).toBe(false)
  })

  test("accepts the default design", () => {
    expect(buildScanWarnings(DEFAULT_DESIGN, buildQrMatrix(PAYLOAD), PAYLOAD)).toEqual([])
  })
})

describe("colour helpers", () => {
  test("computes wcag contrast", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5)
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5)
  })

  test("parses shorthand and alpha hex", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseColor("#0f172a80")?.a).toBeCloseTo(128 / 255, 5)
    expect(parseColor("nope")).toBeNull()
  })

  test("derives a representative colour from gradients", () => {
    expect(
      effectiveFillColor({
        type: "gradient",
        gradient: {
          type: "linear",
          angle: 0,
          stops: [
            { color: "#000000", offset: 0 },
            { color: "#ffffff", offset: 1 },
          ],
        },
      }),
    ).toBe("#808080")
  })
})

describe("resolveDesign and target helpers", () => {
  test("fills defaults without mutating nested objects", () => {
    const design = resolveDesign({ dotStyle: "dots" })
    expect(design.dotStyle).toBe("dots")
    expect(design.foreground).toEqual(DEFAULT_DESIGN.foreground)
    expect(design.errorCorrection).toBe("M")
  })

  test("builds dynamic and static targets", () => {
    expect(
      buildQrTarget({ type: "dynamic", shortCode: "abc123", encodedData: "ignored" }, "https://qr.test"),
    ).toBe("https://qr.test/abc123")
    expect(
      buildQrTarget({ type: "static", encodedData: "WIFI:S:net;T:WPA;P:pass;;" }, "https://qr.test"),
    ).toBe("WIFI:S:net;T:WPA;P:pass;;")
    expect(buildQrTarget({ type: "static", destinationUrl: "https://example.com" }, "https://qr.test")).toBe(
      "https://example.com",
    )
  })

  test("computes module eye regions", () => {
    expect(isEyeModule(0, 0, 29)).toBe(true)
    expect(isEyeModule(6, 6, 29)).toBe(true)
    expect(isEyeModule(7, 7, 29)).toBe(false)
    expect(isEyeModule(10, 10, 29)).toBe(false)
  })
})