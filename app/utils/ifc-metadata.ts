import type { Viewer } from '@xeokit/xeokit-sdk'

export interface IfcMetaObject {
  id: string | number
  name?: string
  type?: string
  parent?: string | number | null
  children?: number[]
  attributes?: Record<string, unknown>
  propertySetIds?: (string | number)[]
  [key: string]: unknown
}

interface IfcProperty {
  name?: string
  value?: unknown
  ifcValueType?: string
  unit?: number | null
}

interface IfcPropertySet {
  id: string | number
  name?: string
  // Either inline properties or indices into the top-level `properties` array
  properties?: (number | IfcProperty)[]
}

interface IfcUnit {
  name?: string | null
  className?: string | null
  unitEnum?: string | null
}

export interface IfcMetadata {
  id?: string | number
  author?: string
  createdAt?: string
  schema?: string
  creatingApplication?: string
  metaObjects?: IfcMetaObject[]
  propertySets?: IfcPropertySet[]
  properties?: IfcProperty[]
  units?: IfcUnit[]
}

export interface PropertySet {
  name: string
  properties: { name: string, value: string, unit: string | null }[]
}

export interface PropertyObject {
  name: string
  type: string
  attributes: Record<string, unknown>
  propertySets: PropertySet[]
}

const STRUCTURAL_FIELDS = new Set(['id', 'name', 'type', 'parent', 'children', 'propertySetIds'])

export const modelMetadata = (viewer: Viewer, modelId: string) =>
  (viewer.scene.models[modelId] as { metadata?: IfcMetadata } | undefined)?.metadata

function stringifyValue(value: unknown) {
  if (value == null) return ''
  if (typeof value === 'object') return JSON.stringify(value)

  return String(value)
}

// IfcPowerMeasure -> POWERUNIT, IfcPositiveLengthMeasure -> LENGTHUNIT, IfcQuantityArea -> AREAUNIT
function unitEnumOf(ifcValueType: string | undefined) {
  const match = ifcValueType && /^Ifc(?:Quantity(\w+)|(?:Positive|NonNegative)?(\w+)Measure)$/.exec(ifcValueType)
  const quantity = match && (match[1] ?? match[2])

  return quantity && `${quantity === 'Weight' ? 'MASS' : quantity.toUpperCase()}UNIT`
}

function unitName(units: IfcUnit[], property: IfcProperty) {
  if (property.unit != null) return units[property.unit]?.name ?? null

  const unitEnum = unitEnumOf(property.ifcValueType)

  if (!unitEnum) return null

  // Imperial models list both the assigned conversion-based unit (FOOT) and the SI unit it derives from (METRE)
  const unit = units.find(unit => unit.unitEnum === unitEnum && unit.className === 'IfcConversionBasedUnit')
    ?? units.find(unit => unit.unitEnum === unitEnum)

  return unit?.name ?? null
}

export function buildPropertyObject(metadata: IfcMetadata | undefined, sourceId: string): PropertyObject | undefined {
  const metaObject = metadata?.metaObjects?.find(object => String(object.id) === sourceId)

  if (!metadata || !metaObject) return undefined

  const allProperties = metadata.properties ?? []
  const units = metadata.units ?? []
  const propertySetsById = new Map((metadata.propertySets ?? []).map(set => [String(set.id), set]))

  const propertySets = (metaObject.propertySetIds ?? []).flatMap((id) => {
    const set = propertySetsById.get(String(id))

    if (!set) return []

    const properties = (set.properties ?? []).map((entry) => {
      const property = (typeof entry === 'number' ? allProperties[entry] : entry) ?? {}

      return { name: property.name ?? '', value: stringifyValue(property.value), unit: unitName(units, property) }
    })

    return [{ name: set.name ?? '', properties }]
  })

  const attributes: Record<string, unknown> = { GUID: String(metaObject.id), ...metaObject.attributes }

  for (const [key, value] of Object.entries(metaObject)) {
    if (!STRUCTURAL_FIELDS.has(key) && value != null && typeof value !== 'object') attributes[key] = value
  }

  return { name: metaObject.name ?? sourceId, type: metaObject.type ?? '', attributes, propertySets }
}

export function buildModelPropertyObject(metadata: IfcMetadata | undefined, fallbackName: string): PropertyObject {
  const project = metadata?.metaObjects?.find(object => object.type === 'IfcProject')
  const base = project && buildPropertyObject(metadata, String(project.id))

  const header = ([
    ['File name', metadata?.id],
    ['Schema', metadata?.schema],
    ['Author', metadata?.author],
    ['Time stamp', metadata?.createdAt],
    ['Originating system', metadata?.creatingApplication],
  ] as const)
    .filter(([, value]) => value != null && value !== '')
    .map(([name, value]) => ({ name, value: stringifyValue(value), unit: null }))

  return {
    name: base?.name ?? fallbackName,
    type: base?.type ?? '',
    attributes: base?.attributes ?? {},
    propertySets: [...base?.propertySets ?? [], ...header.length ? [{ name: 'File Header', properties: header }] : []],
  }
}
