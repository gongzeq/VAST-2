/**
 * Helper utilities used by MSW handlers.
 */
import { HttpResponse } from 'msw';

import {
  apiErrorResponseSchema,
  type ApiErrorResponse,
  type DomainErrorCode,
  type SafeDetails,
  type TaskState,
} from '@/shared/contracts';

let requestCounter = 0;

export function newRequestId(): string {
  requestCounter += 1;
  return `req_${Date.now()}_${requestCounter}`;
}

export function newId(prefix: string): string {
  requestCounter += 1;
  return `${prefix}_${Date.now()}_${requestCounter}`;
}

export interface ErrorResponseOptions {
  status: number;
  errorCode: DomainErrorCode;
  message: string;
  taskState?: TaskState;
  details?: SafeDetails;
}

export function errorResponse({
  status,
  errorCode,
  message,
  taskState,
  details,
}: ErrorResponseOptions): HttpResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = {
    error_code: errorCode,
    message,
    ...(taskState !== undefined ? { task_state: taskState } : {}),
    details: details ?? {},
    request_id: newRequestId(),
  };

  // Validate ourselves so the test that runs handlers through schema parses
  // never hits a malformed error body.
  apiErrorResponseSchema.parse(body);

  return HttpResponse.json(body, { status });
}
