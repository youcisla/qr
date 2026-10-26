/**
 * Shared view-model types for the analytics UI.
 *
 * These types deliberately decouple the chart components from the database
 * schema: server loads map service output into these shapes, so the charts stay
 * stable if the analytics queries change.
 */

/** Supported reporting windows for the per-QR analytics page. */
export type AnalyticsRange = "7d" | "30d" | "90d" | "all"

export interface RangeOption {
  value: AnalyticsRange
  label: string
}

export const RANGE_OPTIONS: RangeOption[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
]

export function isAnalyticsRange(value: string | null | undefined): value is AnalyticsRange {
  return value === "7d" || value === "30d" || value === "90d" || value === "all"
}

export function rangeLabel(range: AnalyticsRange): string {
  return RANGE_OPTIONS.find((option) => option.value === range)?.label ?? "All time"
}

/** A single bucket of the scans-over-time chart. */
export interface TimeSeriesPoint {
  /** ISO calendar day, `YYYY-MM-DD`. */
  date: string
  scans: number
  /** Unique (first-time) scans for the same bucket, when available. */
  unique?: number
}

/** One row of a categorical breakdown (device, OS, browser, country, ...). */
export interface BreakdownItem {
  label: string
  value: number
  /** Optional secondary value, e.g. unique scans for a country. */
  secondary?: number
  /** ISO 3166-1 alpha-2 code, used to render a flag for country rows. */
  countryCode?: string
}

/** Scans for one hour of the day (local server time). */
export interface HourBucket {
  /** 0-23. */
  hour: number
  scans: number
}

/** Percentage change used by stat cards. */
export interface StatTrend {
  /** Relative change in percent, e.g. 12.5 or -3. */
  value: number
  /** Optional qualifier, e.g. "vs previous 7 days". */
  label?: string
}
