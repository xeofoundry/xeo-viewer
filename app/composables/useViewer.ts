import type { Viewer } from '@xeokit/xeokit-sdk'

// Module-level state is safe only because the app is client-only (ssr: false)
const viewer = shallowRef<Viewer>()

export const useViewer = () => viewer
