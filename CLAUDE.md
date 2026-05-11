# CLAUDE.md — Service Bootstrap

This file tells Claude Code (and humans) how to work in this repository.

## What this is

A **domain service** (Fastify + TypeScript + Supabase). Owns its domain database and exposes HTTP endpoints to BFFs and other services. **Not a BFF** — it talks to the DB; BFFs must not.

## Stack

- Node 22 LTS, TypeScript 6
- Fastify 5 + `@fastify/type-provider-typebox` (end-to-end type inference from schemas)
- `@sinclair/typebox` for schemas, AJV for validation
- `@supabase/supabase-js`
- `@fastify/swagger` + `@fastify/swagger-ui`
- pnpm, vitest

## Commands

```bash
pnpm dev          # tsx watch
pnpm build        # tsc -p tsconfig.build.json
pnpm start        # node --env-file=.env dist/index.js
pnpm test         # vitest (watch mode)
pnpm test:run     # vitest run (single run, use in CI)
pnpm typecheck    # tsc --noEmit (checks src + tests)
```

## Layout

See [docs/architecture.md](docs/architecture.md) for the directory layout.

## Core rules

### 1. Plugin order is load-bearing

In `src/app.ts`:

1. `errorHandler` **first**.
2. `swagger`.
3. `supabase` → `identity` → `authenticate` → `requireRole` (and any
   additional upstream-client plugin you add).
4. `registerRoutes(app)`.
5. `swaggerUI` **last**.

Don't reorder. `authenticate` depends on `identity`; `requireRole`
depends on `authenticate`. The plugin definitions enforce that with
`fastify-plugin`'s `dependencies`.

### 2. Errors

- Every thrown error extends `AppError` from `src/utils/errors.ts`.
- Response shape is always `{ error: { code, message, status, details? } }`.
- **Never reformat in handlers.** Throw and let `errorHandler` serialise.
- Repositories throw the raw Supabase error; the service layer wraps it
  in a domain error (`NotFoundError`, `ConflictError`, etc.) when the
  semantics matter.

### 3. Validation

- AJV is configured with `removeAdditional: false`. Unknown fields → 400.
- Every body / query / params schema sets `additionalProperties: false`.
- Pull `Static<>` types from the schemas — don't hand-write them.
- Every parameter property (path / query / header) carries `example`, `default`, or `enum` so the generated spec exposes a concrete sample value.
- Every request-body schema carries a top-level `example` on the outer `Type.Object` options matching its required fields.
- Prefer `Type.String({ enum: [...] })` (or `Type.Enum(...)`) over `Type.Union([Type.Literal(...), ...])`. The former serialises as `enum`; the latter as `anyOf`, which most spec consumers can't expand.

### 4. Resource pattern

Every resource lives in `src/api/<resource>/`:

- `<resource>.routes.ts` — `async (fastify) => {}`. Spread docs into `schema:`. Use `preHandler: [fastify.authenticate]`; layer `fastify.requireRole(...)` for role gates.
- `<resource>.schemas.ts` — TypeBox schemas + `Static<>` types.
- `<resource>.docs.ts` — one entry per operation; spread `commonErrorResponses` into `response`.
- `<resource>.types.ts` — TS interfaces matching the DB shape.
- `<resource>.service.ts` — business logic; depends on the repository, never Supabase directly.
- `<resource>.repository.ts` — Supabase queries, owns the table.
- Tests: `tests/services/<resource>.service.test.ts` and `tests/routes/<resource>.test.ts`.

### 5. Three Supabase clients, injected via plugin

`src/plugins/supabase.ts` decorates:

- `fastify.supabase` — anon key, RLS-enforced reads.
- `fastify.supabaseAdmin` — service role, bypasses RLS, used for writes.
- `fastify.supabaseAsUser(jwt)` — anon + user JWT, RLS-scoped reads.

**Never call `createClient()` inside a service or repository.** Always
pull from the Fastify instance. If a repository needs the user's
client, the route constructs it via `fastify.supabaseAsUser(token)` and
passes it into a per-request repository instance.

### 6. RLS is the defence in depth

When RLS allows the read, prefer `supabaseAsUser(jwt)` over
`supabaseAdmin`. Don't "leave on admin" for sensitive tables. The
guidance is: writes use admin (RLS doesn't have to model write rules);
reads use the per-user client whenever RLS can express the visibility
rule.

### 7. Repositories are per-domain

Each resource folder owns one repository. Cross-table queries live on
the **initiating** resource's repository — never on a sibling repo.
If `<resource-a>.service.ts` needs to read from `<resource-b>`, that
read goes on `<resource-a>.repository.ts`, not on `<resource-b>.repository.ts`.

### 8. Client-facing APIs prefer camelCase

API responses/request bodies use camelCase; DB columns stay snake_case (Rule 11). Translation happens in the repository layer. Two helpers in `src/common/base/`:

- `BaseRepository` — generic Supabase CRUD with `humps`. **Unsafe for JSONB columns** (humps recurses in and corrupts keys).
- `KeyTransformer` — camelizes/decamelizes while treating declared keys as opaque (JSONB-safe). Use instead of `BaseRepository` when any column is JSONB.

### 9. Cross-service calls are HTTP only

If this service needs to call another service, add **one** HTTP client
file at `src/services/<upstream>.ts` and a plugin at
`src/plugins/<upstream>.ts`. One client per upstream — never a
per-domain wrapper around the same upstream.

No DB-to-DB coupling, no shared Postgres schemas, no event bus.

### 10. Migration discipline

- The **first migration** must create the schema, set role grants, and define `set_updated_at()`. No `REVOKE` — if grants need changing before prod, edit and reapply against a clean DB. See [`supabase/migrations/TEMPLATE.sql`](supabase/migrations/TEMPLATE.sql) for the skeleton.
- Once applied to prod, fix-forward with patch migrations — never edit the historical file.
- Prefer editing the most recent unmerged migration over stacking fix files.

### 11. Schema convention

- DB columns are **snake_case**. JSONB content inside columns is stored and returned as-is — do not run through `humps`.
- Every domain table has exactly three metadata columns: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
- `updated_at` is DB-owned via a `BEFORE UPDATE` trigger `set_<table>_updated_at` → `<schema>.set_updated_at()`. **Never write `updated_at` from application code.**
- First-migration SQL skeleton (schema, grants, function, trigger): [`supabase/migrations/TEMPLATE.sql`](supabase/migrations/TEMPLATE.sql).
- No `created_by` / `updated_by` / `deleted_at` by default. Add explicitly if auditing is needed.
- Pure join tables use a composite `PRIMARY KEY` on FK columns (no surrogate `id`); still carry `created_at` and `updated_at`.

### 12. Health endpoint

`GET /health` returns `{ status: 'healthy' }`. Don't remove it — the
`Dockerfile` healthcheck calls it.

### 13. Errors must be descriptive and logged

Not consumer-facing — BFFs sanitise before forwarding — so error messages can and should be specific.

- **Throw with full context.** `throw new NotFoundError(\`<Resource> \${id} not found\`)`. Include identifiers, the operation, and the violated constraint. Schema/table/constraint names are fine. Generic messages like `"Bad Request"` are not acceptable.
- **Log before re-throwing only when you add information** the `errorHandler` can't see (Postgres error code, constraint name, row count): `request.log.warn({ pgCode: err.code, constraint: '<resource>_<column>_key' }, 'unique constraint violation on <schema>.<table>')`. Don't double-log.
- **Use `request.log`, not `console`.** It carries the request id; pino redacts `Authorization` headers.
- **Repositories surface, services translate.** Repositories propagate raw Supabase errors (`PGRST116`, `23505`, etc.). Services catch and re-throw as domain errors with readable messages.
- **Pick the right error class.** `BadRequestError`, `NotFoundError`, `ConflictError`, `UnauthorizedError`, `ForbiddenError`, `ServiceUnavailableError`, `GatewayTimeoutError`, `TokenExpiredError`, `TokenInvalidError`, `TokenRevokedError`, `UpstreamUnavailableError`. Don't reach for `AppError` directly.
- **Validation errors carry `details[]`.** If throwing `ValidationError` manually, populate `details` with `{ field, issue }`.

### 14. Authentication is delegated to identity-service

The `authenticate` plugin calls `fastify.identity.getMe(token)` (a `GET
/v1/auth/me` HTTP call) rather than verifying JWTs locally. On success it
decorates:

- `request.user` — `{ id, email }` extracted from the response.
- `request.identity` — the full identity-service payload, including
  `identity.orgs[].products[].brandAccess[]`. Use this in `requireRole` to
  check org/brand membership without a second network hop.
- `request.accessToken` — the raw Bearer token, forwarded on upstream calls.

The `identity` plugin (`src/plugins/identity.ts`) decorates `fastify.identity`
with an `IdentityClient` instance. It validates `IDENTITY_SERVICE_URL` at boot
— the server will not start without it. Configure the URL in `.env` and
`.env.example`.

### 15. OpenAPI docs are for service consumers (BFFs and other services)

Audience is internal backend engineers (BFFs + service-to-service). Be more descriptive than a BFF would be — a caller should be able to write the right HTTP call **without reading the source**.

- **Do explain:** business rules, preconditions, side effects, lifecycle constraints, role/JWT requirements, non-obvious error codes. Reference ADRs and data-model docs when an endpoint reflects a non-obvious decision.
- **Avoid:** secrets, real customer data, ephemeral migration notes, TODO rationale.

## Adding a new resource (recipe)

1. Create the six files under `src/api/<resource>/`. Give every TypeBox schema a
   resource-prefixed `$id` (e.g. `$id: 'BrandCreateRequest'`) and call
   `fastify.addSchema(...)` for each at the top of the route plugin.
2. Add a migration under `supabase/migrations/` for the new table, including a `set_<table>_updated_at` trigger that calls `<schema>.set_updated_at()` (see Rule 11). If `supabase/migrations/` is empty (fresh clone), this migration must also create the schema, grants, and the `set_updated_at()` function — see [`supabase/migrations/TEMPLATE.sql`](supabase/migrations/TEMPLATE.sql).
3. Register the routes at their prefix in `src/routes.ts`.
4. Add the resource's tag to `src/plugins/swagger.ts`.
5. Write tests: `tests/services/<resource>.service.test.ts` (unit, mocked repo)
   and `tests/routes/<resource>.test.ts` (integration, chained Supabase mock via
   `buildTestApp`). See `tests/helpers/build-test-app.ts`.

For the cross-service upstream recipe, see [docs/architecture.md](docs/architecture.md).
