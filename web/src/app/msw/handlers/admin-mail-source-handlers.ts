/**
 * Admin mail source MSW handlers (read-only in PR1; mutations land in PR4).
 *
 * Permission: admin-like — any of `asset_scope:manage` / `log_source:manage` /
 * `llm_provider:manage` / `tool_config:manage`. (PRD §3 has no dedicated
 * mail_source perm point.)
 */
import { http, HttpResponse } from 'msw';

import { mailSourceListResponseSchema, mailSourceSchema } from '@/shared/contracts';

import { db } from '../db';
import { errorResponse } from './_helpers';

function requireMailSourceManage() {
  const actor = db().actor;
  const adminPoints: ReadonlyArray<string> = [
    'asset_scope:manage',
    'log_source:manage',
    'llm_provider:manage',
    'tool_config:manage',
  ];
  if (!actor || !actor.permissionPoints.some((p) => adminPoints.includes(p))) {
    return errorResponse({
      status: 403,
      errorCode: 'AUTHORIZATION_DENIED',
      message: '当前角色无权管理邮件源。',
      details: { missingPermission: 'asset_scope:manage' },
    });
  }
  return null;
}

export const adminMailSourceHandlers = [
  http.get('/api/admin/mail-sources', () => {
    const denied = requireMailSourceManage();
    if (denied) return denied;
    const mailSources = Array.from(db().mailSources.values());
    const body = mailSourceListResponseSchema.parse({ mailSources });
    return HttpResponse.json(body, { status: 200 });
  }),

  http.get('/api/admin/mail-sources/:mailSourceId', ({ params }) => {
    const denied = requireMailSourceManage();
    if (denied) return denied;
    const source = db().mailSources.get(String(params.mailSourceId));
    if (!source) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `Mail source ${String(params.mailSourceId)} not found.`,
      });
    }
    return HttpResponse.json(mailSourceSchema.parse(source), { status: 200 });
  }),
];
