<script setup lang="ts">
const { baseURL } = useRuntimeConfig().app
const dark = useDarkMode()

useHead({ link: [{ rel: 'icon', href: `${baseURL}favicon.ico` }] })

watchEffect(() => document.documentElement.classList.toggle('dark', dark.value))
</script>

<template>
  <UApp>
    <ViewerScene />
    <ViewerModelLoader />
    <ViewerOverlay />
  </UApp>
</template>
