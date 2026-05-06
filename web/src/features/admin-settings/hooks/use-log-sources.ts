import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { fetchJson } from '@/shared/api/fetch-json';
import { queryKeys } from '@/shared/api/query-keys';
import {
  logSourceListResponseSchema,
  logSourceSchema,
  type AdminEntityStatus,
  type LogSource,
  type LogSourceUpsertRequest,
} from '@/shared/contracts';

import { useAdminMutation } from './use-admin-mutation';

export function useLogSources() {
  return useQuery({
    queryKey: queryKeys.logSources(),
    queryFn: () => fetchJson('/api/admin/log-sources', logSourceListResponseSchema),
  });
}

export function useCreateLogSource() {
  return useAdminMutation<LogSourceUpsertRequest, LogSource>({
    mutationFn: (input) =>
      fetchJson('/api/admin/log-sources', logSourceSchema, {
        method: 'POST',
        body: input,
      }),
    invalidateKeys: [queryKeys.logSources()],
    successMessage: '已新建日志源',
  });
}

export function useUpdateLogSource(id: string) {
  return useAdminMutation<LogSourceUpsertRequest, LogSource>({
    mutationFn: (input) =>
      fetchJson(`/api/admin/log-sources/${encodeURIComponent(id)}`, logSourceSchema, {
        method: 'PUT',
        body: input,
      }),
    invalidateKeys: [queryKeys.logSources()],
    successMessage: '已更新日志源',
  });
}

export function useToggleLogSource(id: string) {
  return useAdminMutation<{ status: AdminEntityStatus }, LogSource>({
    mutationFn: (input) =>
      fetchJson(
        `/api/admin/log-sources/${encodeURIComponent(id)}/toggle`,
        logSourceSchema,
        { method: 'PATCH', body: input },
      ),
    invalidateKeys: [queryKeys.logSources()],
    successMessage: '日志源状态已切换',
  });
}

export function useDeleteLogSource(id: string) {
  return useAdminMutation<void, null>({
    // fetchJson surfaces 4xx via ApiError so toast + onError fire.
    mutationFn: () =>
      fetchJson(`/api/admin/log-sources/${encodeURIComponent(id)}`, z.null(), {
        method: 'DELETE',
      }),
    invalidateKeys: [queryKeys.logSources()],
    successMessage: '已删除日志源',
  });
}
