<script lang="ts">
  import {
    Activity,
    CalendarIcon,
    Download,
    LayoutGrid,
    LayoutList,
    MousePointerClick,
    Plus,
    QrCode as QrCodeIcon,
    ScanLine,
    Search,
    TrendingUp,
    Users,
    X,
  } from "@lucide/svelte"
  import { goto, invalidateAll } from "$app/navigation"
  import { formatNumber, StatCard } from "$lib/components/analytics"
  import BulkActionsBar from "$lib/components/qr/bulk-actions-bar.svelte"
  import QrCard from "$lib/components/qr/qr-card.svelte"
  import QrListView from "$lib/components/qr/qr-list-view.svelte"
  import QrScanner from "$lib/components/qr/qr-scanner.svelte"
  import { Button, buttonVariants } from "$lib/components/ui/button"
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
  import { Popover, PopoverContent, PopoverTrigger } from "$lib/components/ui/popover"
  import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/select"
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs"
  import { downloadBlob } from "$lib/qr/export"
  import { onMount } from "svelte"
  import { toast } from "svelte-sonner"

  import type { PageData } from "./$types"

  type SortKey = "created" | "updated" | "scans" | "title"
  type SortDirection = "asc" | "desc"
  type TypeFilter = "all" | "static" | "dynamic"
  type StatusFilter = "all" | "active" | "paused" | "archived"
  type BulkAction = "activate" | "pause" | "archive" | "delete" | "duplicate"

  const SORT_OPTIONS: { value: string; label: string }[] = [
    { value: "created-desc", label: "Newest first" },
    { value: "created-asc", label: "Oldest first" },
    { value: "title-asc", label: "Name A–Z" },
    { value: "title-desc", label: "Name Z–A" },
    { value: "scans-desc", label: "Most scanned" },
    { value: "updated-desc", label: "Recently updated" },
  ]

  const BULK_MESSAGES: Record<BulkAction, (count: number) => string> = {
    activate: (count) => `${count} QR code${count === 1 ? "" : "s"} activated`,
    pause: (count) => `${count} QR code${count === 1 ? "" : "s"} paused`,
    archive: (count) => `${count} QR code${count === 1 ? "" : "s"} archived`,
    delete: (count) => `${count} QR code${count === 1 ? "" : "s"} deleted`,
    duplicate: (count) => `${count} QR code${count === 1 ? "" : "s"} duplicated`,
  }

  let { data }: { data: PageData } = $props()

  let activeTab = $state("codes")
  let searchQuery = $state("")
  let typeFilter = $state<TypeFilter>("all")
  let statusFilter = $state<StatusFilter>("all")
  let tagFilter = $state("all")
  let sortKey = $state<SortKey>("created")
  let sortDirection = $state<SortDirection>("desc")
  let dateFrom = $state("")
  let dateTo = $state("")
  let viewMode = $state<"list" | "grid">("list")
  let selectedIds = $state<string[]>([])
  let bulkBusy = $state(false)
  let deleteIds = $state<string[] | null>(null)
  let deleteOpen = $state(false)
  let viewLoaded = $state(false)

  onMount(() => {
    const saved = localStorage.getItem("dashboard-view-mode")
    if (saved === "list" || saved === "grid") viewMode = saved
    viewLoaded = true
  })

  $effect(() => {
    if (!viewLoaded) return
    localStorage.setItem("dashboard-view-mode", viewMode)
  })

  const sortOption = $derived(`${sortKey}-${sortDirection}`)

  const filteredRows = $derived.by(() => {
    const query = searchQuery.trim().toLowerCase()
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null

    const filtered = data.qrCodes.filter((qrCode) => {
      if (typeFilter !== "all" && qrCode.type !== typeFilter) return false
      if (statusFilter !== "all" && qrCode.status !== statusFilter) return false
      if (tagFilter !== "all" && !qrCode.tags.includes(tagFilter)) return false

      const created = new Date(qrCode.createdAt).getTime()
      if (from !== null && created < from) return false
      if (to !== null && created > to) return false

      if (query) {
        const haystack = [
          qrCode.title,
          qrCode.description,
          qrCode.shortCode,
          qrCode.destinationUrl,
          qrCode.encodedData,
          qrCode.contentType,
          ...qrCode.tags,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })

    const direction = sortDirection === "asc" ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sortKey === "title") {
        return (a.title ?? "").localeCompare(b.title ?? "") * direction
      }
      if (sortKey === "scans") {
        return (a.scanCount - b.scanCount) * direction
      }
      if (sortKey === "updated") {
        return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * direction
      }
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction
    })
  })

  const hasActiveFilters = $derived(
    searchQuery.trim() !== "" ||
      typeFilter !== "all" ||
      statusFilter !== "all" ||
      tagFilter !== "all" ||
      dateFrom !== "" ||
      dateTo !== "",
  )

  const allSelected = $derived(
    filteredRows.length > 0 && filteredRows.every((row) => selectedIds.includes(row.id)),
  )
  const someSelected = $derived(selectedIds.length > 0 && !allSelected)

  function toggleViewMode() {
    viewMode = viewMode === "list" ? "grid" : "list"
  }

  function toggleSelect(id: string) {
    selectedIds = selectedIds.includes(id)
      ? selectedIds.filter((selected) => selected !== id)
      : [...selectedIds, id]
  }

  function toggleSelectAll() {
    selectedIds = allSelected ? [] : filteredRows.map((row) => row.id)
  }

  function clearSelection() {
    selectedIds = []
  }

  function clearFilters() {
    searchQuery = ""
    typeFilter = "all"
    statusFilter = "all"
    tagFilter = "all"
    dateFrom = ""
    dateTo = ""
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc"
      return
    }
    sortKey = key
    sortDirection = key === "title" ? "asc" : "desc"
  }

  function handleSortOptionChange(value: string) {
    const [key, direction] = value.split("-") as [SortKey, SortDirection]
    sortKey = key
    sortDirection = direction
  }

  function openDeleteDialog(ids: string[]) {
    if (ids.length === 0) return
    deleteIds = ids
    deleteOpen = true
  }

  async function runBulkAction(
    action: BulkAction,
    ids: string[],
    options: { clearSelection?: boolean } = {},
  ) {
    if (ids.length === 0 || bulkBusy) return
    bulkBusy = true
    try {
      const response = await fetch("/api/qr/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(payload?.message ?? `Request failed (${response.status})`)
      }
      const result = (await response.json()) as {
        succeeded?: number
        failed?: number
      }
      const succeeded = result.succeeded ?? 0
      if ((result.failed ?? 0) > 0) {
        toast.warning(`${succeeded} updated, ${result.failed} failed`)
      } else {
        toast.success(BULK_MESSAGES[action](succeeded))
      }
      if (options.clearSelection !== false) selectedIds = []
      await invalidateAll()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk action failed")
    } finally {
      bulkBusy = false
    }
  }

  async function handleToggleStatus(id: string) {
    const row = data.qrCodes.find((qrCode) => qrCode.id === id)
    if (!row) return
    await runBulkAction(row.status === "active" ? "pause" : "activate", [id], {
      clearSelection: false,
    })
  }

  async function confirmDelete() {
    const ids = deleteIds ?? []
    deleteOpen = false
    deleteIds = null
    await runBulkAction("delete", ids)
  }

  function buildLocalCsv(ids?: string[]): string {
    const rows =
      ids && ids.length > 0
        ? data.qrCodes.filter((qrCode) => ids.includes(qrCode.id))
        : filteredRows
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`
    const header = [
      "title",
      "type",
      "status",
      "content_type",
      "short_code",
      "short_url",
      "target",
      "tags",
      "scans",
      "unique_scans",
      "last_scanned_at",
      "created_at",
      "updated_at",
    ]
    const lines = [header.join(",")]
    for (const qrCode of rows) {
      const shortUrl = qrCode.shortCode ? `${data.origin}/${qrCode.shortCode}` : ""
      const target = qrCode.type === "dynamic" ? shortUrl : qrCode.encodedData
      lines.push(
        [
          escape(qrCode.title),
          escape(qrCode.type),
          escape(qrCode.status),
          escape(qrCode.contentType),
          escape(qrCode.shortCode),
          escape(shortUrl),
          escape(target),
          escape(qrCode.tags.join("|")),
          qrCode.scanCount,
          qrCode.uniqueScanCount,
          escape(qrCode.lastScannedAt ? new Date(qrCode.lastScannedAt).toISOString() : ""),
          escape(new Date(qrCode.createdAt).toISOString()),
          escape(new Date(qrCode.updatedAt).toISOString()),
        ].join(","),
      )
    }
    return lines.join("\n")
  }

  async function exportCsv(ids?: string[]) {
    const query = ids && ids.length > 0 ? `?ids=${encodeURIComponent(ids.join(","))}` : ""
    try {
      const response = await fetch(`/api/qr/export${query}`)
      if (!response.ok) throw new Error("Export endpoint unavailable")
      downloadBlob(await response.blob(), "qr-codes.csv")
      toast.success("CSV exported")
    } catch {
      const csv = buildLocalCsv(ids)
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "qr-codes.csv")
      toast.success("CSV exported")
    }
  }

  function handleGenerateQr(payload: string) {
    goto(`/studio?data=${encodeURIComponent(payload)}`)
  }
</script>

<section class="space-y-8">
  <header class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
    <div class="space-y-1">
      <p class="text-sm font-semibold tracking-[0.2em] text-primary uppercase">Dashboard</p>
      <h1 class="text-3xl font-bold tracking-tight">QR code manager</h1>
      <p class="text-muted-foreground">Create, manage and measure every QR code you own.</p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <Button variant="outline" class="gap-2" onclick={() => exportCsv()}>
        <Download class="size-4" />
        Export CSV
      </Button>
      <Button href="/studio" class="gap-2">
        <Plus class="size-4" />
        New QR code
      </Button>
    </div>
  </header>

  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
    <StatCard
      label="QR codes"
      value={formatNumber(data.overview.totalCodes)}
      hint={`${formatNumber(data.overview.dynamicCodes)} dynamic · ${formatNumber(
        data.overview.totalCodes - data.overview.dynamicCodes,
      )} static`}
    >
      {#snippet icon()}<QrCodeIcon class="size-5" />{/snippet}
    </StatCard>
    <StatCard
      label="Total scans"
      value={formatNumber(data.overview.totalScans)}
      hint="Lifetime scans across all codes"
    >
      {#snippet icon()}<MousePointerClick class="size-5" />{/snippet}
    </StatCard>
    <StatCard
      label="Unique scans"
      value={formatNumber(data.overview.uniqueScans)}
      hint="One per visitor per code, per day"
    >
      {#snippet icon()}<Users class="size-5" />{/snippet}
    </StatCard>
    <StatCard
      label="Active codes"
      value={formatNumber(data.overview.activeCodes)}
      hint={`${formatNumber(data.overview.pausedCodes)} paused · ${formatNumber(
        data.overview.archivedCodes,
      )} archived`}
    >
      {#snippet icon()}<Activity class="size-5" />{/snippet}
    </StatCard>
    <StatCard
      label="Scans · last 7 days"
      value={formatNumber(data.overview.scansLast7d)}
      hint={`${formatNumber(data.overview.uniqueScansLast7d)} unique`}
    >
      {#snippet icon()}<TrendingUp class="size-5" />{/snippet}
    </StatCard>
  </div>

  <Tabs bind:value={activeTab} class="space-y-6">
    <div class="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
      <TabsList class="w-full sm:w-auto">
        <TabsTrigger value="codes">Codes</TabsTrigger>
        <TabsTrigger value="scan">
          <ScanLine class="size-4" />
          Scan
        </TabsTrigger>
      </TabsList>
      {#if activeTab === "codes"}
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onclick={toggleViewMode}
            aria-label={`Switch to ${viewMode === "list" ? "grid" : "list"} view`}
          >
            {#if viewMode === "list"}
              <LayoutGrid class="size-4" />
            {:else}
              <LayoutList class="size-4" />
            {/if}
          </Button>
        </div>
      {/if}
    </div>

    <TabsContent value="codes" class="space-y-4">
      {#if data.qrCodes.length === 0}
        <div
          class="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/40 p-10 text-center"
        >
          <div class="mx-auto flex max-w-md flex-col items-center">
            <div class="rounded-2xl border bg-background p-4 shadow-xs">
              <QrCodeIcon class="size-8 text-muted-foreground" />
            </div>
            <h2 class="mt-5 text-xl font-semibold">No QR codes yet</h2>
            <p class="mt-2 mb-5 text-sm text-muted-foreground">
              Design your first QR code in the Studio, then track every scan from this dashboard.
            </p>
            <Button href="/studio" class="gap-2">
              <Plus class="size-4" />
              Create your first QR code
            </Button>
          </div>
        </div>
      {:else}
        <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div class="relative w-full xl:max-w-md">
            <Search
              class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              bind:value={searchQuery}
              type="search"
              placeholder="Search title, short code, destination or tag..."
              class="pl-9"
              aria-label="Search QR codes"
            />
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Select
              type="single"
              value={typeFilter}
              onValueChange={(value) => {
                if (value) typeFilter = value as TypeFilter
              }}
            >
              <SelectTrigger class="w-[132px]">
                <span
                  >{typeFilter === "all"
                    ? "All types"
                    : typeFilter === "static"
                      ? "Static"
                      : "Dynamic"}</span
                >
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="static">Static</SelectItem>
                <SelectItem value="dynamic">Dynamic</SelectItem>
              </SelectContent>
            </Select>

            <Select
              type="single"
              value={statusFilter}
              onValueChange={(value) => {
                if (value) statusFilter = value as StatusFilter
              }}
            >
              <SelectTrigger class="w-[136px]">
                <span
                  >{statusFilter === "all"
                    ? "All statuses"
                    : statusFilter === "active"
                      ? "Active"
                      : statusFilter === "paused"
                        ? "Paused"
                        : "Archived"}</span
                >
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            {#if data.tags.length > 0}
              <Select
                type="single"
                value={tagFilter}
                onValueChange={(value) => {
                  if (value) tagFilter = value
                }}
              >
                <SelectTrigger class="w-[128px]">
                  <span>{tagFilter === "all" ? "All tags" : `#${tagFilter}`}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tags</SelectItem>
                  {#each data.tags as tag (tag)}
                    <SelectItem value={tag}>#{tag}</SelectItem>
                  {/each}
                </SelectContent>
              </Select>
            {/if}

            <Select
              type="single"
              value={sortOption}
              onValueChange={(value) => {
                if (value) handleSortOptionChange(value)
              }}
            >
              <SelectTrigger class="w-[160px]">
                <span
                  >{SORT_OPTIONS.find((option) => option.value === sortOption)?.label ??
                    "Sort"}</span
                >
              </SelectTrigger>
              <SelectContent>
                {#each SORT_OPTIONS as option (option.value)}
                  <SelectItem value={option.value}>{option.label}</SelectItem>
                {/each}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger class={buttonVariants({ variant: "outline", size: "default" })}>
                <CalendarIcon class="size-4" />
                {#if dateFrom || dateTo}
                  {dateFrom || "Start"} – {dateTo || "Today"}
                {:else}
                  Created
                {/if}
              </PopoverTrigger>
              <PopoverContent class="w-64 p-4" align="end">
                <div class="space-y-3">
                  <div class="space-y-1.5">
                    <span class="text-sm font-medium">Created from</span>
                    <Input type="date" bind:value={dateFrom} aria-label="Created from" />
                  </div>
                  <div class="space-y-1.5">
                    <span class="text-sm font-medium">Created until</span>
                    <Input type="date" bind:value={dateTo} aria-label="Created until" />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    class="w-full"
                    onclick={() => {
                      dateFrom = ""
                      dateTo = ""
                    }}
                  >
                    Clear dates
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {#if hasActiveFilters}
              <Button variant="ghost" size="sm" onclick={clearFilters}>
                <X class="size-4" />
                Clear
              </Button>
            {/if}
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-muted-foreground" aria-live="polite">
            Showing {formatNumber(filteredRows.length)} of {formatNumber(data.totalCodes)} codes
            {#if selectedIds.length > 0}
              · {formatNumber(selectedIds.length)} selected
            {/if}
          </p>
          {#if data.totalCodes > data.qrCodes.length}
            <p class="text-xs text-muted-foreground">
              Showing the {formatNumber(data.qrCodes.length)} most recent codes
            </p>
          {/if}
        </div>

        <BulkActionsBar
          selectedCount={selectedIds.length}
          busy={bulkBusy}
          onActivate={() => runBulkAction("activate", selectedIds)}
          onPause={() => runBulkAction("pause", selectedIds)}
          onArchive={() => runBulkAction("archive", selectedIds)}
          onDuplicate={() => runBulkAction("duplicate", selectedIds)}
          onExport={() => exportCsv(selectedIds)}
          onDelete={() => openDeleteDialog(selectedIds)}
          onClearSelection={clearSelection}
        />

        {#if filteredRows.length === 0}
          <div class="rounded-2xl border border-dashed bg-muted/40 p-10 text-center">
            <p class="text-sm font-medium">No QR codes match your filters.</p>
            <p class="mt-1 text-sm text-muted-foreground">
              Try clearing the search or switching filters.
            </p>
            <Button variant="outline" class="mt-4" onclick={clearFilters}>Clear filters</Button>
          </div>
        {:else if viewMode === "list"}
          <QrListView
            rows={filteredRows}
            origin={data.origin}
            {selectedIds}
            {allSelected}
            {someSelected}
            {sortKey}
            {sortDirection}
            onToggle={toggleSelect}
            onToggleAll={toggleSelectAll}
            onSort={handleSort}
            onDelete={(id) => openDeleteDialog([id])}
            onToggleStatus={handleToggleStatus}
          />
        {:else}
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {#each filteredRows as row (row.id)}
              <QrCard
                qrCode={row}
                design={row.design}
                origin={data.origin}
                selected={selectedIds.includes(row.id)}
                onSelectChange={toggleSelect}
                onDelete={(id) => openDeleteDialog([id])}
                onToggleStatus={handleToggleStatus}
              />
            {/each}
          </div>
        {/if}
      {/if}
    </TabsContent>

    <TabsContent value="scan" class="space-y-6">
      <QrScanner user={data.user} onGenerateQr={handleGenerateQr} onScan={() => undefined} />
    </TabsContent>
  </Tabs>

  <Dialog open={deleteOpen} onOpenChange={(open) => (deleteOpen = open)}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          Delete {deleteIds?.length ?? 0} QR code{(deleteIds?.length ?? 0) === 1 ? "" : "s"}?
        </DialogTitle>
        <DialogDescription>
          The selected codes and their analytics are permanently removed, and their short links stop
          working. This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose class={buttonVariants({ variant: "outline" })}>Cancel</DialogClose>
        <Button variant="destructive" onclick={confirmDelete} disabled={bulkBusy}>Delete</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</section>
