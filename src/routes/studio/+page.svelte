<script lang="ts">
  import StudioEditor from "$lib/components/studio/studio-editor.svelte"

  import type { PageData } from "./$types"

  let { data }: { data: PageData } = $props()
</script>

<svelte:head>
  <title>{data.qr ? "Edit QR code" : "QR Studio"} · Yopem QR</title>
  <meta
    name="description"
    content="Design a custom QR code with dot styles, gradients, logos, frames and instant scan checks. Export as SVG, PNG, JPEG, PDF or WebP."
  />
</svelte:head>

<StudioEditor user={data.user} origin={data.origin} qr={data.qr} prefill={data.prefill} />
