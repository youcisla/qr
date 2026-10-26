<script lang="ts">
  import { Camera, ScanLine, Upload } from "@lucide/svelte"
  import CameraScanner from "$lib/components/scan/camera-scanner.svelte"
  import ScanHistory from "$lib/components/scan/scan-history.svelte"
  import ScanResultCard from "$lib/components/scan/scan-result-card.svelte"
  import { Button } from "$lib/components/ui/button"
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card"
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs"
  import { parseQrPayload, type ParsedQrPayload } from "$lib/qr/parse"
  import {
    addScanHistoryEntry,
    clearScanHistory,
    isCameraSupported,
    loadScanHistory,
    removeScanHistoryEntry,
    scanQrCode,
    type ScanHistoryEntry,
    type ScanSource,
  } from "$lib/utils/qr-scanner"
  import { cn } from "$lib/utils/style"
  import { getScanCount, GUEST_SCAN_LIMIT, incrementScan } from "$lib/utils/usage-tracker"
  import { onMount } from "svelte"
  import { toast } from "svelte-sonner"

  interface Props {
    onScan?: (data: string) => void
    onGenerateQr?: (data: string) => void
    user?: { id: string } | null
    onResult?: (result: ParsedQrPayload) => void
    defaultMode?: "camera" | "file"
    class?: string
  }

  let {
    onScan,
    onGenerateQr,
    user = null,
    onResult,
    defaultMode = "camera",
    class: className,
  }: Props = $props()

  let mode = $state<"camera" | "file">(defaultMode)
  let cameraActive = $state(false)
  let fileInput = $state<HTMLInputElement | null>(null)
  let scanning = $state(false)
  let result = $state<ParsedQrPayload | null>(null)
  let error = $state<string | null>(null)
  let isDragging = $state(false)
  let imagePreviewUrl = $state<string | null>(null)
  let usageCount = $state(0)
  let history = $state<ScanHistoryEntry[]>([])
  let cameraSupported = $state(false)
  let pasteSupported = $state(false)
  let resultSource = $state<ScanSource>("upload")

  const isGuest = $derived(!user)
  const hasReachedLimit = $derived(isGuest && usageCount >= GUEST_SCAN_LIMIT)
  const remainingScans = $derived(Math.max(0, GUEST_SCAN_LIMIT - usageCount))

  onMount(() => {
    usageCount = getScanCount()
    history = loadScanHistory()
    cameraSupported = isCameraSupported()
    pasteSupported =
      typeof navigator.clipboard !== "undefined" || typeof ClipboardEvent !== "undefined"
    if (!cameraSupported && defaultMode === "camera") mode = "file"
  })

  $effect(() => {
    if (mode !== "camera") cameraActive = false
  })

  function cleanupPreview() {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
      imagePreviewUrl = null
    }
  }

  function generatePreview(file: File) {
    try {
      cleanupPreview()
      imagePreviewUrl = URL.createObjectURL(file)
    } catch (cause) {
      console.error("Failed to generate preview:", cause)
    }
  }

  $effect(() => {
    return () => {
      cleanupPreview()
    }
  })

  function handleDetected(data: string, source: ScanSource) {
    const parsed = parseQrPayload(data)
    result = parsed
    resultSource = source
    error = null
    scanning = false
    cameraActive = false

    onScan?.(data)
    onResult?.(parsed)

    if (isGuest) {
      incrementScan()
      usageCount = getScanCount()
      if (usageCount === Math.floor(GUEST_SCAN_LIMIT / 2)) {
        toast.info("You've used half your free scans", {
          description: "Sign in for unlimited QR scanning and analytics",
        })
      }
    }

    history = addScanHistoryEntry({
      data,
      kind: parsed.kind,
      title: parsed.title,
      source,
    })
  }

  async function processFile(file: File, source: ScanSource) {
    if (!file.type.startsWith("image/")) {
      error = "Please upload an image file"
      return
    }
    if (isGuest && usageCount >= GUEST_SCAN_LIMIT) {
      error = "You've reached your free scan limit. Sign in to continue scanning."
      return
    }

    cameraActive = false
    generatePreview(file)
    scanning = true
    error = null
    result = null

    try {
      const scanResult = await scanQrCode(file)
      if (scanResult.success && scanResult.data) {
        handleDetected(scanResult.data, source)
      } else {
        error = scanResult.error || "Could not read QR code from image"
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Failed to scan QR code"
    } finally {
      scanning = false
    }
  }

  async function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return
    await processFile(file, "upload")
  }

  async function handlePaste(event: ClipboardEvent) {
    if (scanning || hasReachedLimit) return
    const items = event.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile()
        if (file) {
          event.preventDefault()
          await processFile(file, "paste")
          break
        }
      }
    }
  }

  $effect(() => {
    if (typeof window === "undefined") return
    const listener = (event: ClipboardEvent) => {
      void handlePaste(event)
    }
    window.addEventListener("paste", listener)
    return () => {
      window.removeEventListener("paste", listener)
    }
  })

  function handleDragOver(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()
    isDragging = true
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()
    isDragging = false
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()
    isDragging = false
    const file = event.dataTransfer?.files[0]
    if (file) await processFile(file, "drop")
  }

  function handleUploadClick() {
    fileInput?.click()
  }

  function toggleCamera() {
    if (hasReachedLimit) {
      error = "You've reached your free scan limit. Sign in to continue scanning."
      return
    }
    if (!cameraActive) {
      result = null
      error = null
      cleanupPreview()
    }
    cameraActive = !cameraActive
  }

  function handleReset() {
    result = null
    error = null
    scanning = false
    cameraActive = false
    cleanupPreview()
    if (fileInput) fileInput.value = ""
  }

  function handleScanAnother() {
    handleReset()
    if (mode === "camera" && cameraSupported) cameraActive = true
  }

  function handleHistorySelect(entry: ScanHistoryEntry) {
    cameraActive = false
    error = null
    scanning = false
    cleanupPreview()
    result = parseQrPayload(entry.data)
    resultSource = "history"
  }

  function handleClearHistory() {
    clearScanHistory()
    history = []
  }

  function handleRemoveHistory(id: string) {
    history = removeScanHistoryEntry(id)
  }
</script>

<Card class={cn(className)}>
  <CardHeader>
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1">
        <CardTitle>Scan QR Code</CardTitle>
        <CardDescription>
          Scan with your camera, upload an image, or paste from the clipboard.
        </CardDescription>
      </div>
      {#if isGuest && !hasReachedLimit}
        <div class="flex items-center gap-2 rounded-md bg-muted px-3 py-1 text-sm">
          <span class="font-medium">{remainingScans}/{GUEST_SCAN_LIMIT}</span>
          <span class="text-muted-foreground">remaining</span>
        </div>
      {/if}
    </div>
  </CardHeader>

  <CardContent class="space-y-6">
    {#if hasReachedLimit}
      <div class="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-6">
        <div class="space-y-2">
          <h3 class="text-lg font-semibold">Free scan limit reached</h3>
          <p class="text-sm text-muted-foreground">
            You've used all {GUEST_SCAN_LIMIT} free QR scans. Sign in with Google to unlock:
          </p>
        </div>
        <ul class="space-y-2 text-sm">
          <li class="flex items-center gap-2">
            <div class="size-1.5 rounded-full bg-primary"></div>
            <span>Unlimited QR code scanning</span>
          </li>
          <li class="flex items-center gap-2">
            <div class="size-1.5 rounded-full bg-primary"></div>
            <span>Save and manage scanned QR codes</span>
          </li>
          <li class="flex items-center gap-2">
            <div class="size-1.5 rounded-full bg-primary"></div>
            <span>Analytics for your dynamic QR codes</span>
          </li>
          <li class="flex items-center gap-2">
            <div class="size-1.5 rounded-full bg-primary"></div>
            <span>Create unlimited QR codes</span>
          </li>
        </ul>
        <Button href="/auth/login" class="w-full">Sign in with Google</Button>
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div class="space-y-4">
          <Tabs bind:value={mode} class="space-y-4">
            <TabsList class="grid w-full grid-cols-2">
              <TabsTrigger value="camera" class="gap-1.5">
                <Camera class="size-4" />
                Camera
              </TabsTrigger>
              <TabsTrigger value="file" class="gap-1.5">
                <Upload class="size-4" />
                Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="camera" class="space-y-3">
              {#if cameraSupported}
                <div class="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={cameraActive ? "outline" : "default"}
                    onclick={toggleCamera}
                  >
                    <Camera class="size-4" />
                    {cameraActive ? "Stop camera" : "Start camera"}
                  </Button>
                  <span class="text-xs text-muted-foreground">
                    Video is processed locally and never uploaded.
                  </span>
                </div>
                <CameraScanner
                  active={cameraActive}
                  onDetect={(data) => handleDetected(data, "camera")}
                  onError={(message) => {
                    if (!cameraActive) error = message
                  }}
                />
              {:else}
                <div class="space-y-3 rounded-lg border bg-muted/50 p-6">
                  <div class="flex items-center gap-3">
                    <Camera class="size-6 text-muted-foreground" />
                    <div>
                      <p class="text-sm font-medium">Camera not available</p>
                      <p class="text-sm text-muted-foreground">
                        Your browser or connection does not allow camera access. Upload a QR image
                        instead.
                      </p>
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onclick={() => (mode = "file")}>
                    <Upload class="size-4" />
                    Upload an image
                  </Button>
                </div>
              {/if}
            </TabsContent>

            <TabsContent value="file">
              <input
                bind:this={fileInput}
                type="file"
                accept="image/*"
                onchange={handleFileChange}
                class="hidden"
                aria-label="Upload QR code image"
              />

              <div
                ondragover={handleDragOver}
                ondragleave={handleDragLeave}
                ondrop={handleDrop}
                class="relative flex min-h-[320px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none {isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50'}"
                onclick={handleUploadClick}
                role="button"
                tabindex="0"
                aria-label="Upload QR code image or paste from clipboard"
                onkeydown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    handleUploadClick()
                  }
                }}
              >
                {#if scanning}
                  <div class="flex flex-col items-center gap-4">
                    {#if imagePreviewUrl}
                      <img
                        src={imagePreviewUrl}
                        alt="Uploaded QR code"
                        class="max-h-[160px] max-w-[160px] rounded-lg border object-contain shadow-sm"
                      />
                    {/if}
                    <div class="flex flex-col items-center gap-3">
                      <svg
                        class="size-10 animate-spin text-primary"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          class="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="4"
                        ></circle>
                        <path
                          class="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <p
                        class="text-sm font-medium text-muted-foreground"
                        role="status"
                        aria-live="polite"
                      >
                        Scanning QR code...
                      </p>
                    </div>
                  </div>
                {:else}
                  <div class="flex flex-col items-center gap-4">
                    <div
                      class="flex size-16 items-center justify-center rounded-full bg-muted ring-8 ring-muted/50"
                    >
                      <Upload class="size-8 text-muted-foreground" />
                    </div>
                    <div class="space-y-2">
                      <p class="text-base font-medium text-foreground">
                        {isDragging
                          ? "Drop image here"
                          : pasteSupported
                            ? "Drag & drop, click to upload, or paste (Ctrl+V)"
                            : "Drag and drop or click to upload"}
                      </p>
                      <p class="text-sm text-muted-foreground">PNG, JPEG, GIF, WEBP · up to 10MB</p>
                    </div>
                  </div>
                {/if}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div class="flex flex-col justify-center">
          {#if result}
            <ScanResultCard
              {result}
              imagePreviewUrl={resultSource === "camera" || resultSource === "history"
                ? null
                : imagePreviewUrl}
              source={resultSource}
              onScanAgain={handleScanAnother}
              {onGenerateQr}
            />
          {:else if error}
            <div
              class="space-y-3 rounded-lg border border-destructive/50 bg-destructive/10 p-6"
              role="alert"
              aria-live="assertive"
            >
              <p class="text-sm font-medium text-destructive">{error}</p>
              <Button type="button" variant="outline" size="sm" onclick={handleReset}>
                Try Again
              </Button>
            </div>
          {:else if cameraActive}
            <div
              class="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 p-6 text-center"
            >
              <ScanLine class="size-8 text-muted-foreground" />
              <p class="text-sm font-medium">Scanning...</p>
              <p class="max-w-xs text-xs text-muted-foreground">
                Hold the QR code steady inside the camera frame. The result appears here instantly.
              </p>
            </div>
          {:else}
            <div
              class="flex h-full min-h-[320px] items-center justify-center rounded-lg border bg-muted"
            >
              <p class="text-sm text-muted-foreground">Scan results will appear here</p>
            </div>
          {/if}
        </div>
      </div>

      {#if history.length > 0}
        <ScanHistory
          entries={history}
          onSelect={handleHistorySelect}
          onRemove={handleRemoveHistory}
          onClear={handleClearHistory}
        />
      {/if}
    {/if}
  </CardContent>
</Card>
