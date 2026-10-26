<script lang="ts">
  import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/select"
  import type {
    DotStyle,
    ErrorCorrectionLevel,
    EyeBallStyle,
    EyeFrameStyle,
    QrDesign,
  } from "$lib/qr/types"

  import {
    dotStyleOptions,
    errorCorrectionOptions,
    eyeBallOptions,
    eyeFrameOptions,
  } from "./design-options"
  import OptionGrid from "./option-grid.svelte"
  import RangeField from "./range-field.svelte"
  import StyleSwatch from "./style-swatch.svelte"

  interface Props {
    design: QrDesign
    onDesignChange: (patch: Partial<QrDesign>) => void
  }

  let { design, onDesignChange }: Props = $props()

  const selectedErrorCorrection = $derived(
    errorCorrectionOptions.find((option) => option.value === design.errorCorrection),
  )
</script>

<div class="space-y-6">
  <OptionGrid
    label="Module style"
    description="How each dark module is drawn"
    columns={5}
    options={dotStyleOptions}
    value={design.dotStyle}
    onchange={(value) => onDesignChange({ dotStyle: value as DotStyle })}
  >
    {#snippet children(option)}
      <StyleSwatch kind="dot" name={option.value} class="size-7" />
    {/snippet}
  </OptionGrid>

  <RangeField
    id="studio-module-gap"
    label="Module spacing"
    value={design.moduleGap}
    min={0}
    max={0.4}
    step={0.01}
    format={(value) => `${Math.round(value * 100)}%`}
    hint="A small gap makes dotted styles breathe. Above 20% scanning gets harder."
    onchange={(value) => onDesignChange({ moduleGap: value })}
  />

  <div class="grid gap-6 sm:grid-cols-2">
    <OptionGrid
      label="Eye frame"
      columns={3}
      options={eyeFrameOptions}
      value={design.eyeFrameStyle}
      onchange={(value) => onDesignChange({ eyeFrameStyle: value as EyeFrameStyle })}
    >
      {#snippet children(option)}
        <StyleSwatch kind="frame" name={option.value} class="size-7" />
      {/snippet}
    </OptionGrid>

    <OptionGrid
      label="Eye ball"
      columns={3}
      options={eyeBallOptions}
      value={design.eyeBallStyle}
      onchange={(value) => onDesignChange({ eyeBallStyle: value as EyeBallStyle })}
    >
      {#snippet children(option)}
        <StyleSwatch kind="ball" name={option.value} class="size-6" />
      {/snippet}
    </OptionGrid>
  </div>

  <RangeField
    id="studio-quiet-zone"
    label="Quiet zone"
    value={design.quietZone}
    min={0}
    max={8}
    step={1}
    format={(value) => `${value} modules`}
    hint="Keep at least 4 modules so scanners can isolate the code."
    onchange={(value) => onDesignChange({ quietZone: value })}
  />

  <div class="space-y-2">
    <label for="studio-error-correction" class="text-sm font-medium">Error correction</label>
    <Select
      type="single"
      value={design.errorCorrection}
      onValueChange={(value) => {
        if (value) onDesignChange({ errorCorrection: value as ErrorCorrectionLevel })
      }}
    >
      <SelectTrigger id="studio-error-correction" class="w-full">
        <span>{selectedErrorCorrection?.label ?? design.errorCorrection}</span>
      </SelectTrigger>
      <SelectContent>
        {#each errorCorrectionOptions as option (option.value)}
          <SelectItem value={option.value}>
            <div class="flex flex-col">
              <span>{option.label} · recovers {option.recovery}</span>
              <span class="text-xs text-muted-foreground">{option.hint}</span>
            </div>
          </SelectItem>
        {/each}
      </SelectContent>
    </Select>
    <p class="text-xs text-muted-foreground">
      Higher levels survive smudges and logos but make the code denser.
      {#if design.logo}
        With a logo, H is strongly recommended.
      {/if}
    </p>
  </div>
</div>
