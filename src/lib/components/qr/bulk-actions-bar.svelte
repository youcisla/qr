<script lang="ts">
  import { Archive, CopyPlus, Download, PauseCircle, PlayCircle, Trash2, X } from "@lucide/svelte"
  import { Button } from "$lib/components/ui/button"

  interface Props {
    selectedCount: number
    /** Disables every action while a bulk request is in flight. */
    busy?: boolean
    onActivate?: () => void
    onPause?: () => void
    onArchive?: () => void
    onDuplicate?: () => void
    onExport?: () => void
    onDelete?: () => void
    onClearSelection?: () => void
  }

  let {
    selectedCount,
    busy = false,
    onActivate,
    onPause,
    onArchive,
    onDuplicate,
    onExport,
    onDelete,
    onClearSelection,
  }: Props = $props()
</script>

{#if selectedCount > 0}
  <div
    role="region"
    aria-label="Bulk actions"
    class="sticky top-20 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur"
  >
    <div class="flex items-center gap-2">
      <p class="text-sm font-medium" aria-live="polite">
        {selectedCount}
        {selectedCount === 1 ? "QR code" : "QR codes"} selected
      </p>
      <Button variant="ghost" size="sm" onclick={onClearSelection} disabled={busy}>
        <X class="size-4" />
        Clear
      </Button>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onclick={onActivate} disabled={busy}>
        <PlayCircle class="size-4" />
        Activate
      </Button>
      <Button variant="outline" size="sm" onclick={onPause} disabled={busy}>
        <PauseCircle class="size-4" />
        Pause
      </Button>
      <Button variant="outline" size="sm" onclick={onArchive} disabled={busy}>
        <Archive class="size-4" />
        Archive
      </Button>
      <Button variant="outline" size="sm" onclick={onDuplicate} disabled={busy}>
        <CopyPlus class="size-4" />
        Duplicate
      </Button>
      <Button variant="outline" size="sm" onclick={onExport} disabled={busy}>
        <Download class="size-4" />
        Export CSV
      </Button>
      <Button variant="destructive" size="sm" onclick={onDelete} disabled={busy}>
        <Trash2 class="size-4" />
        Delete
      </Button>
    </div>
  </div>
{/if}
