<script lang="ts">
  import { cn } from "$lib/utils/style.js"
  import type { Snippet } from "svelte"

  import type { StyleOption } from "./design-options"

  interface Props {
    options: StyleOption[]
    value: string
    label?: string
    description?: string
    columns?: 2 | 3 | 4 | 5 | 6
    onchange: (value: string) => void
    children?: Snippet<[StyleOption]>
    class?: string
  }

  let {
    options,
    value,
    label,
    description,
    columns = 5,
    onchange,
    children,
    class: className,
  }: Props = $props()

  const columnClass = $derived(
    {
      2: "grid-cols-2",
      3: "grid-cols-3",
      4: "grid-cols-4",
      5: "grid-cols-5",
      6: "grid-cols-3 sm:grid-cols-6",
    }[columns],
  )
</script>

<div class={cn("space-y-2", className)}>
  {#if label}
    <div class="flex items-baseline justify-between gap-2">
      <p class="text-sm font-medium">{label}</p>
      {#if description}
        <p class="text-xs text-muted-foreground">{description}</p>
      {/if}
    </div>
  {/if}
  <div class={cn("grid gap-2", columnClass)} role="radiogroup" aria-label={label}>
    {#each options as option (option.value)}
      {@const selected = value === option.value}
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={option.label}
        title={option.hint ?? option.label}
        onclick={() => onchange(option.value)}
        class={cn(
          "group flex flex-col items-center gap-1.5 rounded-xl border bg-background/60 p-2 transition-all",
          "hover:border-foreground/25 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:outline-none",
          selected
            ? "border-foreground/60 bg-accent/60 shadow-xs ring-1 ring-foreground/10"
            : "border-border",
        )}
      >
        <span
          class={cn(
            "flex size-9 items-center justify-center rounded-lg transition-colors",
            selected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
          )}
        >
          {@render children?.(option)}
        </span>
        <span
          class={cn(
            "text-[11px] leading-none font-medium tracking-tight",
            selected ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {option.label}
        </span>
      </button>
    {/each}
  </div>
</div>
