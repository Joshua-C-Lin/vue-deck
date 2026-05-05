import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: false },
  ssr: false,
  experimental: {
    viteEnvironmentApi: true,
  },
  runtimeConfig: {
    public: {
      mapboxToken: process.env.NUXT_PUBLIC_MAPBOX_TOKEN
    }
  }
})
