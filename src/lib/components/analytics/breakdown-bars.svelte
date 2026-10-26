<script lang="ts">
  import { cn } from "$lib/utils/style"

  import { countryFlag } from "./country"
  import { formatNumber, formatPercent } from "./format"
  import type { BreakdownItem } from "./types"

  interface Props {
    items: BreakdownItem[]
    /** Denominators for percentages; defaults to the sum of all items. */
    total?: number
    maxItems?: number
    showPercent?: boolean
    /** Also render `secondary` values in parentheses (e.g. unique scans). */
    showSecondary?: boolean
    valueFormatter?: (value: number) => string
    emptyLabel?: string
    barClass?: string
    class?: string
  }

  let {
    items,
    total,
    maxItems = 6,
    showPercent = true,
    showSecondary = false,
    valueFormatter = formatNumber,
    emptyLabel = "No data for this range yet.",
    barClass,
    class: className,
  }: Props = $props()

  const visibleItems = $derived(
    [...items].sort((a, b) => b.value - a.value).slice(0, Math.max(maxItems, 1)),
  )
  const computedTotal = $derived(
    total ?? items.reduce((accumulator, item) => accumulator + item.value, 0),
  )
  const maxValue = $derived(Math.max(...visibleItems.map((item) => item.value), 0))
</script>

{#if visibleItems.length === 0 || computedTotal <= 0}
  <p class="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
{:else}
  <ul class={cn("space-y-3.5", className)}>
    {#each visibleItems as item (item.label)}
      <li class="space-y-1.5">
        <div class="flex items-baseline justify-between gap-3 text-sm">
          <span class="flex min-w-0 items-center gap-1.5">
            {#if item.countryCode}
              <span aria-hidden="true">{countryFlag(item.countryCode)}</span>
            {/if}
            <span class="truncate">{item.label}</span>
          </span>
          <span class="flex shrink-0 items-baseline gap-2 tabular-nums">
            {#if showSecondary && item.secondary !== undefined}
              <span class="text-xs text-muted-foreground"
                >{formatNumber(item.secondary)} unique</span
              >
            {/if}
            {#if showPercent}
              <span class="text-xs text-muted-foreground">
                {formatPercent(item.value, computedTotal)}
              </span>
            {/if}
            <span class="font-medium">{valueFormatter(item.value)}</span>
          </span>
        </div>
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div
            class={cn("h-full rounded-full bg-chart-1", barClass)}
            style={`width: ${maxValue > 0 ? Math.max((item.value / maxValue) * 100, item.value > 0 ? 2 : 0) : 0}%`}
          ></div>
        </div>
      </li>
    {/each}
  </ul>
{/if}
