<script lang="ts">
  import { cn } from "$lib/utils/style"

  import { formatNumber, formatPercent } from "./format"
  import type { BreakdownItem } from "./types"

  interface Props {
    segments: BreakdownItem[]
    size?: number
    thickness?: number
    centerValue?: string
    centerLabel?: string
    showLegend?: boolean
    valueFormatter?: (value: number) => string
    emptyLabel?: string
    class?: string
  }

  const PALETTE = [
    { stroke: "stroke-chart-1", dot: "bg-chart-1" },
    { stroke: "stroke-chart-2", dot: "bg-chart-2" },
    { stroke: "stroke-chart-3", dot: "bg-chart-3" },
    { stroke: "stroke-chart-4", dot: "bg-chart-4" },
    { stroke: "stroke-chart-5", dot: "bg-chart-5" },
    { stroke: "stroke-chart-1/70", dot: "bg-chart-1/70" },
    { stroke: "stroke-chart-2/70", dot: "bg-chart-2/70" },
    { stroke: "stroke-chart-3/70", dot: "bg-chart-3/70" },
  ]

  let {
    segments,
    size = 168,
    thickness = 22,
    centerValue,
    centerLabel,
    showLegend = true,
    valueFormatter = formatNumber,
    emptyLabel = "No scan data yet.",
    class: className,
  }: Props = $props()

  const center = $derived(size / 2)
  const radius = $derived((size - thickness) / 2)
  const circumference = $derived(2 * Math.PI * radius)
  const total = $derived(segments.reduce((accumulator, segment) => accumulator + segment.value, 0))

  const arcs = $derived.by(() => {
    let offset = 0
    return segments
      .filter((segment) => segment.value > 0)
      .map((segment, index) => {
        const fraction = total > 0 ? segment.value / total : 0
        const length = fraction * circumference
        const arc = {
          label: segment.label,
          value: segment.value,
          length,
          offset,
          fraction,
          palette: PALETTE[index % PALETTE.length],
        }
        offset += length
        return arc
      })
  })
</script>

<div class={cn("flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6", className)}>
  <div class="relative shrink-0" style={`width: ${size}px; height: ${size}px`}>
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke-width={thickness}
        class="stroke-muted"
      />
      {#each arcs as arc (arc.label)}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke-width={thickness}
          class={arc.palette.stroke}
          stroke-dasharray={`${Math.max(arc.length - (arcs.length > 1 ? 1.5 : 0), 0.4)} ${circumference}`}
          stroke-dashoffset={-arc.offset}
          transform={`rotate(-90 ${center} ${center})`}
        >
          <title>{arc.label}: {valueFormatter(arc.value)} ({formatPercent(arc.value, total)})</title
          >
        </circle>
      {/each}
    </svg>

    {#if centerValue || centerLabel}
      <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {#if centerValue}
          <span class="text-2xl font-semibold tracking-tight tabular-nums">{centerValue}</span>
        {/if}
        {#if centerLabel}
          <span class="text-xs text-muted-foreground">{centerLabel}</span>
        {/if}
      </div>
    {/if}
  </div>

  {#if showLegend}
    <div class="min-w-0 flex-1">
      {#if total <= 0}
        <p class="text-sm text-muted-foreground">{emptyLabel}</p>
      {:else}
        <ul class="space-y-2">
          {#each segments as segment, index (segment.label)}
            <li class="flex items-center justify-between gap-3 text-sm">
              <span class="flex min-w-0 items-center gap-2">
                <span
                  class={cn("size-2.5 shrink-0 rounded-full", PALETTE[index % PALETTE.length].dot)}
                  aria-hidden="true"
                ></span>
                <span class="truncate">{segment.label}</span>
              </span>
              <span class="shrink-0 items-baseline gap-2 tabular-nums">
                <span class="font-medium">{valueFormatter(segment.value)}</span>
                <span class="ml-1.5 text-xs text-muted-foreground">
                  {formatPercent(segment.value, total)}
                </span>
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>
