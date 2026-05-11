# Architecture

Directory layout and cross-cutting structure for this service.

## Layout

```
src/
├── api/
│   ├── health/health.routes.ts
│   ├── <resource>/                # 6 files per resource
│   │   ├── <resource>.routes.ts
│   │   ├── <resource>.schemas.ts
│   │   ├── <resource>.docs.ts
│   │   ├── <resource>.types.ts
│   │   ├── <resource>.service.ts
│   │   └── <resource>.repository.ts
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
├── app.ts                         # buildApp() factory (used by server + tests)
├── routes.ts
└── index.ts                       # process boot only
tests/
├── helpers/build-test-app.ts
├── routes/
│   ├── root.test.ts
│   ├── health.test.ts
│   └── <resource>.test.ts
└── services/
    └── <resource>.service.test.ts
supabase/
└── migrations/
```

## Adding a cross-service upstream

The identity integration (`src/services/identity.ts` +
`src/plugins/identity.ts`) is the worked example. Follow the same pattern
for any additional upstream:

1. Add `<UPSTREAM>_URL` and `<UPSTREAM>_TIMEOUT` to `appConfig.ts`,
   making the URL `required()` if production needs it.
2. Add the vars to `.env.example`.
3. Create `src/services/<upstream>.ts` — one HTTP client class per upstream.
4. Create `src/plugins/<upstream>.ts` that decorates `fastify.<upstream>`
   with the client. Set `dependencies: []` (or omit) if independent of other
   plugins.
5. Register the plugin in `src/app.ts` in the correct position (after any
   plugin it depends on, before any plugin that depends on it).
