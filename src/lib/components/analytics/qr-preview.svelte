<script lang="ts">
  import { QrCode as QrCodeIcon } from "@lucide/svelte"
  import { buildQrTarget, renderQrSvg } from "$lib/qr"
  import type { QrDesign } from "$lib/qr/types"
  import { cn } from "$lib/utils/style"

  interface PreviewSource {
    type: "static" | "dynamic"
    shortCode: string | null
    encodedData: string
    destinationUrl: string | null
  }

  interface Props {
    qr: PreviewSource
    design: QrDesign
    /** Public origin used to encode dynamic short links. */
    origin: string
    /** Rendered SVG width; the plate clamps it to the container with CSS. */
    size?: number
    /** Draw a white card plate behind the code (recommended for transparent designs). */
    plate?: boolean
    class?: string
  }

  let { qr, design, origin, size = 512, plate = true, class: className }: Props = $props()

  const result = $derived.by(() => {
    const data = buildQrTarget(qr, origin)
    if (!data) return null
    try {
      return renderQrSvg({ data, design, size })
    } catch {
      return null
    }
  })
</script>

{#if result}
  <div
    class={cn(
      "flex items-center justify-center overflow-hidden [&>svg]:h-auto [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:max-w-full",
      plate && "rounded-md border bg-white",
      className,
    )}
    aria-hidden="true"
  >
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html result.svg}
  </div>
{:else}
  <div
    class={cn(
      "flex items-center justify-center text-muted-foreground",
      plate && "rounded-md border bg-muted/40",
      className,
    )}
    aria-hidden="true"
  >
    <QrCodeIcon class="size-5" />
  </div>
{/if}
