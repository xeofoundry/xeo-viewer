// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui'],
  ssr: false,
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-07-15',
  // `nuxt build` emits plain static files to .output/public, no Node server
  nitro: { preset: 'static' },
  eslint: { config: { stylistic: true } },
})
