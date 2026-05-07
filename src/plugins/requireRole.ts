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
      // `request.identity` (populated by the authenticate plugin) holds the
      // full identity-service /auth/me payload — `identity.user` plus
      // `identity.orgs[].products[].brandAccess[]` describing the user's
      // organisation, product, and per-resource role tree.
      //
      // Implement your service's role check against that shape:
      //   - Build a ROLE_RANK map for ordinal comparisons.
      //   - Short-circuit for `identity.user.isSuperAdmin` or `org_admin` orgs.
      //   - Look up the resource id from `request.params` and find the
      //     matching brandAccess entry.
      //   - Throw `ForbiddenError` with a specific message on failure.
      void ForbiddenError
    }
  })
}

export default fp(requireRolePlugin, {
  name: 'requireRole',
  dependencies: ['authenticate'],
})
