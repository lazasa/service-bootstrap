// Generic Supabase-backed CRUD with humps camelCase conversion.
// IMPORTANT: do NOT extend this for tables that store JSONB content —
// humps will recursively transform the JSONB keys and corrupt them.
// In that case, write a standalone repository (see CLAUDE.md).
import { SupabaseClient } from '@supabase/supabase-js'
import humps from 'humps'

export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export abstract class BaseRepository<T> {
  protected tableName: string
  protected supabase: SupabaseClient
  protected schema: string

  constructor(tableName: string, supabase: SupabaseClient, schema: string) {
    this.tableName = tableName
    this.supabase = supabase
    this.schema = schema
  }

  async findAll(params: PaginationParams = {}): Promise<PaginatedResponse<T>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = params

    const from = (page - 1) * limit
    const to = from + limit // fetch one extra to detect hasNext

    const { data, error } = await this.supabase
      .schema(this.schema)
      .from(this.tableName)
      .select('*')
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(from, to)

    if (error) throw error

    const hasNext = data.length > limit
    const items = hasNext ? data.slice(0, -1) : data

    return {
      data: items.map((item) => humps.camelizeKeys(item)) as T[],
      pagination: { page, limit, hasNext, hasPrev: page > 1 }
    }
  }

  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.supabase
      .schema(this.schema)
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return humps.camelizeKeys(data) as T
  }

  async create(payload: Partial<T>): Promise<T> {
    const snakeCaseInput = humps.decamelizeKeys(payload)
    const { data, error } = await this.supabase
      .schema(this.schema)
      .from(this.tableName)
      .insert(snakeCaseInput)
      .select()
      .single()

    if (error) throw error
    return humps.camelizeKeys(data) as T
  }

  async update(id: string, payload: Partial<T>): Promise<T | null> {
    const snakeCaseInput = humps.decamelizeKeys(payload)
    const { data, error } = await this.supabase
      .schema(this.schema)
      .from(this.tableName)
      .update(snakeCaseInput)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return humps.camelizeKeys(data) as T
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .schema(this.schema)
      .from(this.tableName)
      .delete()
      .eq('id', id)

    if (error) throw error
    return true
  }
}
