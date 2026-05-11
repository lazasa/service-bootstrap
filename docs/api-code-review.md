# API code review

**Score: 4.5 / 5** as a domain-service bootstrap.

> Helmet, CORS, and rate-limit are intentionally out of scope — they live at the upstream API gateway. Excluded from this review.

## What's good

### Architecture

- **Layered separation** — routes → service → repository, with TypeBox schemas as the contract surface. Each layer is testable in isolation.
- **Plugin-driven Fastify** — `fastify-plugin` hoists decorators correctly; plugin order is load-bearing and documented in CLAUDE.md. Three Supabase clients cover RLS-enforced reads, admin writes, and per-user-JWT scoped reads.
- **`buildApp()` factory** — `app.ts` builds the instance; `index.ts` handles process concerns only. Tests reuse the same factory with Supabase overrides so production wiring is what's under test.
- **Graceful shutdown** — `SIGINT`/`SIGTERM` with a re-entry guard and 10-second force-exit safety net.
- **Auth plugin** — delegates to identity-service via `IdentityClient` so each service has one place to change auth behaviour. `request.identity` carries the full org/product/brand tree for role gating without a second network hop.
- **Supabase stub** — In dev, missing env vars activate a stub client so `/`, `/health`, and `/docs` boot without a real Supabase connection.

### Contract

- **OpenAPI 3.1** generated from runtime TypeBox schemas — docs can't drift from the implementation.
- **Schema `$id`s registered via `addSchema`** — schemas appear in `components/schemas` and are referenced (not duplicated) across operations.
- **Single error envelope** (`{ error: { code, message, status, details? } }`) covering thrown errors, validation failures, 404s, and unhandled errors. Documented in [ADR-0001](decisions/0001-standard-error-response-format.md).
- **Rich `AppError` taxonomy** — 12 subclasses with stable codes (`NOT_FOUND`, `TOKEN_EXPIRED`, `UPSTREAM_UNAVAILABLE`, …). Callers branch on `code`, not message text.
- **AJV `removeAdditional: false`** — unknown fields return `400 VALIDATION_ERROR` rather than silently dropping.
- **Request redaction** — `req.headers.authorization` is redacted from pino logs.
- **Internal-facing OpenAPI prose** — `docs/api.md` and CLAUDE.md both describe the "verbose because audience is backend engineers" convention.

### Testing

- vitest + `fastify.inject()` covering three layers — unit (service + mocked repo), smoke (no DB), integration (chained Supabase mock). Documented in [test.md](test.md).

### Documentation

- ADRs started in `docs/decisions/`. CLAUDE.md is a full architectural contract. `docs/api.md` and `docs/test.md` are discoverable references.

## What needs reviewing

### Boot-time correctness

- **`appConfig.ts` uses `required()` not schema validation.** Missing vars warn in dev and throw in prod, but there's no type-level guarantee that the returned `config` object is correct (e.g. SUPABASE_URL could be a fallback empty string). A TypeBox env schema would fail immediately with a structured error listing every missing var.
- **No request-id / correlation-id.** `genReqId` or `@fastify/request-context` would make logs traceable across service hops. Valuable behind a gateway that already injects a trace header.

### Database

- **No translation of Supabase error codes.** A unique-violation (`23505`) currently propagates as a generic `500`. Map known Postgres codes to domain errors in the repository (e.g. `409 CONFLICT`).
- **No generated Supabase types.** Rows are cast via `as <Row>`. Run `supabase gen types typescript` and consume generated types so column drift surfaces at compile time.

**Resolved**

- ~~**`updated_at` is set in the repository.**~~ The bootstrap now mirrors the identity-service convention: a per-schema `set_updated_at()` function attached as a `BEFORE UPDATE` trigger (`set_<table>_updated_at`) on every table. Application code never writes `updated_at`. See [ADR-0002](decisions/0002-updated-at-trigger.md).

### Test coverage

- **Repository layer is untested.** Row error code translation (`PGRST116` → `null`) and any future unique-violation mapping are worth small unit tests.
- **No CI.** `pnpm typecheck` and `pnpm test:run` should run on every PR.

### Operational

- **Healthcheck is liveness only.** Once Supabase is in use, a readiness probe should fail when Supabase is unreachable so the gateway can route around a broken instance.
- **No dev-time log pretty-printing.** JSON is correct for production; `pino-pretty` in dev keeps the terminal readable.

## Suggested next ADRs

1. Plugin load order as a load-bearing contract
2. Authentication delegated to identity-service (rationale, error taxonomy, latency tradeoff)
3. Three-Supabase-clients + RLS-as-defence-in-depth
4. snake_case standalone repo vs BaseRepository + humps (two naming patterns)
5. Migration discipline (fix-forward, no `REVOKE` in initial migration)
6. Internal-facing OpenAPI prose policy
7. Supabase error code → API error code mapping table
