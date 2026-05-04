# Type Safety

> Type safety patterns in this project.

---

## Overview

Frontend types must mirror backend contracts closely because this product depends on exact task states, permission points, masking rules, and dashboard data categories. Type safety here is not cosmetic; it prevents the UI from misrepresenting blocked actions, partial success, or sensitive data visibility.

---

## Type Organization

- Put shared API/domain contracts in `shared/contracts/` or feature-local `contracts/` folders.
- Keep component-only presentational props local to the component file when they are not reused.
- Do not create catch-all `types.ts` files at app root.
- Use backend-aligned enums/unions for:
  - task state
  - discovered asset state
  - execution intensity
  - permission point
  - report/export state

Example contract categories:

- `task-plan.contract.ts`
- `task-state.contract.ts`
- `dashboard-metrics.contract.ts`
- `log-event.contract.ts`
- `weak-password.contract.ts`

---

## Backend Contract Mirroring (Cross-Layer)

### Convention

Frontend must NOT import zod schemas or types directly from the backend `src/` tree. The backend is Node-only (uses `crypto.randomUUID`, `structuredClone`, file/network APIs). Importing it pulls Node code into the browser bundle and breaks Vite builds.

Instead, copy the relevant zod schemas verbatim into `web/src/shared/contracts/*.ts`. Field names and enum values MUST match the backend exactly.

### Mirror Source Map

Always derive frontend contracts from these backend authoritative sources:

| Backend file | Frontend mirror |
|---|---|
| `src/shared/contracts/foundation.ts` | `web/src/shared/contracts/foundation.ts` |
| `src/shared/contracts/api-error-response.ts` | `web/src/shared/contracts/api-error-response.ts` (snake_case fields preserved: `error_code`, `task_state`, `request_id`) |
| `src/modules/auth/contracts/actor-context.contract.ts` | `web/src/shared/contracts/actor-context.contract.ts` (add zod runtime parse — backend version is type-only) |
| `src/modules/asset-scope/contracts/*.contract.ts` | `web/src/shared/contracts/asset-*.contract.ts` |
| `src/modules/task-planning/contracts/task-plan.contract.ts` | `web/src/shared/contracts/task-plan.contract.ts` |
| `src/modules/task-execution/contracts/task-execution.contract.ts` | `web/src/shared/contracts/task-execution.contract.ts` |

UI-only schemas (e.g., `task-intent.contract.ts` for the mock LLM endpoint, `task-list-filter.contract.ts` for URL state, `assetGroupSchema` aggregate) live alongside mirrors but have no backend counterpart — annotate them as `// UI-only` at the top.

### Why this works

- Browser bundle stays Node-free.
- Frontend gets full type safety without TS path tricks or build-time codegen.
- `npm install` in `web/` doesn't pull backend dependencies.

### Drift risk + mitigation

Backend schema changes can silently desync the mirror. Mitigation:

1. **Manual review on backend contract changes** — any PR that edits a file in the Mirror Source Map above must update the matching `web/src/shared/contracts/` file in the same PR.
2. **Parity script** — owned by the integration sibling task (`05-02-integration-and-quality-verification`): a `scripts/contracts-parity.ts` that imports both sides via TS and asserts each enum array, each `*Schema.shape`, and each branded ID set is identical. Runs in CI.
3. **Zod parse at the boundary** — every MSW handler response and every real `fetch` response must go through the mirrored schema's `.parse()` (see `mock-api-conventions.md`). A schema that drifted from backend will surface as a `ZodError`, not a silent miscoercion.

### Forbidden

- `import { ... } from '../../../src/...'` in any `web/src/**` file.
- Hand-typing types whose values exist as zod enums on the backend (use the mirror).
- Re-exporting backend types from the frontend root barrel.

---

## Validation

- Validate all non-trivial backend payloads at the API boundary with a runtime schema library.
- Parse query params and URL state through schemas before using them in queries.
- Treat unknown enum values from backend as recoverable rendering errors and surface a safe fallback state rather than coercing them silently.
- Validate sensitive expiry metadata, confirmation requirements, and permission-gated payload shapes explicitly.

---

## Common Patterns

- Prefer discriminated unions for task and export state:

```ts
type TaskExecutionViewState =
  | { kind: 'needs_clarification'; questions: ClarificationQuestion[] }
  | { kind: 'blocked'; reason: string }
  | { kind: 'awaiting_confirmation'; plan: TaskPlanStep[]; intensity: ExecutionIntensity; yoloRequested: boolean }
  | { kind: 'running'; currentStepId: string | null; steps: TaskStepResult[] }
  | { kind: 'partial_success'; failedSteps: FailedStepSummary[]; successfulSteps: TaskStepResult[] }
  | { kind: 'success'; steps: TaskStepResult[] }
  | { kind: 'cancelled'; cancelledAt: string };
```

- Pair every domain discriminated union with a **selector function** that derives the variant from a primary backend record (`TaskRecord`, `DiscoveredAssetRecord`, etc.). Example:

```ts
// shared/contracts/task-execution-view-state.ts
export const selectTaskExecutionViewState = (record: TaskRecord): TaskExecutionViewState => {
  if (record.state === 'BLOCKED') return { kind: 'blocked', reason: deriveReason(record) };
  if (record.lifecycleStage === 'AWAITING_CLARIFICATION') return { kind: 'needs_clarification', questions: record.clarifications.filter(c => c.answer === null) };
  if (record.lifecycleStage === 'AWAITING_CONFIRMATION') return { kind: 'awaiting_confirmation', plan: record.steps, intensity: record.requestedIntensity, yoloRequested: record.yoloRequested };
  if (record.state === 'PARTIAL_SUCCESS') return { kind: 'partial_success', failedSteps: record.steps.filter(s => s.executionStatus === 'FAILED'), successfulSteps: record.steps.filter(s => s.executionStatus === 'SUCCESS') };
  if (record.state === 'CANCELLED') return { kind: 'cancelled', cancelledAt: record.updatedAt };
  if (record.state === 'SUCCESS') return { kind: 'success', steps: record.steps };
  return { kind: 'running', currentStepId: pickCurrent(record.steps), steps: record.steps };
};
```

Components consume the selector output instead of branching on `record.lifecycleStage` × `record.state` themselves. This keeps:

- Branch logic centralized and unit-testable (one fixture per variant).
- Components focused on rendering one shape (`switch (view.kind)` exhaustive).
- Future variants additive (add to the union → TS exhaustiveness errors point at every consumer).

- Use branded/opaque ID aliases for externally meaningful identifiers where supported:
  - `TaskId`
  - `AssetGroupId`
  - `SourceId`
  - `IngestRef`
- Model masked vs cleartext-sensitive values as distinct types instead of optional strings when possible.

---

## Forbidden Patterns

- `any` for domain payloads
- unchecked type assertions on API responses
- string literals duplicated across features for task states or permission points
- representing masked and cleartext values with the same unconstrained string type when the distinction matters to rendering logic
- swallowing unknown backend fields into `Record<string, unknown>` and then reading them ad hoc in components
