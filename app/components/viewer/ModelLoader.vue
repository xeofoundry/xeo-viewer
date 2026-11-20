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

// A fast load would only flash the spinner, so it stays up for at least this long
const MIN_SPINNER_MS = 500

// The page starts with the spinner, and until it first goes away it covers the UI that is still settling in
const spinning = ref(true)
const covering = ref(true)
let spinnerStart = performance.now()

watch(spinning, (active) => {
  if (!active) covering.value = false
})

const spinner = useTemplateRef<SVGSVGElement>('spinner')

// Runs on the page clock like the loading template's spinner, so taking over from it keeps its exact pose.
// Nuxt drops the template only later, on suspense resolve, so it goes now to never show two spinners at once.
onMounted(() => {
  spinner.value?.getAnimations({ subtree: true }).forEach((animation) => {
    animation.startTime = 0
  })

  document.getElementById('__nuxt-loader')?.remove()
})

watch(loading, (active) => {
  if (active) {
    spinnerStart = performance.now()
    spinning.value = true
    return
  }

  setTimeout(() => {
    if (!loading.value) spinning.value = false
  }, MIN_SPINNER_MS - (performance.now() - spinnerStart))
}, { immediate: true })
</script>

<template>
  <div
    class="fixed inset-0 z-55 grid place-items-center p-4"
    :class="hasModels || spinning ? 'pointer-events-none' : 'bg-surface/30 backdrop-blur-xs'"
  >
    <Transition
      leave-active-class="transition-opacity duration-300"
      leave-to-class="opacity-0"
    >
      <div
        v-if="covering"
        class="absolute inset-0 bg-linear-to-b from-[#4b4a56] to-[#28252e]"
      >
        <ViewerLogoSquare class="absolute bottom-[calc(50%-10px)] left-1/2 w-40 -translate-x-1/2" />
      </div>
    </Transition>

    <!-- Inline like the loading template's spinner: UIcon loads its icon CSS asynchronously, which left an empty gap -->
    <svg
      v-if="spinning"
      ref="spinner"
      viewBox="0 0 50 50"
      aria-label="Loading"
      class="loading-spinner relative"
      :class="{ 'translate-y-[54px]': covering }"
    >
      <circle
        class="track"
        cx="25"
        cy="25"
        r="20"
      />

      <circle
        class="arc"
        cx="25"
        cy="25"
        r="20"
      />
    </svg>

    <section
      v-else-if="!hasModels"
      class="relative flex w-full max-w-md flex-col gap-4 rounded-[21px] bg-surface/70 p-6 text-white shadow-sm backdrop-blur-md"
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
