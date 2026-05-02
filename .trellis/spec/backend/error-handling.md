# Error Handling

> How errors are handled in this project.

---

## Overview

Errors must preserve the product's security and audit boundaries. The backend distinguishes between user-fixable clarification needs, policy/authorization blocks, partial operational failures, and system faults. Do not collapse them into generic `400` or `500` responses.

Rules:

- Every externally visible failure must map to a stable domain error code.
- Every domain error that changes task state, export availability, authorization visibility, or ingestion outcome must emit an audit record.
- Error responses must be safe for UI exposure and must never leak raw log bodies, cleartext weak passwords, secret headers, shell command strings, or unredacted provider payloads.

---

## Error Types

Define domain errors by outcome, not framework source.

- `NeedsClarificationError`
  - Used when intent is ambiguous or required fields are missing.
  - Maps task state to `NEEDS_CLARIFICATION`.
- `AuthorizationDeniedError`
  - Used when the actor lacks a permission point such as `task:create`, `task:yolo_execute`, `audit_log:view`, `log_event:export`.
- `AssetScopeBlockedError`
  - Used when targets are outside the allowed asset group or discovered assets are not yet confirmed.
  - Maps task state to `BLOCKED` when a task already exists.
- `PolicyConfirmationRequiredError`
  - Used when the requested action is valid but cannot proceed without an explicit confirmation, such as `HIGH` intensity execution or uncertain YOLO execution.
- `SchemaValidationError`
  - Used when a structured plan step, tool parameter payload, or log source configuration violates the backend schema.
- `TaskExecutionFailedError`
  - Used when a required step fails and subsequent execution cannot continue.
  - Maps task state to `FAILED`.
- `TaskExecutionPartialFailureError`
  - Used when some steps succeed and at least one step fails but useful results remain.
  - Maps task state to `PARTIAL_SUCCESS`.
- `KillSwitchCancelledError`
  - Used when the global kill switch stops running steps.
  - Maps task state to `CANCELLED`.
- `SensitiveExportExpiredError`
  - Used when a weak-password cleartext export is requested outside the allowed visibility window.
- `LogIngestRejectedError`
  - Used when a log event is rejected due to source validation, protocol restrictions, or policy mismatch.

Do not use a single catch-all `BusinessError` for these cases.

---

## Error Handling Patterns

- Validate at the boundary and raise a typed domain error immediately.
- Convert infrastructure exceptions to domain-safe errors as close to the integration boundary as possible.
- Keep step-level execution results even when the overall task becomes `PARTIAL_SUCCESS` or `FAILED`.
- Preserve machine-readable failure context internally: tool name, step id, exit code, validation field, source id, confirmation requirement.
- Redact before logging or returning any error context.

### State Mapping Rules

- Clarification needed -> create/update task as `NEEDS_CLARIFICATION`
- Permission denied or out-of-scope target -> `BLOCKED`
- Required execution step fails with no safe continuation -> `FAILED`
- At least one successful step and at least one failed step -> `PARTIAL_SUCCESS`
- Kill switch or explicit user cancel -> `CANCELLED`

### Retry Rules

- Only transient execution and network faults may be retried.
- Validation failures, permission failures, scope failures, and policy blocks are never retried automatically.
- Retries must not silently raise intensity, expand scope, or change dictionaries/template sets.

---

## API Error Responses

Use a standard response shape for UI/API consumers:

```json
{
  "error_code": "ASSET_SCOPE_BLOCKED",
  "message": "Target is outside the authorized asset scope.",
  "task_state": "BLOCKED",
  "details": {
    "asset_group_id": "ag_123",
    "target_ref": "corp-b.example.com"
  },
  "request_id": "req_abc"
}
```

Rules:

- `error_code` is mandatory and stable.
- `message` is safe for end-user display.
- `task_state` is required when the error creates or mutates a task state.
- `details` may contain safe structured fields only.
- `request_id` is always included for traceability.

### Validation & Error Matrix

- Missing asset group for a scan request -> `NEEDS_CLARIFICATION` / `NeedsClarificationError`
- User lacks `task:create` -> `AUTHORIZATION_DENIED` / `AuthorizationDeniedError`
- Target asset not in allowed whitelist -> `ASSET_SCOPE_BLOCKED` / `AssetScopeBlockedError`
- YOLO enabled but intent still ambiguous -> `CONFIRMATION_REQUIRED` / `PolicyConfirmationRequiredError`
- `HIGH` intensity requested without confirmation -> `CONFIRMATION_REQUIRED` / `PolicyConfirmationRequiredError`
- Tool schema contains unsupported field -> `SCHEMA_VALIDATION_FAILED` / `SchemaValidationError`
- Log source IP not allowed -> `LOG_INGEST_REJECTED` / `LogIngestRejectedError`
- Weak-password cleartext export after 30-minute window -> `SENSITIVE_EXPORT_EXPIRED` / `SensitiveExportExpiredError`
- Kill switch triggered during execution -> `TASK_CANCELLED` / `KillSwitchCancelledError`

---

## Common Mistakes

### Common Mistake: Treating clarification as validation failure

**Symptom**: the API returns a generic `400` when the user's intent is incomplete.

**Cause**: mixing malformed payloads with domain ambiguity.

**Fix**: return a typed clarification response and transition the task to `NEEDS_CLARIFICATION`.

### Common Mistake: Hiding partial success behind a hard failure

**Symptom**: a workflow loses successful findings because one downstream step timed out.

**Cause**: raising a terminal exception without preserving step-level outputs.

**Fix**: persist successful step outputs, mark the failed step explicitly, and surface `PARTIAL_SUCCESS`.

### Common Mistake: Leaking forbidden sensitive content in logs or API errors

**Symptom**: error payloads or logs include raw log lines, command strings, or weak-password plaintext.

**Cause**: serializing infrastructure exceptions directly.

**Fix**: redact integration exceptions before logging or returning them.
