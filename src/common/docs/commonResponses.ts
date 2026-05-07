import { ErrorResponseSchema } from '../../utils/errors'

export const commonErrorResponses = {
  400: ErrorResponseSchema,
  401: ErrorResponseSchema,
  403: ErrorResponseSchema,
  404: ErrorResponseSchema,
  409: ErrorResponseSchema,
  500: ErrorResponseSchema,
  503: ErrorResponseSchema,
  504: ErrorResponseSchema
}
