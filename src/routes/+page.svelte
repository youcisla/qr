<script lang="ts">
  import {
    ArrowRight,
    BarChart3,
    Check,
    Download,
    LayoutGrid,
    Palette,
    QrCode,
    ScanLine,
    Sparkles,
    Zap,
  } from "@lucide/svelte"
  import Features from "$lib/components/features.svelte"
  import QrScanner from "$lib/components/qr/qr-scanner.svelte"
  import { Badge } from "$lib/components/ui/badge"
  import { Button } from "$lib/components/ui/button"

  let { data } = $props()

  const contentTypes = [
    "Link",
    "Text",
    "Email",
    "Phone",
    "SMS",
    "WhatsApp",
    "WiFi",
    "vCard",
    "MeCard",
    "Location",
    "Event",
    "Crypto",
    "SEPA payment",
    "App store",
    "Social",
    "PayPal",
  ]

  const stats = [
    { value: "16", label: "content types" },
    { value: "10", label: "module shapes" },
    { value: "6", label: "eye styles" },
    { value: "4", label: "export formats" },
  ]

  let scannedUrl = $state<string | undefined>(undefined)
</script>

<svelte:head>
  <title>{data.title}</title>
  <meta name="description" content={data.description} />
</svelte:head>

<section class="relative isolate overflow-hidden">
  <div
    class="pointer-events-none absolute inset-x-0 top-[-20rem] -z-10 h-[40rem] bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-primary/15 via-background to-background"
  ></div>

  <div
    class="mx-auto grid max-w-7xl gap-12 px-4 pt-10 pb-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:pt-16"
  >
    <div class="space-y-7">
      <Badge variant="outline" class="gap-1.5 rounded-full px-3 py-1 text-xs">
        <Sparkles class="size-3.5 text-primary" />
        New — QR Studio, a full design suite
      </Badge>

      <h1 class="text-4xl font-bold tracking-tight text-balance md:text-6xl">
        QR codes that look like
        <span
          class="bg-linear-to-r from-primary via-fuchsia-500 to-sky-500 bg-clip-text text-transparent"
          >your brand</span
        >, not a checkerboard.
      </h1>

      <p class="max-w-xl text-lg text-pretty text-muted-foreground">
        Design with dots, gradients, logos and frames. Encode 16 content types. Track every scan and
        change the destination after printing. It is free, open source, and needs no account to try.
      </p>

      <div class="flex flex-wrap items-center gap-3">
        <Button href="/studio" size="xl" class="gap-2">
          Open QR Studio
          <ArrowRight class="size-4" />
        </Button>
        {#if data.user}
          <Button href="/dashboard" variant="outline" size="xl">Go to dashboard</Button>
        {:else}
          <Button href="/auth/login" variant="outline" size="xl">Sign in to track scans</Button>
        {/if}
      </div>

      <ul class="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        {#each ["No signup to design", "SVG · PNG · PDF exports", "Works forever"] as item (item)}
          <li class="flex items-center gap-1.5">
            <Check class="size-4 text-emerald-500" />
            {item}
          </li>
        {/each}
      </ul>

      <dl class="grid max-w-lg grid-cols-4 gap-3 border-t pt-6">
        {#each stats as stat (stat.label)}
          <div>
            <dt class="text-2xl font-bold tracking-tight">{stat.value}</dt>
            <dd class="text-xs text-muted-foreground">{stat.label}</dd>
          </div>
        {/each}
      </dl>
    </div>

    <div class="relative mx-auto w-full max-w-md">
      <div
        class="pointer-events-none absolute inset-8 -z-10 rounded-[2rem] bg-linear-to-br from-fuchsia-500/20 via-primary/10 to-sky-500/20 blur-2xl"
      ></div>
      <div class="rounded-[2rem] border bg-card p-6 shadow-2xl shadow-primary/10">
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <QrCode class="size-4 text-primary" />
            <span class="text-sm font-semibold">QR Studio</span>
          </div>
          <span
            class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
          >
            Live preview
          </span>
        </div>
        <div
          class="overflow-hidden rounded-xl border bg-white p-4 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:w-full"
        >
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html data.heroSvg}
        </div>
        <div class="mt-4 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
          <span class="rounded-md bg-muted px-2 py-1.5 text-center">Gradient fill</span>
          <span class="rounded-md bg-muted px-2 py-1.5 text-center">Rounded eyes</span>
          <span class="rounded-md bg-muted px-2 py-1.5 text-center">Print frame</span>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="relative border-y bg-muted/30">
  <div class="mx-auto max-w-7xl overflow-hidden px-4 py-4">
    <div class="flex flex-wrap items-center justify-center gap-2">
      <span class="mr-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >16 content types</span
      >
      {#each contentTypes as type (type)}
        <span class="rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground">
          {type}
        </span>
      {/each}
    </div>
  </div>
</section>

<Features />

<section class="mx-auto max-w-7xl space-y-8 px-4 py-16 md:py-24">
  <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div class="max-w-2xl space-y-2">
      <p class="text-sm font-semibold tracking-[0.2em] text-primary uppercase">Templates</p>
      <h2 class="text-3xl font-bold tracking-tight md:text-4xl">
        Start from a design, not a blank screen
      </h2>
      <p class="text-muted-foreground">
        Every template is a starting point: colours, module shapes, eyes and frames are all editable
        in the studio.
      </p>
    </div>
    <Button href="/studio" variant="outline" class="gap-2">
      Browse all templates
      <ArrowRight class="size-4" />
    </Button>
  </div>

  <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
    {#each data.showcase as item (item.id)}
      <a
        href="/studio"
        class="group rounded-2xl border bg-card p-4 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
      >
        <div class="overflow-hidden rounded-xl border bg-white p-3 [&_svg]:h-auto [&_svg]:w-full">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html item.svg}
        </div>
        <div class="pt-4">
          <p class="font-semibold group-hover:text-primary">{item.name}</p>
          <p class="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        </div>
      </a>
    {/each}
  </div>
</section>

<section class="mx-auto max-w-7xl px-4 pb-16 md:pb-24">
  <div
    class="grid gap-8 rounded-3xl border bg-linear-to-br from-muted/60 to-background p-6 md:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center"
  >
    <div class="space-y-4">
      <span
        class="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"
      >
        <ScanLine class="size-6" />
      </span>
      <h2 class="text-3xl font-bold tracking-tight">Scan anything, right from the browser</h2>
      <p class="text-muted-foreground">
        Point your camera at a QR code, drop an image, or paste a screenshot. Results are decoded
        locally — WiFi credentials, contact cards, links and events are shown in a readable summary.
      </p>
      <ul class="space-y-2 text-sm text-muted-foreground">
        {#each ["Camera scanning with torch and multi-camera support", "Structured result cards for WiFi, vCard, email and links", "Scan history that stays on your device"] as item (item)}
          <li class="flex items-start gap-2">
            <Check class="mt-0.5 size-4 shrink-0 text-emerald-500" />
            {item}
          </li>
        {/each}
      </ul>
      <Button href="#scanner" variant="outline" class="gap-2">
        Try the scanner
        <ArrowRight class="size-4" />
      </Button>
    </div>
    <div id="scanner">
      <QrScanner onScan={(url) => (scannedUrl = url)} user={data.user} />
      {#if scannedUrl}
        <p class="mt-2 text-center text-xs text-muted-foreground">
          Last scan: <span class="font-mono">{scannedUrl}</span>
        </p>
      {/if}
    </div>
  </div>
</section>

<section class="mx-auto max-w-7xl px-4 pb-20">
  <div
    class="relative overflow-hidden rounded-3xl border bg-linear-to-br from-primary/10 via-background to-sky-500/10 p-8 text-center md:p-14"
  >
    <div
      class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,var(--tw-gradient-stops))] from-primary/20 to-transparent"
    ></div>
    <div class="mx-auto max-w-2xl space-y-4">
      <div
        class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg"
      >
        <Zap class="size-6" />
      </div>
      <h2 class="text-3xl font-bold tracking-tight md:text-4xl">
        Make your first QR code in under a minute
      </h2>
      <p class="text-muted-foreground">
        Design it, export it, print it. Add a dynamic short link later when you want live tracking.
      </p>
      <div class="flex flex-wrap justify-center gap-3 pt-2">
        <Button href="/studio" size="xl" class="gap-2">
          Open QR Studio
          <ArrowRight class="size-4" />
        </Button>
        <Button href="/dashboard" variant="outline" size="xl" class="gap-2">
          <BarChart3 class="size-4" />
          View analytics
        </Button>
      </div>
      <p
        class="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 pt-2 text-xs text-muted-foreground"
      >
        <span class="inline-flex items-center gap-1"
          ><Palette class="size-3.5" /> Full design control</span
        >
        <span class="inline-flex items-center gap-1"
          ><LayoutGrid class="size-3.5" /> 16 content types</span
        >
        <span class="inline-flex items-center gap-1"
          ><Download class="size-3.5" /> Print-ready exports</span
        >
      </p>
    </div>
  </div>
</section>
