import { commonErrorResponses } from '../../common/docs/commonResponses'
import {
  ItemSchema,
  ItemParamsSchema,
  ListItemsQuerySchema,
  ListItemsResponseSchema,
  CreateItemBodySchema,
  UpdateItemBodySchema
} from './items.schemas'

export const itemsDocs = {
  listItems: {
    summary: 'List items',
    description: 'Returns a paginated list of items.',
    tags: ['Items'],
    operationId: 'listItems',
    querystring: ListItemsQuerySchema,
    response: { 200: ListItemsResponseSchema, ...commonErrorResponses }
  },
  createItem: {
    summary: 'Create item',
    description: 'Create a new item.',
    tags: ['Items'],
    operationId: 'createItem',
    body: CreateItemBodySchema,
    response: { 201: ItemSchema, ...commonErrorResponses }
  },
  getItem: {
    summary: 'Get item',
    description: 'Returns a single item by ID.',
    tags: ['Items'],
    operationId: 'getItem',
    params: ItemParamsSchema,
    response: { 200: ItemSchema, ...commonErrorResponses }
  },
  updateItem: {
    summary: 'Update item',
    description: 'Patch one or more fields on an item.',
    tags: ['Items'],
    operationId: 'updateItem',
    params: ItemParamsSchema,
    body: UpdateItemBodySchema,
    response: { 200: ItemSchema, ...commonErrorResponses }
  }
}
