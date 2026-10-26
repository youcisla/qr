<script lang="ts">
  import { cn } from "$lib/utils/style"

  import { formatDayLabel, formatNumber, niceScale } from "./format"
  import type { TimeSeriesPoint } from "./types"

  interface Props {
    data: TimeSeriesPoint[]
    /** Height of the drawing area in CSS pixels; the chart scales to its container width. */
    height?: number
    variant?: "area" | "line" | "bar"
    /** Overlay the unique-scan series (only when the data provides it). */
    showUnique?: boolean
    valueLabel?: string
    uniqueLabel?: string
    emptyLabel?: string
    class?: string
  }

  const WIDTH = 720
  const PADDING = { top: 16, right: 16, bottom: 30, left: 48 }

  let {
    data,
    height = 240,
    variant = "area",
    showUnique = false,
    valueLabel = "Scans",
    uniqueLabel = "Unique",
    emptyLabel = "No scans in this range yet.",
    class: className,
  }: Props = $props()

  const round = (value: number) => Math.round(value * 100) / 100
  const innerWidth = $derived(WIDTH - PADDING.left - PADDING.right)
  const innerHeight = $derived(Math.max(height - PADDING.top - PADDING.bottom, 40))
  const baselineY = $derived(PADDING.top + innerHeight)
  const total = $derived(data.reduce((accumulator, point) => accumulator + point.scans, 0))
  const hasUnique = $derived(showUnique && data.some((point) => typeof point.unique === "number"))
  const scale = $derived(
    niceScale(Math.max(...data.map((point) => Math.max(point.scans, point.unique ?? 0)), 0), 4),
  )

  function yFor(value: number): number {
    return PADDING.top + innerHeight - (value / scale.max) * innerHeight
  }

  const points = $derived.by(() => {
    const slotWidth = innerWidth / Math.max(data.length, 1)
    return data.map((point, index) => ({
      date: point.date,
      scans: point.scans,
      unique: point.unique,
      index,
      label: formatDayLabel(point.date),
      x: PADDING.left + (index + 0.5) * slotWidth,
      y: yFor(point.scans),
      uniqueY: typeof point.unique === "number" ? yFor(point.unique) : null,
      slotX: PADDING.left + index * slotWidth,
      slotWidth,
    }))
  })

  const barWidth = $derived(
    variant === "bar" ? Math.max(2, (innerWidth / Math.max(data.length, 1)) * 0.62) : 0,
  )

  const linePath = $derived(
    points
      .map((point, index) => `${index === 0 ? "M" : "L"}${round(point.x)},${round(point.y)}`)
      .join(" "),
  )

  const areaPath = $derived.by(() => {
    const first = points[0]
    const last = points[points.length - 1]
    if (!first || !last) return ""
    return `${linePath} L${round(last.x)},${round(baselineY)} L${round(first.x)},${round(baselineY)} Z`
  })

  const uniquePath = $derived(
    hasUnique
      ? points
          .map(
            (point, index) =>
              `${index === 0 ? "M" : "L"}${round(point.x)},${round(point.uniqueY ?? baselineY)}`,
          )
          .join(" ")
      : "",
  )

  const xLabelIndexes = $derived.by(() => {
    const count = points.length
    if (count === 0) return []
    if (count <= 8) return points.map((_, index) => index)
    const step = Math.max(1, Math.ceil(count / 6))
    const indexes: number[] = []
    for (let index = 0; index < count; index += step) indexes.push(index)
    if (indexes[indexes.length - 1] !== count - 1) indexes.push(count - 1)
    return indexes
  })

  let hoverIndex = $state<number | null>(null)
  const hovered = $derived(hoverIndex === null ? null : (points[hoverIndex] ?? null))
  const tooltipLeft = $derived(hovered ? Math.min(Math.max((hovered.x / WIDTH) * 100, 12), 88) : 50)
  const tooltipTop = $derived(
    hovered
      ? Math.max(
          (Math.min(hovered.y, hovered.uniqueY ?? hovered.y) / Math.max(height, 1)) * 100,
          20,
        )
      : 0,
  )

  const isEmpty = $derived(data.length === 0 || total === 0)
</script>

<figure class={cn("w-full", className)}>
  <figcaption class="sr-only">
    {valueLabel} per day.
    {#if hasUnique}
      Dashed line shows {uniqueLabel.toLowerCase()} scans.
    {/if}
  </figcaption>

  {#if isEmpty}
    <div
      class="flex items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4"
      style={`height: ${height}px`}
    >
      <p class="text-center text-sm text-muted-foreground">{emptyLabel}</p>
    </div>
  {:else}
    <div class="relative" onpointerleave={() => (hoverIndex = null)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        class="h-auto w-full"
        aria-hidden="true"
        focusable="false"
      >
        {#each scale.ticks as tick (tick)}
          {@const tickY = yFor(tick)}
          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={tickY}
            y2={tickY}
            class="stroke-border"
            stroke-dasharray="2 4"
          />
          <text
            x={PADDING.left - 10}
            y={tickY + 3}
            text-anchor="end"
            class="fill-muted-foreground text-[10px] tabular-nums"
          >
            {formatNumber(tick)}
          </text>
        {/each}

        {#if variant === "area"}
          <path d={areaPath} class="fill-chart-1/12" />
        {/if}

        {#if variant !== "bar"}
          <path
            d={linePath}
            fill="none"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
            class="stroke-chart-1"
          />
          {#if hasUnique}
            <path
              d={uniquePath}
              fill="none"
              stroke-width="2"
              stroke-linecap="round"
              stroke-dasharray="5 4"
              class="stroke-chart-2"
            />
          {/if}
        {:else}
          {#each points as point (point.date)}
            <rect
              x={point.x - barWidth / 2}
              y={point.y}
              width={barWidth}
              height={Math.max(baselineY - point.y, 0)}
              rx="3"
              class={hoverIndex === point.index ? "fill-chart-1" : "fill-chart-1/75"}
            >
              <title>{point.label}: {formatNumber(point.scans)} {valueLabel.toLowerCase()}</title>
            </rect>
          {/each}
        {/if}

        {#if hovered && variant !== "bar"}
          <line
            x1={hovered.x}
            x2={hovered.x}
            y1={PADDING.top}
            y2={baselineY}
            class="stroke-border"
            stroke-dasharray="3 3"
          />
          <circle
            cx={hovered.x}
            cy={hovered.y}
            r="4"
            stroke-width="2"
            class="fill-chart-1 stroke-background"
          />
          {#if hasUnique && hovered.uniqueY !== null}
            <circle
              cx={hovered.x}
              cy={hovered.uniqueY}
              r="4"
              stroke-width="2"
              class="fill-chart-2 stroke-background"
            />
          {/if}
        {/if}

        {#each points as point (point.date)}
          <text
            x={point.x}
            y={height - 8}
            text-anchor="middle"
            class="fill-muted-foreground text-[10px]"
          >
            {#if xLabelIndexes.includes(point.index)}
              {point.label}
            {/if}
          </text>
        {/each}

        {#each points as point (point.date)}
          <rect
            x={point.slotX}
            y={PADDING.top}
            width={point.slotWidth}
            height={innerHeight}
            fill="transparent"
            role="presentation"
            onpointerenter={() => (hoverIndex = point.index)}
          />
        {/each}
      </svg>

      {#if hovered}
        <div
          class="pointer-events-none absolute z-10"
          style={`left: ${tooltipLeft}%; top: ${tooltipTop}%`}
        >
          <div
            class="min-w-28 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border bg-popover px-3 py-2 text-xs shadow-md"
          >
            <p class="mb-1 font-medium">{hovered.label}</p>
            <p class="flex items-center justify-between gap-3">
              <span class="flex items-center gap-1.5 text-muted-foreground">
                <span class="size-2 rounded-full bg-chart-1" aria-hidden="true"></span>
                {valueLabel}
              </span>
              <span class="font-medium tabular-nums">{formatNumber(hovered.scans)}</span>
            </p>
            {#if hasUnique && hovered.unique !== undefined}
              <p class="flex items-center justify-between gap-3">
                <span class="flex items-center gap-1.5 text-muted-foreground">
                  <span class="size-2 rounded-full bg-chart-2" aria-hidden="true"></span>
                  {uniqueLabel}
                </span>
                <span class="font-medium tabular-nums">{formatNumber(hovered.unique)}</span>
              </p>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <table class="sr-only">
    <caption>{valueLabel} per day</caption>
    <thead>
      <tr>
        <th scope="col">Date</th>
        <th scope="col">{valueLabel}</th>
        {#if hasUnique}
          <th scope="col">{uniqueLabel}</th>
        {/if}
      </tr>
    </thead>
    <tbody>
      {#each data as point (point.date)}
        <tr>
          <td>{formatDayLabel(point.date)}</td>
          <td>{formatNumber(point.scans)}</td>
          {#if hasUnique}
            <td>{formatNumber(point.unique ?? 0)}</td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
</figure>
