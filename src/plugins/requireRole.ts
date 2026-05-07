// Role-gating preHandler factory. The shipped implementation is a stub
// that lets every authenticated user through — replace the body with
// your service's role check (typically a call to identity-service or a
// claim lookup on request.user).
import fp from 'fastify-plugin'
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { ForbiddenError, UnauthorizedError } from '../utils/errors'

declare module 'fastify' {
  interface FastifyInstance {
    requireRole: (
      role: string
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

const requireRolePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('requireRole', (_role: string) => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      if (!request.user) {
        throw new UnauthorizedError()
      }
      // TODO: implement your service's role check here.
      // Example: call identity-service /v1/auth/me, inspect the
      // returned org/brand role tree, throw ForbiddenError if the
      // user does not meet `_role`.
      void ForbiddenError
    }
  })
}

export default fp(requireRolePlugin, {
  name: 'requireRole',
  dependencies: ['authenticate']
})
