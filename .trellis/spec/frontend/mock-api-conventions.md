# Mock API Conventions (MSW Layer)

> Conventions for the frontend mock API layer used during dev and tests. Authoritative until the real backend HTTP server lands.

---

## Overview

The frontend currently consumes its data through **MSW v2** (`msw` browser worker for `npm run dev`, `setupServer` for Vitest). Every API endpoint a real HTTP server will eventually expose has a matching mock handler. The mock layer is not "throwaway" — it is the contract enforcement seam between frontend and backend until the real server lands. When a sibling task introduces real HTTP, the swap is a one-flag change (`VITE_USE_MSW=false`), not a rewrite.

---

## File Layout

```
web/src/app/msw/
├── db.ts                # in-memory mutable store + resetDb()
├── worker.ts            # browser worker (DEV-only)
├── server.ts            # Vitest server (test-only)
├── index.ts             # barrel
├── fixtures/            # deterministic fixtures (tasks, asset-groups, etc.)
│   └── *.ts
└── handlers/
    ├── _helpers.ts      # shared response builders (errorResponse, requirePermission, ...)
    ├── auth-handlers.ts
    ├── task-handlers.ts
    ├── asset-group-handlers.ts
    ├── discovered-asset-handlers.ts
    └── index.ts         # exports flat handler array
```

Every handler reads/writes the same `MswDb` instance so cross-handler integration tests see consistent state (e.g., `POST /discovered-assets/:id/confirm` mutates `db.assetGroups[g].whitelistEntries` and the next `GET /asset-groups/:id` call returns the new entry).

---

## Convention: Validate every response through the mirrored zod schema

Before returning a response, run it through the matching schema from `web/src/shared/contracts/`:

```ts
// Good
const body = taskRecordSchema.parse(buildTaskRecord(params));
return HttpResponse.json(body);

// Bad — silent drift if a fixture key is wrong
return HttpResponse.json(buildTaskRecord(params));
```

Why: a mock that drifts from the schema breaks the production swap-in. Parsing here is the same boundary check the real client (`fetchJson`) does — keeping both sides honest.

Errors must use the shared `apiErrorResponseSchema` shape (snake_case `error_code` / `task_state` / `request_id`, `errorCode ∈ DomainErrorCode`):

```ts
return errorResponse({
  status: 403,
  errorCode: 'AUTHORIZATION_DENIED',
  message: 'Missing task:cancel permission',
});
```

The `errorResponse(...)` helper in `_helpers.ts` is the only place that returns 4xx/5xx responses — keeps the snake_case casing centralized.

---

## Convention: One in-memory db, reset per test

`db.ts` exports a mutable `MswDb` plus `resetDb()`:

```ts
export type MswDb = {
  actor: ActorContext | null;
  tasks: Map<TaskId, TaskRecord>;
  assetGroups: Map<AssetGroupId, AssetGroup>;
  whitelistEntries: Map<AssetGroupId, AssetWhitelistEntry[]>;
  discoveredAssets: Map<DiscoveredAssetId, DiscoveredAssetRecord>;
};

export const db: MswDb = createSeededDb();
export const resetDb = () => Object.assign(db, createSeededDb());
```

Test setup (`tests/setup.ts`) wires:

```ts
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();   // drop per-test overrides
  resetDb();                // restore deterministic seed
});
afterAll(() => server.close());
```

`onUnhandledRequest: 'error'` is intentional — an unmocked endpoint is a test failure, not a silent network call.

---

## Convention: Per-test handler override via `server.use(...)`

Tests that need a non-seeded shape do NOT mutate `db` directly. They override the specific endpoint:

```ts
import { server } from '@/app/msw/server';
import { http, HttpResponse } from 'msw';

it('renders blocked when authorization denied', async () => {
  server.use(
    http.get('/api/tasks/:taskId', () =>
      errorResponse({ status: 403, errorCode: 'AUTHORIZATION_DENIED', message: '...' })
    ),
  );
  // ... render and assert
});
```

The override is dropped by `server.resetHandlers()` in `afterEach`. Never mutate `db` from inside a test — that hides the override and breaks isolation.

---

## Convention: Lifecycle progression demos

For tests that need to observe stage transitions (e.g., the polling integration test), reserve a dedicated **demo task ID** in fixtures (e.g., `task_running_demo`). The handler advances that task's `lifecycleStage` on each successive read:

```ts
// pseudocode in task-handlers.ts
if (taskId === 'task_running_demo') {
  const next = nextDemoStage(db.tasks.get(taskId)!.lifecycleStage);
  db.tasks.set(taskId, { ...current, lifecycleStage: next });
}
```

Other task IDs return their seeded record verbatim — no surprise mutations on regular reads.

---

## Convention: Permission gating in handlers

Handlers that require a permission point check the in-memory actor:

```ts
const actor = db.actor;
if (!actor || !actor.permissionPoints.includes('task:cancel')) {
  return errorResponse({ status: 403, errorCode: 'AUTHORIZATION_DENIED', message: 'Missing task:cancel' });
}
```

Why this matters even for mocks: the UI's `use-can-*` hooks gate buttons, but the mock must also reject unauthorized writes — otherwise tests that verify "viewer cannot cancel" pass falsely.

---

## Convention: Worker bootstrap in `main.tsx`

```ts
if (import.meta.env.DEV && import.meta.env.VITE_USE_MSW !== 'false') {
  const { worker } = await import('./app/msw/worker');
  await worker.start({ onUnhandledRequest: 'warn' });
}
```

Production builds tree-shake the entire MSW import via dynamic-import + `import.meta.env.DEV` guard. Setting `VITE_USE_MSW=false` lets a developer point dev at a real local backend without code changes.

---

## Forbidden Patterns

- Returning JSON without running it through the mirrored schema (silent drift risk).
- Mutating `db` from a test (use `server.use(...)` overrides instead).
- Running mocks against production builds (the dynamic import + `DEV` guard prevents this; do not bypass).
- Letting any handler return Node-only types (e.g., `Buffer`, `Date` not pre-serialized) — handlers must return JSON-serializable payloads that match the zod schema's expected shape.
- Sharing handler arrays across packages — each frontend package owns its own `handlers/` tree.

---

## Required Tests

For every handler:

- A round-trip test in `tests/unit/msw-handlers.test.ts` that `fetch()`es the endpoint and asserts the response parses through the matching zod schema.
- For error paths: a test that confirms the response parses through `apiErrorResponseSchema` and the `error_code` matches the expected `DomainErrorCode`.

For every workflow that spans multiple handlers (e.g., login → task-intent → confirm → task-detail), an integration test in `tests/integration/` that exercises the full flow against the seeded `db` and asserts the final UI state.

---

## When the real HTTP server lands

The future integration task (`05-02-integration-and-quality-verification` or its successor) will:

1. Add the real backend HTTP layer (Hono / Fastify) wrapping the existing `src/modules/*` services.
2. Set `VITE_USE_MSW=false` in `.env.production` (and conditionally in `.env.development.local`).
3. Run a `contracts-parity` script that diffs `web/src/shared/contracts/*` against `src/shared/contracts/*` + `src/modules/**/contracts/*` to confirm zero drift.
4. Keep the MSW handler tree in place for unit/integration tests — Vitest still uses `setupServer`, only the dev runtime swaps.
