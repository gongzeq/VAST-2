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
  | { kind: 'running'; currentStepId: string }
  | { kind: 'partial_success'; failedSteps: FailedStepSummary[] }
  | { kind: 'success' };
```

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
