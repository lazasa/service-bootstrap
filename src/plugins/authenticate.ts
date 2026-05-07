import fp from 'fastify-plugin'
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { TokenInvalidError } from '../utils/errors'
import { IdentityMe } from '../services/identity'

export interface AuthenticatedUser {
  id: string
  email: string
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthenticatedUser | null
    identity: IdentityMe | null
    accessToken: string | null
  }
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>
  }
}

const authenticatePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('user', null)
  fastify.decorateRequest('identity', null)
  fastify.decorateRequest('accessToken', null)

  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const authHeader = request.headers.authorization
      const token =
        authHeader && /^bearer\s+/i.test(authHeader)
          ? authHeader.slice(authHeader.indexOf(' ') + 1).trim()
          : null

      if (!token) throw new TokenInvalidError()

      const me = await fastify.identity.getMe(token)
      request.user = { id: me.user.id, email: me.user.email }
      request.identity = me
      request.accessToken = token
    }
  )
}

export default fp(authenticatePlugin, {
  name: 'authenticate',
  dependencies: ['identity'],
})
