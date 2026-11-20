import { useLocalStorage } from '@vueuse/core'

// spa-loading-template.html reads the same key to pick its colors before the app mounts
const dark = useLocalStorage('xeo-viewer-dark', true)

export const useDarkMode = () => dark
