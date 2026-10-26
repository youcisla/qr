import { sveltekit } from "@sveltejs/kit/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    // Local scratch/verification artifacts must not trigger HMR churn.
    watch: {
      ignored: ["**/.tmp/**", "**/docs/**"],
    },
  },
  preview: {
    port: 3002,
    host: true,
    allowedHosts: ["qr.yopem.com"],
  },
})
