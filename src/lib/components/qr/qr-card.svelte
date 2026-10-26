<script lang="ts">
  import { BarChart3, Wand2 } from "@lucide/svelte"
  import {
    formatNumber,
    formatScanMoment,
    qrDisplaySubtitle,
    qrDisplayTitle,
    QrPreview,
    statusBadgeVariant,
    statusLabel,
  } from "$lib/components/analytics"
  import { Badge } from "$lib/components/ui/badge"
  import { Button } from "$lib/components/ui/button"
  import { Card } from "$lib/components/ui/card"
  import { Checkbox } from "$lib/components/ui/checkbox"
  import type { QrDesign } from "$lib/qr/types"
  import type { QrCode } from "$lib/server/db/schema/qr-codes"
  import { cn } from "$lib/utils/style"

  import QrActionsPopover from "./qr-actions-popover.svelte"

  interface Props {
    qrCode: QrCode
    design: QrDesign
    /** Public origin used to render dynamic short links. */
    origin: string
    selected?: boolean
    class?: string
    onSelectChange?: (id: string, selected: boolean) => void
    onDelete?: (id: string) => void
    onToggleStatus?: (id: string) => void
  }

  let {
    qrCode,
    design,
    origin,
    selected = false,
    class: className,
    onSelectChange,
    onDelete,
    onToggleStatus,
  }: Props = $props()

  const title = $derived(qrDisplayTitle(qrCode))
  const subtitle = $derived(qrDisplaySubtitle(qrCode))
</script>

<Card
  class={cn(
    "relative gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md",
    selected && "ring-2 ring-primary/50",
    className,
  )}
>
  <div class="flex items-center justify-between gap-2 px-3 pt-3">
    <div class="flex min-w-0 items-center gap-2">
      <Checkbox
        checked={selected}
        onCheckedChange={() => onSelectChange?.(qrCode.id, !selected)}
        aria-label={selected ? `Deselect ${title}` : `Select ${title}`}
      />
      <Badge variant={qrCode.type === "dynamic" ? "default" : "secondary"}>
        {qrCode.type}
      </Badge>
      <Badge variant={statusBadgeVariant(qrCode.status)}>{statusLabel(qrCode.status)}</Badge>
    </div>
    <QrActionsPopover {qrCode} {design} {origin} {onDelete} {onToggleStatus} />
  </div>

  <div class="px-3 pt-3">
    <div class="flex items-center justify-center rounded-lg border bg-muted/30 p-4">
      <QrPreview qr={qrCode} {design} {origin} size={256} class="size-32 bg-white p-2 shadow-sm" />
    </div>
  </div>

  <div class="space-y-3 p-4">
    <div class="space-y-0.5">
      <a
        href={`/dashboard/analytics/${qrCode.id}`}
        class="line-clamp-1 text-sm font-medium hover:underline"
      >
        {title}
      </a>
      <p class="line-clamp-1 text-xs text-muted-foreground">{subtitle}</p>
    </div>

    {#if qrCode.tags.length > 0}
      <div class="flex flex-wrap items-center gap-1">
        {#each qrCode.tags.slice(0, 3) as tag (tag)}
          <Badge variant="outline">#{tag}</Badge>
        {/each}
        {#if qrCode.tags.length > 3}
          <span class="text-xs text-muted-foreground">+{qrCode.tags.length - 3}</span>
        {/if}
      </div>
    {/if}

    <dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      <div>
        <dt class="text-muted-foreground">Scans</dt>
        <dd class="font-medium tabular-nums">{formatNumber(qrCode.scanCount)}</dd>
      </div>
      <div>
        <dt class="text-muted-foreground">Unique</dt>
        <dd class="font-medium tabular-nums">{formatNumber(qrCode.uniqueScanCount)}</dd>
      </div>
      <div class="col-span-2">
        <dt class="text-muted-foreground">Last scan</dt>
        <dd class="line-clamp-1 font-medium">{formatScanMoment(qrCode.lastScannedAt)}</dd>
      </div>
    </dl>

    <div class="flex items-center gap-2">
      <Button href={`/dashboard/analytics/${qrCode.id}`} variant="outline" size="sm" class="flex-1">
        <BarChart3 class="size-4" />
        Analytics
      </Button>
      <Button href={`/studio?edit=${qrCode.id}`} variant="ghost" size="sm" class="flex-1">
        <Wand2 class="size-4" />
        Customize
      </Button>
    </div>
  </div>
</Card>
