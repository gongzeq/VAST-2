# Directory Structure

> How frontend code is organized in this project.

---

## Overview

The frontend is a security-operations console. Organize it by user workflow and domain, not by generic UI artifact type alone. Task creation, clarification, sensitive evidence visibility, dashboard views, and admin configuration all have different authorization and data-shape requirements and should remain explicit in the directory structure.

Prefer feature-first folders with small shared UI foundations.

---

## Directory Layout

```
src/
├── app/
│   ├── router/
│   ├── providers/
│   └── layouts/
├── features/
│   ├── task-console/
│   ├── task-detail/
│   ├── asset-scope/
│   ├── vulnerability/
│   ├── weak-password/
│   ├── phishing-mail/
│   ├── log-analysis/
│   ├── reports/
│   ├── dashboard/
│   ├── audit/
│   └── admin-settings/
├── shared/
│   ├── api/
│   ├── components/
│   ├── hooks/
│   ├── contracts/
│   ├── utils/
│   ├── auth/
│   └── formatting/
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## Module Organization

Each feature should follow this internal shape where applicable:

```text
features/<feature>/
├── components/
├── hooks/
├── api/
├── state/
├── contracts/
└── routes/
```

Guidelines:

- Put route-specific composition inside the owning feature.
- Keep table columns, card sections, timeline renderers, and confirmation dialogs close to the feature that owns them.
- Promote a component to `shared/components/` only after it is reused across at least three features with the same semantics.
- Keep permission gating helpers in `shared/auth/`, not duplicated inside each page.

### Feature Ownership

- `task-console/`
  - natural-language input, clarification prompts, plan preview, YOLO toggle, confirmation entry
- `task-detail/`
  - task state, step timeline, evidence references, partial-success presentation
- `asset-scope/`
  - asset groups, whitelist entries, discovered asset confirmation/rejection
- `weak-password/`
  - masked findings, temporary cleartext visibility, export action timing
- `log-analysis/`
  - log source management, redacted event tables, trend drill-down
- `dashboard/`
  - aggregate metrics only; do not embed feature-specific mutation logic here
- `admin-settings/`
  - provider config, tool config, kill switch, mail/log source configuration

---

## Naming Conventions

- Use kebab-case for folders and file names.
- Name route files after the user-facing surface:
  - `task-console-page.tsx`
  - `asset-scope-page.tsx`
- Name hooks after the domain action or query:
  - `use-task-plan-preview.ts`
  - `use-discovered-assets.ts`
- Name contracts after the backend concept, not the widget:
  - `task-plan.contract.ts`
  - `dashboard-metrics.contract.ts`
- Avoid generic file names such as `helpers.ts`, `columns.ts`, or `types.ts` unless scoped by feature folder.

---

## Examples

- The task console page composes prompt input, clarification cards, plan preview, and confirmation controls from `features/task-console/`.
- The log analysis page composes source config forms, aggregate trend charts, and redacted event tables from `features/log-analysis/`.
- Weak-password masked result tables live in `features/weak-password/`; temporary cleartext reveal controls stay in the same feature because they have unique audit and expiry behavior.

When a page spans multiple domains, the page lives with the primary domain and imports child sections from secondary features rather than creating a catch-all `pages/complex/` folder.
