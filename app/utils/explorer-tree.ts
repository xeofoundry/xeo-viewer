import type { SceneModelEntity } from '@xeokit/xeokit-sdk'
import type { InjectionKey, Ref, ShallowRef } from 'vue'

export type ExplorerTab = 'objects' | 'classes' | 'storeys'

export interface TreeNode {
  key: string
  name: string
  search: string
  title?: string
  objectId?: string
  objectIds: string[]
  special?: boolean
  elevation?: number
  children: TreeNode[]
  // Set on the copies search filtering makes, so a node stays identifiable across filtering
  origin?: TreeNode
}

export interface TreePick {
  node: TreeNode
  modelId: string
  isModelRoot: boolean
}

export interface RevealRequest {
  id: number
  path: string[]
}

export interface ExpandCommand {
  id: number
  expand: boolean
}

export interface ExplorerTreeContext {
  visibleObjectIds: ShallowRef<Set<string>>
  selectedObjectIds: ShallowRef<Set<string>>
  selectedNodes: ShallowRef<Set<TreeNode>>
  searchQuery: Ref<string>
  currentMatch: Ref<TreeNode | null>
  selectNode: (pick: TreePick, additive: boolean, range?: boolean) => void
  hoverNode: (node: TreeNode | null) => void
  openContextMenu: (pick: TreePick) => void
}

export const ExplorerTreeContextKey: InjectionKey<ExplorerTreeContext> = Symbol('explorer-tree-context')

// Keyed by originalSystemId, which is the metaObject id
type Drawables = Record<string, SceneModelEntity>

const EMPTY_LABELS: Record<ExplorerTab, string> = { objects: 'No objects', classes: 'No classes', storeys: 'No storeys' }

const NON_TREE_TYPES = new Set(['IfcPropertySet', 'IfcPropertyEnumeratedValue'])
const BUILDING_TYPES = new Set(['IfcBuilding', 'IfcFacility', 'IfcBridge', 'IfcRoad', 'IfcRailway', 'IfcMarineFacility'])

const isBuilding = (type?: string) => !!type && BUILDING_TYPES.has(type)
const isTreeType = (metaObject: IfcMetaObject) => !!metaObject.type && !NON_TREE_TYPES.has(metaObject.type)
const nodeName = (metaObject: IfcMetaObject) => metaObject.name || metaObject.type || String(metaObject.id)

function compareNames(a: string, b: string) {
  const aNumber = Number(a)
  const bNumber = Number(b)

  return Number.isNaN(aNumber) || Number.isNaN(bNumber) ? a.localeCompare(b) : aNumber - bNumber
}

// Storeys go top-down by elevation, ahead of anything without one
function compareNodes(a: TreeNode, b: TreeNode) {
  if (a.elevation !== undefined && b.elevation !== undefined && a.elevation !== b.elevation) return b.elevation - a.elevation
  if (a.elevation !== undefined && b.elevation === undefined) return -1
  if (a.elevation === undefined && b.elevation !== undefined) return 1

  return compareNames(a.name, b.name)
}

const sortNodes = (nodes: TreeNode[]) => nodes.sort(compareNodes)

function createNode(key: string, name: string, objectId: string | undefined, children: TreeNode[], title?: string): TreeNode {
  // An object that also has children gets its own geometry as the first child, so the row stays a plain folder
  if (objectId && children.length) {
    children = [createNode(`${key}-mesh`, name, objectId, [], title), ...children]
    objectId = undefined
  }

  const objectIds = children.flatMap(child => child.objectIds)

  if (objectId) objectIds.push(objectId)

  return { key, name, search: name.toLowerCase(), title, objectId, objectIds, children }
}

function specialNode(key: string, label: string, children: TreeNode[]) {
  return { ...createNode(key, `{${label}}`, undefined, children), special: true }
}

function classNodes(nodesByType: Record<string, TreeNode[]>) {
  return Object.keys(nodesByType)
    .sort(compareNames)
    .map(type => createNode(`class-${type}`, type, undefined, sortNodes(nodesByType[type]!)))
}

function readElevation(metaObject: IfcMetaObject) {
  const raw = metaObject.attributes?.elevation

  if (raw === undefined || raw === null || raw === '') return undefined

  const elevation = Number(raw)

  return Number.isNaN(elevation) ? undefined : elevation
}

function buildGraph(metaObjects: IfcMetaObject[], drawables: Drawables) {
  const indexById = new Map(metaObjects.map((metaObject, index) => [String(metaObject.id), index]))
  const childrenByIndex: number[][] = metaObjects.map(() => [])
  const hasParent = new Uint8Array(metaObjects.length)

  metaObjects.forEach((metaObject, index) => {
    if (Array.isArray(metaObject.children)) {
      for (const childIndex of metaObject.children) {
        if (!metaObjects[childIndex]) continue

        childrenByIndex[index]!.push(childIndex)
        hasParent[childIndex] = 1
      }
    }
    else if (metaObject.parent != null) {
      const parentIndex = indexById.get(String(metaObject.parent))

      if (parentIndex !== undefined && parentIndex !== index) {
        childrenByIndex[parentIndex]!.push(index)
        hasParent[index] = 1
      }
    }
  })

  const buildNode = (index: number): TreeNode | undefined => {
    const metaObject = metaObjects[index]!

    if (!isTreeType(metaObject)) return undefined

    const children = sortNodes(childrenByIndex[index]!.map(buildNode).filter(node => !!node))
    const id = String(metaObject.id)
    const node = createNode(String(index), nodeName(metaObject), drawables[id]?.id, children, id)

    if (!node.objectIds.length) return undefined

    const elevation = readElevation(metaObject)

    if (elevation !== undefined) node.elevation = elevation

    return node
  }

  // Spatial containers have no geometry of their own, so they stand for the entities underneath them
  const descendants = (rootIndex: number, skip: (index: number) => boolean = () => false) => {
    const indices: number[] = []
    const seen = new Set<number>()

    const walk = (index: number) => {
      if (seen.has(index)) return

      seen.add(index)
      indices.push(index)

      for (const childIndex of childrenByIndex[index]!) {
        if (childIndex !== rootIndex && !skip(childIndex)) walk(childIndex)
      }
    }

    walk(rootIndex)

    return indices
  }

  return { childrenByIndex, hasParent, buildNode, descendants }
}

type Graph = ReturnType<typeof buildGraph>

function buildObjects(metaObjects: IfcMetaObject[], graph: Graph) {
  const projectIndices = metaObjects.flatMap((metaObject, index) => metaObject.type === 'IfcProject' ? [index] : [])

  const topIndices = projectIndices.length
    ? projectIndices.flatMap(index => graph.childrenByIndex[index]!)
    : metaObjects.flatMap((_, index) => graph.hasParent[index] ? [] : [index])

  return sortNodes(topIndices.map(graph.buildNode).filter(node => !!node))
}

function buildClasses(metaObjects: IfcMetaObject[], drawables: Drawables, graph: Graph) {
  const nodesByType: Record<string, TreeNode[]> = {}

  metaObjects.forEach((metaObject, index) => {
    if (!isTreeType(metaObject)) return

    const drawable = drawables[String(metaObject.id)]
    const node = createNode(String(index), metaObject.name ?? String(metaObject.id), drawable?.id, [], String(metaObject.id))

    if (!drawable) {
      for (const descendant of graph.descendants(index)) {
        const id = drawables[String(metaObjects[descendant]!.id)]?.id

        if (id) node.objectIds.push(id)
      }

      if (!node.objectIds.length) return
    }

    (nodesByType[metaObject.type!] ??= []).push(node)
  })

  return classNodes(nodesByType)
}

function buildStoreys(metaObjects: IfcMetaObject[], drawables: Drawables, graph: Graph) {
  const skipBuildings = (index: number) => isBuilding(metaObjects[index]!.type)

  const elementsUnder = (rootIndex: number) => graph.descendants(rootIndex, skipBuildings)
    .filter(index => drawables[String(metaObjects[index]!.id)] && isTreeType(metaObjects[index]!) && !isStorey(metaObjects[index]!.type))

  const classNodesOf = (indices: number[]) => {
    const nodesByType: Record<string, TreeNode[]> = {}

    for (const index of indices) {
      const metaObject = metaObjects[index]!
      const id = String(metaObject.id);

      (nodesByType[metaObject.type!] ??= []).push(createNode(`obj-${index}`, metaObject.name ?? id, drawables[id]!.id, [], id))
    }

    return classNodes(nodesByType)
  }

  const storeysUnder = (buildingIndex: number) => graph
    .descendants(buildingIndex, index => isStorey(metaObjects[index]!.type) || skipBuildings(index))
    .flatMap(index => graph.childrenByIndex[index]!.filter(childIndex => isStorey(metaObjects[childIndex]!.type)))

  const buildingNode = (buildingIndex: number) => {
    const covered = new Set<number>()
    const levels: TreeNode[] = []

    for (const storeyIndex of storeysUnder(buildingIndex)) {
      const elements = elementsUnder(storeyIndex)

      elements.forEach(index => covered.add(index))

      if (!elements.length) continue

      const storey = metaObjects[storeyIndex]!
      const node = createNode(`storey-${storeyIndex}`, nodeName(storey), undefined, classNodesOf(elements), String(storey.id))
      const elevation = readElevation(storey)

      if (elevation !== undefined) node.elevation = elevation

      levels.push(node)
    }

    sortNodes(levels)

    const noLevel = elementsUnder(buildingIndex).filter(index => !covered.has(index))

    if (noLevel.length) levels.push(createNode('no-level', '{No Level}', undefined, classNodesOf(noLevel)))

    if (!levels.length) return undefined

    const building = metaObjects[buildingIndex]!

    return createNode(`building-${buildingIndex}`, nodeName(building), undefined, levels, String(building.id))
  }

  return sortNodes(metaObjects.flatMap((metaObject, index) => isBuilding(metaObject.type) ? [buildingNode(index)] : []).filter(node => !!node))
}

function collectTitles(nodes: TreeNode[], titles = new Set<string>()) {
  for (const node of nodes) {
    if (node.title) titles.add(node.title)

    collectTitles(node.children, titles)
  }

  return titles
}

// Entities the tree does not reach, plus metaObjects without geometry, so nothing in the model is unreachable
function buildUnreferenced(metaObjects: IfcMetaObject[], drawables: Drawables, children: TreeNode[], rootObjectIds: string[]) {
  const usedIds = new Set([...children.flatMap(child => child.objectIds), ...rootObjectIds])
  const usedTitles = collectTitles(children)
  const byId = new Map(metaObjects.map(metaObject => [String(metaObject.id), metaObject]))

  const leaves = Object.entries(drawables)
    .filter(([, entity]) => !usedIds.has(entity.id))
    .map(([sourceId, entity]) => {
      const metaObject = byId.get(sourceId)

      return createNode(`unref-${entity.id}`, metaObject ? nodeName(metaObject) : sourceId, entity.id, [], sourceId)
    })

  for (const metaObject of metaObjects) {
    const id = String(metaObject.id)

    if (metaObject.type !== 'IfcProject' && !drawables[id] && !usedTitles.has(id)) {
      leaves.push(createNode(`unref-${id}`, nodeName(metaObject), undefined, [], id))
    }
  }

  return leaves.length ? specialNode('unreferenced', 'Unreferenced', sortNodes(leaves)) : undefined
}

export function buildModelTree(entities: SceneModelEntity[], metadata: IfcMetadata | undefined, modelId: string, modelName: string, tab: ExplorerTab) {
  const drawables: Drawables = {}

  for (const entity of entities) drawables[entity.originalSystemId] = entity

  const metaObjects = metadata?.metaObjects ?? []
  const graph = buildGraph(metaObjects, drawables)

  const children = tab === 'classes'
    ? buildClasses(metaObjects, drawables, graph)
    : tab === 'storeys' ? buildStoreys(metaObjects, drawables, graph) : buildObjects(metaObjects, graph)

  const rootObjectIds = metaObjects
    .filter(metaObject => metaObject.type === 'IfcProject')
    .flatMap(metaObject => drawables[String(metaObject.id)]?.id ?? [])

  const unreferenced = tab === 'objects' ? buildUnreferenced(metaObjects, drawables, children, rootObjectIds) : undefined
  const nodes = unreferenced ? [unreferenced, ...children] : children

  // The model keeps its row even when this tab has nothing for it, otherwise it would look like a failed load
  if (!nodes.length) nodes.push(specialNode('empty', EMPTY_LABELS[tab], []))

  const root = createNode(modelId, modelName, undefined, nodes)

  for (const id of rootObjectIds) {
    if (!root.objectIds.includes(id)) root.objectIds.push(id)
  }

  return root
}

export function findRevealPath(node: TreeNode, objectId: string): string[] | null {
  if (node.objectId === objectId) return [node.key]
  if (!node.objectIds.includes(objectId)) return null

  for (const child of node.children) {
    const path = findRevealPath(child, objectId)

    if (path) return [node.key, ...path]
  }

  return null
}

export function filterTree(node: TreeNode, needle: string): TreeNode | null {
  if (node.search.includes(needle)) return node

  const children = node.children.map(child => filterTree(child, needle)).filter(child => !!child)

  return children.length ? { ...node, children, origin: node.origin ?? node } : null
}

export interface TreeMatch {
  node: TreeNode
  path: string[]
}

export function findMatches(nodes: TreeNode[], needle: string, parentPath: string[] = [], matches: TreeMatch[] = []) {
  for (const node of nodes) {
    const path = [...parentPath, node.key]

    if (node.search.includes(needle)) matches.push({ node, path })

    findMatches(node.children, needle, path, matches)
  }

  return matches
}
