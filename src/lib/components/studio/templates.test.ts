import { describe, expect, test } from "bun:test"

import { renderQrSvg } from "../../qr/render"
import { defaultTemplate, getTemplate, templateCategories, templates } from "../../qr/templates"
import type { QrDesign } from "../../qr/types"

const SAMPLE_PAYLOAD = "https://qr.yopem.com/studio"
const DESIGN_ENUMS = {
  dotStyle: [
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
  ],
  eyeFrameStyle: ["square", "rounded", "circle", "leaf", "octagon", "squircle"],
  eyeBallStyle: ["square", "rounded", "dots", "leaf", "squircle"],
  errorCorrection: ["L", "M", "Q", "H"],
}

function renderTemplate(design: Partial<QrDesign>) {
  return renderQrSvg({ data: SAMPLE_PAYLOAD, design, size: 360 })
}

describe("template gallery presets", () => {
  test("ships at least 18 templates with unique ids", () => {
    expect(templates.length).toBeGreaterThanOrEqual(18)
    const ids = templates.map((template) => template.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/)
  })

  test("every template has name, description and a known category", () => {
    const categories = new Set(templateCategories.map((category) => category.id))
    for (const template of templates) {
      expect(template.name.length).toBeGreaterThan(0)
      expect(template.description.length).toBeGreaterThan(10)
      expect(categories.has(template.category)).toBe(true)
    }
  })

  test("template designs only use valid engine values", () => {
    for (const template of templates) {
      const design = template.design
      if (design.dotStyle) expect(DESIGN_ENUMS.dotStyle).toContain(design.dotStyle)
      if (design.eyeFrameStyle) expect(DESIGN_ENUMS.eyeFrameStyle).toContain(design.eyeFrameStyle)
      if (design.eyeBallStyle) expect(DESIGN_ENUMS.eyeBallStyle).toContain(design.eyeBallStyle)
      if (design.errorCorrection)
        expect(DESIGN_ENUMS.errorCorrection).toContain(design.errorCorrection)
      if (typeof design.moduleGap === "number") {
        expect(design.moduleGap).toBeGreaterThanOrEqual(0)
        expect(design.moduleGap).toBeLessThanOrEqual(0.4)
      }
      if (typeof design.quietZone === "number") {
        expect(design.quietZone).toBeGreaterThanOrEqual(0)
        expect(design.quietZone).toBeLessThanOrEqual(8)
      }
      if (design.frame) {
        // Market convention: short captions only (UI enforces 24).
        expect(design.frame.label.length).toBeLessThanOrEqual(24)
        expect(design.frame.fontSize).toBeGreaterThanOrEqual(0.04)
        expect(design.frame.fontSize).toBeLessThanOrEqual(0.12)
      }
    }
  })

  test("no template triggers a blocking scanability error", () => {
    for (const template of templates) {
      const result = renderTemplate(template.design)
      const errors = result.warnings.filter((warning) => warning.level === "error")
      expect({ id: template.id, errors }).toEqual({ id: template.id, errors: [] })
    }
  })

  test("only the intentional dark presets are inverted", () => {
    const inverted = templates
      .filter((template) =>
        renderTemplate(template.design).warnings.some(
          (warning) => warning.code === "inverted-colors",
        ),
      )
      .map((template) => template.id)
    expect(inverted.sort()).toEqual(["carbon", "neon"])
  })

  test("the landing hero templates are premium and warning-free", () => {
    const hero = templates.slice(0, 4)
    expect(hero.map((template) => template.id)).toEqual([
      "brand-gradient",
      "classic",
      "blueprint",
      "minimal",
    ])
    for (const template of hero) {
      const warnings = renderTemplate(template.design).warnings.filter(
        (warning) => warning.level === "error" || warning.level === "warning",
      )
      expect({ id: template.id, warnings: warnings.map((warning) => warning.code) }).toEqual({
        id: template.id,
        warnings: [],
      })
    }
  })

  test("default helpers stay stable for other pages", () => {
    expect(defaultTemplate).toBe(templates[0])
    expect(getTemplate("classic")?.id).toBe("classic")
    expect(getTemplate("does-not-exist")).toBeUndefined()
  })
})
