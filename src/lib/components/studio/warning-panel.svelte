<script lang="ts">
  import { CircleX, Info, ShieldCheck, TriangleAlert } from "@lucide/svelte"
  import { Badge } from "$lib/components/ui/badge"
  import type { ScanWarning } from "$lib/qr/types"
  import { cn } from "$lib/utils/style.js"

  interface Props {
    warnings: ScanWarning[]
    class?: string
  }

  let { warnings, class: className }: Props = $props()

  const errors = $derived(warnings.filter((warning) => warning.level === "error"))
  const cautions = $derived(warnings.filter((warning) => warning.level === "warning"))
  const infos = $derived(warnings.filter((warning) => warning.level === "info"))

  const ordered = $derived([...errors, ...cautions, ...infos])

  const score = $derived(
    Math.max(
      0,
      Math.min(
        100,
        100 - errors.length * 34 - Math.max(0, cautions.length - 1) * 8 - infos.length * 2,
      ),
    ),
  )

  const tone = $derived(errors.length > 0 ? "danger" : cautions.length > 0 ? "caution" : "safe")

  const toneLabel = $derived(
    tone === "danger"
      ? "Fix before exporting"
      : tone === "caution"
        ? "Good, with notes"
        : "Ready to scan",
  )

  const barClass = $derived(
    tone === "danger" ? "bg-destructive" : tone === "caution" ? "bg-warning" : "bg-success",
  )
</script>

<div
  class={cn("rounded-xl border bg-card", className)}
  aria-live="polite"
  aria-label="Scanability check"
>
  <div class="flex items-center justify-between gap-3 border-b px-4 py-3">
    <div class="flex items-center gap-2">
      {#if tone === "danger"}
        <CircleX class="size-4 text-destructive" />
      {:else if tone === "caution"}
        <TriangleAlert class="size-4 text-warning-foreground" />
      {:else}
        <ShieldCheck class="size-4 text-success-foreground" />
      {/if}
      <span class="text-sm font-semibold">Scanability</span>
      <Badge
        variant={tone === "danger" ? "destructive" : tone === "caution" ? "warning" : "success"}
        size="sm"
      >
        {toneLabel}
      </Badge>
    </div>
    <span class="font-mono text-xs text-muted-foreground">{score}/100</span>
  </div>

  <div class="space-y-3 px-4 py-3">
    <div
      class="h-1.5 overflow-hidden rounded-full bg-muted"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-label="Scanability score"
    >
      <div
        class={cn("h-full rounded-full transition-all duration-300", barClass)}
        style={`width: ${score}%`}
      ></div>
    </div>

    {#if ordered.length === 0}
      <p class="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck class="mt-0.5 size-3.5 shrink-0 text-success-foreground" />
        All checks passed. This design should scan reliably across devices.
      </p>
    {:else}
      <ul class="space-y-2">
        {#each ordered as warning, index (warning.code + index)}
          <li class="flex items-start gap-2">
            {#if warning.level === "error"}
              <CircleX class="mt-0.5 size-3.5 shrink-0 text-destructive" />
            {:else if warning.level === "warning"}
              <TriangleAlert class="mt-0.5 size-3.5 shrink-0 text-warning-foreground" />
            {:else}
              <Info class="mt-0.5 size-3.5 shrink-0 text-info" />
            {/if}
            <p
              class={cn(
                "text-xs leading-relaxed",
                warning.level === "info" ? "text-muted-foreground" : "text-foreground/90",
              )}
            >
              {warning.message}
            </p>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
