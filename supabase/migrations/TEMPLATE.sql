-- First-migration template. Copy and replace <schema> and <table>.
-- See CLAUDE.md Rule 10 for when this applies.

CREATE SCHEMA IF NOT EXISTS <schema>;
GRANT USAGE ON SCHEMA <schema> TO anon, authenticated, service_role;
GRANT ALL    ON ALL TABLES    IN SCHEMA <schema> TO service_role;
GRANT ALL    ON ALL SEQUENCES IN SCHEMA <schema> TO service_role;
GRANT ALL    ON ALL FUNCTIONS IN SCHEMA <schema> TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES    IN SCHEMA <schema> TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA <schema> GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA <schema> GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA <schema> GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA <schema> GRANT SELECT ON TABLES  TO authenticated, anon;

CREATE OR REPLACE FUNCTION <schema>.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Per table:
CREATE TRIGGER set_<table>_updated_at
    BEFORE UPDATE ON <schema>.<table>
    FOR EACH ROW EXECUTE FUNCTION <schema>.set_updated_at();
