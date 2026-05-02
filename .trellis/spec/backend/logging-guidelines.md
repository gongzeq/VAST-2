# Logging Guidelines

> How logging is done in this project.

---

## Overview

This project has two distinct logging concerns:

- **application/audit logging** for platform actions and execution traces
- **security log ingestion** for firewall and Web logs that become redacted structured events and trend aggregates

Treat them differently. Application logs are observability records for the platform. Security log ingestion records are product data contracts. Neither may store forbidden sensitive content such as raw firewall/Web log bodies, cleartext weak passwords, or provider secrets.

---

## Log Levels

- `debug`
  - Local development or targeted diagnostics only.
  - Must not include raw payload bodies, command strings, credentials, tokens, or unredacted headers.
- `info`
  - Expected lifecycle events: task created, task confirmed, scan step started/finished, mail forwarded, log source updated.
- `warn`
  - Policy blocks, rejected log events, truncated input, degraded provider response, expired export requests.
- `error`
  - Unhandled integration failures, parser crashes, storage failures, execution runtime failures that require operator attention.

Use structured fields rather than interpolated paragraphs.

---

## Structured Logging

All application logs must include:

- `timestamp`
- `level`
- `service`
- `request_id` or `job_id`
- `actor_id` when applicable
- `task_id` when applicable
- `event_name`
- `result`

Additional required fields by flow:

- task execution: `step_id`, `workflow_type`, `tool_name`, `intensity`
- authorization: `permission`, `asset_group_id`, `decision`
- mail analysis: `mail_task_id`, `mail_direction`, `analysis_mode`
- log ingestion: `source_id`, `ingest_ref`, `parse_status`, `redaction_status`, `truncated`

### Scenario: Security Log Ingestion and Dashboard Aggregation

### 1. Scope / Trigger

- Trigger: implementing firewall, WAF, or Web log ingestion where logs feed normalized events, attack classification, dashboard trends, reports, or LLM summaries.
- This is cross-layer and infra work: the receiver, parser, redaction, persistence, aggregation API, dashboard, audit log, and LLM boundary must share one contract.

### 2. Signatures

Use these backend data contracts as the minimum implementation shape:

- `LogSourceConfig`
  - `source_id`, `log_type`, `product_type`, `ingest_protocol`, `parser_format`, `asset_group_id`, `enabled`, `retention_events_days`, `retention_aggregates_days`
- `SyslogReceiverConfig`
  - `transport`, `listen_host`, `listen_port`, `tls_cert_ref`, `allowed_source_ips`
- `LogIngestRecord`
  - `ingest_ref`, `source_id`, `received_at`, `original_event_time`, `size_bytes`, `checksum`, `truncated`, `parse_status`, `redaction_status`, `raw_body_discarded`
- `NormalizedSecurityLogEvent`
  - `event_id`, `ingest_ref`, `source_id`, `log_type`, `event_time`, `received_at`, `src_ip`, `src_port`, `dst_ip`, `dst_domain`, `dst_port`, `protocol`, `action`, `rule_id`, `rule_name`, `severity`
- `NormalizedWebLogFields`
  - `http_method`, `uri_path`, `status_code`, `user_agent_summary`, `request_size`, `response_size`
- `AttackClassification`
  - `attack_type`, `classification_rule_id`, `confidence`, `explanation`
- `AttackTrendBucket`
  - `window_start`, `window_end`, `log_type`, `attack_type`, `severity`, `src_ip_or_cidr`, `target_asset_id`, `action`, `event_count`

### 3. Contracts

- MVP ingestion uses platform-owned Syslog / log receiver endpoints. Firewalls, WAFs, Nginx, and Apache actively forward logs to the platform.
- Manual file import is not the primary ingestion path.
- Lightweight collection agents are extension points only and must not be required for MVP behavior.
- Raw log bodies must be processed in-memory only for parsing/redaction and then discarded.
- Persistent storage must keep only `LogIngestRecord`, redacted normalized events, and aggregated buckets.
- Dashboard APIs consume `AttackTrendBucket` and redacted normalized events only.
- LLM summaries may use aggregate metrics and redacted normalized event fields only.
- If a target IP/domain does not match an authorized asset, keep it as an unresolved log event and do not add it to scan scope.

### 4. Validation & Error Matrix

- Unknown `source_id` -> reject the event and audit the reason.
- Source IP not in `allowed_source_ips` -> reject and audit source, receiver, and reason.
- Unsupported parser format -> set `parse_status=failed`, keep `LogIngestRecord`, and discard the raw body.
- Oversized log line -> truncate according to configured limit, set `truncated=true`, preserve checksum, discard the raw body.
- Missing event timestamp -> use `received_at` for ordering and mark original event time as missing.
- Sensitive fields detected in URI query, Cookie, Token, Authorization header, account, or credential-like values -> redact before indexing, dashboard display, export, or LLM use.
- Target asset not found or not authorized -> keep `target_asset_id` empty / unresolved; never expand whitelist or scan scope.

### 5. Good/Base/Bad Cases

- Good: a WAF forwards JSON logs over TLS Syslog; the parser maps fields deterministically; the raw payload is discarded after redaction; dashboard APIs serve only trend buckets and redacted event fields.
- Base: an Apache access log line has no explicit severity; parser derives severity from status code and classification rules, stores the normalized event, and discards the original line.
- Bad: the system writes the raw Web access log line to object storage, returns it in a dashboard API, or forwards full query strings with tokens to the LLM.

### 6. Tests Required

- Unit tests for parser mappings per supported log format.
- Unit tests for redaction of query strings, Cookie, Token, Authorization, account, and credential-like values.
- Integration tests for receiver -> ingest record -> normalized event -> aggregation flow.
- Integration tests proving the raw log body is discarded and cannot be queried after processing.
- Authorization tests for log-source configuration changes and redacted event export.
- Dashboard contract tests proving trend APIs return aggregated/redacted data only.
- LLM boundary tests proving raw log bodies and sensitive fields cannot enter prompt inputs.

### 7. Wrong vs Correct

#### Wrong

```text
Persist the full Web access log line behind raw_log_ref/storage_ref and expose it to dashboard or LLM consumers for easier debugging.
```

#### Correct

```text
Create an ingest record with metadata only, redact fields into normalized events, aggregate trend buckets, discard the raw body, and serve only redacted or aggregated data to dashboard and LLM consumers.
```

---

## What to Log

- Task creation, clarification, confirmation, YOLO enablement, state transitions
- Authorization allow/deny decisions for sensitive actions
- Tool selection, runner start/finish, tool version, execution result, timeout, retry, kill-switch cancellation
- Mail analysis decisions, fail-open forwarding, body-only analysis due to size limit, security header assignment
- Log source create/update/disable/delete and parser/rule changes
- Log ingest rejections, truncation, parse failures, redaction outcome, aggregation job completion
- Report generation/export and weak-password cleartext export requests

---

## What NOT to Log
- Raw firewall/Web log bodies after ingestion
- Cleartext weak passwords
- Full SMTP body dumps in application logs
- Full URL query strings, Cookie headers, Authorization headers, tokens, or account identifiers when a redacted form is sufficient
- Full shell command strings when the runner already records structured argv safely in controlled execution evidence
- LLM request/response bodies containing sensitive source material

Use hashes, references, safe summaries, counts, and redacted field previews instead.
