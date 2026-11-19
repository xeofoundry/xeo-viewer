import type { SceneModel, SceneModelEntity, Viewer } from '@xeokit/xeokit-sdk'

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
  prefix?: string | null
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

export interface PropertySummary {
  values: string[]
  dataType: PropertyDataType
}

export interface PropertyIndex {
  propsByObject: Map<string, Map<string, string[]>>
  storeyByObject: Map<string, string>
  properties: Map<string, PropertySummary>
  classes: string[]
}

// The index stores each object's IFC class as a property under this name, next to its psets
export const CLASS_PROPERTY = 'Type'

const STRUCTURAL_FIELDS = new Set(['id', 'name', 'type', 'parent', 'children', 'propertySetIds'])
const MAX_SUGGESTIONS = 100

export const isStorey = (type?: string) => type === 'IfcBuildingStorey' || type === 'IfcFacilityPart'

const SI_SYMBOLS: Record<string, string> = {
  'ampere': 'A', 'becquerel': 'Bq', 'candela': 'cd', 'coulomb': 'C', 'cubic metre': 'm³', 'degree celsius': '°C',
  'farad': 'F', 'gram': 'g', 'gray': 'Gy', 'henry': 'H', 'hertz': 'Hz', 'joule': 'J', 'kelvin': 'K', 'lumen': 'lm',
  'lux': 'lx', 'metre': 'm', 'mole': 'mol', 'newton': 'N', 'ohm': 'Ω', 'pascal': 'Pa', 'radian': 'rad', 'second': 's',
  'siemens': 'S', 'sievert': 'Sv', 'square metre': 'm²', 'steradian': 'sr', 'tesla': 'T', 'volt': 'V', 'watt': 'W', 'weber': 'Wb',
}

const CONVERSION_SYMBOLS: Record<string, string> = {
  'foot': 'ft', 'square foot': 'ft²', 'cubic foot': 'ft³', 'inch': 'in', 'square inch': 'in²', 'cubic inch': 'in³',
  'yard': 'yd', 'square yard': 'yd²', 'cubic yard': 'yd³', 'mile': 'mi', 'acre': 'ac', 'gallon': 'gal', 'pound': 'lb',
  'degree': '°', 'degree fahrenheit': '°F',
}

const SI_PREFIXES: Record<string, string> = {
  EXA: 'E', PETA: 'P', TERA: 'T', GIGA: 'G', MEGA: 'M', KILO: 'k', HECTO: 'h', DECA: 'da',
  DECI: 'd', CENTI: 'c', MILLI: 'm', MICRO: 'µ', NANO: 'n', PICO: 'p', FEMTO: 'f', ATTO: 'a',
}

export const modelMetadata = (viewer: Viewer, modelId: string) =>
  (viewer.scene.models[modelId] as { metadata?: IfcMetadata } | undefined)?.metadata

export function objectTypes(viewer: Viewer) {
  const types = new Map<string, string>()

  for (const [modelId, model] of Object.entries(viewer.scene.models)) {
    const typeBySourceId = new Map(modelMetadata(viewer, modelId)?.metaObjects?.map(object => [String(object.id), object.type]))

    for (const entity of Object.values((model as unknown as SceneModel).objects)) {
      const type = typeBySourceId.get(entity.originalSystemId)

      if (type) types.set(String(entity.id), type)
    }
  }

  return types
}

// The entity plus every entity below its metaObject, so an aggregate (a stair with its flights) acts as one
export function subtreeObjectIds(viewer: Viewer, entity: SceneModelEntity) {
  const metaObjects = modelMetadata(viewer, String(entity.model.id))?.metaObjects ?? []
  const entityIds = new Map(Object.values(entity.model.objects).map(object => [object.originalSystemId, object.id]))
  const childrenOf = new Map<string, string[]>()

  for (const metaObject of metaObjects) {
    if (metaObject.parent == null) continue

    const parent = String(metaObject.parent)

    if (!childrenOf.has(parent)) childrenOf.set(parent, [])

    childrenOf.get(parent)!.push(String(metaObject.id))
  }

  const ids = new Set([entity.id])
  const seen = new Set<string>()
  const stack = [entity.originalSystemId]

  while (stack.length) {
    const sourceId = stack.pop()!

    if (seen.has(sourceId)) continue

    seen.add(sourceId)

    const id = entityIds.get(sourceId)

    if (id) ids.add(id)

    stack.push(...childrenOf.get(sourceId) ?? [])
  }

  return [...ids]
}

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

// Converters emit both full IFC names (METRE, SQUARE FOOT) and ready symbols (m2, kg with prefix KILO),
// so the prefix is only added to a full SI name, never to a symbol that already carries it
function unitSymbol(unit: IfcUnit | undefined) {
  if (!unit?.name) return null

  const name = unit.name.toLowerCase().replace(/[\s_]+/g, ' ')

  if (SI_SYMBOLS[name]) return (SI_PREFIXES[unit.prefix ?? ''] ?? '') + SI_SYMBOLS[name]

  return CONVERSION_SYMBOLS[name] ?? unit.name.replace(/2$/, '²').replace(/3$/, '³')
}

function propertyUnit(units: IfcUnit[], property: IfcProperty) {
  if (property.unit != null) return unitSymbol(units[property.unit])

  const unitEnum = unitEnumOf(property.ifcValueType)

  if (!unitEnum) return null

  // Imperial models list both the assigned conversion-based unit (FOOT) and the SI unit it derives from (METRE)
  return unitSymbol(units.find(unit => unit.unitEnum === unitEnum && unit.className === 'IfcConversionBasedUnit')
    ?? units.find(unit => unit.unitEnum === unitEnum))
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

      return { name: property.name ?? '', value: stringifyValue(property.value), unit: propertyUnit(units, property) }
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

function storeyResolver(metaObjects: IfcMetaObject[], byId: Map<string, IfcMetaObject>) {
  const parents = new Map<IfcMetaObject, IfcMetaObject>()

  for (const object of metaObjects) {
    for (const childIndex of object.children ?? []) {
      const child = metaObjects[childIndex]

      if (child) parents.set(child, object)
    }

    const parent = object.parent != null ? byId.get(String(object.parent)) : undefined

    if (parent && !parents.has(object)) parents.set(object, parent)
  }

  return (start: IfcMetaObject) => {
    const seen = new Set<IfcMetaObject>()
    let object: IfcMetaObject | undefined = start

    while (object && !seen.has(object)) {
      if (isStorey(object.type)) return object.name || String(object.id)

      seen.add(object)
      object = parents.get(object)
    }

    return undefined
  }
}

export function summarizeProperties(objects: Iterable<Map<string, string[]>>): Map<string, PropertySummary> {
  const valuesByName = new Map<string, Set<string>>()

  for (const props of objects) {
    for (const [name, values] of props) {
      let set = valuesByName.get(name)

      if (!set) valuesByName.set(name, set = new Set())

      for (const value of values) {
        if (value && set.size < MAX_SUGGESTIONS) set.add(value)
      }
    }
  }

  return new Map([...valuesByName.keys()].sort((a, b) => a.localeCompare(b)).map((name) => {
    const values = [...valuesByName.get(name)!].sort()

    return [name, { values, dataType: detectDataType(values) }]
  }))
}

export function buildPropertyIndex(viewer: Viewer): PropertyIndex {
  const propsByObject = new Map<string, Map<string, string[]>>()
  const storeyByObject = new Map<string, string>()

  for (const [modelId, model] of Object.entries(viewer.scene.models)) {
    const metadata = modelMetadata(viewer, modelId)
    const metaObjects = metadata?.metaObjects ?? []
    const byId = new Map(metaObjects.map(object => [String(object.id), object]))
    const propertySets = new Map((metadata?.propertySets ?? []).map(set => [String(set.id), set]))
    const storeyOf = storeyResolver(metaObjects, byId)

    for (const entity of Object.values((model as unknown as SceneModel).objects)) {
      const id = String(entity.id)
      const metaObject = byId.get(entity.originalSystemId)
      const props = new Map([['Name', [metaObject?.name ?? '']], [CLASS_PROPERTY, [metaObject?.type ?? '']]])

      for (const setId of metaObject?.propertySetIds ?? []) {
        for (const entry of propertySets.get(String(setId))?.properties ?? []) {
          const property = typeof entry === 'number' ? metadata?.properties?.[entry] : entry

          if (!property?.name) continue

          const value = stringifyValue(property.value)
          const values = props.get(property.name)

          if (values) values.push(value)
          else props.set(property.name, [value])
        }
      }

      propsByObject.set(id, props)

      const storey = metaObject && storeyOf(metaObject)

      if (storey) storeyByObject.set(id, storey)
    }
  }

  const classes = new Set([...propsByObject.values()].map(props => props.get(CLASS_PROPERTY)![0]!))

  classes.delete('')

  return { propsByObject, storeyByObject, properties: summarizeProperties(propsByObject.values()), classes: [...classes].sort() }
}
