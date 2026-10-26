<script lang="ts">
  import { CircleCheck, CircleX, LoaderCircle, ScanLine } from "@lucide/svelte"
  import { Button } from "$lib/components/ui/button"
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "$lib/components/ui/dialog"
  import { svgToPngBlob } from "$lib/qr/export"
  import jsQR from "jsqr"

  interface Props {
    svg: string | null
    width: number
    height: number
    expectedData: string
  }

  let { svg, width, height, expectedData }: Props = $props()

  interface DecodeResult {
    size: number
    status: "pass" | "mismatch" | "fail"
    decoded?: string
    ms: number
  }

  const TEST_SIZES = [640, 320, 200]

  let open = $state(false)
  let running = $state(false)
  let results = $state<DecodeResult[]>([])
  let errorMessage = $state<string | null>(null)

  async function decodeAt(size: number): Promise<DecodeResult> {
    const started = performance.now()
    const aspect = height / Math.max(1, width)
    const pixelWidth = Math.max(64, Math.round(size))
    const pixelHeight = Math.max(64, Math.round(size * aspect))
    const blob = await svgToPngBlob(svg ?? "", { width: pixelWidth, height: pixelHeight })
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement("canvas")
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) throw new Error("Canvas is not available in this browser")
    context.drawImage(bitmap, 0, 0)
    bitmap.close()
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth",
    })
    const ms = Math.round(performance.now() - started)
    if (!code) return { size, status: "fail", ms }
    const expected = expectedData.trim()
    const decoded = code.data
    return {
      size,
      status: decoded.trim() === expected ? "pass" : "mismatch",
      decoded,
      ms,
    }
  }

  async function runTest() {
    if (running || !svg) return
    running = true
    errorMessage = null
    results = []
    try {
      for (const size of TEST_SIZES) {
        const result = await decodeAt(size)
        results = [...results, result]
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Could not run the scan test"
    } finally {
      running = false
    }
  }

  $effect(() => {
    if (open && svg && !running && results.length === 0 && !errorMessage) {
      runTest()
    }
  })

  const summary = $derived.by(() => {
    if (results.length === 0) return null
    const passed = results.filter((result) => result.status === "pass").length
    if (passed === results.length) return "pass" as const
    if (passed > 0) return "partial" as const
    return "fail" as const
  })
</script>

<Button
  type="button"
  variant="outline"
  class="w-full gap-2"
  disabled={!svg}
  onclick={() => {
    results = []
    errorMessage = null
    open = true
  }}
>
  <ScanLine class="size-4" />
  Run scan test
</Button>

<Dialog bind:open>
  <DialogContent class="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>Scan test</DialogTitle>
      <DialogDescription>
        This exact design is rasterised and decoded locally with jsQR at three print sizes — the
        same library used by the scanner. Nothing leaves your browser.
      </DialogDescription>
    </DialogHeader>

    <div class="space-y-3">
      {#if running}
        <div
          class="flex items-center gap-2 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground"
        >
          <LoaderCircle class="size-4 animate-spin" />
          Rendering and decoding at {TEST_SIZES.join(", ")} px…
        </div>
      {:else if errorMessage}
        <p
          class="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      {:else if results.length > 0}
        <ul class="space-y-2">
          {#each results as result (result.size)}
            <li
              class="flex items-start gap-3 rounded-xl border p-3 text-sm {result.status === 'pass'
                ? 'border-success/30 bg-success/5'
                : result.status === 'mismatch'
                  ? 'border-warning/40 bg-warning/5'
                  : 'border-destructive/30 bg-destructive/5'}"
            >
              {#if result.status === "pass"}
                <CircleCheck class="mt-0.5 size-4 shrink-0 text-success-foreground" />
              {:else}
                <CircleX class="mt-0.5 size-4 shrink-0 text-destructive" />
              {/if}
              <div class="min-w-0 flex-1">
                <p class="font-medium">
                  {#if result.status === "pass"}
                    Decoded at {result.size}px
                  {:else if result.status === "mismatch"}
                    Decoded different content at {result.size}px
                  {:else}
                    Could not decode at {result.size}px
                  {/if}
                  <span class="font-normal text-muted-foreground">· {result.ms}ms</span>
                </p>
                {#if result.decoded}
                  <p class="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                    {result.decoded}
                  </p>
                {/if}
              </div>
            </li>
          {/each}
        </ul>

        {#if summary === "pass"}
          <p class="text-xs text-muted-foreground">
            All three sizes decoded. The design is safe for screens and standard print.
          </p>
        {:else if summary === "partial"}
          <p class="text-xs text-muted-foreground">
            The code needs a bigger printed size or more contrast. Raise error correction to H and
            reduce module spacing or logo size.
          </p>
        {:else}
          <p class="text-xs text-muted-foreground">
            This design did not decode in our test. Increase contrast, keep the background light,
            shrink the logo and use a larger print size.
          </p>
        {/if}
      {/if}
    </div>

    <DialogFooter>
      <Button type="button" variant="outline" disabled={running} onclick={runTest}>
        {#if running}
          <LoaderCircle class="size-4 animate-spin" />
          Testing…
        {:else}
          Run again
        {/if}
      </Button>
      <Button type="button" onclick={() => (open = false)}>Close</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
