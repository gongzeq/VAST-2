import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/shared/api/fetch-json';
import { queryKeys } from '@/shared/api/query-keys';
import { asMailTaskId } from '@/shared/contracts/branded-ids';
import {
  mailAnalysisDetailResponseSchema,
  type MailAnalysisDetailResponse,
} from '@/shared/contracts/mail-analysis.contract';

export function useMailAnalysis(mailTaskId: string, options: { enabled?: boolean } = {}) {
  return useQuery<MailAnalysisDetailResponse, Error>({
    queryKey: queryKeys.mailAnalysis(asMailTaskId(mailTaskId)),
    enabled: options.enabled ?? mailTaskId.length > 0,
    queryFn: async () =>
      fetchJson(
        `/api/mails/${encodeURIComponent(mailTaskId)}`,
        mailAnalysisDetailResponseSchema,
        { method: 'GET' },
      ),
  });
}
