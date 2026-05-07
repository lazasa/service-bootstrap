// TODO: replace title/description for your service.
export const swaggerOptions = {
  openapi: {
    openapi: '3.1.0',
    info: {
      title: 'Service Bootstrap API',
      description:
        'Bootstrap template — replace with your service description.',
      version: '1.0.0'
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description:
          process.env.NODE_ENV === 'production' ? 'Production' : 'Development'
      }
    ],
    tags: [{ name: 'Items', description: 'Example items resource' }],
    security: [{ BearerAuth: [] }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http' as const,
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Supabase access token. Pass as: Authorization: Bearer <token>'
        }
      },
      schemas: {
        Error: {
          type: 'object' as const,
          properties: {
            error: {
              type: 'object' as const,
              properties: {
                code: { type: 'string' as const },
                message: { type: 'string' as const },
                status: { type: 'number' as const }
              }
            }
          }
        }
      }
    }
  }
}

export const swaggerUIOptions = {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'none' as const,
    deepLinking: true,
    displayRequestDuration: true
  },
  theme: {
    title: 'Service Bootstrap API Documentation',
    css: [
      {
        filename: 'theme.css',
        content: '.topbar { display: none !important; }'
      }
    ]
  }
}
