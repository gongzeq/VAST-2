import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { fetchJson } from '@/shared/api/fetch-json';
import { queryKeys } from '@/shared/api/query-keys';
import {
  mailSourceListResponseSchema,
  mailSourceSchema,
  type MailSource,
  type MailSourceUpsertRequest,
} from '@/shared/contracts';

import { useAdminMutation } from './use-admin-mutation';

export function useMailSources() {
  return useQuery({
    queryKey: queryKeys.mailSources(),
    queryFn: () => fetchJson('/api/admin/mail-sources', mailSourceListResponseSchema),
  });
}

export function useCreateMailSource() {
  return useAdminMutation<MailSourceUpsertRequest, MailSource>({
    mutationFn: (input) =>
      fetchJson('/api/admin/mail-sources', mailSourceSchema, {
        method: 'POST',
        body: input,
      }),
    invalidateKeys: [queryKeys.mailSources()],
    successMessage: '已新建邮件源',
  });
}

export function useUpdateMailSource(id: string) {
  return useAdminMutation<MailSourceUpsertRequest, MailSource>({
    mutationFn: (input) =>
      fetchJson(`/api/admin/mail-sources/${encodeURIComponent(id)}`, mailSourceSchema, {
        method: 'PUT',
        body: input,
      }),
    invalidateKeys: [queryKeys.mailSources()],
    successMessage: '已更新邮件源',
  });
}

export function useDeleteMailSource(id: string) {
  return useAdminMutation<void, null>({
    // fetchJson surfaces 4xx via ApiError so toast + onError fire.
    mutationFn: () =>
      fetchJson(`/api/admin/mail-sources/${encodeURIComponent(id)}`, z.null(), {
        method: 'DELETE',
      }),
    invalidateKeys: [queryKeys.mailSources()],
    successMessage: '已删除邮件源',
  });
}
