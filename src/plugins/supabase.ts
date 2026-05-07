// Three Supabase clients, decorated onto the Fastify instance:
//   - fastify.supabase        anon key, RLS-enforced reads
//   - fastify.supabaseAdmin   service role, bypasses RLS — use for writes
//   - fastify.supabaseAsUser  per-request anon client + user JWT (RLS-scoped reads)
// Never call createClient() inside a service or repository — pull from
// the Fastify instance.
import fp from 'fastify-plugin'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from '../config/appConfig'

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient
    supabaseAdmin: SupabaseClient
    supabaseAsUser: (jwt: string) => SupabaseClient
  }
}

export default fp(
  async (fastify) => {
    const supabase = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_ANON_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: config.DB_SCHEMA }
      }
    )

    const supabaseAdmin = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: config.DB_SCHEMA }
      }
    )

    const supabaseAsUser = (jwt: string): SupabaseClient =>
      createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: config.DB_SCHEMA },
        global: { headers: { Authorization: `Bearer ${jwt}` } }
      })

    fastify.decorate('supabase', supabase)
    fastify.decorate('supabaseAdmin', supabaseAdmin)
    fastify.decorate('supabaseAsUser', supabaseAsUser)
  },
  { name: 'supabase' }
)
