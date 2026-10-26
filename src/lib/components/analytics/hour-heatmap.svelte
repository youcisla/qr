<script lang="ts">
  import { SvelteMap } from "svelte/reactivity"

  import { cn } from "$lib/utils/style"

  import { formatHour, formatNumber } from "./format"
  import type { HourBucket } from "./types"

  interface Props {
    data: HourBucket[]
    class?: string
  }

  const LEVEL_CLASSES = [
    "bg-muted/70",
    "bg-chart-1/25",
    "bg-chart-1/45",
    "bg-chart-1/70",
    "bg-chart-1",
  ]

  let { data, class: className }: Props = $props()

  const buckets = $derived.by(() => {
    const byHour = new SvelteMap<number, number>()
    for (const bucket of data) {
      const hour = Math.trunc(bucket.hour)
      if (hour < 0 || hour > 23) continue
      byHour.set(hour, (byHour.get(hour) ?? 0) + bucket.scans)
    }
    return Array.from({ length: 24 }, (_, hour) => ({ hour, scans: byHour.get(hour) ?? 0 }))
  })

  const maxScans = $derived(Math.max(...buckets.map((bucket) => bucket.scans), 0))
  const peak = $derived(
    buckets.reduce(
      (best, bucket) => (bucket.scans > best.scans ? bucket : best),
      buckets[0] ?? { hour: 0, scans: 0 },
    ),
  )

  function levelFor(scans: number): number {
    if (scans <= 0 || maxScans <= 0) return 0
    return Math.max(1, Math.min(4, Math.ceil((scans / maxScans) * 4)))
  }
</script>

<div class={cn("space-y-2.5", className)}>
  <ol
    class="grid grid-cols-[repeat(12,minmax(0,1fr))] gap-1 sm:grid-cols-[repeat(24,minmax(0,1fr))]"
  >
    {#each buckets as bucket (bucket.hour)}
      <li
        class={cn(
          "relative aspect-square w-full rounded-[4px] transition-colors",
          LEVEL_CLASSES[levelFor(bucket.scans)],
        )}
        title={`${formatHour(bucket.hour)} — ${formatNumber(bucket.scans)} scans`}
      >
        <span class="sr-only">{formatHour(bucket.hour)}: {formatNumber(bucket.scans)} scans</span>
      </li>
    {/each}
  </ol>

  <div
    class="flex items-center justify-between text-[11px] text-muted-foreground"
    aria-hidden="true"
  >
    <span>12 AM</span>
    <span class="hidden sm:inline">6 AM</span>
    <span>12 PM</span>
    <span class="hidden sm:inline">6 PM</span>
    <span>11 PM</span>
  </div>

  <div class="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
    <span class="tabular-nums">
      {#if maxScans > 0}
        Peak: {formatHour(peak.hour)} · {formatNumber(peak.scans)} scans
      {:else}
        No scans in this range yet
      {/if}
    </span>
    <span class="flex items-center gap-1" aria-hidden="true">
      <span>Fewer</span>
      {#each LEVEL_CLASSES as levelClass (levelClass)}
        <span class={cn("size-2.5 rounded-[2px]", levelClass)}></span>
      {/each}
      <span>More</span>
    </span>
  </div>
</div>
