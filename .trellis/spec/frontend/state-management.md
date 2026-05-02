# State Management

> How state is managed in this project.

---

## Overview

State must be classified by trust boundary and lifetime. The frontend handles highly dynamic server state, route state, operator-only local UI state, and short-lived sensitive visibility state. Do not mix them into one global store.

---

## State Categories

- **Server state**
  - task detail, step progress, dashboard metrics, asset lists, audit events, log events, reports, provider/tool configuration
- **Local component state**
  - form inputs, expanded panels, dialog open/close, temporary filters not reflected in URL
- **URL state**
  - table filters, selected time windows, selected asset group, pagination, sort order
- **Global app state**
  - authenticated actor context, theme, active workspace shell state, feature-level polling preferences
- **Sensitive temporary state**
  - cleartext reveal timers, one-time export-password display, confirmation intent that must not persist beyond the current interaction

---

## When to Use Global State

Promote state to global only if all conditions are true:

- it is needed by multiple top-level features
- it is not already best modeled as server state
- it is safe to keep in memory beyond a single component lifecycle

Good global state:

- current actor/session summary
- shared layout controls
- dashboard auto-refresh preference

Bad global state:

- task step results
- raw report content
- log-event query results
- temporary cleartext secret visibility

---

## Server State

- Server state must be cached by stable query key and invalidated by domain action.
- Use optimistic updates only for low-risk UI metadata changes; do not use optimistic updates for confirmation-sensitive execution, audit writes, or sensitive export state.
- Derived views such as dashboard summaries must be computed from server responses or memoized selectors, not copied into secondary stores.
- Task detail polling should stop when the task reaches a terminal state unless the page explicitly requests historical refresh.
- Sensitive temporary visibility windows must be driven by authoritative server timestamps when applicable.

### Sensitive Temporary State Rules

- Never persist cleartext reveal state to local storage, session storage, URL params, or shared global stores.
- One-time export passwords may be displayed in memory only for the active dialog/session and must be discarded when the dialog closes or route changes.
- If the backend marks the visibility/export window expired, the frontend must clear any cached sensitive display immediately.

---

## Common Mistakes

### Common Mistake: Copying server state into a global store for convenience

**Problem**: task detail and dashboard data drift from the source query and become hard to invalidate correctly.

**Better**: keep server state in the query cache and derive view state near the consumer.

### Common Mistake: Persisting sensitive temporary state

**Problem**: a cleartext reveal timer or one-time password survives refresh/navigation.

**Better**: keep sensitive temporary state in volatile memory only and clear it aggressively.

### Common Mistake: Encoding too little in URL state

**Problem**: filtered audit/log/dashboard views cannot be shared or recovered after navigation.

**Better**: place non-sensitive filters, sort, pagination, and time windows in the URL.
