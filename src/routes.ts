import { FastifyInstance } from 'fastify'
import { rootRoutes } from './api/index'
import { healthRoutes } from './api/health/health.routes'
import { itemsRoutes } from './api/items/items.routes'

export async function registerRoutes(server: FastifyInstance) {
  await server.register(rootRoutes)
  await server.register(healthRoutes, { prefix: '/health' })
  await server.register(itemsRoutes, { prefix: '/v1/items' })
}
