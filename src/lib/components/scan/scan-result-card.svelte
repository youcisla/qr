<script lang="ts">
  import {
    Bitcoin,
    CalendarDays,
    Contact,
    ContactRound,
    Copy,
    ExternalLink,
    Eye,
    EyeOff,
    Landmark,
    Link,
    Mail,
    MapPin,
    MessageCircle,
    MessageSquare,
    Phone,
    QrCode,
    RotateCcw,
    Share2,
    Smartphone,
    Type,
    Wallet,
    Wifi,
  } from "@lucide/svelte"
  import { Button } from "$lib/components/ui/button"
  import { Separator } from "$lib/components/ui/separator"
  import type { ParsedQrKind, ParsedQrPayload } from "$lib/qr/parse"
  import { cn } from "$lib/utils/style"
  import type { Component } from "svelte"
  import { toast } from "svelte-sonner"

  interface Props {
    result: ParsedQrPayload
    imagePreviewUrl?: string | null
    source?: string
    onScanAgain?: () => void
    onGenerateQr?: (data: string) => void
    class?: string
  }

  let {
    result,
    imagePreviewUrl = null,
    source,
    onScanAgain,
    onGenerateQr,
    class: className,
  }: Props = $props()

  const KIND_META: Record<ParsedQrKind, { label: string; icon: Component }> = {
    url: { label: "Link", icon: Link },
    text: { label: "Text", icon: Type },
    email: { label: "E-mail", icon: Mail },
    phone: { label: "Phone", icon: Phone },
    sms: { label: "SMS", icon: MessageSquare },
    whatsapp: { label: "WhatsApp", icon: MessageCircle },
    wifi: { label: "Wi-Fi", icon: Wifi },
    vcard: { label: "Contact card", icon: ContactRound },
    mecard: { label: "Contact card", icon: Contact },
    geo: { label: "Location", icon: MapPin },
    event: { label: "Calendar event", icon: CalendarDays },
    crypto: { label: "Crypto payment", icon: Bitcoin },
    epc: { label: "SEPA transfer", icon: Landmark },
    app: { label: "App", icon: Smartphone },
    social: { label: "Social profile", icon: Share2 },
    paypal: { label: "PayPal", icon: Wallet },
  }

  const SOURCE_LABELS: Record<string, string> = {
    camera: "Camera",
    upload: "Upload",
    drop: "Dropped file",
    paste: "Clipboard",
    history: "History",
  }

  let revealed = $state(false)

  $effect(() => {
    if (result) revealed = false
  })

  const meta = $derived(KIND_META[result.kind] ?? { label: "QR code", icon: QrCode })
  const sourceLabel = $derived(source ? (SOURCE_LABELS[source] ?? source) : null)
  const hasSecret = $derived(result.fields.some((field) => field.kind === "secret"))

  async function copyValue(value: string, message = "Copied to clipboard") {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      toast.success(message)
    } catch {
      toast.error("Could not copy to the clipboard")
    }
  }

  function isExternalAction(actionId: string): boolean {
    return (
      actionId.startsWith("open") || actionId === "add-to-calendar" || actionId === "save-contact"
    )
  }
</script>

<div
  class={cn("space-y-4 rounded-lg border bg-muted/40 p-5", className)}
  role="region"
  aria-live="polite"
>
  <div class="flex items-start gap-3">
    {#if imagePreviewUrl}
      <img
        src={imagePreviewUrl}
        alt="Scanned QR code"
        class="size-16 shrink-0 rounded-md border bg-background object-contain p-1"
      />
    {/if}
    {#if meta}
      {@const Icon = meta.icon}
      <div
        class="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
      >
        <Icon class="size-5" />
      </div>
    {/if}
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <span
          class="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium tracking-wide text-primary uppercase"
          >{meta.label}</span
        >
        {#if sourceLabel}
          <span class="text-[11px] text-muted-foreground">via {sourceLabel}</span>
        {/if}
      </div>
      <h3 class="mt-1 truncate text-base font-semibold" title={result.title}>{result.title}</h3>
      {#if result.subtitle}
        <p class="truncate text-sm text-muted-foreground" title={result.subtitle}>
          {result.subtitle}
        </p>
      {/if}
    </div>
  </div>

  {#if result.fields.length > 0}
    <div class="overflow-hidden rounded-md border bg-background">
      {#each result.fields as field, index (field.label + "-" + index)}
        <div class="flex items-start justify-between gap-3 px-3 py-2.5">
          <div class="min-w-0 flex-1">
            <p class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {field.label}
            </p>
            {#if field.kind === "secret"}
              <p class="font-mono text-sm break-all">
                {revealed ? field.value : "•".repeat(Math.min(16, field.value.length))}
              </p>
            {:else if field.href && (field.kind === "url" || field.kind === "email" || field.kind === "tel")}
              <a
                href={field.href}
                class="text-sm break-all text-primary underline-offset-4 hover:underline"
                target={field.kind === "url" ? "_blank" : undefined}
                rel={field.kind === "url" ? "noopener noreferrer" : undefined}
              >
                {field.value}
              </a>
            {:else}
              <p class="text-sm break-words whitespace-pre-line">{field.value}</p>
            {/if}
          </div>
          <div class="flex shrink-0 items-center gap-1">
            {#if field.kind === "secret"}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={revealed ? "Hide " + field.label : "Show " + field.label}
                onclick={() => (revealed = !revealed)}
              >
                {#if revealed}
                  <EyeOff class="size-3.5" />
                {:else}
                  <Eye class="size-3.5" />
                {/if}
              </Button>
            {/if}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={"Copy " + field.label}
              onclick={() => copyValue(field.value, field.label + " copied")}
            >
              <Copy class="size-3.5" />
            </Button>
          </div>
        </div>
        {#if index < result.fields.length - 1}
          <Separator />
        {/if}
      {/each}
    </div>
  {/if}

  {#if hasSecret}
    <p class="text-xs text-muted-foreground">
      Passwords stay on this device — they are never sent to a server.
    </p>
  {/if}

  {#if result.actions.length > 0}
    <div class="flex flex-wrap gap-2">
      {#each result.actions as action, index (action.id)}
        {#if action.kind === "copy"}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onclick={() =>
              copyValue(action.value ?? "", action.label.replace("Copy ", "").trim() + " copied")}
          >
            <Copy class="size-3.5" />
            {action.label}
          </Button>
        {:else if action.href}
          <Button
            type="button"
            variant={index === 0 ? "default" : "outline"}
            size="sm"
            href={action.href}
            download={action.download}
            target={!action.download && isExternalAction(action.id) ? "_blank" : undefined}
            rel={!action.download && isExternalAction(action.id)
              ? "noopener noreferrer"
              : undefined}
          >
            {#if action.kind === "download"}
              {action.label}
            {:else}
              <ExternalLink class="size-3.5" />
              {action.label}
            {/if}
          </Button>
        {/if}
      {/each}
    </div>
  {/if}

  <details class="group rounded-md border bg-background/60">
    <summary
      class="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground select-none hover:text-foreground"
    >
      Raw payload · {result.raw.length} characters
    </summary>
    <div class="space-y-2 border-t px-3 py-2.5">
      <pre class="max-h-32 overflow-auto text-xs break-all whitespace-pre-wrap">{result.raw}</pre>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onclick={() => copyValue(result.raw, "Raw payload copied")}
      >
        <Copy class="size-3" />
        Copy raw
      </Button>
    </div>
  </details>

  <div class="flex flex-wrap gap-2">
    {#if onGenerateQr}
      <Button type="button" variant="outline" size="sm" onclick={() => onGenerateQr?.(result.raw)}>
        <QrCode class="size-3.5" />
        Generate QR
      </Button>
    {/if}
    {#if onScanAgain}
      <Button type="button" variant="ghost" size="sm" onclick={onScanAgain}>
        <RotateCcw class="size-3.5" />
        Scan another
      </Button>
    {/if}
  </div>
</div>
