<script lang="ts">
  import { Plus, X } from "@lucide/svelte"
  import { Button } from "$lib/components/ui/button"
  import { Input } from "$lib/components/ui/input"
  import type { GradientStop, QrFill, QrGradient } from "$lib/qr/types"
  import { cn } from "$lib/utils/style.js"

  import ColorField from "./color-field.svelte"
  import { gradientCss, gradientPresets } from "./color-presets"
  import RangeField from "./range-field.svelte"

  interface Props {
    idPrefix: string
    label: string
    description?: string
    value: QrFill
    onchange: (value: QrFill) => void
    class?: string
  }

  let { idPrefix, label, description, value, onchange, class: className }: Props = $props()

  const isGradient = $derived(value.type === "gradient")
  const gradient = $derived(
    isGradient ? (value as { type: "gradient"; gradient: QrGradient }).gradient : null,
  )
  const stops = $derived(gradient?.stops ?? [])

  function setSolid(color: string) {
    onchange({ type: "solid", color })
  }

  function switchToGradient() {
    if (value.type === "gradient") return
    const preset = gradientPresets[0]
    onchange({
      type: "gradient",
      gradient: {
        type: "linear",
        angle: preset.angle,
        stops: preset.stops.map((stop) => ({ ...stop })),
      },
    })
  }

  function switchToSolid() {
    if (value.type === "solid") return
    const first = value.gradient.stops[0]?.color ?? "#0f172a"
    onchange({ type: "solid", color: first })
  }

  function updateGradient(next: QrGradient) {
    onchange({ type: "gradient", gradient: next })
  }

  function setStops(nextStops: GradientStop[]) {
    if (!gradient) return
    updateGradient({ ...gradient, stops: nextStops })
  }

  function updateStop(index: number, patch: Partial<GradientStop>) {
    setStops(stops.map((stop, position) => (position === index ? { ...stop, ...patch } : stop)))
  }

  function addStop() {
    if (stops.length >= 4) return
    const sorted = [...stops].sort((a, b) => a.offset - b.offset)
    const last = sorted[sorted.length - 1]
    const previous = sorted[sorted.length - 2] ?? sorted[0]
    setStops([
      ...stops,
      {
        color: last?.color ?? "#0f172a",
        offset: Math.min(1, ((last?.offset ?? 1) + (previous?.offset ?? 0)) / 2),
      },
    ])
  }

  function removeStop(index: number) {
    if (stops.length <= 2) return
    setStops(stops.filter((_, position) => position !== index))
  }

  function applyPreset(preset: (typeof gradientPresets)[number]) {
    updateGradient({
      type: "linear",
      angle: preset.angle,
      stops: preset.stops.map((stop) => ({ ...stop })),
    })
  }
</script>

<div class={cn("space-y-3", className)}>
  <div class="flex items-start justify-between gap-3">
    <div>
      <p class="text-sm font-medium">{label}</p>
      {#if description}
        <p class="text-xs text-muted-foreground">{description}</p>
      {/if}
    </div>
    <div
      class="flex shrink-0 rounded-lg border bg-muted/50 p-0.5"
      role="radiogroup"
      aria-label={`${label} mode`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={!isGradient}
        class={cn(
          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          !isGradient
            ? "bg-background text-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground",
        )}
        onclick={switchToSolid}>Solid</button
      >
      <button
        type="button"
        role="radio"
        aria-checked={isGradient}
        class={cn(
          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          isGradient
            ? "bg-background text-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground",
        )}
        onclick={switchToGradient}>Gradient</button
      >
    </div>
  </div>

  {#if value.type === "solid"}
    <ColorField
      id={`${idPrefix}-solid`}
      label="Colour"
      value={value.color}
      presets
      onchange={setSolid}
    />
    <div class="flex flex-wrap gap-1.5">
      {#each ["#0f172a", "#000000", "#4338ca", "#2563eb", "#0ea5e9", "#059669", "#d97706", "#dc2626", "#db2777", "#7c3aed", "#64748b", "#ffffff"] as swatch (swatch)}
        <button
          type="button"
          aria-label={`Use colour ${swatch}`}
          class="size-6 rounded-md border border-black/10 shadow-xs transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          style={`background: ${swatch}`}
          onclick={() => setSolid(swatch)}
        ></button>
      {/each}
    </div>
  {:else if gradient}
    <div class="space-y-3 rounded-xl border bg-muted/20 p-3">
      <div
        class="h-8 rounded-lg border border-black/10 shadow-inner"
        style={`background: ${gradientCss(gradient.stops, gradient.type === "linear" ? gradient.angle : 135)}`}
        aria-hidden="true"
      ></div>

      <div class="flex flex-wrap gap-1.5">
        {#each gradientPresets as preset (preset.name)}
          <button
            type="button"
            title={preset.name}
            aria-label={preset.name}
            class="h-6 w-10 rounded-md border border-black/10 shadow-xs transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            style={`background: ${gradientCss(preset.stops, preset.angle)}`}
            onclick={() => applyPreset(preset)}
          ></button>
        {/each}
      </div>

      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-medium text-muted-foreground">Type</span>
        <div
          class="flex rounded-md border bg-background p-0.5"
          role="radiogroup"
          aria-label="Gradient type"
        >
          {#each [{ value: "linear", label: "Linear" }, { value: "radial", label: "Radial" }] as option (option.value)}
            <button
              type="button"
              role="radio"
              aria-checked={gradient.type === option.value}
              class={cn(
                "rounded px-2 py-0.5 text-[11px] font-medium focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                gradient.type === option.value
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground",
              )}
              onclick={() => {
                if (option.value === "linear") {
                  updateGradient({
                    type: "linear",
                    angle: gradient.type === "linear" ? gradient.angle : 45,
                    stops: gradient.stops,
                  })
                } else {
                  updateGradient({ type: "radial", stops: gradient.stops })
                }
              }}
            >
              {option.label}
            </button>
          {/each}
        </div>
      </div>

      {#if gradient.type === "linear"}
        <RangeField
          id={`${idPrefix}-angle`}
          label="Angle"
          value={gradient.angle}
          min={0}
          max={360}
          step={5}
          format={(current) => `${Math.round(current)}°`}
          onchange={(angle) => updateGradient({ ...gradient, angle })}
        />
      {/if}

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-muted-foreground">Stops</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            class="gap-1"
            disabled={stops.length >= 4}
            onclick={addStop}
          >
            <Plus class="size-3" />
            Add stop
          </Button>
        </div>
        {#each stops as stop, index (index)}
          <div class="flex items-center gap-2">
            <span
              class="relative inline-flex size-6 shrink-0 overflow-hidden rounded-md border shadow-xs"
              style={`background: ${stop.color}`}
            >
              <input
                type="color"
                value={stop.color}
                aria-label={`Stop ${index + 1} colour`}
                class="absolute inset-0 size-full cursor-pointer opacity-0"
                oninput={(event) => updateStop(index, { color: event.currentTarget.value })}
              />
            </span>
            <Input
              type="text"
              value={stop.color}
              spellcheck={false}
              aria-label={`Stop ${index + 1} hex value`}
              class="h-7 w-24 font-mono text-[11px] uppercase"
              oninput={(event) => {
                const raw = event.currentTarget.value.trim()
                if (/^#[0-9a-f]{6}$/i.test(raw)) updateStop(index, { color: raw.toLowerCase() })
              }}
            />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={stop.offset}
              aria-label={`Stop ${index + 1} position`}
              class="h-1.5 flex-1 accent-primary"
              oninput={(event) => updateStop(index, { offset: Number(event.currentTarget.value) })}
            />
            <span class="w-8 text-right font-mono text-[11px] text-muted-foreground">
              {Math.round(stop.offset * 100)}%
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Remove stop ${index + 1}`}
              disabled={stops.length <= 2}
              onclick={() => removeStop(index)}
            >
              <X class="size-3" />
            </Button>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
