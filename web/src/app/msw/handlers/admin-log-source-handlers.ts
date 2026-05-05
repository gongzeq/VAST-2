/**
 * Admin log source MSW handlers (read-only in PR1; mutations land in PR4).
 *
 * Permission: `log_source:manage`.
 */
import { http, HttpResponse } from 'msw';

import { logSourceListResponseSchema, logSourceSchema } from '@/shared/contracts';

import { db } from '../db';
import { errorResponse } from './_helpers';

function requireLogSourceManage() {
  const actor = db().actor;
  if (!actor || !actor.permissionPoints.includes('log_source:manage')) {
    return errorResponse({
      status: 403,
      errorCode: 'AUTHORIZATION_DENIED',
      message: '当前角色缺少 log_source:manage 权限。',
      details: { missingPermission: 'log_source:manage' },
    });
  }
  return null;
}

export const adminLogSourceHandlers = [
  http.get('/api/admin/log-sources', () => {
    const denied = requireLogSourceManage();
    if (denied) return denied;
    const logSources = Array.from(db().logSources.values());
    const body = logSourceListResponseSchema.parse({ logSources });
    return HttpResponse.json(body, { status: 200 });
  }),

  http.get('/api/admin/log-sources/:logSourceId', ({ params }) => {
    const denied = requireLogSourceManage();
    if (denied) return denied;
    const source = db().logSources.get(String(params.logSourceId));
    if (!source) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `Log source ${String(params.logSourceId)} not found.`,
      });
    }
    return HttpResponse.json(logSourceSchema.parse(source), { status: 200 });
  }),
];
