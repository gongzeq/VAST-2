import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/shared/api/fetch-json';
import { queryKeys } from '@/shared/api/query-keys';
import {
  asTaskId,
  isTerminalLifecycle,
  taskRecordSchema,
  type TaskRecord,
} from '@/shared/contracts';

export interface UseTaskDetailOptions {
  /** Override polling interval; defaults to 5000 ms when not terminal. */
  pollingMs?: number;
  /**
   * When false, polling is disabled regardless of stage. Used when the user
   * lacks permission to view the resource.
   */
  enabled?: boolean;
}

export function useTaskDetail(taskId: string, options: UseTaskDetailOptions = {}) {
  const { pollingMs = 5000, enabled = true } = options;
  return useQuery<TaskRecord, Error>({
    queryKey: queryKeys.taskDetail(asTaskId(taskId)),
    enabled,
    queryFn: async () => {
      return fetchJson(
        `/api/tasks/${encodeURIComponent(taskId)}`,
        taskRecordSchema,
        { method: 'GET' },
      );
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return pollingMs;
      return isTerminalLifecycle(data.lifecycleStage) ? false : pollingMs;
    },
  });
}
