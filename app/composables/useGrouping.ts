const criteria = ref<string[]>([])
const groups = shallowRef<GroupNode[]>([])

let colors = new Map<string, RgbColor>()

const activeCount = computed(() => criteria.value.filter(Boolean).length)

// Groups what the filter left visible. Following scene visibility instead, as xeovision does, would regroup
// and shift the palette every time FastNav hides furniture during a camera move.
function apply() {
  const scene = useViewer().value?.scene
  const active = criteria.value.filter(Boolean)
  const index = active.length ? propertyIndex.value : undefined
  const { hiddenIds } = useFilters()
  const ids = [...index?.propsByObject.keys() ?? []].filter(id => !hiddenIds.value.has(id))

  groups.value = buildGroups(ids, active, (id, criterion) => groupValue(index!, id, criterion) ?? 'Unknown')
    .map((group, i) => ({ ...group, color: GROUP_COLORS[i % GROUP_COLORS.length] }))

  const next = new Map(groups.value.flatMap(group => group.ids.map(id => [id, group.color!] as const)))

  // A null colorize restores the object's own color
  scene?.setObjectsColorized([...colors.keys()].filter(id => !next.has(id)), null as unknown as number[])

  for (const [id, color] of next) {
    const entity = scene?.objects[id]

    if (entity && colors.get(id) !== color) entity.colorize = color
  }

  colors = next
}

watch(criteria, apply, { deep: true })
watch([useFilters().hiddenIds, loadedModels], apply)

function clearGrouping() {
  criteria.value = []
}

export const useGrouping = () => ({ criteria, groups, activeCount, clearGrouping })
