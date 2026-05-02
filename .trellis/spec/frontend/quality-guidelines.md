# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

The frontend is responsible for faithfully representing security boundaries defined by the backend. Quality means the UI must not imply that blocked tasks ran, that masked data is safe to display, or that confirmation-sensitive actions can proceed silently.

---

## Forbidden Patterns

- Rendering sensitive or masked values without a clear visual distinction
- Auto-submitting high-risk actions from preview UI without an explicit confirmation step
- Hiding authorization failures as empty states when the user should see a policy/permission message
- Persisting temporary cleartext visibility state outside volatile memory
- Duplicating task-state or permission-point string literals across components
- Letting dashboard widgets mutate operational state directly
- Using chart-only rendering with no textual summary for critical metrics

---

## Required Patterns

- Represent `BLOCKED`, `NEEDS_CLARIFICATION`, `PARTIAL_SUCCESS`, `FAILED`, `CANCELLED`, and `SUCCESS` as distinct UI states.
- Surface confirmation requirements before execute actions, especially for YOLO edge cases and `HIGH` intensity operations.
- Show masking/visibility badges and explanatory text wherever data is redacted or time-limited.
- Keep dashboard, task detail, and export views aligned with backend permission gates.
- Provide empty/loading/error states that explain whether absence of data is expected, unauthorized, or a system issue.

---

## Testing Requirements

- Component tests
  - task-state rendering branches
  - masked vs cleartext display states
  - confirmation dialog content and button gating
- Integration tests
  - task console clarification -> preview -> confirmation flow
  - task detail partial-success rendering
  - weak-password temporary reveal expiry behavior
  - log-analysis page shows redacted data only
- E2E tests
  - blocked task cannot proceed to execution UI
  - high-intensity action requires explicit confirmation
  - dashboard refreshes on the expected interval and still provides textual summaries

### Minimum Assertions

- A blocked response renders a blocked UI state, not an empty result.
- A clarification response renders questions and prevents execution.
- A masked weak-password/report/log field is never shown as cleartext without the correct permission and active window.
- A one-time export password disappears after dialog close/navigation.

---

## Code Review Checklist

- Does the UI reflect backend task states and permission gates explicitly?
- Is any sensitive or masked data accidentally rendered, cached, or persisted?
- Are confirmation-sensitive actions separated from preview/browse actions?
- Do dashboard and tables present text summaries alongside charts or visual states?
- Are query keys/state boundaries aligned with the domain model rather than generic widget concerns?
- Do tests cover policy and masking behavior, not only the happy path?
