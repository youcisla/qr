/**
 * Shared QR design + rendering contracts.
 *
 * These types are the single source of truth for the QR engine, the studio UI,
 * the persistence layer and the export pipeline. Keep them serialisable: every
 * design stored in the database is a JSON value of type `QrDesign`.
 */

export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H"

/** Shape of an individual dark module. */
export type DotStyle =
  | "square"
  | "rounded"
  | "dots"
  | "diamond"
  | "star"
  | "cross"
  | "leaf"
  | "classy"
  | "hexagon"
  | "squircle"

/** Shape of the outer 7x7 finder pattern frame. */
export type EyeFrameStyle = "square" | "rounded" | "circle" | "leaf" | "octagon" | "squircle"

/** Shape of the inner 3x3 finder pattern ball. */
export type EyeBallStyle = "square" | "rounded" | "dots" | "leaf" | "squircle"

export interface GradientStop {
  /** #RRGGBB or #RRGGBBAA */
  color: string
  /** 0..1 */
  offset: number
}

export interface LinearGradient {
  type: "linear"
  /** Degrees. 0 = left to right, 90 = top to bottom. */
  angle: number
  stops: GradientStop[]
}

export interface RadialGradient {
  type: "radial"
  stops: GradientStop[]
}

export type QrGradient = LinearGradient | RadialGradient

export type QrFill = { type: "solid"; color: string } | { type: "gradient"; gradient: QrGradient }

export interface QrLogoOptions {
  /** Data URL (preferred) or absolute URL. Data URLs are required for PNG/PDF export. */
  src: string
  /** Logo width as a fraction of the QR content width, 0.1..0.35 */
  size: number
  /** Extra padding around the logo as a fraction of the logo size, 0..0.5 */
  padding: number
  /** Logo corner radius as a fraction of the logo size, 0..0.5 */
  radius: number
  /** Plate colour behind the logo. "transparent" keeps module clearing only. */
  backgroundColor: string
  /** Clear the modules behind the logo (strongly recommended). */
  clearModules: boolean
}

export type QrFrameStyle =
  | "none"
  | "simple"
  | "rounded"
  | "banner"
  | "top"
  | "badge"
  | "ticket"
  | "double"

export interface QrFrameOptions {
  style: QrFrameStyle
  /** Caption rendered under (or inside) the frame. Empty string renders no caption. */
  label: string
  labelColor: string
  frameColor: string
  backgroundColor: string
  /** Font size as a fraction of the QR content width, 0.04..0.12 */
  fontSize: number
}

export interface QrDesign {
  version: 1
  dotStyle: DotStyle
  /** Gap between modules as a fraction of a module, 0..0.4 */
  moduleGap: number
  eyeFrameStyle: EyeFrameStyle
  eyeBallStyle: EyeBallStyle
  /** Foreground fill used by modules and, by default, the eyes. */
  foreground: QrFill
  /** Background fill of the QR itself. */
  background: QrFill
  /** Solid eye frame colour. null = inherit `foreground`. */
  eyeFrameColor: string | null
  /** Solid eye ball colour. null = inherit `foreground`. */
  eyeBallColor: string | null
  /** Quiet zone in modules, 0..8. */
  quietZone: number
  errorCorrection: ErrorCorrectionLevel
  transparentBackground: boolean
  logo: QrLogoOptions | null
  frame: QrFrameOptions | null
}

export type ScanWarningLevel = "error" | "warning" | "info"

export interface ScanWarning {
  level: ScanWarningLevel
  code:
    | "low-contrast"
    | "inverted-colors"
    | "logo-too-large"
    | "logo-without-error-correction"
    | "quiet-zone-small"
    | "low-module-density"
    | "transparent-background"
    | "external-logo"
    | "frame-overlap"
    | "data-too-long"
    | "risky-eye-combination"
  message: string
}

export interface QrMatrix {
  /** Number of modules per side. */
  size: number
  /** Row-major module data: 1 = dark, 0 = light. Length = size * size. */
  modules: Uint8Array
  version: number
  errorCorrectionLevel: ErrorCorrectionLevel
}

export interface RenderQrOptions {
  /** Payload to encode. */
  data: string
  /** Design configuration. Missing fields fall back to DEFAULT_DESIGN. */
  design?: Partial<QrDesign>
  /** Rendered SVG width in CSS pixels (the SVG itself stays resolution independent). */
  size?: number
  /** Force the payload's error correction level (design.errorCorrection wins unless this is set). */
  errorCorrection?: ErrorCorrectionLevel
}

export interface QrRenderResult {
  svg: string
  matrix: QrMatrix
  warnings: ScanWarning[]
  /** Final aspect-correct output width/height in the design's user units. */
  width: number
  height: number
  /** Machine-readable error code when rendering degraded to a fallback placeholder. */
  error?: string
}

export const DEFAULT_DESIGN: QrDesign = {
  version: 1,
  dotStyle: "square",
  moduleGap: 0,
  eyeFrameStyle: "square",
  eyeBallStyle: "square",
  foreground: { type: "solid", color: "#0f172a" },
  background: { type: "solid", color: "#ffffff" },
  eyeFrameColor: null,
  eyeBallColor: null,
  quietZone: 4,
  errorCorrection: "M",
  transparentBackground: false,
  logo: null,
  frame: null,
}

/** Deep-ish design resolution: nested objects (fills/logo/frame) are replaced, not merged. */
export function resolveDesign(partial?: Partial<QrDesign> | null): QrDesign {
  if (!partial) return { ...DEFAULT_DESIGN }
  return {
    ...DEFAULT_DESIGN,
    ...partial,
    foreground: partial.foreground ?? DEFAULT_DESIGN.foreground,
    background: partial.background ?? DEFAULT_DESIGN.background,
    logo: partial.logo === undefined ? DEFAULT_DESIGN.logo : partial.logo,
    frame: partial.frame === undefined ? DEFAULT_DESIGN.frame : partial.frame,
  }
}

export type QrTemplateCategory =
  | "classic"
  | "brand"
  | "playful"
  | "elegant"
  | "dark"
  | "gradient"
  | "print"

export interface QrTemplate {
  /** Stable id persisted alongside a design so the studio can highlight the source template. */
  id: string
  name: string
  description: string
  category: QrTemplateCategory
  /** Partial design merged over DEFAULT_DESIGN. */
  design: Partial<QrDesign>
}