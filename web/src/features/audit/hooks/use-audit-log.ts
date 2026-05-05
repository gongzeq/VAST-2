/**
 * Audit-log query hook.
 *
 * Query is disabled when actor lacks `audit_log:view`; the page renders
 * UnauthorizedState itself, per PRD R-C (no redirecting gate).
 */
import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/shared/api/fetch-json';
import { queryKeys } from '@/shared/api/query-keys';
import {
  auditLogListResponseSchema,
  type AuditLogListResponse,
} from '@/shared/contracts/audit-log.contract';
import { useCanViewAuditLog } from '@/shared/hooks/use-can';

import type { AuditLogFilter } from '../state/audit-log-filter.contract';

export function useAuditLog(filter: AuditLogFilter) {
  const canViewAuditLog = useCanViewAuditLog();
  return useQuery<AuditLogListResponse, Error>({
    queryKey: queryKeys.auditLog(filter),
    enabled: canViewAuditLog,
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (filter.actorIds.length > 0) sp.set('actorIds', filter.actorIds.join(','));
      if (filter.actions.length > 0) sp.set('actions', filter.actions.join(','));
      if (filter.outcomes.length > 0) sp.set('outcomes', filter.outcomes.join(','));
      if (filter.targetKind) sp.set('targetKind', filter.targetKind);
      if (filter.targetIdQuery) sp.set('targetIdQuery', filter.targetIdQuery);
      if (filter.since) sp.set('since', filter.since);
      if (filter.until) sp.set('until', filter.until);
      sp.set('page', String(filter.page));
      sp.set('pageSize', String(filter.pageSize));
      return fetchJson(`/api/audit-log?${sp.toString()}`, auditLogListResponseSchema, {
        method: 'GET',
      });
    },
  });
}
