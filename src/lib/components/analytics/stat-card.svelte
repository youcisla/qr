<script lang="ts">
  import { TrendingDown, TrendingUp } from "@lucide/svelte"
  import { Card, CardContent } from "$lib/components/ui/card"
  import { cn } from "$lib/utils/style"
  import type { Snippet } from "svelte"

  import { formatNumber, formatPercentChange } from "./format"

  interface Props {
    label: string
    value: string | number
    /** Short supporting caption shown under the value. */
    hint?: string
    /** Decorative icon; rendered inside a muted tile. */
    icon?: Snippet
    /** Optional period-over-period change, in percent. */
    trend?: { value: number; label?: string } | null
    /** Makes the whole card a link. */
    href?: string
    /** Override the value typography (long values such as timestamps). */
    valueClass?: string
    class?: string
  }

  let {
    label,
    value,
    hint,
    icon,
    trend = null,
    href,
    valueClass,
    class: className,
  }: Props = $props()

  const displayValue = $derived(typeof value === "number" ? formatNumber(value) : value)
  const isPositive = $derived((trend?.value ?? 0) >= 0)
</script>

{#snippet body()}
  <Card class={cn("h-full gap-0 py-5", className)}>
    <CardContent class="flex items-start justify-between gap-4">
      <div class="min-w-0 space-y-1">
        <p class="text-sm font-medium text-muted-foreground">{label}</p>
        <p class={cn("text-2xl font-semibold tracking-tight tabular-nums", valueClass)}>
          {displayValue}
        </p>
        {#if trend}
          <p
            class={cn(
              "flex items-center gap-1 text-xs font-medium",
              isPositive ? "text-success-foreground" : "text-destructive-foreground",
            )}
          >
            {#if isPositive}
              <TrendingUp class="size-3.5" aria-hidden="true" />
            {:else}
              <TrendingDown class="size-3.5" aria-hidden="true" />
            {/if}
            <span class="tabular-nums">{formatPercentChange(trend.value)}</span>
            {#if trend.label}
              <span class="font-normal text-muted-foreground">{trend.label}</span>
            {/if}
          </p>
        {/if}
        {#if hint}
          <p class="text-xs text-muted-foreground">{hint}</p>
        {/if}
      </div>
      {#if icon}
        <div class="shrink-0 rounded-xl border bg-muted/50 p-2.5 text-muted-foreground">
          {@render icon()}
        </div>
      {/if}
    </CardContent>
  </Card>
{/snippet}

{#if href}
  <a
    {href}
    class="block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
  >
    {@render body()}
  </a>
{:else}
  {@render body()}
{/if}
