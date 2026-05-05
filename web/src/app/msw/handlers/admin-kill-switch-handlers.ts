/**
 * Admin kill-switch MSW handlers.
 *
 * GET visible to any admin-class actor (status is needed even by non-operators
 * to render the read-only card). POST/toggle requires `kill_switch:operate`
 * and lands in PR4.
 */
import { http, HttpResponse } from 'msw';

import { killSwitchStateSchema } from '@/shared/contracts';

import { db } from '../db';
import { errorResponse } from './_helpers';

function requireAnyAdminPerm() {
  const actor = db().actor;
  const anyAdmin: ReadonlyArray<string> = [
    'asset_scope:manage',
    'log_source:manage',
    'llm_provider:manage',
    'tool_config:manage',
    'kill_switch:operate',
  ];
  if (!actor || !actor.permissionPoints.some((p) => anyAdmin.includes(p))) {
    return errorResponse({
      status: 403,
      errorCode: 'AUTHORIZATION_DENIED',
      message: '当前角色无权查看 Kill Switch 状态。',
      details: { missingPermission: 'kill_switch:operate' },
    });
  }
  return null;
}

export const adminKillSwitchHandlers = [
  http.get('/api/admin/kill-switch', () => {
    const denied = requireAnyAdminPerm();
    if (denied) return denied;
    return HttpResponse.json(killSwitchStateSchema.parse(db().killSwitch), { status: 200 });
  }),
];
