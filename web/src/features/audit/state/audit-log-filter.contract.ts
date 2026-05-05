/**
 * URL state parser/serializer for the audit log surface.
 *
 * Non-sensitive filter state is URL-backed so security auditors can share and
 * recover views after navigation. Bad hand-edited params fall back to safe
 * defaults instead of crashing the page.
 */
import { z } from 'zod';

import {
  auditActionSchema,
  auditActions,
  auditOutcomeSchema,
  auditOutcomes,
  auditTargetKindSchema,
  type AuditAction,
  type AuditOutcome,
  type AuditTargetKind,
} from '@/shared/contracts/audit-log.contract';

const commaList = (value: string | null): string[] =>
  (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

export const auditLogFilterSchema = z.object({
  actorIds: z.array(z.string().min(1)).default([]),
  actions: z.array(auditActionSchema).default([]),
  outcomes: z.array(auditOutcomeSchema).default([]),
  targetKind: auditTargetKindSchema.optional(),
  targetIdQuery: z.string().trim().min(1).optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type AuditLogFilter = z.infer<typeof auditLogFilterSchema>;

const FALLBACK: AuditLogFilter = {
  actorIds: [],
  actions: [],
  outcomes: [],
  page: 1,
  pageSize: 50,
};

function parseAuditActions(raw: string[]): AuditAction[] {
  return raw.filter((value): value is AuditAction => auditActions.includes(value as AuditAction));
}

function parseAuditOutcomes(raw: string[]): AuditOutcome[] {
  return raw.filter((value): value is AuditOutcome => auditOutcomes.includes(value as AuditOutcome));
}

export function parseAuditLogFilter(searchParams: URLSearchParams): AuditLogFilter {
  const result = auditLogFilterSchema.safeParse({
    actorIds: commaList(searchParams.get('actorIds')),
    actions: parseAuditActions(commaList(searchParams.get('actions'))),
    outcomes: parseAuditOutcomes(commaList(searchParams.get('outcomes'))),
    targetKind: searchParams.get('targetKind') ?? undefined,
    targetIdQuery: searchParams.get('targetIdQuery') ?? undefined,
    since: searchParams.get('since') ?? undefined,
    until: searchParams.get('until') ?? undefined,
    page: searchParams.get('page') ?? undefined,
    pageSize: searchParams.get('pageSize') ?? undefined,
  });
  if (!result.success) return FALLBACK;
  return {
    ...result.data,
    actorIds: [...result.data.actorIds].sort(),
    actions: [...result.data.actions].sort(),
    outcomes: [...result.data.outcomes].sort(),
  };
}

export function serializeAuditLogFilter(filter: AuditLogFilter): URLSearchParams {
  const sp = new URLSearchParams();
  if (filter.actorIds.length > 0) sp.set('actorIds', [...filter.actorIds].sort().join(','));
  if (filter.actions.length > 0) sp.set('actions', [...filter.actions].sort().join(','));
  if (filter.outcomes.length > 0) sp.set('outcomes', [...filter.outcomes].sort().join(','));
  if (filter.targetKind) sp.set('targetKind', filter.targetKind);
  if (filter.targetIdQuery) sp.set('targetIdQuery', filter.targetIdQuery);
  if (filter.since) sp.set('since', filter.since);
  if (filter.until) sp.set('until', filter.until);
  if (filter.page !== 1) sp.set('page', String(filter.page));
  if (filter.pageSize !== 50) sp.set('pageSize', String(filter.pageSize));
  return sp;
}

export function resetAuditPagination(filter: AuditLogFilter): AuditLogFilter {
  return { ...filter, page: 1 };
}

export type { AuditAction, AuditOutcome, AuditTargetKind };
