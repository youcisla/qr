<script lang="ts">
  import { cn } from "$lib/utils/style"

  import { RANGE_OPTIONS, type AnalyticsRange } from "./types"

  interface Props {
    value: AnalyticsRange
    /** Builds the href for a given range (keeps the page SSR-friendly). */
    hrefFor: (range: AnalyticsRange) => string
    options?: { value: AnalyticsRange; label: string }[]
    label?: string
    class?: string
  }

  let {
    value,
    hrefFor,
    options = RANGE_OPTIONS,
    label = "Analytics date range",
    class: className,
  }: Props = $props()
</script>

<nav
  aria-label={label}
  class={cn("inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1", className)}
>
  {#each options as option (option.value)}
    <a
      href={hrefFor(option.value)}
      aria-current={option.value === value ? "page" : undefined}
      class={cn(
        "rounded-md px-2.5 py-1 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        option.value === value
          ? "bg-background text-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {option.label}
    </a>
  {/each}
</nav>
