import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, it, expect, vi } from 'vitest'
import { buildTestApp, makeAuthSupabase } from '../helpers/build-test-app'

const sampleRow = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Test item',
  description: null,
  status: 'active',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  created_by: 'test-user-id',
  last_updated_by: 'test-user-id',
}

const AUTH_HEADER = { authorization: 'Bearer test-token' }

function asAdmin(builder: object): SupabaseClient {
  return makeAuthSupabase({
    schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(builder) })
  })
}

describe('GET /v1/items', () => {
  it('returns 200 with paginated items', async () => {
    const admin = asAdmin({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [sampleRow], error: null }),
    })

    const app = await buildTestApp({ supabaseAdmin: admin })
    try {
      const res = await app.inject({ method: 'GET', url: '/v1/items', headers: AUTH_HEADER })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].id).toBe(sampleRow.id)
      expect(body.pagination).toMatchObject({ page: 1, limit: 20 })
    } finally {
      await app.close()
    }
  })

  it('returns 400 VALIDATION_ERROR for invalid limit', async () => {
    const app = await buildTestApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/items?limit=999',
        headers: AUTH_HEADER
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error.code).toBe('VALIDATION_ERROR')
    } finally {
      await app.close()
    }
  })

  it('returns 401 when no Authorization header', async () => {
    const app = await buildTestApp()
    try {
      const res = await app.inject({ method: 'GET', url: '/v1/items' })
      expect(res.statusCode).toBe(401)
    } finally {
      await app.close()
    }
  })
})

describe('GET /v1/items/:id', () => {
  it('returns 404 in the standard error envelope when not found', async () => {
    const admin = asAdmin({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
    })

    const app = await buildTestApp({ supabaseAdmin: admin })
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/items/00000000-0000-0000-0000-000000000099',
        headers: AUTH_HEADER
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().error.code).toBe('NOT_FOUND')
    } finally {
      await app.close()
    }
  })

  it('returns 200 with the item when found', async () => {
    const admin = asAdmin({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: sampleRow, error: null }),
    })

    const app = await buildTestApp({ supabaseAdmin: admin })
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/items/${sampleRow.id}`,
        headers: AUTH_HEADER
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().id).toBe(sampleRow.id)
    } finally {
      await app.close()
    }
  })
})

describe('POST /v1/items', () => {
  it('returns 201 with the created item', async () => {
    const admin = asAdmin({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: sampleRow, error: null }),
    })

    const app = await buildTestApp({ supabaseAdmin: admin })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/items',
        headers: AUTH_HEADER,
        payload: { name: 'Test item' }
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().id).toBe(sampleRow.id)
    } finally {
      await app.close()
    }
  })

  it('returns 400 VALIDATION_ERROR when name is missing', async () => {
    const app = await buildTestApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/items',
        headers: AUTH_HEADER,
        payload: {}
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error.code).toBe('VALIDATION_ERROR')
    } finally {
      await app.close()
    }
  })
})
