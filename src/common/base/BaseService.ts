import {
  BaseRepository,
  PaginationParams,
  PaginatedResponse
} from './BaseRepository'

export abstract class BaseService<T> {
  protected repository: BaseRepository<T>

  constructor(repository: BaseRepository<T>) {
    this.repository = repository
  }

  async getAll(params: PaginationParams = {}): Promise<PaginatedResponse<T>> {
    return this.repository.findAll(params)
  }

  async getById(id: string): Promise<T | null> {
    return this.repository.findById(id)
  }

  async create(payload: Partial<T>): Promise<T> {
    return this.repository.create(payload)
  }

  async update(id: string, payload: Partial<T>): Promise<T | null> {
    return this.repository.update(id, payload)
  }

  async delete(id: string): Promise<boolean> {
    return this.repository.delete(id)
  }
}
