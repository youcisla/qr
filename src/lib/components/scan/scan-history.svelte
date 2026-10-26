<script lang="ts">
  import { History, Trash2, X } from "@lucide/svelte"
  import { Button } from "$lib/components/ui/button"
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card"
  import type { ScanHistoryEntry } from "$lib/utils/qr-scanner"
  import { cn } from "$lib/utils/style"

  interface Props {
    entries: ScanHistoryEntry[]
    onSelect: (entry: ScanHistoryEntry) => void
    onRemove?: (id: string) => void
    onClear: () => void
    class?: string
  }

  let { entries, onSelect, onRemove, onClear, class: className }: Props = $props()

  const KIND_LABELS: Record<string, string> = {
    url: "Link",
    text: "Text",
    email: "E-mail",
    phone: "Phone",
    sms: "SMS",
    whatsapp: "WhatsApp",
    wifi: "Wi-Fi",
    vcard: "Contact",
    mecard: "Contact",
    geo: "Location",
    event: "Event",
    crypto: "Crypto",
    epc: "SEPA",
    app: "App",
    social: "Social",
    paypal: "PayPal",
  }

  const SOURCE_LABELS: Record<string, string> = {
    camera: "Camera",
    upload: "Upload",
    drop: "Dropped",
    paste: "Pasted",
    history: "History",
  }

  function relativeTime(timestamp: number): string {
    const diff = Date.now() - timestamp
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return "Just now"
    if (minutes < 60) return minutes + " min ago"
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return hours + " h ago"
    const days = Math.floor(hours / 24)
    if (days < 7) return days + " d ago"
    return new Date(timestamp).toLocaleDateString()
  }
</script>

<Card class={cn(className)}>
  <CardHeader>
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <History class="size-4 text-muted-foreground" />
        <CardTitle class="text-base">Recent scans</CardTitle>
      </div>
      <Button type="button" variant="ghost" size="sm" onclick={onClear}>
        <Trash2 class="size-3.5" />
        Clear history
      </Button>
    </div>
  </CardHeader>
  <CardContent>
    <ul class="divide-y rounded-md border bg-background">
      {#each entries as entry (entry.id)}
        <li class="flex items-center gap-2 pr-2">
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
            onclick={() => onSelect(entry)}
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{entry.title}</p>
              <p class="truncate text-xs text-muted-foreground">
                {KIND_LABELS[entry.kind] ?? entry.kind}
                {#if entry.source in SOURCE_LABELS}
                  · {SOURCE_LABELS[entry.source]}
                {/if}
                · {relativeTime(entry.scannedAt)}
              </p>
            </div>
          </button>
          {#if onRemove}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={"Remove " + entry.title + " from history"}
              onclick={() => onRemove?.(entry.id)}
            >
              <X class="size-3.5" />
            </Button>
          {/if}
        </li>
      {/each}
    </ul>
    <p class="mt-2 text-xs text-muted-foreground">
      History is stored only in this browser. Clear it whenever you like.
    </p>
  </CardContent>
</Card>
