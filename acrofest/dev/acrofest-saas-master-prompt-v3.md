# AcroFest SaaS — Master Build Prompt v3

---

## HOW TO USE THIS PROMPT

This prompt is split into four layers. Read all four before generating anything.

**Layer A — Product Spec:** What the system does and who it serves.  
**Layer B — Technical Standards:** Stack, conventions, testing, observability.  
**Layer C — Domain Rules:** Hard decisions on money, permissions, legal, concurrency.  
**Layer D — Output Protocol:** Exactly what to produce, in what order, at what granularity.

**Start by following Layer D exactly.** Do not generate code until the protocol says to.

---

# LAYER A — PRODUCT SPEC

## What This Is

A multi-tenant SaaS platform for managing multi-day acroyoga and yoga festivals and retreats. One deployment serves many tenant organizations. Each tenant runs one or more events.

## Audiences

| Audience | App | Description |
|---|---|---|
| Platform operator | `/apps/platform` | SiteOwner. Manages tenants, billing, platform health. Never touches event content. |
| Organizer / Staff | `/apps/admin` | Tenant admin. Manages their event(s) end-to-end. |
| Teacher | `/apps/portal` | Sees their own schedule, manages their profile, views their session participants. |
| Participant | `/apps/portal` | Registers, pays, manages schedule and profile. |
| Prospect | `/apps/website` | Public visitor. Discovers the event, registers. |

## Identity and Role Model

A **User** is a single identity across the platform (one email, one login, one global profile). Roles are **event-scoped memberships**, not user attributes.

```prisma
model EventMembership {
  id        String  @id @default(cuid())
  userId    String
  eventId   String
  tenantId  String  // denormalized for query efficiency
  roles     Role[]  // array — one record per user per event

  @@unique([userId, eventId])
  @@index([tenantId])
  @@index([eventId])
}

enum Role { ORGANIZER STAFF TEACHER PARTICIPANT }
```

The same user can hold:
- Multiple roles at one event (e.g. TEACHER + PARTICIPANT)
- Memberships at multiple events across multiple tenants

**JWT payload contains only:** `{ sub: userId, tenantId, iat, exp }`. No role field. Roles resolved per-request per-event from the database.

**SiteOwner** is a separate model (`PlatformUser`) with a separate auth flow. SiteOwners are never EventMembership members.

## Module Map

| # | Module | Primary audience |
|---|---|---|
| 0 | Platform dashboard | SiteOwner |
| 1 | Event configuration | Organizer |
| 2 | Teacher management | Organizer |
| 3 | Schedule builder | Organizer |
| 4 | Participant management | Organizer |
| 5 | Profile + visibility system | All |
| 6 | Booking + payment pipeline | Participant / Organizer |
| 7 | Logistics | Organizer / Staff |
| 8 | Financial dashboard | Organizer |
| 9 | Communications + marketing | Organizer |
| 10 | Participant / Teacher portal | Participant / Teacher |
| 11 | Public marketing website | Prospect |

## SaaS Tenancy

- Default URL: `{slug}.acrofest.app`
- Custom domain (Pro+): tenant sets CNAME, platform issues cert via Caddy + Let's Encrypt. Domain verification: tenant adds a `TXT` record. Apex and subdomain both supported. Cert renewal owned by platform (Caddy auto-renews).
- Public website (`/apps/website`): **tenant-aware runtime rendering with aggressive caching** (not per-tenant SSG builds). Cache invalidated on organizer publish action. Pre-render only the homepage and `/programme` as hot paths. This avoids SSG build complexity at scale.
- One PostgreSQL database, all records scoped by `tenantId`. Upgrade path to per-tenant schemas is a data migration, not a redesign.

## Plan Tiers

| Feature | Free | Starter | Pro | Enterprise |
|---|---|---|---|---|
| Events | 1 | 3 | Unlimited | Unlimited |
| Participants / event | 50 | 300 | 2,000 | Unlimited |
| Financial module | ✗ | ✓ | ✓ | ✓ |
| Marketing module | ✗ | ✗ | ✓ | ✓ |
| Custom domain | ✗ | ✗ | ✓ | ✓ |
| White-label | ✗ | ✗ | ✗ | ✓ |
| DPA document | ✗ | ✓ | ✓ | ✓ |
| Priority support | ✗ | ✗ | ✓ | ✓ |
| PDF exports | ✗ | ✓ | ✓ | ✓ |
| Social asset generator | ✗ | ✗ | ✓ | ✓ |

Plan limits enforced at: API layer, UI layer, BullMQ worker intake, storage upload handler, website publish trigger, and data export endpoint. All six. Not just UI.

---

# LAYER B — TECHNICAL STANDARDS

## Stack

```
Frontend:    React (Vite) + TypeScript (strict) + Tailwind CSS + shadcn/ui
Backend:     Fastify + TypeScript (strict)
Database:    PostgreSQL 15+ via Prisma ORM
Auth:        JWT (15-min access, 7-day refresh with rotation) + magic links + TOTP 2FA
Payments:    Stripe primary, Mollie EU fallback — swappable adapter
Email:       Resend primary, Postmark fallback — swappable adapter
Queue:       BullMQ + Redis
Cache:       Redis
Storage:     S3-compatible (Cloudflare R2 default)
Logging:     Pino (structured, JSON, request IDs on every log line)
Tracing:     OpenTelemetry → Jaeger (or OTLP-compatible collector)
Errors:      Sentry (backend + frontend, separate DSNs)
SSL:         Caddy (auto-cert via Let's Encrypt for custom domains)
Dev:         Docker Compose (all services)
Prod:        Railway or Kubernetes (manifests provided)
```

## TypeScript Rules

- `strict: true` in all `tsconfig.json` files
- No `any`. Use `unknown` and narrow with Zod.
- No implicit `undefined` returns on non-void functions
- All exported functions have explicit return types
- Zod schema is the single source of truth for every API input shape — types inferred from Zod, not written separately

## Code Conventions

- All monetary values: **integers in minor units (cents)**. Never floats. Currency stored on every money-bearing record.
- All timestamps: **UTC in database**. Display converted to event's IANA timezone.
- All `findMany` queries: **cursor-based pagination**. No offset pagination anywhere.
- All async functions: wrapped in typed error handler or explicit `try/catch`. No unhandled promise rejections.
- No `console.log` in any committed code. Use `logger.info()`, `logger.warn()`, `logger.error()` from Pino instance.
- All API routes: `requestId` (UUID v4) generated at entry, attached to Pino logger context, returned in response header `X-Request-Id`.
- All background jobs: tenant context injected via AsyncLocalStorage before job execution. A job without tenant context throws before any DB call.

## API Contract Standards

**URL convention:** `/api/v1/{resource}` for public API. `/api/internal/{resource}` for platform-only endpoints.

---

### Error envelope — canonical shape

Every error response in the system uses this exact JSON structure. No variations. No alternative wrappers.

```json
{
  "error": {
    "code": "SNAKE_CASE_STRING",
    "message": "Human-readable string safe to display to end users.",
    "details": {},
    "requestId": "01HQ7ZXVKJ3M4N5P6Q7R8S9T0U"
  }
}
```

`details` is omitted (not `null`, not `{}`) when there are no field-level errors.  
`requestId` is always present. It matches the `X-Request-Id` response header.

Zod schema (used server-side to validate outgoing errors before sending):

```typescript
const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    requestId: z.string(),
  })
});
```

Concrete examples — every error in the system must match this wrapper exactly:

```json
// 422 — Zod validation failure
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": {
      "email": "Invalid email address",
      "priceCents": "Must be a positive integer"
    },
    "requestId": "01HQ7ZXVKJ3M4N5P6Q7R8S9T0U"
  }
}

// 404 — resource not found
{
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "The requested order does not exist or you do not have access.",
    "requestId": "01HQ7ZXVKJ3M4N5P6Q7R8S9T0U"
  }
}

// 403 — permission denied
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action.",
    "requestId": "01HQ7ZXVKJ3M4N5P6Q7R8S9T0U"
  }
}

// 409 — capacity conflict
{
  "error": {
    "code": "UNIT_AT_CAPACITY",
    "message": "This accommodation unit is fully booked.",
    "details": { "unitId": "clx123", "capacity": 2, "assigned": 2 },
    "requestId": "01HQ7ZXVKJ3M4N5P6Q7R8S9T0U"
  }
}

// 402 — plan limit
{
  "error": {
    "code": "PLAN_LIMIT_REACHED",
    "message": "Your plan allows a maximum of 3 events. Upgrade to create more.",
    "details": { "limit": 3, "current": 3, "planName": "Starter" },
    "requestId": "01HQ7ZXVKJ3M4N5P6Q7R8S9T0U"
  }
}

// 429 — rate limited
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please wait before trying again.",
    "details": { "retryAfterSeconds": 47 },
    "requestId": "01HQ7ZXVKJ3M4N5P6Q7R8S9T0U"
  }
}

// 403 — tenant isolation violation (generic message to client; full event logged internally as SECURITY severity)
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action.",
    "requestId": "01HQ7ZXVKJ3M4N5P6Q7R8S9T0U"
  }
}
```

---

### Pagination envelope — canonical shape

Every list endpoint uses this exact wrapper. No array-at-root responses anywhere.

```json
{
  "items": [],
  "pageInfo": {
    "nextCursor": "clx789abc",
    "hasNextPage": true
  }
}
```

When on the last page, `nextCursor` is `null` and `hasNextPage` is `false`:

```json
{
  "items": [
    { "id": "clxabc", "name": "Final Event", "startDate": "2026-05-01T00:00:00Z" }
  ],
  "pageInfo": {
    "nextCursor": null,
    "hasNextPage": false
  }
}
```

`total` is included only when it is cheap to compute (i.e. the count query runs without a full table scan). When omitted, the key is absent — not `null`, not `0`.

```json
// With total (cheap count available)
{
  "items": [ { "id": "clx001" } ],
  "pageInfo": { "nextCursor": "clx001", "hasNextPage": true },
  "total": 247
}

// Without total (expensive count, omitted)
{
  "items": [ { "id": "clx001" } ],
  "pageInfo": { "nextCursor": "clx001", "hasNextPage": true }
}
```

Zod schema (used server-side to validate outgoing paginated responses):

```typescript
const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    pageInfo: z.object({
      nextCursor: z.string().nullable(),
      hasNextPage: z.boolean(),
    }),
    total: z.number().int().optional(),
  });
```

Cursor is always an opaque string (base64-encoded `{ id, createdAt }` of the last item). Clients must not parse or construct cursors — treat as opaque token.

---

### Async accepted envelope — for 202 responses

Used when a request queues a background job (data export, PDF generation, etc.):

```json
{
  "jobId": "export-clxusr123-01HQ7ZX",
  "message": "Your export is being prepared. You will receive an email with a download link.",
  "estimatedSeconds": 30
}
```

`estimatedSeconds` is a display hint only — use it to show a message like "usually ready in ~30 seconds". It is not a polling interval, not a timeout, and not a commitment. Client behaviour must be based on: (a) the email delivery, or (b) a status endpoint `GET /api/v1/jobs/:jobId/status` — never on a countdown from `estimatedSeconds`. UI must not block or show a spinner after `estimatedSeconds` elapses.

---

### HTTP status codes — allowed set

No status codes outside this table may be returned by any route:

| Code | When |
|---|---|
| 200 | Successful read or update |
| 201 | Resource created (body contains created resource) |
| 202 | Async job accepted (body is async envelope above) |
| 204 | Successful delete — empty body |
| 400 | Malformed JSON, webhook signature invalid |
| 401 | Missing or expired auth token |
| 402 | Plan limit reached — **conscious choice:** 402 is non-standard for this case; many teams use 403 or 409 instead. This system uses 402 to make plan limits semantically distinct from permission denials (403) and state conflicts (409), allowing clients to route the user directly to a billing upgrade flow without parsing the error code. If this distinction causes friction with your HTTP client or API gateway, the error code `PLAN_LIMIT_REACHED` in the body is the authoritative signal — the status code is secondary. |
| 403 | Authenticated but insufficient permission |
| 404 | Resource not found or not visible to caller |
| 409 | Capacity exceeded, uniqueness conflict, state machine conflict |
| 422 | Valid JSON but fails Zod validation |
| 429 | Rate limit exceeded |
| 500 | Unhandled error — always captured by Sentry |
| 503 | Readiness check failing, circuit breaker open |

---

### Audit log action naming convention

Audit log `action` field uses dot-namespaced lowercase: `{domain}.{verb}`.

| Domain | Actions |
|---|---|
| `auth` | `auth.login`, `auth.logout`, `auth.magic_link_sent`, `auth.magic_link_used`, `auth.totp_enrolled`, `auth.totp_verified_fail`, `auth.totp_reset`, `auth.refresh_rotated`, `auth.family_revoked` |
| `tenant` | `tenant.created`, `tenant.suspended`, `tenant.deleted`, `tenant.impersonate_start`, `tenant.impersonate_end`, `tenant.plan_changed` |
| `participant` | `participant.internal_notes_read`, `participant.data_export_requested`, `participant.data_export_downloaded`, `participant.deletion_requested`, `participant.deletion_executed` |
| `order` | `order.created`, `order.paid`, `order.refund_requested`, `order.refunded`, `order.chargeback_received` |
| `profile` | `profile.visibility_updated`, `profile.sensitive_fields_read` |
| `security` | `security.tenant_isolation_violation`, `security.rate_limit_exceeded`, `security.invalid_webhook_signature`, `security.totp_reset_limit_reached` |

---

### Soft-delete visibility rule

- Soft-deleted resources (`deletedAt IS NOT NULL`) return `404` to all non-admin callers — indistinguishable from never-existing
- ORGANIZER can fetch soft-deleted resources by passing `?includeDeleted=true` query param — returns resource with `deletedAt` field populated
- SiteOwner can see soft-deleted tenants in the platform dashboard without a query param (always visible in the deleted tab)
- **Layered defence — middleware is the guardrail, not the only gate:**
  - The tenant context middleware appends `deletedAt: null` to all Prisma queries as a default. This is the safety net.
  - However, Prisma middleware has known edge cases with nested `include` and relation queries where the filter may not propagate. Do not rely on middleware alone.
  - All service/repository functions that query soft-deletable models must **explicitly** include `where: { deletedAt: null }` unless they are the intentional `includeDeleted=true` path.
  - Code review rule: any `findUnique`, `findFirst`, or `findMany` on a soft-deletable model without an explicit `deletedAt` filter is a bug.

---

### Circuit breaker rule for payment providers

Payment provider adapters (Stripe, Mollie) wrap all outbound HTTP calls in a circuit breaker (use `cockatiel` or `opossum` library):

- **Trip condition:** 5 consecutive failures OR error rate > 50% over a 30-second window
- **Open state duration:** 60 seconds, then half-open (one probe request)
- **Routes affected when open:** `POST /api/v1/checkout/initiate`, `POST /api/v1/checkout/confirm`, `POST /api/v1/orders/:id/refund`
- **Response when open:** `503` with body `{ "error": { "code": "PAYMENT_PROVIDER_UNAVAILABLE", "message": "Payment processing is temporarily unavailable. Please try again in a few minutes.", "requestId": "..." } }`
- **Not affected:** webhook ingestion endpoints (they queue to BullMQ regardless), portal read endpoints, order status reads
- Circuit breaker state stored in Redis so all API instances share the same state (not per-process)
- SiteOwner platform dashboard shows current circuit state per provider

---

### Website cache key format

Redis cache keys for tenant website pages follow this format:

```
website:{tenantId}:{path}:{locale}
```

Examples:
```
website:cltenant123:/:en
website:cltenant123:/programme:en
website:cltenant123:/teachers/alice-smith:nl
```

TTL: 5 minutes for all pages.  
Invalidation: on `event.publish` or `event.update` → invalidate all cached pages for that tenant. **This is intentionally coarse** — any event update clears the entire tenant website cache, not just the affected page. This is a deliberate v1 simplicity choice: it avoids tracking page-to-data dependencies, is safe under all edit scenarios, and the 5-minute TTL limits the blast radius. If cache churn becomes a problem at scale (e.g. tenant with 1,000+ daily edits), a fine-grained dependency graph can replace it in v2. Do not optimise this prematurely.

Implementation — **never use Redis `KEYS` or `DEL` with a wildcard directly** (blocks the server on large keyspaces):

```typescript
// Correct invalidation pattern
async function invalidateTenantWebsiteCache(redis: Redis, tenantId: string) {
  const pattern = `website:${tenantId}:*`;
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys); // batch delete — max 100 keys per iteration
    }
  } while (cursor !== '0');
}
```

Batch size: 100 keys per `SCAN` iteration. Do not increase above 500 — risk of blocking Redis on large tenants.  
Pre-warming: after invalidation, enqueue a `warm_website_cache` BullMQ job that fetches homepage and `/programme` to repopulate before the next visitor hits cold cache.

**Idempotency:** All state-changing endpoints that touch money or send communications accept an `Idempotency-Key` header (UUID). Keys stored in Redis for 24 hours. Duplicate requests within window return the cached response without re-executing.

**Webhook event naming:** `{resource}.{action}` — e.g. `order.paid`, `session.cancelled`, `participant.checkedin`, `tenant.suspended`.

**Versioning:** `/api/v1/` prefix. Breaking changes increment to `/api/v2/`. Both versions run concurrently for one release cycle.

## Architecture Decision Records

The build must produce the following ADRs in `/docs/adr/` before any application code:

- `001-multi-tenancy-model.md` — shared DB with tenantId vs schemas vs separate DBs. Decision and rationale.
- `002-auth-session-model.md` — JWT shape, refresh rotation, magic link constraints, impersonation model.
- `003-payment-abstraction.md` — adapter interface, webhook handling, idempotency, Stripe vs Mollie feature parity.
- `004-website-rendering.md` — runtime rendering with cache vs SSG. Decision and tradeoffs.
- `005-permission-model.md` — capability matrix, resource-action pairs, scope levels.

## Testing Requirements

Tests are not optional. The following coverage is required:

**Unit tests (Vitest):**
- All functions in `/packages/permissions` — 100% line coverage
- All functions in `/packages/utils/money` — 100% line coverage  
- Refund calculation logic — all edge cases (before cutoff, after cutoff, partial payment, chargeback)
- Installment scheduling logic — all configurations
- Visibility resolution logic — all role/field combinations

**Integration tests (Vitest + test DB):**
- Auth flows: login, refresh rotation, magic link, TOTP, reuse detection, impersonation
- Tenant isolation: attempt to read another tenant's data → expect 403 + security log entry
- Payment webhook: valid Stripe event → order paid; invalid signature → 400
- Registration flow: full order creation through to paid status
- Waitlist promotion: capacity released → correct participant promoted → email queued

**API contract tests:**
- Every route has a test asserting the response shape matches the Zod output schema
- Error responses always return `ApiError` shape

**Permission matrix tests:**
For every `(role, resource, action)` triple in the capability matrix, one test asserting allow or deny. Generated from the matrix table, not hand-written per case.

**End-to-end tests (Playwright):**
- Prospect registers for an event (happy path)
- Participant logs in, views schedule, enrolls in session
- Organizer creates event, adds session, checks participant list
- SiteOwner suspends tenant → tenant admin sees suspended state

**Seed scenario for all tests:**
One tenant (`AcroFest Test Org`), one event (`Spring Retreat 2026`, 3 days, 2 venues, 4 sessions), one teacher (`alice@test.com`), one participant (`bob@test.com`, paid order), one organizer (`carol@test.com`). All tests run against this seed.

## Observability

- **Pino:** structured JSON logs, log level from env. Every request logs: `requestId`, `method`, `path`, `statusCode`, `durationMs`, `tenantId` (if resolved), `userId` (if authenticated).
- **OpenTelemetry:** traces on all Fastify routes and BullMQ jobs. Span includes `tenantId`, `userId`, `jobType`.
- **Sentry:** error capture on backend (unhandled errors + explicit `Sentry.captureException`) and frontend (React error boundaries). Separate DSNs per app.
- **BullMQ dashboard:** Bull-Board, accessible at `/admin/queues`, gated behind SiteOwner auth.
- **Health endpoints:** `GET /health` (liveness), `GET /health/ready` (readiness — checks DB + Redis + queue connectivity).
- **Alerting:** define alert rules for: error rate > 1% over 5 min, queue depth > 500 jobs, failed payment webhook, tenant isolation violation.

## Secrets Management

- All secrets in environment variables. No secrets in code or version control.
- `.env.example` provided with all required keys and descriptions.
- In production: secrets injected via Railway environment or Kubernetes Secrets.
- Rotation: Stripe and Mollie webhook secrets rotatable without restart (read from env on each verification, not cached at startup).

## Disaster Recovery

- **Backup:** nightly PostgreSQL `pg_dump` to S3. 30-day retention. Tested monthly (document test in `/docs/runbooks/backup-restore.md`).
- **RPO:** 24 hours (acceptable for v1 — note this explicitly in ADR).
- **RTO:** 4 hours (document recovery steps in runbook).
- **Redis:** ephemeral — rate limit counters and cache can be cold-started. BullMQ jobs persisted in Redis; if Redis is lost, in-flight jobs may be lost. Document this tradeoff.
- **Rollback strategy:** Prisma migrations are forward-only in v1. Breaking schema changes require a multi-step migration (add column, deploy code, backfill, drop old column). Document in `/docs/runbooks/schema-migration.md`.

## Design System

Shared token set in `/packages/ui/tokens.css`. Typography: `DM Serif Display` (headings) + `DM Sans` (body).

```css
:root {
  --brand: #5B9E6E; --brand-dark: #3A7D52; --brand-subtle: #EAF4EE;
  --accent-warm: #E8A84C; --accent-sky: #4A89B0; --accent-rose: #C4706A;
  --bg: #F4F7F4; --surface: #FAFCFA; --surface-2: #EEF3EE;
  --border: #D8E6DB; --text: #152318; --text-muted: #7A9880;
  --radius: 10px; --radius-sm: 6px;
}
```

- `/apps/platform`: dark Palantir-style (`#0A0C10` canvas, `#161B22` surfaces, Geist Mono, 2–4px radii)
- `/apps/admin`: light, warm sage. Left icon nav + collapsible sidebar + content + inspector panel.
- `/apps/portal`: same palette, mobile-first (375px+), magazine feel.
- `/apps/website`: editorial, full-bleed hero, animate-on-scroll.

All apps: WCAG 2.1 AA. Semantic HTML. ARIA labels. Keyboard navigable. Focus rings visible.

---

# LAYER C — DOMAIN RULES

Hard decisions made here. The implementation must follow these exactly. Do not invent alternatives.

## C1 — Permission Capability Matrix

The `/packages/permissions` package implements this matrix. The matrix is the source of truth — tests are generated from it.

**Scope levels:**

- `PLATFORM` — SiteOwner only. Granted via `PlatformUser` model, never via `EventMembership`.
- `TENANT` — applies across all events within a tenant. **Not automatically granted by holding any event role.** In v1, TENANT scope is granted explicitly in two cases only: (1) a user holds ORGANIZER on at least one event within the tenant AND the action targets tenant-level resources (e.g. creating a new event, viewing tenant billing); (2) a future explicit `TenantMembership` record is added. If neither condition is met, the user does not hold TENANT scope even if they are an organizer on other events. Implement a `hasTenantScope(userId, tenantId, action)` helper in `/packages/permissions` that checks condition (1) explicitly — do not infer TENANT scope from `EventMembership` records without this check.
- `EVENT` — role-scoped to one specific event. Resolved from `EventMembership.roles` for that `eventId`.
- `SELF` — the resource belongs to the authenticated user (`resourceOwnerId === requestingUserId`). Used in the matrix for actions a user may perform on their own record only.

**Permission conditions** are additional predicates applied on top of scope, for rows where a role has access but only to a subset of resources within that scope. They are not scope levels — they are runtime checks composed with the scope check:

- `isTeacherOfSession(userId, sessionId, db)` — returns true if a `SessionTeacher` record exists for this user + session. Used for `Session.view_enrollees` (TEACHER column). Implemented in `/packages/permissions`. A TEACHER who passes scope check but fails this predicate receives a 403 on that specific session, identical to a full deny.

**Read permission split:** several resources have public fields and sensitive fields. These are modeled as separate actions, not one `read`. The API returns different field sets based on the resolved action.

| Resource | Action | ORGANIZER | STAFF | TEACHER | PARTICIPANT | Notes |
|---|---|---|---|---|---|---|
| Event | create | TENANT | ✗ | ✗ | ✗ | Requires TENANT scope (user must be ORGANIZER on ≥1 event in this tenant). Check via `hasTenantScope(userId, tenantId, 'event:create')`. Tenant plan limit also enforced. |
| Event | read:public | ✓ | ✓ | ✓ | ✓ | Name, dates, venues, published schedule, description |
| Event | read:admin | ✓ | ✓ | ✗ | ✗ | + internal config, draft sessions, participant counts, revenue totals |
| Event | update | ✓ | ✗ | ✗ | ✗ | |
| Event | delete | ✓ | ✗ | ✗ | ✗ | Soft delete only |
| Event | publish | ✓ | ✗ | ✗ | ✗ | |
| Session | create/update/delete | ✓ | ✓ | ✗ | ✗ | |
| Session | read:public | ✓ | ✓ | ✓ | ✓ | Title, type, time, venue, teacher names, capacity remaining |
| Session | read:admin | ✓ | ✓ | ✗ | ✗ | + full enrollee list, check-in counts, internal notes |
| Session | enroll_participant | ✓ | ✓ | ✗ | SELF | Participant enrolls self |
| Session | checkin | ✓ | ✓ | ✗ | ✗ | |
| Session | view_enrollees | ✓ | ✓ | ✓ + `isTeacherOfSession` | ✗ | TEACHER role required + predicate: only their own sessions. See permission conditions. |
| Participant | list | ✓ | ✓ | ✗ | ✗ | Returns id, name, ticket tier only |
| Participant | read:public | ✓ | ✓ | ✗ | ✗ | Name, ticket tier, extension fields (no contact info) |
| Participant | read:sensitive | ✓ | ✓ | ✗ | ✗ | + email, phone, emergency contact, dietary needs |
| Participant | read_internal_notes | ✓ | ✗ | ✗ | ✗ | Audit-logged on every access |
| Participant | update | ✓ | ✓ | ✗ | SELF | |
| Order | read | ✓ | ✗ | ✗ | SELF | Staff cannot see financial data |
| Order | refund | ✓ | ✗ | ✗ | SELF | Participant requests; organizer approves |
| Invoice | read | ✓ | ✗ | ✗ | SELF | |
| Financial | read_dashboard | ✓ | ✗ | ✗ | ✗ | |
| Expense | create/update/delete | ✓ | ✗ | ✗ | ✗ | |
| UserProfile | read:public | ✓ | ✓ | ✓ | ✓ | Fields where VisibilityLevel = PUBLIC |
| UserProfile | read:participants | ✓ | ✓ | ✓ | ✓ | + fields where VisibilityLevel = PARTICIPANTS (viewer must be enrolled participant) |
| UserProfile | read:teachers | ✓ | ✓ | ✓ | ✗ | + fields where VisibilityLevel = TEACHERS (viewer must hold TEACHER role at the event) |
| UserProfile | read:organizer | ✓ | ✓ | ✗ | ✗ | All fields regardless of visibility settings (for organizer admin view) |
| UserProfile | update | ✓(any) | ✗ | SELF | SELF | Organizer can update any profile |
| Announcement | create | ✓ | ✓ | ✗ | ✗ | |
| Accommodation | assign | ✓ | ✓ | ✗ | ✗ | |
| EmailCampaign | send | ✓ | ✗ | ✗ | ✗ | |
| Volunteer | manage | ✓ | ✓ | ✗ | ✗ | |
| Tenant | manage | PLATFORM | ✗ | ✗ | ✗ | SiteOwner only |
| Tenant | impersonate | PLATFORM | ✗ | ✗ | ✗ | With re-auth + audit |

**Profile read resolution rule:** `filterProfileByVisibility(profile, viewerHighestScope)` where `viewerHighestScope` is the most permissive read action the viewer holds. Never expose NOBODY-visibility fields regardless of caller role.

**API field sets must match permissions exactly.** A route returning `Participant` for STAFF must not include `email` or `emergencyContact`. Use separate Zod output schemas per permission level — not one schema with optional fields stripped at runtime.

## C2 — Money Rules

- All prices stored as **integers in minor units** (cents for EUR). Currency stored on every money record.
- **Exchange rates:** not supported in v1. All events use one currency, set at event creation. Cannot be changed after first order.
- **VAT rules (v1 scope):**
  - VAT rate stored **immutably at purchase time** on the `OrderItem` (`vatRatePct`). Never recalculated from current config.
  - V1 supports: one VAT rate per event (configured by organizer), or zero-rated.
  - VAT on invoices: `net = grossCents / (1 + vatRatePct)`, `vatAmount = grossCents - net`. Round half-even.
  - B2B reverse charge, multi-country VAT OSS, and per-item VAT rates are **out of scope for v1**. Document this explicitly in ADR-003.
  - Invoices include: tenant name, tenant VAT number (optional), buyer name/address, line items with unit price + VAT, total net, total VAT, total gross, invoice number, issue date, payment date.
- **Invoice numbering:** `{YEAR}-{TENANT_SHORT}-{SEQUENCE}`. Sequence per tenant per year, stored in `InvoiceSequence` table with row-level locking.
  - **Gap policy (business decision — must be confirmed per jurisdiction before go-live):** Most EU countries accept invoice sequences with gaps caused by failed transactions or voids. True gapless sequences require holding a DB lock across the payment confirmation and PDF generation — fragile under failures. V1 implements **gap-tolerant sequential numbering**: sequence increments atomically on invoice creation, but if PDF generation or delivery fails, the invoice record exists with that number and status `FAILED`. A failed invoice number is never reused. This is acceptable under Dutch, Belgian, and most EU B2C invoice rules, but **must be reviewed by the tenant's accountant before use in regulated B2B contexts**. Document this decision in ADR-003 and surface a warning in the organizer onboarding checklist.
- **Payment fees:** processor fees (Stripe/Mollie) are not passed to participants in v1. Stored separately as `processorFeeCents` on the `Payment` record (populated from webhook data) for reporting only.
- **Refund policy engine:** configured per event as an ordered list of rules:
  ```typescript
  type RefundRule = {
    daysBeforeEvent: number; // ≥ this many days before event start
    refundPercent: number;   // 0–100
  };
  // Example: [{daysBeforeEvent: 60, refundPercent: 100}, {daysBeforeEvent: 30, refundPercent: 50}, {daysBeforeEvent: 0, refundPercent: 0}]
  // Rules evaluated in order. First matching rule applies.
  ```
  Refundable amount = `paidCents * (refundPercent / 100)`. Processing fee never refunded.
- **Chargeback handling:** sets `Order.status = CHARGEBACK`. Blocks participant portal access for that order. Organizer notified. Manual resolution required.
- **Ticket reservation expiry:** when a participant starts checkout, a `TicketReservation` record is created with `expiresAt = now() + 15 minutes`. Capacity is held. If payment not completed by expiry, a BullMQ job releases the hold. Race condition handled with a DB-level transaction + `SELECT FOR UPDATE`.
- **Late webhook after reservation expiry:** the payment processor may authorize a charge after the reservation has expired and the capacity hold released. This must be handled explicitly:
  1. Webhook arrives for an order where `TicketReservation.expiresAt` has passed
  2. Before processing: re-check current capacity with `SELECT FOR UPDATE` on `TicketTier`
  3. **If capacity still available:** reinstate reservation, mark order PAID, proceed normally. Audit event: `order.late_webhook_capacity_restored`.
  4. **If capacity no longer available (ticket sold to someone else in the window):** mark payment as `PAID` but order as `REQUIRES_RESOLUTION`. Do NOT fulfill. Queue email to participant explaining the issue and offering a full refund. Queue alert to organizer. Organizer resolves manually (offer refund or manual override if they choose to oversell). Audit event: `order.late_webhook_no_capacity` with full context.
  5. The participant's card has been charged in case 4 — the refund path must be available immediately. Pre-create a `RefundRequest` in `PENDING_ORGANIZER` state so the organizer sees it in their dashboard on login.
- **Teacher compensation:** revenue share calculated on **gross ticket revenue net of VAT, before processor fees, before refunds**. Settled after event end. Payout tracked manually (upload proof of payment). No automated payout in v1.

## C3 — Refund + Cancellation Edge Cases

All of these must have explicit handling — not a generic fallback:

| Scenario | Handling |
|---|---|
| Participant cancels within refund window | Calculate refundable amount via policy engine. Create Stripe refund. Update order status. Queue confirmation email. |
| Participant cancels outside refund window | Return 0 refund. Queue rejection email with policy explanation. |
| Organizer cancels a session | All enrolled participants notified by email. If session was paid add-on (future feature), refund triggered. |
| Organizer cancels entire event | Full refund to all paid participants regardless of refund policy. Manual Stripe batch refund. Organizer notified. |
| Payment fails mid-installment | Order remains PARTIALLY_PAID. Participant notified. Retry allowed within 7 days. After 7 days: organizer notified, participant access reduced to view-only. |
| Chargeback received | Order → CHARGEBACK. Portal access suspended. Organizer notified with Stripe chargeback link. |
| Duplicate webhook received | Idempotency key check. If already processed, return 200 without re-processing. |
| Participant requests transfer to another person | Not supported in v1. Organizer can manually: cancel old order (apply refund policy) + create new registration. Document this. |

## C4 — Accommodation Edge Cases

- **Roommate requests:** free-text field on `EventProfileExtension`. Organizer resolves manually. No automated matching in v1.
- **Gender/preference fields:** collected as free-text ("I prefer to room with women", etc.) — not a structured enum, to avoid making assumptions. Organizer uses this in manual assignment.
- **Overbooking:** not allowed. `capacity` is a hard ceiling. Attempts to assign beyond capacity return a 409 with `UNIT_AT_CAPACITY` error code.
- **Upgrade requests:** participant notes a preference. Organizer handles manually. No automated upgrade queue in v1.
- **Waitlist ordering:** FIFO by `createdAt` of the waitlist enrollment. No priority tiers in v1.

## C5 — GDPR Legal Basis (precise)

Each consent type maps to a specific legal basis under GDPR Article 6:

| Data / Processing | Legal Basis | Notes |
|---|---|---|
| Registration personal data | Art. 6(1)(b) — contract necessity | Required to perform the service |
| Payment data | Art. 6(1)(b) — contract necessity | Required for billing |
| Event communications | Art. 6(1)(b) — contract necessity | Transactional only (receipts, reminders) |
| Marketing emails | Art. 6(1)(a) — consent | Explicit opt-in, separately stored |
| Community directory | Art. 6(1)(a) — consent | Participant controls per-field visibility |
| Photo/video consent | Art. 6(1)(a) — consent | Explicit opt-in at registration |
| Financial records retention | Art. 6(1)(c) — legal obligation | 7 years, anonymized after account deletion |
| Audit logs (security) | Art. 6(1)(f) — legitimate interests | Platform security, capped at 2-year retention |

Consent withdrawal: any consent-based processing can be withdrawn from the participant portal. Withdrawal does not delete data already processed under contract necessity.

## C6 — Auth Hard Rules

**Refresh token rotation:**
- Refresh issues a new token and marks the old one `usedAt`
- Token stored as `bcrypt(token, 10)` hash — never plaintext
- Tokens belong to a `family` (UUID generated at first login)
- If a used token is presented again → entire family revoked → user forced to re-login
- A user can have max 5 active refresh token families (5 concurrent devices)

**Magic links:**
- Max 1 active magic link per user (creating a new one invalidates the previous)
- Expire after 15 minutes
- Single-use (mark `usedAt` immediately on validation, before any other logic)
- `crypto.timingSafeEqual` for comparison
- Rate limit: 3 requests per email per hour (Redis counter, sliding window)
- Token is 32 random bytes, base64url encoded (256 bits of entropy)

**TOTP 2FA:**
- Required for: all ORGANIZER-role users, all PlatformUsers (SiteOwners)
- Optional for: TEACHER, PARTICIPANT
- Backup codes: 8 single-use codes generated at TOTP enrollment, shown once, stored as bcrypt hashes
- **TOTP reset flow (full policy):**
  1. User exhausts backup codes → contacts their tenant's ORGANIZER via email (out-of-band)
  2. ORGANIZER opens admin panel → participant/teacher record → "Reset 2FA" button
  3. Button is only visible on ORGANIZER accounts for TEACHER and PARTICIPANT users
  4. For ORGANIZER resetting their own TOTP: must contact SiteOwner via the platform support page
  5. SiteOwner resets ORGANIZER TOTP via `/apps/platform` → tenant detail → user record → "Reset 2FA"
  6. For SiteOwner TOTP reset: requires a second active SiteOwner to perform the reset. If only one SiteOwner exists, reset requires a signed email from the account owner to a documented support address + 24-hour wait (anti-abuse cooldown)
  7. All TOTP resets are written to `AuditLog` with `action: 'auth.totp_reset'`, actor, target, and timestamp
  8. After reset: user receives email with magic link to re-enroll TOTP. They cannot log in until re-enrollment is complete (for roles where TOTP is required)
  9. **Abuse prevention:** max 3 TOTP reset requests per user per 30 days. Fourth request blocked with error code `AUTH_TOTP_RESET_LIMIT_EXCEEDED` (HTTP 429). SiteOwner can override manually. Corresponding audit event: `security.totp_reset_limit_reached`.

**Impersonation (SiteOwner → Tenant User):**
- Requires re-authentication (SiteOwner re-enters password) via separate endpoint `/api/internal/auth/reauth`
- Issues a short-lived impersonation token (max 60 minutes, non-renewable)
- Impersonation token JWT includes `{ impersonating: true, originalUserId: platformUserId }`
- Impersonation sessions cannot: impersonate further, modify payment/billing data, delete data, export data
- Every API call during impersonation writes to `AuditLog` with `impersonated: true`
- Session ends on: timeout, explicit logout, or any attempt to perform a blocked action

## C7 — Concurrency Rules

These scenarios require explicit database-level concurrency handling:

| Scenario | Mechanism |
|---|---|
| Ticket purchase (capacity) | `SELECT FOR UPDATE` on `TicketTier` within transaction. Reservation record as soft hold. |
| Session enrollment (capacity) | `SELECT FOR UPDATE` on `Session`. |
| Waitlist promotion | Distributed lock via Redis (`SETNX acrofest:waitlist:{sessionId}:lock`) before promotion job runs. |
| Accommodation assignment | `SELECT FOR UPDATE` on `AccommodationUnit`. |
| Installment charging | Idempotency key per installment attempt. Job deduplication via BullMQ `jobId = installmentId`. |
| Invoice number generation | DB sequence per tenant per year (`InvoiceSequence` table with row lock). |
| Refresh token use | `UPDATE ... WHERE usedAt IS NULL AND id = ? RETURNING *`. If 0 rows returned: token already used, revoke family. |

## C8 — Background Job Guarantees

All BullMQ jobs must define:

```typescript
type JobDefinition = {
  name: string;
  attempts: number;          // how many times to retry on failure
  backoff: { type: 'exponential', delay: number }; // ms base delay
  removeOnComplete: number;  // keep last N completed jobs
  removeOnFail: number;      // keep last N failed jobs for inspection
  jobId?: string;            // for deduplication
};
```

Required settings per job type:

| Job | Attempts | Backoff base | Deduplication |
|---|---|---|---|
| send_email | 3 | 2000ms | `email-{userId}-{templateId}-{eventId}` |
| generate_invoice_pdf | 3 | 5000ms | `invoice-{invoiceId}` |
| generate_programme_pdf | 2 | 10000ms | `programme-{eventId}-{version}` |
| promote_waitlist | 1 | — | `waitlist-{sessionId}` (distributed lock) |
| charge_installment | 3 | 3600000ms (1hr) | `installment-{installmentId}` |
| purge_deleted_user | 1 | — | `purge-{userId}` |
| export_user_data | 1 | — | `export-{userId}-{requestId}` |
| generate_social_asset | 2 | 5000ms | — |

Dead-letter queue: jobs exhausting all attempts move to `{jobName}:failed` queue. SiteOwner dashboard shows failed queue depth with ability to retry or discard.

Poison message handling: if a job fails with a non-retryable error code (e.g. `INVALID_TEMPLATE`, `USER_NOT_FOUND`), it should catch and discard rather than exhaust retries. Define `NON_RETRYABLE_CODES` per job type.

## C9 — Schema Conventions (apply to every table)

- All tables: `id String @id @default(cuid())`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`
- Tenant-scoped tables: `@@index([tenantId])` and `@@index([tenantId, id])`
- Event-scoped tables: `@@index([tenantId, eventId])`
- Soft-deletable tables: `deletedAt DateTime?` + `@@index([deletedAt])`. All queries filter `deletedAt: null` unless explicitly fetching deleted records.
- Slug uniqueness: event slugs unique per tenant (`@@unique([tenantId, slug])`). Teacher/participant profile slugs unique globally (`@@unique([slug])`).
- Money fields: suffix `Cents` (e.g. `priceCents`, `refundCents`). Always `Int`.
- Boolean defaults: always explicit (`@default(false)` or `@default(true)`), never implicit.

---

# LAYER D — OUTPUT PROTOCOL

This section defines exactly what to output, when, and at what depth.

## Rule 1 — Contracts Before Code

For each phase, produce in this exact order:
1. **Assumptions** — list any unresolved questions with your chosen resolution and rationale
2. **File tree** — full directory structure for this phase only (not the entire monorepo)
3. **Prisma schema changes** — new or modified models for this phase
4. **Permission matrix entries** — which new resource/action pairs this phase adds (reference Layer C1)
5. **API contracts** — for each new route: method, path, request schema (Zod), response schema (Zod), error codes
6. **Job contracts** — for each new BullMQ job: name, payload type, triggers, guarantees from Layer C8
7. **Test plan** — list of unit tests, integration tests, and E2E tests to be written for this phase

Only after all of the above are produced: generate the implementation code.

## Rule 2 — One Phase Per Session

Build exactly one phase per session. Do not start the next phase until the current phase is complete and confirmed. Phases are listed below.

## Rule 3 — File Output Format

Each file is output as a complete, self-contained code block with the filepath as a comment on line 1:

```typescript
// packages/permissions/src/index.ts
export function hasRole(...) { ... }
```

No truncation. No `// rest of implementation here`. No `// same as above`. If a file is long, output it fully.

## Rule 4 — No Invented Decisions

If a situation arises that Layer C does not cover, do not invent a solution. State: `OPEN DECISION: {description of the gap}` and wait for input before proceeding.

## Rule 5 — Absolute Language Removed

Do not claim outputs are "production-ready", "complete", or "deployable" without qualification. Instead, state: "This phase implements X. Known gaps: Y. Requires review of: Z."

---

## Build Phases

### PHASE 0 — Architecture Foundation
Deliverables: all 5 ADRs in `/docs/adr/`. No code yet.
Purpose: force explicit decisions before a single line is written.

### PHASE 1 — Platform Schema + Tenant Lifecycle
Models: `PlatformUser`, `Tenant`, `TenantPlan`, `InvoiceSequence`.  
Routes: SiteOwner auth, tenant CRUD, plan management.  
Tests: SiteOwner login, tenant creation, plan limit enforcement.

### PHASE 2 — User Identity + Auth System
Models: `User`, `RefreshToken`, `MagicLinkToken`, `ConsentRecord`, `AuditLog`.  
Routes: register, login, magic-link request/validate, refresh, logout, TOTP enroll/verify.  
Packages: `/packages/permissions` with full capability matrix.  
Tests: all auth flows, refresh rotation, family revocation, magic link constraints, role resolution, permission matrix (all 40+ role/resource/action combinations).

### PHASE 3 — Tenant Isolation Middleware
Middleware: `tenantContext` (resolves tenantId from subdomain or custom domain), `requireTenant`, Prisma middleware for tenantId enforcement.  
Tests: cross-tenant data access attempt → 403 + security log. Missing tenant context → hard throw.

### PHASE 4 — Event + Venue Configuration (Module 1)
Models: `Event`, `Venue`, `EventConfig`.  
Routes: full CRUD for both. Publish/unpublish. Clone event.  
Tests: plan limit enforcement (max events), slug uniqueness, clone produces independent copy.

### PHASE 5 — Teacher Management (Module 2)
Models: `UserProfile`, `EventProfileExtension`, `EventMembership` (TEACHER role).  
Routes: invite teacher, accept/decline, profile CRUD, visibility settings update.  
Tests: invite flow, visibility filtering (all 4 roles × all profile fields).

### PHASE 6 — Schedule Builder (Module 3)
Models: `Session`, `SessionTeacher`, `SessionEnrollment`.  
Routes: session CRUD, conflict detection, session clone, iCal export.  
Tests: double-booking detection, capacity enforcement, iCal format correctness.

### PHASE 7 — Payment Pipeline (Module 6)
Models: `TicketTier`, `Addon`, `DiscountCode`, `Order`, `OrderItem`, `Payment`, `Installment`, `TicketReservation`.  
Routes: checkout initiation, Stripe webhook, Mollie webhook, refund request, installment status.  
Packages: `/packages/payments` with Stripe and Mollie adapters.  
Tests: webhook signature verification, idempotency, refund policy engine (all rule configurations), reservation expiry, concurrency (two simultaneous purchases of last ticket), chargeback handling.

### PHASE 8 — Registration Flow (Module 4)
Routes: multi-step registration API (personal info → ticket → addons → payment intent → confirm).  
Models: `EventProfileExtension` (participant fields), `SessionEnrollment`.  
Tests: full registration happy path, waitlist enrollment, CSV import with validation errors.

### PHASE 9 — Profile + Visibility System (Module 5)
Routes: profile read (with visibility filter applied), profile update, visibility settings update, community directory with filtering.  
Tests: visibility matrix tests (all VisibilityLevel × Role combinations), directory respects consent withdrawal.

### PHASE 10 — Financial Dashboard (Module 8)
Routes: revenue summary, expense CRUD, P&L, cash flow forecast, payout tracker.  
Tests: P&L calculation with refunds and chargebacks, VAT extraction from gross amounts, invoice sequence tests:
- sequence increments atomically per tenant per year
- numbers are unique within tenant + year (no duplicates)
- a failed invoice retains its consumed sequence number (number is not recycled)
- the next invoice after a failed one receives the next number in sequence (gap is preserved, not filled)
- sequence resets to 1 at year boundary per tenant

### PHASE 11 — Logistics (Module 7)
Routes: accommodation CRUD + assignment, meal headcounts, shuttle seat management, volunteer shifts, run-of-show generation.  
Tests: overbooking prevention (409), concurrency on last accommodation unit.

### PHASE 12 — Communications (Module 9)
Models: `EmailCampaign`, `Announcement`.  
Routes: campaign CRUD + send, announcement CRUD.  
Jobs: all transactional email jobs with retry/dedup guarantees from Layer C8.  
Tests: email queued on order paid, reminder scheduled correctly, plan limit enforcement on marketing module.

### PHASE 13 — Participant + Teacher Portal (Module 10)
App: `/apps/portal`. All sections. Mobile-first.  
Routes (portal-facing): my schedule, programme browse, enroll/unenroll, my order, data export request, account deletion request.  
Tests: Playwright — registration flow, portal login, schedule enrollment, invoice download.

### PHASE 14 — Public Website (Module 11)
App: `/apps/website`. Tenant-aware runtime rendering with Redis cache.  
Routes: homepage, teachers, programme, practical, register embed.  
Tests: cache invalidation on publish, correct tenant resolved from domain/subdomain.

### PHASE 15 — GDPR Tooling
Jobs: `purge_deleted_user` (30-day grace + hard purge + financial record anonymization), `data_retention_sweep` (nightly).  
Routes:
- `GET /api/v1/jobs/:jobId/status` — generic job status endpoint. Returns `{ jobId, status: 'queued'|'running'|'completed'|'failed', result?: { downloadUrl?, expiresAt? }, error?: string }`. Used by data export and any other async 202 flow. Registered here as the canonical home of this route.
- `GET /api/portal/me/export` (async, 202) — queues `export_user_data` job, returns job envelope
- `DELETE /api/portal/me` (soft delete)

DPA: auto-generated PDF per tenant.  
Tests: export link is single-use and time-limited, hard purge leaves anonymized financial records, consent withdrawal removes from directory immediately, `GET /api/v1/jobs/:jobId/status` returns correct state at each job lifecycle stage, completed export URL expires after 1 hour and returns 410 Gone.

### PHASE 16 — Platform Dashboard (Module 0)
App: `/apps/platform`. SiteOwner UI.  
Features: tenant list, revenue dashboard, feature flags, impersonation, global announcements, security log, Bull-Board embed.  
Tests: impersonation requires re-auth, blocked actions during impersonation, audit log written on every impersonated action.

### PHASE 17 — Observability + Hardening
Add OpenTelemetry instrumentation to all Fastify routes and BullMQ workers.  
Add Sentry to all four apps.  
Add health endpoints.  
Write `/docs/runbooks/backup-restore.md`, `/docs/runbooks/schema-migration.md`, `/docs/runbooks/incident-response.md`.  
Final security pass: confirm all rate limits active, all webhook signatures verified, all file uploads validated, all plan limits enforced at all six enforcement points.

---

## Start Instruction

Begin with **PHASE 0** only.

Output the five ADRs. No code. No schema. No file tree for code. Just the five decision documents.

After each ADR, pause and state: `ADR complete. Confirm to proceed to next ADR or flag any decision for revision.`

After all five ADRs are confirmed, state: `Phase 0 complete. Ready for Phase 1. Confirm to proceed.`

Do not proceed to Phase 1 without explicit confirmation.
