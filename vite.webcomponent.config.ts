import { fileURLToPath } from 'node:url'
import ui from '@nuxt/ui/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { ui as theme } from './app/ui.config'

export default defineConfig({
  plugins: [
    vue(),
    ui({
      ui: theme,
      colorMode: false,
      router: false,
      dts: false,
      icon: { clientBundle: { scan: true } },
      autoImport: { imports: ['vue'], dirs: ['app/composables', 'app/utils'], vueTemplate: true },
      components: { dirs: ['app/components'], directoryAsNamespace: true },
    }),
  ],
  // Nuxt's aliases: Vue compiles a template's `~/assets/...` URL to an `assets/...` import
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('app', import.meta.url)),
      'assets': fileURLToPath(new URL('app/assets', import.meta.url)),
    },
  },
  // Library mode leaves this to the consumer's bundler, but the bundle is loaded straight into the page
  define: { 'process.env.NODE_ENV': '"production"' },
  css: {
    postcss: {
      plugins: [{
        postcssPlugin: 'scope-base-layer',
        // Tailwind's preflight and the viewer's base rules would otherwise restyle the host page
        Once(root) {
          root.walkAtRules('layer', (layer) => {
            if (layer.params !== 'base' || !layer.nodes) return

            const scope = layer.clone({ name: 'scope', params: '(xeo-viewer)' })

            layer.removeAll().append(scope)
          })
        },
      }],
    },
  },
  build: {
    outDir: 'dist/webcomponent',
    copyPublicDir: false,
    lib: { entry: 'app/webcomponent/main.ts', formats: ['es'], fileName: 'xeo-viewer' },
    rolldownOptions: { output: { codeSplitting: false } },
  },
})
