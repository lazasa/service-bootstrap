# 2. Postgres `updated_at` trigger

Date: 2026-05-08

## Status

Accepted

## Context

Every domain table carries an `updated_at` column. Initially it was the application's responsibility to write this value on every update. That approach has two failure modes:

1. **Concurrent writes**: two service instances updating the same row in the same millisecond can both read `NOW()` before either write commits, so whichever wins overwrites with a stale timestamp.
2. **Direct SQL writes**: a migration, a one-off fix, or a Supabase dashboard edit bypasses the application entirely and leaves `updated_at` frozen at the insert time.

The identity-service migration already established a pattern that avoids both: a single `set_updated_at()` function in the service schema, attached as a `BEFORE UPDATE` trigger on every table. The bootstrap should match so every new service inherits the same contract.

## Decision

Each service schema defines one trigger function:

```sql
CREATE OR REPLACE FUNCTION <schema>.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Every domain table gets one `BEFORE UPDATE FOR EACH ROW` trigger:

```sql
CREATE TRIGGER set_<table>_updated_at
    BEFORE UPDATE ON <schema>.<table>
    FOR EACH ROW EXECUTE FUNCTION <schema>.set_updated_at();
```

Application code (repositories, services) **never writes `updated_at`**. The DB owns it.

## Consequences

- Repositories lose one column from their update payloads — simpler call sites.
- Direct SQL writes, migrations, and Supabase dashboard edits refresh `updated_at` correctly.
- New tables must add the trigger (called out in CLAUDE.md Rule 11 and the "Adding a new resource" recipe).
- The trigger function must be created before any table that references it within the same migration.

## Alternatives considered

- **Application-set timestamp** (previous approach) — race conditions under concurrent writes; breaks on direct SQL.
- **`moddatetime` extension** — same semantics, but requires `CREATE EXTENSION moddatetime` which is not enabled by default in Supabase.
- **`public.set_updated_at()` shared across schemas** — less duplication if many services share one Postgres instance, but couples schemas and diverges from the identity-service pattern. Rejected in favour of per-service self-containment.
