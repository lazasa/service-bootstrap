import { describe, it, expect, vi } from 'vitest'
import { ItemsService } from '../../src/api/items/items.service'
import type { ItemsRepository } from '../../src/api/items/items.repository'
import type { Item } from '../../src/api/items/items.types'

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Example item',
  description: null,
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  created_by: 'user-1',
  last_updated_by: 'user-1',
  ...overrides
})

function makeRepo(overrides: Partial<ItemsRepository> = {}): ItemsRepository {
  return {
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    ...overrides,
  } as unknown as ItemsRepository
}

describe('ItemsService.getById', () => {
  it('returns the item when found', async () => {
    const item = makeItem()
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(item) })
    const service = new ItemsService(repo)
    await expect(service.getById(item.id)).resolves.toBe(item)
  })

  it('throws NOT_FOUND when missing', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) })
    const service = new ItemsService(repo)
    await expect(service.getById('00000000-0000-0000-0000-000000000099')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
  })
})

describe('ItemsService.update', () => {
  it('throws NOT_FOUND when the row does not exist', async () => {
    const repo = makeRepo({ update: vi.fn().mockResolvedValue(null) })
    const service = new ItemsService(repo)
    await expect(
      service.update('00000000-0000-0000-0000-000000000099', { name: 'x' }, 'user-1')
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('returns updated item when found', async () => {
    const item = makeItem({ name: 'Updated' })
    const repo = makeRepo({ update: vi.fn().mockResolvedValue(item) })
    const service = new ItemsService(repo)
    await expect(service.update(item.id, { name: 'Updated' }, 'user-1')).resolves.toBe(item)
  })
})
