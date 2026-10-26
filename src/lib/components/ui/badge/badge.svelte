<script lang="ts" module>
  import { tv, type VariantProps } from "tailwind-variants"

  export const badgeVariants = tv({
    base: "focus-visible:ring-ring focus-visible:ring-offset-background relative inline-flex shrink-0 items-center justify-center gap-1 rounded-sm border border-transparent font-medium whitespace-nowrap transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-64 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3 [button,a&]:cursor-pointer [button,a&]:pointer-coarse:after:absolute [button,a&]:pointer-coarse:after:size-full [button,a&]:pointer-coarse:after:min-h-11 [button,a&]:pointer-coarse:after:min-w-11",
    variants: {
      size: {
        default: "px-[calc(--spacing(1)-1px)] text-xs",
        lg: "px-[calc(--spacing(1.5)-1px)] text-sm",
        sm: "rounded-[calc(var(--radius-sm)-2px)] px-[calc(--spacing(1)-1px)] text-[.625rem]",
      },
      variant: {
        default: "bg-primary text-primary-foreground [button,a&]:hover:bg-primary/90",
        destructive: "bg-destructive [button,a&]:hover:bg-destructive/90 text-white",
        error: "bg-destructive/8 text-destructive-foreground dark:bg-destructive/16",
        info: "bg-info/8 text-info-foreground dark:bg-info/16",
        outline:
          "border-border dark:bg-input/32 [button,a&]:hover:bg-accent/50 dark:[button,a&]:hover:bg-input/48 bg-transparent",
        secondary: "bg-secondary text-secondary-foreground [button,a&]:hover:bg-secondary/90",
        success: "bg-success/8 text-success-foreground dark:bg-success/16",
        warning: "bg-warning/8 text-warning-foreground dark:bg-warning/16",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  })

  export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"]
  export type BadgeSize = VariantProps<typeof badgeVariants>["size"]
</script>

<script lang="ts">
  import { cn, type WithElementRef } from "$lib/utils/style.js"
  import type { HTMLAnchorAttributes } from "svelte/elements"

  let {
    ref = $bindable(null),
    href,
    class: className,
    variant = "default",
    size = "default",
    children,
    ...restProps
  }: WithElementRef<HTMLAnchorAttributes> & {
    variant?: BadgeVariant
    size?: BadgeSize
  } = $props()
</script>

<svelte:element
  this={href ? "a" : "span"}
  bind:this={ref}
  data-slot="badge"
  {href}
  class={cn(badgeVariants({ variant, size }), className)}
  {...restProps}
>
  {@render children?.()}
</svelte:element>
