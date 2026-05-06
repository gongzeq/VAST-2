import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/shared/api/fetch-json';
import { queryKeys } from '@/shared/api/query-keys';
import {
  toolConfigListResponseSchema,
  toolConfigSchema,
  type ToolConfig,
  type ToolConfigUpdateRequest,
  type ToolName,
} from '@/shared/contracts';

import { useAdminMutation } from './use-admin-mutation';

export function useToolConfigs() {
  return useQuery({
    queryKey: queryKeys.toolConfigs(),
    queryFn: () => fetchJson('/api/admin/tool-configs', toolConfigListResponseSchema),
  });
}

export function useUpdateToolConfig(tool: ToolName) {
  return useAdminMutation<ToolConfigUpdateRequest, ToolConfig>({
    mutationFn: (input) =>
      fetchJson(`/api/admin/tool-configs/${encodeURIComponent(tool)}`, toolConfigSchema, {
        method: 'PUT',
        body: input,
      }),
    invalidateKeys: [queryKeys.toolConfigs(), queryKeys.toolConfig(tool)],
    successMessage: '已更新工具配置',
  });
}
