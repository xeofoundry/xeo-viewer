<script setup lang="ts">
const PROMPTS = {
  door: 'Press F to enter',
  hide: 'Press left to hide',
  move: 'Press left and hold to move',
  place: 'Release left to place',
}

const { state } = useWalkMode()
</script>

<template>
  <div class="pointer-events-none fixed inset-0 z-60">
    <div class="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
      <span
        class="size-2.5 rounded-full ring-2 ring-black/50 transition-colors"
        :class="state.target ? 'bg-primary' : 'bg-white'"
      />

      <span
        v-if="state.target"
        class="rounded-md bg-black/70 px-2.5 py-1 text-xs font-medium text-white"
      >
        {{ PROMPTS[state.target] }}
      </span>
    </div>
  </div>
</template>
