# orkha-service-bootstrap

Bootstrap template for Orkha domain services (services that own a
Supabase-backed domain database). Clone, rename, replace the example
`items` resource with your own.

## Stack

- Fastify 5 + TypeScript 6 (Node 22 LTS)
- TypeBox + AJV (`removeAdditional: false`)
- Supabase (`@supabase/supabase-js`) — three injected clients
- `@fastify/swagger` + `swagger-ui` at `/docs`
- node-tap for tests
- pnpm

## Commands

```bash
pnpm install          # install dependencies
pnpm dev              # tsx watch — hot-reload dev server on :3000
pnpm build            # tsc compile to dist/
pnpm start            # run compiled dist/index.js
pnpm test             # tap (with coverage map)
```

## What to change after cloning

1. `package.json`: rename `name`, set `description`.
2. `.env.example` and `.env`: fill `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. `src/config/appConfig.ts`: replace `DB_SCHEMA` default
   (`orkha_service_bootstrap`) with your real schema name.
4. `supabase/migrations/20260101000000_initial.sql`: rename the schema,
   replace the example `items` table with your real tables, tighten the
   RLS policies.
5. `src/api/items/` is the example 7-file resource. Delete it and
   `src/api/items/tests/`, then add your real resources following the
   same pattern. Update `src/routes.ts` and `coverage-map.cjs`.
6. `src/plugins/swagger.ts`: replace title, description, tags.
7. `src/plugins/requireRole.ts`: implement your real role check (the
   shipped version is a stub that lets every authenticated user
   through).
8. `.github/workflows/deploy-staging.yml`: set `SERVICE_NAME`.

## Read this before writing code

- [`CLAUDE.md`](./CLAUDE.md) captures the architectural rules: plugin
  order, three-Supabase-client pattern, repositories per domain, RLS as
  defence in depth, AJV config, the migration discipline.

## Health & docs

- `GET /health` returns `{ status: 'healthy' }`. Don't remove it —
  Docker depends on it.
- `GET /docs` renders Swagger UI for the registered routes.
