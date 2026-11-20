<script setup lang="ts">
const { baseURL } = useRuntimeConfig().app
const { model, metadata } = useRoute().query
const dark = useDarkMode()

useHead({ link: [{ rel: 'icon', href: `${baseURL}favicon.ico` }] })

watchEffect(() => document.documentElement.classList.toggle('dark', dark.value))
</script>

<template>
  <UApp>
    <ViewerScene
      :model="model === 'dev' ? `${baseURL}models/otc-conference-center.xkt` : typeof model === 'string' ? model : undefined"
      :metadata="typeof metadata === 'string' ? metadata : undefined"
    />
    <ViewerModelLoader />
    <ViewerOverlay />
  </UApp>
</template>
