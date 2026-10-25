import node from "@sveltejs/adapter-node"
import vercel from "@sveltejs/adapter-vercel"
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte"

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),
  kit: {
    adapter: process.env.VERCEL ? vercel() : node(),
    csrf: {
      trustedOrigins: ["https://qr.yopem.com"],
    },
  },
  compilerOptions: {
    experimental: {
      async: true,
    },
  },
}

export default config
