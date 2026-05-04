import { http, HttpResponse } from 'msw';
import { z } from 'zod';

import { actorContextSchema } from '@/shared/contracts/actor-context.contract';
import {
  buildActorContextFromRole,
  isPresetRoleId,
} from '@/shared/auth/roles';

import { db } from '../db';
import { errorResponse } from './_helpers';

const loginRequestSchema = z.object({
  username: z.string().min(1),
  roleId: z.string().min(1),
});

export const authHandlers = [
  // POST /api/auth/session — login
  http.post('/api/auth/session', async ({ request }) => {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'Login payload was not valid JSON.',
      });
    }
    const parsed = loginRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: 'username and roleId are required.',
      });
    }
    const { username, roleId } = parsed.data;
    if (!isPresetRoleId(roleId)) {
      return errorResponse({
        status: 400,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: `Unknown roleId: ${roleId}`,
      });
    }
    const actor = buildActorContextFromRole(username, roleId);
    db().actor = actor;
    const validated = actorContextSchema.parse(actor);
    return HttpResponse.json(validated, { status: 200 });
  }),

  // GET /api/auth/session — current actor
  http.get('/api/auth/session', () => {
    const actor = db().actor;
    if (!actor) {
      return errorResponse({
        status: 401,
        errorCode: 'AUTHORIZATION_DENIED',
        message: '尚未登录。',
      });
    }
    return HttpResponse.json(actorContextSchema.parse(actor), { status: 200 });
  }),

  // DELETE /api/auth/session — logout
  http.delete('/api/auth/session', () => {
    db().actor = null;
    return new HttpResponse(null, { status: 204 });
  }),
];
