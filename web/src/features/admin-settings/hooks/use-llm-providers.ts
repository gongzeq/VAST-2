/**
 * LLM Provider data hooks — list / detail read + create / update / toggle / delete mutations.
 */
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { fetchJson } from '@/shared/api/fetch-json';
import { queryKeys } from '@/shared/api/query-keys';
import {
  llmProviderListResponseSchema,
  llmProviderSchema,
  type LlmProvider,
  type LlmProviderUpsertRequest,
} from '@/shared/contracts';
import { asLlmProviderId } from '@/shared/contracts/branded-ids';

import { useAdminMutation } from './use-admin-mutation';

export function useLlmProviders() {
  return useQuery({
    queryKey: queryKeys.llmProviders(),
    queryFn: () => fetchJson('/api/admin/llm-providers', llmProviderListResponseSchema),
  });
}

export function useCreateLlmProvider() {
  return useAdminMutation<LlmProviderUpsertRequest, LlmProvider>({
    mutationFn: (input) =>
      fetchJson('/api/admin/llm-providers', llmProviderSchema, {
        method: 'POST',
        body: input,
      }),
    invalidateKeys: [queryKeys.llmProviders()],
    successMessage: '已新建 LLM Provider',
  });
}

export function useUpdateLlmProvider(id: string) {
  return useAdminMutation<LlmProviderUpsertRequest, LlmProvider>({
    mutationFn: (input) =>
      fetchJson(`/api/admin/llm-providers/${encodeURIComponent(id)}`, llmProviderSchema, {
        method: 'PUT',
        body: input,
      }),
    invalidateKeys: [queryKeys.llmProviders(), queryKeys.llmProvider(asLlmProviderId(id))],
    successMessage: '已更新 LLM Provider',
  });
}

export function useToggleLlmProvider(id: string) {
  return useAdminMutation<void, LlmProvider>({
    mutationFn: () =>
      fetchJson(`/api/admin/llm-providers/${encodeURIComponent(id)}/toggle`, llmProviderSchema, {
        method: 'PATCH',
      }),
    invalidateKeys: [queryKeys.llmProviders()],
    successMessage: '状态已切换',
  });
}

export function useDeleteLlmProvider(id: string) {
  return useAdminMutation<void, null>({
    // Use fetchJson with z.null() so a non-2xx delete still surfaces as an
    // ApiError (toast + onError) instead of silently resolving.
    mutationFn: () =>
      fetchJson(`/api/admin/llm-providers/${encodeURIComponent(id)}`, z.null(), {
        method: 'DELETE',
      }),
    invalidateKeys: [queryKeys.llmProviders()],
    successMessage: '已删除 LLM Provider',
  });
}
