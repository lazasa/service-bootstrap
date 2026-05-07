// Standalone repository — does NOT extend BaseRepository because the
// Item table includes free-form fields where humps would be unwanted.
// The shipped example uses snake_case column names directly (see
// items.types.ts), matching the brands-service pattern.
//
// Each repository is per-domain. Cross-table reads belong on the
// initiating resource's repository — never on a sibling repo.
import { SupabaseClient } from '@supabase/supabase-js'
import { Item, ItemCreateInput, ItemUpdateInput } from './items.types'

export class ItemsRepository {
  constructor(
    private supabase: SupabaseClient,
    private schema: string
  ) {}

  private get table() {
    return this.supabase.schema(this.schema).from('items')
  }

  async list(params: {
    page: number
    limit: number
  }): Promise<{ data: Item[]; hasNext: boolean }> {
    const from = (params.page - 1) * params.limit
    const to = from + params.limit

    const { data, error } = await this.table
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    const hasNext = data.length > params.limit
    const items = hasNext ? data.slice(0, -1) : data
    return { data: items as Item[], hasNext }
  }

  async findById(id: string): Promise<Item | null> {
    const { data, error } = await this.table.select('*').eq('id', id).single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data as Item
  }

  async create(input: ItemCreateInput, createdBy: string): Promise<Item> {
    const { data, error } = await this.table
      .insert({
        name: input.name,
        description: input.description ?? null,
        created_by: createdBy,
        last_updated_by: createdBy
      })
      .select()
      .single()

    if (error) throw error
    return data as Item
  }

  async update(
    id: string,
    input: ItemUpdateInput,
    updatedBy: string
  ): Promise<Item | null> {
    const { data, error } = await this.table
      .update({ ...input, last_updated_by: updatedBy })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data as Item
  }
}
