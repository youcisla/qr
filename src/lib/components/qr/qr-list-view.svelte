<script lang="ts">
  import { ArrowDown, ArrowUp, ArrowUpDown } from "@lucide/svelte"
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
  import { Checkbox } from "$lib/components/ui/checkbox"
  import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "$lib/components/ui/table"
  import type { QrDesign } from "$lib/qr/types"
  import type { QrCode } from "$lib/server/db/schema/qr-codes"

  import QrActionsPopover from "./qr-actions-popover.svelte"

  type QrListRow = QrCode & { design: QrDesign }
  type SortKey = "created" | "updated" | "scans" | "title"

  interface Props {
    rows: QrListRow[]
    /** Public origin used to render dynamic short links. */
    origin: string
    selectedIds: string[]
    allSelected?: boolean
    someSelected?: boolean
    sortKey?: SortKey
    sortDirection?: "asc" | "desc"
    onToggle?: (id: string) => void
    onToggleAll?: () => void
    onSort?: (key: SortKey) => void
    onDelete?: (id: string) => void
    onToggleStatus?: (id: string) => void
  }

  let {
    rows,
    origin,
    selectedIds,
    allSelected = false,
    someSelected = false,
    sortKey = "created",
    sortDirection = "desc",
    onToggle,
    onToggleAll,
    onSort,
    onDelete,
    onToggleStatus,
  }: Props = $props()
</script>

{#snippet sortHeader(label: string, key: SortKey)}
  <button
    type="button"
    class="inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground"
    onclick={() => onSort?.(key)}
  >
    {label}
    {#if sortKey === key}
      {#if sortDirection === "asc"}
        <ArrowUp class="size-3" aria-hidden="true" />
      {:else}
        <ArrowDown class="size-3" aria-hidden="true" />
      {/if}
    {:else}
      <ArrowUpDown class="size-3 text-muted-foreground/60" aria-hidden="true" />
    {/if}
  </button>
{/snippet}

<div class="overflow-x-auto rounded-xl border bg-card">
  <Table>
    <TableCaption class="sr-only">Your QR codes</TableCaption>
    <TableHeader>
      <TableRow class="hover:bg-transparent">
        <TableHead class="w-10">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected && !allSelected}
            onCheckedChange={() => onToggleAll?.()}
            aria-label={allSelected ? "Deselect all QR codes" : "Select all QR codes"}
          />
        </TableHead>
        <TableHead class="w-14">
          <span class="sr-only">Preview</span>
        </TableHead>
        <TableHead>{@render sortHeader("Name", "title")}</TableHead>
        <TableHead class="hidden md:table-cell">Type</TableHead>
        <TableHead>Status</TableHead>
        <TableHead class="hidden xl:table-cell">Tags</TableHead>
        <TableHead class="hidden text-right sm:table-cell">
          {@render sortHeader("Scans", "scans")}
        </TableHead>
        <TableHead class="hidden 2xl:table-cell">
          {@render sortHeader("Created", "created")}
        </TableHead>
        <TableHead class="hidden lg:table-cell">Last scan</TableHead>
        <TableHead class="w-10 text-right">
          <span class="sr-only">Actions</span>
        </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {#each rows as row (row.id)}
        {@const selected = selectedIds.includes(row.id)}
        <TableRow data-state={selected ? "selected" : undefined}>
          <TableCell>
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggle?.(row.id)}
              aria-label={selected
                ? `Deselect ${qrDisplayTitle(row)}`
                : `Select ${qrDisplayTitle(row)}`}
            />
          </TableCell>
          <TableCell>
            <QrPreview
              qr={row}
              design={row.design}
              {origin}
              size={128}
              class="size-11 bg-white p-1"
            />
          </TableCell>
          <TableCell class="max-w-[320px] whitespace-normal">
            <a href={`/dashboard/analytics/${row.id}`} class="font-medium hover:underline">
              {qrDisplayTitle(row)}
            </a>
            <p class="line-clamp-1 text-xs text-muted-foreground">
              {qrDisplaySubtitle(row)}
            </p>
          </TableCell>
          <TableCell class="hidden md:table-cell">
            <Badge variant={row.type === "dynamic" ? "default" : "secondary"}>{row.type}</Badge>
          </TableCell>
          <TableCell>
            <Badge variant={statusBadgeVariant(row.status)}>{statusLabel(row.status)}</Badge>
          </TableCell>
          <TableCell class="hidden xl:table-cell">
            {#if row.tags.length === 0}
              <span class="text-muted-foreground">—</span>
            {:else}
              <div class="flex items-center gap-1">
                {#each row.tags.slice(0, 2) as tag (tag)}
                  <Badge variant="outline">#{tag}</Badge>
                {/each}
                {#if row.tags.length > 2}
                  <span class="text-xs text-muted-foreground">+{row.tags.length - 2}</span>
                {/if}
              </div>
            {/if}
          </TableCell>
          <TableCell class="hidden text-right sm:table-cell">
            <span class="font-medium tabular-nums">{formatNumber(row.scanCount)}</span>
            <span class="ml-1 text-xs text-muted-foreground tabular-nums">
              ({formatNumber(row.uniqueScanCount)})
            </span>
          </TableCell>
          <TableCell class="hidden text-sm text-muted-foreground 2xl:table-cell">
            {formatScanMoment(row.createdAt)}
          </TableCell>
          <TableCell class="hidden text-sm text-muted-foreground lg:table-cell">
            {formatScanMoment(row.lastScannedAt)}
          </TableCell>
          <TableCell class="text-right">
            <QrActionsPopover
              qrCode={row}
              design={row.design}
              {origin}
              {onDelete}
              {onToggleStatus}
            />
          </TableCell>
        </TableRow>
      {:else}
        <TableRow>
          <TableCell colspan={10} class="py-10 text-center text-sm text-muted-foreground">
            No QR codes match the current filters.
          </TableCell>
        </TableRow>
      {/each}
    </TableBody>
  </Table>
</div>
