import type { SceneModelEntity } from '@xeokit/xeokit-sdk'

const inspected = reactive(new Map<string, PropertyObject>())

export function useProperties() {
  const viewer = useViewer()
  const open = useOpenPanels()

  function show(key: string, object: PropertyObject) {
    open.value.properties = true
    inspected.set(key, object)
  }

  function showNode(key: string, modelId: string, sourceId: string, name: string) {
    if (!viewer.value) return

    const object = buildPropertyObject(modelMetadata(viewer.value, modelId), sourceId)

    show(key, object ?? { name, type: '', attributes: {}, propertySets: [] })
  }

  function showObject(objectId: string) {
    const entity = viewer.value?.scene.objects[objectId] as SceneModelEntity | undefined

    if (entity) showNode(objectId, String(entity.model.id), entity.originalSystemId, entity.originalSystemId)
  }

  function showModel(modelId: string, name: string) {
    if (viewer.value) show(`model:${modelId}`, buildModelPropertyObject(modelMetadata(viewer.value, modelId), name))
  }

  function clearSelection() {
    const scene = viewer.value?.scene

    scene?.setObjectsSelected(scene.selectedObjectIds, false)
    inspected.clear()
  }

  return {
    inspected,
    showNode,
    showObject,
    showModel,
    hide: (key: string) => inspected.delete(key),
    clearSelection,
  }
}
