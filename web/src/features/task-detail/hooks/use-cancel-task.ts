import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from '@/shared/api/fetch-json';
import { queryKeys } from '@/shared/api/query-keys';
import {
  asTaskId,
  taskRecordSchema,
  type TaskRecord,
} from '@/shared/contracts';

export interface CancelTaskInput {
  taskId: string;
}

export function useCancelTask() {
  const qc = useQueryClient();
  return useMutation<TaskRecord, Error, CancelTaskInput>({
    mutationFn: async ({ taskId }) => {
      return fetchJson(
        `/api/tasks/${encodeURIComponent(taskId)}/cancel`,
        taskRecordSchema,
        { method: 'POST' },
      );
    },
    onSuccess: (record) => {
      qc.invalidateQueries({
        queryKey: queryKeys.taskDetail(asTaskId(record.taskId)),
      });
    },
  });
}
