import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { itemsDocs } from './items.docs'
import {
  ItemSchema,
  ItemParamsSchema,
  ListItemsQuerySchema,
  ListItemsResponseSchema,
  CreateItemBodySchema,
  UpdateItemBodySchema
} from './items.schemas'
import { ItemsRepository } from './items.repository'
import { ItemsService } from './items.service'
import { config } from '../../config/appConfig'

export const itemsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.addSchema(ItemSchema)
  fastify.addSchema(ItemParamsSchema)
  fastify.addSchema(ListItemsQuerySchema)
  fastify.addSchema(ListItemsResponseSchema)
  fastify.addSchema(CreateItemBodySchema)
  fastify.addSchema(UpdateItemBodySchema)

  // Construct the repo+service per-route using the admin client so writes
  // bypass RLS. For reads where RLS should apply, build a per-request
  // service using fastify.supabaseAsUser(request.accessToken!) inside the
  // handler (see CLAUDE.md for the RLS guidance).
  const repo = new ItemsRepository(fastify.supabaseAdmin, config.DB_SCHEMA)
  const service = new ItemsService(repo)

  fastify.get('/', {
    schema: itemsDocs.listItems,
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      const page = request.query.page ?? 1
      const limit = request.query.limit ?? 20
      const result = await service.list({ page, limit })
      return reply.status(200).send(result)
    }
  })

  fastify.post('/', {
    schema: itemsDocs.createItem,
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      const actor = request.user?.id ?? 'api'
      const item = await service.create(
        { name: request.body.name, description: request.body.description ?? null },
        actor
      )
      return reply.status(201).send(item)
    }
  })

  fastify.get('/:id', {
    schema: itemsDocs.getItem,
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      const item = await service.getById(request.params.id)
      return reply.status(200).send(item)
    }
  })

  fastify.patch('/:id', {
    schema: itemsDocs.updateItem,
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      const actor = request.user?.id ?? 'api'
      const item = await service.update(request.params.id, request.body, actor)
      return reply.status(200).send(item)
    }
  })
}
