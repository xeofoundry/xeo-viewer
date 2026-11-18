// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui'],
  ssr: false,
  devtools: { enabled: false },
  app: { head: { htmlAttrs: { class: 'dark' } } },
  css: ['~/assets/css/main.css'],
  // Always dark: the scene background is fixed dark, and a stored color-mode preference would override it
  ui: { colorMode: false },
  compatibilityDate: '2025-07-15',
  // `nuxt build` emits plain static files to .output/public, no Node server
  nitro: { preset: 'static' },
  eslint: { config: { stylistic: true } },
  icon: { clientBundle: { scan: true } },
})
