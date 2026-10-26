<script lang="ts">
  import { LayoutGrid, Moon, Sun } from "@lucide/svelte"
  import { Badge } from "$lib/components/ui/badge"
  import type { ScanWarning } from "$lib/qr/types"
  import { cn } from "$lib/utils/style.js"

  interface Props {
    svg: string | null
    /** Design width in user units — used to keep non-square frames centred. */
    width: number
    height: number
    warnings?: ScanWarning[]
    info?: string[]
    example?: boolean
    dynamic?: boolean
    class?: string
  }

  let {
    svg,
    width = 1,
    height = 1,
    warnings = [],
    info = [],
    example = false,
    dynamic = false,
    class: className,
  }: Props = $props()

  type Stage = "light" | "dark" | "checker"

  let stage = $state<Stage>("light")

  const stageOptions: { value: Stage; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light background", icon: Sun },
    { value: "dark", label: "Dark background", icon: Moon },
    { value: "checker", label: "Transparency checkerboard", icon: LayoutGrid },
  ]

  const blocking = $derived(warnings.some((warning) => warning.level === "error"))
  const maxWidth = $derived(Math.round(296 * Math.min(1, width / Math.max(1, height))))
</script>

<div class={cn("overflow-hidden rounded-2xl border bg-card shadow-sm", className)}>
  <div class="flex items-center justify-between gap-3 border-b px-4 py-3">
    <div class="flex min-w-0 items-center gap-2">
      <span class="relative flex size-2 shrink-0">
        <span
          class="absolute inline-flex size-full animate-ping rounded-full opacity-60 {blocking
            ? 'bg-destructive'
            : 'bg-success'}"
        ></span>
        <span
          class="relative inline-flex size-2 rounded-full {blocking
            ? 'bg-destructive'
            : 'bg-success'}"
        ></span>
      </span>
      <span class="truncate text-sm font-semibold">Live preview</span>
      {#if example}
        <Badge variant="outline" size="sm">Example</Badge>
      {/if}
      {#if dynamic}
        <Badge variant="info" size="sm">Dynamic</Badge>
      {/if}
    </div>

    <div
      class="flex shrink-0 rounded-lg border bg-muted/50 p-0.5"
      role="radiogroup"
      aria-label="Preview background"
    >
      {#each stageOptions as option (option.value)}
        {@const StageIcon = option.icon}
        <button
          type="button"
          role="radio"
          aria-checked={stage === option.value}
          aria-label={option.label}
          title={option.label}
          class={cn(
            "flex size-6 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
            stage === option.value
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
          onclick={() => (stage = option.value)}
        >
          <StageIcon class="size-3.5" />
        </button>
      {/each}
    </div>
  </div>

  <div
    class={cn(
      "flex min-h-[240px] items-center justify-center p-4 transition-colors duration-200 sm:min-h-[296px] sm:p-6",
      stage === "dark" ? "bg-zinc-900" : stage === "checker" ? "stage-checker" : "bg-white",
    )}
  >
    {#if svg}
      <div class="qr-stage w-full" style={`max-width: ${maxWidth}px`}>
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html svg}
      </div>
    {:else}
      <div
        class="flex aspect-square w-full max-w-[260px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 text-zinc-400"
      >
        <span class="text-xs font-medium">Your QR code appears here</span>
      </div>
    {/if}
  </div>

  {#if info.length > 0 || dynamic}
    <div class="flex flex-wrap items-center gap-1.5 border-t px-4 py-2.5">
      {#each info as item, index (item + index)}
        <Badge variant="outline" size="sm" class="font-mono">{item}</Badge>
      {/each}
      {#if dynamic}
        <span class="ms-auto text-[11px] text-muted-foreground">
          Saved as a dynamic QR — the printed code points to a short link.
        </span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .qr-stage :global(svg) {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 0.5rem;
  }

  .stage-checker {
    background-color: #ffffff;
    background-image:
      linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
      linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
      linear-gradient(-45deg, transparent 75%, #e5e7eb 75%);
    background-size: 16px 16px;
    background-position:
      0 0,
      0 8px,
      8px -8px,
      -8px 0;
  }
</style>
