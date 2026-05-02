import { toApiErrorResponse, type ApiErrorResponse } from '../../shared/contracts/api-error-response.js';
import { createId } from '../../shared/contracts/foundation.js';

export const presentDomainError = (error: unknown, requestId = createId('req')): ApiErrorResponse => {
  return toApiErrorResponse(error, requestId);
};
