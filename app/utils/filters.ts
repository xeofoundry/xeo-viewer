export type FilterOperator = 'equals' | 'notEquals' | 'contains' | 'notContains' | 'isEmpty' | 'isNotEmpty'
  | 'greaterThan' | 'lessThan' | 'greaterOrEqual' | 'lessOrEqual' | 'before' | 'after' | 'isTrue' | 'isFalse'

export type PropertyDataType = 'string' | 'number' | 'boolean' | 'date'

export interface FilterCondition {
  id: number
  property: string
  operator: FilterOperator
  value: string
  join: 'AND' | 'OR'
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: 'Equals',
  notEquals: 'Not equals',
  contains: 'Contains',
  notContains: 'Not contains',
  isEmpty: 'Is empty',
  isNotEmpty: 'Is not empty',
  greaterThan: 'Greater than',
  lessThan: 'Less than',
  greaterOrEqual: 'Greater or equal',
  lessOrEqual: 'Less or equal',
  before: 'Before',
  after: 'After',
  isTrue: 'Is true',
  isFalse: 'Is false',
}

export const OPERATORS_BY_TYPE: Record<PropertyDataType, FilterOperator[]> = {
  string: ['equals', 'notEquals', 'contains', 'notContains', 'isEmpty', 'isNotEmpty'],
  number: ['equals', 'notEquals', 'greaterThan', 'lessThan', 'greaterOrEqual', 'lessOrEqual', 'isEmpty', 'isNotEmpty'],
  boolean: ['isTrue', 'isFalse', 'isEmpty', 'isNotEmpty'],
  date: ['equals', 'notEquals', 'before', 'after', 'isEmpty', 'isNotEmpty'],
}

const NO_VALUE_OPERATORS = new Set<FilterOperator>(['isEmpty', 'isNotEmpty', 'isTrue', 'isFalse'])
const NEGATIONS: Partial<Record<FilterOperator, FilterOperator>> = { notEquals: 'equals', notContains: 'contains', isEmpty: 'isNotEmpty' }

export const needsValue = (operator: FilterOperator) => !NO_VALUE_OPERATORS.has(operator)

export const isActiveCondition = (condition: FilterCondition) =>
  !!condition.property && (!needsValue(condition.operator) || condition.value.trim() !== '')

// IFC exports booleans as .T. and .F.
const isTruthy = (value: string) => ['true', '.t.', '1'].includes(value.trim().toLowerCase())
const isFalsy = (value: string) => ['false', '.f.', '0'].includes(value.trim().toLowerCase())

function parseDate(value: string) {
  const text = value.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  const european = /^(\d{2})[./](\d{2})[./](\d{4})$/.exec(text)
  const [year, month, day] = iso ? [iso[1], iso[2], iso[3]] : european ? [european[3], european[2], european[1]] : []

  return year ? Date.UTC(Number(year), Number(month) - 1, Number(day)) : Number.NaN
}

export function detectDataType(values: string[]): PropertyDataType {
  const sample = values.filter(value => value.trim()).slice(0, 50)

  if (!sample.length) return 'string'
  if (sample.every(value => isTruthy(value) || isFalsy(value))) return 'boolean'
  if (sample.every(value => !Number.isNaN(Number(value)))) return 'number'
  if (sample.every(value => !Number.isNaN(parseDate(value)))) return 'date'

  return 'string'
}

// `target` is trimmed and lowercased
function test(operator: FilterOperator, value: string, target: string) {
  switch (operator) {
    case 'equals': return value.trim().toLowerCase() === target
    case 'contains': return value.toLowerCase().includes(target)
    case 'greaterThan': return Number(value) > Number(target)
    case 'lessThan': return Number(value) < Number(target)
    case 'greaterOrEqual': return Number(value) >= Number(target)
    case 'lessOrEqual': return Number(value) <= Number(target)
    case 'before': return parseDate(value) < parseDate(target)
    case 'after': return parseDate(value) > parseDate(target)
    case 'isTrue': return isTruthy(value)
    case 'isFalse': return isFalsy(value)
    default: return true
  }
}

// An object can hold several values for one property name, it matches when any of them does
export function evaluateCondition(values: string[], { operator, value }: FilterCondition) {
  const negated = NEGATIONS[operator]
  const target = value.trim().toLowerCase()
  const matched = values.some(candidate => candidate.trim() !== '' && test(negated ?? operator, candidate, target))

  return negated ? !matched : matched
}

// AND binds tighter than OR, so the conditions form OR-ed groups of AND-ed conditions
export function matchesConditions(props: Map<string, string[]>, conditions: FilterCondition[]) {
  let groupMatches = true
  let first = true

  for (const condition of conditions) {
    if (!isActiveCondition(condition)) continue

    if (!first && condition.join === 'OR') {
      if (groupMatches) return true

      groupMatches = true
    }

    first = false
    groupMatches &&= evaluateCondition(props.get(condition.property) ?? [], condition)
  }

  return groupMatches
}
