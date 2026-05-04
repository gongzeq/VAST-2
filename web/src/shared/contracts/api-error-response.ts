/**
 * Frontend mirror of src/shared/contracts/api-error-response.ts.
 * Field naming uses snake_case to match backend wire format exactly.
 */
import { z } from 'zod';

import { domainErrorCodeSchema, safeDetailsSchema, taskStateSchema } from './foundation';

// Re-export DomainErrorCode here so callers that conceptually depend on the
// error response contract (e.g. fetch-json.ts, ApiError) can import the code
// type from a single module instead of crossing into foundation.
export { domainErrorCodeSchema, type DomainErrorCode } from './foundation';

export const apiErrorResponseSchema = z.object({
  error_code: domainErrorCodeSchema,
  message: z.string().min(1),
  task_state: taskStateSchema.optional(),
  details: safeDetailsSchema,
  request_id: z.string().min(1),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
