/**
 * Admin LLM Provider MSW handlers (read-only in PR1; mutations land in PR4).
 *
 * Permission: `llm_provider:manage`.
 */
import { http, HttpResponse } from 'msw';

import { llmProviderListResponseSchema, llmProviderSchema } from '@/shared/contracts';

import { db } from '../db';
import { errorResponse } from './_helpers';

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

export const adminLlmProviderHandlers = [
  http.get('/api/admin/llm-providers', () => {
    const denied = requireLlmProviderManage();
    if (denied) return denied;
    const providers = Array.from(db().llmProviders.values());
    const body = llmProviderListResponseSchema.parse({ providers });
    return HttpResponse.json(body, { status: 200 });
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
];
