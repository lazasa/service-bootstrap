// Business logic for items. Routes call services; services call
// repositories. Never call Supabase from here directly — go through the
// repository so the data access stays in one place per domain.
import { NotFoundError } from '../../utils/errors'
import { ItemsRepository } from './items.repository'
import { Item, ItemCreateInput, ItemUpdateInput } from './items.types'

export class ItemsService {
  constructor(private repo: ItemsRepository) {}

  async list(params: { page: number; limit: number }) {
    const { data, hasNext } = await this.repo.list(params)
    return {
      data,
      pagination: {
        page: params.page,
        limit: params.limit,
        hasNext,
        hasPrev: params.page > 1
      }
    }
  }

  async getById(id: string): Promise<Item> {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundError(`Item ${id} not found`)
    return item
  }

  async create(input: ItemCreateInput, actor: string): Promise<Item> {
    return this.repo.create(input, actor)
  }

  async update(
    id: string,
    input: ItemUpdateInput,
    actor: string
  ): Promise<Item> {
    const updated = await this.repo.update(id, input, actor)
    if (!updated) throw new NotFoundError(`Item ${id} not found`)
    return updated
  }
}
