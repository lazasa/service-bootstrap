# CLAUDE.md — Service Bootstrap

This file tells Claude Code (and humans) how to work in this repository.

## What this is

A **domain service** built on Fastify + TypeScript + Supabase. It owns
its domain database and exposes HTTP endpoints to BFFs and other
services. **It is NOT a BFF** — it does talk to the database; BFFs
should not.

## Stack

- Node 22 LTS, TypeScript 6
- Fastify 5
- `@sinclair/typebox` for schemas, AJV for validation
- `@supabase/supabase-js`
- `@fastify/swagger` + `@fastify/swagger-ui`
- pnpm, node-tap

## Commands

```bash
pnpm dev        # tsx watch
pnpm build      # tsc -p tsconfig.json
pnpm start      # node --env-file=.env dist/index.js
pnpm test       # tap --allow-incomplete-coverage
```

## Layout

```
src/
├── api/
│   ├── health/health.routes.ts
│   ├── <resource>/                # 7 files per resource
│   │   ├── <resource>.routes.ts
│   │   ├── <resource>.schemas.ts
│   │   ├── <resource>.docs.ts
│   │   ├── <resource>.types.ts
│   │   ├── <resource>.service.ts
│   │   ├── <resource>.repository.ts
│   │   └── tests/
│   │       ├── <resource>.service.test.ts
│   │       └── <resource>.routes.test.ts
│   └── index.ts                   # rootRoutes
├── common/
│   ├── base/
│   │   ├── BaseRepository.ts      # generic Supabase CRUD (humps)
│   │   └── BaseService.ts
│   └── docs/commonResponses.ts
├── config/appConfig.ts            # env load with required()
├── plugins/
│   ├── errorHandler.ts
│   ├── swagger.ts
│   ├── supabase.ts                # three clients
│   ├── authenticate.ts
│   └── requireRole.ts
├── services/                      # one HTTP client per upstream (optional)
├── utils/errors.ts
├── routes.ts
└── index.ts
supabase/
└── migrations/
```

## Core rules

### 1. Plugin order is load-bearing

In `src/index.ts`:

1. `errorHandler` **first**.
2. `swagger`.
3. `supabase` → `authenticate` → `requireRole` (and any upstream-client
   plugin you add).
4. `registerRoutes(server)`.
5. `swaggerUI` **last**.

Don't reorder. `authenticate` depends on `supabase`; `requireRole`
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

### 4. Resource pattern (7 files)

Every resource lives in `src/api/<resource>/` with:

- `<resource>.routes.ts` — plain `async (fastify) => {}`. Spread the
  docs entry into `schema:`. Use `preHandler: [fastify.authenticate]`
  on protected routes; layer `fastify.requireRole(...)` for role gates.
- `<resource>.schemas.ts` — TypeBox schemas + `Static<>` types.
- `<resource>.docs.ts` — one entry per operation; spread
  `commonErrorResponses` into `response`.
- `<resource>.types.ts` — TS interfaces matching the DB shape.
- `<resource>.service.ts` — business logic. Depends on the repository,
  never on Supabase directly.
- `<resource>.repository.ts` — Supabase queries. Owns the table.
- `tests/<resource>.service.test.ts` and
  `tests/<resource>.routes.test.ts`.

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
If `items.service.ts` needs to read from `orders`, the orders read goes
on `items.repository.ts`, not on `orders.repository.ts`.

### 8. Standalone vs `BaseRepository`

`BaseRepository` (in `src/common/base/`) wraps Supabase CRUD with
`humps` for camelCase conversion. Extend it **only** when the table has
no JSONB columns — humps will recursively transform JSONB keys and
corrupt them.

The shipped `items.repository.ts` is a **standalone** class (not
extending `BaseRepository`) and uses snake_case directly. That's the
default; reach for `BaseRepository` only when it clearly fits.

### 9. Cross-service calls are HTTP only

If this service needs to call another service, add **one** HTTP client
file at `src/services/<upstream>.ts` and a plugin at
`src/plugins/<upstream>.ts`. One client per upstream — never a
per-domain wrapper around the same upstream.

No DB-to-DB coupling, no shared Postgres schemas, no event bus.

### 10. Migration discipline

- Initial migration sets grants correctly. **No `REVOKE` in initial
  migrations.** If grants need adjusting before prod, edit this file
  and reapply from a clean DB.
- Once a migration is applied to prod, fix-forward with patch
  migrations — don't edit the historical file.
- Keep migrations clean: prefer editing the most recent unmerged
  migration over stacking fix files.

### 11. Schema convention

- DB columns are **snake_case**.
- TypeScript types and API schemas use snake_case to match
  (`created_at`, not `createdAt`) — it removes a translation layer.
- JSONB content **inside** columns is stored and returned as-is. Do not
  run JSONB through `humps`.

### 12. Health endpoint

`GET /health` returns `{ status: 'healthy' }`. Don't remove it — the
`Dockerfile` healthcheck calls it.

### 13. Errors must be descriptive and logged

Domain services are **not consumer-facing** — only other services and
BFFs call them, and the BFFs sanitise messages before forwarding to end
users. So error messages here can (and should) be specific.

- **Throw with full context.** `throw new NotFoundError()` is too thin.
  Prefer `throw new NotFoundError(\`Item \${id} not found\`)` or
  `throw new ConflictError(\`Cannot publish brand \${id} — already
  published (version \${version})\`)`. Include identifiers, the
  operation, and the constraint that was violated. Schema names, table
  names, and DB constraint names are fine in service-to-service errors
  — they help the BFF log triage the cause. Generic messages like
  `"Bad Request"` or `"Error"` are not acceptable.
- **Log before re-throwing only when you add information.** The global
  `errorHandler` already logs every error with request context, so don't
  double-log the same `err` for noise. Do log when you can attach
  something the handler can't see (the Postgres error code, the SQL
  constraint name, the row count, the retry attempt, the upstream URL):
  `request.log.warn({ pgCode: err.code, constraint:
  'items_slug_key' }, 'unique constraint violation on items.slug')`.
- **Use `request.log`, not `console`.** It carries the request id and
  pino redacts `Authorization` headers.
- **Repositories surface, services translate.** Repositories let raw
  Supabase errors propagate (with the original `code` like `PGRST116`,
  `23505`, etc.). The service layer catches them and re-throws as the
  domain error with a readable message — that's where the
  `"Item \${id} not found"` lives, not in the route.
- **Pick the right error class.** `BadRequestError`, `NotFoundError`,
  `ConflictError`, `UnauthorizedError`, `ForbiddenError`,
  `ServiceUnavailableError`, `GatewayTimeoutError`,
  `TokenExpiredError`, `TokenInvalidError`, `TokenRevokedError`,
  `UpstreamUnavailableError`. Don't reach for `AppError` directly unless
  none of the subclasses fit.
- **Validation errors carry `details[]`.** `errorHandler` already builds
  the `details` array from AJV output; if you throw `ValidationError`
  manually, populate `details` with `{ field, issue }` so the caller
  knows which field broke.

### 14. OpenAPI docs are for service consumers (BFFs and other services)

Unlike a BFF, the audience for this service's `/docs` is internal —
other backend engineers integrating BFF or service-to-service calls.
Be more descriptive than a BFF would be.

- **Do explain:** the business rule the endpoint encodes, the
  preconditions, the side effects (e.g. *"publishing copies the brand
  row into `brands_live` atomically"*), the lifecycle constraints
  (*"draft only; 409 if `is_published`"*), the role/JWT requirements,
  and any non-obvious error codes the caller should handle.
- **Do reference internal docs** — ADRs, data-model docs — when an
  endpoint reflects a non-obvious decision. The reader is on your team.
- **Still avoid:** secrets, real customer data, ephemeral migration
  notes, "TODO" rationale that belongs in code review.

A good rule of thumb: a BFF engineer integrating against this service
should be able to write the right call **without reading the source**.
That implies more prose than a BFF's own docs would carry.

## Adding a new resource (recipe)

1. Create the seven files under `src/api/<resource>/`.
2. Add a migration under `supabase/migrations/` for the new table.
3. Register the routes at their prefix in `src/routes.ts`.
4. Add the resource's tag to `src/plugins/swagger.ts`.
5. Add a coverage map entry in `coverage-map.cjs`.
6. Write tests under `src/api/<resource>/tests/`.

## Adding a cross-service upstream (recipe)

1. Add `<UPSTREAM>_URL` and `<UPSTREAM>_TIMEOUT` to `appConfig.ts`,
   making the URL `required()` if production needs it.
2. Add the env var to `.env.example`.
3. Create `src/services/<upstream>.ts` — one client per upstream.
4. Create `src/plugins/<upstream>.ts` that decorates
   `fastify.<upstream>` with the client, with
   `dependencies: ['supabase']` if it needs Supabase context, else
   none.
5. Register the plugin in `src/index.ts` between `requireRole` and
   `registerRoutes`.
