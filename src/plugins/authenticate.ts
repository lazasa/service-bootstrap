// fastify.authenticate preHandler — verifies a Bearer token via Supabase
// Auth and decorates request.user / request.accessToken.
import fp from 'fastify-plugin'
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { User } from '@supabase/supabase-js'
import {
  TokenExpiredError,
  TokenInvalidError,
  TokenRevokedError,
  UpstreamUnavailableError
} from '../utils/errors'

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null
    accessToken: string | null
  }
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>
  }
}

function classifyAuthError(error: {
  message?: string
  code?: string
  status?: number
}): never {
  const msg = error.message?.toLowerCase() ?? ''
  const status = error.status ?? 0

  if (status >= 500 || status === 0) {
    throw new UpstreamUnavailableError()
  }
  if (msg.includes('expired') || msg.includes('jwt expired')) {
    throw new TokenExpiredError()
  }
  if (
    error.code === 'user_not_found' ||
    msg.includes('session not found') ||
    msg.includes('revoked')
  ) {
    throw new TokenRevokedError()
  }
  throw new TokenInvalidError()
}

const authenticatePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('user', null)
  fastify.decorateRequest('accessToken', null)

  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers.authorization
      const token =
        authHeader && /^bearer\s+/i.test(authHeader)
          ? authHeader.slice(authHeader.indexOf(' ') + 1).trim()
          : null

      if (!token) {
        return reply.code(401).send({
          error: {
            code: 'INVALID_TOKEN',
            message: 'Missing session',
            status: 401
          }
        })
      }

      let user: User | null = null
      try {
        const { data, error } = await fastify.supabase.auth.getUser(token)
        if (error) classifyAuthError(error)
        user = data.user
      } catch (err) {
        if (err instanceof UpstreamUnavailableError) {
          return reply.code(503).send({
            error: { code: err.code, message: err.message, status: 503 }
          })
        }
        if (
          err instanceof TokenExpiredError ||
          err instanceof TokenInvalidError ||
          err instanceof TokenRevokedError
        ) {
          return reply.code(401).send({
            error: { code: (err as any).code, message: err.message, status: 401 }
          })
        }
        throw err
      }

      if (!user) {
        return reply.code(401).send({
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid session',
            status: 401
          }
        })
      }

      request.user = user
      request.accessToken = token
    }
  )
}

export default fp(authenticatePlugin, {
  name: 'authenticate',
  dependencies: ['supabase']
})
