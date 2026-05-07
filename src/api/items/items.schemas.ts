import { Type, Static } from '@sinclair/typebox'

const ItemStatusSchema = Type.Union([
  Type.Literal('active'),
  Type.Literal('archived')
])

export const ItemSchema = Type.Object(
  {
    id: Type.String({ format: 'uuid' }),
    name: Type.String(),
    description: Type.Union([Type.String(), Type.Null()]),
    status: ItemStatusSchema,
    created_at: Type.String({ format: 'date-time' }),
    updated_at: Type.String({ format: 'date-time' }),
    created_by: Type.Union([Type.String(), Type.Null()]),
    last_updated_by: Type.Union([Type.String(), Type.Null()])
  },
  { $id: 'Item', additionalProperties: false }
)
export type ItemResponse = Static<typeof ItemSchema>

export const ItemParamsSchema = Type.Object(
  { id: Type.String({ format: 'uuid' }) },
  { $id: 'ItemIdParams' }
)
export type ItemParams = Static<typeof ItemParamsSchema>

export const ListItemsQuerySchema = Type.Object(
  {
    page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 }))
  },
  { $id: 'ItemListQuery', additionalProperties: false }
)
export type ListItemsQuery = Static<typeof ListItemsQuerySchema>

export const ListItemsResponseSchema = Type.Object(
  {
    data: Type.Array(ItemSchema),
    pagination: Type.Object({
      page: Type.Integer(),
      limit: Type.Integer(),
      hasNext: Type.Boolean(),
      hasPrev: Type.Boolean()
    })
  },
  { $id: 'ItemList' }
)
export type ListItemsResponse = Static<typeof ListItemsResponseSchema>

export const CreateItemBodySchema = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    description: Type.Optional(Type.String())
  },
  { $id: 'ItemCreateRequest', additionalProperties: false }
)
export type CreateItemBody = Static<typeof CreateItemBodySchema>

export const UpdateItemBodySchema = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1 })),
    description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    status: Type.Optional(ItemStatusSchema)
  },
  { $id: 'ItemUpdateRequest', additionalProperties: false }
)
export type UpdateItemBody = Static<typeof UpdateItemBodySchema>
