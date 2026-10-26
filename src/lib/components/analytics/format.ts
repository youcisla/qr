const NUMBER_FORMATTER = new Intl.NumberFormat("en-US")

const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

const DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
})

/**
 * Timestamps are rendered in UTC on purpose: pages are server-rendered, and a
 * fixed time zone keeps the markup identical between the server and the client
 * (no hydration drift when the visitor is in another time zone).
 */
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
})

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" })

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0"
  return NUMBER_FORMATTER.format(value)
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0"
  if (Math.abs(value) < 1000) return NUMBER_FORMATTER.format(value)
  return COMPACT_NUMBER_FORMATTER.format(value)
}

export function formatDecimal(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "0"
  return String(Number(value.toFixed(digits)))
}

export function formatPercent(part: number, total: number, digits = 1): string {
  if (!total || total <= 0) return "0%"
  return `${formatDecimal((part / total) * 100, digits)}%`
}

export function formatPercentChange(value: number): string {
  const sign = value > 0 ? "+" : ""
  return `${sign}${formatDecimal(value, 1)}%`
}

/** Parse a `YYYY-MM-DD` day as a local date (avoids UTC day-shift bugs). */
export function parseIsoDay(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDayLabel(iso: string): string {
  const date = parseIsoDay(iso)
  return date ? DAY_FORMATTER.format(date) : iso
}

/** UTC timestamp label; safe to render during SSR. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—"
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return DATE_TIME_FORMATTER.format(date)
}

/** Day + time label for a last-scan moment. UTC, SSR-safe. */
export function formatScanMoment(value: string | Date | null | undefined): string {
  if (!value) return "Never"
  return formatDateTime(value)
}

/**
 * "3 minutes ago" style label. Uses the current clock, so only render it in
 * client-only surfaces (it would otherwise differ between server and client).
 */
export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) return "Never"
  const date = value instanceof Date ? value : new Date(value)
  const time = date.getTime()
  if (Number.isNaN(time)) return "Never"
  const diff = time - Date.now()
  const absolute = Math.abs(diff)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 24 * 60 * 60 * 1000],
    ["month", 30 * 24 * 60 * 60 * 1000],
    ["day", 24 * 60 * 60 * 1000],
    ["hour", 60 * 60 * 1000],
    ["minute", 60 * 1000],
  ]
  for (const [unit, ms] of units) {
    if (absolute >= ms) return RELATIVE_FORMATTER.format(Math.round(diff / ms), unit)
  }
  return "just now"
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

export interface NiceScale {
  max: number
  step: number
  ticks: number[]
}

/** Round an axis maximum up to a reader-friendly value with evenly spaced ticks. */
export function niceScale(maxValue: number, tickCount = 4): NiceScale {
  const safeMax = Math.max(maxValue, 0)
  if (safeMax <= 0) {
    return {
      max: Math.max(tickCount, 1),
      step: 1,
      ticks: Array.from({ length: tickCount + 1 }, (_, index) => index),
    }
  }
  const roughStep = safeMax / tickCount
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const normalized = roughStep / magnitude
  const niceStep =
    (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude
  return {
    max: niceStep * tickCount,
    step: niceStep,
    ticks: Array.from({ length: tickCount + 1 }, (_, index) => index * niceStep),
  }
}

export function formatHour(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24
  const suffix = normalized < 12 ? "AM" : "PM"
  const display = normalized % 12 === 0 ? 12 : normalized % 12
  return `${display} ${suffix}`
}
