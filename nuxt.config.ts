// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,
  // `nuxt build` emits plain static files to .output/public, no Node server
  nitro: { preset: 'static' }
})
