<script setup lang="ts">
const { baseURL } = useRuntimeConfig().app

useHead({ link: [{ rel: 'icon', href: `${baseURL}favicon.ico` }] })
</script>

<template>
  <UApp>
    <ViewerScene />
    <ViewerModelLoader />
    <ViewerOverlay />
  </UApp>
</template>
