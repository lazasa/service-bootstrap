export const commonErrorResponses = {
  400: { description: 'Bad Request', type: 'object' },
  401: { description: 'Unauthorized', type: 'object' },
  403: { description: 'Forbidden', type: 'object' },
  404: { description: 'Not Found', type: 'object' },
  409: { description: 'Conflict', type: 'object' },
  500: { description: 'Internal Server Error', type: 'object' },
  503: { description: 'Service Unavailable', type: 'object' },
  504: { description: 'Gateway Timeout', type: 'object' }
}
