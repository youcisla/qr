<script lang="ts">
  import { ImagePlus, Link2, Trash2, Upload } from "@lucide/svelte"
  import { Button } from "$lib/components/ui/button"
  import { Input } from "$lib/components/ui/input"
  import { Switch } from "$lib/components/ui/switch"
  import type { ErrorCorrectionLevel, QrLogoOptions } from "$lib/qr/types"
  import { toast } from "svelte-sonner"

  import ColorField from "./color-field.svelte"
  import RangeField from "./range-field.svelte"

  interface Props {
    logo: QrLogoOptions | null
    errorCorrection?: ErrorCorrectionLevel
    onchange: (logo: QrLogoOptions | null) => void
  }

  let { logo, errorCorrection = "M", onchange }: Props = $props()

  const MAX_LOGO_BYTES = 2 * 1024 * 1024
  const ACCEPTED = ["image/png", "image/jpeg", "image/svg+xml", "image/webp", "image/gif"]

  let fileInput: HTMLInputElement | null = $state(null)
  let urlMode = $state(false)
  let urlValue = $state("")
  let dragging = $state(false)

  const defaultOptions: Omit<QrLogoOptions, "src"> = {
    size: 0.2,
    padding: 0.15,
    radius: 0.15,
    backgroundColor: "#ffffff",
    clearModules: true,
  }

  function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === "string") resolve(reader.result)
        else reject(new Error("Could not read that image"))
      }
      reader.onerror = () => reject(new Error("Could not read that image"))
      reader.readAsDataURL(file)
    })
  }

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error("That image could not be decoded"))
      image.src = src
    })
  }

  /**
   * Logos are stored inline in the saved design, so shrink raster logos to a
   * 512px square before turning them into data URLs. This keeps saves and
   * exports fast without visible quality loss at QR sizes.
   */
  async function prepareLogo(file: File): Promise<string> {
    const dataUrl = await readAsDataUrl(file)
    if (file.type === "image/svg+xml") {
      if (dataUrl.length > 250_000) {
        throw new Error("This SVG is very complex; upload a PNG version instead")
      }
      return dataUrl
    }
    const image = await loadImage(dataUrl)
    const mime = file.type === "image/jpeg" ? "image/jpeg" : "image/png"
    // Saved designs embed the logo inline, so keep the data URL comfortably under
    // the server body limit: step down the longest side until it fits.
    const MAX_DATA_URL = 340_000
    for (const longestSide of [512, 384, 288, 224, 168, 128]) {
      const scale = Math.min(1, longestSide / Math.max(image.width, image.height))
      const width = Math.max(8, Math.round(image.width * scale))
      const height = Math.max(8, Math.round(image.height * scale))
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext("2d")
      if (!context) throw new Error("Canvas is not available in this browser")
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = "high"
      context.drawImage(image, 0, 0, width, height)
      const result = canvas.toDataURL(mime, 0.92)
      if (result.length <= MAX_DATA_URL) return result
    }
    throw new Error("This logo is too detailed; try a simpler image")
  }

  async function readFile(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Unsupported image", { description: "Use a PNG, JPEG, SVG, WebP or GIF file." })
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("Logo is too large", { description: "Keep the logo under 2 MB." })
      return
    }
    try {
      const src = await prepareLogo(file)
      onchange({ ...(logo ?? defaultOptions), src })
      toast.success("Logo added", {
        description: "Error correction was raised to H for reliability.",
      })
    } catch (error) {
      toast.error("Could not use that logo", {
        description: error instanceof Error ? error.message : "Try a different image.",
      })
    }
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (file) void readFile(file)
  }

  function applyUrl() {
    const value = urlValue.trim()
    if (!/^https?:\/\//i.test(value)) {
      toast.error("Enter a full image URL", { description: "It should start with https://" })
      return
    }
    onchange({ ...(logo ?? defaultOptions), src: value })
    urlMode = false
    urlValue = ""
  }
</script>

<div class="space-y-4">
  {#if logo}
    <div class="flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
      <span
        class="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white"
      >
        <img src={logo.src} alt="Logo preview" class="size-full object-contain" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">
          {logo.src.startsWith("data:") ? "Uploaded logo" : "Remote logo"}
        </p>
        <p class="text-xs text-muted-foreground">
          {Math.round(logo.size * 100)}% of the code · {logo.clearModules
            ? "modules cleared"
            : "modules kept"}
        </p>
      </div>
      <div class="flex shrink-0 gap-1">
        <Button variant="outline" size="sm" class="gap-1" onclick={() => fileInput?.click()}>
          <Upload class="size-3.5" />
          Replace
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Remove logo"
          onclick={() => {
            onchange(null)
            urlMode = false
          }}
        >
          <Trash2 class="size-4" />
        </Button>
      </div>
    </div>

    {#if logo.clearModules && errorCorrection !== "H"}
      <p
        class="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-[11px] text-warning-foreground"
      >
        Error correction is {errorCorrection}. With a logo, use H (30% recovery) in Shape → Error
        correction so the removed modules can still be decoded.
      </p>
    {/if}

    <div class="space-y-5 rounded-xl border bg-background/60 p-4">
      <RangeField
        id="studio-logo-size"
        label="Logo size"
        value={logo.size}
        min={0.1}
        max={0.35}
        step={0.01}
        format={(value) => `${Math.round(value * 100)}%`}
        hint="Stay under 25% for reliable scanning."
        onchange={(value) => onchange({ ...logo, size: value })}
      />
      <div class="grid gap-5 sm:grid-cols-2">
        <RangeField
          id="studio-logo-padding"
          label="Padding"
          value={logo.padding}
          min={0}
          max={0.5}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
          onchange={(value) => onchange({ ...logo, padding: value })}
        />
        <RangeField
          id="studio-logo-radius"
          label="Corner radius"
          value={logo.radius}
          min={0}
          max={0.5}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
          onchange={(value) => onchange({ ...logo, radius: value })}
        />
      </div>

      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-sm font-medium">Cover modules behind logo</p>
          <p class="text-xs text-muted-foreground">
            Recommended: cleans the QR under the logo plate.
          </p>
        </div>
        <Switch
          checked={logo.clearModules}
          aria-label="Clear modules behind logo"
          onCheckedChange={(checked) => onchange({ ...logo, clearModules: checked })}
        />
      </div>

      <div class="flex items-end gap-3">
        <ColorField
          id="studio-logo-bg"
          label="Plate background"
          value={logo.backgroundColor === "transparent" ? "#ffffff" : logo.backgroundColor}
          class="flex-1"
          onchange={(value) => onchange({ ...logo, backgroundColor: value })}
        />
        <Button
          type="button"
          variant={logo.backgroundColor === "transparent" ? "secondary" : "outline"}
          size="sm"
          class="mb-px"
          onclick={() =>
            onchange({
              ...logo,
              backgroundColor: logo.backgroundColor === "transparent" ? "#ffffff" : "transparent",
            })}
        >
          Transparent
        </Button>
      </div>
    </div>
  {:else}
    <div class="space-y-3">
      <button
        type="button"
        class="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center transition-colors hover:border-foreground/30 hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none {dragging
          ? 'border-foreground/50 bg-accent/40'
          : ''}"
        onclick={() => fileInput?.click()}
        ondragover={(event) => {
          event.preventDefault()
          dragging = true
        }}
        ondragleave={() => (dragging = false)}
        ondrop={(event) => {
          event.preventDefault()
          dragging = false
          handleFiles(event.dataTransfer?.files ?? null)
        }}
      >
        <span class="flex size-10 items-center justify-center rounded-full bg-background shadow-xs">
          <ImagePlus class="size-5 text-muted-foreground" />
        </span>
        <span class="text-sm font-medium">Upload your logo</span>
        <span class="text-xs text-muted-foreground">PNG, JPEG, SVG, WebP or GIF · up to 2 MB</span>
      </button>

      {#if urlMode}
        <div class="flex items-center gap-2">
          <Input
            type="url"
            placeholder="https://example.com/logo.png"
            bind:value={urlValue}
            aria-label="Logo image URL"
            onkeydown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                applyUrl()
              }
            }}
          />
          <Button type="button" size="sm" onclick={applyUrl}>Use</Button>
          <Button type="button" variant="ghost" size="sm" onclick={() => (urlMode = false)}>
            Cancel
          </Button>
        </div>
      {:else}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="w-full gap-1.5 text-muted-foreground"
          onclick={() => (urlMode = true)}
        >
          <Link2 class="size-3.5" />
          Or use an image URL
        </Button>
      {/if}
    </div>
  {/if}

  <input
    bind:this={fileInput}
    type="file"
    accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
    class="hidden"
    onchange={(event) => {
      handleFiles(event.currentTarget.files)
      event.currentTarget.value = ""
    }}
  />
</div>
