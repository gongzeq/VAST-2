/**
 * Admin tool config MSW handlers (read-only in PR1; mutations land in PR4).
 *
 * Permission: `tool_config:manage`.
 */
import { http, HttpResponse } from 'msw';

import {
  toolConfigListResponseSchema,
  toolConfigSchema,
  toolNameSchema,
} from '@/shared/contracts';

import { db } from '../db';
import { errorResponse } from './_helpers';

function requireToolConfigManage() {
  const actor = db().actor;
  if (!actor || !actor.permissionPoints.includes('tool_config:manage')) {
    return errorResponse({
      status: 403,
      errorCode: 'AUTHORIZATION_DENIED',
      message: '当前角色缺少 tool_config:manage 权限。',
      details: { missingPermission: 'tool_config:manage' },
    });
  }
  return null;
}

export const adminToolConfigHandlers = [
  http.get('/api/admin/tool-configs', () => {
    const denied = requireToolConfigManage();
    if (denied) return denied;
    const toolConfigs = Array.from(db().toolConfigs.values());
    const body = toolConfigListResponseSchema.parse({ toolConfigs });
    return HttpResponse.json(body, { status: 200 });
  }),

  http.get('/api/admin/tool-configs/:tool', ({ params }) => {
    const denied = requireToolConfigManage();
    if (denied) return denied;
    const toolParse = toolNameSchema.safeParse(String(params.tool));
    if (!toolParse.success) {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: `Unknown tool ${String(params.tool)}.`,
      });
    }
    const config = db().toolConfigs.get(toolParse.data);
    if (!config) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `Tool config ${toolParse.data} not found.`,
      });
    }
    return HttpResponse.json(toolConfigSchema.parse(config), { status: 200 });
  }),
];
