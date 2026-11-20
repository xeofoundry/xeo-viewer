import { defineCustomElement } from 'vue'
import ui from '@nuxt/ui/vue-plugin'
import XeoViewer from './XeoViewer.vue'
import css from './style.css?inline'

document.head.append(Object.assign(document.createElement('style'), { textContent: css }))

customElements.define('xeo-viewer', defineCustomElement(XeoViewer, {
  shadowRoot: false,
  configureApp: app => app.use(ui),
}))
