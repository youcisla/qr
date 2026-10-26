<script lang="ts">
  import ChartBarIcon from "@lucide/svelte/icons/chart-bar"
  import DownloadIcon from "@lucide/svelte/icons/download"
  import LayersIcon from "@lucide/svelte/icons/layers"
  import LinkIcon from "@lucide/svelte/icons/link"
  import PaletteIcon from "@lucide/svelte/icons/palette"
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw"
  import ScanLineIcon from "@lucide/svelte/icons/scan-line"
  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check"
  import { Card, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card"

  const features = [
    {
      icon: PaletteIcon,
      title: "Full design control",
      description:
        "10 module shapes, 6 eye frames, 5 eye balls, linear and radial gradients, transparent backgrounds, logo embedding and framed print cards.",
    },
    {
      icon: LayersIcon,
      title: "16 content types",
      description:
        "Links, text, email, phone, SMS, WhatsApp, WiFi, vCard, MeCard, location, events, crypto, SEPA payments, app stores, social profiles and PayPal.",
    },
    {
      icon: RefreshCwIcon,
      title: "Dynamic QR codes",
      description:
        "Edit the destination after printing, pause or expire a code, protect it with a password, and organise everything with tags.",
    },
    {
      icon: ChartBarIcon,
      title: "Scan analytics",
      description:
        "Total and unique scans, time series, countries, cities, devices, browsers, operating systems, referrers and hour-of-day heatmaps.",
    },
    {
      icon: DownloadIcon,
      title: "Print-ready exports",
      description:
        "SVG for vector workflows, PNG at any resolution with transparency, and single-page PDF for print shops. Copy the SVG straight into a design tool.",
    },
    {
      icon: ScanLineIcon,
      title: "Smart scanner",
      description:
        "Scan with your camera or an image, and get a structured result card for WiFi, contacts, emails, events and links — with no data leaving your browser.",
    },
    {
      icon: LinkIcon,
      title: "Short links & bulk tools",
      description:
        "Every dynamic code gets a short URL. Search, filter, tag, duplicate, archive and bulk-export your whole collection as CSV.",
    },
    {
      icon: ShieldCheckIcon,
      title: "Open source and durable",
      description:
        "Static QR codes never expire and keep working forever. Dynamic codes are yours to edit, pause or delete at any time.",
    },
  ] satisfies Array<{
    icon: typeof PaletteIcon
    title: string
    description: string
  }>
</script>

<section id="features" class="mx-auto max-w-7xl px-4 py-16 md:py-24">
  <div class="mx-auto mb-12 max-w-2xl text-center">
    <p class="text-sm font-semibold tracking-[0.2em] text-primary uppercase">Everything included</p>
    <h2 class="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
      A QR platform that grows with your campaign
    </h2>
    <p class="mt-3 text-muted-foreground">
      Design, content, tracking and management in one place — no paywalled "pro" watermark, no
      expiring codes.
    </p>
  </div>

  <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
    {#each features as feature (feature.title)}
      {@const Icon = feature.icon}
      <Card class="h-full gap-4 transition-all hover:-translate-y-1 hover:shadow-lg">
        <CardHeader class="gap-3">
          <div
            class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"
          >
            <Icon class="size-6" />
          </div>
          <CardTitle class="text-lg">{feature.title}</CardTitle>
          <CardDescription class="text-sm leading-relaxed">{feature.description}</CardDescription>
        </CardHeader>
      </Card>
    {/each}
  </div>
</section>
