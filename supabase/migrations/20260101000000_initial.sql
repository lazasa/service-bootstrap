-- Initial migration for the service-bootstrap example resource.
--
-- Conventions:
--   - All tables live in a non-public schema named after the service.
--   - Set grants correctly from the start. NEVER REVOKE in this file —
--     if grants need to change, edit this migration and re-apply against
--     a clean DB. Use REVOKE only in patch migrations on existing prod.
--   - Replace `orkha_service_bootstrap` with your service's schema (e.g.
--     orkha_brand_service, orkha_identity_service). It must match
--     `DB_SCHEMA` in `src/config/appConfig.ts`.

CREATE SCHEMA IF NOT EXISTS orkha_service_bootstrap;

-- ── ITEMS — example resource ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orkha_service_bootstrap.items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'archived')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      TEXT,
    last_updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_status ON orkha_service_bootstrap.items(status);

-- ── Grants ────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA orkha_service_bootstrap TO anon, authenticated, service_role;

-- Authenticated users get RLS-filtered SELECT/UPDATE; service_role does writes.
GRANT SELECT, UPDATE ON orkha_service_bootstrap.items TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA orkha_service_bootstrap TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA orkha_service_bootstrap TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA orkha_service_bootstrap TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA orkha_service_bootstrap
    GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA orkha_service_bootstrap
    GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA orkha_service_bootstrap
    GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- ── RLS — defence in depth ────────────────────────────────────────────────
-- Prefer anon + JWT (fastify.supabaseAsUser) for sensitive reads so RLS
-- enforces per-user visibility. Don't "leave on admin" for sensitive tables.
ALTER TABLE orkha_service_bootstrap.items ENABLE ROW LEVEL SECURITY;

-- Replace this policy with your real visibility rule (e.g. "user belongs
-- to the same org as the row"). The shipped policy is permissive so the
-- example boots; tighten it before shipping anything real.
CREATE POLICY items_select_authenticated ON orkha_service_bootstrap.items
    FOR SELECT TO authenticated USING (true);
