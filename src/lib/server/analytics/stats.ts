import { db } from "$lib/server/db"
import { qrCodesTable, scanEventsTable } from "$lib/server/db/schema"
import { and, eq, gte, sql, type SQL } from "drizzle-orm"

/** Supported analytics windows; "all" means since the first recorded scan. */
export type AnalyticsRange = 7 | 30 | 90 | "all"
export type AnalyticsRangeInput = AnalyticsRange | "7d" | "30d" | "90d" | "all" | null | undefined

/** Normalise the range values used by the UI ("7d", 7, "30", ...) to a canonical range. */
export function parseAnalyticsRange(value: AnalyticsRangeInput | string | number): AnalyticsRange {
  if (value === 7 || value === 30 || value === 90) return value
  if (value === "all") return "all"
  const normalised = String(value ?? "")
    .trim()
    .toLowerCase()
  if (normalised === "all" || normalised === "0") return "all"
  const days = Number.parseInt(normalised.replace(/d$/, ""), 10)
  if (days === 7 || days === 30 || days === 90) return days
  return 30
}

export interface QrAnalyticsBucket {
  label: string
  /** Alias of scans, kept for chart components that expect `value`. */
  value: number
  scans: number
  unique: number
}

export interface QrAnalyticsDay {
  /** UTC calendar day, YYYY-MM-DD. */
  date: string
  scans: number
  unique: number
  /** Alias of unique, kept for consistency with the task contract. */
  uniqueScans: number
}

export interface QrAnalyticsHour {
  hour: number
  scans: number
  unique: number
}

export interface QrAnalytics {
  range: AnalyticsRange
  since: Date | null
  /** Lifetime counters from qr_codes (authoritative). */
  totalScans: number
  uniqueScans: number
  lastScanAt: Date | null
  /** Totals limited to the selected range (from scan_events). */
  rangeScans: number
  rangeUniqueScans: number
  daily: QrAnalyticsDay[]
  countries: QrAnalyticsBucket[]
  cities: QrAnalyticsBucket[]
  devices: QrAnalyticsBucket[]
  os: QrAnalyticsBucket[]
  browsers: QrAnalyticsBucket[]
  referrers: QrAnalyticsBucket[]
  hours: QrAnalyticsHour[]
}

export interface UserOverview {
  totalCodes: number
  totalScans: number
  uniqueScans: number
  activeCodes: number
  pausedCodes: number
  archivedCodes: number
  dynamicCodes: number
  scansLast7d: number
  uniqueScansLast7d: number
}

interface DailyRow {
  date: string
  scans: number
  unique_scans: number | null
}

interface BucketRow {
  label: string | null
  scans: number
  unique_scans: number | null
}

interface HourRow {
  hour: number
  scans: number
  unique_scans: number | null
}

interface OverviewRow {
  total_codes: number
  total_scans: number
  unique_scans: number
  active_codes: number
  paused_codes: number
  archived_codes: number
  dynamic_codes: number
}

interface RecentScansRow {
  scans: number
  unique_scans: number | null
}

const DAY_MS = 24 * 60 * 60 * 1000

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function rangeToDays(range: AnalyticsRange): number | null {
  return range === "all" ? null : range
}

function rangeStart(range: AnalyticsRange): Date | null {
  const days = rangeToDays(range)
  if (days === null) return null
  const today = startOfUtcDay(new Date())
  return new Date(today.getTime() - (days - 1) * DAY_MS)
}

function zeroFillDaily(
  range: AnalyticsRange,
  since: Date | null,
  rows: DailyRow[],
): QrAnalyticsDay[] {
  if (!since) {
    return rows.map((row) => ({
      date: row.date,
      scans: row.scans,
      unique: row.unique_scans ?? 0,
      uniqueScans: row.unique_scans ?? 0,
    }))
  }

  const byDate = new Map(rows.map((row) => [row.date, row]))
  const days = rangeToDays(range) ?? 0
  const result: QrAnalyticsDay[] = []
  for (let index = 0; index < days; index += 1) {
    const date = formatDateKey(new Date(since.getTime() + index * DAY_MS))
    const row = byDate.get(date)
    result.push({
      date,
      scans: row?.scans ?? 0,
      unique: row?.unique_scans ?? 0,
      uniqueScans: row?.unique_scans ?? 0,
    })
  }
  return result
}

function zeroFillHours(rows: HourRow[]): QrAnalyticsHour[] {
  const byHour = new Map(rows.map((row) => [row.hour, row]))
  return Array.from({ length: 24 }, (_, hour) => {
    const row = byHour.get(hour)
    return { hour, scans: row?.scans ?? 0, unique: row?.unique_scans ?? 0 }
  })
}

function referrerLabel(value: string | null): string {
  if (!value) return "Direct"
  try {
    const host = new URL(value).hostname.replace(/^www\./, "")
    return host || "Direct"
  } catch {
    return value.slice(0, 120)
  }
}
async function bucketRows(column: string, where: SQL<unknown>, limit = 8): Promise<BucketRow[]> {
  const rows = (await db.execute(sql`
    select ${sql.raw(column)} as label,
      count(*)::int as scans,
      sum(case when is_unique then 1 else 0 end)::int as unique_scans
    from scan_events
    where ${where}
    group by 1
    order by 2 desc
    limit ${limit}
  `)) as unknown as BucketRow[]
  return rows
}

function toBucket(row: BucketRow, fallback: string): QrAnalyticsBucket {
  return {
    label: row.label?.trim() || fallback,
    value: row.scans,
    scans: row.scans,
    unique: row.unique_scans ?? 0,
  }
}

/**
 * Scan analytics for one QR code. Lifetime totals come from the counter
 * columns on qr_codes; the charts and breakdowns are aggregated from
 * scan_events for the selected range.
 */
export async function getQrAnalytics(
  qrCodeId: string,
  rangeInput: AnalyticsRangeInput | string | number = 30,
): Promise<QrAnalytics> {
  const range = parseAnalyticsRange(rangeInput)
  const since = rangeStart(range)

  const [qrCode] = await db
    .select({
      scanCount: qrCodesTable.scanCount,
      uniqueScanCount: qrCodesTable.uniqueScanCount,
      lastScannedAt: qrCodesTable.lastScannedAt,
    })
    .from(qrCodesTable)
    .where(eq(qrCodesTable.id, qrCodeId))
    .limit(1)

  const where = (
    since
      ? and(eq(scanEventsTable.qrCodeId, qrCodeId), gte(scanEventsTable.scannedAt, since))
      : eq(scanEventsTable.qrCodeId, qrCodeId)
  ) as SQL<unknown>

  const [
    dailyResult,
    countryRows,
    cityRows,
    deviceRows,
    osRows,
    browserRows,
    refererRows,
    hourResult,
  ] = await Promise.all([
    db.execute(sql`
        select to_char(date_trunc('day', scanned_at at time zone 'UTC'), 'YYYY-MM-DD') as date,
          count(*)::int as scans,
          sum(case when is_unique then 1 else 0 end)::int as unique_scans
        from scan_events
        where ${where}
        group by 1
        order by 1
      `),
    bucketRows("country", where),
    bucketRows("city", where, 10),
    bucketRows("device_type", where),
    bucketRows("os", where),
    bucketRows("browser", where),
    bucketRows("referer", where, 100),
    db.execute(sql`
        select extract(hour from scanned_at at time zone 'UTC')::int as hour,
          count(*)::int as scans,
          sum(case when is_unique then 1 else 0 end)::int as unique_scans
        from scan_events
        where ${where}
        group by 1
        order by 1
      `),
  ])

  const daily = zeroFillDaily(range, since, dailyResult as unknown as DailyRow[])
  const hours = zeroFillHours(hourResult as unknown as HourRow[])

  const referrerTotals = new Map<string, { scans: number; unique: number }>()
  for (const row of refererRows as BucketRow[]) {
    const label = referrerLabel(row.label)
    const current = referrerTotals.get(label) ?? { scans: 0, unique: 0 }
    current.scans += row.scans
    current.unique += row.unique_scans ?? 0
    referrerTotals.set(label, current)
  }

  return {
    range,
    since,
    totalScans: qrCode?.scanCount ?? 0,
    uniqueScans: qrCode?.uniqueScanCount ?? 0,
    lastScanAt: qrCode?.lastScannedAt ?? null,
    rangeScans: daily.reduce((sum, day) => sum + day.scans, 0),
    rangeUniqueScans: daily.reduce((sum, day) => sum + day.unique, 0),
    daily,
    countries: (countryRows as BucketRow[]).map((row) => toBucket(row, "Unknown")),
    cities: (cityRows as BucketRow[]).map((row) => toBucket(row, "Unknown")),
    devices: (deviceRows as BucketRow[]).map((row) => toBucket(row, "unknown")),
    os: (osRows as BucketRow[]).map((row) => toBucket(row, "Unknown")),
    browsers: (browserRows as BucketRow[]).map((row) => toBucket(row, "Unknown")),
    referrers: [...referrerTotals.entries()]
      .map(([label, totals]) => ({
        label,
        value: totals.scans,
        scans: totals.scans,
        unique: totals.unique,
      }))
      .sort((a, b) => b.scans - a.scans)
      .slice(0, 10),
    hours,
  }
}

/**
 * Aggregates used by the dashboard overview: code counts, lifetime scans and
 * the last seven days of activity.
 */
export async function getUserOverview(userId: string): Promise<UserOverview> {
  const [codesResult, recentResult] = await Promise.all([
    db.execute(sql`
      select count(*)::int as total_codes,
        coalesce(sum(scan_count), 0)::int as total_scans,
        coalesce(sum(unique_scan_count), 0)::int as unique_scans,
        count(*) filter (where status = 'active')::int as active_codes,
        count(*) filter (where status = 'paused')::int as paused_codes,
        count(*) filter (where status = 'archived')::int as archived_codes,
        count(*) filter (where type = 'dynamic')::int as dynamic_codes
      from qr_codes
      where user_id = ${userId}
    `),
    db.execute(sql`
      select count(*)::int as scans,
        sum(case when se.is_unique then 1 else 0 end)::int as unique_scans
      from scan_events se
      join qr_codes qc on qc.id = se.qr_code_id
      where qc.user_id = ${userId}
        and se.scanned_at >= now() - interval '7 days'
    `),
  ])

  const codes = (codesResult as unknown as OverviewRow[])[0]
  const recent = (recentResult as unknown as RecentScansRow[])[0]

  return {
    totalCodes: codes?.total_codes ?? 0,
    totalScans: codes?.total_scans ?? 0,
    uniqueScans: codes?.unique_scans ?? 0,
    activeCodes: codes?.active_codes ?? 0,
    pausedCodes: codes?.paused_codes ?? 0,
    archivedCodes: codes?.archived_codes ?? 0,
    dynamicCodes: codes?.dynamic_codes ?? 0,
    scansLast7d: recent?.scans ?? 0,
    uniqueScansLast7d: recent?.unique_scans ?? 0,
  }
}
