// Three Supabase clients, decorated onto the Fastify instance:
//   - fastify.supabase        anon key, RLS-enforced reads
//   - fastify.supabaseAdmin   service role, bypasses RLS — use for writes
//   - fastify.supabaseAsUser  per-request anon client + user JWT (RLS-scoped reads)
// Never call createClient() inside a service or repository — pull from
// the Fastify instance.
import fp from 'fastify-plugin'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from '../config/appConfig'
import { ServiceUnavailableError } from '../utils/errors'

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient
    supabaseAdmin: SupabaseClient
    supabaseAsUser: (jwt: string) => SupabaseClient
  }
}

function createUnconfiguredStub(): SupabaseClient {
  const fail = () => {
    throw new ServiceUnavailableError(
      'Supabase is not configured. Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in your .env file.'
    )
  }
  return {
    from: fail,
    rpc: fail,
    auth: new Proxy({}, { get: () => fail }),
    storage: new Proxy({}, { get: () => fail }),
    functions: new Proxy({}, { get: () => fail }),
    realtime: new Proxy({}, { get: () => fail }),
    schema: fail,
  } as unknown as SupabaseClient
}

export default fp(
  async (fastify) => {
    const isProd = process.env.NODE_ENV === 'production'
    const missingUrl = !process.env.SUPABASE_URL && !config.SUPABASE_URL
    const missingAnon = !process.env.SUPABASE_ANON_KEY && !config.SUPABASE_ANON_KEY
    const missingServiceRole = !process.env.SUPABASE_SERVICE_ROLE_KEY && !config.SUPABASE_SERVICE_ROLE_KEY

    if (!isProd && (missingUrl || missingAnon || missingServiceRole)) {
      fastify.log.warn(
        'Supabase env vars not fully set — server will boot, but Supabase-backed routes will return 503 until configured.'
      )
      const stub = createUnconfiguredStub()
      fastify.decorate('supabase', stub)
      fastify.decorate('supabaseAdmin', stub)
      fastify.decorate('supabaseAsUser', () => stub)
      return
    }

    const supabase = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_ANON_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: config.DB_SCHEMA }
      }
    ) as SupabaseClient

    const supabaseAdmin = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: config.DB_SCHEMA }
      }
    ) as SupabaseClient

    const supabaseAsUser = (jwt: string): SupabaseClient =>
      createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: config.DB_SCHEMA },
        global: { headers: { Authorization: `Bearer ${jwt}` } }
      }) as SupabaseClient

    fastify.decorate('supabase', supabase)
    fastify.decorate('supabaseAdmin', supabaseAdmin)
    fastify.decorate('supabaseAsUser', supabaseAsUser)
  },
  { name: 'supabase' }
)
