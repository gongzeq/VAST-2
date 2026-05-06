/**
 * Admin LLM Provider MSW handlers.
 *
 * Permission: `llm_provider:manage`. Mutations append a synthetic audit entry
 * so the audit page reflects activity end-to-end.
 */
import { http, HttpResponse } from 'msw';

import {
  llmProviderListResponseSchema,
  llmProviderSchema,
  llmProviderUpsertRequestSchema,
  type LlmProvider,
} from '@/shared/contracts';

import { db } from '../db';
import { errorResponse, newId } from './_helpers';
import { appendAuditEntry } from './_audit-log';

function requireLlmProviderManage() {
  const actor = db().actor;
  if (!actor || !actor.permissionPoints.includes('llm_provider:manage')) {
    return errorResponse({
      status: 403,
      errorCode: 'AUTHORIZATION_DENIED',
      message: '当前角色缺少 llm_provider:manage 权限。',
      details: { missingPermission: 'llm_provider:manage' },
    });
  }
  return null;
}

function nowIso(): string {
  return new Date().toISOString();
}

export const adminLlmProviderHandlers = [
  http.get('/api/admin/llm-providers', () => {
    const denied = requireLlmProviderManage();
    if (denied) return denied;
    const providers = Array.from(db().llmProviders.values());
    return HttpResponse.json(
      llmProviderListResponseSchema.parse({ providers }),
      { status: 200 },
    );
  }),

  http.get('/api/admin/llm-providers/:llmProviderId', ({ params }) => {
    const denied = requireLlmProviderManage();
    if (denied) return denied;
    const provider = db().llmProviders.get(String(params.llmProviderId));
    if (!provider) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `LLM provider ${String(params.llmProviderId)} not found.`,
      });
    }
    return HttpResponse.json(llmProviderSchema.parse(provider), { status: 200 });
  }),

  http.post('/api/admin/llm-providers', async ({ request }) => {
    const denied = requireLlmProviderManage();
    if (denied) return denied;
    const actor = db().actor!;
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'Invalid JSON body.',
      });
    }
    const parsed = llmProviderUpsertRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'LLM provider request invalid.',
      });
    }
    const id = newId('llm');
    const provider: LlmProvider = {
      llmProviderId: id,
      name: parsed.data.name,
      type: parsed.data.type,
      status: parsed.data.status,
      baseUrl: parsed.data.baseUrl,
      purposes: parsed.data.purposes,
      apiKeyMask: parsed.data.apiKey ? '••••' : null,
      lastModifiedBy: actor.actorId,
      lastModifiedAt: nowIso(),
    };
    db().llmProviders.set(id, provider);
    appendAuditEntry({
      actor,
      action: 'llm_provider.update',
      targetKind: 'llm_provider',
      targetId: id,
      requestPayload: { changedKeys: ['name', 'type', 'baseUrl'] },
      outcome: 'SUCCESS',
      note: '新建 LLM Provider',
    });
    return HttpResponse.json(llmProviderSchema.parse(provider), { status: 201 });
  }),

  http.put('/api/admin/llm-providers/:llmProviderId', async ({ params, request }) => {
    const denied = requireLlmProviderManage();
    if (denied) return denied;
    const actor = db().actor!;
    const id = String(params.llmProviderId);
    const existing = db().llmProviders.get(id);
    if (!existing) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `LLM provider ${id} not found.`,
      });
    }
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'Invalid JSON body.',
      });
    }
    const parsed = llmProviderUpsertRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'LLM provider request invalid.',
      });
    }
    const updated: LlmProvider = {
      ...existing,
      name: parsed.data.name,
      type: parsed.data.type,
      status: parsed.data.status,
      baseUrl: parsed.data.baseUrl,
      purposes: parsed.data.purposes,
      // apiKey omitted means "no change"; non-empty means a new key was set.
      apiKeyMask: parsed.data.apiKey ? '••••' : existing.apiKeyMask,
      lastModifiedBy: actor.actorId,
      lastModifiedAt: nowIso(),
    };
    db().llmProviders.set(id, updated);
    appendAuditEntry({
      actor,
      action: 'llm_provider.update',
      targetKind: 'llm_provider',
      targetId: id,
      requestPayload: { changedKeys: Object.keys(parsed.data) },
      outcome: 'SUCCESS',
    });
    return HttpResponse.json(llmProviderSchema.parse(updated), { status: 200 });
  }),

  http.patch('/api/admin/llm-providers/:llmProviderId/toggle', ({ params }) => {
    const denied = requireLlmProviderManage();
    if (denied) return denied;
    const actor = db().actor!;
    const id = String(params.llmProviderId);
    const existing = db().llmProviders.get(id);
    if (!existing) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `LLM provider ${id} not found.`,
      });
    }
    const updated: LlmProvider = {
      ...existing,
      status: existing.status === 'ENABLED' ? 'DISABLED' : 'ENABLED',
      lastModifiedBy: actor.actorId,
      lastModifiedAt: nowIso(),
    };
    db().llmProviders.set(id, updated);
    appendAuditEntry({
      actor,
      action: 'llm_provider.update',
      targetKind: 'llm_provider',
      targetId: id,
      requestPayload: { toggledTo: updated.status },
      outcome: 'SUCCESS',
    });
    return HttpResponse.json(llmProviderSchema.parse(updated), { status: 200 });
  }),

  http.delete('/api/admin/llm-providers/:llmProviderId', ({ params }) => {
    const denied = requireLlmProviderManage();
    if (denied) return denied;
    const actor = db().actor!;
    const id = String(params.llmProviderId);
    if (!db().llmProviders.has(id)) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `LLM provider ${id} not found.`,
      });
    }
    db().llmProviders.delete(id);
    appendAuditEntry({
      actor,
      action: 'llm_provider.update',
      targetKind: 'llm_provider',
      targetId: id,
      requestPayload: { deleted: true },
      outcome: 'SUCCESS',
      note: '删除 LLM Provider',
    });
    return new HttpResponse(null, { status: 204 });
  }),
];
