<script setup lang="ts">
import { useHost } from 'vue'

const props = defineProps<{ model?: string, metadata?: string, modelBuffer?: ArrayBuffer, metadataBuffer?: ArrayBuffer, primaryColor?: string }>()

const host = useHost()!
const dark = useDarkMode()

watchEffect(() => host.classList.toggle('dark', dark.value))
watchEffect(() => host.style.setProperty('--ui-primary', props.primaryColor ?? ''))
</script>

<template>
  <!-- Portaled menus, tooltips and toasts stay inside the element, so they keep its theme class and scoped base styles -->
  <UApp :portal="host">
    <ViewerScene
      :model
      :metadata
      :model-buffer
      :metadata-buffer
    />
    <ViewerModelLoader />
    <ViewerOverlay />
  </UApp>
</template>
