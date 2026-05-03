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

## Scenario: Controlled Tool Execution and Scan Workflows

### 1. Scope / Trigger

- Trigger: implementing tool execution, asset discovery, service discovery, vulnerability scanning, or weak-password scanning workflows.
- These flows are security-sensitive because they translate structured task plans into auxiliary tool invocations and must not bypass asset scope, confirmation, timeout, cancellation, audit, or partial-success rules.

### 2. Signatures

Minimum backend contracts:

- `ToolExecutionRequest`
  - `toolType`: one of `SUBDOMAIN_ENUMERATION`, `HTTP_PROBE`, `PORT_SCAN`, `SERVICE_DETECTION`, `VULNERABILITY_SCAN`, `WEAK_PASSWORD_SCAN`
  - `intensity`: `LOW | MEDIUM | HIGH`
  - `target`: non-empty string
  - `additionalParameters`: schema-checked record, default `{}`
  - `timeoutSeconds`: optional positive integer
- `ToolExecutionResult`
  - `executionId`, `status`, `metadata`, `findings`, `errorMessage`
- `ToolExecutionMetadata`
  - `toolVersion`, `startedAt`, `completedAt`, `durationMs`, `parameters`, `exitCode`, `stdoutSha256`, `stderrSha256`, `artifactPaths`
- Workflow result contracts for discovery/scanning must include:
  - workflow id, `taskId`, `status`, `startedAt`, `completedAt`, `targetsScanned`, successful outputs, and per-target `errors`

### 3. Contracts

- Tool commands are assembled from registered `ToolConfig.baseCommand`, `allowedParameters`, intensity mappings, and the validated target only.
- `additionalParameters` may override only registered allowed parameters; unknown parameter names must fail validation.
- `undefined` override values are ignored so callers can build optional parameter maps without accidentally changing intensity defaults.
- Runner evidence stores hashes and metadata, not raw stdout/stderr in domain results.
- Workflow services must preserve successful target outputs when another target fails, times out, or returns a non-zero exit.
- Asset discovery may record out-of-scope discovered assets as `OUT_OF_SCOPE_DISCOVERED`, but must not probe or add them to authorized scope.

### 4. Validation & Error Matrix

- Missing or malformed tool execution request -> `SchemaValidationError`
- Unknown tool config or intensity mapping -> `TaskExecutionFailedError` or `SchemaValidationError`
- Unknown `additionalParameters` key -> `SchemaValidationError`
- Non-zero tool exit -> `ToolExecutionResult.status=FAILED` with safe error message
- Runtime timeout -> `ToolExecutionResult.status=TIMEOUT`
- User cancel or kill switch -> `ToolExecutionResult.status=CANCELLED`
- One target succeeds and another fails -> workflow `PARTIAL_SUCCESS`
- No target succeeds -> workflow `FAILED`
- Kill switch cancels workflow -> workflow `CANCELLED`
- Initial requested target outside asset scope -> `AssetScopeBlockedError`

### 5. Good/Base/Bad Cases

- Good: a vulnerability scan maps `MEDIUM` intensity to registered flags, stores tool version and stdout/stderr hashes, preserves one successful finding, and returns `PARTIAL_SUCCESS` when the next target fails.
- Base: a service discovery request with `portRange` sets a validated `port_range` override and records per-target failures without leaking stderr.
- Bad: a controller concatenates a user-provided shell string, silently accepts an unsupported flag, logs raw stderr, or probes an out-of-scope discovered domain.

### 6. Tests Required

- Unit tests for intensity mapping:
  - rejects unsupported overrides
  - ignores `undefined` overrides
  - validates override value types
- Unit tests for tool runner:
  - safe failed result on non-zero exit
  - timeout result and audit
  - user cancel / kill-switch result and audit
  - no raw stderr/stdout leakage in error messages
- Unit tests for workflow services:
  - out-of-scope discoveries are retained only as `OUT_OF_SCOPE_DISCOVERED`
  - out-of-scope discoveries are not probed
  - `PARTIAL_SUCCESS` preserves successful outputs and target errors
  - cancellation returns `CANCELLED` with prior successful outputs preserved when applicable

### 7. Wrong vs Correct

#### Wrong

```text
Build a command string from user input, run it directly, and mark the whole scan failed when any target exits non-zero.
```

#### Correct

```text
Map intensity and approved overrides into structured argv, execute through the runner, store execution metadata/hashes, audit every transition, and return PARTIAL_SUCCESS when useful target results remain.
```

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
