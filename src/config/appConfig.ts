// Required env vars throw in production and warn in dev so local
// development still boots without a fully populated .env.
const isProd = process.env.NODE_ENV === 'production'

function required(name: string, fallback = ''): string {
  const value = process.env[name]
  if (value) return value
  if (isProd) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  if (!fallback) {
    console.warn(
      `[appConfig] ${name} is not set — using empty string for local dev`
    )
  }
  return fallback
}

export const config = {
  // Supabase — required.
  SUPABASE_URL: required('SUPABASE_URL', 'http://localhost:8000'),
  SUPABASE_ANON_KEY: required('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),

  // TODO: replace with your service's Postgres schema (e.g. orkha_brand_service).
  DB_SCHEMA: process.env.DB_SCHEMA || 'orkha_service_bootstrap',

  IDENTITY_SERVICE_URL: required('IDENTITY_SERVICE_URL', 'http://localhost:3001'),
  IDENTITY_SERVICE_TIMEOUT: Number(process.env.IDENTITY_SERVICE_TIMEOUT) || 30000
}
