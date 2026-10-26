import type { QrFill } from "./types"

export interface Rgb {
  r: number
  g: number
  b: number
  a: number
}

const HEX_RE = /^#?([0-9a-f]{3,8})$/i

/** Parse #rgb, #rgba, #rrggbb, #rrggbbaa. Returns null for unsupported formats. */
export function parseColor(input: string): Rgb | null {
  const match = HEX_RE.exec(input.trim())
  if (!match) return null
  const hex = match[1]
  if (hex.length === 3 || hex.length === 4) {
    const r = parseInt(hex[0] + hex[0], 16)
    const g = parseInt(hex[1] + hex[1], 16)
    const b = parseInt(hex[2] + hex[2], 16)
    const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1
    return { r, g, b, a }
  }
  if (hex.length === 6 || hex.length === 8) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    }
  }
  return null
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")
  return `#${part(r)}${part(g)}${part(b)}`
}

export function relativeLuminance(color: string): number {
  const rgb = parseColor(color)
  if (!rgb) return 0
  const channel = (value: number) => {
    const s = value / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a)
  const l2 = relativeLuminance(b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Representative solid colour for a fill (average of gradient stops). */
export function effectiveFillColor(fill: QrFill): string {
  if (fill.type === "solid") return fill.color
  const stops = fill.gradient.stops
  if (stops.length === 0) return "#000000"
  if (stops.length === 1) return stops[0].color
  let r = 0
  let g = 0
  let b = 0
  for (const stop of stops) {
    const rgb = parseColor(stop.color)
    if (!rgb) continue
    r += rgb.r
    g += rgb.g
    b += rgb.b
  }
  return toHex({ r: r / stops.length, g: g / stops.length, b: b / stops.length, a: 1 })
}

/** Mix two hex colours, `amount` = 0 returns a, 1 returns b. */
export function mixColors(a: string, b: string, amount: number): string {
  const ca = parseColor(a)
  const cb = parseColor(b)
  if (!ca || !cb) return a
  const t = Math.max(0, Math.min(1, amount))
  return toHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
    a: ca.a + (cb.a - ca.a) * t,
  })
}

/** Lighten (amount > 0) or darken (amount < 0) a hex colour. */
export function shadeColor(color: string, amount: number): string {
  return amount >= 0 ? mixColors(color, "#ffffff", amount) : mixColors(color, "#000000", -amount)
}
