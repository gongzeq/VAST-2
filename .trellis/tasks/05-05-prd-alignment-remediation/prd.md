# implement: PRD alignment remediation

## Goal

Bring the current backend and frontend implementation back into alignment with the active PRD set, following the recommended order from the alignment audit: contract and role parity first, Dashboard/Audit/Admin completion second, mail/log/weak-password analysis surfaces third, and final integration quality gates last.

## What I already know

- The repository currently has no active Trellis task, and this task was created to carry the cross-layer remediation work.
- The current working tree already contains uncommitted Dashboard/Audit/Admin PR1 skeleton work: route/nav changes, frontend-first contracts, MSW handlers, seed data, and placeholder pages.
- Root `npm test` currently fails because the root Vitest run collects `web/src/tests` without the web Vite alias config. Running tests inside `web/` passes.
- Backend `src/shared/contracts/foundation.ts` is missing frontend-added permission points: `dashboard:view`, `llm_provider:manage`, `tool_config:manage`, and `kill_switch:operate`.
- Frontend mock login role presets do not match the PRD role defaults: `security-engineer` lacks `raw_evidence:view`; `auditor` lacks `raw_evidence:view`; `admin` lacks LLM/tool/kill-switch management points.
- Frontend feature directories exist for task console, asset scope, vulnerability, dashboard, audit, and admin settings. There are no mail, log-analysis, or weak-password frontend surface directories yet.
- Backend has strong partial coverage for task management, asset scope, tool runner, vulnerability scan conversion, phishing mail analysis, log ingestion, dashboard log metrics, report export, and weak-password cleartext export.
- Backend does not yet have a populated weak-password scanner module, real HTTP API for Dashboard/Audit/Admin, or Docker-backed tool runtime.

## Scope

### Phase A: Contract parity and quality gate repair

- Align backend and frontend permission point enums.
- Align default mock role bundles with the platform PRD role model.
- Normalize the `asset_scope:manage` vs `asset_group:manage` naming drift by documenting and using the implemented `asset_scope:manage` name consistently until a migration task says otherwise.
- Fix root test configuration so root backend tests do not collect `web/src/tests`.
- Add parity tests that fail when backend/frontend permission tuples drift.

### Phase B: Dashboard, Audit, and Admin completion

- Replace Dashboard placeholder with the 7-card summary surface from `05-02-frontend-dashboard-audit-and-admin/prd.md`.
- Replace Audit placeholder with URL-state filters, paginated list, and detail dialog using `audit-log.contract.ts`.
- Replace Admin placeholders with MSW-backed list/detail/create/update/delete/toggle flows for LLM Provider, Tool Configs, Log Sources, Mail Sources, and Kill Switch.
- Keep the existing frontend-first boundary: real backend Admin/Audit/Dashboard APIs remain out of scope for this task unless required for local parity tests.

### Phase C: Security analysis surfaces

- Implement `/mails` and `/mails/:mailTaskId` from `05-04-frontend-mail-analysis-surface/prd.md`.
- Implement `/logs/events` and `/logs/trends` from `05-04-frontend-log-analysis-surface/prd.md`.
- Implement `/weak-passwords` and `/weak-passwords/:taskId` from `05-04-frontend-weak-password-surface/prd.md`.
- Mirror backend zod contracts into frontend contract files without importing backend `src/`.
- Add MSW handlers and fixtures for all three surfaces.

### Phase D: Final integration verification

- Run backend build/typecheck/test.
- Run frontend typecheck/test/build/lint.
- Run root `npm test` and ensure it passes after test scope repair.
- Verify contracts are covered by tests, not just by passing builds.

## Requirements

- **R1**: Backend and frontend permission point lists must be synchronized and covered by parity tests.
- **R2**: Mock login roles must match PRD role defaults enough for local UX verification:
  - security-engineer can create/confirm/cancel/yolo task and view raw evidence.
  - admin can manage asset scope, audit log, log source, LLM providers, tool configs, mail sources via admin aggregate, and kill switch operation when explicitly granted.
  - auditor can view audit log and raw evidence but cannot mutate configs or export weak-password cleartext.
  - viewer has dashboard-only/read-summary behavior and cannot access raw evidence surfaces.
- **R3**: Root `npm test` must no longer collect frontend test files without web config.
- **R4**: Dashboard must show 7 PRD metric categories, text summaries, asset group URL filter, 60s refresh behavior, and hidden-tab pause.
- **R5**: Audit must support actor/action/target/time/outcome filters in URL state, pagination, detail dialog, and sensitive-field masking.
- **R6**: Admin five blocks must support MSW in-memory round-trip writes and explicit permission gates.
- **R7**: Mail analysis pages must preserve raw-body absence, fail-open and size-limit branches, URL filters, and viewer route blocking.
- **R8**: Log analysis pages must enforce `assetGroupId`, render redacted fields with a shared masked-cell component, show target authorization, and provide text-first trend summaries.
- **R9**: Weak-password pages must keep `oneTimePassword` scoped to the export dialog/mutation, implement countdown/visibility cleanup, and never cache or persist cleartext.
- **R10**: Every new MSW response consumed by UI must be parsed through its zod response schema before rendering.
- **R11**: New behavior must have focused unit/integration coverage for permission boundaries, URL state, unknown-state parsing, and sensitive display rules.

## Acceptance Criteria

- [ ] `npm run typecheck && npm run build && npm test` passes at the repository root.
- [ ] `cd web && npm run typecheck && npm run test && npm run build && npm run lint` passes.
- [ ] Backend/frontend permission parity tests cover the complete permission tuple.
- [ ] Login as each preset role lands on the intended allowed/blocked surfaces.
- [ ] `/dashboard` renders all 7 categories with demo data, text summaries, asset group URL state, and refresh behavior.
- [ ] `/audit` renders filters, paginated results, detail dialog, and masked sensitive payloads.
- [ ] `/admin/{llm-providers,tool-configs,log-sources,mail-sources,kill-switch}` supports the PRD-listed read/write/toggle/delete flows through MSW.
- [ ] `/mails` and `/mails/:mailTaskId` meet R7 with integration coverage for `UNAVAILABLE` and `BODY_ONLY_SIZE_LIMIT`.
- [ ] `/logs/events` and `/logs/trends` meet R8 with integration coverage for asset group URL enforcement and trend summaries.
- [ ] `/weak-passwords` and `/weak-passwords/:taskId` meet R9 with integration coverage for export dialog clear/expiry behavior.
- [ ] No code path renders raw log body, raw mail body, or weak-password cleartext outside the explicitly allowed temporary dialog state.
- [ ] Task-specific code-spec documents are present and referenced by `implement.jsonl` and `check.jsonl`.

## Definition of Done

- All acceptance criteria pass.
- New/changed code follows `.trellis/spec/frontend/*` and `.trellis/spec/backend/*`.
- No unrelated dirty files are reverted.
- Any known backend-real-API gaps left intentionally frontend-first are documented as follow-up rather than hidden.
- Final completion audit maps every requirement in this PRD to concrete code/test evidence.

## Out of Scope

- Real production HTTP server for the whole backend.
- Real SMTP/MTA deployment, real syslog listener deployment, and real Docker scanner execution unless already supported locally.
- Backend persistent database migrations.
- Real PDF/HTML rendering engine for report exports beyond existing contract-safe placeholders.
- Changing the canonical implemented permission string from `asset_scope:manage` to `asset_group:manage`; this task documents and keeps the current string stable.
- Pushing commits to a remote.

## Technical Notes

- Main platform PRD: `.trellis/tasks/05-01-security-analysis-platform-prd/prd.md`
- MVP tracker PRD: `.trellis/tasks/05-02-security-analysis-platform-mvp/prd.md`
- Frontend dashboard/audit/admin PRD: `.trellis/tasks/05-02-frontend-dashboard-audit-and-admin/prd.md`
- Frontend mail/log/weak-password PRDs:
  - `.trellis/tasks/05-04-frontend-mail-analysis-surface/prd.md`
  - `.trellis/tasks/05-04-frontend-log-analysis-surface/prd.md`
  - `.trellis/tasks/05-04-frontend-weak-password-surface/prd.md`
- Code-specs added for this remediation:
  - `.trellis/spec/frontend/prd-alignment-surfaces.md`
  - `.trellis/spec/backend/prd-alignment-contracts.md`
