<script setup lang="ts">
const props = defineProps<{
  node: TreeNode
  depth: number
  modelId: string
  hasSiblings?: boolean
  expandCommand?: ExpandCommand | null
  reveal?: RevealRequest | null
  forceExpanded?: boolean
  parentSelected?: boolean
}>()

const viewer = useViewer()
const context = inject(ExplorerTreeContextKey)!

const row = useTemplateRef<HTMLElement>('row')

const hasObjects = computed(() => props.node.objectIds.length > 0)
const hasChildren = computed(() => props.node.children.length > 0)
const regularChildCount = computed(() => props.node.children.filter(child => !child.special).length)

let expandSequence = 0
const localExpandCommand = shallowRef<ExpandCommand | null>(null)
const effectiveExpandCommand = computed(() => props.depth === 0 ? localExpandCommand.value : props.expandCommand ?? null)

const autoExpanded = () => props.depth === 0 || (!props.node.special && !props.hasSiblings)
const expanded = ref(props.forceExpanded || autoExpanded())

watch(() => props.forceExpanded, (force) => {
  expanded.value = force || autoExpanded()
})

watch(effectiveExpandCommand, (command) => {
  if (!command) return
  if (props.depth === 0) expanded.value ||= command.expand
  else if (hasChildren.value) expanded.value = command.expand
})

const matchedReveal = computed(() => props.reveal?.path[0] === props.node.key ? props.reveal : null)

const childReveal = computed(() => matchedReveal.value && matchedReveal.value.path.length > 1
  ? { id: matchedReveal.value.id, path: matchedReveal.value.path.slice(1) }
  : null)

watch(matchedReveal, (reveal) => {
  if (!reveal) return
  if (reveal.path.length > 1) expanded.value = true
  else nextTick(() => row.value?.scrollIntoView({ block: 'nearest' }))
}, { immediate: true })

const checked = computed(() => hasObjects.value && props.node.objectIds.every(id => context.visibleObjectIds.value.has(id)))
const indeterminate = computed(() => !checked.value && props.node.objectIds.some(id => context.visibleObjectIds.value.has(id)))

// Selection only travels downwards: a parent lights up when it was picked or sits under one, not because all its children are selected
const selected = computed(() => {
  const picked = props.node.origin ?? props.node

  if (!hasObjects.value) return !hasChildren.value && context.selectedNodes.value.has(picked)

  const allSelected = props.node.objectIds.every(id => context.selectedObjectIds.value.has(id))

  return allSelected && (!hasChildren.value || props.parentSelected || context.selectedNodes.value.has(picked))
})

const nameSegments = computed(() => {
  const needle = context.searchQuery.value
  const name = props.node.name
  const haystack = name.toLowerCase()

  if (!needle || !haystack.includes(needle)) return null

  const segments: { text: string, match: boolean }[] = []
  let cursor = 0

  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, cursor)) {
    if (at > cursor) segments.push({ text: name.slice(cursor, at), match: false })

    segments.push({ text: name.slice(at, at + needle.length), match: true })
    cursor = at + needle.length
  }

  if (cursor < name.length) segments.push({ text: name.slice(cursor), match: false })

  return segments
})

const pick = () => ({ node: props.node, modelId: props.modelId, isModelRoot: props.depth === 0 })

function toggleExpanded() {
  if (hasChildren.value) expanded.value = !expanded.value
}

function setExpandAll(expand: boolean) {
  localExpandCommand.value = { id: ++expandSequence, expand }
}

function setHighlighted(highlighted: boolean) {
  if (hasObjects.value) viewer.value?.scene.setObjectsHighlighted(props.node.objectIds, highlighted)
}

function setVisible(event: Event) {
  viewer.value?.scene.setObjectsVisible(props.node.objectIds, (event.target as HTMLInputElement).checked)
}

function select(event: MouseEvent) {
  if (!hasObjects.value && !props.node.title) return toggleExpanded()

  context.selectNode(pick(), event.ctrlKey || event.metaKey, event.shiftKey)
}

function onRowClick(event: MouseEvent) {
  if (hasChildren.value) toggleExpanded()
  else select(event)
}

function flyTo() {
  if (!viewer.value || !hasObjects.value) return

  context.selectNode(pick(), false)
  viewer.value.cameraFlight.flyTo({ aabb: viewer.value.scene.getAABB(props.node.objectIds) })
}

function onContextMenu(event: MouseEvent) {
  if (hasObjects.value) context.openContextMenu(pick())
  else event.preventDefault()
}
</script>

<template>
  <div>
    <div
      ref="row"
      class="flex cursor-pointer items-center gap-1 rounded py-0.5 pr-1 text-nowrap hover:bg-white/10"
      :style="{ paddingLeft: `${depth * 16}px` }"
      :title="node.title"
      @click="onRowClick"
      @contextmenu="onContextMenu"
      @mouseenter="setHighlighted(true)"
      @mouseleave="setHighlighted(false)"
    >
      <UIcon
        v-if="hasChildren"
        name="i-lucide-chevron-right"
        class="size-4 shrink-0 transition-transform duration-100"
        :class="{ 'rotate-90': expanded }"
      />

      <span
        v-else
        class="w-4 shrink-0"
      />

      <input
        v-if="hasObjects"
        type="checkbox"
        class="shrink-0 cursor-pointer accent-violet-400"
        :checked="checked"
        :indeterminate="indeterminate"
        :aria-label="`Show ${node.name}`"
        @click.stop
        @dblclick.stop
        @change="setVisible"
      >

      <span
        v-else
        class="w-3.25 shrink-0"
      />

      <span
        :class="{ 'text-zinc-400': !hasObjects && !hasChildren, 'font-bold text-violet-400': selected }"
        @click.stop="select"
        @dblclick.prevent.stop="flyTo"
      >
        <template v-if="nameSegments">
          <template
            v-for="(segment, index) in nameSegments"
            :key="index"
          >
            <mark
              v-if="segment.match"
              class="rounded-xs bg-violet-400/30 px-px text-inherit"
            >{{ segment.text }}</mark>
            <template v-else>{{ segment.text }}</template>
          </template>
        </template>

        <template v-else>{{ node.name }}</template>
      </span>

      <span
        v-if="depth === 0"
        class="ml-auto flex shrink-0 items-center gap-0.5 pl-2"
      >
        <UButton
          icon="i-lucide-chevrons-up-down"
          size="xs"
          color="neutral"
          variant="ghost"
          title="Expand all"
          aria-label="Expand all"
          @click.stop="setExpandAll(true)"
        />

        <UButton
          icon="i-lucide-chevrons-down-up"
          size="xs"
          color="neutral"
          variant="ghost"
          title="Collapse all"
          aria-label="Collapse all"
          @click.stop="setExpandAll(false)"
        />
      </span>
    </div>

    <div v-if="expanded">
      <ViewerExplorerTreeNode
        v-for="child in node.children"
        :key="child.key"
        :node="child"
        :depth="depth + 1"
        :model-id="modelId"
        :has-siblings="regularChildCount > 1"
        :expand-command="effectiveExpandCommand"
        :reveal="childReveal"
        :force-expanded="forceExpanded"
        :parent-selected="selected"
      />
    </div>
  </div>
</template>
