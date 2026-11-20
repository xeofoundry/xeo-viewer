<script setup lang="ts">
const viewer = useViewer()
const { state } = useWalkMode()

const activeKeys = computed(() => new Set([
  ...(state.flying ? ['G'] : []),
  ...(state.hideMode ? ['Q'] : []),
  ...(state.moveMode ? ['P'] : []),
  ...(state.snap ? ['N'] : []),
  ...state.pressedKeys,
]))

const legend = computed(() => [
  { keys: [['W', 'A', 'S', 'D'], ['Shift']], label: state.flying ? 'Move / fly faster' : 'Move / run' },
  state.flying
    ? { keys: [['Space'], ['Ctrl']], label: 'Fly up / down' }
    : { keys: [['Space']], label: 'Hold to fly up' },
  ...(state.moveMode
    ? [
        { keys: [['LMB']], label: 'Hold to move / release to place' },
        { keys: [['N']], label: 'Snap to surfaces' },
      ]
    : []),
  ...(state.hideMode ? [{ keys: [['LMB']], label: 'Hide element' }] : []),
  ...(state.flying ? [] : [{ keys: [['F']], label: 'Go through door' }]),
  ...(state.hideMode || state.moveMode ? [{ keys: [['R']], label: 'Restore hidden / moved objects' }] : []),
  // Moving objects is unavailable for DTX-encoded models
  viewer.value?.scene.dtxEnabled
    ? { keys: [['G'], ['Q']], label: 'Free fly / hide' }
    : { keys: [['G'], ['Q'], ['P']], label: 'Free fly / hide / move' },
  { keys: [['Esc']], label: 'Exit walk mode' },
])
</script>

<template>
  <div class="hidden w-fit shrink-0 grid-cols-[auto_auto] items-center gap-x-3 gap-y-0.5 self-end rounded-[21px] bg-surface/70 px-5 py-4 text-xs text-white backdrop-blur-md md:grid">
    <template
      v-for="row in legend"
      :key="row.label"
    >
      <span class="flex justify-end gap-2">
        <span
          v-for="(group, index) in row.keys"
          :key="index"
          class="flex gap-1"
        >
          <kbd
            v-for="key in group"
            :key="key"
            class="inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 pt-px font-mono text-[11px] leading-none text-white"
            :class="activeKeys.has(key) ? 'bg-primary' : 'bg-surface'"
          >
            {{ key }}
          </kbd>
        </span>
      </span>

      <span>{{ row.label }}</span>
    </template>
  </div>
</template>
