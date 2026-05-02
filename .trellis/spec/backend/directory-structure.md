# Directory Structure

> How backend code is organized in this project.

---

## Overview

The backend is organized by **business domain first**, with thin transport layers and explicit cross-layer contracts. This project handles authorization, security tooling, log ingestion, audit, and sensitive data boundaries; do not organize it as generic `controllers/services/utils` buckets at the top level.

Core rules:

- Domain modules own business behavior, validation entry points, orchestration rules, and persistence coordination.
- HTTP, worker, SMTP, and Syslog adapters are transport-specific shells around domain modules.
- Shared code is limited to primitives that truly span domains: IDs, auth context, audit writer, redaction, task-state enums, runner lifecycle, and storage abstractions.
- LLM integration, task orchestration, and tool execution must remain separate modules even when one request touches all three.

---

## Directory Layout

```
src/
├── app/
│   ├── http/
│   ├── worker/
│   ├── smtp-gateway/
│   └── syslog-receiver/
├── modules/
│   ├── auth/
│   ├── asset-scope/
│   ├── task-planning/
│   ├── task-execution/
│   ├── tool-runner/
│   ├── phishing-mail/
│   ├── log-ingestion/
│   ├── vulnerability/
│   ├── weak-password/
│   ├── report/
│   ├── dashboard/
│   └── audit/
├── shared/
│   ├── contracts/
│   ├── enums/
│   ├── ids/
│   ├── redaction/
│   ├── authorization/
│   ├── persistence/
│   ├── storage/
│   ├── config/
│   └── observability/
└── tests/
    ├── unit/
    ├── integration/
    └── contract/
```

---

## Module Organization

Each backend domain module should use the same internal shape where applicable:

```text
modules/<domain>/
├── contracts/
├── application/
├── domain/
├── persistence/
├── transport/
├── audit/
└── tests/
```

Use the directories as follows:

- `contracts/`
  - Request/response payloads, command DTOs, queue payloads, event schemas, and public enums.
- `application/`
  - Use-case orchestration and transaction boundaries.
- `domain/`
  - Pure business rules: authorization decisions, state transitions, workflow rules, redaction decisions.
- `persistence/`
  - Repositories, query builders, and storage mappings.
- `transport/`
  - HTTP handlers, SMTP adapters, Syslog handlers, worker bindings.
- `audit/`
  - Audit event builders for domain-specific append-only records.

Do not let `transport/` call the database directly. Do not let `persistence/` depend on HTTP request objects, SMTP envelopes, or Syslog packet types.

### Domain Boundaries

- `auth/`
  - User, role, permission point, session context, authorization checks.
- `asset-scope/`
  - Asset groups, whitelist entries, discovered asset lifecycle, asset ownership matching.
- `task-planning/`
  - Natural-language intent result, clarification generation, structured execution plan validation.
- `task-execution/`
  - Task lifecycle, step graph, confirmation checkpoints, kill-switch handling, partial-success rules.
- `tool-runner/`
  - Controlled auxiliary command executor, Docker runner integration, tool intensity mapping.
- `phishing-mail/`
  - SMTP receive/forward flow, mail analysis request, risk scoring, header tagging.
- `log-ingestion/`
  - Source config, receiver lifecycle, parsing, redaction, normalized event persistence, trend aggregation.
- `report/`
  - HTML/PDF report generation, export authorization, weak-password masked output.
- `dashboard/`
  - Read models and aggregated queries only; never reconstruct business state inside dashboard endpoints.
- `audit/`
  - Append-only audit writer, export filters, immutable query interfaces.

---

## Naming Conventions

- Use kebab-case for folders: `asset-scope`, `task-execution`, `log-ingestion`.
- Name public contract files by business concept, not framework type:
  - Good: `task-plan.contract.ts`, `asset-authorization.contract.ts`
  - Bad: `dto.ts`, `types.ts`, `misc.ts`
- Name application entry points by use case:
  - `create-comprehensive-scan.use-case.ts`
  - `confirm-discovered-asset.use-case.ts`
  - `export-weak-passwords.use-case.ts`
- Name repositories by aggregate/read model:
  - `task-repository.ts`, `dashboard-metrics-repository.ts`
- Name audit builders by action family:
  - `task-audit-events.ts`, `log-source-audit-events.ts`

Keep enum names aligned with PRD terms. Do not invent alternate names for task states, discovered-asset states, or permission points.

---

## Examples

Use these module boundaries as the canonical examples for future work:

- A natural-language task request enters `task-planning/transport`, becomes a validated plan in `task-planning/application`, is checked against `auth/` and `asset-scope/`, and is handed to `task-execution/`.
- A vulnerability scan request flows through `task-execution/` and `tool-runner/`; template selection and intensity mapping belong to `tool-runner/`, not to HTTP handlers.
- A Syslog event enters `log-ingestion/transport`, is parsed and redacted in `log-ingestion/application`, persisted by `log-ingestion/persistence`, and later consumed by `dashboard/` and optionally summarized for LLM use.

When a feature spans multiple modules, define the contract in `shared/contracts/` only if more than one domain owns it. Otherwise keep the contract in the owning domain and import from there.
