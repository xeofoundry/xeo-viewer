<script setup lang="ts">
import { useDropZone, useFileDialog } from '@vueuse/core'

const { loading, hasModels, loadFiles, loadUrl } = useModels()

const { isOverDropZone } = useDropZone(document, {
  checkValidity: items => [...items].some(item => item.kind === 'file'),
  onDrop: files => files && loadFiles(files),
})

const dialog = useFileDialog({ accept: '.xkt,.json', reset: true })

dialog.onChange(files => files && loadFiles([...files]))

const xktUrl = ref('')
</script>

<template>
  <div
    class="fixed inset-0 z-55 grid place-items-center p-4"
    :class="hasModels ? 'pointer-events-none' : 'bg-surface/30 backdrop-blur-xs'"
  >
    <UIcon
      v-if="loading"
      name="i-lucide-loader-circle"
      class="size-10 animate-spin text-white"
    />

    <section
      v-else-if="!hasModels"
      class="flex w-full max-w-md flex-col gap-4 rounded-[21px] bg-surface/70 p-6 text-white shadow-sm backdrop-blur-md"
    >
      <div class="flex flex-col items-center gap-2 text-center">
        <ViewerLogo class="h-11 w-15" />

        <h2 class="text-lg font-semibold">
          No model loaded
        </h2>

        <p class="text-sm text-zinc-400">
          Drop .xkt files anywhere in the viewer.
        </p>
      </div>

      <UButton
        icon="i-lucide-folder-open"
        label="Choose files"
        size="xl"
        block
        @click="dialog.open()"
      />

      <USeparator label="or load from URL" />

      <form
        class="flex gap-2"
        @submit.prevent="loadUrl(xktUrl.trim())"
      >
        <UInput
          v-model="xktUrl"
          type="url"
          required
          placeholder="XKT URL"
          aria-label="XKT URL"
          class="flex-1"
        />

        <UButton
          type="submit"
          label="Load"
          color="neutral"
          variant="subtle"
        />
      </form>
    </section>
  </div>

  <div
    v-if="isOverDropZone"
    class="pointer-events-none fixed inset-2 z-60 grid place-items-center rounded-[21px] border-2 border-dashed border-white/60 bg-surface/40 text-lg text-white backdrop-blur-sm"
  >
    Drop .xkt files to load
  </div>
</template>
