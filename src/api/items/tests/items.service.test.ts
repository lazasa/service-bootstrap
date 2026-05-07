import t from 'tap'
import { ItemsService } from '../items.service'
import { Item } from '../items.types'

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

t.test('ItemsService.getById returns the item when found', async (t) => {
  const item = makeItem()
  const repo = {
    list: async () => ({ data: [], hasNext: false }),
    findById: async () => item,
    create: async () => item,
    update: async () => item
  }
  const service = new ItemsService(repo as any)
  const result = await service.getById(item.id)
  t.equal(result, item)
})

t.test('ItemsService.getById throws NotFoundError when missing', async (t) => {
  const repo = {
    list: async () => ({ data: [], hasNext: false }),
    findById: async () => null,
    create: async () => makeItem(),
    update: async () => null
  }
  const service = new ItemsService(repo as any)
  await t.rejects(
    service.getById('00000000-0000-0000-0000-000000000099'),
    { code: 'NOT_FOUND' }
  )
})

t.test('ItemsService.update throws NotFoundError when missing', async (t) => {
  const repo = {
    list: async () => ({ data: [], hasNext: false }),
    findById: async () => null,
    create: async () => makeItem(),
    update: async () => null
  }
  const service = new ItemsService(repo as any)
  await t.rejects(
    service.update(
      '00000000-0000-0000-0000-000000000099',
      { name: 'x' },
      'user-1'
    ),
    { code: 'NOT_FOUND' }
  )
})
