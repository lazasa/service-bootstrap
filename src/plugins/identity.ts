import fp from 'fastify-plugin'
import { config } from '../config/appConfig'
import { IdentityClient } from '../services/identity'

declare module 'fastify' {
  interface FastifyInstance {
    identity: IdentityClient
  }
}

export default fp(async (fastify) => {
  if (!config.IDENTITY_SERVICE_URL) {
    throw new Error('IDENTITY_SERVICE_URL is required')
  }
  fastify.decorate(
    'identity',
    new IdentityClient(config.IDENTITY_SERVICE_URL, config.IDENTITY_SERVICE_TIMEOUT),
  )
}, { name: 'identity' })
