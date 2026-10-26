<script lang="ts">
  import { Check } from "@lucide/svelte"
  import {
    CONTENT_CATEGORY_LABELS,
    contentTypeGroups,
    contentTypes,
    type QrContentCategory,
  } from "$lib/qr/content"
  import { cn } from "$lib/utils/style.js"

  import { contentIcon } from "./content-icons"

  interface Props {
    value: string
    onchange: (id: string) => void
    class?: string
  }

  let { value, onchange, class: className }: Props = $props()

  const groups = contentTypeGroups()

  let activeCategory = $state<"all" | QrContentCategory>("all")

  const visibleTypes = $derived(
    activeCategory === "all"
      ? contentTypes
      : contentTypes.filter((type) => type.category === activeCategory),
  )
</script>

<div class={cn("space-y-3", className)}>
  <div class="flex flex-wrap gap-1.5" role="tablist" aria-label="Content categories">
    <button
      type="button"
      role="tab"
      aria-selected={activeCategory === "all"}
      class={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        activeCategory === "all"
          ? "border-foreground/30 bg-foreground text-background"
          : "border-border bg-background/60 text-muted-foreground hover:text-foreground",
      )}
      onclick={() => (activeCategory = "all")}
    >
      All types
    </button>
    {#each groups as group (group.category)}
      <button
        type="button"
        role="tab"
        aria-selected={activeCategory === group.category}
        class={cn(
          "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          activeCategory === group.category
            ? "border-foreground/30 bg-foreground text-background"
            : "border-border bg-background/60 text-muted-foreground hover:text-foreground",
        )}
        onclick={() => (activeCategory = group.category)}
      >
        {CONTENT_CATEGORY_LABELS[group.category] ?? group.label}
      </button>
    {/each}
  </div>

  <div
    class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4"
    role="radiogroup"
    aria-label="QR content type"
  >
    {#each visibleTypes as type (type.id)}
      {@const Icon = contentIcon(type.icon)}
      {@const selected = value === type.id}
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onclick={() => onchange(type.id)}
        class={cn(
          "group relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
          "hover:border-foreground/25 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:outline-none",
          selected
            ? "border-foreground/50 bg-accent/50 shadow-xs ring-1 ring-foreground/10"
            : "border-border bg-background/60",
        )}
      >
        <span class="flex w-full items-center justify-between gap-2">
          <span
            class={cn(
              "flex size-7 items-center justify-center rounded-lg border",
              selected
                ? "border-foreground/20 bg-background text-foreground"
                : "border-border bg-muted/60 text-muted-foreground group-hover:text-foreground",
            )}
          >
            <Icon class="size-3.5" />
          </span>
          {#if selected}
            <span
              class="flex size-4 items-center justify-center rounded-full bg-foreground text-background"
            >
              <Check class="size-2.5" strokeWidth={3} />
            </span>
          {/if}
        </span>
        <span class="mt-1 text-xs leading-tight font-semibold">{type.name}</span>
        <span class="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {type.description}
        </span>
      </button>
    {/each}
  </div>
</div>
