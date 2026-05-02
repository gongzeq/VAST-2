import { z } from 'zod';

import { DomainError, domainErrorCodeSchema, safeDetailsSchema, taskStateSchema } from './foundation.js';

export const apiErrorResponseSchema = z.object({
  error_code: domainErrorCodeSchema,
  message: z.string().min(1),
  task_state: taskStateSchema.optional(),
  details: safeDetailsSchema,
  request_id: z.string().min(1),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

export const toApiErrorResponse = (error: unknown, requestId: string): ApiErrorResponse => {
  if (error instanceof DomainError) {
    return {
      error_code: error.errorCode,
      message: error.message,
      task_state: error.taskState,
      details: error.details,
      request_id: requestId,
    };
  }

  return {
    error_code: 'TASK_EXECUTION_FAILED',
    message: 'An unexpected error occurred.',
    details: {},
    request_id: requestId,
  };
};
