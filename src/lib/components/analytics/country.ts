/**
 * Country helpers with no external dependencies. Country names come from the
 * platform's Intl data, flags from regional-indicator code points.
 */

const REGION_NAMES: Intl.DisplayNames | null = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" })
  } catch {
    return null
  }
})()

export function normalizeCountryCode(code: string | null | undefined): string | null {
  if (!code) return null
  const normalized = code.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null
}

export function countryFlag(code: string | null | undefined): string {
  const normalized = normalizeCountryCode(code)
  if (!normalized) return ""
  return Array.from(normalized)
    .map((character) => String.fromCodePoint(0x1f1e6 + character.charCodeAt(0) - 65))
    .join("")
}

export function countryName(code: string | null | undefined, fallback = "Unknown"): string {
  const normalized = normalizeCountryCode(code)
  if (!normalized) return fallback
  try {
    return REGION_NAMES?.of(normalized) ?? normalized
  } catch {
    return normalized
  }
}
