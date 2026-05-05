# Backend Development Guidelines

> Best practices for backend development in this project.

---

## Overview

This directory contains backend code-spec documents for the security analysis platform. These files define executable contracts for domain boundaries, persistence, error handling, logging/redaction, and quality requirements.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Domain-first module boundaries for auth, scope, orchestration, tooling, logs, reports, dashboard, and audit | Complete |
| [Database Guidelines](./database-guidelines.md) | Persistence contracts for task state, asset state, retention, exports, and audit storage | Complete |
| [Error Handling](./error-handling.md) | Typed domain error model, state transitions, retry rules, and API-safe failures | Complete |
| [Quality Guidelines](./quality-guidelines.md) | Security-sensitive forbidden/required patterns, test minima, and review checklist | Complete |
| [Logging Guidelines](./logging-guidelines.md) | Application/audit logging plus log-ingestion contracts with mandatory redaction and raw-body discard rules | Complete |
| [PRD Alignment Contracts](./prd-alignment-contracts.md) | Contract parity, test-boundary, and runtime rules required by PRD alignment remediation | Active |

---

## How to Use These Guidelines

For each guideline file:

1. Start from the owning business domain, not the framework layer
2. Reuse the exact enums, field names, and policy boundaries recorded here
3. Extend the contracts when the PRD introduces new surface area
4. Update the relevant file whenever a design decision changes runtime behavior or security boundaries

The goal is to help AI assistants and new team members understand how YOUR project works.

---

**Language**: All documentation should be written in **English**.
