import {
  OpaqueFields,
  buildOpaqueFields,
  camelizeRowExcept,
  decamelizeInputExcept,
} from './keyTransform'

// Inherit to gain protected camelize<U> / decamelize that respect the
// declared opaque snake_case keys (subtree pass-through for JSONB).
// No Supabase coupling — composable with any persistence layer.
export abstract class KeyTransformer {
  private readonly opaque: OpaqueFields

  constructor(opaqueFields: string[] = []) {
    this.opaque = buildOpaqueFields(opaqueFields)
  }

  protected camelize<U>(row: unknown): U {
    return camelizeRowExcept(row, this.opaque) as U
  }

  protected decamelize(input: unknown): unknown {
    return decamelizeInputExcept(input, this.opaque)
  }
}
