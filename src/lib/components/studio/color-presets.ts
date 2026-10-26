/** Curated swatches for the solid fill and frame colour pickers. */
export const solidColorPresets: { name: string; value: string }[] = [
  { name: "Ink", value: "#0f172a" },
  { name: "Black", value: "#000000" },
  { name: "Charcoal", value: "#334155" },
  { name: "Brand indigo", value: "#4338ca" },
  { name: "Blue", value: "#2563eb" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Teal", value: "#0d9488" },
  { name: "Emerald", value: "#059669" },
  { name: "Lime", value: "#65a30d" },
  { name: "Amber", value: "#d97706" },
  { name: "Orange", value: "#ea580c" },
  { name: "Red", value: "#dc2626" },
  { name: "Rose", value: "#e11d48" },
  { name: "Pink", value: "#db2777" },
  { name: "Purple", value: "#9333ea" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Slate", value: "#64748b" },
  { name: "White", value: "#ffffff" },
]

export interface GradientPreset {
  name: string
  angle: number
  stops: { color: string; offset: number }[]
}

/** Two-stop gradient presets shown in the fill editor. */
export const gradientPresets: GradientPreset[] = [
  {
    name: "Indigo violet",
    angle: 45,
    stops: [
      { color: "#4338ca", offset: 0 },
      { color: "#a855f7", offset: 1 },
    ],
  },
  {
    name: "Ocean",
    angle: 30,
    stops: [
      { color: "#0ea5e9", offset: 0 },
      { color: "#14b8a6", offset: 1 },
    ],
  },
  {
    name: "Sunset",
    angle: 90,
    stops: [
      { color: "#f97316", offset: 0 },
      { color: "#db2777", offset: 1 },
    ],
  },
  {
    name: "Aurora",
    angle: 135,
    stops: [
      { color: "#6366f1", offset: 0 },
      { color: "#22d3ee", offset: 1 },
    ],
  },
  {
    name: "Berry",
    angle: 45,
    stops: [
      { color: "#be185d", offset: 0 },
      { color: "#7c3aed", offset: 1 },
    ],
  },
  {
    name: "Forest",
    angle: 60,
    stops: [
      { color: "#065f46", offset: 0 },
      { color: "#84cc16", offset: 1 },
    ],
  },
  {
    name: "Mono",
    angle: 90,
    stops: [
      { color: "#0f172a", offset: 0 },
      { color: "#475569", offset: 1 },
    ],
  },
  {
    name: "Gold",
    angle: 45,
    stops: [
      { color: "#92400e", offset: 0 },
      { color: "#f59e0b", offset: 1 },
    ],
  },
]

export function gradientCss(stops: { color: string; offset: number }[], angle = 135): string {
  const sorted = [...stops].sort((a, b) => a.offset - b.offset)
  const list = sorted.map((stop) => `${stop.color} ${Math.round(stop.offset * 100)}%`).join(", ")
  return `linear-gradient(${angle}deg, ${list})`
}
