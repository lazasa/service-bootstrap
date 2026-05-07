import 'dotenv/config'
import fastify from 'fastify'
import errorHandler from './plugins/errorHandler'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import { swaggerOptions, swaggerUIOptions } from './plugins/swagger'
import supabasePlugin from './plugins/supabase'
import authenticatePlugin from './plugins/authenticate'
import requireRolePlugin from './plugins/requireRole'
import { registerRoutes } from './routes'

const server = fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    redact: ['req.headers.authorization']
  },
  ajv: {
    customOptions: {
      removeAdditional: false,
      allErrors: true
    }
  }
})

const start = async () => {
  try {
    // Plugin order is load-bearing — see CLAUDE.md.
    // 1. errorHandler FIRST.
    await server.register(errorHandler)

    // 2. swagger.
    await server.register(swagger, swaggerOptions)

    // 3. variant-specific plugins.
    await server.register(supabasePlugin)
    await server.register(authenticatePlugin)
    await server.register(requireRolePlugin)
    // Add upstream-client plugins here (e.g. identityPlugin) if your
    // service calls another service.

    // 4. routes.
    await registerRoutes(server)

    // 5. swaggerUI LAST.
    await server.register(swaggerUI, swaggerUIOptions)

    const port = Number(process.env.PORT) || 3000
    const host = process.env.HOST || '0.0.0.0'

    await server.listen({ port, host })
  } catch (err) {
    server.log.error(err)
    await server.close()
    process.exit(1)
  }
}

const gracefulShutdown = async (signal: string) => {
  server.log.info(`${signal} received, shutting down gracefully...`)
  try {
    await server.close()
    process.exit(0)
  } catch (err) {
    server.log.error(err, 'Error during shutdown')
    process.exit(1)
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('unhandledRejection', (err: unknown) => {
  server.log.error(err, 'Unhandled rejection')
  process.exit(1)
})

start().catch((err: unknown) => {
  console.error('Fatal error during startup:', err)
  process.exit(1)
})
