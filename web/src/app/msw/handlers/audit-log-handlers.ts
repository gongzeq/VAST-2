/**
 * Audit log MSW handlers.
 *
 * Endpoints:
 *   GET /api/audit-log?…filters
 *
 * Permission: `audit_log:view`.
 *
 * The handler applies actor / action / outcome / target / time-window /
 * targetIdQuery filters in-memory. Order: occurredAt desc.
 */
import { http, HttpResponse } from 'msw';

import {
  auditLogListResponseSchema,
  auditLogQuerySchema,
  type AuditLogEntry,
} from '@/shared/contracts';

import { db } from '../db';
import { errorResponse } from './_helpers';

function matchesFilters(
  entry: AuditLogEntry,
  filters: ReturnType<typeof auditLogQuerySchema.parse>,
): boolean {
  if (filters.actorIds.length > 0 && !filters.actorIds.includes(entry.actorId)) return false;
  if (filters.actions.length > 0 && !filters.actions.includes(entry.action)) return false;
  if (filters.outcomes.length > 0 && !filters.outcomes.includes(entry.outcome)) return false;
  if (filters.targetKind && entry.targetKind !== filters.targetKind) return false;
  if (filters.targetIdQuery) {
    if (!entry.targetId.toLowerCase().includes(filters.targetIdQuery.toLowerCase())) return false;
  }
  if (filters.since && entry.occurredAt < filters.since) return false;
  if (filters.until && entry.occurredAt >= filters.until) return false;
  return true;
}

export const auditLogHandlers = [
  http.get('/api/audit-log', ({ request }) => {
    const actor = db().actor;
    if (!actor || !actor.permissionPoints.includes('audit_log:view')) {
      return errorResponse({
        status: 403,
        errorCode: 'AUTHORIZATION_DENIED',
        message: '当前角色缺少 audit_log:view 权限。',
        details: { missingPermission: 'audit_log:view' },
      });
    }

    const queryObject = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = auditLogQuerySchema.safeParse(queryObject);
    if (!parsed.success) {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'Audit log query invalid.',
      });
    }

    const filters = parsed.data;
    const allEntries = Array.from(db().auditLogEntries.values());
    const filtered = allEntries
      .filter((entry) => matchesFilters(entry, filters))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

    const start = (filters.page - 1) * filters.pageSize;
    const body = auditLogListResponseSchema.parse({
      entries: filtered.slice(start, start + filters.pageSize),
      page: filters.page,
      pageSize: filters.pageSize,
      total: filtered.length,
    });

    return HttpResponse.json(body, { status: 200 });
  }),
];
