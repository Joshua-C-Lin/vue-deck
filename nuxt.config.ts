import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: false },
  ssr: false,
  experimental: {
    viteEnvironmentApi: true,
  },
  vite: {
    resolve: {
      alias: {
        "#app-manifest": resolve(
          fileURLToPath(new URL(".", import.meta.url)),
          "stubs/app-manifest.mjs",
        ),
      },
    },
    server: {
      watch: {
        usePolling: true,
        interval: 150,
      },
    },
  },
  app: {
    baseURL: '/vue-deck/',
    buildAssetsDir: '/_nuxt/',
  },
  runtimeConfig: {
    public: {
      mapboxToken: process.env.NUXT_PUBLIC_MAPBOX_TOKEN
    }
  }
})
