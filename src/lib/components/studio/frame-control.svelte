<script lang="ts">
  import { Input } from "$lib/components/ui/input"
  import { Switch } from "$lib/components/ui/switch"
  import type { QrFrameOptions, QrFrameStyle } from "$lib/qr/types"

  import ColorField from "./color-field.svelte"
  import OptionGrid from "./option-grid.svelte"
  import RangeField from "./range-field.svelte"

  interface Props {
    frame: QrFrameOptions | null
    onchange: (frame: QrFrameOptions | null) => void
  }

  let { frame, onchange }: Props = $props()

  const defaultFrame: QrFrameOptions = {
    style: "banner",
    label: "SCAN ME",
    labelColor: "#ffffff",
    frameColor: "#0f172a",
    backgroundColor: "#ffffff",
    fontSize: 0.075,
  }

  const options: { value: QrFrameStyle; label: string }[] = [
    { value: "simple", label: "Simple" },
    { value: "rounded", label: "Card" },
    { value: "banner", label: "Banner" },
    { value: "top", label: "Top bar" },
    { value: "badge", label: "Badge" },
    { value: "ticket", label: "Ticket" },
    { value: "double", label: "Double" },
  ]
</script>

<div class="space-y-5">
  <div class="flex items-center justify-between gap-3">
    <div>
      <p class="text-sm font-medium">Frame &amp; caption</p>
      <p class="text-xs text-muted-foreground">
        Wrap the QR in a card, banner, badge or ticket with a short call to action.
      </p>
    </div>
    <Switch
      checked={frame !== null}
      aria-label="Add a frame"
      onCheckedChange={(checked) => onchange(checked ? { ...defaultFrame } : null)}
    />
  </div>

  {#if frame}
    <OptionGrid
      label="Frame style"
      columns={4}
      {options}
      value={frame.style === "none" ? "banner" : frame.style}
      onchange={(value) => onchange({ ...frame, style: value as QrFrameStyle })}
    >
      {#snippet children(option)}
        <svg
          viewBox="0 0 32 32"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          class="size-8"
        >
          {#if option.value === "simple"}
            <rect x="4" y="3" width="24" height="26" rx="1" />
            <rect x="9" y="8" width="14" height="14" rx="1" stroke-dasharray="2 2" />
          {:else if option.value === "rounded"}
            <rect x="4" y="3" width="24" height="26" rx="4" />
            <rect x="9" y="7" width="14" height="14" rx="1.5" stroke-dasharray="2 2" />
            <path d="M10 25h12" stroke-linecap="round" stroke-width="2.4" />
          {:else if option.value === "banner"}
            <rect x="4" y="3" width="24" height="26" rx="3" />
            <rect x="9" y="7" width="14" height="13" rx="1.5" stroke-dasharray="2 2" />
            <rect x="7" y="23" width="18" height="4" rx="1" fill="currentColor" stroke="none" />
          {:else if option.value === "top"}
            <rect x="4" y="3" width="24" height="26" rx="3" />
            <rect x="7" y="4" width="18" height="4" rx="1" fill="currentColor" stroke="none" />
            <rect x="9" y="11" width="14" height="13" rx="1.5" stroke-dasharray="2 2" />
          {:else if option.value === "badge"}
            <rect x="4" y="3" width="24" height="26" rx="4" />
            <rect x="9" y="7" width="14" height="13" rx="1.5" stroke-dasharray="2 2" />
            <rect x="10" y="22" width="12" height="5" rx="2.5" fill="currentColor" stroke="none" />
          {:else if option.value === "ticket"}
            <rect x="4" y="3" width="24" height="26" rx="3" />
            <rect x="9" y="7" width="14" height="12" rx="1.5" stroke-dasharray="2 2" />
            <path d="M4 22h24" stroke-dasharray="2 2" />
            <path d="M11 26h10" stroke-linecap="round" stroke-width="2.2" />
          {:else}
            <rect x="4" y="3" width="24" height="26" rx="2" />
            <rect x="6.5" y="5.5" width="19" height="21" rx="1" />
            <rect x="10" y="9" width="12" height="12" rx="1.5" stroke-dasharray="2 2" />
            <path d="M12 25h8" stroke-linecap="round" stroke-width="2.2" />
          {/if}
        </svg>
      {/snippet}
    </OptionGrid>

    <div class="space-y-2">
      <label for="studio-frame-label" class="text-sm font-medium">Caption</label>
      <Input
        id="studio-frame-label"
        type="text"
        maxlength={24}
        placeholder="SCAN ME"
        value={frame.label}
        oninput={(event) => onchange({ ...frame, label: event.currentTarget.value })}
      />
      <p class="text-xs text-muted-foreground">
        {frame.label.trim().length}/24 characters · keep it short so it prints and scans better.
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <ColorField
        id="studio-frame-color"
        label="Frame colour"
        value={frame.frameColor}
        onchange={(value) => onchange({ ...frame, frameColor: value })}
      />
      <ColorField
        id="studio-frame-label-color"
        label="Caption colour"
        value={frame.labelColor}
        onchange={(value) => onchange({ ...frame, labelColor: value })}
      />
    </div>

    <div class="flex items-end gap-3">
      <ColorField
        id="studio-frame-bg"
        label="Frame background"
        value={frame.backgroundColor === "transparent" ? "#ffffff" : frame.backgroundColor}
        class="flex-1"
        onchange={(value) => onchange({ ...frame, backgroundColor: value })}
      />
      <div class="mb-px flex gap-1">
        <button
          type="button"
          class="h-9 rounded-md border px-2 text-xs {frame.backgroundColor === 'transparent'
            ? 'bg-secondary'
            : 'bg-background'}"
          onclick={() =>
            onchange({
              ...frame,
              backgroundColor: frame.backgroundColor === "transparent" ? "#ffffff" : "transparent",
            })}
        >
          Transparent
        </button>
      </div>
    </div>

    <RangeField
      id="studio-frame-font"
      label="Caption size"
      value={frame.fontSize}
      min={0.04}
      max={0.12}
      step={0.005}
      format={(value) => `${(value * 100).toFixed(1)}%`}
      onchange={(value) => onchange({ ...frame, fontSize: value })}
    />
  {:else}
    <p class="rounded-xl border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">
      Frames are great for stickers, table tents and packaging. Enable one to add a caption like
      “SCAN ME”.
    </p>
  {/if}
</div>
