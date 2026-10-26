<script lang="ts">
  import { Moon, Sun } from "@lucide/svelte"
  import LogoutButton from "$lib/components/auth/logout-button.svelte"
  import Logo from "$lib/components/logo.svelte"
  import { Button } from "$lib/components/ui/button"
  import YopemServiceMenu from "$lib/components/yopem-service-menu.svelte"

  interface Props {
    user?: {
      id: string
      email: string
      name: string | null
      username: string
      image: string | null
      role: "user" | "member" | "admin"
    } | null
  }

  let { user = null }: Props = $props()
  let darkMode = $state(false)

  $effect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("darkMode")
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches

      darkMode = stored ? stored === "true" : prefersDark

      if (darkMode) {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
    }
  })

  function toggleDarkMode() {
    darkMode = !darkMode
    localStorage.setItem("darkMode", String(darkMode))

    if (darkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }
</script>

<header
  class="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/70"
>
  <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
    <div class="flex items-center gap-6">
      <div class="flex items-center gap-2">
        <a href="https://yopem.com" class="flex items-center">
          <Logo class="size-9" />
        </a>
        <span class="text-xl text-muted-foreground">/</span>
        <a href="/" class="flex items-center">
          <span class="gap-1 text-xl font-bold hover:text-foreground">QR</span>
        </a>
      </div>
      <nav class="hidden items-center gap-4 md:flex">
        <a
          href="/"
          class="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Home
        </a>
        <a
          href="/studio"
          class="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Studio
        </a>
        {#if user}
          <a
            href="/dashboard"
            class="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Dashboard
          </a>
        {/if}
      </nav>
    </div>
    <div class="flex items-center gap-2">
      {#if user}
        <LogoutButton />
      {:else}
        <Button>
          <a href="/auth/login">Login</a>
        </Button>
      {/if}

      <Button variant="ghost" size="icon" onclick={toggleDarkMode} aria-label="Toggle dark mode">
        {#if darkMode}
          <Sun class="h-5 w-5" />
        {:else}
          <Moon class="h-5 w-5" />
        {/if}
      </Button>

      <YopemServiceMenu />
    </div>
  </div>
</header>
