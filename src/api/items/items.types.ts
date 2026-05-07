// DB-shape interfaces for the items table. Snake_case to match the
// Postgres column names; the repository returns these directly.
export interface Item {
  id: string
  name: string
  description: string | null
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
  created_by: string | null
  last_updated_by: string | null
}

export type ItemCreateInput = Pick<Item, 'name' | 'description'>
export type ItemUpdateInput = Partial<Pick<Item, 'name' | 'description' | 'status'>>
