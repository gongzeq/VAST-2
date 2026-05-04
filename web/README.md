# 智能网络安全分析平台 — Web 前端

This is the **frontend** package for the internal security operations console. It is an independent npm package alongside the backend (`../src`), built with Vite + React 18 + TypeScript strict + TanStack Query v5 + React Router v6 + Tailwind v3 + MSW v2 + Zod.

The PRD lives at `../.trellis/tasks/05-02-frontend-task-console-and-scope/prd.md`. The frontend specs live in `../.trellis/spec/frontend/`.

> **No backend HTTP server exists yet.** All API calls in this package are intercepted by **MSW**. The handlers parse responses through the same zod schemas the components consume so the contract is enforced end-to-end.

---

## Quick start

```bash
cd web
npm install
npm run dev      # starts Vite at http://localhost:5173 with MSW enabled
```

Open `/login`, pick any of the four preset roles (`security-engineer`, `admin`, `auditor`, `viewer`) and explore the six pages.

---

## Available scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server with MSW worker auto-starting (`import.meta.env.DEV`). Disable MSW with `VITE_USE_MSW=false`. |
| `npm run build` | TypeScript project build + Vite production bundle into `dist/`. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run test` | Vitest run (jsdom + RTL + MSW server). |
| `npm run lint` | ESLint (`@typescript-eslint`, `react-hooks`). |

---

## Pages

| Route | Page |
|---|---|
| `/login` | Mock login form with role select |
| `/` | Task console (NL prompt → clarifications → plan preview → confirm) |
| `/tasks` | Task list (filters / sort / page in URL state) |
| `/tasks/:taskId` | Task detail with 5 s polling that stops at terminal stage |
| `/asset-scope` | Asset groups + whitelist entries |
| `/asset-scope/discovered` | Discovered-asset queue (confirm / reject) |

The router redirects unauthenticated visitors to `/login`.

---

## Actor switcher (dev only)

In the authenticated header you'll find a **DEV 角色** select. Picking a role rebuilds the in-memory `ActorContext` immediately and persists it to `sessionStorage`. All `useCan*` hooks recompute, hiding/showing buttons and views per the new permission set.

Permission point bundles (mirroring `../src/shared/contracts/foundation.ts`):

| Role | Points |
|---|---|
| `security-engineer` | `task:create`, `task:confirm`, `task:cancel`, `task:yolo_execute` |
| `admin` | `asset_scope:manage`, `audit_log:view`, `log_source:manage` |
| `auditor` | `audit_log:view` |
| `viewer` | (none) |

---

## MSW handlers

16 endpoints are implemented in `src/app/msw/handlers/`. Every successful response is parsed through the corresponding zod schema before being returned. Error responses use the shared `ApiErrorResponse` shape (`error_code` ∈ `DomainErrorCode`, `message`, optional `task_state`, `details`, `request_id`).

| # | Method | Path |
|---|---|---|
| 1 | POST | `/api/auth/session` |
| 2 | GET | `/api/auth/session` |
| 3 | DELETE | `/api/auth/session` |
| 4 | POST | `/api/tasks/intent` |
| 5 | POST | `/api/tasks` |
| 6 | GET | `/api/tasks` |
| 7 | GET | `/api/tasks/:taskId` |
| 8 | POST | `/api/tasks/:taskId/clarifications/:clarificationId/answer` |
| 9 | POST | `/api/tasks/:taskId/confirmations` |
| 10 | POST | `/api/tasks/:taskId/cancel` |
| 11 | GET | `/api/asset-groups` |
| 12 | GET | `/api/asset-groups/:groupId` |
| 13 | POST | `/api/asset-groups/:groupId/whitelist-entries` |
| 14 | GET | `/api/discovered-assets` |
| 15 | POST | `/api/discovered-assets/:assetId/confirm` |
| 16 | POST | `/api/discovered-assets/:assetId/reject` |

### Overriding handlers in tests

```ts
import { http, HttpResponse } from 'msw';

import { server } from '@/app/msw/server';

server.use(
  http.get('/api/tasks/:taskId', ({ params }) =>
    HttpResponse.json({ /* … */ }, { status: 200 }),
  ),
);
```

`afterEach` in `src/tests/setup.ts` calls `server.resetHandlers()` and `resetDb()` so each test starts from the seeded fixtures.

---

## State boundaries (per `state-management.md`)

- **Server state** (TanStack Query): tasks, task detail, asset groups, discovered assets, sessions.
- **URL state**: `/tasks` filters, `/asset-scope/discovered` state filter.
- **Local component state**: dialog open/close, prompt input, in-flight clarification text.
- **Global app state**: `ActorContext` only. Stored in React Context + sessionStorage, never copied into TanStack Query.
- **Sensitive temporary state**: not used in this task; the next sibling task introduces it.

---

## Type safety

- `src/shared/contracts/*.ts` mirrors backend contracts (`taskState`, `taskLifecycleStage`, `permissionPoint`, `workflowType`, `taskPlanStep`, `taskRecord`, `assetTarget`, `discoveredAsset`, `actorContext`, `domainErrorCode`).
- `TaskExecutionViewState` is a 7-variant discriminated union; `selectTaskExecutionViewState(record)` derives it from a `TaskRecord`.
- Branded ID aliases: `TaskId`, `AssetGroupId`, `DiscoveredAssetId`, `ClarificationId`.
- `fetchJson(url, schema)` is the only network entrypoint; on schema failure it throws `UnknownStateError` so pages can render a recovery view rather than crash.

---

## Out of scope (explicit)

Per the PRD this task does **not** implement:

- Vulnerability / weak-password / phishing-mail / log-analysis / dashboard / audit / admin pages
- Real HTTP server / real LLM provider
- E2E tests (only directory placeholder; lives in `05-02-integration-and-quality-verification`)
- i18n library, dark mode, real SSO
- WebSocket / SSE
- Weak-password cleartext UI / one-time export password display
