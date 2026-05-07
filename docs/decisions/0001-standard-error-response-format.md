# 1. Standard error response format

Date: 2026-05-07

## Status

Accepted

## Context

Every endpoint needs a single, predictable error shape so:

- Callers (BFFs, other services) have one error parser to maintain
- BFFs can map `error.code` to end-user copy without parsing free-text messages
- Observability tooling can filter and alert on a structured, stable code

Without one, a Supabase error, a validation failure, and a 404 look different to the caller.

## Decision

All errors are returned in the following envelope:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Item abc123 not found",
    "status": 404,
    "details": [{ "field": "name", "issue": "is required" }]
  }
}
```

- **`code`** — stable, `SCREAMING_SNAKE_CASE` identifier. Callers branch on this; never the message.
- **`message`** — human-readable, descriptive. This is an internal API — include identifiers, table names, constraint names. BFFs sanitise before forwarding to end users.
- **`status`** — mirrors the HTTP status code.
- **`details`** — optional array of `{ field, issue }` pairs for validation errors.

Implementation lives in `src/plugins/errorHandler.ts`:

- Throw any `AppError` subclass from anywhere; the global handler formats it.
- AJV validation errors are mapped to `VALIDATION_ERROR` 400 with a `details` array.
- System errors (ECONNREFUSED, ETIMEDOUT) map to `SERVICE_UNAVAILABLE` / `GATEWAY_TIMEOUT`.
- Unknown errors collapse to `INTERNAL_SERVER_ERROR` 500 (message hidden in production).
- 404s are caught by `setNotFoundHandler` and emitted as `NOT_FOUND`.

The `ErrorResponseSchema` (in `src/utils/errors.ts`) is registered with `fastify.addSchema()` in the `errorHandler` plugin and appears in the OpenAPI `components/schemas` section. All route `response` docs reference it via `commonErrorResponses` (`src/common/docs/commonResponses.ts`).

### AppError subclass catalogue

| Class | Code | Status |
|---|---|---|
| `BadRequestError` | `BAD_REQUEST` | 400 |
| `ValidationError` | `VALIDATION_ERROR` | 400 |
| `UnauthorizedError` | `UNAUTHORIZED` | 401 |
| `TokenExpiredError` | `TOKEN_EXPIRED` | 401 |
| `TokenInvalidError` | `INVALID_TOKEN` | 401 |
| `TokenRevokedError` | `TOKEN_REVOKED` | 401 |
| `ForbiddenError` | `FORBIDDEN` | 403 |
| `NotFoundError` | `NOT_FOUND` | 404 |
| `ConflictError` | `CONFLICT` | 409 |
| `ServiceUnavailableError` | `SERVICE_UNAVAILABLE` | 503 |
| `UpstreamUnavailableError` | `UPSTREAM_UNAVAILABLE` | 503 |
| `GatewayTimeoutError` | `GATEWAY_TIMEOUT` | 504 |

Resource-specific codes (e.g. `BRAND_NOT_FOUND`) can be thrown via `new AppError(404, 'BRAND_NOT_FOUND', 'Brand xyz not found')` when a more specific code is warranted.

## Consequences

**Pros**

- Single contract for callers; SDK generation is straightforward.
- New routes get the correct error shape for free — just throw the right subclass.
- Codes are searchable across logs, the codebase, and BFF integration code.
- Internal messages can be verbose (include IDs, constraint names) because BFFs sanitise.

**Cons**

- Slightly more verbose than `reply.code(404).send({ message: 'not found' })`.
- Picking a code for a new error type requires explicit thought (small cost, but forces discipline).

## ADR format used here

```
# <number>. <Title>

Date: YYYY-MM-DD

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-NNNN

## Context
The forces at play — the problem, the constraints, why this needs deciding now.

## Decision
The choice we made, in active voice. Be specific.

## Consequences
What becomes easier and what becomes harder. List both.
```

New ADRs go in `docs/decisions/` numbered sequentially: `0002-...md`, `0003-...md`. Once accepted, an ADR is immutable; supersede with a new ADR rather than edit.
