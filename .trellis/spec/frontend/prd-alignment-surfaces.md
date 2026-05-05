# PRD Alignment Surfaces

> Executable frontend code-spec for finishing PRD-aligned Dashboard, Audit, Admin, Mail, Log, and Weak Password surfaces.

## Scenario: Cross-Surface PRD Alignment

### 1. Scope / Trigger

- Trigger: PRD alignment remediation touches cross-layer contracts, route permissions, MSW request/response shapes, URL state, and sensitive temporary state.
- Applies to:
  - Dashboard: `/dashboard`
  - Audit: `/audit`
  - Admin: `/admin/llm-providers`, `/admin/tool-configs`, `/admin/log-sources`, `/admin/mail-sources`, `/admin/kill-switch`
  - Mail analysis: `/mails`, `/mails/:mailTaskId`
  - Log analysis: `/logs/events`, `/logs/trends`
  - Weak-password analysis: `/weak-passwords`, `/weak-passwords/:taskId`

### 2. Signatures

- Dashboard query key: `queryKeys.dashboardSummary({ scope, assetGroupIds })`
- Audit query key: `queryKeys.auditLog(filters)`
- Admin query keys:
  - `queryKeys.llmProviders()`, `queryKeys.llmProvider(id)`
  - `queryKeys.toolConfigs()`, `queryKeys.toolConfig(tool)`
  - `queryKeys.logSources()`, `queryKeys.logSource(id)`
  - `queryKeys.mailSources()`, `queryKeys.mailSource(id)`
  - `queryKeys.killSwitchState()`
- Required new query keys:
  - `queryKeys.mailAnalyses(filters)`, `queryKeys.mailAnalysis(mailTaskId)`
  - `queryKeys.securityLogEvents(filters)`, `queryKeys.attackTrends(filters)`
  - `queryKeys.weakPasswordReports(filters)`, `queryKeys.weakPasswordReport(taskId)`

### 3. Contracts

- Every frontend mirror lives under `web/src/shared/contracts/*.contract.ts`.
- Frontend must not import backend `src/**`.
- Every MSW JSON response must be parsed with the exact response schema before returning from the handler or before being consumed by a hook.
- URL-state parsers must be zod-backed and must recover to safe defaults on invalid search params.
- Permission gates:
  - Raw-evidence surfaces use `raw_evidence:view`.
  - Audit uses `audit_log:view`.
  - Admin blocks use their dedicated management permission where available.
  - Mail source uses the documented admin aggregate because no dedicated `mail_source:manage` permission exists.

### 4. Validation & Error Matrix

| Condition | UI behavior |
|---|---|
| Missing actor | redirect to `/login` |
| Missing route-level raw evidence permission | redirect to `/` for raw evidence surfaces |
| Missing page-level admin/audit permission | render `<UnauthorizedState>` with the missing permission |
| Invalid URL state | normalize to safe defaults and preserve a usable page |
| MSW/schema parse failure | render unknown-state `<ErrorState>` |
| Empty query result | render `<EmptyState>` distinct from unauthorized |
| Weak-password export expired | render explicit expired dialog/error state, not a generic crash |

### 5. Good/Base/Bad Cases

- Good: Dashboard card with restricted metric renders a masked/unauthorized sub-state while the rest of the page remains usable.
- Base: A list page with no matching rows renders `<EmptyState>` and keeps filters in the URL.
- Bad: A page silently hides a disabled admin or export action without saying which permission is missing.
- Bad: Mail or log UI adds a "view raw body" / "download payload" path.
- Bad: Weak-password one-time password enters query cache, URL, actor context, localStorage, sessionStorage, or a shared component prop chain.

### 6. Tests Required

- Role matrix tests for security-engineer, admin, auditor, and viewer.
- URL-state integration tests for every list page.
- MSW handler tests that parse every response shape with zod.
- Unknown-state tests by overriding a handler to return invalid payload.
- Sensitive-display tests:
  - mail raw body never appears.
  - log raw payload never appears.
  - weak-password `oneTimePassword` is only present in the export mutation/dialog files.
  - weak-password dialog clears on close and on `visibilitychange='hidden'`.

### 7. Wrong vs Correct

#### Wrong

```tsx
// Raw field rendered directly and no parse boundary.
const data = await fetch('/api/log-events').then((res) => res.json());
return <pre>{data.rawPayload}</pre>;
```

#### Correct

```tsx
const data = await fetchJson('/api/log-events', securityLogEventListResponseSchema);
return data.events.map((event) => (
  <MaskedCell
    value={event.redactedFields.includes('uriPath') ? null : event.webFields?.uriPath ?? null}
    fieldName="uriPath"
  />
));
```

## Scenario: Admin MSW Writes

### 1. Scope / Trigger

- Trigger: Admin UI is frontend-first and must support realistic create/update/delete/toggle flows before backend persistence exists.

### 2. Signatures

- `POST /api/admin/llm-providers`
- `PUT /api/admin/llm-providers/:llmProviderId`
- `DELETE /api/admin/llm-providers/:llmProviderId`
- `PUT /api/admin/tool-configs/:tool`
- `POST /api/admin/log-sources`
- `PUT /api/admin/log-sources/:logSourceId`
- `POST /api/admin/log-sources/:logSourceId/toggle`
- `POST /api/admin/mail-sources`
- `PUT /api/admin/mail-sources/:mailSourceId`
- `POST /api/admin/kill-switch/toggle`

### 3. Contracts

- Mutations must validate request bodies with the relevant zod request schema.
- Mutations must mutate `web/src/app/msw/db.ts`, not component-local fake arrays.
- Mutation success must invalidate the relevant query key.
- Destructive or high-impact mutations require `<ConfirmationDialog>`.

### 4. Validation & Error Matrix

| Condition | Response |
|---|---|
| Missing permission | `403 AUTHORIZATION_DENIED` |
| Invalid request body | `400 SCHEMA_VALIDATION_FAILED` |
| Unknown entity id | `404 TASK_EXECUTION_FAILED` |
| Kill switch confirm not `CONFIRM` | `400 SCHEMA_VALIDATION_FAILED` |

### 5. Good/Base/Bad Cases

- Good: Saving an LLM Provider masks API key as bullets and never echoes the clear key.
- Base: Updating a tool config changes the row after query invalidation.
- Bad: Component mutates imported seed arrays directly.

### 6. Tests Required

- MSW unit tests for success and permission denial on each admin block.
- Component/integration tests for at least one create/edit/delete/toggle flow per block.
- Kill switch test for exact `CONFIRM` requirement.

### 7. Wrong vs Correct

#### Wrong

```tsx
setRows(rows.map((row) => row.id === id ? edited : row));
```

#### Correct

```tsx
await updateMutation.mutateAsync(command);
queryClient.invalidateQueries({ queryKey: queryKeys.llmProviders() });
```
