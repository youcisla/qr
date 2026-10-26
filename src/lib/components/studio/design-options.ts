import type { DotStyle, ErrorCorrectionLevel, EyeBallStyle, EyeFrameStyle } from "$lib/qr/types"

/** Option rendered by the reusable style pickers. */
export interface StyleOption {
  value: string
  label: string
  hint?: string
}

export const dotStyleOptions: StyleOption[] = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "squircle", label: "Squircle" },
  { value: "squircle", label: "Squircle" },
  { value: "classy", label: "Classy" },
  { value: "squircle", label: "Squircle" },
  { value: "star", label: "Star" },
  { value: "cross", label: "Cross" },
  { value: "leaf", label: "Leaf" },
  { value: "hexagon", label: "Hexagon" },
]

export const eyeFrameOptions: StyleOption[] = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "circle", label: "Circle" },
  { value: "leaf", label: "Leaf" },
  { value: "octagon", label: "Octagon" },
  { value: "dots", label: "Dots" },
]

export const eyeBallOptions: StyleOption[] = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "dots", label: "Circle" },
  { value: "diamond", label: "Diamond" },
  { value: "leaf", label: "Leaf" },
]

export const errorCorrectionOptions: {
  value: ErrorCorrectionLevel
  label: string
  recovery: string
  hint: string
}[] = [
  { value: "L", label: "L — Low", recovery: "7%", hint: "Smallest code, best for clean screens" },
  { value: "M", label: "M — Medium", recovery: "15%", hint: "Balanced default for most codes" },
  { value: "Q", label: "Q — Quartile", recovery: "25%", hint: "Good for gradients and dots" },
  { value: "H", label: "H — High", recovery: "30%", hint: "Required for logos and print damage" },
]

export function dotStyleLabel(value: DotStyle): string {
  return dotStyleOptions.find((option) => option.value === value)?.label ?? value
}

export function eyeFrameLabel(value: EyeFrameStyle): string {
  return eyeFrameOptions.find((option) => option.value === value)?.label ?? value
}

export function eyeBallLabel(value: EyeBallStyle): string {
  return eyeBallOptions.find((option) => option.value === value)?.label ?? value
}

export function errorCorrectionLabel(value: ErrorCorrectionLevel): string {
  return errorCorrectionOptions.find((option) => option.value === value)?.label ?? value
}
