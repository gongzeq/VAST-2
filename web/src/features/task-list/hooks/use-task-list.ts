import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/shared/api/fetch-json';
import { queryKeys, type TaskListFilters } from '@/shared/api/query-keys';
import { taskListResponseSchema, type TaskListResponse } from '@/shared/contracts';

export function useTaskList(filters: TaskListFilters) {
  return useQuery<TaskListResponse, Error>({
    queryKey: queryKeys.taskList(filters),
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (filters.workflowType) sp.set('workflowType', filters.workflowType);
      if (filters.lifecycleStage) sp.set('lifecycleStage', filters.lifecycleStage);
      if (filters.assignee) sp.set('assignee', filters.assignee);
      sp.set('page', String(filters.page));
      sp.set('pageSize', String(filters.pageSize));
      const url = `/api/tasks${sp.toString() ? `?${sp.toString()}` : ''}`;
      return fetchJson(url, taskListResponseSchema, { method: 'GET' });
    },
  });
}
