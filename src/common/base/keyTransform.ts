import humps from 'humps'

export interface OpaqueFields {
  readonly snake: ReadonlySet<string>
  readonly camel: ReadonlySet<string>
}

export function buildOpaqueFields(snakeKeys: string[]): OpaqueFields {
  return {
    snake: new Set(snakeKeys),
    camel: new Set(snakeKeys.map((k) => humps.camelize(k))),
  }
}

// Renames each top-level key to camelCase. For keys in `opaque.snake`, the
// value is passed through verbatim (JSONB-safe). All other values are
// recursively camelized by humps.
export function camelizeRowExcept(row: unknown, opaque: OpaqueFields): unknown {
  if (row === null || typeof row !== 'object') return row
  if (Array.isArray(row)) return row.map((item) => camelizeRowExcept(item, opaque))
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(row as Record<string, unknown>)) {
    const camelKey = humps.camelize(key)
    result[camelKey] = opaque.snake.has(key) ? val : humps.camelizeKeys(val as any)
  }
  return result
}

// Renames each top-level key to snake_case. For keys in `opaque.camel`, the
// value is passed through verbatim (JSONB-safe). All other values are
// recursively decamelized by humps.
export function decamelizeInputExcept(input: unknown, opaque: OpaqueFields): unknown {
  if (input === null || typeof input !== 'object') return input
  if (Array.isArray(input)) return input.map((item) => decamelizeInputExcept(item, opaque))
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
    const snakeKey = humps.decamelize(key)
    result[snakeKey] = opaque.camel.has(key) ? val : humps.decamelizeKeys(val as any)
  }
  return result
}
