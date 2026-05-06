/**
 * Admin mail source MSW handlers.
 *
 * Permission: admin-like aggregate (no dedicated mail_source perm point).
 */
import { http, HttpResponse } from 'msw';

import {
  mailSourceListResponseSchema,
  mailSourceSchema,
  mailSourceUpsertRequestSchema,
  type MailSource,
} from '@/shared/contracts';

import { db } from '../db';
import { errorResponse, newId } from './_helpers';
import { appendAuditEntry } from './_audit-log';

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
    return HttpResponse.json(
      mailSourceListResponseSchema.parse({
        mailSources: Array.from(db().mailSources.values()),
      }),
      { status: 200 },
    );
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

  http.post('/api/admin/mail-sources', async ({ request }) => {
    const denied = requireMailSourceManage();
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
    const parsed = mailSourceUpsertRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'Mail source request invalid.',
      });
    }
    const id = newId('mailsrc');
    const source: MailSource = {
      mailSourceId: id,
      name: parsed.data.name,
      upstreamHost: parsed.data.upstreamHost,
      upstreamPort: parsed.data.upstreamPort,
      downstreamHost: parsed.data.downstreamHost,
      downstreamPort: parsed.data.downstreamPort,
      status: parsed.data.status,
      recentReceivedCount: 0,
      tlsConfigPlaceholder: null,
      maxMessageBytes: parsed.data.maxMessageBytes,
      failOpenPolicy: parsed.data.failOpenPolicy,
      lastModifiedBy: actor.actorId,
      lastModifiedAt: new Date().toISOString(),
    };
    db().mailSources.set(id, source);
    appendAuditEntry({
      actor,
      action: 'mail_source.update',
      targetKind: 'mail_source',
      targetId: id,
      requestPayload: { changedKeys: Object.keys(parsed.data) },
      note: '新建邮件源',
    });
    return HttpResponse.json(mailSourceSchema.parse(source), { status: 201 });
  }),

  http.put('/api/admin/mail-sources/:mailSourceId', async ({ params, request }) => {
    const denied = requireMailSourceManage();
    if (denied) return denied;
    const actor = db().actor!;
    const id = String(params.mailSourceId);
    const existing = db().mailSources.get(id);
    if (!existing) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `Mail source ${id} not found.`,
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
    const parsed = mailSourceUpsertRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'Mail source request invalid.',
      });
    }
    const updated: MailSource = {
      ...existing,
      ...parsed.data,
      mailSourceId: id,
      tlsConfigPlaceholder: existing.tlsConfigPlaceholder,
      recentReceivedCount: existing.recentReceivedCount,
      lastModifiedBy: actor.actorId,
      lastModifiedAt: new Date().toISOString(),
    };
    db().mailSources.set(id, updated);
    appendAuditEntry({
      actor,
      action: 'mail_source.update',
      targetKind: 'mail_source',
      targetId: id,
      requestPayload: { changedKeys: Object.keys(parsed.data) },
    });
    return HttpResponse.json(mailSourceSchema.parse(updated), { status: 200 });
  }),

  http.delete('/api/admin/mail-sources/:mailSourceId', ({ params }) => {
    const denied = requireMailSourceManage();
    if (denied) return denied;
    const actor = db().actor!;
    const id = String(params.mailSourceId);
    if (!db().mailSources.has(id)) {
      return errorResponse({
        status: 404,
        errorCode: 'TASK_EXECUTION_FAILED',
        message: `Mail source ${id} not found.`,
      });
    }
    db().mailSources.delete(id);
    appendAuditEntry({
      actor,
      action: 'mail_source.update',
      targetKind: 'mail_source',
      targetId: id,
      requestPayload: { deleted: true },
      note: '删除邮件源',
    });
    return new HttpResponse(null, { status: 204 });
  }),
];
