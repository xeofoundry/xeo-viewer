<script setup lang="ts">
import type { ContextMenuItem } from '@nuxt/ui'
import type { SceneModel, Viewer } from '@xeokit/xeokit-sdk'

const props = defineProps<{ tab: ExplorerTab }>()

const viewer = useViewer()
const { models } = useModels()
const properties = useProperties()

const trees = shallowRef<TreeNode[]>([])
const visibleObjectIds = shallowRef(new Set<string>())
const selectedObjectIds = shallowRef(new Set<string>())
const selectedNodes = shallowRef(new Set<TreeNode>())
const reveal = shallowRef<RevealRequest | null>(null)
const contextPick = shallowRef<TreePick | null>(null)

const query = ref('')
const needle = computed(() => query.value.trim().toLowerCase())

const shownTrees = computed(() => needle.value
  ? trees.value.map(tree => filterTree(tree, needle.value)).filter(tree => !!tree)
  : trees.value)

let suppressReveal = false
let anchorNode: TreeNode | null = null

function siblingsOf(node: TreeNode) {
  const stack = [...trees.value]

  while (stack.length) {
    const current = stack.pop()!

    if (current.children.includes(node)) return current.children

    stack.push(...current.children)
  }

  return null
}

// Shift-click spans only siblings, a range across branches has no order the user could predict
function nodesBetween(from: TreeNode | null, to: TreeNode) {
  const siblings = from && from !== to ? siblingsOf(to) : null
  const start = siblings?.indexOf(from!) ?? -1
  const end = siblings?.indexOf(to) ?? -1

  if (!siblings || start < 0 || end < 0) return null

  return siblings.slice(Math.min(start, end), Math.max(start, end) + 1)
}

function selectNode({ node, modelId, isModelRoot }: TreePick, additive: boolean, range = false) {
  const scene = viewer.value?.scene

  if (!scene) return

  const picked = node.origin ?? node
  const spanned = range ? nodesBetween(anchorNode, picked) : null

  if (spanned) {
    suppressReveal = true

    if (!additive) properties.clearSelection()

    scene.setObjectsSelected(spanned.flatMap(sibling => sibling.objectIds), true)
    suppressReveal = false

    selectedNodes.value = new Set([...additive ? selectedNodes.value : [], ...spanned])

    for (const sibling of spanned) {
      if (sibling.title) properties.showNode(sibling.objectId ?? sibling.title, modelId, sibling.title, sibling.name)
    }

    return
  }

  const hasObjects = node.objectIds.length > 0
  const alreadySelected = new Set(scene.selectedObjectIds)
  const wasPicked = selectedNodes.value.has(picked)
  const allSelected = hasObjects ? node.objectIds.every(id => alreadySelected.has(id)) : wasPicked

  // A click deselects the node it picked last time, and Ctrl-click also deselects a leaf, so a selection made in the scene can be trimmed
  const nextSelected = !(allSelected && !range && (wasPicked || (!picked.children.length && additive)))

  suppressReveal = true

  if (!additive) properties.clearSelection()
  if (hasObjects) scene.setObjectsSelected(node.objectIds, nextSelected)

  suppressReveal = false

  const nextPicked = new Set(additive ? selectedNodes.value : [])

  if (nextSelected) nextPicked.add(picked)
  else nextPicked.delete(picked)

  selectedNodes.value = nextPicked
  anchorNode = nextSelected ? picked : null

  const key = isModelRoot ? `model:${modelId}` : node.objectId ?? node.title

  if (!key) return
  if (!nextSelected) properties.hide(key)
  else if (isModelRoot) properties.showModel(modelId, node.name)
  else properties.showNode(key, modelId, node.title!, node.name)
}

function contextMenuItems(pick: TreePick, viewerInstance: Viewer): ContextMenuItem[][] {
  const { scene, cameraFlight } = viewerInstance
  const ids = pick.node.objectIds
  const objects = ids.map(id => scene.objects[id]).filter(object => !!object)

  const anyVisible = objects.some(object => object.visible)
  const anyHidden = objects.some(object => !object.visible)
  const anyXRayed = objects.some(object => object.xrayed)
  const anySelected = objects.some(object => object.selected)

  function viewFit() {
    scene.setObjectsVisible(ids, true)
    scene.setObjectsHighlighted(ids, true)

    cameraFlight.flyTo({ aabb: scene.getAABB(ids), duration: 0.5 }, () => {
      setTimeout(() => scene.setObjectsHighlighted(scene.highlightedObjectIds, false), 500)
    })
  }

  function deselect() {
    scene.setObjectsSelected(ids, false)

    if (pick.node.title) properties.hide(pick.node.objectId ?? pick.node.title)
  }

  return [
    [{ label: 'Inspect Properties', onSelect: () => selectNode(pick, false) }],
    [
      {
        label: 'View / Show',
        children: [
          { label: 'View Fit', onSelect: viewFit },
          {
            label: 'Show',
            disabled: !anyHidden && !anyXRayed,
            onSelect: () => {
              scene.setObjectsVisible(ids, true)
              scene.setObjectsXRayed(ids, false)
            },
          },
          {
            label: 'Show Others',
            onSelect: () => {
              scene.setObjectsVisible(scene.objectIds, true)
              scene.setObjectsXRayed(scene.xrayedObjectIds, false)
              scene.setObjectsVisible(ids, false)
            },
          },
          {
            label: 'Show All',
            disabled: scene.numVisibleObjects >= scene.numObjects && !scene.numXRayedObjects && !scene.numSelectedObjects,
            onSelect: () => scene.setObjectsVisible(scene.objectIds, true),
          },
        ],
      },
      {
        label: 'Hide',
        children: [
          { label: 'Hide', disabled: !anyVisible, onSelect: () => scene.setObjectsVisible(ids, false) },
          {
            label: 'Hide Others',
            onSelect: () => {
              scene.setObjectsVisible(scene.visibleObjectIds, false)
              scene.setObjectsVisible(ids, true)
            },
          },
          { label: 'Hide All', disabled: !scene.numVisibleObjects, onSelect: () => scene.setObjectsVisible(scene.visibleObjectIds, false) },
        ],
      },
      {
        label: 'X-Ray',
        children: [
          {
            label: 'X-Ray',
            disabled: objects.every(object => object.xrayed),
            onSelect: () => {
              scene.setObjectsVisible(ids, true)
              scene.setObjectsXRayed(ids, true)
            },
          },
          { label: 'Undo X-Ray', disabled: !anyXRayed, onSelect: () => scene.setObjectsXRayed(ids, false) },
          {
            label: 'X-Ray Others',
            onSelect: () => {
              scene.setObjectsVisible(scene.objectIds, true)
              scene.setObjectsXRayed(scene.objectIds, true)
              scene.setObjectsXRayed(ids, false)
            },
          },
          { label: 'Reset X-Ray', disabled: !scene.numXRayedObjects, onSelect: () => scene.setObjectsXRayed(scene.xrayedObjectIds, false) },
        ],
      },
    ],
    [
      {
        label: 'Select',
        children: [
          { label: 'Select', disabled: objects.every(object => object.selected), onSelect: () => scene.setObjectsSelected(ids, true) },
          { label: 'Deselect', disabled: !anySelected, onSelect: deselect },
          { label: 'Clear Selection', disabled: !scene.numSelectedObjects, onSelect: properties.clearSelection },
        ],
      },
    ],
  ]
}

// Scene state is not reactive, so the items are rebuilt from scratch on every right-click
const menuItems = computed(() => contextPick.value && viewer.value ? contextMenuItems(contextPick.value, viewer.value) : [])

provide(ExplorerTreeContextKey, {
  visibleObjectIds,
  selectedObjectIds,
  selectedNodes,
  searchQuery: needle,
  selectNode,
  openContextMenu: (pick) => {
    contextPick.value = pick
  },
})

function refreshVisible() {
  if (viewer.value) visibleObjectIds.value = new Set(viewer.value.scene.visibleObjectIds)
}

function refreshSelected() {
  if (viewer.value) selectedObjectIds.value = new Set(viewer.value.scene.selectedObjectIds)
}

function rebuild() {
  const scene = viewer.value?.scene

  trees.value = scene
    ? models.value.flatMap(({ id, name }) => {
        const model = scene.models[id] as SceneModel | undefined

        return model ? [buildModelTree(Object.values(model.objects), modelMetadata(viewer.value!, id), id, name, props.tab)] : []
      })
    : []

  reveal.value = null
  selectedNodes.value = new Set()
  anchorNode = null
  refreshVisible()
  refreshSelected()
}

let revealCounter = 0
let pendingRevealObjectId: string | null = null

function revealObject() {
  const objectId = pendingRevealObjectId

  pendingRevealObjectId = null

  if (!objectId) return

  for (const tree of trees.value) {
    const path = findRevealPath(tree, objectId)

    if (path) {
      reveal.value = { id: ++revealCounter, path }
      return
    }
  }
}

const scheduleRebuild = perFrame(rebuild)
const scheduleVisibleRefresh = perFrame(refreshVisible)
const scheduleSelectedRefresh = perFrame(refreshSelected)
const scheduleReveal = perFrame(revealObject)

watch(models, scheduleRebuild, { immediate: true })

watch(viewer, (instance, _, onCleanup) => {
  if (!instance) return

  const { scene } = instance

  const subscriptions = [
    scene.on('objectVisibility', scheduleVisibleRefresh),
    scene.on('objectSelected', (entity) => {
      scheduleSelectedRefresh()

      if (!suppressReveal && entity?.selected) {
        pendingRevealObjectId = String(entity.id)
        scheduleReveal()
      }
    }),
  ]

  scheduleRebuild()
  onCleanup(() => subscriptions.forEach(subscription => scene.off(subscription)))
}, { immediate: true })
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col text-sm select-none">
    <UInput
      v-if="trees.length"
      v-model="query"
      icon="i-lucide-search"
      placeholder="Search tree..."
      aria-label="Search tree"
      class="mb-3 shrink-0"
      :ui="{ trailing: 'pe-1' }"
    >
      <template
        v-if="query"
        #trailing
      >
        <UButton
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="link"
          aria-label="Clear search"
          @click="query = ''"
        />
      </template>
    </UInput>

    <UContextMenu :items="menuItems">
      <div
        class="min-h-0 flex-1 overflow-y-auto"
        @contextmenu.self.prevent
      >
        <ViewerExplorerTreeNode
          v-for="tree in shownTrees"
          :key="tree.key"
          :node="tree"
          :depth="0"
          :model-id="tree.key"
          :reveal="reveal"
          :force-expanded="!!needle"
        />

        <div
          v-if="!shownTrees.length"
          class="px-2 py-4 text-center text-zinc-400"
          @contextmenu.prevent
        >
          {{ needle ? 'No matching elements' : 'No models with metadata loaded' }}
        </div>
      </div>
    </UContextMenu>
  </div>
</template>
