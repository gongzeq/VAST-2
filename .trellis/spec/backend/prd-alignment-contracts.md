# PRD Alignment Contracts

> Executable backend code-spec for contract parity, runtime boundaries, and quality gates discovered during PRD alignment.

## Scenario: Permission Point Parity

### 1. Scope / Trigger

- Trigger: Frontend PRD work introduced frontend-first permission points ahead of backend contract updates.
- Applies to `src/shared/contracts/foundation.ts` and `web/src/shared/contracts/foundation.ts`.

### 2. Signatures

- Backend export: `permissionPoints: readonly string[]`
- Frontend mirror: `permissionPoints: readonly string[]`
- Schema: `permissionPointSchema = z.enum(permissionPoints)`

### 3. Contracts

- Backend is the canonical runtime contract.
- Frontend may mirror but must not introduce a permission point without a parity test and explicit backend update in the same remediation.
- Canonical permission spellings for current MVP:
  - `task:create`
  - `task:confirm`
  - `task:cancel`
  - `task:yolo_execute`
  - `asset_scope:manage`
  - `audit_log:view`
  - `raw_evidence:view`
  - `report:export`
  - `weak_password:cleartext_view`
  - `weak_password:cleartext_export`
  - `log_source:manage`
  - `log_event:export`
  - `dashboard:view`
  - `llm_provider:manage`
  - `tool_config:manage`
  - `kill_switch:operate`

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Actor lacks permission | throw/return `AUTHORIZATION_DENIED` |
| Frontend permission tuple differs from backend | parity test fails |
| PRD says `asset_group:manage` but code uses `asset_scope:manage` | keep code on `asset_scope:manage`; document migration separately if needed |

### 5. Good/Base/Bad Cases

- Good: Adding `audit_log:export` updates backend tuple, frontend tuple, role fixtures, and parity tests in one change.
- Base: A frontend page checks an existing permission point through `useCan*` hooks.
- Bad: Frontend adds a permission point with a TODO while backend rejects it.

### 6. Tests Required

- Backend/frontend permission tuple parity test.
- Role preset tests for security-engineer, admin, auditor, and viewer.
- Authorization denial test for every newly protected backend service or MSW handler.

### 7. Wrong vs Correct

#### Wrong

```ts
// Frontend-only permission point.
export const permissionPoints = ['task:create', 'llm_provider:manage'] as const;
```

#### Correct

```ts
// Backend and frontend tuples are kept identical and verified by tests.
expect(frontendPermissionPoints).toEqual(backendPermissionPoints);
```

## Scenario: Package Test Boundaries

### 1. Scope / Trigger

- Trigger: root `npm test` collected frontend tests without the web Vite alias config.
- Applies to root Vitest execution and web Vitest execution.

### 2. Signatures

- Root script: `npm test`
- Web script: `cd web && npm run test`

### 3. Contracts

- Root tests cover backend files under `src/tests/**/*.test.ts`.
- Web tests cover frontend files under `web/src/**/*.test.{ts,tsx}` using `web/vite.config.ts`.
- Root `npm test` must not depend on the frontend `@/` alias.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Root Vitest run sees `web/src/tests` | fail the quality gate until scoped |
| Web Vitest run lacks `@/` alias | fix `web/vite.config.ts`, not root tests |
| New cross-package parity test is needed | place it where aliases/imports are explicit and stable |

### 5. Good/Base/Bad Cases

- Good: root Vitest include pattern is `src/**/*.test.ts`.
- Base: web Vitest include pattern remains `src/**/*.{test,spec}.{ts,tsx}` inside `web/`.
- Bad: Root test passes only because frontend tests were renamed or hidden.

### 6. Tests Required

- `npm test` from repo root.
- `cd web && npm run test`.

### 7. Wrong vs Correct

#### Wrong

```json
{ "test": "vitest run" }
```

when the repo contains multiple Vitest projects with incompatible aliases.

#### Correct

```json
{ "test": "vitest run \"src/**/*.test.ts\"" }
```

or an equivalent root Vitest config that scopes backend tests.

## Scenario: Tool Runtime Boundary

### 1. Scope / Trigger

- Trigger: Platform PRD calls for Docker-backed scanner execution; current backend has a generic runtime interface and a mock implementation.

### 2. Signatures

- Interface: `ExecutionRuntime.execute(command: string[], timeoutSeconds: number, signal?: AbortSignal)`
- Service: `ToolRunnerService.execute(request, actor, toolVersion)`

### 3. Contracts

- `ToolRunnerService` must keep command construction argv-based.
- Runtime implementations must preserve timeout, cancellation, stdout/stderr hashing, and audit behavior.
- Docker runtime remains a follow-up unless this task explicitly implements it; tests must not pretend mock runtime is Docker.

### 4. Validation & Error Matrix

| Runtime result | Tool status |
|---|---|
| exit code `0` | `SUCCESS` |
| non-zero exit code | `FAILED` |
| timeout | `TIMEOUT` |
| abort by user/kill switch | `CANCELLED` |

### 5. Good/Base/Bad Cases

- Good: Docker runtime is injected behind `ExecutionRuntime` with the same tests as mock runtime.
- Base: Mock runtime stays used in unit tests.
- Bad: Direct shell string execution bypasses `ToolRunnerService`.

### 6. Tests Required

- Unit tests for timeout/cancel/failure/success status mapping.
- If Docker runtime is added, integration test must prove argv handling and mounted workdir behavior.

### 7. Wrong vs Correct

#### Wrong

```ts
child_process.exec(`${tool} ${args.join(' ')}`);
```

#### Correct

```ts
runtime.execute(commandArgv, timeoutSeconds, abortController.signal);
```
