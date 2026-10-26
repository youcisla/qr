<script lang="ts">
  import { Camera, CameraOff, Flashlight, FlashlightOff, RefreshCw } from "@lucide/svelte"
  import { Button } from "$lib/components/ui/button"
  import { CameraQrScanner } from "$lib/utils/qr-scanner"
  import { cn } from "$lib/utils/style"

  interface Props {
    active: boolean
    onDetect: (data: string) => void
    onError?: (message: string) => void
    class?: string
  }

  let { active, onDetect, onError, class: className }: Props = $props()

  let videoElement = $state<HTMLVideoElement | null>(null)
  let scanner: CameraQrScanner | null = null

  let starting = $state(false)
  let running = $state(false)
  let error = $state<string | null>(null)
  let canSwitch = $state(false)
  let torchAvailable = $state(false)
  let torchOn = $state(false)

  function describeError(cause: unknown): string {
    if (cause instanceof Error && cause.message) return cause.message
    return "Could not start the camera. Upload a QR image instead."
  }

  function syncControls(instance: CameraQrScanner) {
    canSwitch = instance.hasMultipleCameras
    torchAvailable = instance.isTorchAvailable
    torchOn = instance.isTorchEnabled
  }

  async function startScanner() {
    const element = videoElement
    if (!element) return
    if (!scanner) {
      scanner = new CameraQrScanner({
        video: element,
        onDetect: (data) => {
          running = false
          starting = false
          onDetect(data)
        },
        onError: (scannerError) => {
          running = false
          starting = false
          error = scannerError.message
          onError?.(scannerError.message)
        },
      })
    }
    starting = true
    error = null
    try {
      await scanner.start()
      starting = false
      running = true
      syncControls(scanner)
    } catch (cause) {
      starting = false
      running = false
      if (!error) error = describeError(cause)
    }
  }

  async function retry() {
    if (!scanner) {
      await startScanner()
      return
    }
    error = null
    try {
      scanner.stop()
      await startScanner()
    } catch (cause) {
      error = describeError(cause)
    }
  }

  async function switchCamera() {
    if (!scanner) return
    try {
      const device = await scanner.switchCamera()
      if (device) {
        running = true
        syncControls(scanner)
      }
    } catch (cause) {
      error = describeError(cause)
    }
  }

  async function toggleTorch() {
    if (!scanner) return
    const next = !torchOn
    const supported = await scanner.setTorch(next)
    if (!supported) {
      torchAvailable = false
      return
    }
    torchOn = next
  }

  $effect(() => {
    const shouldRun = active
    if (typeof window === "undefined") return

    if (!shouldRun) {
      scanner?.stop()
      running = false
      starting = false
      return
    }

    // Wait until bind:this has attached the video element.
    if (!videoElement) return
    void startScanner()

    return () => {
      scanner?.stop()
      running = false
      starting = false
    }
  })
</script>

<div class={cn("relative overflow-hidden rounded-lg border bg-black", className)}>
  <video
    bind:this={videoElement}
    class="aspect-square w-full bg-black object-cover sm:aspect-video"
    playsinline
    muted
    autoplay
    aria-label="Live camera preview"
  ></video>

  {#if starting}
    <div
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white"
    >
      <svg
        class="size-8 animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      <p class="text-sm font-medium" role="status" aria-live="polite">Starting camera...</p>
    </div>
  {:else if error}
    <div
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 text-center text-white"
    >
      <CameraOff class="size-10 text-white/70" />
      <p class="max-w-xs text-sm" role="alert">{error}</p>
      <Button type="button" variant="secondary" size="sm" onclick={retry}>Try again</Button>
    </div>
  {:else if running}
    <div class="pointer-events-none absolute inset-0" aria-hidden="true">
      <div
        class="absolute top-3 left-3 size-8 rounded-tl-lg border-t-2 border-l-2 border-white/80"
      ></div>
      <div
        class="absolute top-3 right-3 size-8 rounded-tr-lg border-t-2 border-r-2 border-white/80"
      ></div>
      <div
        class="absolute bottom-3 left-3 size-8 rounded-bl-lg border-b-2 border-l-2 border-white/80"
      ></div>
      <div
        class="absolute right-3 bottom-3 size-8 rounded-br-lg border-r-2 border-b-2 border-white/80"
      ></div>
      <div
        class="absolute top-1/2 right-6 left-6 h-0.5 -translate-y-1/2 animate-pulse bg-white/70"
      ></div>
    </div>
    <p
      class="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white"
      role="status"
      aria-live="polite"
    >
      Point the camera at a QR code
    </p>
    {#if canSwitch || torchAvailable}
      <div class="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
        {#if canSwitch}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Switch camera"
            onclick={switchCamera}
          >
            <RefreshCw class="size-4" />
          </Button>
        {/if}
        {#if torchAvailable}
          <Button
            type="button"
            variant={torchOn ? "default" : "secondary"}
            size="icon"
            aria-label={torchOn ? "Turn off flashlight" : "Turn on flashlight"}
            aria-pressed={torchOn}
            onclick={toggleTorch}
          >
            {#if torchOn}
              <FlashlightOff class="size-4" />
            {:else}
              <Flashlight class="size-4" />
            {/if}
          </Button>
        {/if}
      </div>
    {/if}
  {:else if !active}
    <div
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted text-muted-foreground"
    >
      <Camera class="size-10" />
      <p class="max-w-xs px-6 text-center text-sm">
        Start the camera to scan a QR code directly. Nothing is uploaded.
      </p>
    </div>
  {/if}
</div>
