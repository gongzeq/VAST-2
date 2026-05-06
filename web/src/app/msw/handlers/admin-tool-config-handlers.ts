/**
 * Admin tool config MSW handlers.
 *
 * Permission: `tool_config:manage`. Tools are fixed (no create/delete) — only
 * PUT updates intensities/version/path.
 */
import { http, HttpResponse } from 'msw';

import {
  toolConfigListResponseSchema,
  toolConfigSchema,
  toolConfigUpdateRequestSchema,
  toolNameSchema,
  type ToolConfig,
} from '@/shared/contracts';

import { db } from '../db';
import { errorResponse } from './_helpers';
import { appendAuditEntry } from './_audit-log';

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
    return HttpResponse.json(
      toolConfigListResponseSchema.parse({
        toolConfigs: Array.from(db().toolConfigs.values()),
      }),
      { status: 200 },
    );
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

  http.put('/api/admin/tool-configs/:tool', async ({ params, request }) => {
    const denied = requireToolConfigManage();
    if (denied) return denied;
    const actor = db().actor!;
    const toolParse = toolNameSchema.safeParse(String(params.tool));
    if (!toolParse.success) {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: `Unknown tool ${String(params.tool)}.`,
      });
    }
    const existing = db().toolConfigs.get(toolParse.data);
    if (!existing) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `Tool config ${toolParse.data} not found.`,
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
    const parsed = toolConfigUpdateRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'Tool config update invalid.',
      });
    }
    const updated: ToolConfig = {
      ...existing,
      version: parsed.data.version ?? existing.version,
      path: parsed.data.path ?? existing.path,
      intensities: {
        LOW: parsed.data.intensities?.LOW ?? existing.intensities.LOW,
        MEDIUM: parsed.data.intensities?.MEDIUM ?? existing.intensities.MEDIUM,
        HIGH: parsed.data.intensities?.HIGH ?? existing.intensities.HIGH,
      },
      lastModifiedBy: actor.actorId,
      lastModifiedAt: new Date().toISOString(),
    };
    db().toolConfigs.set(toolParse.data, updated);
    appendAuditEntry({
      actor,
      action: 'tool_config.update',
      targetKind: 'tool_config',
      targetId: toolParse.data,
      requestPayload: { changedKeys: Object.keys(parsed.data) },
    });
    return HttpResponse.json(toolConfigSchema.parse(updated), { status: 200 });
  }),
];
