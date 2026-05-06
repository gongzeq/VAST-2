/**
 * Admin log source MSW handlers.
 *
 * Permission: `log_source:manage`.
 */
import { http, HttpResponse } from 'msw';

import {
  logSourceListResponseSchema,
  logSourceSchema,
  logSourceToggleRequestSchema,
  logSourceUpsertRequestSchema,
  type LogSource,
} from '@/shared/contracts';

import { db } from '../db';
import { errorResponse, newId } from './_helpers';
import { appendAuditEntry } from './_audit-log';

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
    return HttpResponse.json(
      logSourceListResponseSchema.parse({
        logSources: Array.from(db().logSources.values()),
      }),
      { status: 200 },
    );
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

  http.post('/api/admin/log-sources', async ({ request }) => {
    const denied = requireLogSourceManage();
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
    const parsed = logSourceUpsertRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'Log source request invalid.',
      });
    }
    const id = newId('logsrc');
    const source: LogSource = {
      logSourceId: id,
      name: parsed.data.name,
      logKind: parsed.data.logKind,
      productType: parsed.data.productType,
      protocol: parsed.data.protocol,
      parserFormat: parsed.data.parserFormat,
      assetGroupId: parsed.data.assetGroupId,
      status: parsed.data.status,
      health: 'UNKNOWN',
      listenAddress: parsed.data.listenAddress,
      listenPort: parsed.data.listenPort,
      tlsConfigPlaceholder: null,
      allowedSourceIps: parsed.data.allowedSourceIps,
      eventRetentionDays: parsed.data.eventRetentionDays,
      metricsRetentionDays: parsed.data.metricsRetentionDays,
      lastModifiedBy: actor.actorId,
      lastModifiedAt: new Date().toISOString(),
    };
    db().logSources.set(id, source);
    appendAuditEntry({
      actor,
      action: 'log_source.update',
      targetKind: 'log_source',
      targetId: id,
      requestPayload: { changedKeys: Object.keys(parsed.data) },
      note: '新建日志源',
    });
    return HttpResponse.json(logSourceSchema.parse(source), { status: 201 });
  }),

  http.put('/api/admin/log-sources/:logSourceId', async ({ params, request }) => {
    const denied = requireLogSourceManage();
    if (denied) return denied;
    const actor = db().actor!;
    const id = String(params.logSourceId);
    const existing = db().logSources.get(id);
    if (!existing) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `Log source ${id} not found.`,
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
    const parsed = logSourceUpsertRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'Log source request invalid.',
      });
    }
    const updated: LogSource = {
      ...existing,
      ...parsed.data,
      logSourceId: id,
      health: existing.health,
      tlsConfigPlaceholder: existing.tlsConfigPlaceholder,
      lastModifiedBy: actor.actorId,
      lastModifiedAt: new Date().toISOString(),
    };
    db().logSources.set(id, updated);
    appendAuditEntry({
      actor,
      action: 'log_source.update',
      targetKind: 'log_source',
      targetId: id,
      requestPayload: { changedKeys: Object.keys(parsed.data) },
    });
    return HttpResponse.json(logSourceSchema.parse(updated), { status: 200 });
  }),

  http.patch('/api/admin/log-sources/:logSourceId/toggle', async ({ params, request }) => {
    const denied = requireLogSourceManage();
    if (denied) return denied;
    const actor = db().actor!;
    const id = String(params.logSourceId);
    const existing = db().logSources.get(id);
    if (!existing) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `Log source ${id} not found.`,
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
    const parsed = logSourceToggleRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'Toggle request invalid.',
      });
    }
    const updated: LogSource = {
      ...existing,
      status: parsed.data.status,
      lastModifiedBy: actor.actorId,
      lastModifiedAt: new Date().toISOString(),
    };
    db().logSources.set(id, updated);
    appendAuditEntry({
      actor,
      action: 'log_source.update',
      targetKind: 'log_source',
      targetId: id,
      requestPayload: { toggledTo: parsed.data.status },
    });
    return HttpResponse.json(logSourceSchema.parse(updated), { status: 200 });
  }),

  http.delete('/api/admin/log-sources/:logSourceId', ({ params }) => {
    const denied = requireLogSourceManage();
    if (denied) return denied;
    const actor = db().actor!;
    const id = String(params.logSourceId);
    if (!db().logSources.has(id)) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `Log source ${id} not found.`,
      });
    }
    db().logSources.delete(id);
    appendAuditEntry({
      actor,
      action: 'log_source.update',
      targetKind: 'log_source',
      targetId: id,
      requestPayload: { deleted: true },
      note: '删除日志源',
    });
    return new HttpResponse(null, { status: 204 });
  }),
];
