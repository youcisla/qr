<script lang="ts">
  import { LockKeyhole } from "@lucide/svelte"

  import type { PageProps } from "./$types"

  let { data, form }: PageProps = $props()

  function focusOnMount(node: HTMLInputElement) {
    node.focus()
  }
</script>

<svelte:head>
  <title>Protected QR code · Yopem QR</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="mx-auto flex w-full max-w-md flex-col justify-center py-16">
  <div class="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
    <div class="mb-6 flex flex-col items-center gap-3 text-center">
      <div class="flex size-12 items-center justify-center rounded-full bg-muted">
        <LockKeyhole class="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h1 class="text-2xl font-semibold tracking-tight">Protected QR code</h1>
      <p class="max-w-sm text-sm text-muted-foreground">
        {#if data.title}
          Enter the password to open <span class="font-medium text-foreground">{data.title}</span>.
        {:else}
          Enter the password to open this QR code.
        {/if}
      </p>
    </div>

    {#if form?.error}
      <p
        class="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        role="alert"
      >
        {form.error}
      </p>
    {/if}

    <form method="POST" class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <label for="password" class="text-sm font-medium">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autocomplete="current-password"
          use:focusOnMount
          class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
      <button
        type="submit"
        class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        Unlock QR code
      </button>
    </form>

    <p class="mt-4 text-center text-xs text-muted-foreground">
      Entering the correct password unlocks this QR code on this device for 30 minutes.
    </p>
  </div>
</div>
