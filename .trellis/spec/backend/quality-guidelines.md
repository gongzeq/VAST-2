# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

This backend executes security-sensitive workflows, handles authorization scope, and mediates LLM access to tools and evidence. Quality here means more than style: every change must preserve scope boundaries, auditability, redaction, and deterministic workflow control.

Prefer explicit contracts and stable enums over clever abstractions. When behavior affects permissions, scan scope, mail forwarding, log ingestion, or export visibility, write the contract first and code to it.

---

## Forbidden Patterns

- LLM-generated or user-provided raw shell command strings passed directly to execution runtime
- Implicit expansion of whitelist/scope based on discovered assets or log events
- Durable storage of raw log body or cleartext weak passwords
- Silent fallback from blocked/clarification state into execution
- Task-state mutation without an audit record
- Dashboard endpoints reading sensitive base tables when a redacted/aggregate read model is required
- Catch-all error handlers that erase domain error codes or state transitions
- Cross-module imports from `transport/` into another module's `persistence/` internals
- Hard-coded tool flags in controllers/handlers instead of intensity/schema mapping in `tool-runner/`

---

## Required Patterns

- Validate at the boundary with explicit schemas for task creation, confirmation, tool execution requests, log source config, and export requests.
- Use domain enums exactly as defined in the PRD for task states, asset discovery states, and intensity levels.
- Write append-only audit events for every sensitive read, export, block, confirmation, policy change, and execution transition.
- Redact before persistence, before application logs, before dashboard payloads, and before LLM prompt construction.
- Preserve successful step outputs when a task becomes `PARTIAL_SUCCESS`.
- Require explicit confirmation for `HIGH` intensity execution and uncertain YOLO scenarios.
- Keep runner/tool version and execution metadata alongside step evidence for traceability.
- Separate plan generation, policy validation, and execution orchestration into different services/modules.

---

## Testing Requirements

Every backend feature touching domain rules must include the appropriate mix of tests below.

- Unit tests
  - enum/state transition rules
  - redaction rules
  - intensity mapping
  - clarification decision rules
- Integration tests
  - task plan -> policy validation -> execution transition
  - mail receive -> analyze -> tag -> forward
  - log ingest -> redact -> persist -> aggregate
  - report export authorization and masking rules
- Contract tests
  - API error shape and stable `error_code`
  - dashboard aggregated payload shape
  - log event export payload excludes forbidden sensitive fields
- Authorization tests
  - permission-point gating
  - asset-group scope filtering
  - sensitive evidence/export visibility

### Minimum Assertion Points

- A blocked task never executes any scan step.
- `HIGH` intensity never bypasses confirmation, even with YOLO permission.
- Raw log bodies are not queryable after ingest processing.
- Weak-password plaintext is never persisted and is unavailable after the allowed window.
- Audit records exist for confirmation, export, permission denial, whitelist changes, log source changes, and kill-switch actions.

---

## Code Review Checklist

- Does the change preserve asset-group scope and confirmation boundaries?
- Are task states and error codes explicit and PRD-aligned?
- Is there any new path where raw sensitive content can be logged, stored, exported, or sent to LLMs?
- Are audit events emitted for all sensitive actions in the flow?
- Are tool parameters produced by schema/intensity mapping rather than arbitrary string concatenation?
- Does dashboard/report code read from the correct redacted or aggregated sources?
- Are partial-success and cancellation paths explicitly handled?
- Are tests asserting the security boundary, not just the happy path?
