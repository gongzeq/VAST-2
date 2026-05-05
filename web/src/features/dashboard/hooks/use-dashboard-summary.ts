/**
 * Dashboard summary query.
 *
 * - 60-second `refetchInterval` per PRD R2.
 * - TanStack Query's default `refetchIntervalInBackground: false` already
 *   pauses the timer when the tab is hidden (`document.visibilityState`).
 *   We do not override that default.
 * - Response is parsed through `dashboardSummarySchema` inside `fetchJson`,
 *   so a drifted handler / backend surfaces as `UnknownStateError` rather
 *   than rendering garbage.
 */
import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/shared/api/fetch-json';
import { queryKeys } from '@/shared/api/query-keys';
import {
  dashboardSummarySchema,
  type DashboardSummary,
} from '@/shared/contracts/dashboard-summary.contract';

import type { DashboardFilter } from '../state/dashboard-filter.contract';

const REFETCH_INTERVAL_MS = 60_000;

export function useDashboardSummary(filter: DashboardFilter) {
  return useQuery<DashboardSummary, Error>({
    queryKey: queryKeys.dashboardSummary({
      scope: filter.scope,
      assetGroupIds: filter.assetGroupIds,
    }),
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set('scope', filter.scope);
      if (filter.assetGroupIds.length > 0) {
        sp.set('assetGroupIds', filter.assetGroupIds.join(','));
      }
      return fetchJson(
        `/api/dashboard/summary?${sp.toString()}`,
        dashboardSummarySchema,
        { method: 'GET' },
      );
    },
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
