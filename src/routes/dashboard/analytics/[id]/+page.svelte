<script lang="ts">
  import {
    ArrowLeft,
    ChevronRight,
    Clock,
    Copy,
    Download,
    ExternalLink,
    MousePointerClick,
    TrendingUp,
    Users,
    Wand2,
  } from "@lucide/svelte"
  import { goto } from "$app/navigation"
  import {
    BreakdownBars,
    ChartCard,
    countryName,
    DonutChart,
    formatDateTime,
    formatDayLabel,
    formatNumber,
    formatScanMoment,
    HourHeatmap,
    normalizeCountryCode,
    QrPreview,
    RangeSelector,
    StatCard,
    statusBadgeVariant,
    statusLabel,
    TimeSeriesChart,
    type BreakdownItem,
    type HourBucket,
  } from "$lib/components/analytics"
  import { Badge } from "$lib/components/ui/badge"
  import { Button } from "$lib/components/ui/button"
  import { downloadBlob } from "$lib/qr/export"
  import { toast } from "svelte-sonner"

  import type { PageData } from "./$types"

  interface AnalyticsBucketLike {
    label: string
    value: number
    scans: number
    unique: number
  }

  const DEVICE_LABELS: Record<string, string> = {
    mobile: "Mobile",
    desktop: "Desktop",
    tablet: "Tablet",
    bot: "Bots",
    other: "Other",
  }

  let { data }: { data: PageData } = $props()

  const analytics = $derived(data.analytics)
  const qrCode = $derived(data.qrCode)
  const shortUrl = $derived(qrCode.shortCode ? `${data.origin}/${qrCode.shortCode}` : null)
  const rangeLabel = $derived(
    data.range === "all" ? "All time" : `Last ${data.range.replace("d", "")} days`,
  )

  const series = $derived(
    analytics.daily.map((day) => ({ date: day.date, scans: day.scans, unique: day.unique })),
  )

  const deviceSegments = $derived(
    analytics.devices.map((bucket) => ({
      label: DEVICE_LABELS[bucket.label.toLowerCase()] ?? bucket.label,
      value: bucket.value,
      secondary: bucket.unique,
    })),
  )

  const osItems = $derived<BreakdownItem[]>(toBreakdown(analytics.os))
  const browserItems = $derived<BreakdownItem[]>(toBreakdown(analytics.browsers))
  const referrerItems = $derived<BreakdownItem[]>(toBreakdown(analytics.referrers))

  const countryItems = $derived<BreakdownItem[]>(
    analytics.countries.map((bucket) => {
      const code = normalizeCountryCode(bucket.label)
      return {
        label: code ? countryName(code) : "Unknown",
        countryCode: code ?? undefined,
        value: bucket.value,
        secondary: bucket.unique,
      }
    }),
  )

  // Cities are an additive analytics field; render the card when the service provides them.
  const cityItems = $derived<BreakdownItem[]>(toBreakdown(analytics.cities ?? []))

  const hourBuckets = $derived<HourBucket[]>(
    analytics.hours.map((bucket) => ({ hour: bucket.hour, scans: bucket.scans })),
  )

  const rangeScansDisplay = $derived(formatNumber(analytics.rangeScans))

  const sinceLabel = $derived(
    analytics.since ? formatDateTime(analytics.since).split(",").slice(0, 2).join(",") : null,
  )

  const peakDay = $derived(
    analytics.daily.reduce(
      (best, point) => (point.scans > best.scans ? point : best),
      analytics.daily[0] ?? { date: "", scans: 0, unique: 0, uniqueScans: 0 },
    ),
  )

  function toBreakdown(buckets: AnalyticsBucketLike[]): BreakdownItem[] {
    return buckets.map((bucket) => ({
      label: bucket.label,
      value: bucket.value || bucket.scans,
      secondary: bucket.unique,
    }))
  }

  function copyShortUrl() {
    if (!shortUrl) return
    navigator.clipboard
      .writeText(shortUrl)
      .then(() => toast.success("Short link copied"))
      .catch(() => toast.error("Could not copy the short link"))
  }

  function exportAnalyticsCsv() {
    const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`
    const lines = ["date,scans,unique"]
    for (const day of analytics.daily) {
      lines.push([quote(day.date), day.scans, day.unique].join(","))
    }
    const filename = `analytics-${qrCode.shortCode ?? qrCode.id}.csv`
    downloadBlob(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), filename)
    toast.success("CSV exported")
  }

  function goBack() {
    goto("/dashboard")
  }
</script>

<div class="space-y-6">
  <nav class="flex items-center gap-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
    <a href="/dashboard" class="hover:text-foreground">Dashboard</a>
    <ChevronRight class="size-4" aria-hidden="true" />
    <span class="text-foreground">Analytics</span>
  </nav>

  <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div class="flex min-w-0 items-start gap-3">
      <Button variant="ghost" size="icon" onclick={goBack} aria-label="Back to dashboard">
        <ArrowLeft class="size-4" />
      </Button>
      <QrPreview
        qr={qrCode}
        design={data.design}
        origin={data.origin}
        size={192}
        class="hidden size-16 shrink-0 bg-white p-1.5 sm:flex"
      />
      <div class="min-w-0 space-y-1">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="truncate text-2xl font-bold tracking-tight md:text-3xl">
            {qrCode.title ?? qrCode.shortCode ?? "QR code"}
          </h1>
          <Badge variant={qrCode.type === "dynamic" ? "default" : "secondary"}>
            {qrCode.type}
          </Badge>
          <Badge variant={statusBadgeVariant(qrCode.status)}>{statusLabel(qrCode.status)}</Badge>
        </div>
        <p class="text-sm text-muted-foreground">
          Scan analytics · {rangeLabel}
          {#if sinceLabel}· since {sinceLabel}{/if}
        </p>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <RangeSelector
        value={data.range}
        hrefFor={(range) => `/dashboard/analytics/${qrCode.id}?range=${range}`}
      />
      <Button variant="outline" class="gap-2" onclick={exportAnalyticsCsv}>
        <Download class="size-4" />
        Export CSV
      </Button>
      <Button href={`/studio?edit=${qrCode.id}`} variant="outline" class="gap-2">
        <Wand2 class="size-4" />
        Customize
      </Button>
    </div>
  </div>

  {#if analytics.totalScans === 0}
    <div
      class="flex flex-col gap-3 rounded-xl border border-dashed bg-muted/40 p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="space-y-1">
        <p class="font-medium">No scans recorded yet</p>
        <p class="text-sm text-muted-foreground">
          Share the short link or download the QR code and place it where people can see it.
        </p>
      </div>
      {#if shortUrl}
        <div class="flex flex-wrap items-center gap-2">
          <code class="max-w-full truncate rounded-md border bg-background px-2 py-1 text-xs">
            {shortUrl}
          </code>
          <Button variant="outline" size="sm" onclick={copyShortUrl}>
            <Copy class="size-4" />
            Copy link
          </Button>
        </div>
      {/if}
    </div>
  {/if}

  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <StatCard
      label={`Scans · ${rangeLabel.toLowerCase()}`}
      value={rangeScansDisplay}
      hint={analytics.daily.length > 0
        ? `Peak ${formatDayLabel(peakDay.date)} · ${formatNumber(peakDay.scans)} scans`
        : "No scans in range"}
    >
      {#snippet icon()}<MousePointerClick class="size-5" />{/snippet}
    </StatCard>
    <StatCard
      label="All-time scans"
      value={formatNumber(analytics.totalScans)}
      hint={`${formatNumber(analytics.uniqueScans)} unique visitors`}
    >
      {#snippet icon()}<TrendingUp class="size-5" />{/snippet}
    </StatCard>
    <StatCard
      label="Unique · this range"
      value={formatNumber(analytics.rangeUniqueScans)}
      hint="One per visitor per day"
    >
      {#snippet icon()}<Users class="size-5" />{/snippet}
    </StatCard>
    <StatCard
      label="Last scan"
      value={analytics.lastScanAt ? formatScanMoment(analytics.lastScanAt) : "Never"}
      valueClass="text-base sm:text-lg"
      hint="All time"
    >
      {#snippet icon()}<Clock class="size-5" />{/snippet}
    </StatCard>
  </div>

  <ChartCard title="Scans over time" description={`Daily scans · ${rangeLabel.toLowerCase()}`}>
    <TimeSeriesChart
      data={series}
      variant="area"
      showUnique
      height={280}
      valueLabel="Scans"
      uniqueLabel="Unique"
      emptyLabel="No scans in this range yet."
    />
  </ChartCard>

  <div class="grid gap-6 lg:grid-cols-2">
    <ChartCard title="Devices" description="Which devices scanned this code">
      <DonutChart
        segments={deviceSegments}
        centerValue={formatNumber(analytics.rangeScans)}
        centerLabel="scans"
      />
    </ChartCard>

    <ChartCard title="Scans by hour" description="When people scan during the day">
      <HourHeatmap data={hourBuckets} />
    </ChartCard>

    <ChartCard title="Operating systems" description="Visitor OS breakdown">
      <BreakdownBars items={osItems} showPercent emptyLabel="No OS data yet." />
    </ChartCard>

    <ChartCard title="Browsers" description="Visitor browser breakdown">
      <BreakdownBars items={browserItems} showPercent emptyLabel="No browser data yet." />
    </ChartCard>

    <ChartCard title="Countries" description="Where scans come from">
      <BreakdownBars
        items={countryItems}
        maxItems={8}
        showPercent
        showSecondary
        emptyLabel="No country data yet."
      />
    </ChartCard>

    <ChartCard title="Referrers" description="Sites and apps that led to a scan">
      <BreakdownBars
        items={referrerItems}
        maxItems={8}
        showPercent
        emptyLabel="No referrer data yet."
      />
    </ChartCard>

    {#if cityItems.length > 0}
      <ChartCard title="Top cities" description="City-level scan locations">
        <BreakdownBars items={cityItems} maxItems={8} showPercent emptyLabel="No city data yet." />
      </ChartCard>
    {/if}
  </div>

  <div class="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
    <p>
      Lifetime totals come from scan counters; charts are built from scan events inside the selected
      range.
    </p>
    {#if shortUrl}
      <Button variant="ghost" size="sm" href={shortUrl} target="_blank" rel="noopener noreferrer">
        <ExternalLink class="size-4" />
        Open short link
      </Button>
    {/if}
  </div>
</div>
