# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

This directory contains frontend code-spec documents for the security analysis platform UI. These files define executable conventions for feature structure, task/confirmation flows, masking, state handling, type safety, and UI quality gates.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Feature-first organization for analyst console, dashboard, audit, and admin surfaces | Complete |
| [Component Guidelines](./component-guidelines.md) | Domain-aware components for stateful workflows, masking, and confirmation UI | Complete |
| [Hook Guidelines](./hook-guidelines.md) | Query, mutation, polling, permission, and expiry-window hook conventions | Complete |
| [State Management](./state-management.md) | Separation rules for local, global, server, URL, and sensitive temporary state | Complete |
| [Quality Guidelines](./quality-guidelines.md) | UI-specific forbidden/required patterns, tests, and review checklist | Complete |
| [Type Safety](./type-safety.md) | Shared contract, runtime validation, and sensitive-data typing rules | Complete |

---

## How to Use These Guidelines

For each guideline file:

1. Keep contracts aligned with backend enum names, permission points, and visibility rules
2. Make workflow state and masking behavior explicit in the UI
3. Extend the relevant feature spec when a new surface introduces confirmation, export, or sensitive-display behavior
4. Treat these documents as implementation contracts, not optional style notes

The goal is to help AI assistants and new team members understand how YOUR project works.

---

**Language**: All documentation should be written in **English**.
