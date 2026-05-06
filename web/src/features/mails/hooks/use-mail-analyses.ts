import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/shared/api/fetch-json';
import { queryKeys } from '@/shared/api/query-keys';
import {
  mailAnalysisListResponseSchema,
  type MailAnalysisListResponse,
} from '@/shared/contracts/mail-analysis.contract';

import type { MailListFilter } from '../state/mail-list-filter.contract';

export function useMailAnalyses(filters: MailListFilter) {
  return useQuery<MailAnalysisListResponse, Error>({
    queryKey: queryKeys.mailAnalyses({
      assetGroupId: filters.assetGroupId,
      gatewayId: filters.gatewayId,
      phishingLabel: filters.phishingLabel,
      since: filters.since,
      until: filters.until,
      sort: `${filters.sort.field}:${filters.sort.dir}`,
      page: filters.page,
      pageSize: filters.pageSize,
    }),
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (filters.assetGroupId) sp.set('assetGroupId', filters.assetGroupId);
      if (filters.gatewayId) sp.set('gatewayId', filters.gatewayId);
      if (filters.phishingLabel) sp.set('phishingLabel', filters.phishingLabel);
      if (filters.since) sp.set('since', filters.since);
      if (filters.until) sp.set('until', filters.until);
      sp.set('sort', `${filters.sort.field}:${filters.sort.dir}`);
      sp.set('page', String(filters.page));
      sp.set('pageSize', String(filters.pageSize));
      return fetchJson(`/api/mails?${sp.toString()}`, mailAnalysisListResponseSchema, { method: 'GET' });
    },
  });
}
