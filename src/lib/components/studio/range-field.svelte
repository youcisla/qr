<script lang="ts">
  import { Slider } from "$lib/components/ui/slider"

  interface Props {
    id?: string
    label: string
    value: number
    min?: number
    max?: number
    step?: number
    format?: (value: number) => string
    hint?: string
    disabled?: boolean
    onchange: (value: number) => void
  }

  let {
    id,
    label,
    value,
    min = 0,
    max = 1,
    step = 0.01,
    format = (current) => current.toFixed(2),
    hint,
    disabled = false,
    onchange,
  }: Props = $props()
</script>

<div class="space-y-2">
  <div class="flex items-baseline justify-between gap-3">
    <label for={id} class="text-sm font-medium">{label}</label>
    <span class="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
      {format(value)}
    </span>
  </div>
  <Slider
    type="single"
    {value}
    {min}
    {max}
    {step}
    {disabled}
    {id}
    aria-label={label}
    onValueChange={(next: number) => onchange(next)}
  />
  {#if hint}
    <p class="text-xs text-muted-foreground">{hint}</p>
  {/if}
</div>
