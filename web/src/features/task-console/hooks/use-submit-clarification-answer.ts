import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from '@/shared/api/fetch-json';
import { queryKeys } from '@/shared/api/query-keys';
import {
  asTaskId,
  type TaskRecord,
} from '@/shared/contracts';
import { taskRecordSchema } from '@/shared/contracts/task-execution.contract';

export interface SubmitClarificationInput {
  taskId: string;
  clarificationId: string;
  answer: string;
}

export function useSubmitClarificationAnswer() {
  const qc = useQueryClient();
  return useMutation<TaskRecord, Error, SubmitClarificationInput>({
    mutationFn: async ({ taskId, clarificationId, answer }) => {
      return fetchJson(
        `/api/tasks/${encodeURIComponent(taskId)}/clarifications/${encodeURIComponent(clarificationId)}/answer`,
        taskRecordSchema,
        {
          method: 'POST',
          body: { answer },
        },
      );
    },
    onSuccess: (record) => {
      qc.invalidateQueries({
        queryKey: queryKeys.taskDetail(asTaskId(record.taskId)),
      });
    },
  });
}
