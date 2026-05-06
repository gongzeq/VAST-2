/**
 * Generic mutation wrapper used by every admin block.
 *
 * - Invalidates the supplied query keys on success.
 * - Toasts success/error so reviewers see immediate feedback per PRD R4.
 * - Never optimistic — out of scope per task PRD.
 */
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';

import { ApiError, UnknownStateError } from '@/shared/api/fetch-json';
import { useToast } from '@/shared/hooks/use-toast';

export interface UseAdminMutationOptions<TArgs, TResult> {
  mutationFn: (args: TArgs) => Promise<TResult>;
  /** Query keys to invalidate on success. */
  invalidateKeys?: QueryKey[];
  /** Toast text shown on success. */
  successMessage: string;
  /** Custom error formatter. Defaults to the API error message. */
  formatError?: (error: unknown) => string;
}

export function useAdminMutation<TArgs, TResult>({
  mutationFn,
  invalidateKeys = [],
  successMessage,
  formatError,
}: UseAdminMutationOptions<TArgs, TResult>) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  return useMutation<TResult, Error, TArgs>({
    mutationFn,
    onSuccess: () => {
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      pushToast('success', successMessage);
    },
    onError: (error) => {
      const formatted = formatError
        ? formatError(error)
        : error instanceof ApiError
        ? error.message
        : error instanceof UnknownStateError
        ? '响应不符合契约，已阻断渲染。'
        : error.message;
      pushToast('error', formatted);
    },
  });
}
