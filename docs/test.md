# Testing

Three layers — pick the one that fits the kind of bug you're trying to catch.

## Tools

- **vitest** — runner, assertions (`expect`), mocking (`vi.fn()`)
- **`fastify.inject()`** — exercises the full HTTP pipeline (validation, preHandlers, error handler, response serialisation) without binding a port

## Running

```bash
pnpm test          # watch mode
pnpm test:run      # single run (use in CI)
pnpm typecheck     # tsc against src + tests
```

## Layers

### 1. Unit — service logic

**File:** `tests/services/<resource>.service.test.ts`

Instantiate the service with a mocked repository (`vi.fn()` per method). No Fastify, no HTTP. Use this for branching logic, error mapping, and `NotFoundError` guards.

```ts
function makeRepo(overrides = {}) {
  return {
    findById: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    ...overrides,
  } as unknown as <Resource>Repository
}

it('throws NOT_FOUND when missing', async () => {
  const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) })
  const service = new <Resource>Service(repo)
  await expect(service.getById('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' })
})
```

### 2. Smoke — routes that don't hit the DB

**Files:** `tests/routes/root.test.ts`, `tests/routes/health.test.ts`

Build the app with no Supabase override and hit the route via `inject`. The default `buildTestApp()` provides a mock supabase that handles auth (`auth.getUser` returns a fake user) so the app boots cleanly.

```ts
const app = await buildTestApp()
const res = await app.inject({ method: 'GET', url: '/health' })
expect(res.statusCode).toBe(200)
expect(res.json()).toEqual({ status: 'healthy' })
await app.close()
```

### 3. Integration — routes with mocked Supabase admin client

**File:** `tests/routes/<resource>.test.ts`

`buildTestApp({ supabaseAdmin })` swaps the admin client with a mock that chains `vi.fn().mockReturnThis()` through the query builder and terminates with `mockResolvedValue({ data, error })`. Because the repository uses `supabase.schema(schema).from(table)...`, the mock chain starts at `schema`:

```ts
function asAdmin(builder: object): SupabaseClient {
  return makeAuthSupabase({
    schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(builder) })
  })
}

const admin = asAdmin({
  select: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockResolvedValue({ data: [sampleRow], error: null }),
})

const app = await buildTestApp({ supabaseAdmin: admin })
const res = await app.inject({ method: 'GET', url: '/v1/<resource>', headers: { authorization: 'Bearer test-token' } })
expect(res.statusCode).toBe(200)
```

Always call `await app.close()` in a `finally` block.

## Auth in tests

All protected routes require a `Bearer` token. Authentication is handled by
`makeIdentityMock()` in `tests/helpers/build-test-app.ts`, which stubs
`fastify.identity.getMe` to return a fake `IdentityMe` payload
(`id: 'test-user-id'`, `email: 'test@example.com'`, `orgs: []`). Any
non-empty `Authorization: Bearer <anything>` header passes authentication —
no real identity-service connection needed.

To test role-based logic, override the identity payload:

```ts
const app = await buildTestApp({
  identity: makeIdentityMock({
    getMe: vi.fn().mockResolvedValue({
      ...fakeIdentityMe,
      orgs: [{ orgId: 'org-1', orgRole: 'org_admin', ... }],
    }),
  }),
})
```

## The `buildTestApp` helper

[`tests/helpers/build-test-app.ts`](../tests/helpers/build-test-app.ts) wraps `buildApp()`:

- Logger silenced (`logger: false`) so test output stays clean
- `identity` override defaults to `makeIdentityMock()` — returns a fake
  identity payload for any Bearer token
- `supabase` override defaults to `makeAuthSupabase()` — used for data
  queries, not auth
- `supabaseAdmin` override defaults to the same mock; pass a custom one with
  a chained query-builder mock for routes that hit the DB

## What to test for a new resource

Create `tests/routes/<resource>.test.ts` (integration layer) and `tests/services/<resource>.service.test.ts` (unit layer). At minimum cover:

- Happy path on each verb (list, get, create, patch)
- Validation failure — assert the `VALIDATION_ERROR` envelope and `400`
- Missing resource — assert `404` and the `<RESOURCE>_NOT_FOUND` code (or `NOT_FOUND`)
- Standard error envelope shape `{ error: { code, message, status } }` on every error response
- Unauthenticated request — assert `401`

## What we deliberately don't test

- **Real Supabase calls.** The repository is the only place talking to Supabase; we mock at that boundary. End-to-end tests against a live database belong in a separate harness.
- **Schema validation in isolation.** We test through the HTTP entry point so AJV wiring bugs surface alongside handler bugs.
- **Fastify internals.** Plugin registration order is tested implicitly by the smoke tests booting successfully.
