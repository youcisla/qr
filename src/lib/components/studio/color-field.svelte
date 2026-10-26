<script lang="ts">
  import { Input } from "$lib/components/ui/input"
  import { cn } from "$lib/utils/style.js"

  import { solidColorPresets } from "./color-presets"

  interface Props {
    id?: string
    label: string
    value: string
    onchange: (value: string) => void
    presets?: boolean
    disabled?: boolean
    class?: string
  }

  let {
    id,
    label,
    value,
    onchange,
    presets = false,
    disabled = false,
    class: className,
  }: Props = $props()

  let text = $state(value)
  let invalid = $state(false)

  $effect(() => {
    if (value !== text && !invalid) text = value
  })

  function commitHex(raw: string) {
    const normalized = raw.trim().replace(/^#/, "")
    if (/^[0-9a-f]{3}$/i.test(normalized)) {
      const expanded = normalized
        .split("")
        .map((char) => char + char)
        .join("")
      text = `#${expanded.toLowerCase()}`
      invalid = false
      onchange(text)
      return
    }
    if (/^[0-9a-f]{6}$/i.test(normalized)) {
      text = `#${normalized.toLowerCase()}`
      invalid = false
      onchange(text)
      return
    }
    invalid = raw.trim().length === 0 ? false : true
  }
</script>

<div class={cn("space-y-2", className)}>
  <label for={id} class="text-sm font-medium">{label}</label>
  <div class="flex items-center gap-2">
    <span
      class="relative inline-flex size-9 shrink-0 overflow-hidden rounded-lg border shadow-xs"
      style={`background: ${value}`}
    >
      <input
        {id}
        type="color"
        {disabled}
        {value}
        aria-label={`${label} picker`}
        class="absolute inset-0 size-full cursor-pointer opacity-0"
        oninput={(event) => {
          const next = event.currentTarget.value
          text = next
          invalid = false
          onchange(next)
        }}
      />
    </span>
    <Input
      type="text"
      value={text}
      {disabled}
      aria-label={`${label} hex value`}
      aria-invalid={invalid}
      spellcheck={false}
      class="h-9 font-mono text-xs uppercase"
      oninput={(event) => commitHex(event.currentTarget.value)}
      onblur={() => {
        if (invalid) {
          text = value
          invalid = false
        }
      }}
    />
    {#if presets}
      <div class="flex flex-wrap justify-end gap-1">
        {#each solidColorPresets.slice(0, 10) as preset (preset.value)}
          <button
            type="button"
            {disabled}
            title={preset.name}
            aria-label={`Use ${preset.name}`}
            class="size-4 rounded-full border border-black/10 transition-transform hover:scale-125 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            style={`background: ${preset.value}`}
            onclick={() => {
              text = preset.value
              invalid = false
              onchange(preset.value)
            }}
          ></button>
        {/each}
      </div>
    {/if}
  </div>
</div>
