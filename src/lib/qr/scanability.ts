import { contrastRatio, effectiveFillColor, relativeLuminance } from "./color"
import type { QrDesign, QrMatrix, ScanWarning } from "./types"

const MIN_CONTRAST_ERROR = 3
const MIN_CONTRAST_WARNING = 4.5
const MAX_LOGO_FRACTION = 0.25
const MAX_LOGO_FRACTION_ERROR = 0.32
const MAX_MODULE_GAP = 0.2
const MAX_QUIET_ZONE_RECOMMENDED = 4
const MIN_QUIET_ZONE = 2
const MAX_VERSION_RECOMMENDED = 25

/**
 * Heuristic scanability checks that mirror what the large QR platforms warn
 * about. These are heuristics, not a decoder: always keep them conservative.
 */
export function buildScanWarnings(
  design: QrDesign,
  matrix: QrMatrix,
  data: string,
): ScanWarning[] {
  const warnings: ScanWarning[] = []
  const fg = effectiveFillColor(design.foreground)
  const bg = effectiveFillColor(design.background)

  const contrast = contrastRatio(fg, bg)
  if (contrast < MIN_CONTRAST_ERROR) {
    warnings.push({
      level: "error",
      code: "low-contrast",
      message: `Contrast between the QR and its background is only ${contrast.toFixed(1)}:1. Most scanners need at least ${MIN_CONTRAST_ERROR}:1, ideally ${MIN_CONTRAST_WARNING}:1.`,
    })
  } else if (contrast < MIN_CONTRAST_WARNING) {
    warnings.push({
      level: "warning",
      code: "low-contrast",
      message: `Contrast is ${contrast.toFixed(1)}:1. This may fail in low light; aim for at least ${MIN_CONTRAST_WARNING}:1.`,
    })
  }

  if (relativeLuminance(fg) > relativeLuminance(bg)) {
    warnings.push({
      level: "warning",
      code: "inverted-colors",
      message:
        "Light modules on a dark background (inverted QR) are not supported by every scanner. Test before printing.",
    })
  }

  if (design.transparentBackground) {
    warnings.push({
      level: "info",
      code: "transparent-background",
      message:
        "Transparent background: make sure the QR is placed on a light, uncluttered surface when printed.",
    })
  }

  if (design.quietZone < MIN_QUIET_ZONE) {
    warnings.push({
      level: "warning",
      code: "quiet-zone-small",
      message: `A quiet zone of ${MIN_QUIET_ZONE} modules is the minimum for reliable scanning; 4 is recommended.`,
    })
  } else if (design.quietZone < MAX_QUIET_ZONE_RECOMMENDED) {
    warnings.push({
      level: "info",
      code: "quiet-zone-small",
      message: "Scanning is more reliable with a quiet zone of 4 modules.",
    })
  }

  if (
    (design.dotStyle === "diamond" || design.dotStyle === "star" || design.dotStyle === "hexagon") &&
    design.errorCorrection !== "H"
  ) {
    warnings.push({
      level: "warning",
      code: "low-module-density",
      message:
        design.dotStyle === "diamond"
          ? "Diamond modules cover less of each cell. Use error correction H and print at a comfortable size for reliable scanning."
          : `The ${design.dotStyle} module style is decorative and denser error recovery helps older scanners. Use error correction H, or test before printing.`,
    })
  }

  {
    const frame = design.eyeFrameStyle
    const ball = design.eyeBallStyle
    const squareFrame = frame === "square" || frame === "rounded"
    const roundedFrame = frame === "circle" || frame === "leaf" || frame === "octagon"
    if (
      (squareFrame && (ball === "dots" || ball === "leaf")) ||
      (roundedFrame && ball === "square")
    ) {
      warnings.push({
        level: "info",
        code: "risky-eye-combination",
        message:
          "This eye frame/ball combination is unusual; some older decoders may struggle. Test the code with your target scanners, or pick a matching ball shape.",
      })
    }
  }

  if (design.moduleGap > MAX_MODULE_GAP) {
    warnings.push({
      level: "warning",
      code: "low-module-density",
      message:
        "Very large module gaps reduce the effective module size and can hurt scanning at small print sizes.",
    })
  }

  if (design.logo) {
    if (design.logo.size > MAX_LOGO_FRACTION_ERROR) {
      warnings.push({
        level: "error",
        code: "logo-too-large",
        message: `A logo covering ${(design.logo.size * 100).toFixed(0)}% of the QR is very likely to break scanning. Keep it under ${(MAX_LOGO_FRACTION * 100).toFixed(0)}%.`,
      })
    } else if (design.logo.size > MAX_LOGO_FRACTION) {
      warnings.push({
        level: "warning",
        code: "logo-too-large",
        message: `The logo covers ${(design.logo.size * 100).toFixed(0)}% of the QR. Keep it under ${(MAX_LOGO_FRACTION * 100).toFixed(0)}% for reliable scanning.`,
      })
    }

    if (design.logo.clearModules && design.errorCorrection !== "H") {
      warnings.push({
        level: "warning",
        code: "logo-without-error-correction",
        message:
          "Add a logo with error correction H (30% recovery) so removed modules can still be decoded.",
      })
    }

    if (!design.logo.src.startsWith("data:")) {
      warnings.push({
        level: "info",
        code: "external-logo",
        message:
          "External logo URLs cannot be embedded in PNG/PDF exports. Upload the logo file instead.",
      })
    }
  }

  if (matrix.version > MAX_VERSION_RECOMMENDED) {
    warnings.push({
      level: "warning",
      code: "data-too-long",
      message: `The payload needs QR version ${matrix.version} (${matrix.size}x${matrix.size} modules). Dense codes are hard to scan at small sizes; shorten the content or reduce the error correction level.`,
    })
  }

  if (data.length > 0 && design.eyeFrameColor) {
    if (contrastRatio(design.eyeFrameColor, bg) < 2.5) {
      warnings.push({
        level: "warning",
        code: "low-contrast",
        message:
          "The eye frame colour has very low contrast against the background and can hide the finder pattern.",
      })
    }
  }

  if (design.frame && design.frame.label.trim().length > 32) {
    warnings.push({
      level: "info",
      code: "frame-overlap",
      message: "Long captions can dominate the frame; short captions scan and print better.",
    })
  }

  return warnings
}

export function hasBlockingWarnings(warnings: ScanWarning[]): boolean {
  return warnings.some((warning) => warning.level === "error")
}