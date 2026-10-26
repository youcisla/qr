<script lang="ts">
  import {
    BarChart3,
    Copy,
    Download,
    EllipsisVertical,
    ExternalLink,
    ImageDown,
    PauseCircle,
    Pencil,
    PlayCircle,
    Trash2,
    Wand2,
  } from "@lucide/svelte"
  import { goto } from "$app/navigation"
  import { buttonVariants } from "$lib/components/ui/button"
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "$lib/components/ui/dropdown-menu"
  import { buildQrTarget, buildShortUrl, renderQrSvg } from "$lib/qr"
  import { downloadBlob, svgToPngBlob } from "$lib/qr/export"
  import type { QrDesign } from "$lib/qr/types"
  import type { QrCode } from "$lib/server/db/schema/qr-codes"
  import { cn } from "$lib/utils/style"
  import { toast } from "svelte-sonner"

  interface Props {
    qrCode: QrCode
    design: QrDesign
    /** Public origin used to encode the dynamic short link. */
    origin: string
    onDelete?: (id: string) => void
    onToggleStatus?: (id: string) => void
  }

  let { qrCode, design, origin, onDelete, onToggleStatus }: Props = $props()

  const encodeTarget = $derived(buildQrTarget(qrCode, origin))
  const shortUrl = $derived(qrCode.shortCode ? buildShortUrl(qrCode.shortCode, origin) : null)
  const openUrl = $derived(shortUrl ?? qrCode.destinationUrl ?? null)

  function exportFilename(extension: string): string {
    const base = (qrCode.title || qrCode.shortCode || qrCode.id)
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
    return `${base || "qr-code"}.${extension}`
  }

  async function copyValue(value: string | null, message: string) {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      toast.success(message)
    } catch {
      toast.error("Could not copy to the clipboard")
    }
  }

  function renderForExport() {
    if (!encodeTarget) return null
    try {
      return renderQrSvg({ data: encodeTarget, design, size: 1024 })
    } catch (error) {
      console.error(error)
      toast.error("Could not render this QR code")
      return null
    }
  }

  function downloadSvg() {
    const result = renderForExport()
    if (!result) return
    downloadBlob(
      new Blob([result.svg], { type: "image/svg+xml;charset=utf-8" }),
      exportFilename("svg"),
    )
    toast.success("SVG downloaded")
  }

  async function downloadPng() {
    const result = renderForExport()
    if (!result) return
    try {
      const width = 1024
      const height = Math.round((width * result.height) / Math.max(result.width, 1))
      const blob = await svgToPngBlob(result.svg, { width, height })
      downloadBlob(blob, exportFilename("png"))
      toast.success("PNG downloaded")
    } catch (error) {
      console.error(error)
      toast.error("Could not export a PNG")
    }
  }

  function openExternal(url: string | null) {
    if (!url) return
    window.open(url, "_blank", "noopener,noreferrer")
  }
</script>

<DropdownMenu>
  <DropdownMenuTrigger
    class={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground")}
    aria-label={`Actions for ${qrCode.title || qrCode.shortCode || "QR code"}`}
  >
    <EllipsisVertical class="size-4" />
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" class="w-56">
    <DropdownMenuLabel class="text-xs font-medium text-muted-foreground">Manage</DropdownMenuLabel>
    <DropdownMenuItem onSelect={() => goto(`/dashboard/analytics/${qrCode.id}`)}>
      <BarChart3 />
      Analytics
    </DropdownMenuItem>
    <DropdownMenuItem onSelect={() => goto(`/dashboard/edit/${qrCode.id}`)}>
      <Pencil />
      Edit details
    </DropdownMenuItem>
    <DropdownMenuItem onSelect={() => goto(`/studio?edit=${qrCode.id}`)}>
      <Wand2 />
      Customize design
    </DropdownMenuItem>

    <DropdownMenuSeparator />

    {#if openUrl}
      <DropdownMenuItem onSelect={() => openExternal(openUrl)}>
        <ExternalLink />
        {shortUrl ? "Open short link" : "Open content"}
      </DropdownMenuItem>
    {/if}
    {#if shortUrl}
      <DropdownMenuItem onSelect={() => copyValue(shortUrl, "Short link copied")}>
        <Copy />
        Copy short link
      </DropdownMenuItem>
    {/if}
    <DropdownMenuItem onSelect={() => copyValue(encodeTarget, "QR content copied")}>
      <Copy />
      Copy QR content
    </DropdownMenuItem>

    <DropdownMenuSeparator />

    <DropdownMenuItem onSelect={downloadSvg}>
      <Download />
      Download SVG
    </DropdownMenuItem>
    <DropdownMenuItem onSelect={downloadPng}>
      <ImageDown />
      Download PNG
    </DropdownMenuItem>

    <DropdownMenuSeparator />

    {#if onToggleStatus}
      <DropdownMenuItem onSelect={() => onToggleStatus?.(qrCode.id)}>
        {#if qrCode.status === "active"}
          <PauseCircle />
          Pause code
        {:else}
          <PlayCircle />
          Activate code
        {/if}
      </DropdownMenuItem>
    {/if}
    {#if onDelete}
      <DropdownMenuItem variant="destructive" onSelect={() => onDelete?.(qrCode.id)}>
        <Trash2 />
        Delete
      </DropdownMenuItem>
    {/if}
  </DropdownMenuContent>
</DropdownMenu>
