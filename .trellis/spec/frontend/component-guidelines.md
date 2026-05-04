# Component Guidelines

> How components are built in this project.

---

## Overview

Components in this project must make operational state, risk boundaries, and confirmation requirements explicit. A generic "card and table" UI is not enough for a security operations console. The user must always be able to tell whether data is masked, pending confirmation, blocked, partially successful, or unavailable due to policy.

---

## Component Structure

Each non-trivial feature component should follow this structure:

```tsx
type Props = {
  // explicit domain props
};

export function TaskPlanPreviewCard(props: Props) {
  // derived state
  // event handlers
  // render branches for blocked / clarification / ready / partial
}
```

Rules:

- Keep domain rendering branches inside the component instead of hiding them in nested boolean helpers.
- Prefer composition of small, domain-labeled sections such as `ClarificationList`, `TaskStepTimeline`, `MaskedWeakPasswordTable`, `AttackTrendPanel`.
- Use display-only components for dashboard metrics; mutation controls belong in feature action components.

---

## Primitive Components

The project uses Tailwind CSS with shadcn/ui visual conventions, but **does not run the `shadcn-ui` CLI**. Instead, low-level primitives (`Button`, `Card`, `Dialog`, `Input`, `Textarea`, `Select`, `Skeleton`, `StatusBadge`, `ConfirmationDialog`, `TaskStepTimeline`, `EmptyState`, `ErrorState`, `UnauthorizedState`) are hand-rolled in `web/src/shared/components/` using Tailwind classes.

### Why

- Keeps `npm install` deterministic and offline-friendly (no `npx shadcn add` interactive registry calls).
- Keeps the primitive surface narrow — only what the codebase actually renders, no unused pieces.
- Lets each consumer supply its own action vocabulary (e.g., the `<Dialog>` primitive only renders Cancel; consumers like `<AddWhitelistEntryDialog>` provide their own submit button via `children`). This prevents the "every dialog auto-submits" anti-pattern that breaks the high-risk preview/confirm separation.

### Conventions

- Primitives live under `web/src/shared/components/<PascalCase>.tsx` (one file per primitive).
- Class composition uses a small `class-names.ts` helper (or `clsx`-equivalent) — do not pull in a runtime CSS-in-JS lib.
- Domain-aware components (e.g., `<StatusBadge state>`, `<ConfirmationDialog>`) wrap primitives and live in the same folder; they import from primitives, never the other way around.
- When a new primitive is needed (e.g., `Tabs`, `Toast`), hand-roll it following the same Tailwind-class pattern. Do not introduce a runtime UI library mid-project.

### Forbidden

- Running `npx shadcn-ui add ...` against this repo.
- Pulling in `@radix-ui/*`, `@headlessui/*`, MUI, Chakra, or any other component runtime lib without a separate spec change approving the dependency.
- Promoting a feature-local component to `shared/components/` before three feature folders import it with the same semantics (see Directory Structure).

---

## Props Conventions

- Props must be typed with feature contracts, not ad-hoc view models.
- Name props after domain meaning:
  - `taskState`
  - `confirmationRequired`
  - `maskedFindingCount`
  - `canViewCleartext`
- Do not pass raw backend payload blobs to child components when a narrower contract is available.
- Prefer separate props for permission/visibility gates rather than burying them inside optional data:
  - Good: `canExportReport: boolean`
  - Bad: infer from `reportExportUrl?: string`

---

## Styling Patterns

- Use consistent semantic variants for stateful UI:
  - blocked/error -> destructive
  - clarification/confirmation needed -> warning
  - partial success -> caution/mixed
  - success -> positive
  - masked/sensitive -> muted with explicit badge
- Never use color alone to communicate task state, masking, or policy blocks.
- Reuse one badge vocabulary across the app for `BLOCKED`, `NEEDS_CLARIFICATION`, `PARTIAL_SUCCESS`, `HIGH`, `YOLO`, `MASKED`.

---

## Accessibility

- All confirmation dialogs must describe the action, target scope, and risk level in text, not iconography alone.
- Task timelines, dashboard charts, and event tables must have text alternatives or summaries.
- Keyboard users must be able to review a task plan, answer clarification questions, confirm execution, and export reports without pointer-only interactions.
- Sensitive reveal actions must have clear labels such as `Reveal cleartext password temporarily` rather than ambiguous verbs like `Open`.

---

## Common Mistakes

### Common Mistake: Rendering sensitive values as normal text fields

**Problem**: components treat masked findings, log-event fields, and temporary secret reveals like generic strings.

**Better**: create dedicated masked/sensitive display components that make visibility rules obvious.

### Common Mistake: Hiding workflow state in generic status chips

**Problem**: one generic `StatusBadge` erases the distinction between blocked, clarification needed, cancelled, and partial success.

**Better**: keep a shared visual primitive, but map domain states explicitly in feature-owned adapters.

### Common Mistake: Mixing confirmation UI with execution UI

**Problem**: the same button both previews and executes a high-risk action with insufficient separation.

**Better**: use a preview component followed by an explicit confirmation component when policy requires user acknowledgment.
