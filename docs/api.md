# API structure

How `orkha-service-bootstrap` is organised, and how to extend it without breaking conventions.

## Stack

- **Fastify v5** + `@fastify/type-provider-typebox` — HTTP server with end-to-end type inference from TypeBox schemas
- **TypeScript** (CommonJS, targeting ES2022)
- **TypeBox** + AJV — runtime schema validation; `removeAdditional: false` so unknown fields → 400
- **`@fastify/swagger` + `@fastify/swagger-ui`** — OpenAPI 3.1 docs at `/docs`
- **`@supabase/supabase-js`** — three clients per request (anon, service-role admin, per-user JWT)
- **vitest** — tests

## Layout

```
src/
├── app.ts                         # buildApp() factory — used by server + tests
├── index.ts                       # process boot (dotenv, listen, graceful shutdown)
├── routes.ts                      # register all route plugins with their prefixes
├── api/
│   ├── index.ts                   # GET / (hidden from docs)
│   ├── health/health.routes.ts    # GET /health (hidden from docs)
│   └── <resource>/                # 6 files per resource
│       ├── <resource>.routes.ts   # HTTP layer; FastifyPluginAsyncTypebox
│       ├── <resource>.schemas.ts  # TypeBox shapes + $ids + Static<> types
│       ├── <resource>.docs.ts     # OpenAPI per-route schema objects
│       ├── <resource>.types.ts    # TS interfaces matching DB row shape
│       ├── <resource>.service.ts  # business logic; throws AppError subclasses
│       └── <resource>.repository.ts  # Supabase queries
├── common/
│   ├── base/BaseRepository.ts     # generic Supabase CRUD with humps (camelCase)
│   ├── base/BaseService.ts
│   └── docs/commonResponses.ts    # shared error response refs
├── config/appConfig.ts            # env load with required()
├── plugins/
│   ├── errorHandler.ts            # AppError taxonomy + global error envelope
│   ├── swagger.ts                 # OpenAPI options
│   ├── supabase.ts                # three Supabase data clients; graceful stub if unconfigured
│   ├── identity.ts                # fastify.identity decorator (IdentityClient)
│   ├── authenticate.ts            # delegates to identity-service /auth/me; sets request.user + request.identity
│   └── requireRole.ts             # role-gating preHandler factory (stub — implement per-service)
├── services/
│   └── identity.ts                # IdentityClient — one HTTP client per upstream (add more as needed)
└── utils/errors.ts                # AppError + subclasses + ErrorResponseSchema
tests/
├── helpers/build-test-app.ts      # buildTestApp() — wraps buildApp() with mocks
├── routes/<resource>.test.ts      # integration tests with mocked Supabase
└── services/<resource>.service.test.ts  # unit tests with mocked repo
```

## Layered request flow

```
HTTP request
  ↓
Fastify route              (<resource>.routes.ts)
  ↓
Schema validation          (<resource>.schemas.ts via TypeBox + AJV)
  ↓
preHandler: authenticate   (plugins/authenticate.ts — GET /auth/me via identity-service)
  ↓                        sets request.user, request.identity, request.accessToken
Handler → Service          (<resource>.service.ts) — throws AppError subclasses
  ↓
Repository                 (<resource>.repository.ts) — Supabase queries
  ↓
Postgres (via Supabase)
```

Errors thrown anywhere bubble to the global error handler and serialise to:

```json
{ "error": { "code": "NOT_FOUND", "message": "Item abc not found", "status": 404 } }
```

See [ADR-0001](decisions/0001-standard-error-response-format.md).

## Conventions

### REST verbs

`GET` (read), `POST` (create → `201`), `PATCH` (partial update), `DELETE` (→ `204`).

### Pagination

List endpoints take `?page` (default `1`) and `?limit` (default `20`, max `100`). Responses:

```json
{ "data": [...], "pagination": { "page": 1, "limit": 20, "hasNext": false, "hasPrev": false } }
```

### Naming conventions — two patterns

DB columns are always **snake_case**. The TypeScript/API layer has two approaches depending on the table:

| Pattern | When to use | How |
|---|---|---|
| **Standalone repo + snake_case end-to-end** | Table has JSONB columns, or you want no conversion | Write a standalone class; snake_case on the wire and in TS types |
| **`BaseRepository` + humps** | Table has no JSONB columns | Extend `BaseRepository`; humps converts snake↔camel at the repo boundary; API surface is camelCase |

The shipped `items` example uses the standalone pattern because humps would corrupt any JSONB content.

### Schema `$id`s

Give every TypeBox schema a resource-prefixed `$id` so they appear in the OpenAPI `components/schemas` section and are referenced (not duplicated) across operations. Examples: `Item`, `ItemCreateRequest`, `ItemUpdateRequest`, `ItemIdParams`, `ItemListQuery`, `ItemList`. Call `fastify.addSchema(...)` at the top of the route plugin for each.

### Authentication

Authentication is delegated to identity-service. The `authenticate`
preHandler calls `fastify.identity.getMe(token)`, which hits `GET
/v1/auth/me` with the Bearer token. On success it sets:

- `request.user` — `{ id, email }` for quick access.
- `request.identity` — the full payload including org/product/brand role
  tree. Use this in `requireRole` without a second HTTP call.
- `request.accessToken` — the raw token, for forwarding to other upstreams.

Error mapping in `IdentityClient`: `TOKEN_EXPIRED` → 401, `TOKEN_REVOKED` →
401, any other 401 → `INVALID_TOKEN`, ≥500 → `UPSTREAM_UNAVAILABLE`,
timeout → `GATEWAY_TIMEOUT`, connection refused → `SERVICE_UNAVAILABLE`.

### Three Supabase clients

These are **data** clients, not auth — identity-service owns auth.

- `fastify.supabase` — anon key, RLS-enforced reads
- `fastify.supabaseAdmin` — service-role key, bypasses RLS — use for writes
- `fastify.supabaseAsUser(jwt)` — anon + per-user JWT, RLS-scoped reads

Repositories receive their client from the route handler via the constructor. Never call `createClient()` inside a service or repository.

### Error classes

Prefer the specific subclass over `AppError` directly:
`BadRequestError`, `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `ServiceUnavailableError`, `GatewayTimeoutError`, `TokenExpiredError`, `TokenInvalidError`, `TokenRevokedError`, `UpstreamUnavailableError`.

Repositories surface raw Supabase errors; services catch and translate them into the right subclass with a specific message (`"Item ${id} not found"` rather than `"Not found"`).

## Adding a new resource

1. Create the six files under `src/api/<resource>/`.
   - Give each schema a resource-prefixed `$id`; call `fastify.addSchema(...)` in the route plugin.
   - Use `FastifyPluginAsyncTypebox` so `req.query`/`req.body` are inferred from `schema:`.
   - Spread `commonErrorResponses` into `response` in the docs file.
2. Add a migration under `supabase/migrations/`.
3. Register the routes in `src/routes.ts`.
4. Add the resource's tag in `src/plugins/swagger.ts`.
5. Write tests: `tests/services/<resource>.service.test.ts` and `tests/routes/<resource>.test.ts`.

## Configuration

| Variable | Purpose | Required |
|---|---|---|
| `PORT` | HTTP port (default `3000`) | No |
| `HOST` | Bind host (default `0.0.0.0`) | No |
| `LOG_LEVEL` | Pino level (default `info`) | No |
| `NODE_ENV` | `production` / `development` | No |
| `SUPABASE_URL` | Project URL | Production |
| `SUPABASE_ANON_KEY` | RLS-enforced reads | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin writes (bypasses RLS) | Production |
| `DB_SCHEMA` | Postgres schema (default `orkha_service_bootstrap`) | No |
| `IDENTITY_SERVICE_URL` | identity-service base URL | Yes |
| `IDENTITY_SERVICE_TIMEOUT` | HTTP timeout ms (default `30000`) | No |

In development, missing Supabase vars log a warning and activate a stub client — `/`, `/health`, and `/docs` remain reachable. `IDENTITY_SERVICE_URL` falls back to `http://localhost:3001` in dev (with a warning) but throws at boot in production.

## Graceful shutdown

`src/index.ts` handles `SIGINT`/`SIGTERM` with a re-entry guard (`shuttingDown` flag) and a 10-second force-exit timer (`.unref()` so it doesn't block clean exit). Process exits `0` on clean shutdown, `1` on error or timeout.
