/**
 * Network boundary that does fetch + zod parse and converts API errors into
 * typed exceptions. Components/hooks should NEVER call `fetch` directly so the
 * "every response is parsed" rule (R4) is enforced in one place.
 */
import type { z, ZodTypeAny } from 'zod';

import {
  apiErrorResponseSchema,
  type ApiErrorResponse,
  type DomainErrorCode,
} from '@/shared/contracts/api-error-response';

export class ApiError extends Error {
  readonly errorCode: DomainErrorCode;
  readonly status: number;
  readonly response: ApiErrorResponse;

  constructor(status: number, response: ApiErrorResponse) {
    super(response.message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = response.error_code;
    this.response = response;
  }
}

/**
 * Thrown when the response shape itself does not match the expected schema.
 * Pages should catch this and render a "unknown state" recovery view rather
 * than crash (R4).
 */
export class UnknownStateError extends Error {
  constructor(
    message: string,
    readonly raw: unknown,
    readonly issues: z.ZodIssue[],
  ) {
    super(message);
    this.name = 'UnknownStateError';
  }
}

export interface FetchJsonOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

/**
 * Fetch + parse helper.
 *
 * @param url request URL
 * @param schema zod schema to parse a 2xx body
 * @param options request init; `body` is JSON-stringified if not undefined
 */
export async function fetchJson<TSchema extends ZodTypeAny>(
  url: string,
  schema: TSchema,
  options: FetchJsonOptions = {},
): Promise<z.infer<TSchema>> {
  const { body, headers, ...rest } = options;
  const response = await fetch(url, {
    ...rest,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) {
    // Null is an acceptable parse target for `z.null()` schemas.
    const empty = schema.safeParse(null);
    if (empty.success) return empty.data;
    return undefined as z.infer<TSchema>;
  }

  // Try parse JSON body. If empty body (Content-Length: 0), use null.
  const text = await response.text();
  let payload: unknown = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new UnknownStateError('响应不是合法 JSON', text, []);
    }
  }

  if (!response.ok) {
    const errorParse = apiErrorResponseSchema.safeParse(payload);
    if (errorParse.success) {
      throw new ApiError(response.status, errorParse.data);
    }
    throw new UnknownStateError(
      `请求失败 (${response.status}) 且响应不符合错误契约`,
      payload,
      errorParse.success ? [] : errorParse.error.issues,
    );
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new UnknownStateError(
      '后端响应不符合预期契约',
      payload,
      parsed.error.issues,
    );
  }
  return parsed.data;
}
