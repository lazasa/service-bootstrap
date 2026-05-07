import { config } from '../config/appConfig'
import {
  TokenExpiredError,
  TokenInvalidError,
  TokenRevokedError,
  UpstreamUnavailableError,
  ServiceUnavailableError,
  GatewayTimeoutError,
  AppError,
} from '../utils/errors'

export type IdentityOrgRole = 'org_admin' | 'org_member'
export type IdentityBrandRole = 'brand_admin' | 'brand_editor' | 'brand_viewer'

export interface IdentityMe {
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    status: string
    forcePasswordChange: boolean
    isSuperAdmin: boolean
    createdAt: string
  }
  orgs: Array<{
    orgId: string
    orgName: string
    orgStatus: string
    orgRole: IdentityOrgRole
    licenses: Array<Record<string, unknown>>
    products: Array<{
      productId: string
      productName: string
      brandAccess: Array<{ brandId: string; brandRole: IdentityBrandRole }>
    }>
  }>
}

export class IdentityClient {
  constructor(
    private baseUrl: string = config.IDENTITY_SERVICE_URL,
    private timeoutMs: number = config.IDENTITY_SERVICE_TIMEOUT,
  ) {}

  async getMe(token: string): Promise<IdentityMe> {
    return this.request<IdentityMe>('GET', '/v1/auth/me', token)
  }

  private async request<T>(method: 'GET' | 'POST', path: string, token: string, body?: unknown): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body !== undefined && { 'content-type': 'application/json' }),
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const text = await response.text()
      const json = text ? JSON.parse(text) : null

      if (response.ok) {
        return json as T
      }

      const code: string | undefined = json?.error?.code
      const message: string = json?.error?.message ?? `Identity service ${response.status}`

      if (response.status === 401) {
        if (code === 'TOKEN_EXPIRED') throw new TokenExpiredError()
        if (code === 'TOKEN_REVOKED') throw new TokenRevokedError()
        throw new TokenInvalidError()
      }

      if (response.status >= 500) {
        throw new UpstreamUnavailableError()
      }

      throw new AppError(response.status, code ?? 'BAD_REQUEST', message, json?.error?.details)
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof AppError) throw error

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new GatewayTimeoutError('Identity service request timeout')
        }
        if (error instanceof TypeError && error.message.includes('fetch failed')) {
          throw new ServiceUnavailableError('Identity service is unavailable')
        }
      }

      throw error
    }
  }
}
