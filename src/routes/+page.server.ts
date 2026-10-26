import { renderQrSvg } from "$lib/qr/render"
import { templates } from "$lib/qr/templates"

import type { PageServerLoad } from "./$types"

const SHOWCASE_TARGET = "https://qr.yopem.com/studio"

export const load: PageServerLoad = async ({ locals }) => {
  const showcase = templates.slice(0, 4).map((template) => {
    const result = renderQrSvg({
      data: SHOWCASE_TARGET,
      design: template.design,
      size: 360,
    })
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      svg: result.svg,
      warnings: result.warnings,
    }
  })

  const hero = renderQrSvg({
    data: "https://qr.yopem.com/studio",
    design: {
      dotStyle: "rounded",
      eyeFrameStyle: "rounded",
      eyeBallStyle: "rounded",
      moduleGap: 0,
      errorCorrection: "H",
      foreground: {
        type: "gradient",
        gradient: {
          type: "linear",
          angle: 135,
          stops: [
            { color: "#6d28d9", offset: 0 },
            { color: "#db2777", offset: 1 },
          ],
        },
      },
      background: { type: "solid", color: "#ffffff" },
      frame: {
        style: "banner",
        label: "SCAN ME",
        labelColor: "#ffffff",
        frameColor: "#111827",
        backgroundColor: "#ffffff",
        fontSize: 0.07,
      },
    },
    size: 420,
  })

  return {
    title: "Yopem QR — design, track, and scan QR codes",
    description:
      "Create branded QR codes with custom shapes, gradients, logos and frames. 16 content types, dynamic short links, scan analytics, and print-ready SVG, PNG and PDF exports.",
    keywords: "qr code generator, qr code maker, dynamic qr code, qr analytics, qr studio",
    user: locals.session,
    showcase,
    heroSvg: hero.svg,
  }
}
