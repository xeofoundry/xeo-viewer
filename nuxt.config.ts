// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui'],
  ssr: false,
  devtools: { enabled: false },
  // Full-screen viewer: the camera pivot near the edges must not make the page scroll
  app: { head: { htmlAttrs: { class: 'overflow-hidden' } } },
  css: ['~/assets/css/main.css'],
  // useDarkMode sets the class itself: Nuxt UI's color mode only targets <html>, not the web component's element
  ui: { colorMode: false },
  compatibilityDate: '2025-07-15',
  // `nuxt build` emits plain static files to .output/public, no Node server
  nitro: { preset: 'static' },
  eslint: { config: { stylistic: true } },
  icon: { clientBundle: { scan: true } },
})
