import fastify, { FastifyServerOptions } from 'fastify'
import fp from 'fastify-plugin'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { SupabaseClient } from '@supabase/supabase-js'
import errorHandler from './plugins/errorHandler'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import { swaggerOptions, swaggerUIOptions } from './plugins/swagger'
import supabasePlugin from './plugins/supabase'
import identityPlugin from './plugins/identity'
import authenticatePlugin from './plugins/authenticate'
import requireRolePlugin from './plugins/requireRole'
import { registerRoutes } from './routes'
import { IdentityClient } from './services/identity'

export interface BuildAppOptions {
  logger?: FastifyServerOptions['logger']
  supabase?: SupabaseClient
  supabaseAdmin?: SupabaseClient
  identity?: IdentityClient
}

export async function buildApp(opts: BuildAppOptions = {}) {
  const app = fastify({
    logger: opts.logger ?? {
      level: process.env.LOG_LEVEL || 'info',
      redact: ['req.headers.authorization']
    },
    ajv: {
      customOptions: {
        removeAdditional: false,
        allErrors: true
      }
    }
  }).withTypeProvider<TypeBoxTypeProvider>()

  // Plugin order is load-bearing — see CLAUDE.md.
  // 1. errorHandler FIRST (also registers ErrorResponse schema).
  await app.register(errorHandler)

  // 2. swagger.
  await app.register(swagger, swaggerOptions)

  // 3. variant-specific plugins.
  if (opts.supabase) {
    const supabaseOverride = opts.supabase
    const adminOverride = opts.supabaseAdmin ?? opts.supabase
    await app.register(
      fp(async (f) => {
        f.decorate('supabase', supabaseOverride)
        f.decorate('supabaseAdmin', adminOverride)
        f.decorate('supabaseAsUser', () => supabaseOverride)
      }, { name: 'supabase' })
    )
  } else {
    await app.register(supabasePlugin)
  }

  if (opts.identity) {
    const identityOverride = opts.identity
    await app.register(
      fp(async (f) => {
        f.decorate('identity', identityOverride)
      }, { name: 'identity' })
    )
  } else {
    await app.register(identityPlugin)
  }

  await app.register(authenticatePlugin)
  await app.register(requireRolePlugin)

  // 4. routes.
  await registerRoutes(app)

  // 5. swaggerUI LAST.
  await app.register(swaggerUI, swaggerUIOptions)

  return app
}
