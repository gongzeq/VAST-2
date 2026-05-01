# Logging Guidelines

> How logging is done in this project.

---

## Overview

<!--
Document your project's logging conventions here.

Questions to answer:
- What logging library do you use?
- What are the log levels and when to use each?
- What should be logged?
- What should NOT be logged (PII, secrets)?
-->

(To be filled by the team)

---

## Log Levels

<!-- When to use each level: debug, info, warn, error -->

(To be filled by the team)

---

## Structured Logging

<!-- Log format, required fields -->

(To be filled by the team)

---

## What to Log

<!-- Important events to log -->

(To be filled by the team)

---

## What NOT to Log

<!-- Sensitive data, PII, secrets -->

(To be filled by the team)

---

## Scenario: Security Log Ingestion and Dashboard Aggregation

### 1. Scope / Trigger

- Trigger: implementing firewall, WAF, or Web log ingestion where logs feed normalized events, attack classification, dashboard trends, reports, or LLM summaries.
- This is cross-layer and infra work: the receiver, evidence storage, parser, aggregation API, dashboard, audit log, and LLM boundary must share one contract.

### 2. Signatures

Use these backend data contracts as the minimum implementation shape:

- `LogSourceConfig`: `source_id`, `log_type`, `product_type`, `ingest_protocol`, `parser_format`, `asset_group_id`, `enabled`, `retention_days`.
- `SyslogReceiverConfig`: `transport`, `listen_host`, `listen_port`, `tls_cert_ref`, `allowed_source_ips`.
- `RawLogEvidence`: `raw_log_ref`, `source_id`, `received_at`, `original_event_time`, `size_bytes`, `checksum`, `truncated`, `parse_status`, `redaction_status`, `storage_ref`.
- `NormalizedSecurityLogEvent`: `event_id`, `raw_log_ref`, `source_id`, `log_type`, `event_time`, `received_at`, `src_ip`, `src_port`, `dst_ip`, `dst_domain`, `dst_port`, `protocol`, `action`, `rule_id`, `rule_name`, `severity`.
- `NormalizedWebLogFields`: `http_method`, `uri_path`, `status_code`, `user_agent_summary`, `request_size`, `response_size`.
- `AttackClassification`: `attack_type`, `classification_rule_id`, `confidence`, `explanation`.
- `AttackTrendBucket`: `window_start`, `window_end`, `log_type`, `attack_type`, `severity`, `src_ip_or_cidr`, `target_asset_id`, `action`, `event_count`.

### 3. Contracts

- MVP ingestion uses platform-owned Syslog / log receiver endpoints. Firewalls, WAFs, Nginx, and Apache actively forward logs to the platform.
- Lightweight collection agents are extension points only; do not make them required for MVP behavior.
- Manual file import is not the primary ingestion path.
- Raw log bodies must be stored in controlled evidence storage or referenced by `storage_ref`; they must not be embedded directly in dashboard payloads or LLM prompts.
- Dashboard APIs consume `AttackTrendBucket` and redacted normalized events, not raw log text.
- LLM summaries may use aggregate metrics and redacted normalized event fields only.
- Asset matching is advisory: if a target IP/domain does not match an authorized asset, keep it as a log event and do not add it to scan scope.

### 4. Validation & Error Matrix

- Unknown `source_id` -> reject or quarantine the event; audit the reason.
- Source IP not in `allowed_source_ips` -> reject; audit source, receiver, and reason.
- Unsupported parser format -> mark `parse_status=failed`; retain raw evidence reference.
- Oversized log line -> truncate according to configured limit, set `truncated=true`, and preserve checksum of the received payload.
- Missing event timestamp -> use `received_at` for ordering and mark original event time as missing.
- Sensitive fields detected in URI query, Cookie, Token, Authorization header, account, or credential-like values -> redact before indexing, dashboard display, export, or LLM use.
- Target asset not found or not authorized -> keep `target_asset_id` empty / unresolved; never expand whitelist or scan scope.

### 5. Good/Base/Bad Cases

- Good: a WAF forwards JSON logs over TLS Syslog; parser maps fields deterministically; dashboard shows attack trend buckets and top targets.
- Base: an Apache access log line has no explicit severity; parser creates a normalized event with default severity derived from status code and attack rules.
- Bad: dashboard endpoint reads raw log text directly, or an LLM prompt includes full URI query strings containing tokens.

### 6. Tests Required

- Unit tests for parser mappings per supported log format.
- Unit tests for redaction of query strings, Cookie, Token, Authorization, account, and credential-like values.
- Integration tests for receiver -> raw evidence -> normalized event -> aggregation flow.
- Authorization tests for raw log view/export and log source configuration changes.
- Dashboard contract tests proving trend APIs return aggregated/redacted data only.
- LLM boundary tests proving raw log bodies and sensitive fields cannot enter prompt inputs.

### 7. Wrong vs Correct

#### Wrong

```text
Store the full Web access log line in a dashboard event payload and send it to the LLM for explanation.
```

#### Correct

```text
Store the raw line behind raw_log_ref/storage_ref, redact sensitive fields into a normalized event, aggregate trend buckets, and only send aggregate or redacted fields to the dashboard and LLM.
```
