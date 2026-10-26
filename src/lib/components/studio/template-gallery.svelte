<script lang="ts">
  import { Check, ChevronDown, ChevronUp, Sparkles } from "@lucide/svelte"
  import { renderQrSvg } from "$lib/qr/render"
  import { templateCategories, templates } from "$lib/qr/templates"
  import type { QrTemplate, QrTemplateCategory } from "$lib/qr/types"
  import { cn } from "$lib/utils/style.js"

  interface Props {
    selectedId: string | null
    onselect: (template: QrTemplate) => void
    class?: string
  }

  const sample = "https://yopem.com/studio"
  /** Keep the gallery short by default; the full set is one click away. */
  const COLLAPSED_COUNT = 8

  let { selectedId, onselect, class: className }: Props = $props()

  let activeCategory = $state<"all" | QrTemplateCategory>("all")
  let showAll = $state(false)

  const previews = templates.map((template) => {
    let svg = ""
    try {
      svg = renderQrSvg({ data: sample, design: template.design, size: 128 }).svg
    } catch {
      svg = ""
    }
    return { template, svg }
  })

  const filtered = $derived(
    activeCategory === "all"
      ? previews
      : previews.filter((preview) => preview.template.category === activeCategory),
  )

  const visiblePreviews = $derived(
    activeCategory === "all" && !showAll ? filtered.slice(0, COLLAPSED_COUNT) : filtered,
  )

  const hiddenCount = $derived(filtered.length - visiblePreviews.length)

  function selectCategory(category: "all" | QrTemplateCategory) {
    activeCategory = category
    showAll = false
  }
</script>

<div class={cn("space-y-3", className)}>
  <div class="flex flex-wrap gap-1.5" role="tablist" aria-label="Template categories">
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
      onclick={() => selectCategory("all")}
    >
      All
    </button>
    {#each templateCategories as category (category.id)}
      <button
        type="button"
        role="tab"
        aria-selected={activeCategory === category.id}
        class={cn(
          "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          activeCategory === category.id
            ? "border-foreground/30 bg-foreground text-background"
            : "border-border bg-background/60 text-muted-foreground hover:text-foreground",
        )}
        onclick={() => selectCategory(category.id)}
      >
        {category.label}
      </button>
    {/each}
  </div>

  <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
    {#each visiblePreviews as preview (preview.template.id)}
      {@const template = preview.template}
      {@const selected = selectedId === template.id}
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`${template.name}: ${template.description}`}
        title={template.description}
        onclick={() => onselect(template)}
        class={cn(
          "group relative overflow-hidden rounded-xl border bg-background/60 text-left transition-all",
          "hover:border-foreground/25 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:outline-none",
          selected ? "border-foreground/50 ring-1 ring-foreground/20" : "border-border",
        )}
      >
        <span class="flex h-20 w-full items-center justify-center bg-white p-1.5 sm:h-24">
          {#if preview.svg}
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            <span class="template-thumb">{@html preview.svg}</span>
          {/if}
        </span>
        <span class="flex items-center justify-between gap-1 px-2 py-1.5">
          <span class="min-w-0">
            <span class="block truncate text-[11px] leading-tight font-semibold">
              {template.name}
            </span>
            <span class="block truncate text-[10px] text-muted-foreground">
              {template.category}
            </span>
          </span>
          {#if selected}
            <span
              class="flex size-4 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
            >
              <Check class="size-2.5" strokeWidth={3} />
            </span>
          {/if}
        </span>
      </button>
    {/each}
  </div>

  {#if hiddenCount > 0}
    <button
      type="button"
      class="flex w-full items-center justify-center gap-1.5 rounded-lg border bg-background/60 px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      onclick={() => (showAll = true)}
    >
      <ChevronDown class="size-3.5" />
      Show all {filtered.length} templates
    </button>
  {:else if activeCategory === "all" && showAll}
    <button
      type="button"
      class="flex w-full items-center justify-center gap-1.5 rounded-lg border bg-background/60 px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      onclick={() => (showAll = false)}
    >
      <ChevronUp class="size-3.5" />
      Show fewer templates
    </button>
  {/if}

  <p class="flex items-start gap-1.5 text-[11px] text-muted-foreground">
    <Sparkles class="mt-0.5 size-3 shrink-0" />
    Templates set the shape, colours and frame. Your content stays exactly as typed.
  </p>
</div>

<style>
  .template-thumb {
    display: flex;
    height: 100%;
    max-width: 100%;
    align-items: center;
    justify-content: center;
  }

  .template-thumb :global(svg) {
    display: block;
    width: auto;
    height: 100%;
    max-width: 100%;
  }
</style>
