import { vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildApp } from '../../src/app'
import type { IdentityClient, IdentityMe } from '../../src/services/identity'

export function makeAuthSupabase(overrides: Partial<SupabaseClient> = {}): SupabaseClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null })
    },
    from: vi.fn(),
    ...overrides,
  } as unknown as SupabaseClient
}

const fakeIdentityMe: IdentityMe = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: null,
    lastName: null,
    status: 'active',
    forcePasswordChange: false,
    isSuperAdmin: false,
    createdAt: new Date(0).toISOString(),
  },
  orgs: [],
}

export function makeIdentityMock(overrides: Partial<IdentityClient> = {}): IdentityClient {
  return {
    getMe: vi.fn().mockResolvedValue(fakeIdentityMe),
    ...overrides,
  } as unknown as IdentityClient
}

export function buildTestApp(options: {
  supabase?: SupabaseClient
  supabaseAdmin?: SupabaseClient
  identity?: IdentityClient
} = {}) {
  const defaultSupabase = makeAuthSupabase()
  return buildApp({
    logger: false,
    supabase: options.supabase ?? defaultSupabase,
    supabaseAdmin: options.supabaseAdmin ?? defaultSupabase,
    identity: options.identity ?? makeIdentityMock(),
  })
}
