import { useMutation } from '@tanstack/react-query';

import { fetchJson } from '@/shared/api/fetch-json';
import {
  taskIntentResponseSchema,
  type TaskIntentResponse,
} from '@/shared/contracts/task-intent.contract';

export interface TaskIntentInput {
  prompt: string;
}

export function useTaskIntentPreview() {
  return useMutation<TaskIntentResponse, Error, TaskIntentInput>({
    mutationFn: async ({ prompt }) => {
      return fetchJson('/api/tasks/intent', taskIntentResponseSchema, {
        method: 'POST',
        body: { prompt },
      });
    },
  });
}
