export type RgbColor = [number, number, number]

export interface GroupNode {
  label: string
  ids: string[]
  children: GroupNode[]
  color?: RgbColor
}

const STOREY_CRITERION = '__storey__'
const MATERIAL_CRITERION = '__material__'

export const GROUP_CRITERIA = [
  { value: STOREY_CRITERION, label: 'Building storey' },
  { value: MATERIAL_CRITERION, label: 'Material' },
  { value: CLASS_PROPERTY, label: 'IFC class' },
]

export const GROUP_COLORS: RgbColor[] = [
  [0.231, 0.533, 0.886],
  [0.906, 0.298, 0.235],
  [0.18, 0.8, 0.443],
  [0.608, 0.349, 0.714],
  [1.0, 0.655, 0.149],
  [0.086, 0.627, 0.522],
  [0.902, 0.494, 0.133],
  [0.204, 0.596, 0.859],
  [0.827, 0.329, 0.51],
  [0.557, 0.267, 0.678],
  [0.173, 0.243, 0.314],
  [0.498, 0.549, 0.553],
  [0.945, 0.769, 0.059],
  [0.18, 0.204, 0.212],
  [0.584, 0.647, 0.651],
  [0.741, 0.2, 0.2],
  [0.4, 0.733, 0.416],
  [0.478, 0.639, 0.859],
  [0.82, 0.573, 0.247],
  [0.533, 0.82, 0.733],
]

const firstValue = (values: string[] = []) => values.find(value => value.trim())?.trim()

export function groupValue(index: PropertyIndex, id: string, criterion: string) {
  const props = index.propsByObject.get(id)

  if (criterion === STOREY_CRITERION) return index.storeyByObject.get(id)
  if (criterion === MATERIAL_CRITERION) return firstValue([...props ?? []].filter(([name]) => /material/i.test(name)).flatMap(([, values]) => values))

  return firstValue(props?.get(criterion))
}

export function buildGroups(ids: string[], criteria: string[], valueOf: (id: string, criterion: string) => string): GroupNode[] {
  const [criterion, ...rest] = criteria

  if (!criterion) return []

  const buckets = new Map<string, string[]>()

  for (const id of ids) {
    const label = valueOf(id, criterion)
    const bucket = buckets.get(label)

    if (bucket) bucket.push(id)
    else buckets.set(label, [id])
  }

  return [...buckets]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([label, groupIds]) => ({ label, ids: groupIds, children: buildGroups(groupIds, rest, valueOf) }))
}
