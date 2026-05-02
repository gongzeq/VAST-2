# Hook Guidelines

> How hooks are used in this project.

---

## Overview

Hooks should encapsulate domain interaction patterns, not hide business meaning. In this project, the most important hooks are task-plan preview, task execution status polling, permission-aware actions, dashboard refresh, and temporary sensitive visibility windows.

---

## Custom Hook Patterns

- Create hooks around domain actions or queries, not generic transport wrappers.
- Separate read hooks from mutation hooks.
- Hooks that imply policy requirements must expose that state explicitly.

Examples:

- `use-task-plan-preview()`
- `use-submit-clarification-answer()`
- `use-task-execution-status(taskId)`
- `use-can-reveal-weak-password(taskId)`
- `use-dashboard-metrics(refreshIntervalMs)`
- `use-log-source-form()`

Return shape should prioritize domain semantics:

```ts
{
  data,
  isLoading,
  isRefreshing,
  error,
  requiresConfirmation,
  canExecute,
  expiresAt
}
```

---

## Data Fetching

- Use a server-state library for all backend-backed task, asset, dashboard, audit, and configuration data.
- Query keys must include the domain boundary and scope identifier:
  - `['task-detail', taskId]`
  - `['dashboard-metrics', assetGroupId, timeWindow]`
  - `['log-events', sourceId, filters]`
- Poll only where the PRD implies near-real-time behavior:
  - task execution status
  - dashboard metrics
  - temporary visibility windows
- Default dashboard polling interval should align with the PRD's 60-second refresh requirement unless the page explicitly opts into a tighter operator view.
- Never poll for data the actor lacks permission to view.

---

## Naming Conventions

- All hooks must start with `use-` in file names and `use` in exports.
- Name hooks after the business capability, not the HTTP verb:
  - Good: `use-export-report`
  - Bad: `use-post-report`
- For permission hooks, use boolean phrasing:
  - `use-can-export-report`
  - `use-can-view-audit-log`
- For timer/expiry hooks, include the time semantics in the name:
  - `use-cleartext-visibility-window`

---

## Common Mistakes

### Common Mistake: Hiding confirmation requirements inside mutation side effects

**Problem**: a mutation hook submits an execution request and only later discovers confirmation was required.

**Better**: expose `requiresConfirmation` and related preview state before the final execute action is called.

### Common Mistake: Polling masked and sensitive resources with the same cadence

**Problem**: hooks refresh high-sensitivity data more broadly than necessary.

**Better**: gate sensitive polling by permission, explicit user action, and expiry window.

### Common Mistake: Using one generic `useApi` hook for everything

**Problem**: task, audit, dashboard, and export flows lose domain semantics and become hard to review.

**Better**: build domain-named hooks over shared transport helpers.
