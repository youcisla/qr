<script lang="ts">
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card"
  import { cn } from "$lib/utils/style"
  import type { Snippet } from "svelte"

  interface Props {
    title: string
    description?: string
    /** Optional controls rendered in the header (range selector, export button, ...). */
    action?: Snippet
    children: Snippet
    class?: string
    contentClass?: string
  }

  let { title, description, action, children, class: className, contentClass }: Props = $props()
</script>

<Card class={cn("gap-4", className)}>
  <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-3">
    <div class="min-w-0 space-y-1">
      <CardTitle class="text-base font-semibold">{title}</CardTitle>
      {#if description}
        <CardDescription>{description}</CardDescription>
      {/if}
    </div>
    {#if action}
      <div class="shrink-0">{@render action()}</div>
    {/if}
  </CardHeader>
  <CardContent class={cn(contentClass)}>
    {@render children()}
  </CardContent>
</Card>
