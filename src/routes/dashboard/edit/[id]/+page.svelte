<script lang="ts">
  import {
    ArrowLeft,
    BarChart3,
    CalendarClock,
    ChevronRight,
    Copy,
    ExternalLink,
    Save,
    Trash2,
    Wand2,
  } from "@lucide/svelte"
  import type { SubmitFunction } from "@sveltejs/kit"
  import { enhance } from "$app/forms"
  import { goto, invalidateAll } from "$app/navigation"
  import {
    contentTypeLabel,
    formatDateTime,
    formatNumber,
    formatScanMoment,
    qrDisplayTitle,
    QrPreview,
    statusBadgeVariant,
    statusLabel,
  } from "$lib/components/analytics"
  import { Badge } from "$lib/components/ui/badge"
  import { Button, buttonVariants } from "$lib/components/ui/button"
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card"
  import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "$lib/components/ui/dialog"
  import { Input } from "$lib/components/ui/input"
  import { Label } from "$lib/components/ui/label"
  import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/select"
  import { Textarea } from "$lib/components/ui/textarea"
  import { toast } from "svelte-sonner"

  import type { ActionData, PageData } from "./$types"

  let { data, form }: { data: PageData; form: ActionData } = $props()

  let title = $state(data.qrCode.title ?? "")
  let description = $state(data.qrCode.description ?? "")
  let destinationUrl = $state(data.qrCode.destinationUrl ?? "")
  let status = $state<"active" | "paused" | "archived">(data.qrCode.status)
  let expiresAt = $state(data.expiresAtLocal)
  let tagsInput = $state(data.qrCode.tags.join(", "))
  let passwordAction = $state<"keep" | "set" | "clear">("keep")
  let password = $state("")
  let saving = $state(false)
  let deleteOpen = $state(false)

  const displayTitle = $derived(qrDisplayTitle(data.qrCode))
  const shortUrl = $derived(
    data.qrCode.shortCode ? `${data.origin}/${data.qrCode.shortCode}` : null,
  )

  const handleEnhance: SubmitFunction<
    { success: boolean; message: string },
    { error: string }
  > = () => {
    saving = true
    return async ({ result, update }) => {
      saving = false
      await update({ reset: false })
      if (result.type === "success") {
        toast.success(result.data?.message ?? "QR code updated")
        await invalidateAll()
      } else if (result.type === "failure") {
        toast.error(result.data?.error ?? "Could not save the changes")
      }
    }
  }

  async function copyShortUrl() {
    if (!shortUrl) return
    try {
      await navigator.clipboard.writeText(shortUrl)
      toast.success("Short link copied")
    } catch {
      toast.error("Could not copy the short link")
    }
  }

  function clearExpiry() {
    expiresAt = ""
  }

  async function handleDelete() {
    try {
      const response = await fetch(`/api/qr/${data.qrCode.id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Delete failed")
      toast.success("QR code deleted")
      await goto("/dashboard")
    } catch {
      toast.error("Could not delete this QR code")
    }
  }
</script>

<div class="space-y-6">
  <nav class="flex items-center gap-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
    <a href="/" class="hover:text-foreground">Home</a>
    <ChevronRight class="size-4" aria-hidden="true" />
    <a href="/dashboard" class="hover:text-foreground">Dashboard</a>
    <ChevronRight class="size-4" aria-hidden="true" />
    <span class="text-foreground">Edit</span>
  </nav>

  <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
    <div class="flex items-start gap-3">
      <Button
        variant="ghost"
        size="icon"
        onclick={() => goto("/dashboard")}
        aria-label="Back to dashboard"
      >
        <ArrowLeft class="size-4" />
      </Button>
      <div class="space-y-1">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-2xl font-bold tracking-tight md:text-3xl">{displayTitle}</h1>
          <Badge variant={data.qrCode.type === "dynamic" ? "default" : "secondary"}>
            {data.qrCode.type}
          </Badge>
          <Badge variant={statusBadgeVariant(data.qrCode.status)}>
            {statusLabel(data.qrCode.status)}
          </Badge>
        </div>
        <p class="text-sm text-muted-foreground">
          {contentTypeLabel(data.qrCode.contentType)} · Edit details, lifecycle and access
        </p>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <Button href={`/dashboard/analytics/${data.qrCode.id}`} variant="outline" class="gap-2">
        <BarChart3 class="size-4" />
        Analytics
      </Button>
      <Button href={`/studio?edit=${data.qrCode.id}`} variant="outline" class="gap-2">
        <Wand2 class="size-4" />
        Customize design
      </Button>
      <Button variant="destructive-outline" class="gap-2" onclick={() => (deleteOpen = true)}>
        <Trash2 class="size-4" />
        Delete
      </Button>
    </div>
  </div>

  {#if form && "error" in form && form.error}
    <div
      class="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground"
      role="alert"
    >
      {form.error}
    </div>
  {/if}

  <form method="POST" action="?/save" use:enhance={handleEnhance}>
    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div class="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>How this code appears in your dashboard.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="space-y-2">
              <Label for="qr-title">Title</Label>
              <Input
                id="qr-title"
                name="title"
                bind:value={title}
                maxlength={100}
                placeholder="e.g. Menu – table 4"
              />
            </div>

            <div class="space-y-2">
              <Label for="qr-description">Description</Label>
              <Textarea
                id="qr-description"
                name="description"
                bind:value={description}
                rows={3}
                maxlength={500}
                placeholder="Optional notes for your team"
              />
            </div>

            <div class="space-y-2">
              <Label for="qr-tags">Tags</Label>
              <Input
                id="qr-tags"
                name="tags"
                bind:value={tagsInput}
                placeholder="marketing, menu, print"
              />
              <p class="text-xs text-muted-foreground">
                Comma separated. Tags make it easy to filter large libraries.
              </p>
            </div>

            {#if data.qrCode.type === "dynamic"}
              <div class="space-y-2">
                <Label for="qr-destination">Destination URL</Label>
                <Input
                  id="qr-destination"
                  name="destinationUrl"
                  type="url"
                  bind:value={destinationUrl}
                  placeholder="https://example.com/landing"
                />
                <p class="text-xs text-muted-foreground">
                  Dynamic codes keep working when you change this URL — no reprinting needed.
                </p>
              </div>
            {:else}
              <div class="space-y-2 rounded-lg border bg-muted/40 p-3">
                <p class="text-sm font-medium">Encoded content</p>
                <p class="font-mono text-xs break-all text-muted-foreground">
                  {data.qrCode.encodedData}
                </p>
                <p class="text-xs text-muted-foreground">
                  Static codes embed fixed content. Recreate the code in the Studio to change what
                  it contains.
                </p>
              </div>
            {/if}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lifecycle</CardTitle>
            <CardDescription>Pause, schedule or archive this code.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <Label for="qr-status">Status</Label>
                <Select
                  type="single"
                  value={status}
                  onValueChange={(value) => {
                    if (value) status = value as typeof status
                  }}
                >
                  <SelectTrigger class="w-full">
                    <span>{statusLabel(status)}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="status" value={status} />
                <p class="text-xs text-muted-foreground">
                  Paused and archived codes return HTTP 410 to scanners.
                </p>
              </div>

              <div class="space-y-2">
                <Label for="qr-expiry">Expires at</Label>
                <Input
                  id="qr-expiry"
                  name="expiresAt"
                  type="datetime-local"
                  bind:value={expiresAt}
                />
                <div class="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onclick={clearExpiry}
                    disabled={!expiresAt}
                  >
                    <CalendarClock class="size-4" />
                    Clear expiry
                  </Button>
                  <span class="text-xs text-muted-foreground">Server time</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Password protection</CardTitle>
            <CardDescription>
              Require visitors to enter a password before the link unlocks.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex flex-wrap items-center gap-2 text-sm">
              {#if data.hasPassword}
                <Badge variant="success">Password protected</Badge>
              {:else}
                <Badge variant="outline">No password</Badge>
              {/if}
              <span class="text-muted-foreground">
                A 30 minute unlock cookie is issued after a correct password.
              </span>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <Label for="qr-password-action">Password action</Label>
                <Select
                  type="single"
                  value={passwordAction}
                  onValueChange={(value) => {
                    if (value) passwordAction = value as typeof passwordAction
                  }}
                >
                  <SelectTrigger class="w-full">
                    <span>
                      {passwordAction === "keep"
                        ? "Keep current"
                        : passwordAction === "set"
                          ? "Set new password"
                          : "Remove password"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">Keep current</SelectItem>
                    <SelectItem value="set">Set new password</SelectItem>
                    <SelectItem value="clear">Remove password</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="passwordAction" value={passwordAction} />
              </div>

              {#if passwordAction === "set"}
                <div class="space-y-2">
                  <Label for="qr-password">New password</Label>
                  <Input
                    id="qr-password"
                    name="password"
                    type="password"
                    bind:value={password}
                    autocomplete="new-password"
                    minlength={4}
                    placeholder="At least 4 characters"
                  />
                </div>
              {/if}
            </div>
          </CardContent>
        </Card>

        <div class="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" onclick={() => goto("/dashboard")}>Cancel</Button>
          <Button type="submit" disabled={saving} class="gap-2">
            <Save class="size-4" />
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <div class="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Rendered from the design saved in the Studio.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex justify-center">
              <QrPreview
                qr={data.qrCode}
                design={data.design}
                origin={data.origin}
                size={512}
                class="size-56 bg-white p-3"
              />
            </div>

            {#if shortUrl}
              <div class="space-y-2">
                <p class="text-xs font-medium text-muted-foreground uppercase">Short link</p>
                <div class="flex items-center gap-2">
                  <code
                    class="min-w-0 flex-1 truncate rounded-md border bg-muted/50 px-2 py-1 text-xs"
                  >
                    {shortUrl}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onclick={copyShortUrl}
                    aria-label="Copy short link"
                  >
                    <Copy class="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    href={shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open short link"
                  >
                    <ExternalLink class="size-4" />
                  </Button>
                </div>
              </div>
            {/if}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
            <CardDescription>Lifetime performance for this code.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl class="space-y-3 text-sm">
              <div class="flex items-center justify-between">
                <dt class="text-muted-foreground">Total scans</dt>
                <dd class="text-lg font-semibold tabular-nums">
                  {formatNumber(data.qrCode.scanCount)}
                </dd>
              </div>
              <div class="flex items-center justify-between">
                <dt class="text-muted-foreground">Unique scans</dt>
                <dd class="font-medium tabular-nums">
                  {formatNumber(data.qrCode.uniqueScanCount)}
                </dd>
              </div>
              <div class="flex items-center justify-between">
                <dt class="text-muted-foreground">Last scan</dt>
                <dd class="font-medium">{formatScanMoment(data.qrCode.lastScannedAt)}</dd>
              </div>
              <div class="flex items-center justify-between border-t pt-3">
                <dt class="text-muted-foreground">Created</dt>
                <dd class="text-xs">{formatDateTime(data.qrCode.createdAt)}</dd>
              </div>
              <div class="flex items-center justify-between">
                <dt class="text-muted-foreground">Updated</dt>
                <dd class="text-xs">{formatDateTime(data.qrCode.updatedAt)}</dd>
              </div>
              {#if data.qrCode.expiresAt}
                <div class="flex items-center justify-between">
                  <dt class="text-muted-foreground">Expires</dt>
                  <dd class="text-xs">{formatDateTime(data.qrCode.expiresAt)}</dd>
                </div>
              {/if}
            </dl>
            <Button
              href={`/dashboard/analytics/${data.qrCode.id}`}
              variant="outline"
              size="sm"
              class="mt-4 w-full gap-2"
            >
              <BarChart3 class="size-4" />
              Open full analytics
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  </form>

  <Dialog open={deleteOpen} onOpenChange={(open) => (deleteOpen = open)}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete this QR code?</DialogTitle>
        <DialogDescription>
          The code, its design and its scan history are permanently removed. The short link
          {shortUrl ? ` ${shortUrl} ` : " "}will stop working immediately.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose class={buttonVariants({ variant: "outline" })}>Cancel</DialogClose>
        <Button variant="destructive" onclick={handleDelete}>Delete</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</div>
