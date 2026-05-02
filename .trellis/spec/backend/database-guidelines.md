# Database Guidelines

> Database patterns and conventions for this project.

---

## Overview

Persistence must encode the product's security boundaries, not just store records. The backend stores structured task results, asset authorization state, audit trails, redacted security events, and aggregated metrics. It must **not** persist raw log bodies or recoverable cleartext weak passwords.

Use a relational database for system-of-record entities and append-only audit events. Use object/local file storage only for task evidence artifacts that the PRD explicitly allows, such as scan artifacts, report files, and mail-analysis attachments metadata. Raw firewall/Web log bodies are out of scope for persistent storage.

---

## Query Patterns

- Use repositories per aggregate or read model; do not scatter inline SQL across handlers.
- Every write path that changes authorization state, task state, export state, or audit-sensitive visibility must run inside an explicit application transaction.
- Dashboard queries must read from redacted structured tables and aggregate tables only; never rebuild dashboard metrics from raw evidence blobs.
- Use batched reads for dashboard and report generation to avoid N+1 queries across tasks, assets, vulnerabilities, and trend buckets.
- Authorization filters must be applied in the query layer for list/read endpoints that depend on asset-group scope or sensitive-output visibility.

### Required Record Families

- `users`, `roles`, `permissions`, `role_permissions`, `user_roles`
- `asset_groups`, `asset_whitelist_entries`, `assets`, `asset_group_assets`
- `tasks`, `task_steps`, `task_clarifications`, `task_confirmations`
- `tool_configs`, `tool_intensity_profiles`, `task_tool_executions`
- `vulnerabilities`, `weak_password_findings_masked`
- `mail_analysis_tasks`, `mail_headers`, `mail_iocs`
- `log_sources`, `log_ingest_records`, `security_log_events`, `security_log_trend_buckets`
- `reports`, `report_exports`
- `audit_logs`

---

## Migrations

- Create forward-only migrations; do not rewrite previously applied migration files.
- Each migration that introduces or changes a business enum must update the shared enum contract in code in the same change set.
- Migrations that affect sensitive data retention must state the security impact in the migration description.
- Backfills must be idempotent and chunked.
- Never ship a migration that creates a durable column for raw log body, raw Web access log line, or cleartext weak password.

### Mandatory Enums

Task state enum must be stored exactly as:

- `SUCCESS`
- `PARTIAL_SUCCESS`
- `FAILED`
- `NEEDS_CLARIFICATION`
- `BLOCKED`
- `CANCELLED`

Discovered asset status enum must be stored exactly as:

- `DISCOVERED_PENDING_CONFIRMATION`
- `CONFIRMED`
- `REJECTED`
- `OUT_OF_SCOPE_DISCOVERED`

Execution intensity enum must be stored exactly as:

- `LOW`
- `MEDIUM`
- `HIGH`

### Log Retention Contract

Persist these log-related record types only:

- `log_ingest_records`
  - `ingest_ref`, `source_id`, `received_at`, `original_event_time`, `size_bytes`, `checksum`, `truncated`, `parse_status`, `redaction_status`, `raw_body_discarded`
- `security_log_events`
  - redacted structured fields only
- `security_log_trend_buckets`
  - aggregated metrics only

Never persist:

- raw Syslog line body
- raw Web access log body
- raw query string containing secrets/tokens
- raw Cookie/Authorization header values

Default retention:

- redacted structured log events: 180 days
- aggregated trend buckets: 365 days

Allow per-log-source overrides for these retained artifacts only.

---

## Naming Conventions

- Use snake_case for tables, columns, indexes, and foreign keys.
- Name tables by aggregate meaning, not UI labels:
  - Good: `task_steps`, `log_ingest_records`, `asset_whitelist_entries`
  - Bad: `dashboard_rows`, `misc_logs`
- Use explicit foreign keys: `task_id`, `asset_group_id`, `source_id`, `report_id`.
- For immutable identifiers exposed outside the database, use the PRD contract names directly when already established, such as `event_id`, `source_id`, `ingest_ref`.
- Index names should describe lookup intent:
  - `idx_tasks_asset_group_id_created_at`
  - `idx_security_log_events_source_id_event_time`
  - `idx_audit_logs_actor_id_occurred_at`

### Sensitive Storage Rules

- Cleartext weak passwords must never be stored in relational tables.
- Weak-password exports may exist only as encrypted XLSX files in controlled artifact storage and only within the allowed export window; the randomly generated export password must not be stored in the database.
- Raw task stdout/stderr references are allowed for tool execution evidence, but access must be authorization-gated and audited.
- Raw log body references are forbidden.

---

## Common Mistakes

### Common Mistake: Turning transient sensitive data into durable fields

**Symptom**: a schema proposal adds `raw_log_body`, `weak_password_plaintext`, or reusable export secrets.

**Cause**: treating all evidence the same, even though the PRD gives logs and weak-password secrets different retention boundaries.

**Fix**: store only metadata, redacted structures, masked findings, or short-lived encrypted artifacts explicitly allowed by the PRD.

**Prevention**: review every new column with the question "Can this field reconstruct forbidden sensitive content?"

### Common Mistake: Mixing authorization scope with dashboard read models

**Symptom**: dashboard queries bypass asset-group scope or include sensitive details because they read broad base tables directly.

**Cause**: skipping a dedicated aggregated/read-model layer.

**Fix**: expose dashboard-specific repositories that read only redacted/aggregated tables and apply authorization filters.
