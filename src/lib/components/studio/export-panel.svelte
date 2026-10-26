<script lang="ts">
  import {
    Copy,
    Download,
    FileCode2,
    FileImage,
    FileText,
    Globe,
    Images,
    LoaderCircle,
    Ruler,
    TriangleAlert,
  } from "@lucide/svelte"
  import { Button } from "$lib/components/ui/button"
  import { Input } from "$lib/components/ui/input"
  import {
    copySvgToClipboard,
    downloadBlob,
    svgToJpegBlob,
    svgToPdfBlob,
    svgToPngBlob,
    svgToWebpBlob,
  } from "$lib/qr/export"
  import { cn } from "$lib/utils/style.js"
  import { toast } from "svelte-sonner"

  interface Props {
    svg: string | null
    /** Design width/height in user units (SVG viewBox). */
    width: number
    height: number
    filenameBase: string
    jpegBackground?: string
    blocked?: boolean
    /** False while the content form is incomplete (preview shows example data). */
    contentReady?: boolean
    /** One-click safe-default repair offered when blocking scan warnings exist. */
    onAutoFix?: () => void
    /** QR module count (matrix.size) used by the print size helper. */
    moduleCount?: number | null
    /** Quiet zone in modules, used by the print size helper. */
    quietZone?: number
    /** null = unlimited (signed in). */
    remainingExports?: number | null
    onExported?: () => void
    class?: string
  }

  let {
    svg,
    width = 1,
    height = 1,
    filenameBase,
    jpegBackground = "#ffffff",
    blocked = false,
    contentReady = true,
    onAutoFix,
    moduleCount = null,
    quietZone = 4,
    remainingExports = null,
    onExported,
    class: className,
  }: Props = $props()

  type FormatId = "svg" | "png" | "jpeg" | "pdf" | "webp"

  const formats: { id: FormatId; label: string; hint: string; icon: typeof FileCode2 }[] = [
    { id: "svg", label: "SVG", hint: "Vector", icon: FileCode2 },
    { id: "png", label: "PNG", hint: "Lossless", icon: Images },
    { id: "jpeg", label: "JPEG", hint: "Smallest", icon: FileImage },
    { id: "pdf", label: "PDF", hint: "Print", icon: FileText },
    { id: "webp", label: "WebP", hint: "Web", icon: Globe },
  ]

  const sizePresets = [512, 1024, 2048, 4096]
  const MIN_SIZE = 128
  const MAX_SIZE = 8192

  let selectedPreset = $state(1024)
  let customSize = $state("1536")
  let useCustom = $state(false)
  let busyFormat = $state<FormatId | null>(null)
  let copying = $state(false)

  let filename = $state("")
  let filenameDirty = $state(false)

  // Print size helper: physical width + DPI -> required pixels.
  let printWidthCm = $state("5")
  let printDpi = $state("300")

  const printCm = $derived(Math.max(0.5, Number(printWidthCm) || 5))
  const printDpiValue = $derived(Math.min(1200, Math.max(72, Math.round(Number(printDpi) || 300))))
  const requiredPrintPx = $derived(Math.round((printCm / 2.54) * printDpiValue))
  const minPrintWidthMm = $derived(moduleCount ? (moduleCount + quietZone * 2) * 0.4 : null)
  const minPrintWidthCm = $derived(minPrintWidthMm ? minPrintWidthMm / 10 : null)
  const printTooSmall = $derived(minPrintWidthCm !== null && printCm < minPrintWidthCm)

  function applyPrintSize() {
    useCustom = true
    customSize = String(Math.min(MAX_SIZE, Math.max(MIN_SIZE, requiredPrintPx)))
  }

  $effect(() => {
    if (!filenameDirty) filename = filenameBase
  })

  const outputWidth = $derived(
    useCustom
      ? Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(Number(customSize) || 512)))
      : selectedPreset,
  )
  const outputHeight = $derived(
    Math.max(16, Math.round(outputWidth * (height / Math.max(1, width)))),
  )
  const limitReached = $derived(remainingExports !== null && remainingExports <= 0)
  const disabled = $derived(!svg || busyFormat !== null || limitReached || blocked || !contentReady)

  function sanitizeBase(value: string): string {
    const cleaned = value
      .trim()
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^\w-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
    return cleaned || "qr-code"
  }

  const downloadName = $derived(sanitizeBase(filename || filenameBase))

  async function exportFormat(format: FormatId) {
    if (!svg || busyFormat) return
    busyFormat = format
    try {
      const base = downloadName
      if (format === "svg") {
        downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `${base}.svg`)
      } else if (format === "png") {
        const blob = await svgToPngBlob(svg, {
          width: outputWidth,
          height: outputHeight,
          background: null,
        })
        downloadBlob(blob, `${base}-${outputWidth}px.png`)
      } else if (format === "jpeg") {
        const blob = await svgToJpegBlob(svg, {
          width: outputWidth,
          height: outputHeight,
          background: jpegBackground,
          quality: 0.95,
        })
        downloadBlob(blob, `${base}-${outputWidth}px.jpg`)
      } else if (format === "pdf") {
        const blob = await svgToPdfBlob(svg, {
          width: outputWidth,
          height: outputHeight,
          background: jpegBackground,
          title: filename || filenameBase,
          margin: 0,
        })
        downloadBlob(blob, `${base}-${outputWidth}px.pdf`)
      } else {
        const blob = await svgToWebpBlob(svg, {
          width: outputWidth,
          height: outputHeight,
          background: null,
          quality: 0.95,
        })
        downloadBlob(blob, `${base}-${outputWidth}px.webp`)
      }
      onExported?.()
      toast.success(`${format.toUpperCase()} downloaded`, {
        description: `${outputWidth} × ${outputHeight} px · ${base}`,
      })
    } catch (error) {
      toast.error(`Could not export ${format.toUpperCase()}`, {
        description: error instanceof Error ? error.message : "Please try another format.",
      })
    } finally {
      busyFormat = null
    }
  }

  async function copySvg() {
    if (!svg || copying) return
    copying = true
    try {
      const copied = await copySvgToClipboard(svg)
      if (copied) {
        toast.success("SVG copied to clipboard")
      } else {
        toast.error("Clipboard is not available", {
          description: "Download the SVG instead.",
        })
      }
    } finally {
      copying = false
    }
  }
</script>

<div class={cn("rounded-2xl border bg-card p-4 shadow-sm sm:p-5", className)}>
  <div class="flex items-center justify-between gap-2">
    <div>
      <p class="text-sm font-semibold">Download</p>
      <p class="text-xs text-muted-foreground">High-resolution files, ready to print or share.</p>
    </div>
    {#if remainingExports !== null}
      <span
        class={cn(
          "rounded-full border px-2 py-0.5 text-[11px] font-medium",
          limitReached
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground",
        )}
      >
        {remainingExports} free left
      </span>
    {/if}
  </div>

  {#if !contentReady}
    <div class="mt-3 rounded-xl border border-warning/40 bg-warning/5 p-3">
      <p class="flex items-start gap-2 text-xs text-warning-foreground">
        <TriangleAlert class="mt-0.5 size-3.5 shrink-0" />
        Add your content first — the preview currently shows example data, so downloads are paused.
      </p>
    </div>
  {:else if blocked}
    <div class="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
      <p class="flex items-start gap-2 text-xs text-destructive">
        <TriangleAlert class="mt-0.5 size-3.5 shrink-0" />
        Fix the errors above to export — this design is very likely to fail when scanned.
      </p>
      {#if onAutoFix}
        <Button
          type="button"
          variant="destructive"
          size="xs"
          class="mt-2 w-full"
          onclick={onAutoFix}
        >
          Auto-fix and unlock downloads
        </Button>
      {/if}
    </div>
  {/if}

  {#if limitReached}
    <div class="mt-3 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
      You have used all free downloads. <a class="font-medium underline" href="/auth/login"
        >Sign in</a
      > for unlimited exports, editable dynamic QRs and analytics.
    </div>
  {/if}

  <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
    {#each formats as format (format.id)}
      {@const FormatIcon = format.icon}
      <button
        type="button"
        {disabled}
        aria-label={`Download ${format.label}`}
        class={cn(
          "group flex flex-col items-center gap-1 rounded-xl border bg-background/70 px-2 py-3 transition-all",
          "hover:border-foreground/25 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        )}
        onclick={() => exportFormat(format.id)}
      >
        {#if busyFormat === format.id}
          <LoaderCircle class="size-5 animate-spin text-muted-foreground" />
        {:else}
          <FormatIcon
            class="size-5 text-muted-foreground transition-colors group-hover:text-foreground"
          />
        {/if}
        <span class="text-xs font-semibold">{format.label}</span>
        <span class="text-[10px] text-muted-foreground">{format.hint}</span>
      </button>
    {/each}
  </div>

  <div class="mt-4 space-y-3 rounded-xl border bg-muted/20 p-3">
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs font-medium text-muted-foreground">Export size</span>
      <span class="font-mono text-[11px] text-foreground/80">
        {outputWidth} × {outputHeight} px
      </span>
    </div>
    <div class="flex flex-wrap gap-1.5">
      {#each sizePresets as preset (preset)}
        <button
          type="button"
          class={cn(
            "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
            !useCustom && selectedPreset === preset
              ? "border-foreground/40 bg-background text-foreground shadow-xs"
              : "border-transparent bg-background/40 text-muted-foreground hover:text-foreground",
          )}
          onclick={() => {
            useCustom = false
            selectedPreset = preset
          }}
        >
          {preset}px
        </button>
      {/each}
      <button
        type="button"
        class={cn(
          "rounded-md border px-2 py-1 text-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          useCustom
            ? "border-foreground/40 bg-background text-foreground shadow-xs"
            : "border-transparent bg-background/40 text-muted-foreground hover:text-foreground",
        )}
        onclick={() => (useCustom = true)}
      >
        Custom
      </button>
    </div>
    {#if useCustom}
      <div class="flex items-center gap-2">
        <Input
          type="number"
          min={MIN_SIZE}
          max={MAX_SIZE}
          step={64}
          bind:value={customSize}
          aria-label="Custom export width in pixels"
          class="h-8 w-28 font-mono text-xs"
        />
        <span class="text-xs text-muted-foreground">px wide</span>
      </div>
    {/if}
  </div>

  {#if moduleCount}
    <div class="mt-3 space-y-2.5 rounded-xl border border-dashed bg-background/50 p-3">
      <div class="flex items-center justify-between gap-2">
        <span class="flex items-center gap-1.5 text-xs font-medium">
          <Ruler class="size-3.5 text-muted-foreground" />
          Print size helper
        </span>
        <span class="font-mono text-[10px] text-muted-foreground">{moduleCount} modules</span>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <label class="space-y-1">
          <span class="text-[10px] text-muted-foreground">Width (cm)</span>
          <Input
            type="number"
            min="1"
            max="200"
            step="0.5"
            bind:value={printWidthCm}
            aria-label="Print width in centimetres"
            class="h-8 font-mono text-xs"
          />
        </label>
        <label class="space-y-1">
          <span class="text-[10px] text-muted-foreground">DPI</span>
          <Input
            type="number"
            min="72"
            max="1200"
            step="50"
            bind:value={printDpi}
            aria-label="Print resolution in DPI"
            class="h-8 font-mono text-xs"
          />
        </label>
      </div>
      <p class="text-[11px] text-muted-foreground">
        Export at <strong class="text-foreground">{requiredPrintPx} px</strong> wide for a
        {printCm.toFixed(1)} cm print at {printDpiValue} DPI.
      </p>
      {#if printTooSmall}
        <p class="text-[11px] font-medium text-warning-foreground">
          Too dense for this size: keep at least {minPrintWidthCm?.toFixed(1)} cm ({minPrintWidthMm?.toFixed(
            0,
          )} mm) for a {moduleCount}-module code.
        </p>
      {:else}
        <p class="text-[11px] text-success-foreground">
          Above the {minPrintWidthCm?.toFixed(1)} cm safe minimum for this code.
        </p>
      {/if}
      <Button type="button" variant="outline" size="xs" class="w-full" onclick={applyPrintSize}>
        Use {requiredPrintPx} px
      </Button>
    </div>
  {/if}

  <div class="mt-3 space-y-2">
    <label for="studio-export-name" class="text-xs font-medium text-muted-foreground"
      >File name</label
    >
    <Input
      id="studio-export-name"
      type="text"
      bind:value={filename}
      oninput={() => (filenameDirty = true)}
      placeholder="qr-code"
      class="h-8 font-mono text-xs"
    />
  </div>

  <div class="mt-3 flex gap-2">
    <Button
      type="button"
      variant="outline"
      size="sm"
      class="flex-1 gap-1.5"
      disabled={!svg || copying}
      onclick={copySvg}
    >
      {#if copying}
        <LoaderCircle class="size-3.5 animate-spin" />
      {:else}
        <Copy class="size-3.5" />
      {/if}
      Copy SVG
    </Button>
    <Button
      type="button"
      variant="secondary"
      size="sm"
      class="flex-1 gap-1.5"
      {disabled}
      onclick={() => exportFormat("png")}
    >
      <Download class="size-3.5" />
      Quick PNG
    </Button>
  </div>

  <p class="mt-3 text-[11px] text-muted-foreground">
    SVG stays vector-perfect. PNG keeps transparency when the Background is transparent; JPEG and
    PDF always fill the background because those formats cannot store alpha.
  </p>
</div>
